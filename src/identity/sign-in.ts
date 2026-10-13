import type { ApplicationResult } from "../application/contracts.ts";
import { denied, retryableFailure, success, validation } from "../application/results.ts";
import type { DatabaseClient } from "../runtime/database/client.ts";
import type { AdminAccess } from "./admin-client.ts";
import type { TokenPair } from "./cookies.ts";
import { isPlausibleEmail, keyedHash, normalizeEmail } from "./crypto.ts";
import type { EventEmitter } from "./events.ts";
import type { SignInService } from "./service.ts";

/**
 * Sign-in (W1; BR2.1, BR2.2, BR2.3, NFR1.22). One generic answer for every failure: wrong data, unknown
 * address and deactivated account look alike; a locked address is told to try later, and that answer is the
 * same for unknown addresses. The lockout is advisory and covers this screen only.
 */
export type SignInInput = Readonly<{ email: string; password: string }>;
export type SignInData = Readonly<TokenPair & { accountId: string }>;

export const SIGN_IN_INVALID = "SIGN_IN_INVALID";
export const SIGN_IN_LOCKED = "SIGN_IN_LOCKED";

export type SignInDeps = Readonly<{
  service: SignInService;
  admin: AdminAccess;
  database: DatabaseClient;
  events: EventEmitter;
  emailKeySecret: string;
  now: () => number;
  /** Runs the housekeeping function in the background once an hour at most (BR2.21). */
  housekeeping?: () => Promise<void>;
}>;

const RETRY = { idempotencyKey: "sign-in", action: "identity.sign_in" } as const;

async function maybeHousekeep(deps: SignInDeps, state: { lastRun: number }): Promise<void> {
  if (!deps.housekeeping) return;
  const now = deps.now();
  if (now - state.lastRun < 60 * 60 * 1000) return;
  state.lastRun = now;
  try {
    await deps.housekeeping();
  } catch {
    // Leftovers never block a person (BR2.21); the failure is reported by the housekeeping itself.
  }
}

const housekeepingState = { lastRun: 0 };

export function resetHousekeepingClockForTests(): void {
  housekeepingState.lastRun = 0;
}

export async function signIn(
  input: SignInInput,
  deps: SignInDeps,
): Promise<ApplicationResult<SignInData>> {
  const email = normalizeEmail(input.email);
  if (!isPlausibleEmail(email) || input.password.length === 0) {
    // Malformed input is answered like a wrong password and costs no call (nothing to lock either).
    deps.events.emit("sign_in_failure", { address: email }, "malformed");
    return denied<SignInData>(SIGN_IN_INVALID);
  }
  const emailHash = keyedHash(email, deps.emailKeySecret, "email");

  const lockout = await deps.admin.callFunction("sign_in_lockout_check", {
    p_email_hash: emailHash,
  });
  if (!lockout.ok || lockout.value.state !== "success") {
    return retryableFailure<SignInData>(RETRY);
  }
  if (lockout.value.code === "locked") {
    deps.events.emit("lockout", { address: email });
    return denied<SignInData>(SIGN_IN_LOCKED);
  }

  const outcome = await deps.service.passwordSignIn(email, input.password);
  if (!outcome.ok && outcome.kind === "unavailable") return retryableFailure<SignInData>(RETRY);

  const recordFailure = async (code: string): Promise<ApplicationResult<SignInData>> => {
    deps.events.emit("sign_in_failure", { address: email }, code);
    await deps.admin.callFunction("sign_in_attempt_record", { p_email_hash: emailHash });
    return denied<SignInData>(SIGN_IN_INVALID);
  };

  if (!outcome.ok) return recordFailure("rejected");

  // The database refuses a deactivated account even if the sign-in service still issued a session
  // (for example when its ban call failed): end that session and answer like a wrong password (BR2.2).
  const active = await deps.database
    .forSession(outcome.value.accessToken)
    .read<boolean>((client) => client.rpc("current_session_is_active") as never, RETRY);
  if (active.state === "dependency-failure-retryable") {
    await deps.service.signOut(outcome.value.accessToken);
    return retryableFailure<SignInData>(RETRY);
  }
  if (active.state !== "success" || active.data !== true) {
    await deps.service.signOut(outcome.value.accessToken);
    return recordFailure("inactive");
  }

  await deps.admin.callFunction("sign_in_attempt_clear", {
    p_email_hash: emailHash,
    p_user_id: outcome.value.userId,
  });
  deps.events.emit("sign_in_success", { account: outcome.value.userId });
  await maybeHousekeep(deps, housekeepingState);
  return success({
    accessToken: outcome.value.accessToken,
    refreshToken: outcome.value.refreshToken,
    accountId: outcome.value.userId,
  });
}

/** Field validation shown on screen before submit; the server answers the same way for the rest. */
export function validateSignInForm(input: SignInInput): ApplicationResult<never> | undefined {
  const errors: Record<string, string> = {};
  if (!normalizeEmail(input.email)) errors.email = "required";
  if (!input.password) errors.password = "required";
  return Object.keys(errors).length > 0 ? validation(errors) : undefined;
}
