import { db } from '../src/server/db/database.ts';
import { SeedService } from '../src/server/services/seed.service.ts';
import { ReservationService } from '../src/server/services/reservation.service.ts';
import { OrderService } from '../src/server/services/order.service.ts';
import { TicketService } from '../src/server/services/ticket.service.ts';
import { SecurityService } from '../src/server/services/security.service.ts';
import { RateLimitService } from '../src/server/services/ratelimit.service.ts';
import { DataSanitizer } from '../src/server/services/sanitizer.service.ts';
import crypto from 'node:crypto';

async function runTestSuite() {
  console.log('====================================================');
  console.log('  AEGISPASS AUTOMATED CONCURRENCY & SECURITY TEST SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string, extra?: string) {
    total++;
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName} - ${extra || 'Assertion failed'}`);
    }
  }

  // Seed data
  SeedService.resetDemoDatabase();

  // Test 1: Ticket Signature & Cryptography
  console.log('\n--- 1. Cryptography & Tamper Resistance ---');
  const ticketId = crypto.randomUUID();
  const eventId = 'test-event-1';
  const orderId = 'test-order-1';
  const { secureToken, signature } = SecurityService.generateTicketToken(ticketId, eventId, orderId);

  const verificationValid = SecurityService.verifyTicketToken(secureToken);
  assert(verificationValid.valid === true, 'Valid QR token verifies successfully');

  // Tamper with payload
  const decoded = JSON.parse(Buffer.from(secureToken, 'base64url').toString('utf8'));
  decoded.sig = 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
  const tamperedToken = Buffer.from(JSON.stringify(decoded)).toString('base64url');
  const verificationTampered = SecurityService.verifyTicketToken(tamperedToken);
  assert(verificationTampered.valid === false, 'Tampered token signature is rejected');

  // Test 2: Anti-bot Honeypot and Velocity
  console.log('\n--- 2. Anti-Bot & Velocity Scoring ---');
  const botCheck1 = RateLimitService.evaluateBotScore({ _hp_trap: 'bot-input' }, '1.2.3.4', {});
  assert(botCheck1.isBot === true, 'Honeypot field trips bot detection');

  const botCheck2 = RateLimitService.evaluateBotScore({ _form_time_ms: 100 }, '1.2.3.4', {});
  assert(botCheck2.score >= 40, 'Sub-second form submission penalized');

  // Test 3: Idempotency Key Replay
  console.log('\n--- 3. Idempotency & Duplicate Request Protection ---');
  const event = Array.from(db.events.values())[0];
  const tier = Array.from(db.ticketTypes.values()).find((t) => t.eventId === event.id)!;
  const user = 'user-guest-1';
  const idempotencyKey = 'test-idemp-' + crypto.randomUUID();

  const res1 = await ReservationService.createReservation({
    userId: user,
    eventId: event.id,
    items: [{ ticketTypeId: tier.id, quantity: 1 }],
    idempotencyKey,
  });

  const res2 = await ReservationService.createReservation({
    userId: user,
    eventId: event.id,
    items: [{ ticketTypeId: tier.id, quantity: 1 }],
    idempotencyKey,
  });

  assert(res1.success === true, 'First reservation succeeds');
  assert(res2.success === true, 'Second identical request returns idempotency result');
  assert(
    res1.reservation?.id === res2.reservation?.id,
    'Duplicate request returns same reservation ID without double allocation'
  );

  // Test 4: Per-User Ticket Limit Enforcement
  console.log('\n--- 4. Per-User Ticket Limit Enforcement ---');
  // User currently has 1 reserved ticket. Limit is event.maxTicketsPerUser (4)
  const resExceed = await ReservationService.createReservation({
    userId: user,
    eventId: event.id,
    items: [{ ticketTypeId: tier.id, quantity: 4 }], // 1 + 4 = 5 > 4!
  });
  assert(resExceed.success === false, 'Attempt to exceed purchase limit is blocked');
  assert(resExceed.code === 'TICKET_LIMIT_EXCEEDED', 'Returns code TICKET_LIMIT_EXCEEDED');

  // Test 5: Critical Concurrency Test (Last-Ticket Race)
  console.log('\n--- 5. Atomic Concurrency: 20-Thread Last Ticket Race ---');
  // Set tier available quantity to exactly 1
  tier.availableQuantity = 1;
  tier.reservedQuantity = 0;

  const racePromises = Array.from({ length: 20 }).map((_, i) => {
    return ReservationService.createReservation({
      userId: `race-competitor-${i}`,
      eventId: event.id,
      items: [{ ticketTypeId: tier.id, quantity: 1 }],
    });
  });

  const raceResults = await Promise.all(racePromises);
  const raceWinners = raceResults.filter((r) => r.success);
  const raceLosers = raceResults.filter((r) => !r.success);

  assert(raceWinners.length === 1, 'Exactly one concurrent thread succeeds on last ticket');
  assert(raceLosers.length === 19, '19 concurrent threads receive controlled rejection');
  assert(tier.availableQuantity === 0, 'Inventory reaches zero and never becomes negative');
  assert(tier.availableQuantity >= 0, 'Authoritative inventory invariant: remaining >= 0');

  // Test 6: Payment Failure Compensating Transaction
  console.log('\n--- 6. Payment Failure Compensation Rollback ---');
  tier.availableQuantity = 10;
  const initialAvail = tier.availableQuantity;

  const holdForPayment = await ReservationService.createReservation({
    userId: 'user-payment-test',
    eventId: event.id,
    items: [{ ticketTypeId: tier.id, quantity: 2 }],
  });
  assert(tier.availableQuantity === initialAvail - 2, 'Inventory decremented during active hold');

  const failedCheckout = await OrderService.processCheckout({
    userId: 'user-payment-test',
    reservationId: holdForPayment.reservation!.id,
    paymentOutcome: 'DECLINED',
    customerName: 'Payment Test User',
    customerEmail: 'payment@test.com',
  });

  assert(failedCheckout.success === false, 'Payment decline caught');
  assert(tier.availableQuantity === initialAvail, 'Compensating action restored inventory to initial count');

  // Test 7: Staff Replay Attack Prevention
  console.log('\n--- 7. Replay Attack & Check-In Validation ---');
  const checkedInTicket = Array.from(db.tickets.values()).find((t) => t.status === 'CHECKED_IN')!;
  const replayValidation = await TicketService.validateTicket(checkedInTicket.secureToken, checkedInTicket.eventId);
  assert(replayValidation.status === 'ALREADY_CHECKED_IN', 'Replay check-in correctly detected as ALREADY_CHECKED_IN');

  // Test 8: Security & Data Sanitization
  console.log('\n--- 8. Security & Data Sanitization ---');
  const xssInput = '<script>alert("xss")</script>John Doe';
  const cleanString = DataSanitizer.sanitizeString(xssInput);
  assert(!cleanString.includes('<script>') && !cleanString.includes('</script>'), 'XSS tags stripped cleanly');

  const validEmail = DataSanitizer.sanitizeEmail('  Alex.Johnson@Example.COM  ');
  assert(validEmail.valid === true && validEmail.email === 'alex.johnson@example.com', 'Email normalized and validated');

  const invalidEmail = DataSanitizer.sanitizeEmail('bad-email-without-at');
  assert(invalidEmail.valid === false, 'Malformed email rejected');

  const validQty = DataSanitizer.validateQuantity(4, 10);
  assert(validQty.valid === true && validQty.quantity === 4, 'Valid ticket quantity accepted');

  const invalidQty = DataSanitizer.validateQuantity(-2, 10);
  assert(invalidQty.valid === false, 'Negative quantity rejected');

  const overflowQty = DataSanitizer.validateQuantity(15, 10);
  assert(overflowQty.valid === false, 'Excess quantity over limit rejected');

  console.log('\n====================================================');
  console.log(`TEST RUN COMPLETE: ${passed}/${total} assertions passed.`);
  console.log('====================================================\n');

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
