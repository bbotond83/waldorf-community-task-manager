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
import type { AdminAccess } from "./admin-client.ts";
import type { TokenPair } from "./cookies.ts";
import { generateToken, hashToken, isPlausibleEmail, normalizeEmail } from "./crypto.ts";
import type { EventEmitter } from "./events.ts";
import type { InvitationMailer } from "./mail.ts";
import { checkPassword } from "./password.ts";
import type { SignInService } from "./service.ts";

/**
 * Invitations (W4, W5; BR2.9, BR2.10, BR2.11, NFR6.2, NFR6.8). Creating, resending and revoking run as the
 * signed-in admin (the database checks reach, writes the denied event and keeps the one open invitation);
 * the pre-session steps run through the admin access. A token exists only in the emailed link: the database
 * receives its SHA-256 hash.
 */
export type InvitationDeps = Readonly<{
  service: SignInService;
  admin: AdminAccess;
  database: DatabaseClient;
  mailer: InvitationMailer;
  events: EventEmitter;
  appPublicUrl: string;
  newToken?: () => string;
}>;

export type Caller = Readonly<{ accessToken: string; accountId: string }>;

export type InvitationInput = Readonly<{
  email: string;
  role: string;
  scopeType: string;
  scopeId: string;
  targetId?: string | null;
  idempotencyKey: string;
}>;

export const INVITATION_NOT_VALID = "INVITATION_NOT_VALID";
export const INVITATION_BUSY = "INVITATION_BUSY";
export const INVITATION_MAIL_NOT_SENT = "INVITATION_MAIL_NOT_SENT";
export const PASSWORD_RULE = "PASSWORD_RULE";

export const invitationLink = (appPublicUrl: string, token: string) =>
  `${appPublicUrl.replace(/\/$/, "")}/meghivas/${token}`;

type MailResult = ApplicationResult<{ invitationId: string; mailed: boolean }>;

/** Sends the invitation email; a failure keeps the stored invitation and reports a retryable result. */
async function deliver(
  deps: InvitationDeps,
  to: string,
  token: string,
  invitationId: string,
  retry: { idempotencyKey: string; action: string },
): Promise<MailResult> {
  const sent = await deps.mailer.sendInvitation(to, invitationLink(deps.appPublicUrl, token));
  if (sent.ok) return success({ invitationId, mailed: true });
  deps.events.emit("invitation_mail_failed", {}, "mail_unavailable");
  return {
    ...retryableFailure<{ invitationId: string; mailed: boolean }>(retry, INVITATION_MAIL_NOT_SENT),
    evidenceId: invitationId,
  };
}

export async function createInvitation(
  caller: Caller,
  input: InvitationInput,
  deps: InvitationDeps,
): Promise<MailResult> {
  const email = normalizeEmail(input.email);
  const retry = { idempotencyKey: input.idempotencyKey, action: "identity.invitation.create" };
  if (!isPlausibleEmail(email)) return validation({ email: "invalid" }, "EMAIL_INVALID");
  const token = (deps.newToken ?? generateToken)();
  const result = await deps.database.forSession(caller.accessToken).callOperation(
    "invitation_create",
    {
      p_idempotency_key: input.idempotencyKey,
      p_email: email,
      p_role: input.role,
      p_scope_type: input.scopeType,
      p_scope_id: input.scopeId,
      p_token_hash: hashToken(token),
      p_target_id: input.targetId ?? null,
    },
    retry,
  );
  if (result.state !== "success") return result as MailResult;
  const invitationId = result.data.reference ?? "";
  deps.events.emit("invitation_created", { account: caller.accountId });
  // A replay of a stored result has no token to send: the admin resends instead.
  if (result.code === "replayed") return success({ invitationId, mailed: false });
  return deliver(deps, email, token, invitationId, retry);
}

export async function resendInvitation(
  caller: Caller,
  input: Readonly<{ invitationId: string; email: string; idempotencyKey: string }>,
  deps: InvitationDeps,
): Promise<MailResult> {
  const retry = { idempotencyKey: input.idempotencyKey, action: "identity.invitation.resend" };
  const token = (deps.newToken ?? generateToken)();
  const result = await deps.database.forSession(caller.accessToken).callOperation(
    "invitation_resend",
    {
      p_idempotency_key: input.idempotencyKey,
      p_invitation_id: input.invitationId,
      p_new_token_hash: hashToken(token),
    },
    retry,
  );
  if (result.state !== "success") return result as MailResult;
  deps.events.emit("invitation_resent", { account: caller.accountId });
  if (result.code === "replayed")
    return success({ invitationId: result.data.reference ?? "", mailed: false });
  return deliver(deps, normalizeEmail(input.email), token, result.data.reference ?? "", retry);
}

export async function revokeInvitation(
  caller: Caller,
  input: Readonly<{ invitationId: string; idempotencyKey: string }>,
  deps: Pick<InvitationDeps, "database" | "events">,
): Promise<ApplicationResult<{ invitationId: string }>> {
  const result = await deps.database
    .forSession(caller.accessToken)
    .callOperation(
      "invitation_revoke",
      { p_idempotency_key: input.idempotencyKey, p_invitation_id: input.invitationId },
      { idempotencyKey: input.idempotencyKey, action: "identity.invitation.revoke" },
    );
  if (result.state !== "success") return result as ApplicationResult<{ invitationId: string }>;
  deps.events.emit("invitation_revoked", { account: caller.accountId });
  return success({ invitationId: result.data.reference ?? input.invitationId });
}

export type InvitationView =
  | Readonly<{ validity: "valid"; role: string; scopeType: string }>
  | Readonly<{ validity: "expired" | "not_valid" }>
  | Readonly<{ validity: "unavailable" }>;

/** The pre-session lookup: only the role, the kind of scope and the validity (BR2.10). */
export async function lookupInvitation(
  token: string,
  deps: Pick<InvitationDeps, "admin" | "events">,
): Promise<InvitationView> {
  const result = await deps.admin.callFunction("invitation_lookup", {
    p_token_hash: hashToken(token),
  });
  if (!result.ok || result.value.state !== "success") {
    return result.ok && result.value.state === "validation"
      ? { validity: "not_valid" }
      : { validity: "unavailable" };
  }
  const { code, fields } = result.value;
  if (code === "valid") {
    return {
      validity: "valid",
      role: String(fields.role ?? ""),
      scopeType: String(fields.scope_type ?? ""),
    };
  }
  if (code === "expired") {
    deps.events.emit("invitation_expired", {}, "opened");
    return { validity: "expired" };
  }
  return { validity: "not_valid" };
}

export type AcceptInput = Readonly<{ token: string; password: string; idempotencyKey: string }>;
export type AcceptData = Readonly<{ accountId: string; tokens?: TokenPair }>;

/**
 * Accept (W5): reserve, create or reuse the sign-in user, then one transaction creates the Account and the
 * grant. When anything after the reservation fails the reservation is released and the user is deleted only
 * when a successful answer proves that no Account exists for it (see `compensate`); otherwise it stays.
 */
export async function acceptInvitation(
  input: AcceptInput,
  deps: InvitationDeps,
): Promise<ApplicationResult<AcceptData>> {
  const retry = { idempotencyKey: input.idempotencyKey, action: "identity.invitation.accept" };
  const rule = checkPassword(input.password);
  if (!rule.ok) return validation({ password: rule.violation }, PASSWORD_RULE);

  const tokenHash = hashToken(input.token);
  const reserved = await deps.admin.callFunction("invitation_reserve", {
    p_idempotency_key: input.idempotencyKey,
    p_token_hash: tokenHash,
  });
  if (!reserved.ok) return retryableFailure(retry);
  const reservation = reserved.value;

  if (reservation.state === "success" && reservation.code === "replayed") {
    // The first submit already succeeded; the person signs in with the password they chose.
    return success({ accountId: reservation.reference ?? "" });
  }
  if (reservation.state === "validation") {
    if (reservation.code === "invitation_expired")
      deps.events.emit("invitation_expired", {}, "submitted");
    return denied(INVITATION_NOT_VALID);
  }
  if (reservation.state === "conflict") {
    return reservation.code === "invitation_reserved"
      ? retryableFailure(retry, INVITATION_BUSY)
      : conflict(reservation.code ?? undefined);
  }
  if (reservation.state !== "success" || !reservation.reference)
    return terminalFailure("INVITATION_RESERVE_FAILED");

  const invitationId = reservation.reference;
  const email = String(reservation.fields.email ?? "");
  const orphan =
    typeof reservation.fields.orphan_user_id === "string"
      ? reservation.fields.orphan_user_id
      : undefined;

  // The reservation time identifies this submit's reservation: only that one can be released.
  const reservedAt = String(reservation.fields.reserved_at ?? "");
  const release = () =>
    deps.admin.callFunction("invitation_release", {
      p_invitation_id: invitationId,
      p_reserved_at: reservedAt,
    });

  // The sign-in user: reuse a leftover of an earlier failed attempt, or create one tagged with the invitation.
  let userId: string;
  if (orphan) {
    const updated = await deps.admin.setPassword(orphan, input.password);
    if (!updated.ok) {
      await release();
      return updated.kind === "unavailable"
        ? retryableFailure(retry)
        : denied(INVITATION_NOT_VALID);
    }
    userId = orphan;
  } else {
    const created = await deps.admin.createUser({ email, password: input.password, invitationId });
    if (!created.ok) {
      await release();
      if (created.kind === "unavailable") return retryableFailure(retry);
      return created.code === "weak_password"
        ? validation({ password: "rejected" }, PASSWORD_RULE)
        : denied(INVITATION_NOT_VALID);
    }
    userId = created.value.id;
  }

  /**
   * After a failed or unanswered acceptance. The new sign-in user is deleted ONLY when a successful answer
   * proves that no Account exists for it: the release of this submit's own reservation succeeded, which means
   * the invitation was still reserved, so the acceptance transaction never committed. Any other answer
   * (unavailable, not the holder, unknown) keeps the user: housekeeping removes it later if it stays without an
   * Account, and the next submit reuses it.
   */
  const compensate = async (): Promise<"accepted" | "removed" | "kept"> => {
    const released = await release();
    if (released.ok && released.value.state === "success" && released.value.code === "released") {
      const removed = await deps.admin.deleteUser(userId);
      if (!removed.ok) deps.events.emit("follow_up_failed", {}, "delete_user");
      return "removed";
    }
    // Not proven. Did the transaction commit although the answer was lost? The invitation says so.
    const state = await deps.admin.callFunction("invitation_lookup", { p_token_hash: tokenHash });
    if (state.ok && state.value.state === "success" && state.value.code === "not_valid") {
      return "accepted";
    }
    deps.events.emit("follow_up_failed", {}, "delete_user_unproven");
    return "kept";
  };

  const accepted = await deps.admin.callFunction("invitation_accept", {
    p_idempotency_key: input.idempotencyKey,
    p_invitation_id: invitationId,
    p_account_id: userId,
  });
  if (!accepted.ok || accepted.value.state !== "success") {
    const outcome = await compensate();
    if (outcome !== "accepted") {
      if (accepted.ok && accepted.value.state === "validation") return denied(INVITATION_NOT_VALID);
      if (accepted.ok && accepted.value.state === "conflict") return denied(INVITATION_NOT_VALID);
      return retryableFailure(retry);
    }
  }

  deps.events.emit("invitation_accepted", { account: userId });
  const session = await deps.service.passwordSignIn(email, input.password);
  if (!session.ok) return success({ accountId: userId });
  return success({
    accountId: userId,
    tokens: { accessToken: session.value.accessToken, refreshToken: session.value.refreshToken },
  });
}
