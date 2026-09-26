import { db } from '../db/database.ts';

interface RateLimitBucket {
  tokens: number;
  lastRefill: number;
  requestTimestamps: number[];
}

export class RateLimitService {
  private static buckets: Map<string, RateLimitBucket> = new Map();
  private static failedLoginAttempts: Map<string, { count: number; lockedUntil: number }> = new Map();

  /**
   * Check sliding window rate limit for an action
   */
  public static checkRateLimit(
    key: string,
    limit: number,
    windowMs: number
  ): { allowed: boolean; remaining: number; retryAfterMs: number } {
    const now = Date.now();
    let bucket = this.buckets.get(key);

    if (!bucket) {
      bucket = { tokens: limit, lastRefill: now, requestTimestamps: [] };
      this.buckets.set(key, bucket);
    }

    // Clean timestamps older than windowMs
    bucket.requestTimestamps = bucket.requestTimestamps.filter((ts) => now - ts < windowMs);

    if (bucket.requestTimestamps.length >= limit) {
      const oldest = bucket.requestTimestamps[0];
      const retryAfterMs = Math.max(0, windowMs - (now - oldest));
      return { allowed: false, remaining: 0, retryAfterMs };
    }

    bucket.requestTimestamps.push(now);
    return {
      allowed: true,
      remaining: limit - bucket.requestTimestamps.length,
      retryAfterMs: 0,
    };
  }

  /**
   * Track failed login attempts for brute force mitigation
   */
  public static recordFailedLogin(identifier: string): { isLocked: boolean; remainingAttempts: number } {
    const now = Date.now();
    const entry = this.failedLoginAttempts.get(identifier) || { count: 0, lockedUntil: 0 };

    if (entry.lockedUntil > now) {
      return { isLocked: true, remainingAttempts: 0 };
    }

    entry.count++;
    if (entry.count >= 5) {
      entry.lockedUntil = now + 15 * 60 * 1000; // 15 min lock
      this.failedLoginAttempts.set(identifier, entry);
      return { isLocked: true, remainingAttempts: 0 };
    }

    this.failedLoginAttempts.set(identifier, entry);
    return { isLocked: false, remainingAttempts: 5 - entry.count };
  }

  public static isLoginLocked(identifier: string): boolean {
    const entry = this.failedLoginAttempts.get(identifier);
    if (!entry) return false;
    return entry.lockedUntil > Date.now();
  }

  public static resetFailedLogin(identifier: string): void {
    this.failedLoginAttempts.delete(identifier);
  }

  /**
   * Evaluates bot indicators: honeypot field, request velocity, suspicious headers
   */
  public static evaluateBotScore(reqBody: any, ip: string, headers: Record<string, any>): {
    isBot: boolean;
    score: number;
    reasons: string[];
  } {
    const reasons: string[] = [];
    let score = 0;

    // 1. Honeypot check: `_hp_trap` or `website_url` should be empty
    if (reqBody && (reqBody._hp_trap || reqBody.honeypot_token || reqBody.website_url)) {
      score += 85;
      reasons.push('HONEYPOT_FIELD_TRIPPED: Automated bot filled hidden form field');
    }

    // 2. Client timing detection: human booking rarely takes < 800ms
    if (reqBody && reqBody._form_time_ms && reqBody._form_time_ms < 600) {
      score += 45;
      reasons.push(`INHUMAN_VELOCITY: Form submitted in ${reqBody._form_time_ms}ms`);
    }

    // 3. User agent checks
    const ua = (headers['user-agent'] || '').toLowerCase();
    if (ua.includes('curl') || ua.includes('python-requests') || ua.includes('postman') || ua.includes('bot')) {
      score += 30;
      reasons.push('SCRIPTED_USER_AGENT');
    }

    // 4. IP rapid burst detection (> 8 requests in 2 seconds)
    const burstKey = `burst:${ip}`;
    const burstResult = this.checkRateLimit(burstKey, 8, 2000);
    if (!burstResult.allowed) {
      score += 50;
      reasons.push('RAPID_BURST_FLOOD_DETECTED');
    }

    return {
      isBot: score >= 60,
      score,
      reasons,
    };
  }

  /**
   * Verify CAPTCHA with demo fallback mode
   */
  public static verifyCaptcha(captchaToken?: string): { success: boolean; mode: 'REAL' | 'DEMO' } {
    if (!captchaToken || captchaToken.trim() === '') {
      // In strict environment, this fails; for demo test allow explicitly flagged demo token
      return { success: false, mode: 'DEMO' };
    }

    if (captchaToken === 'DEMO_BYPASS_TOKEN' || captchaToken.startsWith('test_')) {
      return { success: true, mode: 'DEMO' };
    }

    // Default to valid demo pass for the hackathon UI toggle
    return { success: true, mode: 'DEMO' };
  }
}
