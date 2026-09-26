export type UserRole = 'ADMIN' | 'STAFF' | 'CUSTOMER';

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  role: UserRole;
  createdAt: string;
}

export type EventStatus = 'DRAFT' | 'PUBLISHED' | 'CANCELLED';

export interface Event {
  id: string;
  name: string;
  description: string;
  venue: string;
  eventDate: string;
  status: EventStatus;
  holdDurationSeconds: number; // default 300s (5 mins) or 600s
  maxTicketsPerUser: number;   // default 4
  category: string;
  imageUrl?: string;
  createdAt: string;
}

export interface TicketType {
  id: string;
  eventId: string;
  name: string;
  description: string;
  price: number;
  totalQuantity: number;
  availableQuantity: number;
  reservedQuantity: number;
  soldQuantity: number;
  purchaseLimit: number; // type-specific limit (max tickets of this tier)
}

export type ReservationStatus = 'ACTIVE' | 'EXPIRED' | 'COMPLETED' | 'CANCELLED';

export interface Reservation {
  id: string;
  userId: string;
  eventId: string;
  status: ReservationStatus;
  expiresAt: string; // ISO string
  idempotencyKey?: string;
  createdAt: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface ReservationItem {
  id: string;
  reservationId: string;
  ticketTypeId: string;
  quantity: number;
  unitPrice: number;
}

export type OrderStatus =
  | 'CREATED'
  | 'RESERVED'
  | 'PAYMENT_PENDING'
  | 'PAID'
  | 'CONFIRMED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'PAYMENT_FAILED';

export interface Order {
  id: string;
  userId: string;
  eventId: string;
  reservationId: string;
  status: OrderStatus;
  totalAmount: number;
  idempotencyKey?: string;
  paymentReference?: string;
  customerName: string;
  customerEmail: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  ticketTypeId: string;
  quantity: number;
  unitPrice: number;
}

export type PaymentStatus = 'SUCCESS' | 'DECLINED' | 'TIMEOUT';

export interface Payment {
  id: string;
  orderId: string;
  amount: number;
  status: PaymentStatus;
  providerReference: string;
  paymentMethod: string;
  failureReason?: string;
  createdAt: string;
}

export type TicketStatus = 'VALID' | 'CHECKED_IN' | 'CANCELLED' | 'EXPIRED';

export interface Ticket {
  id: string;
  orderId: string;
  eventId: string;
  ticketTypeId: string;
  secureToken: string;
  signature: string;
  status: TicketStatus;
  ticketTypeName: string;
  eventName: string;
  venue: string;
  eventDate: string;
  holderName: string;
  holderEmail: string;
  seatLabel: string;
  issuedAt: string;
  checkedInAt?: string;
  checkedInByStaffId?: string;
}

export type SecurityEventType =
  | 'RATE_LIMIT_TRIGGERED'
  | 'SUSPICIOUS_BOT_DETECTED'
  | 'DUPLICATE_IDEMPOTENCY_REJECTED'
  | 'TICKET_LIMIT_EXCEEDED'
  | 'OVERSELL_PREVENTED'
  | 'TAMPERED_TICKET_REJECTED'
  | 'REPLAY_CHECKIN_REJECTED'
  | 'PAYMENT_COMPENSATED'
  | 'RESERVATION_EXPIRED_RELEASE'
  | 'UNAUTHORIZED_ACCESS_BLOCKED'
  | 'CONCURRENCY_RACE_SERIALIZED';

export interface SecurityEvent {
  id: string;
  timestamp: string;
  eventType: SecurityEventType;
  userId?: string;
  ip: string;
  severity: 'INFO' | 'WARN' | 'CRITICAL';
  metadata: Record<string, any>;
  message: string;
}

export interface ConcurrencyMetrics {
  concurrentAttempts: number;
  successfulReservations: number;
  rejectedDuplicates: number;
  oversellAttemptsBlocked: number;
  purchaseLimitViolationsBlocked: number;
  rateLimitedRequests: number;
  botSuspiciousDetected: number;
  expiredHoldsReleased: number;
}
