import assert from "node:assert/strict";
import test from "node:test";
import { envelope, fakeData, type FakeHandlers } from "../../tests/support/data-fakes.ts";
import { TerminalDataFailure } from "./errors.ts";
import { createParentPort, PARENT_NOTIFICATION_USE_CASES } from "./parent-port.ts";

const id = (n: number) => `cccccccc-0000-4000-8000-${String(n).padStart(12, "0")}`;
const KEY = "signup:abc:v1";

function port(handlers: FakeHandlers) {
  const fake = fakeData(handlers);
  return { fake, port: createParentPort(fake.database) };
}

const dutyItem = (extra: Record<string, unknown> = {}) => ({
  id: id(1),
  title: "Sütés",
  due_at: "2026-11-02T10:00:00+00:00",
  location: "Konyha",
  version: 4,
  state: "available",
  assignment_id: null,
  assignment_version: null,
  ...extra,
});

test("the duty list maps every state and reports the family's own place version when it has one", async () => {
  const items = [
    dutyItem({ state: "available" }),
    dutyItem({ id: id(2), state: "full" }),
    dutyItem({ id: id(3), state: "ineligible" }),
    dutyItem({ id: id(4), state: "assigned", assignment_id: id(40), assignment_version: 7 }),
    dutyItem({ id: id(5), state: "swap-pending", assignment_id: id(50), assignment_version: 2 }),
    dutyItem({
      id: id(6),
      state: "cancellation-pending",
      assignment_id: id(60),
      assignment_version: 3,
    }),
  ];
  const { port: parent } = port({ rpc: () => envelope("success", null, { items }) });
  const outcome = await parent.listDuties({ actorId: "ignored", familyId: "ignored" });
  assert.equal(outcome.state, "success");
  if (outcome.state !== "success") return;
  assert.deepEqual(
    outcome.data.duties.map((duty) => [duty.state, duty.version]),
    [
      ["available", 4],
      ["full", 4],
      ["ineligible", 4],
      ["assigned", 7],
      ["swap-pending", 2],
      ["cancellation-pending", 3],
    ],
  );
  assert.equal(outcome.data.duties[0]?.dueAt, "2026-11-02T10:00:00+00:00");
});

test("an empty list is the empty state and an account with no family is denied", async () => {
  const empty = port({ rpc: () => envelope("success", null, { items: [] }) });
  assert.deepEqual(await empty.port.listDuties({ actorId: "a", familyId: "f" }), {
    state: "empty",
  });
  const denied = port({ rpc: () => envelope("denied", "no_family") });
  assert.deepEqual(await denied.port.listDuties({ actorId: "a", familyId: "f" }), {
    state: "denied",
  });
});

test("the family comes from the database: the caller's actor and family are never sent", async () => {
  const { fake, port: parent } = port({ rpc: () => envelope("success", null, { items: [] }) });
  await parent.listDuties({ actorId: "someone-else", familyId: "another-family" });
  await parent.listNotifications({ actorId: "someone-else" });
  const sent = JSON.stringify(fake.rpcCalls);
  assert.doesNotMatch(sent, /someone-else|another-family/);
  assert.deepEqual(fake.rpcCalls, [
    { name: "duty_list", args: {} },
    { name: "reminder_run_due", args: {} },
    { name: "notification_list", args: {} },
  ]);
});

test("the duty detail carries the notes only when the database returns them", async () => {
  const { fake, port: parent } = port({
    rpc: () =>
      envelope("success", null, {
        item: dutyItem({
          state: "assigned",
          assignment_id: id(40),
          assignment_version: 7,
          allergen_note: "mogyoró",
          own_contribution_note: "Almás pite",
        }),
      }),
  });
  const outcome = await parent.getDuty?.({ actorId: "a", familyId: "f", dutyId: id(1) });
  assert.equal(outcome?.state, "success");
  if (outcome?.state === "success") {
    assert.equal(outcome.data.assignmentId, id(40));
    assert.equal(outcome.data.allergenNote, "mogyoró");
    assert.equal(outcome.data.ownContributionNote, "Almás pite");
    assert.equal(outcome.data.version, 7);
    assert.equal(outcome.data.location, "Konyha");
  }
  assert.deepEqual(fake.rpcCalls[0], { name: "duty_get", args: { p_task_id: id(1) } });
  const plain = port({ rpc: () => envelope("success", null, { item: dutyItem() }) });
  const detail = await plain.port.getDuty?.({ actorId: "a", familyId: "f", dutyId: id(1) });
  assert.ok(detail?.state === "success" && !("allergenNote" in detail.data));
});

test("an id that is not a uuid, and a task that does not exist, both read as denied", async () => {
  const { fake, port: parent } = port({ rpc: () => envelope("validation", "duty_not_found") });
  assert.deepEqual(await parent.getDuty?.({ actorId: "a", familyId: "f", dutyId: "nope" }), {
    state: "denied",
  });
  assert.equal(fake.rpcCalls.length, 0, "no call is made for a malformed id");
  assert.deepEqual(await parent.getDuty?.({ actorId: "a", familyId: "f", dutyId: id(9) }), {
    state: "denied",
  });
});

test("signing up sends the key and version and returns the new place", async () => {
  const { fake, port: parent } = port({
    rpc: () => envelope("success", null, { version: 1, task_version: 5 }, id(70)),
  });
  const outcome = await parent.signUp({
    actorId: "a",
    familyId: "f",
    dutyId: id(1),
    expectedVersion: 4,
    idempotencyKey: KEY,
  });
  assert.deepEqual(outcome, {
    state: "success",
    data: { id: id(70), state: "assigned", version: 1 },
  });
  assert.deepEqual(fake.rpcCalls[0], {
    name: "duty_sign_up",
    args: { p_idempotency_key: KEY, p_task_id: id(1), p_expected_version: 4 },
  });
});

test("a repeated sign-up key answers with the stored place and version 1", async () => {
  const { port: parent } = port({ rpc: () => envelope("success", "replayed", {}, id(70)) });
  const outcome = await parent.signUp({
    actorId: "a",
    familyId: "f",
    dutyId: id(1),
    expectedVersion: 4,
    idempotencyKey: KEY,
  });
  assert.deepEqual(outcome, {
    state: "success",
    data: { id: id(70), state: "assigned", version: 1 },
  });
});

test("every sign-up refusal keeps the state and code the screen maps", async () => {
  const cases: [string, string][] = [
    ["invalidated", "DUTY_VERSION_STALE"],
    ["conflict", "DUTY_CLOSED"],
    ["conflict", "DUTY_ALREADY_ASSIGNED"],
    ["conflict", "DUTY_FULL"],
  ];
  for (const [state, code] of cases) {
    const { port: parent } = port({ rpc: () => envelope(state, code) });
    const outcome = await parent.signUp({
      actorId: "a",
      familyId: "f",
      dutyId: id(1),
      expectedVersion: 1,
      idempotencyKey: KEY,
    });
    assert.deepEqual(outcome, { state, code });
  }
});

test("a command without an idempotency key is refused before any call", async () => {
  const { fake, port: parent } = port({});
  const refused = await parent.signUp({
    actorId: "a",
    familyId: "f",
    dutyId: id(1),
    expectedVersion: 1,
  });
  assert.equal(refused.state, "validation");
  const swap = await parent.requestSwap({
    actorId: "a",
    familyId: "f",
    assignmentId: id(1),
    counterpartId: id(2),
    expectedVersion: 1,
    counterpartVersion: 1,
  });
  assert.equal(swap.state, "validation");
  assert.equal(fake.rpcCalls.length, 0);
});

test("a swap request sends both versions and the reason", async () => {
  const { fake, port: parent } = port({
    rpc: () => envelope("success", null, { assignment_version: 3 }, id(80)),
  });
  const outcome = await parent.requestSwap({
    actorId: "a",
    familyId: "f",
    assignmentId: id(1),
    counterpartId: id(2),
    expectedVersion: 2,
    counterpartVersion: 5,
    reason: "beteg a gyerek",
    idempotencyKey: KEY,
  });
  assert.deepEqual(outcome, { state: "success", data: { id: id(80), state: "pending" } });
  assert.deepEqual(fake.rpcCalls[0]?.args, {
    p_idempotency_key: KEY,
    p_assignment_id: id(1),
    p_expected_version: 2,
    p_target_assignment_id: id(2),
    p_target_version: 5,
    p_reason: "beteg a gyerek",
  });
});

test("a swap request without the partner's version is a field error, and a bad id is denied", async () => {
  const { port: parent } = port({});
  const missing = await parent.requestSwap({
    actorId: "a",
    familyId: "f",
    assignmentId: id(1),
    counterpartId: id(2),
    expectedVersion: 2,
    idempotencyKey: KEY,
  });
  assert.deepEqual(missing, {
    state: "validation",
    fieldErrors: { counterpartVersion: "VAL-EXPECTED-VERSION" },
    code: "field_invalid",
  });
  const bad = await parent.requestSwap({
    actorId: "a",
    familyId: "f",
    assignmentId: "placeholder",
    counterpartId: id(2),
    expectedVersion: 2,
    counterpartVersion: 1,
    idempotencyKey: KEY,
  });
  assert.deepEqual(bad, { state: "denied" });
});

test("swap and cancellation refusals keep their codes", async () => {
  for (const [state, code] of [
    ["invalidated", "REQUEST_VERSION_STALE"],
    ["conflict", "REQUEST_DUPLICATE"],
    ["conflict", "REQUEST_CONFLICT"],
    ["conflict", "DUTY_ALREADY_ASSIGNED"],
    ["conflict", "SWAP_CANNOT_BE_APPLIED"],
  ] as const) {
    const { port: parent } = port({ rpc: () => envelope(state, code) });
    const outcome = await parent.requestCancellation({
      actorId: "a",
      familyId: "f",
      assignmentId: id(1),
      expectedVersion: 1,
      idempotencyKey: KEY,
    });
    assert.deepEqual(outcome, { state, code });
  }
});

test("a cancellation request creates a pending request and sends no reason when none was given", async () => {
  const { fake, port: parent } = port({ rpc: () => envelope("success", null, {}, id(81)) });
  const outcome = await parent.requestCancellation({
    actorId: "a",
    familyId: "f",
    assignmentId: id(1),
    expectedVersion: 1,
    idempotencyKey: KEY,
  });
  assert.deepEqual(outcome, { state: "success", data: { id: id(81), state: "pending" } });
  assert.equal(fake.rpcCalls[0]?.args.p_reason, null);
  const bad = await parent.requestCancellation({
    actorId: "a",
    familyId: "f",
    assignmentId: "x",
    expectedVersion: 1,
    idempotencyKey: KEY,
  });
  assert.deepEqual(bad, { state: "denied" });
});

test("the swap partners list shows title, date and family name only", async () => {
  const items = [
    {
      assignment_id: id(2),
      assignment_version: 3,
      task_id: id(20),
      title: "Díszítés",
      starts_at: "2026-11-03T10:00:00+00:00",
      family_display_name: "Napraforgó család",
    },
  ];
  const { fake, port: parent } = port({ rpc: () => envelope("success", null, { items }) });
  const outcome = await parent.listSwapCandidates?.({
    actorId: "a",
    familyId: "f",
    assignmentId: id(1),
  });
  assert.deepEqual(outcome, {
    state: "success",
    data: {
      candidates: [
        {
          assignmentId: id(2),
          assignmentVersion: 3,
          taskId: id(20),
          title: "Díszítés",
          startsAt: "2026-11-03T10:00:00+00:00",
          familyDisplayName: "Napraforgó család",
        },
      ],
    },
  });
  assert.deepEqual(fake.rpcCalls[0], { name: "swap_candidates", args: { p_assignment_id: id(1) } });
  const none = port({ rpc: () => envelope("success", null, { items: [] }) });
  assert.deepEqual(
    await none.port.listSwapCandidates?.({ actorId: "a", familyId: "f", assignmentId: id(1) }),
    { state: "empty" },
  );
  assert.deepEqual(
    await none.port.listSwapCandidates?.({ actorId: "a", familyId: "f", assignmentId: "x" }),
    { state: "denied" },
  );
});

test("answering a swap request reports the exchange or the decline", async () => {
  const applied = port({ rpc: () => envelope("success", null, { outcome: "applied" }, id(90)) });
  assert.deepEqual(
    await applied.port.respondToSwap?.({
      actorId: "a",
      familyId: "f",
      requestId: id(90),
      accept: true,
      expectedVersion: 1,
      idempotencyKey: KEY,
    }),
    { state: "success", data: { id: id(90), outcome: "applied" } },
  );
  assert.deepEqual(applied.fake.rpcCalls[0]?.args, {
    p_idempotency_key: KEY,
    p_request_id: id(90),
    p_accept: true,
    p_expected_version: 1,
  });
  const declined = port({ rpc: () => envelope("success", null, { outcome: "declined" }, id(90)) });
  const answer = await declined.port.respondToSwap?.({
    actorId: "a",
    familyId: "f",
    requestId: id(90),
    accept: false,
    idempotencyKey: KEY,
  });
  assert.deepEqual(answer, { state: "success", data: { id: id(90), outcome: "declined" } });
  assert.equal(declined.fake.rpcCalls[0]?.args.p_expected_version, null);
});

test("a repeated answer is read from what the family sent", async () => {
  const { port: parent } = port({ rpc: () => envelope("success", "replayed", {}, id(90)) });
  const yes = await parent.respondToSwap?.({
    actorId: "a",
    familyId: "f",
    requestId: id(90),
    accept: true,
    idempotencyKey: KEY,
  });
  assert.deepEqual(yes, { state: "success", data: { id: id(90), outcome: "applied" } });
  const no = await parent.respondToSwap?.({
    actorId: "a",
    familyId: "f",
    requestId: id(90),
    accept: false,
    idempotencyKey: KEY,
  });
  assert.deepEqual(no, { state: "success", data: { id: id(90), outcome: "declined" } });
});

test("answering refusals: not open, cannot be applied, stale request", async () => {
  for (const [state, code] of [
    ["conflict", "SWAP_REQUEST_NOT_OPEN"],
    ["conflict", "SWAP_CANNOT_BE_APPLIED"],
    ["invalidated", "REQUEST_VERSION_STALE"],
  ] as const) {
    const { port: parent } = port({ rpc: () => envelope(state, code) });
    const outcome = await parent.respondToSwap?.({
      actorId: "a",
      familyId: "f",
      requestId: id(90),
      accept: true,
      idempotencyKey: KEY,
    });
    assert.deepEqual(outcome, { state, code });
  }
  const { port: parent } = port({});
  assert.equal(
    (await parent.respondToSwap?.({ actorId: "a", familyId: "f", requestId: id(90), accept: true }))
      ?.state,
    "validation",
  );
  assert.deepEqual(
    await parent.respondToSwap?.({
      actorId: "a",
      familyId: "f",
      requestId: "x",
      accept: true,
      idempotencyKey: KEY,
    }),
    { state: "denied" },
  );
});

test("withdrawing a request returns the withdrawn request", async () => {
  const { fake, port: parent } = port({ rpc: () => envelope("success", null, {}, id(91)) });
  const outcome = await parent.withdrawRequest?.({
    actorId: "a",
    familyId: "f",
    requestId: id(91),
    idempotencyKey: KEY,
  });
  assert.deepEqual(outcome, { state: "success", data: { id: id(91), state: "withdrawn" } });
  assert.deepEqual(fake.rpcCalls[0], {
    name: "swap_withdraw",
    args: { p_idempotency_key: KEY, p_request_id: id(91) },
  });
  assert.equal(
    (await parent.withdrawRequest?.({ actorId: "a", familyId: "f", requestId: id(91) }))?.state,
    "validation",
  );
  assert.deepEqual(
    await parent.withdrawRequest?.({
      actorId: "a",
      familyId: "f",
      requestId: "no",
      idempotencyKey: KEY,
    }),
    { state: "denied" },
  );
});

test("the family's open requests carry the kind and direction, with the partner only for a swap", async () => {
  const items = [
    {
      request_id: id(1),
      kind: "swap",
      version: 1,
      direction: "incoming",
      own_task_title: "Díszítés",
      own_task_starts_at: "2026-11-03T10:00:00+00:00",
      partner_task_title: "Sütés",
      partner_task_starts_at: "2026-11-02T10:00:00+00:00",
      partner_family_name: "Fenyő család",
    },
    {
      request_id: id(2),
      kind: "cancellation",
      version: 2,
      direction: "outgoing",
      own_task_title: "Sütés",
      own_task_starts_at: "2026-11-02T10:00:00+00:00",
      partner_task_title: null,
      partner_task_starts_at: null,
      partner_family_name: null,
    },
  ];
  const { port: parent } = port({ rpc: () => envelope("success", null, { items }) });
  const outcome = await parent.listSwapRequests?.({ actorId: "a", familyId: "f" });
  assert.equal(outcome?.state, "success");
  if (outcome?.state !== "success") return;
  assert.equal(outcome.data.requests[0]?.partnerFamilyName, "Fenyő család");
  assert.equal(outcome.data.requests[0]?.direction, "incoming");
  assert.ok(!("partnerFamilyName" in (outcome.data.requests[1] ?? {})));
  assert.equal(outcome.data.requests[1]?.kind, "cancellation");
  const none = port({ rpc: () => envelope("success", null, { items: [] }) });
  assert.deepEqual(await none.port.listSwapRequests?.({ actorId: "a", familyId: "f" }), {
    state: "empty",
  });
});

test("a response of the wrong shape is a terminal failure, not a guess", async () => {
  const { port: parent } = port({
    rpc: () => envelope("success", null, { items: [{ ...dutyItem(), state: "mystery" }] }),
  });
  await assert.rejects(parent.listDuties({ actorId: "a", familyId: "f" }), TerminalDataFailure);
});

test("a parent with no notices has the empty state, and a notification id that names nothing is denied without a call", async () => {
  const { fake, port: parent } = port({ rpc: () => envelope("success", null, { items: [] }) });
  assert.deepEqual(await parent.listNotifications({ actorId: "a" }), { state: "empty" });
  fake.rpcCalls.length = 0;
  assert.deepEqual(await parent.markNotificationRead({ actorId: "a", notificationId: "n" }), {
    state: "denied",
  });
  assert.equal(fake.rpcCalls.length, 0);
});

test("the contribution note is saved against the duty and returned trimmed", async () => {
  const { fake, port: parent } = port({ rpc: () => envelope("success", null, {}, id(99)) });
  const outcome = await parent.updateOwnContribution({
    actorId: "a",
    eventId: id(1),
    note: "  Almás pite  ",
    idempotencyKey: KEY,
  });
  assert.deepEqual(outcome, { state: "success", data: { eventId: id(1), note: "Almás pite" } });
  assert.deepEqual(fake.rpcCalls[0], {
    name: "contribution_save",
    args: { p_idempotency_key: KEY, p_task_id: id(1), p_text: "  Almás pite  " },
  });
  assert.equal(
    (await parent.updateOwnContribution({ actorId: "a", eventId: id(1), note: "x" })).state,
    "validation",
  );
  assert.deepEqual(
    await parent.updateOwnContribution({
      actorId: "a",
      eventId: "x",
      note: "x",
      idempotencyKey: KEY,
    }),
    { state: "denied" },
  );
});

test("the parent use cases that change assignments are listed for U4", () => {
  assert.deepEqual(
    [...PARENT_NOTIFICATION_USE_CASES],
    ["duty.sign_up", "swap.request", "swap.respond", "swap.withdraw", "cancellation.request"],
  );
});
