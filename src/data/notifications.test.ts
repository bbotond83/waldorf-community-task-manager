import assert from "node:assert/strict";
import test from "node:test";
import type { Scope } from "../access/index.ts";
import type { AdminOperation } from "../application/index.ts";
import { envelope, fakeData, type FakeHandlers } from "../../tests/support/data-fakes.ts";
import { createAdminPort } from "./admin-port.ts";
import { TerminalDataFailure } from "./errors.ts";
import { createParentPort } from "./parent-port.ts";

const ORG = "aaaaaaaa-0000-4000-8000-000000000001";
const SCOPE: Scope = { id: ORG, type: "organization", organizationId: ORG };
const NOTICE = "eeeeeeee-0000-4000-8000-000000000001";
const TARGET = "eeeeeeee-0000-4000-8000-000000000021";
const DELIVERY_1 = "dddddddd-0000-4000-8000-000000000001";
const DELIVERY_2 = "dddddddd-0000-4000-8000-000000000002";

const notice = (over: Record<string, unknown> = {}) => ({
  id: NOTICE,
  title: "Holnap: Havi takarítás",
  link: "/szulo/feladatok/ffffffff-0000-4000-8000-000000000001",
  is_read: false,
  timing: "24-hour",
  ...over,
});

const group = (over: Record<string, unknown> = {}) => ({
  kind: "reminder_24h",
  kind_label: "Emlékeztető 24 órával előtte",
  target_type: "task",
  target_id: TARGET,
  item_date: "2026-12-05",
  title: "Emlékeztető 24 órával előtte – 2026. 12. 05.",
  latest_try_at: "2026-12-04T08:15:00Z",
  failed_count: 2,
  reason: "mail_unavailable",
  deliveries: [
    { id: DELIVERY_1, try_count: 3 },
    { id: DELIVERY_2, try_count: 6 },
  ],
  ...over,
});

function parent(handlers: FakeHandlers) {
  const fake = fakeData(handlers);
  return { fake, port: createParentPort(fake.database) };
}

function admin(handlers: FakeHandlers) {
  const fake = fakeData(handlers);
  const adapter = createAdminPort(fake.database);
  const run = (operation: AdminOperation, payload: Record<string, unknown> = {}, key?: string) =>
    adapter.execute<unknown>({
      actorId: "ignored",
      operation,
      scope: SCOPE,
      payload,
      ...(key !== undefined ? { idempotencyKey: key } : {}),
    });
  return { fake, run };
}

const names = (fake: ReturnType<typeof fakeData>) => fake.rpcCalls.map((call) => call.name);

test("the notification list reads the parent's own notices with one call and runs nothing else (BR40.2)", async () => {
  const { fake, port } = parent({
    rpc: () =>
      envelope("success", null, {
        items: [notice(), notice({ id: "x2", is_read: true, timing: "stale" })],
      }),
  });
  const outcome = await port.listNotifications({ actorId: "ignored" });
  assert.deepEqual(names(fake), ["notification_list"]);
  assert.deepEqual(fake.rpcCalls[0]!.args, {});
  assert.equal(outcome.state, "success");
  if (outcome.state !== "success") return;
  assert.deepEqual(outcome.data.notifications[0], {
    id: NOTICE,
    title: "Holnap: Havi takarítás",
    link: "/szulo/feladatok/ffffffff-0000-4000-8000-000000000001",
    isRead: false,
    timing: "24-hour",
  });
  assert.equal(outcome.data.notifications[1]!.isRead, true);
  assert.equal(outcome.data.notifications[1]!.timing, "stale");
});

test("a notice whose item is gone has no link and falls back to the notice list; a rota line is kept (BR40.4)", async () => {
  const { port } = parent({
    rpc: () =>
      envelope("success", null, {
        items: [notice({ link: null, text: "2026. 12. 07. – 12. 11." })],
      }),
  });
  const outcome = await port.listNotifications({ actorId: "ignored" });
  assert.equal(outcome.state, "success");
  if (outcome.state !== "success") return;
  assert.equal(outcome.data.notifications[0]!.link, "/szulo/ertesitesek");
  assert.equal(outcome.data.notifications[0]!.text, "2026. 12. 07. – 12. 11.");
});

test("a parent with no notices gets the empty state, and a denied caller gets denied (BR40.2)", async () => {
  const none = parent({ rpc: () => envelope("success", null, { items: [] }) });
  assert.deepEqual(await none.port.listNotifications({ actorId: "ignored" }), { state: "empty" });
  const denied = parent({ rpc: () => envelope("denied", "session_inactive") });
  assert.deepEqual(await denied.port.listNotifications({ actorId: "ignored" }), {
    state: "denied",
  });
});

test("a notification value the adapter does not know is a terminal failure (BR32.4)", async () => {
  for (const bad of [notice({ timing: "tomorrow" }), notice({ is_read: "no" })]) {
    const { port } = parent({
      rpc: (name) =>
        name === "notification_list"
          ? envelope("success", null, { items: [bad] })
          : envelope("success"),
    });
    await assert.rejects(port.listNotifications({ actorId: "ignored" }), TerminalDataFailure);
  }
});

test("marking a notice read returns the link to follow, and another parent's notice reads as denied (BR40.3)", async () => {
  const { fake, port } = parent({
    rpc: () => envelope("success", null, { link: "/szulo/feladatok/abc" }, NOTICE),
  });
  const outcome = await port.markNotificationRead({ actorId: "ignored", notificationId: NOTICE });
  assert.deepEqual(outcome, { state: "success", data: { link: "/szulo/feladatok/abc" } });
  const gone = parent({ rpc: () => envelope("success", null, { link: null }, NOTICE) });
  assert.deepEqual(
    await gone.port.markNotificationRead({ actorId: "ignored", notificationId: NOTICE }),
    {
      state: "success",
      data: { link: "/szulo/ertesitesek" },
    },
  );
  assert.deepEqual(fake.rpcCalls, [
    { name: "notification_mark_read", args: { p_notification_id: NOTICE } },
  ]);
  const other = parent({ rpc: () => envelope("denied", "authorization_denied") });
  assert.deepEqual(
    await other.port.markNotificationRead({ actorId: "x", notificationId: NOTICE }),
    {
      state: "denied",
    },
  );
});

test("an id that is not a uuid names no notice and makes no call (BR40.3)", async () => {
  const { fake, port } = parent({});
  assert.deepEqual(await port.markNotificationRead({ actorId: "x", notificationId: "../etc" }), {
    state: "denied",
  });
  assert.deepEqual(fake.rpcCalls, []);
});

test("the failure list reads groups and failed checks with one call and shows counts and ids only (BR53.1, NFR1.3)", async () => {
  const { fake, run } = admin({
    rpc: () =>
      envelope("success", null, {
        groups: [group()],
        checks: [
          {
            check_name: "duty_reminders",
            run_kind: "daily",
            started_at: "2026-12-04T05:00:00Z",
            outcome: "failed",
            error_code: "XX000",
            created: 0,
            skipped: 12,
          },
          {
            check_name: "housekeeping",
            run_kind: "daily",
            started_at: "2026-12-03T05:00:00Z",
            outcome: "missing",
            error_code: null,
            created: 0,
            skipped: 0,
          },
        ],
      }),
  });
  const outcome = await run("reminders.list");
  assert.deepEqual(names(fake), ["delivery_problems_list"]);
  assert.deepEqual(fake.rpcCalls[0]!.args, {});
  assert.equal(outcome.state, "success");
  if (outcome.state !== "success") return;
  const data = outcome.data as {
    groups: Record<string, unknown>[];
    checks: Record<string, unknown>[];
  };
  assert.deepEqual(data.groups[0], {
    kind: "reminder_24h",
    kindLabel: "Emlékeztető 24 órával előtte",
    targetType: "task",
    targetId: TARGET,
    title: "Emlékeztető 24 órával előtte – 2026. 12. 05.",
    latestTryAt: "2026-12-04T08:15:00Z",
    failedCount: 2,
    reason: "mail_unavailable",
    deliveries: [
      { id: DELIVERY_1, tryCount: 3 },
      { id: DELIVERY_2, tryCount: 6 },
    ],
  });
  assert.deepEqual(data.checks, [
    {
      checkName: "duty_reminders",
      runKind: "daily",
      startedAt: "2026-12-04T05:00:00Z",
      outcome: "failed",
      created: 0,
      skipped: 12,
      errorCode: "XX000",
    },
    {
      checkName: "housekeeping",
      runKind: "daily",
      startedAt: "2026-12-03T05:00:00Z",
      outcome: "missing",
      created: 0,
      skipped: 0,
    },
  ]);
});

test("nothing failed is the empty state; a denied caller keeps its state (BR53.1)", async () => {
  const none = admin({ rpc: () => envelope("success", null, { groups: [], checks: [] }) });
  assert.deepEqual(await none.run("reminders.list"), { state: "empty" });
  const denied = admin({ rpc: () => envelope("denied", "authorization_denied") });
  assert.deepEqual(await denied.run("reminders.list"), { state: "denied" });
});

test("a failed check alone is still a list to show", async () => {
  const { run } = admin({
    rpc: () =>
      envelope("success", null, {
        groups: [],
        checks: [
          {
            check_name: "housekeeping",
            run_kind: "daily",
            started_at: "2026-12-03T05:00:00Z",
            outcome: "missing",
            error_code: null,
            created: 0,
            skipped: 0,
          },
        ],
      }),
  });
  assert.equal((await run("reminders.list")).state, "success");
});

test("Try again sends the kind, the item and the shown (id, try count) list with its own key (BR53.3)", async () => {
  const { fake, run } = admin({
    rpc: () => envelope("success", null, { restarted: 2 }, TARGET),
  });
  const expected = [
    { id: DELIVERY_1, tryCount: 3 },
    { id: DELIVERY_2, tryCount: 6 },
  ];
  const outcome = await run(
    "reminders.retry",
    { id: TARGET, expectedVersion: 2, kind: "reminder_24h", targetType: "task", expected },
    "retry-key-001",
  );
  assert.deepEqual(outcome, { state: "success", data: { targetId: TARGET, restarted: 2 } });
  assert.deepEqual(fake.rpcCalls[0], {
    name: "delivery_retry",
    args: {
      p_idempotency_key: "retry-key-001",
      p_kind: "reminder_24h",
      p_target_type: "task",
      p_target_id: TARGET,
      p_expected: [
        { id: DELIVERY_1, try_count: 3 },
        { id: DELIVERY_2, try_count: 6 },
      ],
    },
  });
});

test("the retry refusals keep their codes: nothing failed is a conflict, a changed list is invalidated (BR53.3)", async () => {
  const body = {
    id: TARGET,
    expectedVersion: 1,
    kind: "reminder_24h",
    targetType: "task",
    expected: [{ id: DELIVERY_1, tryCount: 3 }],
  };
  const notRetryable = admin({ rpc: () => envelope("conflict", "REMINDER_NOT_RETRYABLE") });
  assert.deepEqual(await notRetryable.run("reminders.retry", body, "retry-key-003"), {
    state: "conflict",
    code: "REMINDER_NOT_RETRYABLE",
  });
  const stale = admin({ rpc: () => envelope("invalidated", "REMINDER_STALE") });
  assert.deepEqual(await stale.run("reminders.retry", body, "retry-key-004"), {
    state: "invalidated",
    code: "REMINDER_STALE",
  });
  const denied = admin({ rpc: () => envelope("denied", "authorization_denied") });
  assert.deepEqual(await denied.run("reminders.retry", body, "retry-key-005"), { state: "denied" });
});

test("a retry that names no valid item or carries no list makes no call, and a missing key is refused by the function (BR53.3)", async () => {
  const { fake, run } = admin({ rpc: () => envelope("validation", "idempotency_key_invalid") });
  const base = { expectedVersion: 1, kind: "reminder_24h", targetType: "task" };
  const list = [{ id: DELIVERY_1, tryCount: 3 }];
  for (const body of [
    { ...base, id: "nope", expected: list },
    { ...base, id: TARGET },
    { ...base, id: TARGET, expected: list, kind: undefined },
    { ...base, id: TARGET, expected: list, targetType: undefined },
  ]) {
    assert.deepEqual(await run("reminders.retry", body, "retry-key-006"), { state: "denied" });
  }
  assert.equal(fake.rpcCalls.length, 0);
  const outcome = await run("reminders.retry", { ...base, id: TARGET, expected: list });
  assert.equal(fake.rpcCalls[0]!.args.p_idempotency_key, "");
  assert.equal(outcome.state, "validation");
});

test("a check outcome the adapter does not know is a terminal failure (BR32.4)", async () => {
  const { run } = admin({
    rpc: () =>
      envelope("success", null, {
        groups: [],
        checks: [
          {
            check_name: "x",
            run_kind: "daily",
            started_at: "t",
            outcome: "exploded",
            error_code: null,
          },
        ],
      }),
  });
  await assert.rejects(run("reminders.list"), TerminalDataFailure);
});
