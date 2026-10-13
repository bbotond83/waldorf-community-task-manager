import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ACCOUNT_ID,
  envelope,
  fakeAdmin,
  fakeService,
  fakeSession,
  ok,
  recordingEvents,
  rejected,
  SESSION_ID,
  unavailable,
  type AdminHandlers,
} from "../../tests/support/identity-fakes.ts";
import { keyedHash } from "./crypto.ts";
import {
  completePasswordReset,
  PASSWORD_RULE,
  requestPasswordReset,
  RESET_NOT_VALID,
} from "./reset.ts";

const SECRET = "r".repeat(40);

function setup(handlers: AdminHandlers = {}, service: Parameters<typeof fakeService>[0] = {}) {
  const admin = fakeAdmin(handlers);
  const svc = fakeService(service);
  const events = recordingEvents();
  return {
    deps: { service: svc, admin, events, emailKeySecret: SECRET },
    admin,
    service: svc,
    events,
  };
}

const names = (calls: { name: string }[]) => calls.map((call) => call.name);

describe("requesting a password reset (BR2.12, NFR1.22)", () => {
  it("sends the recovery email only for a known active account, and answers the same either way", async () => {
    const known = setup({ account_recovery_check: () => envelope("success", "active") });
    const sent = await requestPasswordReset(" Person@Example.test ", known.deps);
    assert.equal(sent.state, "success");
    assert.deepEqual(known.service.calls, [
      { name: "requestRecovery", args: ["person@example.test"] },
    ]);
    for (const status of ["deactivated", "unknown"]) {
      const other = setup({ account_recovery_check: () => envelope("success", status) });
      const result = await requestPasswordReset("person@example.test", other.deps);
      assert.deepEqual(result, sent, `${status} answers the same`);
      assert.equal(other.service.calls.length, 0, `${status} sends nothing`);
    }
  });

  it("answers the same for a malformed address and for a failing service, never revealing a difference", async () => {
    const malformed = setup();
    assert.equal((await requestPasswordReset("nonsense", malformed.deps)).state, "success");
    assert.equal(malformed.admin.calls.length + malformed.service.calls.length, 0);
    const down = setup(
      { account_recovery_check: () => envelope("success", "active") },
      { requestRecovery: async () => unavailable },
    );
    assert.equal((await requestPasswordReset("person@example.test", down.deps)).state, "success");
    assert.equal(down.events.events[0]!.code, "send_failed");
    const adminDown = setup({ account_recovery_check: () => unavailable });
    assert.equal(
      (await requestPasswordReset("person@example.test", adminDown.deps)).state,
      "success",
    );
    assert.equal(adminDown.service.calls.length, 0);
  });
});

describe("the reset request answers before any work is done (R-03)", () => {
  it("defers the check and the mail, so the answer is the same and immediate for every address", async () => {
    for (const status of ["active", "deactivated", "unknown"]) {
      const run = setup({ account_recovery_check: () => envelope("success", status) });
      const tasks: (() => Promise<void>)[] = [];
      const answer = await requestPasswordReset("person@example.test", {
        ...run.deps,
        defer: (task) => tasks.push(task),
      });
      assert.equal(answer.state, "success");
      assert.equal(
        run.admin.calls.length + run.service.calls.length,
        0,
        "nothing ran before the answer",
      );
      assert.equal(tasks.length, 1);
      await tasks[0]!();
      assert.equal(run.service.calls.length, status === "active" ? 1 : 0);
    }
  });

  it("reports a failing deferred task instead of throwing", async () => {
    const run = setup({
      account_recovery_check: () => {
        throw new Error("network");
      },
    });
    const tasks: (() => Promise<void>)[] = [];
    await requestPasswordReset("person@example.test", {
      ...run.deps,
      defer: (task) => tasks.push(task),
    });
    await tasks[0]!();
    assert.equal(run.events.events[0]!.code, "error");
  });
});

describe("using a reset link (BR2.4, BR2.12)", () => {
  const input = { tokenHash: "a".repeat(56), password: "new-password-1" };

  it("exchanges the code, sets the password, ends the other sessions, clears the attempts and signs the person in", async () => {
    const session = fakeSession({ email: "Person@Example.test" });
    const { deps, admin, service, events } = setup({}, { verifyRecovery: async () => ok(session) });
    const result = await completePasswordReset(input, deps);
    assert.equal(result.state, "success");
    assert.equal(result.state === "success" && result.data.tokens.accessToken, session.accessToken);
    assert.deepEqual(names(service.calls), ["verifyRecovery", "updatePassword"]);
    assert.deepEqual(service.calls[1]!.args, [session.accessToken, "new-password-1"]);
    assert.deepEqual(admin.calls[0], {
      name: "sessions_remove",
      args: [{ p_user_id: ACCOUNT_ID, p_keep_session_id: SESSION_ID }],
    });
    assert.deepEqual(admin.calls[1]!.args, [
      {
        p_email_hash: keyedHash("person@example.test", SECRET, "email"),
        p_user_id: ACCOUNT_ID,
      },
    ]);
    assert.deepEqual(
      events.events.map((entry) => entry.event),
      ["reset_used"],
    );
  });

  it("checks the password rule before the code is exchanged, so a rejected password never spends the link", async () => {
    const { deps, service } = setup();
    const result = await completePasswordReset({ ...input, password: "nodigitshere" }, deps);
    assert.equal(result.state, "validation");
    assert.equal(result.code, PASSWORD_RULE);
    assert.equal(service.calls.length, 0);
  });

  it("answers the not-valid result for a used, expired or malformed code, and a retry result when the service is down", async () => {
    const used = setup({}, { verifyRecovery: async () => rejected("otp_expired", 403) });
    const result = await completePasswordReset(input, used.deps);
    assert.equal(result.state, "denied");
    assert.equal(result.code, RESET_NOT_VALID);
    const malformed = setup();
    assert.equal(
      (await completePasswordReset({ ...input, tokenHash: "no spaces allowed" }, malformed.deps))
        .code,
      RESET_NOT_VALID,
    );
    assert.equal(malformed.service.calls.length, 0);
    const down = setup({}, { verifyRecovery: async () => unavailable });
    assert.equal(
      (await completePasswordReset(input, down.deps)).state,
      "dependency-failure-retryable",
    );
  });

  it("ends the new session and reports when the service refuses the new password or is down", async () => {
    const refused = setup({}, { updatePassword: async () => rejected("same_password", 422) });
    const result = await completePasswordReset(input, refused.deps);
    assert.equal(result.state, "validation");
    assert.deepEqual(names(refused.service.calls), ["verifyRecovery", "updatePassword", "signOut"]);
    const down = setup({}, { updatePassword: async () => unavailable });
    assert.equal(
      (await completePasswordReset(input, down.deps)).state,
      "dependency-failure-retryable",
    );
  });

  it("retries ending the other sessions and fails closed when that cannot be done", async () => {
    let attempts = 0;
    const flaky = setup({
      sessions_remove: () => {
        attempts += 1;
        return attempts < 3 ? unavailable : envelope("success", "removed");
      },
    });
    assert.equal((await completePasswordReset(input, flaky.deps)).state, "success");
    assert.equal(attempts, 3);
    const broken = setup({ sessions_remove: () => envelope("denied", "admin_access_required") });
    const result = await completePasswordReset(input, broken.deps);
    assert.equal(result.state, "dependency-failure-retryable");
    assert.deepEqual(names(broken.service.calls), ["verifyRecovery", "updatePassword", "signOut"]);
    assert.ok(broken.events.events.some((entry) => entry.event === "follow_up_failed"));
  });
});
