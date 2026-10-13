import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import {
  ACCOUNT_ID,
  envelope,
  fakeAdmin,
  fakeDatabase,
  fakeService,
  fakeSession,
  ok,
  recordingEvents,
  rejected,
  unavailable,
} from "../../tests/support/identity-fakes.ts";
import { keyedHash } from "./crypto.ts";
import { createEventEmitter } from "./events.ts";
import {
  resetHousekeepingClockForTests,
  SIGN_IN_INVALID,
  SIGN_IN_LOCKED,
  signIn,
  validateSignInForm,
} from "./sign-in.ts";

const SECRET = "k".repeat(40);
const EMAIL = "person@example.test";
const HASH = keyedHash(EMAIL, SECRET, "email");

function setup(
  options: {
    service?: Parameters<typeof fakeService>[0];
    lockout?: ReturnType<typeof envelope>;
    active?: boolean | "unavailable";
    now?: () => number;
    housekeeping?: () => Promise<void>;
  } = {},
) {
  const service = fakeService(options.service);
  const admin = fakeAdmin({
    sign_in_lockout_check: () => options.lockout ?? envelope("success", "open"),
  });
  const database = fakeDatabase({ active: options.active ?? true });
  const events = recordingEvents();
  const deps = {
    service,
    admin,
    database,
    events,
    emailKeySecret: SECRET,
    now: options.now ?? (() => Date.now()),
    housekeeping: options.housekeeping,
  };
  return { deps, service, admin, events };
}

const names = (calls: { name: string }[]) => calls.map((call) => call.name);

describe("sign-in (W1; BR2.1 to BR2.3)", () => {
  beforeEach(() => resetHousekeepingClockForTests());

  it("checks the lockout first, then the credentials, and on success clears the attempts and returns the tokens", async () => {
    const { deps, service, admin, events } = setup();
    const result = await signIn({ email: "  Person@Example.test ", password: "password-1x" }, deps);
    assert.equal(result.state, "success");
    if (result.state === "success") {
      assert.equal(result.data.accountId, ACCOUNT_ID);
      assert.ok(result.data.accessToken && result.data.refreshToken);
    }
    assert.deepEqual(names(admin.calls), ["sign_in_lockout_check", "sign_in_attempt_clear"]);
    assert.deepEqual(admin.calls[0]!.args, [{ p_email_hash: HASH }]);
    assert.deepEqual(service.calls[0]!.args, [EMAIL, "password-1x"]);
    assert.deepEqual(
      events.events.map((entry) => entry.event),
      ["sign_in_success"],
    );
  });

  it("answers a locked address with the try-again-later result and never checks the password", async () => {
    const { deps, service, admin, events } = setup({ lockout: envelope("success", "locked") });
    const result = await signIn({ email: EMAIL, password: "password-1x" }, deps);
    assert.equal(result.state, "denied");
    assert.equal(result.code, SIGN_IN_LOCKED);
    assert.equal(service.calls.length, 0);
    assert.deepEqual(names(admin.calls), ["sign_in_lockout_check"]);
    assert.deepEqual(
      events.events.map((entry) => entry.event),
      ["lockout"],
    );
  });

  it("answers a wrong password, an unknown address and a banned account with the same generic result and records one attempt each", async () => {
    for (const code of ["invalid_credentials", "user_not_found", "user_banned"]) {
      const { deps, admin } = setup({ service: { passwordSignIn: async () => rejected(code) } });
      const result = await signIn({ email: EMAIL, password: "password-1x" }, deps);
      assert.equal(result.state, "denied", code);
      assert.equal(result.code, SIGN_IN_INVALID, code);
      assert.deepEqual(
        names(admin.calls),
        ["sign_in_lockout_check", "sign_in_attempt_record"],
        code,
      );
    }
  });

  it("refuses a session of a deactivated account that the service still issued, ends it, and answers generically", async () => {
    const { deps, service, admin } = setup({ active: false });
    const result = await signIn({ email: EMAIL, password: "password-1x" }, deps);
    assert.equal(result.code, SIGN_IN_INVALID);
    assert.deepEqual(names(service.calls), ["passwordSignIn", "signOut"]);
    assert.deepEqual(names(admin.calls), ["sign_in_lockout_check", "sign_in_attempt_record"]);
  });

  it("answers malformed input like a wrong password without any call", async () => {
    for (const input of [
      { email: "", password: "x" },
      { email: "not-an-address", password: "x" },
      { email: EMAIL, password: "" },
    ]) {
      const { deps, service, admin } = setup();
      const result = await signIn(input, deps);
      assert.equal(result.code, SIGN_IN_INVALID);
      assert.equal(service.calls.length + admin.calls.length, 0);
    }
  });

  it("returns a retryable result, creating no session and recording no attempt, when a dependency is down", async () => {
    const down = setup({ service: { passwordSignIn: async () => unavailable } });
    assert.equal(
      (await signIn({ email: EMAIL, password: "password-1x" }, down.deps)).state,
      "dependency-failure-retryable",
    );
    assert.deepEqual(names(down.admin.calls), ["sign_in_lockout_check"]);

    const lockoutDown = setup();
    lockoutDown.deps.admin.callFunction = async () => ({ ok: false, kind: "unavailable" });
    assert.equal(
      (await signIn({ email: EMAIL, password: "password-1x" }, lockoutDown.deps)).state,
      "dependency-failure-retryable",
    );
    assert.equal(
      lockoutDown.service.calls.length,
      0,
      "nothing is checked when the lockout cannot be",
    );

    const dbDown = setup({ active: "unavailable" });
    assert.equal(
      (await signIn({ email: EMAIL, password: "password-1x" }, dbDown.deps)).state,
      "dependency-failure-retryable",
    );
    assert.deepEqual(
      names(dbDown.service.calls),
      ["passwordSignIn", "signOut"],
      "the session that was just issued is ended",
    );
  });

  it("never writes the address, the password or a token into an event line", async () => {
    const lines: string[] = [];
    const { deps } = setup({ service: { passwordSignIn: async () => rejected() } });
    const real = {
      ...deps,
      events: createEventEmitter({ secret: SECRET, sink: (line) => lines.push(line) }),
    };
    await signIn({ email: EMAIL, password: "password-1x" }, real);
    assert.equal(lines.length, 1);
    const text = lines.join("\n");
    assert.equal(
      text.includes(EMAIL) || text.includes("password-1x") || text.includes("example.test"),
      false,
    );
    assert.equal(JSON.parse(lines[0]!).event, "sign_in_failure");
  });

  it("runs the housekeeping at most once an hour, and a failing housekeeping never blocks the person", async () => {
    let clock = 10 * 60 * 60 * 1000;
    let runs = 0;
    const { deps } = setup({
      now: () => clock,
      housekeeping: async () => {
        runs += 1;
        throw new Error("housekeeping failed");
      },
    });
    assert.equal((await signIn({ email: EMAIL, password: "password-1x" }, deps)).state, "success");
    assert.equal((await signIn({ email: EMAIL, password: "password-1x" }, deps)).state, "success");
    assert.equal(runs, 1);
    clock += 61 * 60 * 1000;
    await signIn({ email: EMAIL, password: "password-1x" }, deps);
    assert.equal(runs, 2);
    const without = setup();
    assert.equal(
      (await signIn({ email: EMAIL, password: "password-1x" }, without.deps)).state,
      "success",
    );
  });

  it("validates the form fields before submit", () => {
    assert.equal(validateSignInForm({ email: EMAIL, password: "x" }), undefined);
    const empty = validateSignInForm({ email: " ", password: "" });
    assert.equal(empty?.state, "validation");
    if (empty?.state === "validation")
      assert.deepEqual(empty.fieldErrors, { email: "required", password: "required" });
  });

  it("uses the session that the service returned, not a new one", async () => {
    const issued = fakeSession({ refreshToken: "refresh-of-this-session" });
    const { deps } = setup({ service: { passwordSignIn: async () => ok(issued) } });
    const result = await signIn({ email: EMAIL, password: "password-1x" }, deps);
    assert.equal(result.state === "success" && result.data.refreshToken, "refresh-of-this-session");
  });
});
