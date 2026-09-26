export interface ApiUser {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'STAFF' | 'CUSTOMER';
}

export interface ApiTicketType {
  id: string;
  eventId: string;
  name: string;
  description: string;
  price: number;
  totalQuantity: number;
  availableQuantity: number;
  reservedQuantity: number;
  soldQuantity: number;
  purchaseLimit: number;
}

export interface ApiEvent {
  id: string;
  name: string;
  description: string;
  venue: string;
  eventDate: string;
  status: 'DRAFT' | 'PUBLISHED' | 'CANCELLED';
  holdDurationSeconds: number;
  maxTicketsPerUser: number;
  category: string;
  imageUrl?: string;
  ticketTypes: ApiTicketType[];
}

export interface ApiReservation {
  id: string;
  userId: string;
  eventId: string;
  status: 'ACTIVE' | 'EXPIRED' | 'COMPLETED' | 'CANCELLED';
  expiresAt: string;
  idempotencyKey?: string;
}

export interface ApiTicket {
  id: string;
  orderId: string;
  eventId: string;
  ticketTypeId: string;
  secureToken: string;
  signature: string;
  status: 'VALID' | 'CHECKED_IN' | 'CANCELLED' | 'EXPIRED';
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

export interface SecurityLogItem {
  id: string;
  timestamp: string;
  eventType: string;
  severity: 'INFO' | 'WARN' | 'CRITICAL';
  message: string;
  ip: string;
  userId?: string;
  metadata: Record<string, any>;
}

export interface ConcurrencyMetricsData {
  concurrentAttempts: number;
  successfulReservations: number;
  rejectedDuplicates: number;
  oversellAttemptsBlocked: number;
  purchaseLimitViolationsBlocked: number;
  rateLimitedRequests: number;
  botSuspiciousDetected: number;
  expiredHoldsReleased: number;
}

const getAuthHeaders = (): Record<string, string> => {
  const token = localStorage.getItem('aegispass_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

export const api = {
  // Auth
  async login(email: string, password: string) {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    return res.json();
  },

  async register(name: string, email: string, password: string) {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });
    return res.json();
  },

  async getMe() {
    const res = await fetch('/api/auth/me', {
      headers: getAuthHeaders(),
    });
    return res.json();
  },

  // Events
  async getEvents(): Promise<{ success: boolean; events: ApiEvent[] }> {
    const res = await fetch('/api/events');
    return res.json();
  },

  async getEvent(id: string): Promise<{ success: boolean; event: ApiEvent }> {
    const res = await fetch(`/api/events/${id}`);
    return res.json();
  },

  async createEvent(eventData: any) {
    const res = await fetch('/api/events', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(eventData),
    });
    return res.json();
  },

  // Reservations
  async createReservation(eventId: string, items: { ticketTypeId: string; quantity: number }[], idempotencyKey?: string) {
    const res = await fetch('/api/reservations', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        eventId,
        items,
        idempotencyKey: idempotencyKey || `idemp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        _form_time_ms: 2500, // Legitimate human timing
        _hp_trap: '', // Empty honeypot
      }),
    });
    return res.json();
  },

  async getActiveReservation() {
    const res = await fetch('/api/reservations/active', {
      headers: getAuthHeaders(),
    });
    return res.json();
  },

  async releaseReservation(reservationId: string) {
    const res = await fetch(`/api/reservations/${reservationId}/release`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return res.json();
  },

  // Checkout
  async processCheckout(data: {
    reservationId: string;
    paymentOutcome: 'SUCCESS' | 'DECLINED' | 'TIMEOUT';
    customerName: string;
    customerEmail: string;
    paymentMethod?: string;
  }) {
    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async getMyOrders() {
    const res = await fetch('/api/orders', {
      headers: getAuthHeaders(),
    });
    return res.json();
  },

  // Tickets
  async getMyTickets(): Promise<{ success: boolean; tickets: ApiTicket[] }> {
    const res = await fetch('/api/tickets/my-tickets', {
      headers: getAuthHeaders(),
    });
    return res.json();
  },

  async validateTicket(tokenOrId: string, targetEventId?: string) {
    const res = await fetch('/api/tickets/validate', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ tokenOrId, targetEventId }),
    });
    return res.json();
  },

  async checkInTicket(ticketId: string) {
    const res = await fetch('/api/tickets/check-in', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ ticketId }),
    });
    return res.json();
  },

  // Admin
  async getAdminMetrics() {
    const res = await fetch('/api/admin/metrics', {
      headers: getAuthHeaders(),
    });
    return res.json();
  },

  async getSecurityEvents(): Promise<{ success: boolean; events: SecurityLogItem[] }> {
    const res = await fetch('/api/admin/security-events', {
      headers: getAuthHeaders(),
    });
    return res.json();
  },

  async resetDemo() {
    const res = await fetch('/api/admin/reset-demo', {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return res.json();
  },

  // Concurrency Simulation Lab
  async runSimulation(scenario: string) {
    const res = await fetch('/api/concurrency-demo/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario }),
    });
    return res.json();
  },
};
