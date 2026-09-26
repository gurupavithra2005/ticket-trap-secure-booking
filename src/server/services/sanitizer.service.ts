/**
 * Data Sanitizer & Input Validation Service
 * Enforces strict input validation, XSS prevention, and parameter sanitization
 */
export class DataSanitizer {
  /**
   * Sanitizes string by stripping HTML tags and dangerous characters to prevent XSS
   */
  public static sanitizeString(input: unknown): string {
    if (typeof input !== 'string') return '';
    return input
      .trim()
      .replace(/[<>]/g, '') // Strip angle brackets
      .replace(/javascript:/gi, '') // Strip JS protocol
      .replace(/on\w+=/gi, ''); // Strip inline event handlers
  }

  /**
   * Validates and sanitizes email address format
   */
  public static sanitizeEmail(email: unknown): { valid: boolean; email: string } {
    if (typeof email !== 'string') return { valid: false, email: '' };
    const cleaned = email.trim().toLowerCase();
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return {
      valid: emailRegex.test(cleaned),
      email: cleaned,
    };
  }

  /**
   * Validates and coerces ticket quantity
   */
  public static validateQuantity(qty: unknown, maxAllowed: number = 10): { valid: boolean; quantity: number } {
    const num = Number(qty);
    if (!Number.isInteger(num) || num <= 0 || num > maxAllowed) {
      return { valid: false, quantity: 0 };
    }
    return { valid: true, quantity: num };
  }

  /**
   * Validates UUID format
   */
  public static isValidId(id: unknown): boolean {
    if (typeof id !== 'string') return false;
    // Allow standard UUID or prefixed IDs like user-xxx, event-xxx
    return /^[a-zA-Z0-9_-]{3,64}$/.test(id);
  }
}
