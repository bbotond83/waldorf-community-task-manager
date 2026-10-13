import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { conflict, denied } from "../application/results.ts";
import {
  ACCOUNT_ID,
  envelope,
  fakeAdmin,
  fakeDatabase,
  fakeMailer,
  fakeService,
  ok,
  rejected,
  recordingEvents,
  unavailable,
  type AdminHandlers,
} from "../../tests/support/identity-fakes.ts";
import { hashToken } from "./crypto.ts";
import {
  acceptInvitation,
  createInvitation,
  INVITATION_BUSY,
  INVITATION_MAIL_NOT_SENT,
  INVITATION_NOT_VALID,
  invitationLink,
  lookupInvitation,
  PASSWORD_RULE,
  resendInvitation,
  revokeInvitation,
} from "./invitations.ts";

const TOKEN = "T".repeat(43);
const caller = {
  accessToken: "admin-access-token",
  accountId: "99999999-9999-4999-8999-999999999999",
};
const INVITATION_ID = "44444444-4444-4444-8444-444444444444";
const USER_ID = "55555555-5555-4555-8555-555555555555";

function invitationDeps(
  options: {
    handlers?: AdminHandlers;
    users?: Parameters<typeof fakeAdmin>[1];
    service?: Parameters<typeof fakeService>[0];
    mailFails?: boolean;
    operation?: Parameters<typeof fakeDatabase>[0] extends infer O
      ? O extends { operation?: infer F }
        ? F
        : never
      : never;
  } = {},
) {
  const admin = fakeAdmin(options.handlers, options.users);
  const database = fakeDatabase({ operation: options.operation });
  const mailer = fakeMailer(options.mailFails);
  const events = recordingEvents();
  const service = fakeService(options.service);
  return {
    deps: {
      service,
      admin,
      database,
      mailer,
      events,
      appPublicUrl: "http://127.0.0.1:3000/",
      newToken: () => TOKEN,
    },
    admin,
    database,
    mailer,
    events,
    service,
  };
}

const names = (calls: { name: string }[]) => calls.map((call) => call.name);

describe("creating, resending and revoking invitations (W4; BR2.9, BR2.10, NFR6.8)", () => {
  const input = {
    email: " Parent@Example.test ",
    role: "parent",
    scopeType: "family",
    scopeId: "f1",
    idempotencyKey: "key-1",
  };

  it("sends only the token's hash to the database and the link by email, as the signed-in admin", async () => {
    const { deps, database, mailer, events } = invitationDeps();
    const result = await createInvitation(caller, input, deps);
    assert.equal(result.state, "success");
    assert.equal(database.operations[0]!.name, "invitation_create");
    assert.equal(database.operations[0]!.token, caller.accessToken);
    assert.equal(database.operations[0]!.args.p_token_hash, hashToken(TOKEN));
    assert.equal(database.operations[0]!.args.p_email, "parent@example.test");
    assert.equal(
      JSON.stringify(database.operations).includes(TOKEN),
      false,
      "the token never reaches the database",
    );
    assert.deepEqual(mailer.sent, [
      { to: "parent@example.test", link: `http://127.0.0.1:3000/meghivas/${TOKEN}` },
    ]);
    assert.deepEqual(
      events.events.map((entry) => entry.event),
      ["invitation_created"],
    );
  });

  it("keeps the stored invitation and reports a retryable result when the email cannot be sent (NFR6.8)", async () => {
    const { deps, events } = invitationDeps({ mailFails: true });
    const result = await createInvitation(caller, input, deps);
    assert.equal(result.state, "dependency-failure-retryable");
    assert.equal(result.code, INVITATION_MAIL_NOT_SENT);
    assert.equal(
      result.evidenceId,
      "33333333-3333-4333-8333-333333333333",
      "the stored invitation is named so it can be resent",
    );
    assert.ok(events.events.some((entry) => entry.event === "invitation_mail_failed"));
  });

  it("sends no email for a replayed result, and passes denied and conflict through unchanged", async () => {
    const replay = invitationDeps({
      operation: () => ({
        state: "success",
        data: { reference: INVITATION_ID, code: "replayed" },
        code: "replayed",
        presentationCode: "APP-SUCCESS",
        focusTarget: "#x",
        announcement: "polite",
      }),
    });
    const replayed = await createInvitation(caller, input, replay.deps);
    assert.equal(replayed.state === "success" && replayed.data.mailed, false);
    assert.equal(replay.mailer.sent.length, 0);
    const refused = invitationDeps({ operation: () => denied("authorization_denied") });
    assert.equal((await createInvitation(caller, input, refused.deps)).state, "denied");
    const duplicate = invitationDeps({ operation: () => conflict("invitation_exists") });
    assert.equal((await createInvitation(caller, input, duplicate.deps)).state, "conflict");
    assert.equal(refused.mailer.sent.length + duplicate.mailer.sent.length, 0);
  });

  it("refuses a malformed address before any call", async () => {
    const { deps, database } = invitationDeps();
    const result = await createInvitation(caller, { ...input, email: "nope" }, deps);
    assert.equal(result.state, "validation");
    assert.equal(database.operations.length, 0);
  });

  it("resends with a new token and a new link, and revokes by id", async () => {
    const { deps, database, mailer, events } = invitationDeps();
    const resent = await resendInvitation(
      caller,
      { invitationId: INVITATION_ID, email: "Parent@Example.test", idempotencyKey: "k2" },
      deps,
    );
    assert.equal(resent.state, "success");
    assert.equal(database.operations[0]!.name, "invitation_resend");
    assert.equal(database.operations[0]!.args.p_new_token_hash, hashToken(TOKEN));
    assert.equal(mailer.sent[0]!.to, "parent@example.test");
    const revoked = await revokeInvitation(
      caller,
      { invitationId: INVITATION_ID, idempotencyKey: "k3" },
      deps,
    );
    assert.equal(revoked.state, "success");
    assert.equal(database.operations[1]!.name, "invitation_revoke");
    assert.deepEqual(
      events.events.map((entry) => entry.event),
      ["invitation_resent", "invitation_revoked"],
    );
    const failing = invitationDeps({ mailFails: true });
    assert.equal(
      (
        await resendInvitation(
          caller,
          { invitationId: INVITATION_ID, email: "a@example.test", idempotencyKey: "k4" },
          failing.deps,
        )
      ).state,
      "dependency-failure-retryable",
    );
    const refused = invitationDeps({ operation: () => denied() });
    assert.equal(
      (
        await resendInvitation(
          caller,
          { invitationId: INVITATION_ID, email: "a@example.test", idempotencyKey: "k5" },
          refused.deps,
        )
      ).state,
      "denied",
    );
    assert.equal(
      (
        await revokeInvitation(
          caller,
          { invitationId: INVITATION_ID, idempotencyKey: "k6" },
          refused.deps,
        )
      ).state,
      "denied",
    );
  });

  it("builds the link from the public address without a doubled slash", () => {
    assert.equal(
      invitationLink("https://app.example.org/", "abc"),
      "https://app.example.org/meghivas/abc",
    );
    assert.equal(
      invitationLink("https://app.example.org", "abc"),
      "https://app.example.org/meghivas/abc",
    );
  });
});

describe("looking an invitation up before sign-in (BR2.10)", () => {
  it("returns the role, the kind of scope and the validity only", async () => {
    const { deps } = invitationDeps({
      handlers: {
        invitation_lookup: () =>
          envelope("success", "valid", null, { role: "parent", scope_type: "family" }),
      },
    });
    assert.deepEqual(await lookupInvitation(TOKEN, deps), {
      validity: "valid",
      role: "parent",
      scopeType: "family",
    });
    assert.equal(
      deps.admin.calls[0]!.args[0] !== undefined &&
        JSON.stringify(deps.admin.calls[0]!.args).includes(TOKEN),
      false,
    );
  });

  it("reports an expired link (and writes the expired event), an unknown one and an unavailable service", async () => {
    const expired = invitationDeps({
      handlers: {
        invitation_lookup: () =>
          envelope("success", "expired", null, { role: "parent", scope_type: "family" }),
      },
    });
    assert.deepEqual(await lookupInvitation(TOKEN, expired.deps), { validity: "expired" });
    assert.deepEqual(
      expired.events.events.map((entry) => entry.event),
      ["invitation_expired"],
    );
    const unknown = invitationDeps({
      handlers: { invitation_lookup: () => envelope("success", "not_valid") },
    });
    assert.deepEqual(await lookupInvitation(TOKEN, unknown.deps), { validity: "not_valid" });
    const malformed = invitationDeps({
      handlers: { invitation_lookup: () => envelope("validation", "token_hash_invalid") },
    });
    assert.deepEqual(await lookupInvitation(TOKEN, malformed.deps), { validity: "not_valid" });
    const down = invitationDeps({ handlers: { invitation_lookup: () => unavailable } });
    assert.deepEqual(await lookupInvitation(TOKEN, down.deps), { validity: "unavailable" });
    const denied = invitationDeps({
      handlers: { invitation_lookup: () => envelope("denied", "admin_access_required") },
    });
    assert.deepEqual(await lookupInvitation(TOKEN, denied.deps), { validity: "unavailable" });
  });
});

describe("accepting an invitation (W5; BR2.4, BR2.11, NFR6.2)", () => {
  const reserved = (extra: Record<string, unknown> = {}) =>
    envelope("success", "reserved", INVITATION_ID, {
      email: "parent@example.test",
      orphan_user_id: null,
      reserved_at: "2026-10-13T10:00:00.123456+00:00",
      ...extra,
    });
  const accepted = envelope("success", null, USER_ID);
  const input = { token: TOKEN, password: "password-1x", idempotencyKey: "accept-key" };

  it("reserves, creates the sign-in user tagged with the invitation, accepts in one step and signs the person in", async () => {
    const { deps, admin, service, events } = invitationDeps({
      handlers: { invitation_reserve: () => reserved(), invitation_accept: () => accepted },
      users: { createUser: async () => ok({ id: USER_ID }) },
    });
    const result = await acceptInvitation(input, deps);
    assert.equal(result.state, "success");
    assert.equal(result.state === "success" && result.data.accountId, USER_ID);
    assert.equal(result.state === "success" && Boolean(result.data.tokens?.accessToken), true);
    assert.deepEqual(names(admin.calls), ["invitation_reserve", "createUser", "invitation_accept"]);
    assert.deepEqual(admin.calls[0]!.args, [
      { p_idempotency_key: "accept-key", p_token_hash: hashToken(TOKEN) },
    ]);
    assert.deepEqual(admin.calls[1]!.args, [
      { email: "parent@example.test", password: "password-1x", invitationId: INVITATION_ID },
    ]);
    assert.deepEqual(admin.calls[2]!.args, [
      { p_idempotency_key: "accept-key", p_invitation_id: INVITATION_ID, p_account_id: USER_ID },
    ]);
    assert.deepEqual(service.calls[0]!.args, ["parent@example.test", "password-1x"]);
    assert.deepEqual(
      events.events.map((entry) => entry.event),
      ["invitation_accepted"],
    );
  });

  it("refuses a password that breaks the rule before touching anything", async () => {
    const { deps, admin } = invitationDeps();
    const result = await acceptInvitation({ ...input, password: "short1" }, deps);
    assert.equal(result.state, "validation");
    assert.equal(result.code, PASSWORD_RULE);
    assert.equal(admin.calls.length, 0);
  });

  it("answers the not-valid message for an expired, revoked, used or account-owned invitation", async () => {
    for (const code of ["invitation_not_valid", "invitation_expired", "account_exists"]) {
      const { deps, admin, events } = invitationDeps({
        handlers: { invitation_reserve: () => envelope("validation", code) },
      });
      const result = await acceptInvitation(input, deps);
      assert.equal(result.state, "denied", code);
      assert.equal(result.code, INVITATION_NOT_VALID);
      assert.deepEqual(names(admin.calls), ["invitation_reserve"]);
      assert.equal(
        events.events.some((entry) => entry.event === "invitation_expired"),
        code === "invitation_expired",
      );
    }
  });

  it("asks for a retry while another submit holds the reservation, and for an unusable key", async () => {
    const busy = invitationDeps({
      handlers: { invitation_reserve: () => envelope("conflict", "invitation_reserved") },
    });
    const result = await acceptInvitation(input, busy.deps);
    assert.equal(result.state, "dependency-failure-retryable");
    assert.equal(result.code, INVITATION_BUSY);
    const reused = invitationDeps({
      handlers: { invitation_reserve: () => envelope("conflict", "idempotency_key_reused") },
    });
    assert.equal((await acceptInvitation(input, reused.deps)).state, "conflict");
    const odd = invitationDeps({
      handlers: { invitation_reserve: () => envelope("denied", "admin_access_required") },
    });
    assert.equal((await acceptInvitation(input, odd.deps)).state, "dependency-failure-terminal");
    const down = invitationDeps({ handlers: { invitation_reserve: () => unavailable } });
    assert.equal((await acceptInvitation(input, down.deps)).state, "dependency-failure-retryable");
  });

  it("returns the stored success for a repeated key without creating anything", async () => {
    const { deps, admin } = invitationDeps({
      handlers: { invitation_reserve: () => envelope("success", "replayed", USER_ID) },
    });
    const result = await acceptInvitation(input, deps);
    assert.equal(result.state, "success");
    assert.equal(result.state === "success" && result.data.accountId, USER_ID);
    assert.equal(result.state === "success" && result.data.tokens, undefined);
    assert.deepEqual(names(admin.calls), ["invitation_reserve"]);
  });

  it("reuses a leftover sign-in user instead of creating a second one", async () => {
    const { deps, admin } = invitationDeps({
      handlers: {
        invitation_reserve: () => reserved({ orphan_user_id: "leftover-user" }),
        invitation_accept: () => accepted,
      },
    });
    await acceptInvitation(input, deps);
    assert.deepEqual(names(admin.calls), [
      "invitation_reserve",
      "setPassword",
      "invitation_accept",
    ]);
    assert.deepEqual(admin.calls[1]!.args, ["leftover-user", "password-1x"]);
    assert.deepEqual(admin.calls[2]!.args, [
      {
        p_idempotency_key: "accept-key",
        p_invitation_id: INVITATION_ID,
        p_account_id: "leftover-user",
      },
    ]);
  });

  it("releases the reservation when the user cannot be created or updated, and deletes nothing", async () => {
    const down = invitationDeps({
      handlers: { invitation_reserve: () => reserved() },
      users: { createUser: async () => unavailable },
    });
    assert.equal((await acceptInvitation(input, down.deps)).state, "dependency-failure-retryable");
    assert.deepEqual(names(down.admin.calls), [
      "invitation_reserve",
      "createUser",
      "invitation_release",
    ]);
    const taken = invitationDeps({
      handlers: { invitation_reserve: () => reserved() },
      users: { createUser: async () => rejected("email_exists", 422) },
    });
    assert.equal((await acceptInvitation(input, taken.deps)).code, INVITATION_NOT_VALID);
    assert.ok(names(taken.admin.calls).includes("invitation_release"));
    const weak = invitationDeps({
      handlers: { invitation_reserve: () => reserved() },
      users: { createUser: async () => rejected("weak_password", 422) },
    });
    const weakResult = await acceptInvitation(input, weak.deps);
    assert.equal(weakResult.state, "validation");
    const orphanDown = invitationDeps({
      handlers: { invitation_reserve: () => reserved({ orphan_user_id: "leftover" }) },
      users: { setPassword: async () => unavailable },
    });
    assert.equal(
      (await acceptInvitation(input, orphanDown.deps)).state,
      "dependency-failure-retryable",
    );
    const orphanRejected = invitationDeps({
      handlers: { invitation_reserve: () => reserved({ orphan_user_id: "leftover" }) },
      users: { setPassword: async () => rejected("user_not_found", 404) },
    });
    assert.equal((await acceptInvitation(input, orphanRejected.deps)).code, INVITATION_NOT_VALID);
    for (const run of [down, taken, weak, orphanDown, orphanRejected]) {
      assert.equal(names(run.admin.calls).includes("deleteUser"), false);
    }
  });

  const released = () => envelope("success", "released");
  const notHolder = () => envelope("success", "not_reserved");

  it("releases its own reservation and deletes the new user only after the release proved no Account exists", async () => {
    const failures = [
      envelope("validation", "invitation_not_reserved"),
      envelope("conflict", "account_exists"),
      unavailable,
    ];
    for (const failure of failures) {
      const { deps, admin } = invitationDeps({
        handlers: {
          invitation_reserve: () => reserved(),
          invitation_accept: () => failure,
          invitation_release: released,
        },
      });
      const result = await acceptInvitation(input, deps);
      assert.notEqual(result.state, "success");
      assert.deepEqual(names(admin.calls), [
        "invitation_reserve",
        "createUser",
        "invitation_accept",
        "invitation_release",
        "deleteUser",
      ]);
      const release = admin.calls.find((call) => call.name === "invitation_release");
      assert.deepEqual(release?.args, [
        { p_invitation_id: INVITATION_ID, p_reserved_at: "2026-10-13T10:00:00.123456+00:00" },
      ]);
    }
  });

  it("keeps the sign-in user when the accept answer was lost and the release and the lookup are both unavailable", async () => {
    const { deps, admin, events } = invitationDeps({
      handlers: {
        invitation_reserve: () => reserved(),
        invitation_accept: () => unavailable,
        invitation_release: () => unavailable,
        invitation_lookup: () => unavailable,
      },
    });
    const result = await acceptInvitation(input, deps);
    assert.equal(result.state, "dependency-failure-retryable");
    assert.equal(names(admin.calls).includes("deleteUser"), false, "no proof, no deletion");
    assert.ok(events.events.some((entry) => entry.code === "delete_user_unproven"));
  });

  it("keeps the sign-in user when another submit holds the reservation, or when the answers are unknown", async () => {
    for (const lookup of [
      () => envelope("success", "valid"),
      () => envelope("validation", "token_hash_invalid"),
      () => envelope("denied", "admin_access_required"),
    ]) {
      const { deps, admin } = invitationDeps({
        handlers: {
          invitation_reserve: () => reserved(),
          invitation_accept: () => unavailable,
          invitation_release: notHolder,
          invitation_lookup: lookup,
        },
      });
      assert.equal((await acceptInvitation(input, deps)).state, "dependency-failure-retryable");
      assert.equal(names(admin.calls).includes("deleteUser"), false);
    }
  });

  it("keeps the sign-in user when the answer was lost but the invitation was in fact accepted", async () => {
    const { deps, admin, service } = invitationDeps({
      handlers: {
        invitation_reserve: () => reserved(),
        invitation_accept: () => unavailable,
        invitation_release: notHolder,
        invitation_lookup: () => envelope("success", "not_valid"),
      },
    });
    const result = await acceptInvitation(input, deps);
    assert.equal(result.state, "success");
    assert.equal(
      names(admin.calls).includes("deleteUser"),
      false,
      "a user that has an Account is never deleted",
    );
    assert.equal(names(service.calls)[0], "passwordSignIn");
  });

  it("answers not-valid for a validation or conflict from the acceptance, and reports a failed clean-up", async () => {
    const validation = invitationDeps({
      handlers: {
        invitation_reserve: () => reserved(),
        invitation_accept: () => envelope("validation", "invitation_not_reserved"),
        invitation_release: released,
      },
    });
    assert.equal((await acceptInvitation(input, validation.deps)).code, INVITATION_NOT_VALID);
    const stuck = invitationDeps({
      handlers: {
        invitation_reserve: () => reserved(),
        invitation_accept: () => unavailable,
        invitation_release: released,
      },
      users: { deleteUser: async () => unavailable },
    });
    assert.equal((await acceptInvitation(input, stuck.deps)).state, "dependency-failure-retryable");
    assert.ok(stuck.events.events.some((entry) => entry.event === "follow_up_failed"));
  });

  it("still succeeds when the automatic sign-in afterwards fails: the person signs in by hand", async () => {
    const { deps } = invitationDeps({
      handlers: { invitation_reserve: () => reserved(), invitation_accept: () => accepted },
      service: { passwordSignIn: async () => unavailable },
    });
    const result = await acceptInvitation(input, deps);
    assert.equal(result.state, "success");
    assert.equal(result.state === "success" && result.data.tokens, undefined);
    assert.equal(ACCOUNT_ID.length, 36);
  });
});
