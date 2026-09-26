import { db } from '../db/database.ts';
import { Reservation, ReservationItem } from '../db/schema.ts';
import crypto from 'node:crypto';

export interface ReserveRequestItem {
  ticketTypeId: string;
  quantity: number;
}

export interface ReservationResult {
  success: boolean;
  code?: string;
  message: string;
  reservation?: Reservation;
  items?: ReservationItem[];
  expiresAt?: string;
  holdSecondsRemaining?: number;
}

export class ReservationService {
  /**
   * Authoritative Atomic Reservation Transaction
   * Guarantees:
   * 1. No overselling (atomic lock on event/ticket type rows)
   * 2. No ticket-limit bypassing (even with 20 parallel requests in async race)
   * 3. Idempotent request handling
   * 4. Auto-expiration timestamping
   */
  public static async createReservation(params: {
    userId: string;
    eventId: string;
    items: ReserveRequestItem[];
    idempotencyKey?: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<ReservationResult> {
    const { userId, eventId, items, idempotencyKey, ipAddress = '127.0.0.1', userAgent } = params;

    db.metrics.concurrentAttempts++;

    // 1. Idempotency check: if key provided and already processed, return existing active reservation
    if (idempotencyKey) {
      const existingIdempotency = db.idempotencyKeys.get(idempotencyKey);
      if (existingIdempotency && existingIdempotency.userId === userId) {
        db.recordSecurityEvent(
          'DUPLICATE_IDEMPOTENCY_REJECTED',
          'INFO',
          `Idempotent replay detected for key ${idempotencyKey.slice(0, 10)}... Returning cached reservation.`,
          { idempotencyKey, userId, reservationId: existingIdempotency.result?.reservation?.id },
          ipAddress,
          userId
        );
        return existingIdempotency.result;
      }
    }

    // 2. Validate input parameters
    if (!items || items.length === 0) {
      return { success: false, code: 'INVALID_REQUEST', message: 'No ticket items specified.' };
    }

    const totalRequestedQuantity = items.reduce((sum, i) => sum + i.quantity, 0);
    if (totalRequestedQuantity <= 0 || items.some((i) => i.quantity <= 0 || !Number.isInteger(i.quantity))) {
      return { success: false, code: 'INVALID_QUANTITY', message: 'Requested quantities must be positive integers.' };
    }

    // 3. Acquire atomic row-level mutex lock for this event to guarantee serial isolation
    const eventLock = db.getLock(`event-inventory:${eventId}`);
    const releaseLock = await eventLock.acquire();

    try {
      // Lazy cleanup of any expired reservations before calculating inventory
      await db.cleanupExpiredReservations();

      // Retrieve and validate event
      const event = db.events.get(eventId);
      if (!event || event.status !== 'PUBLISHED') {
        return { success: false, code: 'EVENT_NOT_AVAILABLE', message: 'Event not found or not published.' };
      }

      // 4. Strict Purchase Limit Verification (includes active reservations + completed orders)
      const currentCommitted = db.getUserCommittedTicketCount(userId, eventId);
      const maxAllowed = event.maxTicketsPerUser;

      if (currentCommitted + totalRequestedQuantity > maxAllowed) {
        db.recordSecurityEvent(
          'TICKET_LIMIT_EXCEEDED',
          'WARN',
          `User exceeded ticket limit for event ${event.name}. Committed: ${currentCommitted}, Requested: ${totalRequestedQuantity}, Max: ${maxAllowed}.`,
          { userId, eventId, currentCommitted, totalRequestedQuantity, maxAllowed },
          ipAddress,
          userId
        );
        return {
          success: false,
          code: 'TICKET_LIMIT_EXCEEDED',
          message: `Booking exceeds purchase limit. You currently have ${currentCommitted} tickets (active holds + orders). Maximum allowed is ${maxAllowed}.`,
        };
      }

      // 5. Verify availability for each requested ticket type
      for (const item of items) {
        const ticketType = db.ticketTypes.get(item.ticketTypeId);
        if (!ticketType || ticketType.eventId !== eventId) {
          return { success: false, code: 'INVALID_TICKET_TYPE', message: 'Invalid ticket type specified.' };
        }

        if (ticketType.availableQuantity < item.quantity) {
          db.recordSecurityEvent(
            'OVERSELL_PREVENTED',
            'CRITICAL',
            `Oversell attempt blocked for tier '${ticketType.name}'. Available: ${ticketType.availableQuantity}, Requested: ${item.quantity}.`,
            { ticketTypeId: ticketType.id, availableQuantity: ticketType.availableQuantity, requested: item.quantity },
            ipAddress,
            userId
          );
          return {
            success: false,
            code: 'INSUFFICIENT_INVENTORY',
            message: `Only ${ticketType.availableQuantity} tickets remaining for '${ticketType.name}'. Cannot allocate ${item.quantity}.`,
          };
        }

        // Tier specific purchase limit check
        if (item.quantity > ticketType.purchaseLimit) {
          return {
            success: false,
            code: 'TIER_LIMIT_EXCEEDED',
            message: `Maximum of ${ticketType.purchaseLimit} allowed per transaction for '${ticketType.name}'.`,
          };
        }
      }

      // 6. ATOMIC ALLOCATION: Decrement available, increment reserved
      const reservationId = crypto.randomUUID();
      const holdDuration = event.holdDurationSeconds || 300;
      const expiresAt = new Date(Date.now() + holdDuration * 1000).toISOString();

      const createdItems: ReservationItem[] = [];

      for (const item of items) {
        const ticketType = db.ticketTypes.get(item.ticketTypeId)!;
        ticketType.availableQuantity -= item.quantity;
        ticketType.reservedQuantity += item.quantity;

        const resItem: ReservationItem = {
          id: crypto.randomUUID(),
          reservationId,
          ticketTypeId: item.ticketTypeId,
          quantity: item.quantity,
          unitPrice: ticketType.price,
        };
        db.reservationItems.set(resItem.id, resItem);
        createdItems.push(resItem);
      }

      // 7. Create Reservation Record
      const reservation: Reservation = {
        id: reservationId,
        userId,
        eventId,
        status: 'ACTIVE',
        expiresAt,
        idempotencyKey,
        createdAt: new Date().toISOString(),
        ipAddress,
        userAgent,
      };

      db.reservations.set(reservation.id, reservation);

      const result: ReservationResult = {
        success: true,
        message: 'Tickets reserved successfully.',
        reservation,
        items: createdItems,
        expiresAt,
        holdSecondsRemaining: holdDuration,
      };

      // 8. Store idempotency key result if key was provided
      if (idempotencyKey) {
        db.idempotencyKeys.set(idempotencyKey, {
          userId,
          result,
          expiresAt: Date.now() + holdDuration * 1000,
        });
      }

      db.metrics.successfulReservations++;

      // Broadcast inventory update to all live clients
      db.broadcast('inventory_update', { eventId, timestamp: Date.now() });

      return result;
    } finally {
      releaseLock();
    }
  }

  /**
   * Authoritative Release of a Reservation (user cancellation or checkout abandon)
   */
  public static async releaseReservation(reservationId: string, userId: string): Promise<boolean> {
    const reservation = db.reservations.get(reservationId);
    if (!reservation || reservation.status !== 'ACTIVE') {
      return false;
    }

    if (reservation.userId !== userId) {
      return false; // Unauthorized
    }

    const eventLock = db.getLock(`event-inventory:${reservation.eventId}`);
    const releaseLock = await eventLock.acquire();

    try {
      const items = Array.from(db.reservationItems.values()).filter(
        (i) => i.reservationId === reservation.id
      );

      for (const item of items) {
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
        'RESERVATION_EXPIRED_RELEASE',
        'INFO',
        `Reservation ${reservation.id.slice(0, 8)} released voluntarily by user.`,
        { reservationId, eventId: reservation.eventId },
        reservation.ipAddress || '127.0.0.1',
        userId
      );

      db.broadcast('inventory_update', { eventId: reservation.eventId, timestamp: Date.now() });
      return true;
    } finally {
      releaseLock();
    }
  }

  /**
   * Retrieves active reservation for user
   */
  public static getActiveReservation(userId: string): {
    reservation: Reservation;
    items: (ReservationItem & { ticketTypeName: string; unitPrice: number })[];
    event: any;
    secondsRemaining: number;
  } | null {
    const now = Date.now();
    for (const res of db.reservations.values()) {
      if (res.userId === userId && res.status === 'ACTIVE') {
        const expTime = new Date(res.expiresAt).getTime();
        if (expTime > now) {
          const items = Array.from(db.reservationItems.values())
            .filter((i) => i.reservationId === res.id)
            .map((item) => {
              const tt = db.ticketTypes.get(item.ticketTypeId);
              return {
                ...item,
                ticketTypeName: tt ? tt.name : 'Standard Ticket',
                unitPrice: tt ? tt.price : item.unitPrice,
              };
            });
          const event = db.events.get(res.eventId);
          return {
            reservation: res,
            items,
            event,
            secondsRemaining: Math.max(0, Math.floor((expTime - now) / 1000)),
          };
        }
      }
    }
    return null;
  }
}
