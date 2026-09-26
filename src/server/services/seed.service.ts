import { db } from '../db/database.ts';
import { User, Event, TicketType, Ticket, Order, Payment } from '../db/schema.ts';
import { SecurityService } from './security.service.ts';
import crypto from 'node:crypto';

export class SeedService {
  public static initSeedData(): void {
    if (db.users.size > 0) return; // Already seeded

    console.log('Seeding AegisPass database with initial events, users, and tickets...');

    // 1. Users
    const adminUser: User = {
      id: 'user-admin-1',
      email: 'admin@example.com',
      passwordHash: SecurityService.hashPassword('Admin@Pass123'),
      name: 'System Administrator',
      role: 'ADMIN',
      createdAt: new Date().toISOString(),
    };
    db.users.set(adminUser.id, adminUser);

    const staffUser: User = {
      id: 'user-staff-1',
      email: 'staff@example.com',
      passwordHash: SecurityService.hashPassword('Staff@Pass123'),
      name: 'Gate Inspection Staff',
      role: 'STAFF',
      createdAt: new Date().toISOString(),
    };
    db.users.set(staffUser.id, staffUser);

    const customerUser: User = {
      id: 'user-guest-1',
      email: 'guest@example.com',
      passwordHash: SecurityService.hashPassword('Guest@Pass123'),
      name: 'Alex Johnson',
      role: 'CUSTOMER',
      createdAt: new Date().toISOString(),
    };
    db.users.set(customerUser.id, customerUser);

    // 2. Events & Ticket Types
    // Event 1: Tech Summit 2026
    const event1: Event = {
      id: 'event-tech-summit-2026',
      name: 'Tech Summit 2026: AI & Distributed Systems',
      description:
        'The premier conference on hyper-scale engineering, sub-millisecond concurrency, and applied AI systems.',
      venue: 'Silicon Arena, Hall A, San Francisco, CA',
      eventDate: '2026-11-15T09:00:00.000Z',
      status: 'PUBLISHED',
      holdDurationSeconds: 300,
      maxTicketsPerUser: 4,
      category: 'Conference',
      imageUrl: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1000&q=80',
      createdAt: new Date().toISOString(),
    };
    db.events.set(event1.id, event1);

    const tt1_1: TicketType = {
      id: 'tt-ts-vip',
      eventId: event1.id,
      name: 'VIP Backstage Access',
      description: 'Reserved front seating, speaker lounge access, and exclusive networking banquet.',
      price: 350,
      totalQuantity: 20,
      availableQuantity: 20,
      reservedQuantity: 0,
      soldQuantity: 0,
      purchaseLimit: 2,
    };
    const tt1_2: TicketType = {
      id: 'tt-ts-gen',
      eventId: event1.id,
      name: 'Standard General Pass',
      description: 'Access to all keynote stages, technical breakouts, and sponsor expo hall.',
      price: 150,
      totalQuantity: 100,
      availableQuantity: 100,
      reservedQuantity: 0,
      soldQuantity: 0,
      purchaseLimit: 4,
    };
    db.ticketTypes.set(tt1_1.id, tt1_1);
    db.ticketTypes.set(tt1_2.id, tt1_2);

    // Event 2: Flash Drop (Ideal for testing 20 concurrent requests on 1 or 2 tickets)
    const event2: Event = {
      id: 'event-flash-drop-rare',
      name: 'CyberCore 2026: Ultra-Limited Flash Drop',
      description:
        'High-demand exclusive keynote with only 3 seats available. Perfect for simulating high-concurrency race conditions!',
      venue: 'Apex Blackbox Theater, New York, NY',
      eventDate: '2026-10-20T18:30:00.000Z',
      status: 'PUBLISHED',
      holdDurationSeconds: 120, // 2 minutes hold
      maxTicketsPerUser: 2,
      category: 'Keynote',
      imageUrl: 'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1000&q=80',
      createdAt: new Date().toISOString(),
    };
    db.events.set(event2.id, event2);

    const tt2_1: TicketType = {
      id: 'tt-flash-exclusive',
      eventId: event2.id,
      name: 'Rare Front-Row Keynote Badge',
      description: 'Super limited allocation badge. High-contention concurrency test subject.',
      price: 450,
      totalQuantity: 5,
      availableQuantity: 5,
      reservedQuantity: 0,
      soldQuantity: 0,
      purchaseLimit: 1,
    };
    db.ticketTypes.set(tt2_1.id, tt2_1);

    // Event 3: UltraSound Live 2026 Music Festival
    const event3: Event = {
      id: 'event-ultrasound-fest',
      name: 'UltraSound Music Festival 2026',
      description:
        'Three days of electronic and live band performances under the stars with spatial audio stages.',
      venue: 'Starlight Amphitheater, Austin, TX',
      eventDate: '2026-12-04T16:00:00.000Z',
      status: 'PUBLISHED',
      holdDurationSeconds: 300,
      maxTicketsPerUser: 4,
      category: 'Music Festival',
      imageUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1000&q=80',
      createdAt: new Date().toISOString(),
    };
    db.events.set(event3.id, event3);

    const tt3_1: TicketType = {
      id: 'tt-us-ga',
      eventId: event3.id,
      name: '3-Day Weekend GA Pass',
      description: 'Full festival grounds admission across all 4 stages for all 3 days.',
      price: 180,
      totalQuantity: 300,
      availableQuantity: 300,
      reservedQuantity: 0,
      soldQuantity: 0,
      purchaseLimit: 4,
    };
    const tt3_2: TicketType = {
      id: 'tt-us-vip',
      eventId: event3.id,
      name: 'VIP Pit & Express Entry',
      description: 'Private bar, air-conditioned lounges, and unobstructed pit viewing.',
      price: 320,
      totalQuantity: 50,
      availableQuantity: 50,
      reservedQuantity: 0,
      soldQuantity: 0,
      purchaseLimit: 2,
    };
    db.ticketTypes.set(tt3_1.id, tt3_1);
    db.ticketTypes.set(tt3_2.id, tt3_2);

    // Seed a valid sample ticket for staff testing
    const sampleOrderId = 'sample-order-001';
    const sampleTicketId = 'sample-ticket-001';
    const { secureToken, signature } = SecurityService.generateTicketToken(
      sampleTicketId,
      event1.id,
      sampleOrderId
    );

    const sampleTicket: Ticket = {
      id: sampleTicketId,
      orderId: sampleOrderId,
      eventId: event1.id,
      ticketTypeId: tt1_1.id,
      secureToken,
      signature,
      status: 'VALID',
      ticketTypeName: tt1_1.name,
      eventName: event1.name,
      venue: event1.venue,
      eventDate: event1.eventDate,
      holderName: 'Alex Johnson',
      holderEmail: 'guest@example.com',
      seatLabel: 'VIP-S1',
      issuedAt: new Date().toISOString(),
    };
    db.tickets.set(sampleTicket.id, sampleTicket);

    // Sample checked-in ticket for testing replay attack rejection
    const sampleCheckedInId = 'sample-ticket-checkedin-002';
    const token2 = SecurityService.generateTicketToken(sampleCheckedInId, event1.id, sampleOrderId);
    const sampleCheckedInTicket: Ticket = {
      id: sampleCheckedInId,
      orderId: sampleOrderId,
      eventId: event1.id,
      ticketTypeId: tt1_1.id,
      secureToken: token2.secureToken,
      signature: token2.signature,
      status: 'CHECKED_IN',
      ticketTypeName: tt1_1.name,
      eventName: event1.name,
      venue: event1.venue,
      eventDate: event1.eventDate,
      holderName: 'Jordan Smith',
      holderEmail: 'jordan@example.com',
      seatLabel: 'VIP-S2',
      issuedAt: new Date(Date.now() - 3600000).toISOString(),
      checkedInAt: new Date(Date.now() - 1800000).toISOString(),
      checkedInByStaffId: staffUser.id,
    };
    db.tickets.set(sampleCheckedInTicket.id, sampleCheckedInTicket);

    db.recordSecurityEvent(
      'CONCURRENCY_RACE_SERIALIZED',
      'INFO',
      'System initialized with authoritative database schema and seed events.'
    );
  }

  public static resetDemoDatabase(): void {
    db.users.clear();
    db.events.clear();
    db.ticketTypes.clear();
    db.reservations.clear();
    db.reservationItems.clear();
    db.orders.clear();
    db.orderItems.clear();
    db.payments.clear();
    db.tickets.clear();
    db.securityEvents = [];
    db.idempotencyKeys.clear();
    db.metrics = {
      concurrentAttempts: 0,
      successfulReservations: 0,
      rejectedDuplicates: 0,
      oversellAttemptsBlocked: 0,
      purchaseLimitViolationsBlocked: 0,
      rateLimitedRequests: 0,
      botSuspiciousDetected: 0,
      expiredHoldsReleased: 0,
    };

    SeedService.initSeedData();
    db.broadcast('inventory_update', { timestamp: Date.now() });
  }
}
