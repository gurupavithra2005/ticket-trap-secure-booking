# AegisPass Threat Model

This document maps identified attack vectors, controls, technical implementations, and test coverage.

---

### Threat 1: Double Booking / Last-Ticket Race Condition
- **Attack**: Two users concurrently attempt to reserve the final remaining ticket. Both read available count as 1, leading to negative inventory and duplicate seat allocations.
- **Control**: Serialized row-level mutex transaction.
- **Implementation**: `db.getLock('event-inventory:' + eventId)`. Evaluates inventory inside lock; only first thread succeeds; second receives `INSUFFICIENT_INVENTORY`.
- **Test**: Automated concurrency test in `test/concurrency-test.ts` (Test #5) & Evaluator Lab Scenario #1 with 20 parallel threads.

---

### Threat 2: Per-User Ticket Limit Bypass (Multi-Tab Attack)
- **Attack**: A scalper opens 8 browser tabs or writes a script sending 8 simultaneous requests to purchase 2 tickets each, attempting to buy 16 tickets when the event limit is 4.
- **Control**: Authoritative server-side summation of active holds + completed orders inside the inventory mutex lock.
- **Implementation**: `db.getUserCommittedTicketCount(userId, eventId) + requestedQuantity <= maxAllowed`. Excess requests rejected with `TICKET_LIMIT_EXCEEDED`.
- **Test**: Automated concurrency test #4 & Evaluator Lab Scenario #3.

---

### Threat 3: Idempotent Request Duplication / Network Retries
- **Attack**: User double-clicks "Reserve" or network proxy retries POST request, causing two separate reservations and double charging.
- **Control**: Unique Idempotency Key mapping.
- **Implementation**: `db.idempotencyKeys` stores request key, user ID, and active reservation. Duplicate keys return cached reservation without re-allocating inventory.
- **Test**: Automated concurrency test #3 & Evaluator Lab Scenario #2.

---

### Threat 4: Automated Bot Farms & Headless Scrapers
- **Attack**: Bots rapidly scrape inventory and flood checkout endpoints before humans can react.
- **Control**: Layered bot defense: invisible honeypot field `_hp_trap`, client velocity detection (<600ms), and sliding-window rate limiting.
- **Implementation**: `RateLimitService.evaluateBotScore()`. Bots filling `_hp_trap` or submitting instantly receive `403 BOT_ACTIVITY_DETECTED`.
- **Test**: Automated concurrency test #2 & Evaluator Lab Scenario #7.

---

### Threat 5: QR Code Tampering & Counterfeit Passes
- **Attack**: An attacker buys a General ticket and modifies the QR token payload to change tier name or seat assignment to VIP.
- **Control**: Cryptographic HMAC-SHA256 digital signature over canonical string without PII.
- **Implementation**: `SecurityService.verifyTicketToken()`. Employs `crypto.timingSafeEqual`. Any modified byte produces a signature mismatch flagged as `CRYPTOGRAPHIC_SIGNATURE_MISMATCH_TAMPERED`.
- **Test**: Automated concurrency test #1 & Evaluator Lab Scenario #5.

---

### Threat 6: Ticket Replay / Multi-Device Turnstile Fraud
- **Attack**: Attacker duplicates or screenshots a valid QR code and attempts entry at multiple gates simultaneously.
- **Control**: Atomic state transition to `CHECKED_IN` protected by `ticket-checkin:${ticketId}` lock.
- **Implementation**: `TicketService.checkInTicket()`. First scanner marks ticket `CHECKED_IN` with timestamp and staff ID; subsequent scans immediately reject with `ALREADY_CHECKED_IN`.
- **Test**: Automated concurrency test #7 & Evaluator Lab Scenario #6.

---

### Threat 7: Orphaned Holds / Payment Failures
- **Attack**: User reserves tickets but abandons checkout or payment declines; inventory remains locked indefinitely.
- **Control**: Fixed TTL countdown (300s) + automated compensating transactions on `DECLINED` or `TIMEOUT`.
- **Implementation**: `OrderService.processCheckout()` automatically restores `availableQuantity` on payment failure; background sweeper cleans abandoned holds every 2s.
- **Test**: Automated concurrency test #6 & Evaluator Lab Scenario #4.

---

### Threat 8: Privilege Escalation
- **Attack**: Regular customer calls `/api/admin/metrics` or `/api/tickets/check-in` to alter system settings or check in tickets.
- **Control**: Strict RBAC middleware verifying session JWT claims.
- **Implementation**: `requireRole('ADMIN')` and `requireRole('STAFF', 'ADMIN')`. Unauthorized calls return `403 FORBIDDEN` and log a security audit event.
- **Test**: Tested via RBAC router middleware and Evaluator Role Switcher.
