import type { ApplicationResult } from "../application/contracts.ts";
import { success } from "../application/results.ts";
import type { DatabaseClient } from "../runtime/database/client.ts";
import type { AdminAccess } from "./admin-client.ts";
import type { EventEmitter } from "./events.ts";
import type { Caller } from "./invitations.ts";

/**
 * Account changes made by admins and their follow-up calls to the sign-in service (W7; BR2.2, BR2.14,
 * NFR6.3, NFR6.5). The database function applies the change, raises the authorization version and writes
 * the audit event in one transaction; from that moment the database refuses a deactivated account. The
 * server then bans the sign-in user and ends its sessions; if either call fails it is retried and reported,
 * never silently dropped, and the result says the follow-up is still pending.
 */
export type AccountDeps = Readonly<{
  database: DatabaseClient;
  admin: AdminAccess;
  events: EventEmitter;
}>;

export type FollowUp = "done" | "pending";
export type AccountChangeData = Readonly<{ accountId: string; followUp: FollowUp }>;

const FOLLOW_UP_ATTEMPTS = 3;

async function attempt(work: () => Promise<boolean>): Promise<boolean> {
  for (let tries = 0; tries < FOLLOW_UP_ATTEMPTS; tries += 1) {
    try {
      if (await work()) return true;
    } catch {
      // A thrown error is a failed attempt like any other.
    }
  }
  return false;
}

export async function deactivateAccount(
  caller: Caller,
  input: Readonly<{ accountId: string; idempotencyKey: string }>,
  deps: AccountDeps,
): Promise<ApplicationResult<AccountChangeData>> {
  const result = await deps.database
    .forSession(caller.accessToken)
    .callOperation(
      "account_deactivate",
      { p_idempotency_key: input.idempotencyKey, p_account_id: input.accountId },
      { idempotencyKey: input.idempotencyKey, action: "identity.account.deactivate" },
    );
  if (result.state !== "success") return result as ApplicationResult<AccountChangeData>;
  deps.events.emit("deactivation", { account: input.accountId });
  const banned = await attempt(async () => (await deps.admin.setBan(input.accountId, true)).ok);
  const ended = await attempt(async () => {
    const removed = await deps.admin.callFunction("sessions_remove", {
      p_user_id: input.accountId,
    });
    return removed.ok && removed.value.state === "success";
  });
  const done = banned && ended;
  if (!done) deps.events.emit("follow_up_failed", { account: input.accountId }, "deactivation");
  return success({ accountId: input.accountId, followUp: done ? "done" : "pending" });
}

export async function reactivateAccount(
  caller: Caller,
  input: Readonly<{ accountId: string; idempotencyKey: string }>,
  deps: AccountDeps,
): Promise<ApplicationResult<AccountChangeData>> {
  const result = await deps.database
    .forSession(caller.accessToken)
    .callOperation(
      "account_reactivate",
      { p_idempotency_key: input.idempotencyKey, p_account_id: input.accountId },
      { idempotencyKey: input.idempotencyKey, action: "identity.account.reactivate" },
    );
  if (result.state !== "success") return result as ApplicationResult<AccountChangeData>;
  deps.events.emit("reactivation", { account: input.accountId });
  const unbanned = await attempt(async () => (await deps.admin.setBan(input.accountId, false)).ok);
  if (!unbanned) deps.events.emit("follow_up_failed", { account: input.accountId }, "reactivation");
  return success({ accountId: input.accountId, followUp: unbanned ? "done" : "pending" });
}

export async function changeGrant(
  caller: Caller,
  input: Readonly<{
    change: "add" | "revoke";
    subjectId: string;
    role: string;
    scopeType: string;
    scopeId: string;
    idempotencyKey: string;
  }>,
  deps: Pick<AccountDeps, "database" | "events">,
): Promise<ApplicationResult<{ subjectId: string }>> {
  const result = await deps.database.forSession(caller.accessToken).callOperation(
    "grant_change",
    {
      p_idempotency_key: input.idempotencyKey,
      p_change: input.change,
      p_subject_id: input.subjectId,
      p_role: input.role,
      p_scope_type: input.scopeType,
      p_scope_id: input.scopeId,
    },
    { idempotencyKey: input.idempotencyKey, action: `identity.grant.${input.change}` },
  );
  if (result.state !== "success") return result as ApplicationResult<{ subjectId: string }>;
  deps.events.emit("grant_change", { account: input.subjectId }, input.change);
  return success({ subjectId: input.subjectId });
}
