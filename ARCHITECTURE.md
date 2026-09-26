# AegisPass System Architecture

## Architecture Overview

AegisPass follows Clean Architecture and Domain-Driven Design (DDD) principles. It is structured into distinct functional layers that separate network transport, domain rules, state machines, and data persistence.

```
src/
├── server/
│   ├── db/
│   │   ├── schema.ts          # Relational entities & TypeScript types
│   │   └── database.ts        # Transactional engine with AsyncLock mutexes & SSE pub/sub
│   ├── services/
│   │   ├── security.service.ts    # HMAC-SHA256 signing, verification, PBKDF2 hashing
│   │   ├── ratelimit.service.ts   # Sliding window limiter & anti-bot velocity scoring
│   │   ├── reservation.service.ts # Atomic reservation engine & row-level mutex
│   │   ├── order.service.ts       # Order lifecycle, payment simulation, compensating actions
│   │   ├── ticket.service.ts      # Authoritative validation & atomic check-in
│   │   └── seed.service.ts        # Pristine seed data & reset engine
│   └── routes/
│       └── api.routes.ts      # REST API endpoints & SSE live-stream
├── context/
│   ├── AuthContext.tsx        # Authentication state & role switching
│   └── LiveContext.tsx        # Real-time SSE stream & countdown synchronizer
├── components/
│   ├── Navbar.tsx             # Global header with live status & role switcher
│   ├── EventCard.tsx          # Real-time inventory cards with segmented availability bars
│   ├── TicketSelectorModal.tsx# Limit-enforced tier selector with honeypot field
│   ├── CheckoutModal.tsx      # Reservation hold countdown & payment simulator
│   ├── TicketPassCard.tsx     # Digital pass with high-res QR code
│   ├── StaffScanner.tsx       # Gate validation & replay detection
│   ├── ConcurrencyDemoLab.tsx # 8 live interactive evaluator simulations
│   ├── AdminDashboard.tsx     # Telemetry metrics & live audit log stream
│   └── SecurityArchitectureModal.tsx # Interactive layer-by-layer architectural explainer
├── services/
│   └── api.ts                 # Type-safe API client
├── App.tsx                    # Root UI orchestration
└── main.tsx                   # Application entry point
```

## Concurrency & Data Consistency Strategy

### 1. Serialized Row Isolation (`AsyncLock`)
In high-demand drops, multiple Node.js async operations interleave in the event loop. To guarantee ACID-like serializable isolation without race conditions, reservations for each event are guarded by a resource lock:
`db.getLock('event-inventory:' + eventId)`

### 2. Invariant Guard Checks Inside the Lock
Once the lock is acquired, the service authoritatively checks:
1. `currentCommitted + requestedQuantity <= event.maxTicketsPerUser`
2. `ticketType.availableQuantity >= requestedQuantity`
3. Decrement `availableQuantity`, increment `reservedQuantity`
4. Store reservation with expiration timestamp `now + holdDurationSeconds`
5. Store response under `idempotencyKey`

### 3. Automatic Compensating Action on Payment Failure
If payment simulation yields `DECLINED` or `TIMEOUT`:
- Order status is set to `PAYMENT_FAILED`.
- The reserved quantity is immediately restored to `availableQuantity`.
- Reservation status is set to `CANCELLED`.
- A security audit event is logged: `PAYMENT_COMPENSATED`.

### 4. Background and Lazy Hold Cleanup
To ensure abandoned checkouts do not lock inventory:
- Background worker runs every 2 seconds.
- Every reservation and inventory read also triggers a lazy sweep of expired holds.
