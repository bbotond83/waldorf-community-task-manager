import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { denied } from "../application/results.ts";
import {
  envelope,
  fakeAdmin,
  fakeDatabase,
  ok,
  recordingEvents,
  unavailable,
  type AdminHandlers,
} from "../../tests/support/identity-fakes.ts";
import {
  changeGrant,
  deactivateAccount,
  reactivateAccount,
  reconcileAccountBans,
} from "./accounts.ts";

const caller = { accessToken: "admin-token", accountId: "99999999-9999-4999-8999-999999999999" };
const TARGET = "66666666-6666-4666-8666-666666666666";

function setup(
  handlers: AdminHandlers = {},
  users: Parameters<typeof fakeAdmin>[1] = {},
  operation?: Parameters<typeof fakeDatabase>[0] extends infer O
    ? O extends { operation?: infer F }
      ? F
      : never
    : never,
) {
  const admin = fakeAdmin(handlers, users);
  const database = fakeDatabase({ operation });
  const events = recordingEvents();
  return { deps: { admin, database, events }, admin, database, events };
}

describe("account changes and their follow-up calls (BR2.2, BR2.14, NFR6.5)", () => {
  it("deactivates in the database first, then bans the sign-in user and ends its sessions", async () => {
    const { deps, admin, database, events } = setup();
    const result = await deactivateAccount(
      caller,
      { accountId: TARGET, idempotencyKey: "k1" },
      deps,
    );
    assert.deepEqual(result.state === "success" && result.data, {
      accountId: TARGET,
      followUp: "done",
    });
    assert.equal(database.operations[0]!.name, "account_deactivate");
    assert.equal(database.operations[0]!.token, caller.accessToken);
    assert.deepEqual(
      admin.calls.map((call) => call.name),
      ["setBan", "sessions_remove"],
    );
    assert.deepEqual(admin.calls[0]!.args, [TARGET, true]);
    assert.deepEqual(
      events.events.map((entry) => entry.event),
      ["deactivation"],
    );
  });

  it("keeps the change when the ban fails, retries it, and says the follow-up is still pending", async () => {
    const { deps, admin, events } = setup({}, { setBan: async () => unavailable });
    const result = await deactivateAccount(
      caller,
      { accountId: TARGET, idempotencyKey: "k2" },
      deps,
    );
    assert.deepEqual(result.state === "success" && result.data, {
      accountId: TARGET,
      followUp: "pending",
    });
    assert.equal(admin.calls.filter((call) => call.name === "setBan").length, 3, "retried");
    assert.ok(events.events.some((entry) => entry.event === "follow_up_failed"));
  });

  it("reports a pending follow-up when ending the sessions fails or throws", async () => {
    const failing = setup({ sessions_remove: () => envelope("denied", "admin_access_required") });
    assert.equal(
      (await deactivateAccount(caller, { accountId: TARGET, idempotencyKey: "k3" }, failing.deps))
        .state === "success",
      true,
    );
    assert.equal(failing.admin.calls.filter((call) => call.name === "sessions_remove").length, 3);
    const throwing = setup({
      sessions_remove: () => {
        throw new Error("network");
      },
    });
    const result = await deactivateAccount(
      caller,
      { accountId: TARGET, idempotencyKey: "k4" },
      throwing.deps,
    );
    assert.equal(result.state === "success" && result.data.followUp, "pending");
  });

  it("makes no follow-up call when the database refuses the change", async () => {
    const { deps, admin, events } = setup({}, {}, () => denied("authorization_denied"));
    const result = await deactivateAccount(
      caller,
      { accountId: TARGET, idempotencyKey: "k5" },
      deps,
    );
    assert.equal(result.state, "denied");
    assert.equal(admin.calls.length, 0);
    assert.equal(events.events.length, 0);
    const reactivated = await reactivateAccount(
      caller,
      { accountId: TARGET, idempotencyKey: "k6" },
      deps,
    );
    assert.equal(reactivated.state, "denied");
  });

  it("reactivates in the database and lifts the ban, reporting a pending follow-up when that fails", async () => {
    const done = setup();
    const result = await reactivateAccount(
      caller,
      { accountId: TARGET, idempotencyKey: "k7" },
      done.deps,
    );
    assert.deepEqual(result.state === "success" && result.data, {
      accountId: TARGET,
      followUp: "done",
    });
    assert.deepEqual(done.admin.calls[0]!.args, [TARGET, false]);
    assert.equal(done.database.operations[0]!.name, "account_reactivate");
    const pending = setup({}, { setBan: async () => unavailable });
    const late = await reactivateAccount(
      caller,
      { accountId: TARGET, idempotencyKey: "k8" },
      pending.deps,
    );
    assert.equal(late.state === "success" && late.data.followUp, "pending");
    assert.ok(pending.events.events.some((entry) => entry.event === "follow_up_failed"));
    assert.ok(ok(null).ok);
  });

  it("changes a grant as the signed-in admin and passes the database's answer through", async () => {
    const { deps, database, events } = setup();
    const result = await changeGrant(
      caller,
      {
        change: "add",
        subjectId: TARGET,
        role: "parent",
        scopeType: "family",
        scopeId: "f1",
        idempotencyKey: "k9",
      },
      deps,
    );
    assert.equal(result.state, "success");
    assert.equal(database.operations[0]!.name, "grant_change");
    assert.deepEqual(database.operations[0]!.args, {
      p_idempotency_key: "k9",
      p_change: "add",
      p_subject_id: TARGET,
      p_role: "parent",
      p_scope_type: "family",
      p_scope_id: "f1",
    });
    assert.deepEqual(
      events.events.map((entry) => [entry.event, entry.code]),
      [["grant_change", "add"]],
    );
    const refused = setup({}, {}, () => denied());
    const refusedResult = await changeGrant(
      caller,
      {
        change: "revoke",
        subjectId: TARGET,
        role: "parent",
        scopeType: "family",
        scopeId: "f1",
        idempotencyKey: "k10",
      },
      refused.deps,
    );
    assert.equal(refusedResult.state, "denied");
    assert.equal(refused.events.events.length, 0);
  });
});

// Regression (code review Minor 5): a failed ban or ban-lift used to be retried only by repeating the same call.
describe("reconciling accounts whose status and sign-in ban disagree", () => {
  const mismatches = (accounts: { account_id: string; status: string }[]) => ({
    identity_ban_mismatches: () => envelope("success", "done", null, { accounts }),
  });

  it("lifts the ban of a reactivated account and bans a deactivated one, ending its sessions", async () => {
    const { deps, admin, events } = setup(
      mismatches([
        { account_id: TARGET, status: "active" },
        { account_id: "77777777-7777-4777-8777-777777777777", status: "deactivated" },
      ]),
    );
    const result = await reconcileAccountBans(deps);
    assert.deepEqual(result, { checked: 2, repaired: 2, failed: 0 });
    assert.deepEqual(
      admin.calls.map((call) => [call.name, ...call.args.slice(0, 2)]),
      [
        ["identity_ban_mismatches", {}],
        ["setBan", TARGET, false],
        ["setBan", "77777777-7777-4777-8777-777777777777", true],
        ["sessions_remove", { p_user_id: "77777777-7777-4777-8777-777777777777" }],
      ],
    );
    assert.equal(events.events.filter((entry) => entry.event === "follow_up_reconciled").length, 2);
  });

  it("reports an account it could not repair and keeps going with the others", async () => {
    const { deps, events } = setup(mismatches([{ account_id: TARGET, status: "active" }]), {
      setBan: async () => unavailable,
    });
    const result = await reconcileAccountBans(deps);
    assert.deepEqual(result, { checked: 1, repaired: 0, failed: 1 });
    assert.ok(events.events.some((entry) => entry.event === "follow_up_failed"));
  });

  it("does nothing when nothing disagrees or the list cannot be read", async () => {
    const none = setup(mismatches([]));
    assert.deepEqual(await reconcileAccountBans(none.deps), { checked: 0, repaired: 0, failed: 0 });
    const down = setup({ identity_ban_mismatches: () => unavailable });
    assert.deepEqual(await reconcileAccountBans(down.deps), { checked: 0, repaired: 0, failed: 0 });
    assert.equal(down.admin.calls.length, 1);
  });
});
