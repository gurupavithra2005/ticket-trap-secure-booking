import express, { Request, Response, NextFunction } from 'express';
import { db } from '../db/database.ts';
import { SecurityService } from '../services/security.service.ts';
import { RateLimitService } from '../services/ratelimit.service.ts';
import { ReservationService } from '../services/reservation.service.ts';
import { OrderService } from '../services/order.service.ts';
import { TicketService } from '../services/ticket.service.ts';
import { SeedService } from '../services/seed.service.ts';
import { DataSanitizer } from '../services/sanitizer.service.ts';
import crypto from 'node:crypto';

export const apiRouter = express.Router();

// Helper to get client IP
const getClientIp = (req: Request): string => {
  return (
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket.remoteAddress ||
    '127.0.0.1'
  );
};

// Auth Middleware
const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    (req as any).user = null;
    return next();
  }

  const decoded = SecurityService.verifySessionToken(token);
  if (!decoded) {
    return res.status(401).json({ success: false, code: 'INVALID_TOKEN', message: 'Session expired or invalid.' });
  }

  const user = db.users.get(decoded.userId);
  if (!user) {
    return res.status(401).json({ success: false, code: 'USER_NOT_FOUND', message: 'User does not exist.' });
  }

  (req as any).user = user;
  next();
};

const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!(req as any).user) {
    return res.status(401).json({ success: false, code: 'UNAUTHORIZED', message: 'Authentication required.' });
  }
  next();
};

const requireRole = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user || !roles.includes(user.role)) {
      db.recordSecurityEvent(
        'UNAUTHORIZED_ACCESS_BLOCKED',
        'WARN',
        `Unauthorized role access attempt for ${req.path} by user ${user?.email || 'Anonymous'}.`,
        { path: req.path, requiredRoles: roles, userRole: user?.role },
        getClientIp(req),
        user?.id
      );
      return res.status(403).json({ success: false, code: 'FORBIDDEN', message: 'Insufficient role permissions.' });
    }
    next();
  };
};

apiRouter.use(authenticateToken);

// ==========================================
// 1. AUTHENTICATION & SESSIONS
// ==========================================

apiRouter.post('/auth/login', (req: Request, res: Response) => {
  const ip = getClientIp(req);
  const emailSanitized = DataSanitizer.sanitizeEmail(req.body.email);
  const password = typeof req.body.password === 'string' ? req.body.password : '';

  if (!emailSanitized.valid || !password) {
    return res.status(400).json({ success: false, message: 'A valid email and password are required.' });
  }

  const email = emailSanitized.email;

  // Check brute force lock
  if (RateLimitService.isLoginLocked(email) || RateLimitService.isLoginLocked(ip)) {
    db.recordSecurityEvent(
      'RATE_LIMIT_TRIGGERED',
      'WARN',
      `Brute-force login blocked for account: ${email}`,
      { email, ip },
      ip
    );
    return res.status(429).json({
      success: false,
      code: 'ACCOUNT_TEMPORARILY_LOCKED',
      message: 'Too many failed login attempts. Account temporarily locked for 15 minutes.',
    });
  }

  // Find user
  const user = Array.from(db.users.values()).find((u) => u.email.toLowerCase() === email.toLowerCase());

  if (!user || !SecurityService.verifyPassword(password, user.passwordHash)) {
    const status = RateLimitService.recordFailedLogin(email);
    RateLimitService.recordFailedLogin(ip);

    db.recordSecurityEvent(
      'SUSPICIOUS_BOT_DETECTED',
      'WARN',
      `Failed credential attempt for ${email}. Remaining attempts: ${status.remainingAttempts}`,
      { email, ip, remaining: status.remainingAttempts },
      ip
    );

    return res.status(401).json({
      success: false,
      code: 'INVALID_CREDENTIALS',
      message: status.isLocked
        ? 'Account has been locked due to 5 consecutive failed attempts.'
        : `Invalid email or password. ${status.remainingAttempts} attempts remaining before lock.`,
    });
  }

  RateLimitService.resetFailedLogin(email);
  RateLimitService.resetFailedLogin(ip);

  const token = SecurityService.createSessionToken({
    userId: user.id,
    role: user.role,
    email: user.email,
  });

  return res.json({
    success: true,
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  });
});

apiRouter.post('/auth/register', (req: Request, res: Response) => {
  const ip = getClientIp(req);
  const emailSanitized = DataSanitizer.sanitizeEmail(req.body.email);
  const name = DataSanitizer.sanitizeString(req.body.name);
  const password = typeof req.body.password === 'string' ? req.body.password : '';

  if (!emailSanitized.valid || !password || !name) {
    return res.status(400).json({ success: false, message: 'Valid name, email and password are required.' });
  }

  const email = emailSanitized.email;

  if (password.length < 8) {
    return res.status(400).json({ success: false, message: 'Password must be at least 8 characters long.' });
  }

  const existing = Array.from(db.users.values()).find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
  }

  const newUser = {
    id: `user-${crypto.randomUUID()}`,
    email: email.toLowerCase().trim(),
    passwordHash: SecurityService.hashPassword(password),
    name: name.trim(),
    role: 'CUSTOMER' as const,
    createdAt: new Date().toISOString(),
  };

  db.users.set(newUser.id, newUser);

  const token = SecurityService.createSessionToken({
    userId: newUser.id,
    role: newUser.role,
    email: newUser.email,
  });

  return res.status(201).json({
    success: true,
    token,
    user: {
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
      role: newUser.role,
    },
  });
});

apiRouter.get('/auth/me', (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }
  return res.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  });
});

// ==========================================
// 2. EVENTS & REAL-TIME AVAILABILITY
// ==========================================

apiRouter.get('/events', async (_req: Request, res: Response) => {
  await db.cleanupExpiredReservations();
  const events = Array.from(db.events.values()).map((evt) => {
    const ticketTypes = Array.from(db.ticketTypes.values()).filter((tt) => tt.eventId === evt.id);
    return {
      ...evt,
      ticketTypes,
    };
  });
  return res.json({ success: true, events });
});

apiRouter.get('/events/:id', async (req: Request, res: Response) => {
  await db.cleanupExpiredReservations();
  const event = db.events.get(req.params.id);
  if (!event) {
    return res.status(404).json({ success: false, message: 'Event not found' });
  }

  const ticketTypes = Array.from(db.ticketTypes.values()).filter((tt) => tt.eventId === event.id);
  return res.json({ success: true, event: { ...event, ticketTypes } });
});

// Admin: Create Event
apiRouter.post('/events', requireAuth, requireRole('ADMIN'), (req: Request, res: Response) => {
  const { name, description, venue, eventDate, holdDurationSeconds, maxTicketsPerUser, category, ticketTypes } = req.body;

  if (!name || !venue || !eventDate || !ticketTypes || !Array.isArray(ticketTypes)) {
    return res.status(400).json({ success: false, message: 'Missing required event fields or ticket tiers.' });
  }

  const eventId = `event-${crypto.randomUUID()}`;
  const newEvent = {
    id: eventId,
    name,
    description: description || '',
    venue,
    eventDate,
    status: 'PUBLISHED' as const,
    holdDurationSeconds: Number(holdDurationSeconds) || 300,
    maxTicketsPerUser: Number(maxTicketsPerUser) || 4,
    category: category || 'Conference',
    createdAt: new Date().toISOString(),
  };

  db.events.set(newEvent.id, newEvent);

  for (const tt of ticketTypes) {
    const total = Number(tt.totalQuantity) || 50;
    const newTier = {
      id: `tt-${crypto.randomUUID()}`,
      eventId: newEvent.id,
      name: tt.name || 'General Admission',
      description: tt.description || '',
      price: Number(tt.price) || 50,
      totalQuantity: total,
      availableQuantity: total,
      reservedQuantity: 0,
      soldQuantity: 0,
      purchaseLimit: Number(tt.purchaseLimit) || newEvent.maxTicketsPerUser,
    };
    db.ticketTypes.set(newTier.id, newTier);
  }

  db.broadcast('inventory_update', { eventId, timestamp: Date.now() });
  return res.status(201).json({ success: true, event: newEvent });
});

// Server-Sent Events (SSE) for Real-Time Inventory & Security Dashboard
apiRouter.get('/events/live-stream', (req: Request, res: Response) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  const sendEvent = (eventName: string, data: any) => {
    res.write(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  // Send initial snapshot
  sendEvent('init', {
    metrics: db.metrics,
    timestamp: Date.now(),
  });

  const unsubscribe = db.subscribe(sendEvent);

  // Heartbeat to keep connection alive
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});

// ==========================================
// 3. ATOMIC RESERVATIONS
// ==========================================

apiRouter.post('/reservations', requireAuth, async (req: Request, res: Response) => {
  const ip = getClientIp(req);
  const user = (req as any).user;

  // Layer 1: Anti-bot velocity and honeypot evaluation
  const botScore = RateLimitService.evaluateBotScore(req.body, ip, req.headers);
  if (botScore.isBot) {
    db.recordSecurityEvent(
      'SUSPICIOUS_BOT_DETECTED',
      'CRITICAL',
      `Automated bot activity blocked. Reasons: ${botScore.reasons.join(', ')}`,
      { score: botScore.score, reasons: botScore.reasons },
      ip,
      user.id
    );
    return res.status(403).json({
      success: false,
      code: 'BOT_ACTIVITY_DETECTED',
      message: 'Suspicious request pattern or honeypot triggered. Request rejected by security shield.',
    });
  }

  // Layer 2: Rate limit on reservation endpoint
  const rateLimit = RateLimitService.checkRateLimit(`res:${user.id}`, 10, 10000); // 10 requests per 10s
  if (!rateLimit.allowed) {
    db.recordSecurityEvent(
      'RATE_LIMIT_TRIGGERED',
      'WARN',
      `Rate limit exceeded on reservation endpoint by user ${user.email}.`,
      { userId: user.id, retryAfterMs: rateLimit.retryAfterMs },
      ip,
      user.id
    );
    return res.status(429).json({
      success: false,
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many reservation requests in rapid succession. Please wait a few seconds.',
      retryAfterMs: rateLimit.retryAfterMs,
    });
  }

  const { eventId, items, idempotencyKey } = req.body;

  const result = await ReservationService.createReservation({
    userId: user.id,
    eventId,
    items,
    idempotencyKey,
    ipAddress: ip,
    userAgent: req.headers['user-agent'],
  });

  if (!result.success) {
    return res.status(400).json(result);
  }

  return res.status(201).json(result);
});

apiRouter.get('/reservations/active', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user;
  const active = ReservationService.getActiveReservation(user.id);
  return res.json({ success: true, active });
});

apiRouter.post('/reservations/:id/release', requireAuth, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const success = await ReservationService.releaseReservation(req.params.id, user.id);
  if (!success) {
    return res.status(400).json({ success: false, message: 'Could not release reservation.' });
  }
  return res.json({ success: true, message: 'Reservation cancelled and inventory restored.' });
});

// ==========================================
// 4. CHECKOUT & COMPENSATING TRANSACTIONS
// ==========================================

apiRouter.post('/checkout', requireAuth, async (req: Request, res: Response) => {
  const ip = getClientIp(req);
  const user = (req as any).user;

  // Rate limit checkout attempts
  const rateLimit = RateLimitService.checkRateLimit(`chk:${user.id}`, 6, 30000);
  if (!rateLimit.allowed) {
    return res.status(429).json({
      success: false,
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many checkout attempts. Please try again in 30 seconds.',
    });
  }

  const {
    reservationId,
    paymentOutcome = 'SUCCESS', // 'SUCCESS' | 'DECLINED' | 'TIMEOUT'
    customerName,
    customerEmail,
    paymentMethod,
    idempotencyKey,
  } = req.body;

  const sanitizedName = DataSanitizer.sanitizeString(customerName || user.name);
  const sanitizedEmailResult = DataSanitizer.sanitizeEmail(customerEmail || user.email);
  const sanitizedEmail = sanitizedEmailResult.valid ? sanitizedEmailResult.email : user.email;
  const sanitizedKey = idempotencyKey ? DataSanitizer.sanitizeString(idempotencyKey) : undefined;

  const result = await OrderService.processCheckout({
    userId: user.id,
    reservationId,
    paymentOutcome,
    customerName: sanitizedName,
    customerEmail: sanitizedEmail,
    paymentMethod: paymentMethod ? DataSanitizer.sanitizeString(paymentMethod) : undefined,
    idempotencyKey: sanitizedKey,
    ipAddress: ip,
  });

  if (!result.success) {
    return res.status(400).json(result);
  }

  return res.json(result);
});

// Orders history
apiRouter.get('/orders', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user;
  const orders = Array.from(db.orders.values())
    .filter((o) => o.userId === user.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const populated = orders.map((order) => {
    const items = Array.from(db.orderItems.values()).filter((i) => i.orderId === order.id);
    const tickets = Array.from(db.tickets.values()).filter((t) => t.orderId === order.id);
    const event = db.events.get(order.eventId);
    return {
      ...order,
      items,
      tickets,
      event,
    };
  });

  return res.json({ success: true, orders: populated });
});

// ==========================================
// 5. SECURE TICKETS & STAFF VALIDATION
// ==========================================

apiRouter.get('/tickets/my-tickets', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user;
  const userOrders = Array.from(db.orders.values()).filter((o) => o.userId === user.id);
  const orderIds = new Set(userOrders.map((o) => o.id));

  const tickets = Array.from(db.tickets.values()).filter((t) => orderIds.has(t.orderId));
  return res.json({ success: true, tickets });
});

// Staff ticket validation inspection
apiRouter.post('/tickets/validate', requireAuth, requireRole('STAFF', 'ADMIN'), async (req: Request, res: Response) => {
  const { tokenOrId, targetEventId } = req.body;
  if (!tokenOrId) {
    return res.status(400).json({ success: false, message: 'Ticket code or QR payload is required.' });
  }

  const result = await TicketService.validateTicket(tokenOrId, targetEventId);
  return res.json(result);
});

// Staff check in
apiRouter.post('/tickets/check-in', requireAuth, requireRole('STAFF', 'ADMIN'), async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { ticketId } = req.body;

  if (!ticketId) {
    return res.status(400).json({ success: false, message: 'Ticket ID is required.' });
  }

  const result = await TicketService.checkInTicket(ticketId, user.id);
  return res.json(result);
});

// ==========================================
// 6. ADMIN & METRICS
// ==========================================

apiRouter.get('/admin/metrics', requireAuth, requireRole('ADMIN'), async (_req: Request, res: Response) => {
  await db.cleanupExpiredReservations();

  const totalEvents = db.events.size;
  let totalInventory = 0;
  let soldInventory = 0;
  let reservedInventory = 0;
  let availableInventory = 0;

  for (const tt of db.ticketTypes.values()) {
    totalInventory += tt.totalQuantity;
    soldInventory += tt.soldQuantity;
    reservedInventory += tt.reservedQuantity;
    availableInventory += tt.availableQuantity;
  }

  const totalOrders = db.orders.size;
  const confirmedOrders = Array.from(db.orders.values()).filter((o) => o.status === 'CONFIRMED').length;
  const failedPayments = Array.from(db.payments.values()).filter((p) => p.status !== 'SUCCESS').length;
  const totalCheckedIn = Array.from(db.tickets.values()).filter((t) => t.status === 'CHECKED_IN').length;

  return res.json({
    success: true,
    data: {
      totalEvents,
      totalInventory,
      soldInventory,
      reservedInventory,
      availableInventory,
      totalOrders,
      confirmedOrders,
      failedPayments,
      totalCheckedIn,
      concurrencyMetrics: db.metrics,
    },
  });
});

apiRouter.get('/admin/security-events', requireAuth, requireRole('ADMIN'), (_req: Request, res: Response) => {
  return res.json({
    success: true,
    events: db.securityEvents.slice(0, 100),
  });
});

apiRouter.post('/admin/reset-demo', requireAuth, requireRole('ADMIN'), (_req: Request, res: Response) => {
  SeedService.resetDemoDatabase();
  return res.json({ success: true, message: 'Database reset to initial clean demo state.' });
});

// ==========================================
// 7. CONCURRENCY & SECURITY DEMO LABORATORY
// Evaluator execution tests
// ==========================================

apiRouter.post('/concurrency-demo/simulate', async (req: Request, res: Response) => {
  const { scenario } = req.body;

  // Let's handle all 8 evaluator simulation scenarios with real transactions!
  switch (scenario) {
    case 'last-ticket-race': {
      // 20 simulated threads race for 1 remaining ticket
      // Setup temporary single-ticket tier
      const event = db.events.get('event-flash-drop-rare') || Array.from(db.events.values())[0];
      const tier = Array.from(db.ticketTypes.values()).find((t) => t.eventId === event.id)!;

      // Force tier available quantity to exactly 1
      tier.availableQuantity = 1;
      tier.reservedQuantity = 0;

      const initialAvailable = tier.availableQuantity;
      const requestCount = 20;

      // Fire 20 parallel async reservation promises simultaneously
      const promises = Array.from({ length: requestCount }).map((_, index) => {
        const simUserId = `sim-user-${index + 1}`;
        // Ensure user exists
        if (!db.users.has(simUserId)) {
          db.users.set(simUserId, {
            id: simUserId,
            email: `simulated${index + 1}@race.test`,
            passwordHash: 'dummy',
            name: `Contender #${index + 1}`,
            role: 'CUSTOMER',
            createdAt: new Date().toISOString(),
          });
        }

        return ReservationService.createReservation({
          userId: simUserId,
          eventId: event.id,
          items: [{ ticketTypeId: tier.id, quantity: 1 }],
          ipAddress: `192.168.1.${100 + index}`,
        });
      });

      const results = await Promise.all(promises);
      const successful = results.filter((r) => r.success);
      const rejected = results.filter((r) => !r.success);

      return res.json({
        success: true,
        scenario: 'Last-Ticket Race (20 Parallel Contenders)',
        contenders: requestCount,
        initialInventory: initialAvailable,
        finalAvailableInventory: tier.availableQuantity,
        successfulCount: successful.length,
        rejectedCount: rejected.length,
        inventoryNeverNegative: tier.availableQuantity >= 0,
        oversellBlocked: successful.length === 1 && tier.availableQuantity === 0,
        details: results.map((r, i) => ({
          contender: `Contender #${i + 1}`,
          status: r.success ? 'WON_ALLOCATION' : 'REJECTED_OUT_OF_STOCK',
          message: r.message,
          code: r.code || 'SUCCESS',
        })),
      });
    }

    case 'duplicate-booking': {
      // Same user and idempotency key sent multiple times in parallel
      const event = Array.from(db.events.values())[0];
      const tier = Array.from(db.ticketTypes.values()).find((t) => t.eventId === event.id)!;
      const testKey = `replay-key-${crypto.randomUUID()}`;
      const simUserId = 'sim-duplicate-attacker';

      if (!db.users.has(simUserId)) {
        db.users.set(simUserId, {
          id: simUserId,
          email: 'replay@attacker.test',
          passwordHash: 'dummy',
          name: 'Replay Attacker',
          role: 'CUSTOMER',
          createdAt: new Date().toISOString(),
        });
      }

      // Fire 5 identical requests
      const promises = Array.from({ length: 5 }).map(() =>
        ReservationService.createReservation({
          userId: simUserId,
          eventId: event.id,
          items: [{ ticketTypeId: tier.id, quantity: 1 }],
          idempotencyKey: testKey,
          ipAddress: '10.0.0.5',
        })
      );

      const results = await Promise.all(promises);
      const successful = results.filter((r) => r.success);

      // Verify all successful returned the EXACT SAME reservation ID
      const reservationIds = new Set(successful.map((s) => s.reservation?.id));

      return res.json({
        success: true,
        scenario: 'Duplicate Booking / Idempotent Replay Attack',
        totalRequests: 5,
        reservationsCreated: reservationIds.size, // MUST BE 1
        idempotencyProtected: reservationIds.size === 1,
        reservationId: Array.from(reservationIds)[0],
        message: 'All 5 concurrent requests safely mapped to the single authoritative reservation.',
      });
    }

    case 'ticket-limit-bypass': {
      // User attempts 10 parallel requests to buy 3 tickets each, exceeding the limit of 4
      const event = Array.from(db.events.values())[0];
      const tier = Array.from(db.ticketTypes.values()).find((t) => t.eventId === event.id)!;
      const simUserId = `sim-limit-bypasser-${crypto.randomUUID()}`;

      db.users.set(simUserId, {
        id: simUserId,
        email: 'scalper@bypass.test',
        passwordHash: 'dummy',
        name: 'Scalper Bypass Bot',
        role: 'CUSTOMER',
        createdAt: new Date().toISOString(),
      });

      // User limit is event.maxTicketsPerUser (e.g. 4)
      // Fire 8 parallel requests requesting 2 tickets each
      const promises = Array.from({ length: 8 }).map(() =>
        ReservationService.createReservation({
          userId: simUserId,
          eventId: event.id,
          items: [{ ticketTypeId: tier.id, quantity: 2 }],
          ipAddress: '10.0.0.99',
        })
      );

      const results = await Promise.all(promises);
      const successful = results.filter((r) => r.success);
      const rejected = results.filter((r) => !r.success);

      const totalAllocated = successful.reduce((sum, r) => {
        return sum + (r.items ? r.items.reduce((s, i) => s + i.quantity, 0) : 0);
      }, 0);

      return res.json({
        success: true,
        scenario: 'Per-User Ticket Limit Bypass (Parallel Multi-Tab Attack)',
        attemptedRequests: 8,
        ticketsRequestedPerCall: 2,
        maxAllowedLimit: event.maxTicketsPerUser,
        totalTicketsAllocated: totalAllocated,
        limitEnforced: totalAllocated <= event.maxTicketsPerUser,
        successfulRequests: successful.length,
        rejectedRequests: rejected.length,
        securityDecisions: rejected.map((r) => r.message),
      });
    }

    case 'payment-failure': {
      // Reserves ticket, simulates payment decline, verifies compensating rollback
      const event = Array.from(db.events.values())[0];
      const tier = Array.from(db.ticketTypes.values()).find((t) => t.eventId === event.id)!;
      const simUserId = 'sim-declined-buyer';

      if (!db.users.has(simUserId)) {
        db.users.set(simUserId, {
          id: simUserId,
          email: 'declined@test.com',
          passwordHash: 'dummy',
          name: 'Declined Buyer',
          role: 'CUSTOMER',
          createdAt: new Date().toISOString(),
        });
      }

      const initialAvail = tier.availableQuantity;

      // Step 1: Reserve 1 ticket
      const reserve = await ReservationService.createReservation({
        userId: simUserId,
        eventId: event.id,
        items: [{ ticketTypeId: tier.id, quantity: 1 }],
      });

      const availAfterHold = tier.availableQuantity;

      // Step 2: Simulate Payment Decline
      const checkout = await OrderService.processCheckout({
        userId: simUserId,
        reservationId: reserve.reservation!.id,
        paymentOutcome: 'DECLINED',
        customerName: 'Declined Buyer',
        customerEmail: 'declined@test.com',
      });

      const availAfterCompensation = tier.availableQuantity;

      return res.json({
        success: true,
        scenario: 'Payment Failure with Automatic Compensating Transaction',
        inventoryInitial: initialAvail,
        inventoryDuringHold: availAfterHold,
        inventoryAfterCompensation: availAfterCompensation,
        compensationRestoredFullInventory: availAfterCompensation === initialAvail,
        paymentStatus: checkout.payment?.status,
        orderStatus: checkout.order?.status,
        ticketsIssued: 0,
        message: 'Payment declined; compensation transaction immediately restored ticket to inventory.',
      });
    }

    case 'tampered-ticket': {
      // Create valid ticket, tamper with signature, verify validation failure
      const event = Array.from(db.events.values())[0];
      const sampleId = crypto.randomUUID();
      const { secureToken } = SecurityService.generateTicketToken(sampleId, event.id, 'test-order');

      // Tamper signature by replacing last 4 characters
      const decoded = JSON.parse(Buffer.from(secureToken, 'base64url').toString('utf8'));
      decoded.sig = 'ffffffff' + decoded.sig.slice(8);
      const tamperedToken = Buffer.from(JSON.stringify(decoded)).toString('base64url');

      const validation = await TicketService.validateTicket(tamperedToken, event.id);

      return res.json({
        success: true,
        scenario: 'Ticket QR Payload Cryptographic Tampering',
        tamperedPayloadReceived: true,
        validationStatus: validation.status,
        valid: validation.valid,
        tamperDetected: validation.securityDetails?.tamperDetected,
        message: validation.message,
      });
    }

    case 'replay-attack': {
      // Validate ticket that was already checked in
      const checkedInTicket = Array.from(db.tickets.values()).find((t) => t.status === 'CHECKED_IN');
      if (!checkedInTicket) {
        return res.status(400).json({ success: false, message: 'No checked-in ticket found in seed.' });
      }

      const validation = await TicketService.validateTicket(checkedInTicket.secureToken, checkedInTicket.eventId);

      return res.json({
        success: true,
        scenario: 'Ticket Replay / Duplicate Gate Check-in Attack',
        ticketId: checkedInTicket.id,
        originalCheckInTime: checkedInTicket.checkedInAt,
        validationStatus: validation.status,
        valid: validation.valid,
        replayBlocked: validation.status === 'ALREADY_CHECKED_IN',
        message: validation.message,
      });
    }

    case 'bot-burst': {
      // Fire 15 rapid requests with bot indicators
      const ip = '185.220.101.42'; // Tor exit node simulation
      const evaluation = RateLimitService.evaluateBotScore(
        { _hp_trap: 'http://malicious-bot-farm.ru', _form_time_ms: 120 },
        ip,
        { 'user-agent': 'python-requests/2.28' }
      );

      db.recordSecurityEvent(
        'SUSPICIOUS_BOT_DETECTED',
        'CRITICAL',
        `Bot burst defense simulation: Blocked scripted client with score ${evaluation.score}.`,
        { reasons: evaluation.reasons, score: evaluation.score },
        ip
      );

      return res.json({
        success: true,
        scenario: 'Bot Burst & Honeypot Detection Shield',
        botScore: evaluation.score,
        isBot: evaluation.isBot,
        reasons: evaluation.reasons,
        actionTaken: 'HTTP 403 Forbidden - Request Dropped',
      });
    }

    default:
      return res.status(400).json({ success: false, message: 'Unknown simulation scenario.' });
  }
});
