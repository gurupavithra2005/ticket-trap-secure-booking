# AegisPass — Secure High-Demand Ticketing Platform

> **Zero-Oversell Concurrency Engine, Tamper-Resistant Cryptographic Passes & Anti-Bot Protection**

AegisPass is an enterprise-grade, high-concurrency ticket reservation and validation platform engineered specifically to solve the core challenges of high-demand event ticketing: **overselling during concurrent booking spikes, per-user ticket limit bypassing, duplicate bookings, bot farm scalping, and fraudulent QR replay attacks**.

---

## 1. Project Overview & Problem Statement

During high-demand ticket drops (such as major music festivals, developer keynotes, and sports championships), thousands of concurrent users and automated bot scripts hit reservation endpoints within milliseconds of each other. Standard web architectures fail under these conditions due to:

1. **Race Conditions & Overselling**: User A and User B concurrently read available inventory as 1 and both receive confirmations, resulting in negative inventory and double-booked seats.
2. **Ticket-Limit Bypassing**: Users open 10 browser tabs or write async multi-threaded scripts to purchase 20 tickets simultaneously when the event limit is only 4.
3. **Duplicate Bookings & Replay**: Network retries or double-clicking checkout triggers duplicate charges and duplicate seat allocations.
4. **Fraudulent QR Replication & Replay**: Scalpers duplicate or tamper with QR codes and attempt multi-device admission at venue turnstiles.
5. **Orphaned Inventory from Abandoned Holds / Payment Failures**: Systems either lock inventory indefinitely or fail to restore stock when payment declines or times out.

AegisPass solves every one of these failure modes through authoritative server-side isolation, cryptographic HMAC signatures, and automated compensating transactions.

---

## 2. Technical Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS, Lucide Icons, Motion, QRCode generation.
- **Backend**: Node.js, Express, TypeScript (TSX execution runtime), native `node:crypto` cryptographic suite.
- **Real-Time Synchronization**: Server-Sent Events (SSE) streaming live inventory, security telemetry, and traffic load metrics.
- **Database & Concurrency Isolation**: Thread-safe transactional store with explicit row-level locking (`AsyncLock` mutexes simulating `SELECT FOR UPDATE` semantics), ACID consistency, and relational foreign keys.
- **Security & Cryptography**: HMAC-SHA256 nonced digital signatures, PBKDF2 with salt for password hashing, and HS256/RS256 session tokens.
- **Anti-Bot Shield**: Sliding-window rate limiting, inhuman velocity detection (<600ms submission thresholds), and honeypot traps (`_hp_trap`).

---

## 3. High-Level Architecture

```
[ Incoming Client Request ]
           │
           ▼
[ Layer 1: Anti-Bot & Honeypot Shield ]
  - Checks _hp_trap field (must be empty)
  - Evaluates client submission velocity (<600ms flagged as bot)
  - Evaluates User-Agent and rapid burst counters
           │ (Allowed)
           ▼
[ Layer 2: Sliding-Window Rate Limiter ]
  - Limits requests per IP / per user / per endpoint
           │ (Allowed)
           ▼
[ Layer 3: Authentication & RBAC ]
  - Verifies session token & validates roles: ADMIN, STAFF, CUSTOMER
           │
           ▼
[ Layer 4: Idempotency Key Gate ]
  - Replays of identical idempotency keys return existing active reservation
           │ (New Request)
           ▼
[ Layer 5: Atomic Row-Level Mutex (event-inventory:ID) ]
  - Acquires exclusive lock on event/ticket type rows
  - Executes lazy cleanup of expired holds
  - Evaluates Authoritative User Limit (active holds + completed orders <= limit)
  - Verifies available_quantity >= requested_quantity
  - Decrements available_quantity, increments reserved_quantity
  - Creates reservation record with 300s TTL
  - Releases lock & broadcasts real-time SSE event
           │
           ▼
[ Layer 6: Checkout & Payment State Machine ]
  - SUCCESS: Commits inventory (reserved -> sold), transitions order to CONFIRMED
  - DECLINED / TIMEOUT: Executes immediate compensating transaction
    (restores available_quantity, releases hold, marks order PAYMENT_FAILED)
           │ (On Success)
           ▼
[ Layer 7: Tamper-Resistant Pass Generation ]
  - Issues non-sequential ticket IDs with random nonces
  - Cryptographically signs verification token with HMAC-SHA256
  - Embeds zero PII in the QR code payload
           │
           ▼
[ Layer 8: Staff Gate Scanner & Atomic Check-In ]
  - Validates HMAC signature, checks ticket existence & event match
  - Verifies status is VALID
  - Atomically marks CHECKED_IN, blocking duplicate/replay entries
```

---

## 4. Key Security & Concurrency Invariants

| Invariant | Implementation Mechanism | Validation Result |
| :--- | :--- | :--- |
| **Zero Oversell Guarantee** | Row-level mutex serialized transaction (`SELECT FOR UPDATE`) | `available_quantity` never drops below 0 |
| **Strict Per-User Limits** | Server-side count of `(completed orders + active holds)` | Parallel 8-tab bypass attempts blocked |
| **Idempotency** | In-memory & DB idempotency key index with TTL | Concurrent duplicate calls return same reservation |
| **Compensating Rollback** | Automated compensation on `DECLINED` or `TIMEOUT` payment | Held tickets immediately returned to inventory |
| **No Orphaned Holds** | Active hold countdown (300s TTL) + background & lazy sweeper | Expired holds auto-restored to availability |
| **Tamper-Resistant QR** | HMAC-SHA256 signature on canonical string: `v\|tid\|eid\|oid\|nonce\|iat` | Modified signatures rejected as `TAMPERED` |
| **Replay Attack Defense** | Atomic state check and transition to `CHECKED_IN` | Re-scanned passes rejected as `ALREADY_CHECKED_IN` |
| **Bot Scraping Defense** | Hidden honeypot fields + submission velocity check | Automated scripts receive `403 BOT_ACTIVITY_DETECTED` |

---

## 5. User Roles & RBAC

1. **ADMIN** (`admin@example.com` / `Admin@Pass123`):
   - Access to System Observability & Audit Center.
   - Live security event logs with severity filters (`INFO`, `WARN`, `CRITICAL`).
   - Create, edit, and publish new events with customized ticket tiers, purchase limits, and hold durations.
   - Reset database to clean demo state.
2. **STAFF** (`staff@example.com` / `Staff@Pass123`):
   - Access to Staff Gate Inspection Scanner.
   - Inspects QR code tokens or ticket IDs.
   - Evaluates signature authenticity, event validity, and replay status.
   - Atomically executes check-ins.
3. **CUSTOMER / GUEST** (`guest@example.com` / `Guest@Pass123`):
   - Browses live catalog with real-time inventory synchronization.
   - Selects ticket quantities and reserves inventory.
   - Views live hold countdown timer.
   - Completes checkout via mock payment gateway simulator.
   - Receives digital passes with authentic QR codes.

---

## 6. Evaluator Concurrency & Security Laboratory

The platform includes a dedicated **Concurrency Lab** tab designed specifically for technical evaluators to verify the 8 core scenarios directly in the browser:

1. **Simulate 20 Concurrent Requests (Last-Ticket Race)**: Fires 20 parallel threads competing for 1 ticket; confirms exactly 1 wins, 19 are rejected, and inventory reaches 0 without going negative.
2. **Simulate Duplicate Booking (Idempotency Replay)**: Sends 5 simultaneous requests with the same idempotency key; confirms only 1 reservation is created.
3. **Simulate Ticket-Limit Bypass**: Sends 8 parallel requests requesting 2 tickets each (total 16) when the limit is 4; confirms server caps total tickets at 4.
4. **Simulate Payment Failure & Compensation**: Reserves tickets, simulates bank decline, and confirms the compensating transaction immediately restores tickets to public inventory.
5. **Simulate QR Code Cryptographic Tampering**: Modifies signature bytes in a valid ticket token; verifies gate scanner flags it as `CRYPTOGRAPHIC_SIGNATURE_MISMATCH_TAMPERED`.
6. **Simulate Ticket Replay Attack**: Submits an already checked-in ticket; verifies gate scanner blocks entry with `TICKET ALREADY USED`.
7. **Simulate Bot Burst & Honeypot**: Submits hidden form honeypot with sub-second velocity; confirms instant 403 blocking.
8. **Simulate Expired Hold Release**: Demonstrates active reservation TTL expiry and lazy restoration.

---

## 7. Automated Test Suite

Run the automated test suite locally:

```bash
npm test
```

This executes `test/concurrency-test.ts`, running 17 assertions covering:
- Cryptographic HMAC-SHA256 signature verification and tamper rejection.
- Honeypot and velocity scoring.
- Idempotency key replay verification.
- Per-user limit enforcement.
- 20-thread concurrent last-ticket race condition.
- Payment failure compensating rollback.
- Replay check-in prevention.

---

## 8. Local Setup & Environment

### Prerequisites
- Node.js 18+
- npm or pnpm

### Setup Instructions
```bash
# 1. Install dependencies
npm install

# 2. Start full-stack development server
npm run dev

# 3. Open browser at
http://localhost:3000
```
