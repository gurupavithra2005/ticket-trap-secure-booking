import { db } from '../db/database.ts';
import { Order, OrderItem, Payment, Ticket, PaymentStatus } from '../db/schema.ts';
import { SecurityService } from './security.service.ts';
import crypto from 'node:crypto';

export interface CheckoutResult {
  success: boolean;
  code?: string;
  message: string;
  order?: Order;
  payment?: Payment;
  tickets?: Ticket[];
}

export class OrderService {
  /**
   * Completes checkout flow for an active reservation
   * Simulates payment outcome (SUCCESS, DECLINED, TIMEOUT)
   * On failure: executes automatic compensating transaction releasing reserved inventory
   */
  public static async processCheckout(params: {
    userId: string;
    reservationId: string;
    paymentOutcome: PaymentStatus;
    customerName: string;
    customerEmail: string;
    paymentMethod?: string;
    idempotencyKey?: string;
    ipAddress?: string;
  }): Promise<CheckoutResult> {
    const {
      userId,
      reservationId,
      paymentOutcome,
      customerName,
      customerEmail,
      paymentMethod = 'Credit Card (Mock Visa •••• 4242)',
      idempotencyKey,
      ipAddress = '127.0.0.1',
    } = params;

    // Retrieve reservation
    const reservation = db.reservations.get(reservationId);
    if (!reservation) {
      return { success: false, code: 'RESERVATION_NOT_FOUND', message: 'Reservation not found.' };
    }

    if (reservation.userId !== userId) {
      return { success: false, code: 'UNAUTHORIZED', message: 'Reservation belongs to another user.' };
    }

    // Verify reservation is active and NOT expired
    const now = Date.now();
    if (reservation.status !== 'ACTIVE' || new Date(reservation.expiresAt).getTime() <= now) {
      // Lazy cleanup if expired
      if (reservation.status === 'ACTIVE') {
        reservation.status = 'EXPIRED';
        await db.cleanupExpiredReservations();
      }
      return {
        success: false,
        code: 'RESERVATION_EXPIRED',
        message: 'Your ticket reservation hold has expired. The tickets were released back to public availability.',
      };
    }

    // Acquire lock on event inventory to ensure atomic commit or rollback
    const eventLock = db.getLock(`event-inventory:${reservation.eventId}`);
    const releaseLock = await eventLock.acquire();

    try {
      const reservationItems = Array.from(db.reservationItems.values()).filter(
        (i) => i.reservationId === reservation.id
      );

      if (reservationItems.length === 0) {
        return { success: false, code: 'EMPTY_RESERVATION', message: 'No items in this reservation.' };
      }

      // Calculate total amount
      const totalAmount = reservationItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

      // Create initial order record in PAYMENT_PENDING state
      const orderId = crypto.randomUUID();
      const order: Order = {
        id: orderId,
        userId,
        eventId: reservation.eventId,
        reservationId: reservation.id,
        status: 'PAYMENT_PENDING',
        totalAmount,
        idempotencyKey,
        customerName,
        customerEmail,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      db.orders.set(order.id, order);

      // Save order items
      for (const item of reservationItems) {
        const orderItem: OrderItem = {
          id: crypto.randomUUID(),
          orderId: order.id,
          ticketTypeId: item.ticketTypeId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        };
        db.orderItems.set(orderItem.id, orderItem);
      }

      // Record simulated payment
      const paymentId = crypto.randomUUID();
      const payment: Payment = {
        id: paymentId,
        orderId: order.id,
        amount: totalAmount,
        status: paymentOutcome,
        providerReference: `MOCK_TXN_${crypto.randomBytes(6).toString('hex').toUpperCase()}`,
        paymentMethod,
        failureReason:
          paymentOutcome === 'DECLINED'
            ? 'Card declined by issuing bank (insufficient funds simulation)'
            : paymentOutcome === 'TIMEOUT'
            ? 'Gateway timeout after 30s response deadline'
            : undefined,
        createdAt: new Date().toISOString(),
      };
      db.payments.set(payment.id, payment);

      // ==========================================
      // CASE 1: PAYMENT FAILED OR TIMED OUT
      // ==========================================
      if (paymentOutcome !== 'SUCCESS') {
        order.status = 'PAYMENT_FAILED';
        order.updatedAt = new Date().toISOString();

        // RUN COMPENSATING ACTION: Release held inventory immediately!
        for (const item of reservationItems) {
          const ticketType = db.ticketTypes.get(item.ticketTypeId);
          if (ticketType) {
            ticketType.reservedQuantity = Math.max(0, ticketType.reservedQuantity - item.quantity);
            ticketType.availableQuantity = Math.min(
              ticketType.totalQuantity - ticketType.soldQuantity,
              ticketType.availableQuantity + item.quantity
            );
          }
        }

        reservation.status = 'CANCELLED';

        db.recordSecurityEvent(
          'PAYMENT_COMPENSATED',
          'WARN',
          `Payment ${paymentOutcome} for order ${order.id.slice(0, 8)}. Held tickets returned to inventory immediately.`,
          { orderId: order.id, reason: payment.failureReason, amount: totalAmount },
          ipAddress,
          userId
        );

        db.broadcast('inventory_update', { eventId: reservation.eventId, timestamp: Date.now() });

        return {
          success: false,
          code: paymentOutcome === 'DECLINED' ? 'PAYMENT_DECLINED' : 'PAYMENT_TIMEOUT',
          message: `Payment failed (${paymentOutcome}). Your reserved tickets were released back to availability.`,
          order,
          payment,
        };
      }

      // ==========================================
      // CASE 2: PAYMENT SUCCESSFUL
      // ==========================================
      order.status = 'CONFIRMED';
      order.paymentReference = payment.providerReference;
      order.updatedAt = new Date().toISOString();

      // Commit inventory: transfer from reserved to sold!
      for (const item of reservationItems) {
        const ticketType = db.ticketTypes.get(item.ticketTypeId);
        if (ticketType) {
          ticketType.reservedQuantity = Math.max(0, ticketType.reservedQuantity - item.quantity);
          ticketType.soldQuantity += item.quantity;
        }
      }

      reservation.status = 'COMPLETED';

      // Generate tamper-resistant signed tickets
      const event = db.events.get(reservation.eventId)!;
      const generatedTickets: Ticket[] = [];

      let seatCounter = 1;
      for (const item of reservationItems) {
        const ticketType = db.ticketTypes.get(item.ticketTypeId)!;
        for (let i = 0; i < item.quantity; i++) {
          const ticketId = crypto.randomUUID();
          const { secureToken, signature } = SecurityService.generateTicketToken(
            ticketId,
            event.id,
            order.id
          );

          const ticket: Ticket = {
            id: ticketId,
            orderId: order.id,
            eventId: event.id,
            ticketTypeId: ticketType.id,
            secureToken,
            signature,
            status: 'VALID',
            ticketTypeName: ticketType.name,
            eventName: event.name,
            venue: event.venue,
            eventDate: event.eventDate,
            holderName: customerName,
            holderEmail: customerEmail,
            seatLabel: `${ticketType.name.substring(0, 3).toUpperCase()}-S${seatCounter++}`,
            issuedAt: new Date().toISOString(),
          };

          db.tickets.set(ticket.id, ticket);
          generatedTickets.push(ticket);
        }
      }

      db.recordSecurityEvent(
        'CONCURRENCY_RACE_SERIALIZED',
        'INFO',
        `Order ${order.id.slice(0, 8)} confirmed! Issued ${generatedTickets.length} tamper-resistant signed tickets.`,
        { orderId: order.id, ticketCount: generatedTickets.length, totalAmount },
        ipAddress,
        userId
      );

      db.broadcast('inventory_update', { eventId: reservation.eventId, timestamp: Date.now() });

      return {
        success: true,
        message: 'Payment confirmed and tickets issued successfully.',
        order,
        payment,
        tickets: generatedTickets,
      };
    } finally {
      releaseLock();
    }
  }
}
