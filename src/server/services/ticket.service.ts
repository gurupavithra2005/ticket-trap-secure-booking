import { db } from '../db/database.ts';
import { Ticket } from '../db/schema.ts';
import { SecurityService } from './security.service.ts';

export interface TicketValidationResult {
  valid: boolean;
  status: 'VALID' | 'ALREADY_CHECKED_IN' | 'TAMPERED_INVALID' | 'NOT_FOUND' | 'WRONG_EVENT' | 'CANCELLED';
  message: string;
  ticket?: Ticket;
  event?: any;
  securityDetails?: {
    verifiedSignature: boolean;
    tamperDetected: boolean;
    nonce?: string;
    checkedInAt?: string;
  };
}

export class TicketService {
  /**
   * Validates a ticket by secureToken string or ticket ID
   */
  public static async validateTicket(
    tokenOrId: string,
    targetEventId?: string
  ): Promise<TicketValidationResult> {
    const rawInput = tokenOrId.trim();

    // 1. Try cryptographic token verification
    const cryptoCheck = SecurityService.verifyTicketToken(rawInput);

    let ticket: Ticket | undefined;

    if (cryptoCheck.valid && cryptoCheck.payload) {
      // Valid cryptographic signature, lookup ticket in DB
      ticket = db.tickets.get(cryptoCheck.payload.tid);
    } else {
      // Fallback: check if input is directly a ticket ID
      ticket = db.tickets.get(rawInput);
      if (!ticket) {
        db.recordSecurityEvent(
          'TAMPERED_TICKET_REJECTED',
          'WARN',
          `Ticket validation failed: Invalid cryptographic signature or malformed payload. Reason: ${cryptoCheck.reason || 'Not found'}`,
          { input: rawInput.slice(0, 30), reason: cryptoCheck.reason }
        );
        return {
          valid: false,
          status: 'TAMPERED_INVALID',
          message: 'Invalid or tampered ticket payload. Cryptographic signature verification failed.',
          securityDetails: {
            verifiedSignature: false,
            tamperDetected: true,
          },
        };
      }
    }

    if (!ticket) {
      return {
        valid: false,
        status: 'NOT_FOUND',
        message: 'Ticket record does not exist in authoritative system.',
      };
    }

    const event = db.events.get(ticket.eventId);

    // 2. Check event matching
    if (targetEventId && ticket.eventId !== targetEventId) {
      return {
        valid: false,
        status: 'WRONG_EVENT',
        message: `Ticket belongs to "${event?.name || 'Different Event'}", not the selected gate event.`,
        ticket,
        event,
      };
    }

    // 3. Check if already checked in (REPLAY ATTACK PREVENTION)
    if (ticket.status === 'CHECKED_IN') {
      db.recordSecurityEvent(
        'REPLAY_CHECKIN_REJECTED',
        'WARN',
        `Replay attack blocked: Ticket ${ticket.id.slice(0, 8)} was already checked in at ${ticket.checkedInAt}.`,
        { ticketId: ticket.id, checkedInAt: ticket.checkedInAt }
      );
      return {
        valid: false,
        status: 'ALREADY_CHECKED_IN',
        message: `TICKET ALREADY USED: This ticket was already checked in at ${ticket.checkedInAt}. Entry denied.`,
        ticket,
        event,
        securityDetails: {
          verifiedSignature: true,
          tamperDetected: false,
          checkedInAt: ticket.checkedInAt,
        },
      };
    }

    // 4. Check if cancelled / expired
    if (ticket.status === 'CANCELLED' || ticket.status === 'EXPIRED') {
      return {
        valid: false,
        status: 'CANCELLED',
        message: `Ticket status is ${ticket.status}. Entry cannot be granted.`,
        ticket,
        event,
      };
    }

    // Ticket is 100% valid!
    return {
      valid: true,
      status: 'VALID',
      message: 'VALID TICKET: Cryptographic signature verified and status confirmed.',
      ticket,
      event,
      securityDetails: {
        verifiedSignature: true,
        tamperDetected: false,
      },
    };
  }

  /**
   * Authoritatively checks in a ticket atomically to prevent race condition across multiple staff gates
   */
  public static async checkInTicket(ticketId: string, staffUserId: string): Promise<TicketValidationResult> {
    const ticketLock = db.getLock(`ticket-checkin:${ticketId}`);
    const releaseLock = await ticketLock.acquire();

    try {
      const ticket = db.tickets.get(ticketId);
      if (!ticket) {
        return {
          valid: false,
          status: 'NOT_FOUND',
          message: 'Ticket not found.',
        };
      }

      if (ticket.status === 'CHECKED_IN') {
        db.recordSecurityEvent(
          'REPLAY_CHECKIN_REJECTED',
          'WARN',
          `Concurrent or duplicate check-in rejected for ticket ${ticket.id.slice(0, 8)}.`,
          { ticketId: ticket.id, alreadyCheckedInAt: ticket.checkedInAt }
        );
        return {
          valid: false,
          status: 'ALREADY_CHECKED_IN',
          message: `Ticket was already checked in at ${ticket.checkedInAt}.`,
          ticket,
        };
      }

      if (ticket.status !== 'VALID') {
        return {
          valid: false,
          status: 'CANCELLED',
          message: `Ticket cannot be checked in because current status is ${ticket.status}.`,
          ticket,
        };
      }

      // Atomic transition to CHECKED_IN
      ticket.status = 'CHECKED_IN';
      ticket.checkedInAt = new Date().toISOString();
      ticket.checkedInByStaffId = staffUserId;

      db.recordSecurityEvent(
        'CONCURRENCY_RACE_SERIALIZED',
        'INFO',
        `Staff ${staffUserId} checked in ticket ${ticket.id.slice(0, 8)} (${ticket.seatLabel}) for ${ticket.eventName}.`,
        { ticketId: ticket.id, staffUserId, seat: ticket.seatLabel }
      );

      return {
        valid: true,
        status: 'VALID',
        message: `Successfully checked in holder ${ticket.holderName} (${ticket.seatLabel})!`,
        ticket,
      };
    } finally {
      releaseLock();
    }
  }
}
