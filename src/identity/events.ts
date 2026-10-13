import { keyedHash } from "./crypto.ts";

/**
 * One structured line per security event (NFR1.17, NFR1.18): an event code, a timestamp and a keyed hash
 * of the account (or of the address when no account is known). Never an address, password, token, link
 * or session value. The lines are normal server output; no files, dashboards or alerts (NFR1.21).
 */
export type SecurityEventCode =
  | "sign_in_success"
  | "sign_in_failure"
  | "lockout"
  | "sign_out"
  | "invitation_created"
  | "invitation_resent"
  | "invitation_revoked"
  | "invitation_accepted"
  | "invitation_expired"
  | "invitation_mail_failed"
  | "reset_requested"
  | "reset_used"
  | "grant_change"
  | "deactivation"
  | "reactivation"
  | "follow_up_failed"
  | "housekeeping_done"
  | "housekeeping_failed";

export type EventSubject = { account: string } | { address: string } | Record<string, never>;

export interface EventEmitter {
  emit(event: SecurityEventCode, subject?: EventSubject, code?: string): void;
}

export type EventSink = (line: string) => void;

export function createEventEmitter(options: {
  secret: string;
  sink?: EventSink;
  now?: () => number;
}): EventEmitter {
  const sink = options.sink ?? ((line: string) => console.log(line));
  const now = options.now ?? (() => Date.now());
  return {
    emit(event, subject = {}, code) {
      const record: Record<string, string> = {
        event,
        at: new Date(now()).toISOString(),
      };
      if ("account" in subject && subject.account) {
        record.subject = keyedHash(subject.account, options.secret, "account");
      } else if ("address" in subject && subject.address) {
        record.subject = keyedHash(subject.address.trim().toLowerCase(), options.secret, "email");
      }
      if (code) record.code = code;
      sink(JSON.stringify(record));
    },
  };
}
