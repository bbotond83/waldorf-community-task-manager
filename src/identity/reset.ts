import type { ApplicationResult } from "../application/contracts.ts";
import {
  denied,
  retryableFailure,
  success,
  terminalFailure,
  validation,
} from "../application/results.ts";
import type { AdminAccess } from "./admin-client.ts";
import type { TokenPair } from "./cookies.ts";
import { isPlausibleEmail, keyedHash, normalizeEmail } from "./crypto.ts";
import type { EventEmitter } from "./events.ts";
import { checkPassword } from "./password.ts";
import type { SignInService } from "./service.ts";

/**
 * Password reset (W6; BR2.4, BR2.12, NFR1.22). Requesting a reset always gives the same answer and sends
 * mail only for a known active account. Opening the emailed link only shows a page; the single-use code is
 * exchanged when the person submits the new password (a POST), so a mail scanner that opens the link cannot
 * spend it. After the change every other session of the account ends and the sign-in attempts are cleared.
 */
export type ResetDeps = Readonly<{
  service: SignInService;
  admin: AdminAccess;
  events: EventEmitter;
  emailKeySecret: string;
  /**
   * Runs the check and the mail after the answer was given (Next.js `after`), so the response time does not
   * depend on whether the address has an account. Without it the work is awaited (tests).
   */
  defer?: (task: () => Promise<void>) => void;
}>;

export const RESET_NOT_VALID = "RESET_NOT_VALID";
export const PASSWORD_RULE = "PASSWORD_RULE";
export const PASSWORD_REJECTED = "PASSWORD_REJECTED";
/** The one-time link was exchanged but the password was not changed (the service was unavailable or limiting). */
export const RESET_LINK_SPENT = "RESET_LINK_SPENT";
/** The password was changed, but the person's other sign-ins could not be ended. */
export const RESET_SESSIONS_NOT_ENDED = "RESET_SESSIONS_NOT_ENDED";
const RETRY = { idempotencyKey: "reset", action: "identity.reset" } as const;

/** Always succeeds from the person's point of view, whatever the address is (BR2.12). */
export async function requestPasswordReset(
  rawEmail: string,
  deps: ResetDeps,
): Promise<ApplicationResult<null>> {
  const email = normalizeEmail(rawEmail);
  if (!isPlausibleEmail(email)) return success(null);
  const work = async () => {
    try {
      const check = await deps.admin.callFunction("account_recovery_check", { p_email: email });
      if (check.ok && check.value.state === "success" && check.value.code === "active") {
        const sent = await deps.service.requestRecovery(email);
        deps.events.emit("reset_requested", { address: email }, sent.ok ? "sent" : "send_failed");
      } else {
        deps.events.emit("reset_requested", { address: email }, "not_sent");
      }
    } catch {
      deps.events.emit("reset_requested", { address: email }, "error");
    }
  };
  if (deps.defer) deps.defer(work);
  else await work();
  return success(null);
}

export type ResetInput = Readonly<{ tokenHash: string; password: string }>;
export type ResetData = Readonly<{ tokens: TokenPair; accountId: string }>;

const REMOVE_ATTEMPTS = 3;

export async function completePasswordReset(
  input: ResetInput,
  deps: ResetDeps,
): Promise<ApplicationResult<ResetData>> {
  // The rule is checked before the code is exchanged, so a rejected password never spends the link.
  const rule = checkPassword(input.password);
  if (!rule.ok) return validation({ password: rule.violation }, PASSWORD_RULE);
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(input.tokenHash)) return denied(RESET_NOT_VALID);

  const verified = await deps.service.verifyRecovery(input.tokenHash);
  if (!verified.ok) {
    return verified.kind === "rejected" ? denied(RESET_NOT_VALID) : retryableFailure(RETRY);
  }
  const session = verified.value;

  const updated = await deps.service.updatePassword(session.accessToken, input.password);
  if (!updated.ok) {
    await deps.service.signOut(session.accessToken);
    // The one-time link is spent once it was exchanged, so a password the sign-in service refuses (the same
    // as before, or one of its own rules) needs a new link. The screen says so instead of showing the rule.
    // An unavailable or rate-limiting service is no different for the person: the link is spent and the
    // password is unchanged, so resubmitting the same link would only say "not valid". Say so (code review).
    return updated.kind === "rejected"
      ? validation({ password: "rejected" }, PASSWORD_REJECTED)
      : terminalFailure(RESET_LINK_SPENT);
  }

  // Every other session of the account ends (BR2.12); the person's new session stays.
  let removed = false;
  for (let attempt = 0; attempt < REMOVE_ATTEMPTS && !removed; attempt += 1) {
    const result = await deps.admin.callFunction("sessions_remove", {
      p_user_id: session.userId,
      p_keep_session_id: session.sessionId,
    });
    removed = result.ok && result.value.state === "success";
  }
  if (!removed) {
    deps.events.emit("follow_up_failed", { account: session.userId }, "sessions_remove");
    await deps.service.signOut(session.accessToken);
    // The password has changed, so the same link cannot be used again: tell the person to sign in instead.
    return terminalFailure(RESET_SESSIONS_NOT_ENDED);
  }
  await deps.admin.callFunction("sign_in_attempt_clear", {
    p_email_hash: keyedHash(normalizeEmail(session.email), deps.emailKeySecret, "email"),
    p_user_id: session.userId,
  });
  deps.events.emit("reset_used", { account: session.userId });
  return success({
    accountId: session.userId,
    tokens: { accessToken: session.accessToken, refreshToken: session.refreshToken },
  });
}
