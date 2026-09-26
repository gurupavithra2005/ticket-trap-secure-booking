import {
  User,
  Event,
  TicketType,
  Reservation,
  ReservationItem,
  Order,
  OrderItem,
  Payment,
  Ticket,
  SecurityEvent,
  ConcurrencyMetrics,
} from './schema.ts';
import crypto from 'node:crypto';

class AsyncLock {
  private queue: (() => void)[] = [];
  private locked = false;

  async acquire(): Promise<() => void> {
    return new Promise((resolve) => {
      const run = () => {
        this.locked = true;
        resolve(() => {
          this.locked = false;
          const next = this.queue.shift();
          if (next) {
            next();
          }
        });
      };

      if (!this.locked) {
        run();
      } else {
        this.queue.push(run);
      }
    });
  }
}

export class Database {
  private static instance: Database;

  public users: Map<string, User> = new Map();
  public events: Map<string, Event> = new Map();
  public ticketTypes: Map<string, TicketType> = new Map();
  public reservations: Map<string, Reservation> = new Map();
  public reservationItems: Map<string, ReservationItem> = new Map();
  public orders: Map<string, Order> = new Map();
  public orderItems: Map<string, OrderItem> = new Map();
  public payments: Map<string, Payment> = new Map();
  public tickets: Map<string, Ticket> = new Map();
  public securityEvents: SecurityEvent[] = [];
  public idempotencyKeys: Map<string, { userId: string; result: any; expiresAt: number }> = new Map();

  // Metrics
  public metrics: ConcurrencyMetrics = {
    concurrentAttempts: 0,
    successfulReservations: 0,
    rejectedDuplicates: 0,
    oversellAttemptsBlocked: 0,
    purchaseLimitViolationsBlocked: 0,
    rateLimitedRequests: 0,
    botSuspiciousDetected: 0,
    expiredHoldsReleased: 0,
  };

  // Lock manager by resource key
  private locks: Map<string, AsyncLock> = new Map();
  private globalLock = new AsyncLock();

  // SSE listeners
  private listeners: Set<(event: string, data: any) => void> = new Set();

  private constructor() {
    // Start periodic background worker for lazy/active expiration cleanup
    setInterval(() => {
      this.cleanupExpiredReservations().catch((err) =>
        console.error('Expiration cleanup error:', err)
      );
    }, 2000);
  }

  public static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  public getLock(key: string): AsyncLock {
    let lock = this.locks.get(key);
    if (!lock) {
      lock = new AsyncLock();
      this.locks.set(key, lock);
    }
    return lock;
  }

  // Subscribe to real-time events (SSE)
  public subscribe(listener: (event: string, data: any) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public broadcast(event: string, data: any): void {
    for (const listener of this.listeners) {
      try {
        listener(event, data);
      } catch (err) {
        console.error('Error broadcasting event:', err);
      }
    }
  }

  // Record structured security event and update live metrics
  public recordSecurityEvent(
    eventType: SecurityEvent['eventType'],
    severity: SecurityEvent['severity'],
    message: string,
    metadata: Record<string, any> = {},
    ip: string = '127.0.0.1',
    userId?: string
  ): SecurityEvent {
    const entry: SecurityEvent = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      eventType,
      severity,
      message,
      metadata,
      ip,
      userId,
    };

    this.securityEvents.unshift(entry);
    if (this.securityEvents.length > 500) {
      this.securityEvents.pop();
    }

    // Update real-time metrics counters
    if (eventType === 'OVERSELL_PREVENTED') {
      this.metrics.oversellAttemptsBlocked++;
    } else if (eventType === 'TICKET_LIMIT_EXCEEDED') {
      this.metrics.purchaseLimitViolationsBlocked++;
    } else if (eventType === 'DUPLICATE_IDEMPOTENCY_REJECTED') {
      this.metrics.rejectedDuplicates++;
    } else if (eventType === 'RATE_LIMIT_TRIGGERED') {
      this.metrics.rateLimitedRequests++;
    } else if (eventType === 'SUSPICIOUS_BOT_DETECTED') {
      this.metrics.botSuspiciousDetected++;
    } else if (eventType === 'RESERVATION_EXPIRED_RELEASE') {
      this.metrics.expiredHoldsReleased += metadata.quantityReleased || 1;
    }

    this.broadcast('security_event', entry);
    this.broadcast('metrics_update', this.metrics);
    return entry;
  }

  // Authoritative Expired Reservation Cleanup
  public async cleanupExpiredReservations(): Promise<number> {
    const releaseLock = await this.globalLock.acquire();
    let releasedCount = 0;
    try {
      const now = Date.now();
      for (const res of this.reservations.values()) {
        if (res.status === 'ACTIVE' && new Date(res.expiresAt).getTime() <= now) {
          // Find items to release back to inventory
          const items = Array.from(this.reservationItems.values()).filter(
            (item) => item.reservationId === res.id
          );

          for (const item of items) {
            const ticketType = this.ticketTypes.get(item.ticketTypeId);
            if (ticketType) {
              ticketType.reservedQuantity = Math.max(0, ticketType.reservedQuantity - item.quantity);
              ticketType.availableQuantity = Math.min(
                ticketType.totalQuantity - ticketType.soldQuantity,
                ticketType.availableQuantity + item.quantity
              );
            }
          }

          res.status = 'EXPIRED';
          releasedCount++;

          this.recordSecurityEvent(
            'RESERVATION_EXPIRED_RELEASE',
            'INFO',
            `Reservation ${res.id.slice(0, 8)} expired. Held tickets restored to inventory.`,
            { reservationId: res.id, eventId: res.eventId, quantityReleased: items.reduce((acc, i) => acc + i.quantity, 0) },
            res.ipAddress || '127.0.0.1',
            res.userId
          );
        }
      }

      if (releasedCount > 0) {
        this.broadcast('inventory_update', { timestamp: Date.now() });
      }
    } finally {
      releaseLock();
    }
    return releasedCount;
  }

  // Count user's total tickets for an event (confirmed orders + active reservations)
  public getUserCommittedTicketCount(userId: string, eventId: string, excludeReservationId?: string): number {
    let total = 0;

    // 1. Completed / paid orders
    for (const order of this.orders.values()) {
      if (order.userId === userId && order.eventId === eventId && order.status !== 'CANCELLED' && order.status !== 'PAYMENT_FAILED') {
        const items = Array.from(this.orderItems.values()).filter((i) => i.orderId === order.id);
        for (const item of items) {
          total += item.quantity;
        }
      }
    }

    // 2. Active, non-expired reservations
    const now = Date.now();
    for (const res of this.reservations.values()) {
      if (
        res.userId === userId &&
        res.eventId === eventId &&
        res.status === 'ACTIVE' &&
        res.id !== excludeReservationId &&
        new Date(res.expiresAt).getTime() > now
      ) {
        const items = Array.from(this.reservationItems.values()).filter((i) => i.reservationId === res.id);
        for (const item of items) {
          total += item.quantity;
        }
      }
    }

    return total;
  }
}

export const db = Database.getInstance();
