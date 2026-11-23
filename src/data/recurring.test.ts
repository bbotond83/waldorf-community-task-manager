import assert from "node:assert/strict";
import test from "node:test";
import { envelope, fakeData, type FakeHandlers } from "../../tests/support/data-fakes.ts";
import { recurringMessage } from "./copy.ts";
import { createRecurringPort } from "./recurring.ts";

const id = (n: number) => `dddddddd-0000-4000-8000-${String(n).padStart(12, "0")}`;
const KEY = "recurring-key-0001";

function port(handlers: FakeHandlers) {
  const fake = fakeData(handlers);
  return { fake, port: createRecurringPort(fake.database) };
}

const open = {
  id: id(1),
  schedule_id: id(10),
  title: "Játszótér körbejárása",
  category: "karbantartás",
  owner_kind: "group",
  working_group_id: id(20),
  due_date: "2026-11-30",
  status: "open",
  is_overdue: true,
  version: 1,
  done_by_display_name: null,
  done_at: null,
  skipped_reason: null,
  skipped_by_display_name: null,
  can_mark_done: true,
  can_undo: false,
  can_skip: true,
};
const done = {
  ...open,
  id: id(2),
  status: "done",
  is_overdue: false,
  version: 2,
  done_by_display_name: "korábbi tag",
  done_at: "2026-11-29T09:00:00+00:00",
  can_mark_done: false,
  can_undo: true,
  can_skip: false,
};
const skipped = {
  ...open,
  id: id(3),
  status: "skipped",
  skipped_reason: "Havazás",
  skipped_by_display_name: "adminisztrátor",
  can_mark_done: false,
  can_skip: false,
};
const schedule = {
  id: id(10),
  title: "Játszótér körbejárása",
  category: "karbantartás",
  owner_kind: "group",
  working_group_id: id(20),
  family_id: null,
  rota_job: null,
  interval_kind: "weeks",
  interval_count: 4,
  start_date: "2026-08-31",
  season_from_month: null,
  season_to_month: null,
  is_active: true,
  status: "active",
  version: 3,
};

test("a group page is one function call and carries its schedules, items, history and what the caller may do", async () => {
  const { port: recurring, fake } = port({
    rpc: () =>
      envelope("success", null, {
        group: { id: id(20), name: "Kert", status: "active" },
        schedules: [{ ...schedule, season_from_month: 4, season_to_month: 10 }],
        items: [open, done, skipped],
        history: [done],
        caller: { can_manage: true, can_mark: true },
      }),
  });
  const outcome = await recurring.groupList(id(20));
  assert.equal(outcome.state, "success");
  if (outcome.state !== "success") return;
  assert.deepEqual(outcome.data.group, { id: id(20), name: "Kert", status: "active" });
  assert.deepEqual(
    outcome.data.items.map((item) => [item.status, item.isOverdue, item.canMarkDone, item.canUndo]),
    [
      ["open", true, true, false],
      ["done", false, false, true],
      ["skipped", true, false, false],
    ],
  );
  assert.equal(outcome.data.items[1]?.doneByDisplayName, "korábbi tag");
  assert.equal(outcome.data.items[2]?.skippedReason, "Havazás");
  assert.equal(outcome.data.items[2]?.skippedByDisplayName, "adminisztrátor");
  assert.equal(outcome.data.items[0]?.doneByDisplayName, undefined);
  assert.equal(outcome.data.history.length, 1);
  assert.deepEqual(
    [outcome.data.schedules[0]?.seasonFromMonth, outcome.data.schedules[0]?.seasonToMonth],
    [4, 10],
  );
  assert.deepEqual([outcome.data.canManage, outcome.data.canMark], [true, true]);
  assert.ok(Object.isFrozen(outcome.data) && Object.isFrozen(outcome.data.items[0]));
  assert.deepEqual(fake.rpcCalls, [
    { name: "recurring_list_for_group", args: { p_group_id: id(20) } },
  ]);
});

test("every page reads with exactly one database call (NFR9.4)", async () => {
  const bodies: Record<string, Record<string, unknown>> = {
    recurring_list_for_group: {
      group: { id: id(20), name: "Kert", status: "active" },
      schedules: [],
      items: [],
      history: [],
      caller: { can_manage: false, can_mark: false },
    },
    recurring_occurrence_get: { item: open, schedule },
    recurring_my_occurrences: { items: [{ ...open, group_name: "Kert" }] },
    recurring_bottle_for_duty: { items: [open] },
    recurring_list_admin: { items: [{ ...schedule, family_display_name: "Mogyoró család" }] },
    recurring_schedule_get: { schedule, caller: { can_manage: false } },
  };
  const { port: recurring, fake } = port({
    rpc: (name) => envelope("success", null, bodies[name]),
  });
  const pages = [
    () => recurring.groupList(id(20)),
    () => recurring.card(id(1)),
    () => recurring.mine(),
    () => recurring.bottle(id(30)),
    () => recurring.adminList(),
    () => recurring.scheduleGet(id(10)),
  ];
  for (const [index, page] of pages.entries()) {
    const before = fake.rpcCalls.length;
    const outcome = await page();
    assert.equal(outcome.state, "success", `page ${index}`);
    assert.equal(fake.rpcCalls.length - before, 1, `page ${index}`);
  }
  assert.deepEqual(
    fake.rpcCalls.map((call) => call.name),
    Object.keys(bodies),
  );
});

test("the card, my duties, the bottle line, the admin list and a schedule carry their parts", async () => {
  const { port: recurring } = port({
    rpc: (name) =>
      envelope(
        "success",
        null,
        name === "recurring_occurrence_get"
          ? { item: done, schedule }
          : name === "recurring_my_occurrences"
            ? { items: [{ ...open, group_name: "Kert" }] }
            : name === "recurring_list_admin"
              ? {
                  items: [
                    {
                      ...schedule,
                      owner_kind: "family",
                      family_id: id(5),
                      family_display_name: "Mogyoró család",
                    },
                  ],
                }
              : name === "recurring_schedule_get"
                ? {
                    schedule: { ...schedule, rota_job: "water_carrying", owner_kind: "rota_week" },
                    caller: { can_manage: true },
                  }
                : { items: [] },
      ),
  });
  const card = await recurring.card(id(2));
  assert.ok(
    card.state === "success" &&
      card.data.item.status === "done" &&
      card.data.schedule.version === 3,
  );
  const mine = await recurring.mine();
  assert.ok(mine.state === "success" && mine.data.items[0]?.groupName === "Kert");
  const admin = await recurring.adminList();
  assert.ok(
    admin.state === "success" &&
      admin.data.items[0]?.familyDisplayName === "Mogyoró család" &&
      admin.data.items[0]?.familyId === id(5),
  );
  const one = await recurring.scheduleGet(id(10));
  assert.ok(
    one.state === "success" && one.data.canManage && one.data.schedule.rotaJob === "water_carrying",
  );
  const bottle = await recurring.bottle(id(30));
  assert.deepEqual(bottle, { state: "success", data: { items: [] } });
});

test("a refused read stays a refusal, and an address that is not an identifier is denied without a call", async () => {
  const { port: recurring, fake } = port({ rpc: () => envelope("denied", "authorization_denied") });
  assert.deepEqual(await recurring.groupList(id(20)), { state: "denied" });
  assert.deepEqual(await recurring.mine(), { state: "denied" });
  const before = fake.rpcCalls.length;
  for (const call of [
    recurring.groupList("nope"),
    recurring.card("nope"),
    recurring.bottle("nope"),
    recurring.scheduleGet("nope"),
  ]) {
    assert.deepEqual(await call, { state: "denied" });
  }
  assert.equal(fake.rpcCalls.length, before);
});

test("a response of the wrong shape is a failure, never a guessed value", async () => {
  const { port: recurring } = port({
    rpc: () => envelope("success", null, { item: { ...open, status: "weird" }, schedule }),
  });
  await assert.rejects(() => recurring.card(id(1)));
});

test("every command is one named function with the key and the version the screen saw", async () => {
  const { port: recurring, fake } = port({
    rpc: () => envelope("success", null, { version: 4 }, id(3)),
  });
  const results = await Promise.all([
    recurring.saveSchedule({
      idempotencyKey: KEY,
      title: "T",
      category: "k",
      ownerKind: "group",
      workingGroupId: id(20),
      intervalCount: 2,
      startDate: "2026-09-07",
      seasonFromMonth: 4,
      seasonToMonth: 10,
    }),
    recurring.saveSchedule({
      idempotencyKey: KEY,
      scheduleId: id(10),
      expectedVersion: 3,
      title: "T",
      category: "k",
      ownerKind: "rota_week",
      rotaJob: "water_carrying",
      intervalCount: 4,
      startDate: "2026-09-07",
    }),
    recurring.setActive({
      idempotencyKey: KEY,
      scheduleId: id(10),
      expectedVersion: 3,
      active: false,
    }),
    recurring.markDone({ idempotencyKey: KEY, occurrenceId: id(1), expectedVersion: 1 }),
    recurring.undoDone({ idempotencyKey: KEY, occurrenceId: id(1), expectedVersion: 2 }),
    recurring.skip({
      idempotencyKey: KEY,
      occurrenceId: id(1),
      expectedVersion: 1,
      reason: "Havazás",
    }),
  ]);
  assert.ok(results.every((result) => result.state === "success"));
  assert.deepEqual(
    results.map((result) => result.state === "success" && [result.data.id, result.data.version]),
    Array(6).fill([id(3), 4]),
  );
  const calls = fake.rpcCalls;
  assert.deepEqual(calls[0], {
    name: "recurring_schedule_save",
    args: {
      p_idempotency_key: KEY,
      p_schedule_id: null,
      p_expected_version: null,
      p_title: "T",
      p_category: "k",
      p_owner_kind: "group",
      p_working_group_id: id(20),
      p_family_id: null,
      p_rota_job: null,
      p_interval_count: 2,
      p_start_date: "2026-09-07",
      p_season_from: 4,
      p_season_to: 10,
    },
  });
  assert.equal(calls[1]?.args.p_schedule_id, id(10));
  assert.equal(calls[1]?.args.p_expected_version, 3);
  assert.equal(calls[1]?.args.p_rota_job, "water_carrying");
  assert.deepEqual(calls[2], {
    name: "recurring_schedule_set_active",
    args: { p_idempotency_key: KEY, p_schedule_id: id(10), p_expected_version: 3, p_active: false },
  });
  assert.deepEqual(calls[3], {
    name: "recurring_occurrence_mark_done",
    args: { p_idempotency_key: KEY, p_occurrence_id: id(1), p_expected_version: 1 },
  });
  assert.deepEqual(calls[4]?.name, "recurring_occurrence_undo_done");
  assert.deepEqual(calls[5], {
    name: "recurring_occurrence_skip",
    args: {
      p_idempotency_key: KEY,
      p_occurrence_id: id(1),
      p_expected_version: 1,
      p_reason: "Havazás",
    },
  });
});

test("a replayed command reads as success with no new version", async () => {
  const { port: recurring } = port({ rpc: () => envelope("success", "replayed", {}, id(3)) });
  const outcome = await recurring.markDone({
    idempotencyKey: KEY,
    occurrenceId: id(3),
    expectedVersion: 1,
  });
  assert.deepEqual(outcome, { state: "success", data: { id: id(3), version: null } });
});

test("each refusal of the commands keeps its state and code", async () => {
  const cases: [string, string, string][] = [
    ["conflict", "VERSION_CONFLICT", "conflict"],
    ["conflict", "RECURRING_CLOSED", "conflict"],
    ["conflict", "RECURRING_UNDO_TOO_LATE", "conflict"],
    ["conflict", "idempotency_key_reused", "conflict"],
    ["denied", "authorization_denied", "denied"],
  ];
  for (const [state, code, expected] of cases) {
    const { port: recurring } = port({ rpc: () => envelope(state, code) });
    const outcome = await recurring.markDone({
      idempotencyKey: KEY,
      occurrenceId: id(1),
      expectedVersion: 1,
    });
    assert.equal(outcome.state, expected, code);
    if (outcome.state === "conflict") assert.equal(outcome.code, code);
  }
});

test("a refused field names its entry, and an unchangeable owner has its own reason", async () => {
  const refuse = async (field: string, reason: string) => {
    const { port: recurring } = port({
      rpc: () => envelope("validation", "field_invalid", { field, reason }),
    });
    return recurring.saveSchedule({
      idempotencyKey: KEY,
      title: "T",
      category: "k",
      ownerKind: "family",
      intervalCount: 1,
      startDate: "2026-09-07",
    });
  };
  assert.deepEqual(await refuse("start_date", "invalid"), {
    state: "validation",
    fieldErrors: { startDate: "VAL-INVALID" },
    code: "field_invalid",
  });
  assert.deepEqual(await refuse("owner", "cannot_change"), {
    state: "validation",
    fieldErrors: { owner: "VAL-CANNOT-CHANGE" },
    code: "field_invalid",
  });
  assert.deepEqual(await refuse("expected_version", "invalid"), {
    state: "validation",
    fieldErrors: { expectedVersion: "VAL-EXPECTED-VERSION" },
    code: "field_invalid",
  });
  assert.deepEqual(await refuse("owner", "not_found"), {
    state: "validation",
    fieldErrors: { owner: "VAL-NOT-FOUND" },
    code: "field_invalid",
  });
});

test("every refusal has Hungarian words, never a raw code", () => {
  const known = [
    "RECURRING_CLOSED",
    "RECURRING_UNDO_TOO_LATE",
    "VERSION_CONFLICT",
    "idempotency_key_reused",
  ];
  for (const code of known) {
    const message = recurringMessage({ state: "conflict", code });
    assert.ok(message.length > 10 && !message.includes(code), code);
  }
  assert.equal(recurringMessage({ state: "denied" }), "Ezt a műveletet nem végezheted el.");
  for (const field of [
    "title",
    "category",
    "interval",
    "startDate",
    "season",
    "owner",
    "reason",
    "expectedVersion",
  ]) {
    const message = recurringMessage({
      state: "validation",
      fieldErrors: { [field]: "VAL-INVALID" },
    });
    assert.ok(message.length > 10 && !message.includes("VAL-"), field);
  }
  assert.equal(
    recurringMessage({ state: "validation", fieldErrors: { owner: "VAL-CANNOT-CHANGE" } }),
    "A feladat felelőse utólag nem módosítható.",
  );
  assert.equal(
    recurringMessage({ state: "validation", code: "something_new" }),
    recurringMessage({ state: "conflict", code: "another_new_code" }),
  );
});
