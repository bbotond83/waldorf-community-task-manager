import assert from "node:assert/strict";
import test from "node:test";
import type { Scope } from "../access/index.ts";
import type { AdminOperation } from "../application/index.ts";
import { envelope, failure, fakeData, type FakeHandlers } from "../../tests/support/data-fakes.ts";
import { createAdminPort } from "./admin-port.ts";
import { TerminalDataFailure } from "./errors.ts";
import { createParentPort } from "./parent-port.ts";

const ORG = "aaaaaaaa-0000-4000-8000-000000000001";
const SCOPE: Scope = { id: ORG, type: "organization", organizationId: ORG };
const NOTICE = "eeeeeeee-0000-4000-8000-000000000001";
const JOB = "eeeeeeee-0000-4000-8000-000000000021";

const notice = (over: Record<string, unknown> = {}) => ({
  id: NOTICE,
  title: "Holnap: Havi takarítás",
  link: "/szulo/feladatok/ffffffff-0000-4000-8000-000000000001",
  is_read: false,
  timing: "24-hour",
  provider_status: "simulated-sent",
  ...over,
});

const reminder = (over: Record<string, unknown> = {}) => ({
  id: JOB,
  version: 2,
  title: "Havi takarítás — 24 órás emlékeztető",
  status: "retryable",
  attempt: 1,
  correlation_id: "corr-1",
  recipient_summary: "2 kijelölt család",
  provider_label: "Szimulált kézbesítés",
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

test("the notification list runs the lazy tick first, then reads the parent's own notices (BR40.2, BR40.6)", async () => {
  const { fake, port } = parent({
    rpc: (name) =>
      name === "notification_list"
        ? envelope("success", null, {
            items: [
              notice(),
              notice({
                id: "x2",
                is_read: true,
                timing: "stale",
                provider_status: "simulated-retry",
              }),
            ],
          })
        : envelope("success", null, { run: 1, sent: 1, failed: 0, dropped: 0 }),
  });
  const outcome = await port.listNotifications({ actorId: "ignored" });
  assert.deepEqual(names(fake), ["reminder_run_due", "notification_list"]);
  assert.deepEqual(fake.rpcCalls[0]!.args, {});
  assert.equal(outcome.state, "success");
  if (outcome.state !== "success") return;
  assert.deepEqual(outcome.data.notifications[0], {
    id: NOTICE,
    title: "Holnap: Havi takarítás",
    link: "/szulo/feladatok/ffffffff-0000-4000-8000-000000000001",
    isRead: false,
    timing: "24-hour",
    providerStatus: "simulated-sent",
  });
  assert.equal(outcome.data.notifications[1]!.isRead, true);
  assert.equal(outcome.data.notifications[1]!.timing, "stale");
});

test("a parent with no notices gets the empty state, and a denied caller gets denied (BR40.2)", async () => {
  const none = parent({ rpc: () => envelope("success", null, { items: [] }) });
  assert.deepEqual(await none.port.listNotifications({ actorId: "ignored" }), { state: "empty" });
  const denied = parent({ rpc: () => envelope("denied", "session_inactive") });
  assert.deepEqual(await denied.port.listNotifications({ actorId: "ignored" }), {
    state: "denied",
  });
});

test("a failed tick never hides the list: the list is read as it is (BR40.6)", async () => {
  for (const response of [
    failure("08006"),
    failure("XX000"),
    envelope("denied", "authorization_denied"),
  ]) {
    const { fake, port } = parent({
      rpc: (name) =>
        name === "reminder_run_due" ? response : envelope("success", null, { items: [notice()] }),
    });
    const outcome = await port.listNotifications({ actorId: "ignored" });
    assert.equal(outcome.state, "success");
    assert.deepEqual(names(fake), ["reminder_run_due", "notification_list"]);
  }
});

test("a notification value the adapter does not know is a terminal failure (BR32.4)", async () => {
  for (const bad of [
    notice({ timing: "tomorrow" }),
    notice({ provider_status: "sent" }),
    notice({ is_read: "no" }),
  ]) {
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

test("the reminder list ticks first, passes the status filter and shows counts only, never names (BR40.8)", async () => {
  const { fake, run } = admin({
    rpc: (name) =>
      name === "reminder_list"
        ? envelope("success", null, {
            items: [
              reminder(),
              reminder({ id: "j2", status: "sent", recipient_summary: "Nincs aktív címzett" }),
            ],
          })
        : envelope("success", null, { run: 0, sent: 0, failed: 0, dropped: 0 }),
  });
  const outcome = await run("reminders.list", { status: "retryable" });
  assert.deepEqual(names(fake), ["reminder_run_due", "reminder_list"]);
  assert.deepEqual(fake.rpcCalls[1]!.args, { p_status: "retryable" });
  assert.equal(outcome.state, "success");
  if (outcome.state !== "success") return;
  const jobs = (outcome.data as { jobs: Record<string, unknown>[] }).jobs;
  assert.deepEqual(jobs[0], {
    id: JOB,
    title: "Havi takarítás — 24 órás emlékeztető",
    status: "retryable",
    attempt: 1,
    correlationId: "corr-1",
    recipientSummary: "2 kijelölt család",
    providerLabel: "Szimulált kézbesítés",
    version: 2,
  });
  assert.equal(jobs.length, 2);
});

test("an empty reminder list is the empty state; a bad status filter and a denied caller keep their states (BR40.8, BR42.3)", async () => {
  const none = admin({ rpc: () => envelope("success", null, { items: [] }) });
  assert.deepEqual(await none.run("reminders.list"), { state: "empty" });
  assert.deepEqual(none.fake.rpcCalls[1]!.args, { p_status: null });
  const bad = admin({
    rpc: (name) =>
      name === "reminder_list" ? envelope("validation", "status_invalid") : envelope("success"),
  });
  assert.equal((await bad.run("reminders.list", { status: "nonsense" })).state, "validation");
  const denied = admin({ rpc: () => envelope("denied", "authorization_denied") });
  assert.deepEqual(await denied.run("reminders.list"), { state: "denied" });
});

test("a retry sends the job, the version and the key of its attempt, and answers that the retry is scheduled (BR40.7)", async () => {
  const { fake, run } = admin({
    rpc: () => envelope("success", null, { version: 3, status: "retrying" }, JOB),
  });
  const outcome = await run("reminders.retry", { id: JOB, expectedVersion: 2 }, "retry-key-001");
  assert.deepEqual(outcome, { state: "success", data: { jobId: JOB, status: "retry-scheduled" } });
  assert.deepEqual(fake.rpcCalls[0], {
    name: "reminder_retry",
    args: { p_idempotency_key: "retry-key-001", p_job_id: JOB, p_expected_version: 2 },
  });
  await run("reminders.retry", { id: JOB, expectedVersion: 2 }, "retry-key-002");
  assert.equal(
    fake.rpcCalls[1]!.args.p_idempotency_key,
    "retry-key-002",
    "a fresh key per attempt",
  );
});

test("the retry refusals keep their codes: not retryable is a conflict, a stale version is invalidated (BR42.3)", async () => {
  const notRetryable = admin({ rpc: () => envelope("conflict", "REMINDER_NOT_RETRYABLE") });
  assert.deepEqual(
    await notRetryable.run("reminders.retry", { id: JOB, expectedVersion: 2 }, "retry-key-003"),
    {
      state: "conflict",
      code: "REMINDER_NOT_RETRYABLE",
    },
  );
  const stale = admin({ rpc: () => envelope("invalidated", "REMINDER_STALE") });
  assert.deepEqual(
    await stale.run("reminders.retry", { id: JOB, expectedVersion: 1 }, "retry-key-004"),
    {
      state: "invalidated",
      code: "REMINDER_STALE",
    },
  );
  const denied = admin({ rpc: () => envelope("denied", "authorization_denied") });
  assert.deepEqual(
    await denied.run("reminders.retry", { id: JOB, expectedVersion: 1 }, "retry-key-005"),
    {
      state: "denied",
    },
  );
});

test("a retry for an id that names no job makes no call, and a missing key is refused by the function (BR40.7)", async () => {
  const { fake, run } = admin({ rpc: () => envelope("validation", "idempotency_key_invalid") });
  assert.deepEqual(
    await run("reminders.retry", { id: "nope", expectedVersion: 1 }, "retry-key-006"),
    {
      state: "denied",
    },
  );
  assert.equal(fake.rpcCalls.length, 0);
  const outcome = await run("reminders.retry", { id: JOB, expectedVersion: 1 });
  assert.equal(fake.rpcCalls[0]!.args.p_idempotency_key, "");
  assert.equal(outcome.state, "validation");
});

test("a reminder status the adapter does not know is a terminal failure (BR32.4)", async () => {
  const { run } = admin({
    rpc: (name) =>
      name === "reminder_list"
        ? envelope("success", null, { items: [reminder({ status: "exploded" })] })
        : envelope("success"),
  });
  await assert.rejects(run("reminders.list"), TerminalDataFailure);
});
