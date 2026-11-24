import assert from "node:assert/strict";
import test from "node:test";
import { envelope, fakeData, type FakeHandlers } from "../../tests/support/data-fakes.ts";
import { createAnimalCarePort } from "./animal-care.ts";

const id = (n: number) => `dddddddd-0000-4000-8000-${String(n).padStart(12, "0")}`;
const KEY = "animal-key-0001";

function port(handlers: FakeHandlers) {
  const fake = fakeData(handlers);
  return { fake, port: createAnimalCarePort(fake.database) };
}

const taken = {
  slot_date: "2026-11-30",
  part: "morning",
  start_time: "07:30",
  duty_id: id(1),
  duty_version: 2,
  place_id: id(2),
  place_version: 3,
  family_name: "Mogyoró család",
  mine: true,
  in_swap: false,
  started: false,
  cancelled: false,
  can_give_up: true,
  may_hold: true,
  hold_reason: null,
};
const free = {
  ...taken,
  part: "afternoon",
  start_time: "16:00",
  duty_id: id(3),
  place_id: null,
  place_version: null,
  family_name: null,
  mine: false,
  can_give_up: false,
  may_hold: false,
  hold_reason: "AFTER_START",
};

test("the slot page is one function call and carries slots, holder, hold reason and info links", async () => {
  const { port: animal, fake } = port({
    rpc: () =>
      envelope("success", null, {
        school_year_id: id(9),
        from_date: "2026-11-30",
        to_date: "2026-12-27",
        slots: [taken, free],
        info_links_morning: [{ key: "reggeli", title: "Reggeli teendők" }],
        info_links_afternoon: [],
      }),
  });
  const outcome = await animal.slots({ schoolYearId: id(9), fromDate: "2026-11-30", weeks: 4 });
  assert.equal(outcome.state, "success");
  if (outcome.state !== "success") return;
  const [first, second] = outcome.data.slots;
  assert.deepEqual(
    [first?.placeId, first?.placeVersion, first?.familyName, first?.canGiveUp, first?.mine],
    [id(2), 3, "Mogyoró család", true, true],
  );
  assert.deepEqual(
    [second?.placeId, second?.familyName, second?.holdReason, second?.mayHold],
    [undefined, undefined, "AFTER_START", false],
  );
  assert.deepEqual(outcome.data.infoLinksMorning, [{ key: "reggeli", title: "Reggeli teendők" }]);
  assert.ok(Object.isFrozen(outcome.data) && Object.isFrozen(first));
  assert.deepEqual(fake.rpcCalls, [
    {
      name: "animal_slots_list",
      args: { p_school_year_id: id(9), p_from_date: "2026-11-30", p_weeks: 4 },
    },
  ]);
});

test("the slot page without a date or weeks asks the database for its defaults", async () => {
  const { port: animal, fake } = port({
    rpc: () =>
      envelope("success", null, {
        school_year_id: id(9),
        from_date: "2026-11-30",
        to_date: "2026-12-27",
        slots: [],
        info_links_morning: [],
        info_links_afternoon: [],
      }),
  });
  await animal.slots({ schoolYearId: id(9) });
  assert.deepEqual(fake.rpcCalls[0]?.args, {
    p_school_year_id: id(9),
    p_from_date: null,
    p_weeks: null,
  });
});

test("the fair share carries the caller's family, the average and every family", async () => {
  const row = { family_name: "Mogyoró család", count: 3, share: 1.5, active_weeks: 30, mine: true };
  const { port: animal } = port({
    rpc: () =>
      envelope("success", null, {
        average: 2.25,
        mine: row,
        families: [row, { ...row, family_name: "Som család", mine: false }],
      }),
  });
  const outcome = await animal.fairShare(id(9));
  assert.ok(outcome.state === "success");
  if (outcome.state !== "success") return;
  assert.equal(outcome.data.average, 2.25);
  assert.deepEqual([outcome.data.mine?.count, outcome.data.mine?.share], [3, 1.5]);
  assert.equal(outcome.data.families.length, 2);
  const none = port({
    rpc: () => envelope("success", null, { average: 0, mine: null, families: [] }),
  });
  const empty = await none.port.fairShare(id(9));
  assert.ok(empty.state === "success" && empty.data.mine === undefined);
});

test("the settings carry the times, the alert group and the groups to choose from", async () => {
  const body = {
    school_year_id: id(9),
    exists: true,
    morning_start: "07:30",
    afternoon_start: "16:00",
    care_group_id: id(20),
    generated_at: "2026-09-01T08:00:00+00:00",
    slot_count: 400,
    version: 2,
    groups: [{ id: id(20), name: "Állatgondozás" }],
  };
  const { port: animal } = port({ rpc: () => envelope("success", null, body) });
  const outcome = await animal.calendar(id(9));
  assert.ok(outcome.state === "success");
  if (outcome.state !== "success") return;
  assert.deepEqual(
    [outcome.data.exists, outcome.data.careGroupId, outcome.data.slotCount, outcome.data.version],
    [true, id(20), 400, 2],
  );
  assert.deepEqual(outcome.data.groups, [{ id: id(20), name: "Állatgondozás" }]);
  const fresh = port({
    rpc: () =>
      envelope("success", null, {
        ...body,
        exists: false,
        care_group_id: null,
        generated_at: null,
        slot_count: 0,
        version: 0,
      }),
  });
  const first = await fresh.port.calendar(id(9));
  assert.ok(
    first.state === "success" && !first.data.exists && first.data.careGroupId === undefined,
  );
});

test("every command is one named function with the key and the version the screen saw", async () => {
  const { port: animal, fake } = port({
    rpc: () => envelope("success", null, { version: 4, added: 380 }, id(3)),
  });
  const results = await Promise.all([
    animal.saveCalendar({
      idempotencyKey: KEY,
      schoolYearId: id(9),
      morningStart: "07:30",
      afternoonStart: "16:00",
      careGroupId: id(20),
      expectedVersion: 0,
    }),
    animal.saveCalendar({
      idempotencyKey: KEY,
      schoolYearId: id(9),
      morningStart: "07:45",
      afternoonStart: "16:00",
      expectedVersion: 2,
    }),
    animal.createSlots({ idempotencyKey: KEY, schoolYearId: id(9) }),
    animal.giveUp({ idempotencyKey: KEY, placeId: id(2), expectedVersion: 3 }),
  ]);
  assert.ok(
    results.every((r) => r.state === "success" && r.data.id === id(3) && r.data.version === 4),
  );
  assert.equal(results[2]?.state === "success" && results[2].data.added, 380);
  assert.deepEqual(fake.rpcCalls[0], {
    name: "animal_calendar_save",
    args: {
      p_idempotency_key: KEY,
      p_school_year_id: id(9),
      p_morning_start: "07:30",
      p_afternoon_start: "16:00",
      p_care_group_id: id(20),
      p_expected_version: 0,
    },
  });
  assert.equal(fake.rpcCalls[1]?.args.p_care_group_id, null);
  assert.deepEqual(fake.rpcCalls[2], {
    name: "animal_slots_create",
    args: { p_idempotency_key: KEY, p_school_year_id: id(9) },
  });
  assert.deepEqual(fake.rpcCalls[3], {
    name: "slot_give_up",
    args: { p_idempotency_key: KEY, p_place_id: id(2), p_expected_version: 3 },
  });
});

test("a replayed command reads as success with no new version", async () => {
  const { port: animal } = port({ rpc: () => envelope("success", "replayed", {}, id(3)) });
  const outcome = await animal.giveUp({ idempotencyKey: KEY, placeId: id(2), expectedVersion: 3 });
  assert.deepEqual(outcome, { state: "success", data: { id: id(3), version: null } });
});

test("each refusal keeps its state and code", async () => {
  for (const [state, code] of [
    ["conflict", "VERSION_CONFLICT"],
    ["conflict", "SLOT_GIVE_UP_TOO_LATE"],
    ["conflict", "REQUEST_CONFLICT"],
    ["denied", "authorization_denied"],
  ] as const) {
    const { port: animal } = port({ rpc: () => envelope(state, code) });
    const outcome = await animal.giveUp({
      idempotencyKey: KEY,
      placeId: id(2),
      expectedVersion: 1,
    });
    assert.equal(outcome.state, state);
    if (outcome.state === "conflict") assert.equal(outcome.code, code);
  }
});

test("an address that is not an identifier is denied without asking the database", async () => {
  const { port: animal, fake } = port({ rpc: () => envelope("success", null, {}) });
  for (const call of [
    animal.slots({ schoolYearId: "nope" }),
    animal.fairShare("nope"),
    animal.calendar("nope"),
    animal.saveCalendar({
      idempotencyKey: KEY,
      schoolYearId: "nope",
      morningStart: "07:30",
      afternoonStart: "16:00",
      expectedVersion: 0,
    }),
    animal.createSlots({ idempotencyKey: KEY, schoolYearId: "nope" }),
    animal.giveUp({ idempotencyKey: KEY, placeId: "nope", expectedVersion: 1 }),
  ]) {
    assert.deepEqual(await call, { state: "denied" });
  }
  assert.equal(fake.rpcCalls.length, 0);
});

test("a response of the wrong shape is a failure, never a guessed value", async () => {
  const { port: animal } = port({
    rpc: () =>
      envelope("success", null, {
        school_year_id: id(9),
        from_date: "2026-11-30",
        to_date: "2026-12-27",
        slots: [{ ...taken, part: "midnight" }],
        info_links_morning: [],
        info_links_afternoon: [],
      }),
  });
  await assert.rejects(() => animal.slots({ schoolYearId: id(9) }));
});
