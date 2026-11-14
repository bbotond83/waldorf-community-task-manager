import type { ApplicationResult } from "../application/contracts.ts";
import {
  conflict,
  denied,
  retryableFailure,
  success,
  terminalFailure,
  validation,
} from "../application/results.ts";
import type { DatabaseClient } from "../runtime/database/client.ts";
import type { AdminAccess, AdminFunctionResult } from "./admin-client.ts";
import { generateToken, hashToken, isPlausibleEmail, keyedHash, normalizeEmail } from "./crypto.ts";
import type { EventEmitter } from "./events.ts";
import type { AccountMailer, InvitationMailer } from "./mail.ts";
import { checkPassword } from "./password.ts";
import type { ServiceOutcome, SignInService } from "./service.ts";

/**
 * Changes a signed-in person makes to their own sign-in (BR33, BR34) and the invitation a super admin sends to
 * a parent on record (BR35). Passwords go to the sign-in service only; the database sees addresses, token
 * hashes and keyed address hashes, never a password or a token. The pre-session functions run through the
 * admin access, the signed-in functions as the signed-in account.
 */
export type AccountCaller = Readonly<{
  accessToken: string;
  accountId: string;
  sessionId: string;
  /** The address the account signs in with; the current password is verified against it. */
  email: string;
}>;

export type AccountChangeDeps = Readonly<{
  service: SignInService;
  admin: AdminAccess;
  database: DatabaseClient;
  mailer: AccountMailer;
  invitationMailer: InvitationMailer;
  events: EventEmitter;
  emailKeySecret: string;
  appPublicUrl: string;
  newToken?: () => string;
}>;

export const PASSWORD_CURRENT_WRONG = "PASSWORD_CURRENT_WRONG";
export const PASSWORD_SAME = "PASSWORD_SAME";
export const PASSWORD_INVALID = "PASSWORD_INVALID";
export const PASSWORD_REJECTED = "PASSWORD_REJECTED";
export const PASSWORD_LOCKED = "SIGN_IN_LOCKED";
export const EMAIL_RATE_LIMITED = "EMAIL_RATE_LIMITED";
export const EMAIL_MAIL_NOT_SENT = "EMAIL_MAIL_NOT_SENT";
export const EMAIL_LINK_INVALID = "EMAIL_LINK_INVALID";
export const EMAIL_INVALID = "EMAIL_INVALID";
export const EMAIL_REQUEST_NOT_PENDING = "EMAIL_REQUEST_NOT_PENDING";
export const INVITATION_MAIL_NOT_SENT = "INVITATION_MAIL_NOT_SENT";

const REMOVE_ATTEMPTS = 3;

const retryOf = (key: string, action: string) => ({ idempotencyKey: key, action });

/** Turns a pre-session function's answer into the shared result states; undefined means it succeeded. */
function failureOf<T>(
  outcome: ServiceOutcome<AdminFunctionResult>,
  retry: { idempotencyKey: string; action: string },
): ApplicationResult<T> | undefined {
  if (!outcome.ok) return retryableFailure<T>(retry);
  const { state, code } = outcome.value;
  switch (state) {
    case "success":
      return undefined;
    case "validation":
      return validation<T>({ request: code ?? "VALIDATION_FAILED" }, code ?? undefined);
    case "denied":
      return denied<T>(code ?? undefined);
    case "conflict":
      return conflict<T>(code ?? undefined);
    default:
      return terminalFailure<T>(state === "terminal" ? (code ?? undefined) : "UNEXPECTED_RESPONSE");
  }
}

/**
 * Checks the signed-in person's current password through the sign-in service (BR33.1, BR34.1): a locked address is
 * refused, a wrong password counts towards the sign-in lockout, and the throwaway session the check opens is closed.
 * Returns undefined when the password is right, otherwise the refusal to hand back.
 */
export async function verifyCurrentPassword(
  caller: Pick<AccountCaller, "email" | "accountId">,
  password: string,
  deps: Pick<AccountChangeDeps, "service" | "admin" | "events" | "emailKeySecret">,
  retry: { idempotencyKey: string; action: string },
): Promise<ApplicationResult<never> | undefined> {
  const email = normalizeEmail(caller.email);
  const emailHash = keyedHash(email, deps.emailKeySecret, "email");

  const lockout = await deps.admin.callFunction("sign_in_lockout_check", {
    p_email_hash: emailHash,
  });
  if (!lockout.ok || lockout.value.state !== "success") return retryableFailure(retry);
  if (lockout.value.code === "locked") {
    deps.events.emit("lockout", { account: caller.accountId });
    return denied(PASSWORD_LOCKED);
  }

  const verified = await deps.service.passwordSignIn(email, password);
  if (!verified.ok) {
    if (verified.kind !== "rejected") return retryableFailure(retry);
    await deps.admin.callFunction("sign_in_attempt_record", { p_email_hash: emailHash });
    return validation({ currentPassword: "wrong" }, PASSWORD_CURRENT_WRONG);
  }
  // The check opened a throwaway session of its own; it is closed so no extra sign-in is left behind.
  await deps.service.signOut(verified.value.accessToken);
  return undefined;
}

export type PasswordChangeData = Readonly<{ sessionsEnded: boolean }>;

/**
 * Changing the own password (BR33). The current password is checked first (counting against the sign-in
 * lockout), the sign-in service changes it, every other session ends and the app writes the history row
 * once the service has confirmed. A failed follow-up never undoes the change; it is reported as an event line.
 */
export async function changePassword(
  caller: AccountCaller,
  input: Readonly<{ currentPassword: string; newPassword: string }>,
  deps: AccountChangeDeps,
): Promise<ApplicationResult<PasswordChangeData>> {
  const retry = retryOf("password-change", "identity.password.change");
  const rule = checkPassword(input.newPassword);
  if (!rule.ok) return validation({ newPassword: rule.violation }, PASSWORD_INVALID);
  if (input.newPassword === input.currentPassword) {
    return validation({ newPassword: "same" }, PASSWORD_SAME);
  }
  const email = normalizeEmail(caller.email);
  const emailHash = keyedHash(email, deps.emailKeySecret, "email");
  const checked = await verifyCurrentPassword(caller, input.currentPassword, deps, retry);
  if (checked) return checked as ApplicationResult<PasswordChangeData>;

  const updated = await deps.service.updatePassword(caller.accessToken, input.newPassword);
  if (!updated.ok) {
    return updated.kind === "rejected"
      ? validation({ newPassword: "rejected" }, PASSWORD_REJECTED)
      : retryableFailure(retry);
  }
  await deps.admin.callFunction("sign_in_attempt_clear", {
    p_email_hash: emailHash,
    p_user_id: caller.accountId,
  });

  let removed = false;
  for (let attempt = 0; attempt < REMOVE_ATTEMPTS && !removed; attempt += 1) {
    const result = await deps.admin.callFunction("sessions_remove", {
      p_user_id: caller.accountId,
      p_keep_session_id: caller.sessionId,
    });
    removed = result.ok && result.value.state === "success";
  }
  if (!removed) deps.events.emit("sessions_end_failed", { account: caller.accountId });

  const written = await deps.admin.callFunction("account_password_changed", {
    p_account_id: caller.accountId,
  });
  if (!written.ok || written.value.state !== "success") {
    deps.events.emit("password_change_audit_failed", { account: caller.accountId });
  }
  return success({ sessionsEnded: removed });
}

export type PendingEmailChange = Readonly<{ newEmail: string; expiresAt: string }>;

/** The pending address request of the account, shown to that account only. */
export async function pendingEmailChange(
  caller: Pick<AccountCaller, "accountId">,
  deps: Pick<AccountChangeDeps, "admin">,
): Promise<ApplicationResult<PendingEmailChange | null>> {
  const retry = retryOf("email-pending", "identity.email.pending");
  const result = await deps.admin.callFunction("email_change_pending", {
    p_account_id: caller.accountId,
  });
  const failure = failureOf<PendingEmailChange | null>(result, retry);
  if (failure) return failure;
  if (!result.ok || result.value.code !== "pending") return success(null);
  const fields = result.value.fields;
  return success({
    newEmail: String(fields.new_email ?? ""),
    expiresAt: String(fields.expires_at ?? ""),
  });
}

export const emailChangeLink = (appPublicUrl: string, token: string) =>
  `${appPublicUrl.replace(/\/$/, "")}/email-megerosites/${token}`;

/**
 * Asks for a new sign-in address (BR34). A null address means "Új levél": a fresh link for the address already
 * pending. The database keeps one pending request, refuses an address another record holds and limits accepted
 * sends; the link is emailed only after the database accepted the request.
 */
export async function requestEmailChange(
  caller: Pick<AccountCaller, "accountId">,
  input: Readonly<{ newEmail: string | null; idempotencyKey: string }>,
  deps: AccountChangeDeps,
): Promise<ApplicationResult<{ mailed: boolean }>> {
  const retry = retryOf(input.idempotencyKey, "identity.email.request");
  let address: string;
  if (input.newEmail === null) {
    const pending = await pendingEmailChange(caller, deps);
    if (pending.state !== "success") return pending as ApplicationResult<{ mailed: boolean }>;
    if (!pending.data) return conflict(EMAIL_REQUEST_NOT_PENDING);
    address = pending.data.newEmail;
  } else {
    address = normalizeEmail(input.newEmail);
    if (!isPlausibleEmail(address)) return validation({ email: "invalid" }, EMAIL_INVALID);
  }
  const token = (deps.newToken ?? generateToken)();
  const result = await deps.admin.callFunction("email_change_request", {
    p_idempotency_key: input.idempotencyKey,
    p_account_id: caller.accountId,
    p_new_email: input.newEmail === null ? null : address,
    p_token_hash: hashToken(token),
    p_email_hash: keyedHash(address, deps.emailKeySecret, "email"),
  });
  if (result.ok && result.value.code === EMAIL_RATE_LIMITED) {
    deps.events.emit("email_rate_limited", { account: caller.accountId });
  }
  const failure = failureOf<{ mailed: boolean }>(result, retry);
  if (failure) return failure;
  // A replay of a stored answer has no token to send; the person asks for a new link instead.
  if (result.ok && result.value.code === "replayed") return success({ mailed: false });
  const sent = await deps.mailer.sendEmailChangeLink(
    address,
    emailChangeLink(deps.appPublicUrl, token),
  );
  if (sent.ok) return success({ mailed: true });
  deps.events.emit("email_change_mail_failed", { account: caller.accountId }, "mail_unavailable");
  return retryableFailure(retry, EMAIL_MAIL_NOT_SENT);
}

/**
 * The email request of the "Bejelentkezés" panel (BR34.1): a new address needs the current password, checked first
 * and counted against the lockout; "Új levél" (no new address) repeats a request the person already made and needs
 * none. Only after the check does the database command run, because it is callable by the server alone.
 */
export async function requestEmailChangeChecked(
  caller: AccountCaller,
  input: Readonly<{ newEmail: string | null; currentPassword: string; idempotencyKey: string }>,
  deps: AccountChangeDeps,
): Promise<ApplicationResult<{ mailed: boolean }>> {
  if (input.newEmail !== null) {
    const retry = retryOf(input.idempotencyKey, "identity.email.request");
    const checked = await verifyCurrentPassword(caller, input.currentPassword, deps, retry);
    if (checked) return checked as ApplicationResult<{ mailed: boolean }>;
  }
  return requestEmailChange(caller, input, deps);
}

export async function cancelEmailChange(
  caller: Pick<AccountCaller, "accountId">,
  input: Readonly<{ idempotencyKey: string }>,
  deps: Pick<AccountChangeDeps, "admin">,
): Promise<ApplicationResult<null>> {
  const retry = retryOf(input.idempotencyKey, "identity.email.cancel");
  const result = await deps.admin.callFunction("email_change_cancel", {
    p_idempotency_key: input.idempotencyKey,
    p_account_id: caller.accountId,
  });
  return failureOf<null>(result, retry) ?? success(null);
}

/**
 * Confirms the address from the emailed link (a POST, so a mail scanner opening the link cannot spend it).
 * Every refusal of a link looks alike (EMAIL_LINK_INVALID); the old address gets a notice afterwards.
 */
export async function confirmEmailChange(
  token: string,
  deps: AccountChangeDeps,
): Promise<ApplicationResult<null>> {
  const retry = retryOf("email-confirm", "identity.email.confirm");
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(token)) return terminalFailure(EMAIL_LINK_INVALID);
  const result = await deps.admin.callFunction("email_change_confirm", {
    p_token_hash: hashToken(token),
  });
  const failure = failureOf<null>(result, retry);
  if (failure) return failure;
  const previous = result.ok ? result.value.fields.previous_email : undefined;
  if (typeof previous === "string" && previous) {
    const notice = await deps.mailer.sendEmailChangeNotice(previous);
    if (!notice.ok) deps.events.emit("email_change_mail_failed", {}, "notice_unavailable");
  }
  return success(null);
}

/**
 * A super admin sends the invitation to a parent on record (BR35). The database keeps one open invitation per
 * parent and limits sends; the link goes to the address on record, which the caller read from the same record.
 */
export async function sendParentInvitation(
  caller: Readonly<{ accessToken: string; accountId: string }>,
  input: Readonly<{ parentId: string; email: string; idempotencyKey: string }>,
  deps: AccountChangeDeps,
): Promise<ApplicationResult<{ invitationId: string; mailed: boolean }>> {
  const retry = retryOf(input.idempotencyKey, "identity.invitation.send");
  const email = normalizeEmail(input.email);
  if (!isPlausibleEmail(email)) return validation({ email: "invalid" }, EMAIL_INVALID);
  const token = (deps.newToken ?? generateToken)();
  const result = await deps.database.forSession(caller.accessToken).callOperation(
    "invitation_send",
    {
      p_idempotency_key: input.idempotencyKey,
      p_parent_id: input.parentId,
      p_token_hash: hashToken(token),
      p_email_hash: keyedHash(email, deps.emailKeySecret, "email"),
    },
    retry,
  );
  if (result.state !== "success") {
    if (result.code === EMAIL_RATE_LIMITED) {
      deps.events.emit("email_rate_limited", { account: caller.accountId });
    }
    return result as ApplicationResult<{ invitationId: string; mailed: boolean }>;
  }
  const invitationId = result.data.reference ?? "";
  deps.events.emit("invitation_created", { account: caller.accountId });
  if (result.code === "replayed") return success({ invitationId, mailed: false });
  const sent = await deps.invitationMailer.sendInvitation(
    email,
    `${deps.appPublicUrl.replace(/\/$/, "")}/meghivas/${token}`,
  );
  if (sent.ok) return success({ invitationId, mailed: true });
  deps.events.emit("invitation_mail_failed", {}, "mail_unavailable");
  return {
    ...retryableFailure<{ invitationId: string; mailed: boolean }>(retry, INVITATION_MAIL_NOT_SENT),
    evidenceId: invitationId,
  };
}
