import crypto from 'node:crypto';

const SIGNING_SECRET = process.env.TICKET_SIGNING_SECRET || 'aegispass-high-entropy-hmac-sha256-production-signing-key-default';
const JWT_SECRET = process.env.JWT_SECRET || 'aegispass-session-jwt-token-secret-key-32chars';

export interface TicketPayload {
  v: number;       // Version
  tid: string;     // Ticket ID
  eid: string;     // Event ID
  oid: string;     // Order ID
  nonce: string;   // Cryptographic nonce
  iat: number;     // Issued at timestamp
}

export class SecurityService {
  /**
   * Hashes a password using PBKDF2 with a random salt
   */
  public static hashPassword(password: string): string {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    return `${salt}:${hash}`;
  }

  /**
   * Verifies password against salt:hash
   */
  public static verifyPassword(password: string, stored: string): boolean {
    const parts = stored.split(':');
    if (parts.length !== 2) return false;
    const [salt, originalHash] = parts;
    const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(originalHash, 'hex'));
  }

  /**
   * Generate signed session token
   */
  public static createSessionToken(payload: { userId: string; role: string; email: string }): string {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(
      JSON.stringify({
        ...payload,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 86400, // 24 hours
      })
    ).toString('base64url');
    const signature = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${header}.${body}`)
      .digest('base64url');
    return `${header}.${body}.${signature}`;
  }

  /**
   * Verify session token
   */
  public static verifySessionToken(token: string): { userId: string; role: string; email: string } | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      const [header, body, signature] = parts;
      const expectedSig = crypto
        .createHmac('sha256', JWT_SECRET)
        .update(`${header}.${body}`)
        .digest('base64url');

      if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
        return null;
      }

      const decoded = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
      if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
        return null; // Expired
      }
      return decoded;
    } catch {
      return null;
    }
  }

  /**
   * Signs a ticket payload with HMAC-SHA256
   */
  public static signTicketPayload(payload: TicketPayload): string {
    const canonicalString = `${payload.v}|${payload.tid}|${payload.eid}|${payload.oid}|${payload.nonce}|${payload.iat}`;
    return crypto.createHmac('sha256', SIGNING_SECRET).update(canonicalString).digest('hex');
  }

  /**
   * Generates a complete tamper-resistant QR code verification string
   */
  public static generateTicketToken(ticketId: string, eventId: string, orderId: string): {
    secureToken: string;
    signature: string;
  } {
    const payload: TicketPayload = {
      v: 1,
      tid: ticketId,
      eid: eventId,
      oid: orderId,
      nonce: crypto.randomBytes(8).toString('hex'),
      iat: Math.floor(Date.now() / 1000),
    };

    const signature = this.signTicketPayload(payload);
    const tokenPayload = { ...payload, sig: signature };
    const secureToken = Buffer.from(JSON.stringify(tokenPayload)).toString('base64url');

    return { secureToken, signature };
  }

  /**
   * Verifies ticket token cryptographic authenticity
   */
  public static verifyTicketToken(secureTokenString: string): {
    valid: boolean;
    reason?: string;
    payload?: TicketPayload & { sig: string };
  } {
    try {
      // Allow raw JSON or base64url encoded
      let parsed: any;
      if (secureTokenString.trim().startsWith('{')) {
        parsed = JSON.parse(secureTokenString);
      } else {
        parsed = JSON.parse(Buffer.from(secureTokenString, 'base64url').toString('utf8'));
      }

      if (!parsed || !parsed.tid || !parsed.eid || !parsed.sig || !parsed.nonce) {
        return { valid: false, reason: 'MALFORMED_TOKEN_STRUCTURE' };
      }

      const expectedSig = this.signTicketPayload({
        v: parsed.v || 1,
        tid: parsed.tid,
        eid: parsed.eid,
        oid: parsed.oid,
        nonce: parsed.nonce,
        iat: parsed.iat,
      });

      const givenSigBuffer = Buffer.from(parsed.sig, 'hex');
      const expectedSigBuffer = Buffer.from(expectedSig, 'hex');

      if (
        givenSigBuffer.length !== expectedSigBuffer.length ||
        !crypto.timingSafeEqual(givenSigBuffer, expectedSigBuffer)
      ) {
        return { valid: false, reason: 'CRYPTOGRAPHIC_SIGNATURE_MISMATCH_TAMPERED' };
      }

      return { valid: true, payload: parsed };
    } catch (err: any) {
      return { valid: false, reason: 'DECODE_ERROR_INVALID_FORMAT' };
    }
  }
}
