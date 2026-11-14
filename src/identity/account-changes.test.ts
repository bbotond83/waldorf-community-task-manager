import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { conflict } from "../application/results.ts";
import {
  ACCOUNT_ID,
  SESSION_ID,
  envelope,
  fakeAdmin,
  fakeDatabase,
  fakeMailer,
  fakeService,
  ok,
  recordingEvents,
  rejected,
  unavailable,
  type AdminHandlers,
} from "../../tests/support/identity-fakes.ts";
import {
  cancelEmailChange,
  changePassword,
  confirmEmailChange,
  EMAIL_LINK_INVALID,
  EMAIL_MAIL_NOT_SENT,
  EMAIL_RATE_LIMITED,
  EMAIL_REQUEST_NOT_PENDING,
  INVITATION_MAIL_NOT_SENT,
  pendingEmailChange,
  PASSWORD_CURRENT_WRONG,
  PASSWORD_INVALID,
  PASSWORD_REJECTED,
  PASSWORD_SAME,
  requestEmailChange,
  requestEmailChangeChecked,
  sendParentInvitation,
  type AccountChangeDeps,
} from "./account-changes.ts";
import { hashToken, keyedHash } from "./crypto.ts";
import type { AccountMailer } from "./mail.ts";

const TOKEN = "T".repeat(43);
const SECRET = "test-email-key-secret-0123456789";
const caller = {
  accessToken: "caller-access-token",
  accountId: ACCOUNT_ID,
  sessionId: SESSION_ID,
  email: "person@example.test",
};
const OLD = "correct horse battery staple 42";
const NEW = "another long passphrase 2026!";

function fakeAccountMailer(fail = false) {
  const links: { to: string; link: string }[] = [];
  const notices: string[] = [];
  const mailer: AccountMailer = {
    async sendEmailChangeLink(to, link) {
      if (fail) return { ok: false, reason: "mail_unavailable" };
      links.push({ to, link });
      return { ok: true };
    },
    async sendEmailChangeNotice(to) {
      if (fail) return { ok: false, reason: "mail_unavailable" };
      notices.push(to);
      return { ok: true };
    },
  };
  return { mailer, links, notices };
}

function setup(
  options: {
    handlers?: AdminHandlers;
    service?: Parameters<typeof fakeService>[0];
    mailFails?: boolean;
    operation?: Parameters<typeof fakeDatabase>[0] extends infer O
      ? O extends { operation?: infer F }
        ? F
        : never
      : never;
  } = {},
) {
  const admin = fakeAdmin(options.handlers);
  const service = fakeService(options.service);
  const database = fakeDatabase({ operation: options.operation });
  const events = recordingEvents();
  const account = fakeAccountMailer(options.mailFails);
  const invitationMailer = fakeMailer(options.mailFails);
  const deps: AccountChangeDeps = {
    service,
    admin,
    database,
    mailer: account.mailer,
    invitationMailer,
    events,
    emailKeySecret: SECRET,
    appPublicUrl: "http://127.0.0.1:3000/",
    newToken: () => TOKEN,
  };
  return { deps, admin, service, database, events, account, invitationMailer };
}

const names = (calls: { name: string }[]) => calls.map((call) => call.name);

describe("changing the own password (BR33)", () => {
  it("verifies the current password, changes it, ends the other sessions and writes the history row last", async () => {
    const { deps, admin, service, events } = setup();
    const result = await changePassword(caller, { currentPassword: OLD, newPassword: NEW }, deps);
    assert.equal(result.state, "success");
    assert.deepEqual(names(service.calls), ["passwordSignIn", "signOut", "updatePassword"]);
    assert.equal(service.calls[2]!.args[0], caller.accessToken);
    assert.deepEqual(names(admin.calls), [
      "sign_in_lockout_check",
      "sign_in_attempt_clear",
      "sessions_remove",
      "account_password_changed",
    ]);
    assert.deepEqual(admin.calls[2]!.args[0], {
      p_user_id: ACCOUNT_ID,
      p_keep_session_id: SESSION_ID,
    });
    assert.equal(events.events.length, 0);
  });

  it("refuses a weak or unchanged new password before any call", async () => {
    const { deps, admin, service } = setup();
    const weak = await changePassword(caller, { currentPassword: OLD, newPassword: "short" }, deps);
    assert.equal(weak.state, "validation");
    assert.equal(weak.code, PASSWORD_INVALID);
    const same = await changePassword(caller, { currentPassword: OLD, newPassword: OLD }, deps);
    assert.equal(same.code, PASSWORD_SAME);
    assert.equal(admin.calls.length + service.calls.length, 0);
  });

  it("answers a wrong current password and counts the attempt", async () => {
    const { deps, admin, service } = setup({
      service: { passwordSignIn: async () => rejected("invalid_credentials") },
    });
    const result = await changePassword(caller, { currentPassword: OLD, newPassword: NEW }, deps);
    assert.equal(result.state, "validation");
    assert.equal(result.code, PASSWORD_CURRENT_WRONG);
    assert.ok(names(admin.calls).includes("sign_in_attempt_record"));
    assert.equal(names(service.calls).includes("updatePassword"), false);
  });

  it("is refused while the address is locked, without calling the sign-in service", async () => {
    const { deps, service, events } = setup({
      handlers: { sign_in_lockout_check: () => envelope("success", "locked") },
    });
    const result = await changePassword(caller, { currentPassword: OLD, newPassword: NEW }, deps);
    assert.equal(result.state, "denied");
    assert.equal(service.calls.length, 0);
    assert.equal(events.events[0]!.event, "lockout");
  });

  it("is retryable when the lockout check or the sign-in service is unavailable", async () => {
    const a = setup({ handlers: {} });
    a.admin.callFunction = async () => unavailable;
    const first = await changePassword(
      caller,
      { currentPassword: OLD, newPassword: NEW },
      { ...a.deps, admin: a.admin },
    );
    assert.equal(first.state, "dependency-failure-retryable");
    const b = setup({ service: { passwordSignIn: async () => unavailable } });
    const second = await changePassword(caller, { currentPassword: OLD, newPassword: NEW }, b.deps);
    assert.equal(second.state, "dependency-failure-retryable");
    assert.equal(names(b.service.calls).includes("updatePassword"), false);
  });

  it("reports a password the service refuses and a service that is down", async () => {
    const refused = setup({ service: { updatePassword: async () => rejected("weak_password") } });
    const first = await changePassword(
      caller,
      { currentPassword: OLD, newPassword: NEW },
      refused.deps,
    );
    assert.equal(first.code, PASSWORD_REJECTED);
    assert.equal(names(refused.admin.calls).includes("sessions_remove"), false);
    const down = setup({ service: { updatePassword: async () => unavailable } });
    const second = await changePassword(
      caller,
      { currentPassword: OLD, newPassword: NEW },
      down.deps,
    );
    assert.equal(second.state, "dependency-failure-retryable");
  });

  it("keeps the change when ending the sessions fails, retrying three times and emitting one line", async () => {
    const { deps, admin, events } = setup({
      handlers: { sessions_remove: () => envelope("terminal", "failed") },
    });
    const result = await changePassword(caller, { currentPassword: OLD, newPassword: NEW }, deps);
    assert.equal(result.state, "success");
    assert.deepEqual(result.state === "success" && result.data, { sessionsEnded: false });
    assert.equal(names(admin.calls).filter((name) => name === "sessions_remove").length, 3);
    assert.deepEqual(
      events.events.map((entry) => entry.event),
      ["sessions_end_failed"],
    );
    assert.ok(names(admin.calls).includes("account_password_changed"));
  });

  it("keeps the change when the history row cannot be written and emits its own line", async () => {
    const { deps, events } = setup({
      handlers: { account_password_changed: () => envelope("terminal", "failed") },
    });
    const result = await changePassword(caller, { currentPassword: OLD, newPassword: NEW }, deps);
    assert.equal(result.state, "success");
    assert.deepEqual(
      events.events.map((entry) => entry.event),
      ["password_change_audit_failed"],
    );
  });
});

describe("asking for a new address (BR34)", () => {
  const input = { newEmail: " New@Example.test ", idempotencyKey: "key-1" };

  it("sends only hashes to the database and the link by email", async () => {
    const { deps, admin, account } = setup();
    const result = await requestEmailChange(caller, input, deps);
    assert.equal(result.state, "success");
    const args = admin.calls[0]!.args[0] as Record<string, unknown>;
    assert.equal(admin.calls[0]!.name, "email_change_request");
    assert.equal(args.p_new_email, "new@example.test");
    assert.equal(args.p_token_hash, hashToken(TOKEN));
    assert.equal(args.p_email_hash, keyedHash("new@example.test", SECRET, "email"));
    assert.equal(JSON.stringify(admin.calls).includes(TOKEN), false);
    assert.deepEqual(account.links, [
      { to: "new@example.test", link: `http://127.0.0.1:3000/email-megerosites/${TOKEN}` },
    ]);
  });

  it("refuses an implausible address without a call", async () => {
    const { deps, admin } = setup();
    const result = await requestEmailChange(
      caller,
      { newEmail: "nope", idempotencyKey: "key-1" },
      deps,
    );
    assert.equal(result.state, "validation");
    assert.equal(admin.calls.length, 0);
  });

  it("sends no mail when the database refuses, and says so for the send limit", async () => {
    const taken = setup({
      handlers: { email_change_request: () => envelope("validation", "EMAIL_UNAVAILABLE") },
    });
    const first = await requestEmailChange(caller, input, taken.deps);
    assert.equal(first.state, "validation");
    assert.equal(first.code, "EMAIL_UNAVAILABLE");
    assert.equal(taken.account.links.length, 0);
    const limited = setup({
      handlers: { email_change_request: () => envelope("conflict", EMAIL_RATE_LIMITED) },
    });
    const second = await requestEmailChange(caller, input, limited.deps);
    assert.equal(second.state, "conflict");
    assert.equal(second.code, EMAIL_RATE_LIMITED);
    assert.deepEqual(
      limited.events.events.map((entry) => entry.event),
      ["email_rate_limited"],
    );
    assert.equal(limited.account.links.length, 0);
  });

  it("keeps the request and reports a retryable result when the mail cannot be sent", async () => {
    const { deps, events } = setup({ mailFails: true });
    const result = await requestEmailChange(caller, input, deps);
    assert.equal(result.state, "dependency-failure-retryable");
    assert.equal(result.code, EMAIL_MAIL_NOT_SENT);
    assert.deepEqual(
      events.events.map((entry) => entry.event),
      ["email_change_mail_failed"],
    );
  });

  it("sends no second mail for a replayed answer", async () => {
    const { deps, account } = setup({
      handlers: { email_change_request: () => envelope("success", "replayed") },
    });
    const result = await requestEmailChange(caller, input, deps);
    assert.deepEqual(result.state === "success" && result.data, { mailed: false });
    assert.equal(account.links.length, 0);
  });

  it("'new mail' reads the pending address first and asks the database with no address", async () => {
    const { deps, admin, account } = setup({
      handlers: {
        email_change_pending: () =>
          envelope("success", "pending", "r1", {
            new_email: "pending@example.test",
            expires_at: "2026-12-01T00:00:00Z",
          }),
      },
    });
    const result = await requestEmailChange(
      caller,
      { newEmail: null, idempotencyKey: "key-2" },
      deps,
    );
    assert.equal(result.state, "success");
    assert.deepEqual(names(admin.calls), ["email_change_pending", "email_change_request"]);
    assert.equal((admin.calls[1]!.args[0] as Record<string, unknown>).p_new_email, null);
    assert.equal(account.links[0]!.to, "pending@example.test");
  });

  it("'new mail' with nothing pending is a conflict and sends nothing", async () => {
    const { deps, admin, account } = setup({
      handlers: { email_change_pending: () => envelope("success", "none") },
    });
    const result = await requestEmailChange(
      caller,
      { newEmail: null, idempotencyKey: "key-2" },
      deps,
    );
    assert.deepEqual(result, conflict(EMAIL_REQUEST_NOT_PENDING));
    assert.deepEqual(names(admin.calls), ["email_change_pending"]);
    assert.equal(account.links.length, 0);
  });
});

describe("the pending request and cancelling it", () => {
  it("shows the pending address and none when there is none", async () => {
    const withOne = setup({
      handlers: {
        email_change_pending: () =>
          envelope("success", "pending", "r1", { new_email: "a@example.test", expires_at: "x" }),
      },
    });
    const found = await pendingEmailChange(caller, withOne.deps);
    assert.deepEqual(found.state === "success" && found.data, {
      newEmail: "a@example.test",
      expiresAt: "x",
    });
    const none = setup({ handlers: { email_change_pending: () => envelope("success", "none") } });
    const empty = await pendingEmailChange(caller, none.deps);
    assert.equal(empty.state === "success" && empty.data, null);
  });

  it("is retryable when the database cannot be reached", async () => {
    const { deps, admin } = setup();
    admin.callFunction = async () => unavailable;
    const result = await pendingEmailChange(caller, { admin });
    assert.equal(result.state, "dependency-failure-retryable");
    void deps;
  });

  it("cancels as the account and maps a refusal", async () => {
    const good = setup();
    const done = await cancelEmailChange(caller, { idempotencyKey: "k" }, good.deps);
    assert.equal(done.state, "success");
    assert.deepEqual(good.admin.calls[0]!.args[0], {
      p_idempotency_key: "k",
      p_account_id: ACCOUNT_ID,
    });
    const bad = setup({
      handlers: { email_change_cancel: () => envelope("conflict", EMAIL_REQUEST_NOT_PENDING) },
    });
    const refused = await cancelEmailChange(caller, { idempotencyKey: "k" }, bad.deps);
    assert.equal(refused.state, "conflict");
  });
});

describe("confirming the address from the link (BR34)", () => {
  it("hashes the token, confirms and tells the previous address", async () => {
    const { deps, admin, account } = setup({
      handlers: {
        email_change_confirm: () =>
          envelope("success", null, ACCOUNT_ID, { previous_email: "old@example.test" }),
      },
    });
    const result = await confirmEmailChange(TOKEN, deps);
    assert.equal(result.state, "success");
    assert.deepEqual(admin.calls[0]!.args[0], { p_token_hash: hashToken(TOKEN) });
    assert.deepEqual(account.notices, ["old@example.test"]);
  });

  it("answers every refusal of the link alike and sends no notice", async () => {
    const { deps, account } = setup({
      handlers: { email_change_confirm: () => envelope("terminal", EMAIL_LINK_INVALID) },
    });
    const result = await confirmEmailChange(TOKEN, deps);
    assert.equal(result.state, "dependency-failure-terminal");
    assert.equal(result.code, EMAIL_LINK_INVALID);
    assert.equal(account.notices.length, 0);
    const malformed = await confirmEmailChange("x", deps);
    assert.equal(malformed.code, EMAIL_LINK_INVALID);
  });

  it("keeps the confirmed address when the notice cannot be sent", async () => {
    const { deps, events } = setup({
      mailFails: true,
      handlers: {
        email_change_confirm: () =>
          envelope("success", null, ACCOUNT_ID, { previous_email: "old@example.test" }),
      },
    });
    const result = await confirmEmailChange(TOKEN, deps);
    assert.equal(result.state, "success");
    assert.deepEqual(
      events.events.map((entry) => entry.event),
      ["email_change_mail_failed"],
    );
  });
});

describe("sending the invitation to a parent on record (BR35)", () => {
  const input = { parentId: "p1", email: "Parent@Example.test", idempotencyKey: "k1" };
  const admin = { accessToken: "admin-token", accountId: "99999999-9999-4999-8999-999999999999" };

  it("sends hashes as the signed-in admin and the link by email", async () => {
    const { deps, database, invitationMailer, events } = setup();
    const result = await sendParentInvitation(admin, input, deps);
    assert.equal(result.state, "success");
    assert.equal(database.operations[0]!.name, "invitation_send");
    assert.equal(database.operations[0]!.token, admin.accessToken);
    assert.equal(database.operations[0]!.args.p_token_hash, hashToken(TOKEN));
    assert.equal(
      database.operations[0]!.args.p_email_hash,
      keyedHash("parent@example.test", SECRET, "email"),
    );
    assert.equal(JSON.stringify(database.operations).includes(TOKEN), false);
    assert.deepEqual(invitationMailer.sent, [
      { to: "parent@example.test", link: `http://127.0.0.1:3000/meghivas/${TOKEN}` },
    ]);
    assert.equal(events.events[0]!.event, "invitation_created");
  });

  it("keeps the invitation and emits the mail line when the mail fails", async () => {
    const { deps, events } = setup({ mailFails: true });
    const result = await sendParentInvitation(admin, input, deps);
    assert.equal(result.state, "dependency-failure-retryable");
    assert.equal(result.code, INVITATION_MAIL_NOT_SENT);
    assert.deepEqual(
      events.events.map((entry) => entry.event),
      ["invitation_created", "invitation_mail_failed"],
    );
  });

  it("sends no mail for a refusal and emits the limit line for the send limit", async () => {
    const { deps, invitationMailer, events } = setup({
      operation: () => conflict(EMAIL_RATE_LIMITED),
    });
    const result = await sendParentInvitation(admin, input, deps);
    assert.equal(result.state, "conflict");
    assert.equal(invitationMailer.sent.length, 0);
    assert.deepEqual(
      events.events.map((entry) => entry.event),
      ["email_rate_limited"],
    );
  });

  it("refuses an implausible address without a call", async () => {
    const { deps, database } = setup();
    const result = await sendParentInvitation(admin, { ...input, email: "nope" }, deps);
    assert.equal(result.state, "validation");
    assert.equal(database.operations.length, 0);
  });
});

void ok;

describe("asking for a new address needs the current password (BR34.1)", () => {
  const input = { newEmail: "new@example.test", currentPassword: OLD, idempotencyKey: "key-1" };

  it("checks the password first and only then asks the database", async () => {
    const { deps, admin, service } = setup();
    const result = await requestEmailChangeChecked(caller, input, deps);
    assert.equal(result.state, "success");
    assert.deepEqual(names(service.calls), ["passwordSignIn", "signOut"]);
    assert.deepEqual(names(admin.calls), ["sign_in_lockout_check", "email_change_request"]);
  });

  it("counts a wrong password towards the lockout and never reaches the database command", async () => {
    const { deps, admin } = setup({ service: { passwordSignIn: async () => rejected() } });
    const result = await requestEmailChangeChecked(caller, input, deps);
    assert.equal(result.state, "validation");
    assert.equal(result.code, PASSWORD_CURRENT_WRONG);
    assert.deepEqual(names(admin.calls), ["sign_in_lockout_check", "sign_in_attempt_record"]);
  });

  it("refuses a locked address before the service is asked", async () => {
    const { deps, service } = setup({
      handlers: { sign_in_lockout_check: () => envelope("success", "locked") },
    });
    const result = await requestEmailChangeChecked(caller, input, deps);
    assert.equal(result.state, "denied");
    assert.equal(service.calls.length, 0);
  });

  it("needs no password for a fresh link to the address already pending (Új levél)", async () => {
    const { deps, service } = setup({
      handlers: {
        email_change_pending: () =>
          envelope("success", "pending", null, { new_email: "new@example.test", expires_at: "x" }),
      },
    });
    const result = await requestEmailChangeChecked(
      caller,
      { newEmail: null, currentPassword: "", idempotencyKey: "key-2" },
      deps,
    );
    assert.equal(result.state, "success");
    assert.equal(service.calls.length, 0);
  });
});
