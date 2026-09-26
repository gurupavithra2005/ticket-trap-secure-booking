# AegisPass Security Policy & Controls

## Cryptographic Design

### 1. Ticket Signature Generation
Every issued pass is cryptographically bound to its non-sequential ticket ID, order reference, event ID, issue timestamp, and a cryptographically secure pseudo-random 64-bit nonce.
```
Canonical String = ${v}|${tid}|${eid}|${oid}|${nonce}|${iat}
HMAC_SHA256(Canonical String, TICKET_SIGNING_SECRET) -> Hex Signature
```
- Non-guessable IDs: Non-sequential UUIDv4 prevents enumeration attacks.
- Nonce freshness: Prevents rainbow tables and precomputation.
- Zero PII: The QR token contains only `{ v, tid, eid, oid, nonce, iat, sig }`. Customer names and emails are never serialized in the optical barcode.

### 2. Timing-Safe Comparisons
All cryptographic signature verifications and password hash verifications employ `crypto.timingSafeEqual` to eliminate timing side-channel attacks.

### 3. Password Hashing
Passwords are salted with a 16-byte random salt and hashed using PBKDF2 with 100,000 iterations of SHA-512.

### 4. Session Tokens
Session tokens are issued as JSON Web Tokens signed with server secrets. Tokens carry an expiration timestamp and are verified on every protected request.

### 5. Role-Based Access Control (RBAC)
Endpoints enforce server-side role validation:
- `/api/events` (POST/PUT/DELETE): `ADMIN` only.
- `/api/admin/*`: `ADMIN` only.
- `/api/tickets/validate` and `/api/tickets/check-in`: `STAFF` and `ADMIN` only.
- `/api/reservations` and `/api/checkout`: Authenticated `CUSTOMER`, `STAFF`, or `ADMIN`.
- Unauthorized requests return HTTP 403 Forbidden and log an audit event.

### 6. Anti-Bot & Velocity Shield
- Honeypot Trap: Forms contain an invisible field `_hp_trap`. Automated bots that indiscriminately fill all inputs are instantly blocked with a `403 BOT_ACTIVITY_DETECTED`.
- Inhuman Velocity Detection: Human users require several seconds to browse, select, and submit forms. Submissions in under 600ms increase the client's threat score.
- Sliding Window Rate Limiting: Limits login attempts to 5 per 15 minutes, checkout requests to 6 per 30 seconds, and reservation requests to 10 per 10 seconds.
