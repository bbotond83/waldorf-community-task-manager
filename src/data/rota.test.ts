import assert from "node:assert/strict";
import test from "node:test";
import type { Scope } from "../access/index.ts";
import type { AdminOperation } from "../application/index.ts";
import { envelope, fakeData, ok, type FakeHandlers } from "../../tests/support/data-fakes.ts";
import { createAdminPort } from "./admin-port.ts";
import { TerminalDataFailure } from "./errors.ts";
import { createRotaPort } from "./rota.ts";

const YEAR = "aaaaaaaa-0000-4000-8000-0000000000a1";
const PLAN = "aaaaaaaa-0000-4000-8000-0000000000b1";
const WEEK = "aaaaaaaa-0000-4000-8000-0000000000c1";
const FAMILY = "aaaaaaaa-0000-4000-8000-0000000000d1";
const DUTY = "aaaaaaaa-0000-4000-8000-0000000000e1";
const FAMILY_2 = "aaaaaaaa-0000-4000-8000-0000000000d2";
const DUTY_2 = "aaaaaaaa-0000-4000-8000-0000000000e2";
const ORG = "aaaaaaaa-0000-4000-8000-000000000001";

function rota(handlers: FakeHandlers) {
  const fake = fakeData(handlers);
  return { fake, port: createRotaPort(fake.database) };
}

const calendar = {
  school_year: {
    id: YEAR,
    name: "2026-2027",
    starts_on: "2026-09-01",
    ends_on: "2027-06-30",
    changeover_date: "2027-07-01",
    version: 2,
  },
  school_years: [{ id: YEAR, name: "2026-2027" }],
  items: [
    { week_start: "2026-08-31", is_break: false, break_week_id: null, label: null, version: null },
    {
      week_start: "2026-12-21",
      is_break: true,
      break_week_id: WEEK,
      label: "Téli szünet",
      version: 1,
    },
  ],
  warnings: [{ week_start: "2026-12-21", family_display_name: "Minta család" }],
  has_plan: true,
  standings: [
    { family_id: FAMILY, display_name: "Minta család", standing: "leaving", version: 2 },
    { family_id: FAMILY_2, display_name: "Másik család", standing: "staying", version: 0 },
  ],
  flagged_duties: [
    {
      source: "rota_week",
      family_id: FAMILY,
      family_display_name: "Minta család",
      title: "Előkert",
      job: "front_garden",
      on_date: "2027-07-05",
      reason: "leaving_after_changeover",
      duty_id: DUTY,
    },
    {
      source: "task",
      family_id: FAMILY,
      family_display_name: "Minta család",
      title: "Sütés",
      job: null,
      on_date: "2027-07-06",
      reason: "leaving_after_changeover",
      duty_id: null,
    },
  ],
};

test("the calendar read maps the year, the weeks with their break flags and the warnings (BR20.4, BR20.5)", async () => {
  const { fake, port } = rota({ rpc: () => envelope("success", null, calendar, YEAR) });
  const outcome = await port.calendar({});
  assert.equal(outcome.state, "success");
  assert.deepEqual(fake.rpcCalls, [
    { name: "school_calendar_get", args: { p_school_year_id: null } },
  ]);
  if (outcome.state !== "success") return;
  assert.equal(outcome.data.schoolYear?.changeoverDate, "2027-07-01");
  assert.equal(outcome.data.weeks[0]?.isBreak, false);
  assert.equal(outcome.data.weeks[0]?.breakWeekId, undefined);
  assert.deepEqual(outcome.data.weeks[1], {
    weekStart: "2026-12-21",
    isBreak: true,
    breakWeekId: WEEK,
    label: "Téli szünet",
    version: 1,
  });
  assert.deepEqual(outcome.data.warnings, [
    { weekStart: "2026-12-21", familyDisplayName: "Minta család" },
  ]);
  assert.equal(outcome.data.hasPlan, true);
  assert.deepEqual(outcome.data.standings, [
    { familyId: FAMILY, displayName: "Minta család", standing: "leaving", version: 2 },
    { familyId: FAMILY_2, displayName: "Másik család", standing: "staying", version: 0 },
  ]);
  assert.deepEqual(outcome.data.flaggedDuties[0], {
    source: "rota_week",
    familyId: FAMILY,
    familyDisplayName: "Minta család",
    title: "Előkert",
    job: "front_garden",
    onDate: "2027-07-05",
    reason: "leaving_after_changeover",
    dutyId: DUTY,
  });
  assert.equal("job" in outcome.data.flaggedDuties[1]!, false, "a manual task has no rota");
  assert.equal("dutyId" in outcome.data.flaggedDuties[1]!, false);
});

test("a standing or a reason the database does not define is a malformed response, never guessed", async () => {
  for (const change of [
    { standings: [{ ...calendar.standings[0], standing: "gone" }] },
    { flagged_duties: [{ ...calendar.flagged_duties[0], reason: "other" }] },
    { flagged_duties: [{ ...calendar.flagged_duties[0], job: "roofing" }] },
  ]) {
    const { port } = rota({
      rpc: () => envelope("success", null, { ...calendar, ...change }, YEAR),
    });
    await assert.rejects(() => port.calendar({}), TerminalDataFailure);
  }
});

test("a calendar with no school year is a success with no year, and a refusal stays a refusal", async () => {
  const empty = rota({
    rpc: () =>
      envelope("success", null, {
        school_year: null,
        school_years: [],
        items: [],
        warnings: [],
        has_plan: false,
        standings: [],
        flagged_duties: [],
      }),
  });
  const outcome = await empty.port.calendar({ schoolYearId: YEAR });
  assert.equal(outcome.state, "success");
  assert.equal(outcome.state === "success" && outcome.data.schoolYear, undefined);
  assert.deepEqual(empty.fake.rpcCalls[0]?.args, { p_school_year_id: YEAR });
  const refused = await rota({
    rpc: () => envelope("denied", "authorization_denied"),
  }).port.calendar({});
  assert.deepEqual(refused, { state: "denied" });
});

const plan = {
  school_year: { id: YEAR, name: "2026-2027", starts_on: "2026-09-01", ends_on: "2027-06-30" },
  plan: { id: PLAN, status: "draft", version: 3, published_at: null },
  items: [
    {
      id: WEEK,
      job: "indoor_cleaning",
      week_start: "2026-08-31",
      is_break: false,
      family_id: FAMILY,
      family_display_name: "Minta család",
      empty_reason: null,
      changed_by_admin: true,
      version: 2,
    },
    {
      id: DUTY,
      job: "front_garden",
      week_start: "2026-09-07",
      is_break: false,
      family_id: null,
      family_display_name: null,
      empty_reason: "cleared",
      changed_by_admin: true,
      version: 2,
    },
  ],
  families: [
    {
      family_id: FAMILY,
      display_name: "Minta család",
      full_year: true,
      counts: { indoor_cleaning: 9, front_garden: 4, water_carrying: 3, weekend_animal_care: 5 },
      above_lowest: ["front_garden"],
    },
  ],
  changed_weeks: 2,
  blockers: {
    empty_weeks: [
      { week_start: "2026-09-07", job: "front_garden", reason: "cleared" },
      { week_start: "2026-09-07", job: "weekend_animal_care", reason: "no_family" },
    ],
    break_weeks: [{ week_start: "2026-12-21", job: "water_carrying" }],
    ineligible_weeks: [],
    flagged_weeks: [
      {
        week_start: "2027-07-05",
        job: "water_carrying",
        family_id: FAMILY,
        family_display_name: "Minta család",
        reason: "leaving_after_changeover",
      },
    ],
    clash_weeks: [
      { week_start: "2026-09-14", family_id: FAMILY, family_display_name: "Minta család" },
    ],
  },
  warnings: {
    two_jobs: [
      {
        week_start: "2026-09-21",
        family_id: FAMILY,
        family_display_name: "Minta család",
        jobs: ["front_garden", "water_carrying"],
      },
    ],
  },
  can_publish: false,
};

test("the plan read maps weeks, family counts, hand changes and what blocks publishing (BR22.3, BR23.1)", async () => {
  const { fake, port } = rota({ rpc: () => envelope("success", null, plan, PLAN) });
  const outcome = await port.plan({ schoolYearId: YEAR });
  assert.deepEqual(fake.rpcCalls, [{ name: "rota_plan_get", args: { p_school_year_id: YEAR } }]);
  assert.equal(outcome.state, "success");
  if (outcome.state !== "success") return;
  assert.deepEqual(outcome.data.plan, { id: PLAN, status: "draft", version: 3 });
  assert.equal(outcome.data.weeks[0]?.familyDisplayName, "Minta család");
  assert.equal(outcome.data.weeks[1]?.emptyReason, "cleared");
  assert.equal(outcome.data.weeks[1]?.familyId, undefined);
  assert.equal(outcome.data.changedWeeks, 2);
  assert.deepEqual(outcome.data.blockers.emptyWeeks, ["2026-09-07"], "each Monday once");
  assert.equal(outcome.data.canPublish, false);
  assert.equal(outcome.data.weeks[1]?.job, "front_garden");
  assert.deepEqual(outcome.data.families[0], {
    familyId: FAMILY,
    displayName: "Minta család",
    fullYear: true,
    counts: { indoor_cleaning: 9, front_garden: 4, water_carrying: 3, weekend_animal_care: 5 },
    aboveLowestJobs: ["front_garden"],
    weeks: 9,
    aboveLowest: false,
  });
});

test("the plan read names the rota and the reason of every blocker and warning (BR62.3, BR62.6, BR62.7)", async () => {
  const { port } = rota({ rpc: () => envelope("success", null, plan, PLAN) });
  const outcome = await port.plan({});
  assert.equal(outcome.state, "success");
  if (outcome.state !== "success") return;
  const { blockers, warnings } = outcome.data;
  assert.deepEqual(blockers.emptyRows, [
    { weekStart: "2026-09-07", job: "front_garden", reason: "cleared" },
    { weekStart: "2026-09-07", job: "weekend_animal_care", reason: "no_family" },
  ]);
  assert.deepEqual(blockers.breakRows, [{ weekStart: "2026-12-21", job: "water_carrying" }]);
  assert.deepEqual(blockers.breakWeeks, ["2026-12-21"]);
  assert.deepEqual(blockers.ineligibleRows, []);
  assert.deepEqual(blockers.flaggedWeeks, [
    {
      weekStart: "2027-07-05",
      job: "water_carrying",
      familyId: FAMILY,
      familyDisplayName: "Minta család",
      reason: "leaving_after_changeover",
    },
  ]);
  assert.deepEqual(blockers.clashWeeks, [
    { weekStart: "2026-09-14", familyId: FAMILY, familyDisplayName: "Minta család" },
  ]);
  assert.deepEqual(warnings.twoJobs, [
    {
      weekStart: "2026-09-21",
      familyId: FAMILY,
      familyDisplayName: "Minta család",
      jobs: ["front_garden", "water_carrying"],
    },
  ]);
});

test("a plan answer from before the new lists were added still reads, with empty new lists", async () => {
  const { port } = rota({
    rpc: () =>
      envelope(
        "success",
        null,
        {
          ...plan,
          blockers: { empty_weeks: [], break_weeks: [], ineligible_weeks: [] },
          warnings: undefined,
        },
        PLAN,
      ),
  });
  const outcome = await port.plan({});
  assert.equal(outcome.state, "success");
  if (outcome.state !== "success") return;
  assert.deepEqual(outcome.data.blockers.flaggedWeeks, []);
  assert.deepEqual(outcome.data.blockers.clashWeeks, []);
  assert.deepEqual(outcome.data.warnings.twoJobs, []);
});

test("a year with no plan yet reads as no plan, with the number of school weeks", async () => {
  const { port } = rota({
    rpc: () =>
      envelope(
        "success",
        null,
        {
          school_year: plan.school_year,
          plan: null,
          week_count: 44,
        },
        YEAR,
      ),
  });
  const outcome = await port.plan({});
  assert.equal(outcome.state, "success");
  if (outcome.state !== "success") return;
  assert.equal(outcome.data.plan, undefined);
  assert.equal(outcome.data.weekCount, 44);
  assert.deepEqual(outcome.data.weeks, []);
  assert.equal(outcome.data.canPublish, false);
});

test("a plan with an unknown status or empty reason is a malformed response, never guessed", async () => {
  const bad = rota({
    rpc: () => envelope("success", null, { ...plan, plan: { ...plan.plan, status: "archived" } }),
  });
  await assert.rejects(() => bad.port.plan({}), TerminalDataFailure);
  const badReason = rota({
    rpc: () =>
      envelope("success", null, {
        ...plan,
        items: [{ ...plan.items[1], empty_reason: "unknown" }],
      }),
  });
  await assert.rejects(() => badReason.port.plan({}), TerminalDataFailure);
});

const overviewItem = (over: Record<string, unknown> = {}) => ({
  job: "indoor_cleaning",
  week_start: "2026-08-31",
  is_break: false,
  family_id: FAMILY,
  family_display_name: "Minta család",
  is_own: true,
  duty_id: DUTY,
  ...over,
});

test("the overview carries exactly these fields and nothing else about a family (NFR1.2)", async () => {
  const { fake, port } = rota({
    rpc: () =>
      envelope(
        "success",
        null,
        {
          overview_state: "published",
          school_year: { id: YEAR, name: "2026-2027" },
          items: [
            overviewItem({ phone: "x", email: "y", child: "z" }),
            overviewItem({
              week_start: "2026-12-21",
              is_break: true,
              family_id: null,
              family_display_name: null,
              is_own: false,
              duty_id: null,
            }),
          ],
          weekend_items: [],
        },
        PLAN,
      ),
  });
  const outcome = await port.overview();
  assert.deepEqual(fake.rpcCalls, [{ name: "rota_overview", args: {} }]);
  assert.equal(outcome.state, "success");
  if (outcome.state !== "success") return;
  assert.equal(outcome.data.overviewState, "published");
  assert.deepEqual(Object.keys(outcome.data.items[0] ?? {}).sort(), [
    "dutyId",
    "familyDisplayName",
    "familyId",
    "isBreak",
    "isOwn",
    "job",
    "weekStart",
  ]);
  assert.deepEqual(Object.keys(outcome.data.items[1] ?? {}).sort(), [
    "isBreak",
    "isOwn",
    "job",
    "weekStart",
  ]);
  assert.equal(JSON.stringify(outcome.data).includes("phone"), false);
});

test("a week with no family row has no own flag in the database answer: it reads as not own", async () => {
  // Regression: a signed-in parent got the error state once a plan was published, because a break week has no rota row
  // and the database's own flag is then null, not false.
  const { port } = rota({
    rpc: () =>
      envelope("success", null, {
        overview_state: "published",
        school_year: { id: YEAR, name: "2026-2027" },
        items: [
          overviewItem({
            is_break: true,
            family_id: null,
            family_display_name: null,
            is_own: null,
            duty_id: null,
          }),
        ],
        weekend_items: [],
      }),
  });
  const outcome = await port.overview();
  assert.equal(outcome.state, "success");
  if (outcome.state !== "success") return;
  assert.equal(outcome.data.items[0]?.isOwn, false);
});

test("the overview lists all four rotas and the weekend duties, each with the family's name only (BR65.1, NFR1.2)", async () => {
  const { port } = rota({
    rpc: () =>
      envelope(
        "success",
        null,
        {
          overview_state: "published",
          school_year: { id: YEAR, name: "2026-2027" },
          items: ["indoor_cleaning", "front_garden", "water_carrying", "weekend_animal_care"].map(
            (job) => overviewItem({ job }),
          ),
          weekend_items: [
            {
              week_start: "2026-08-31",
              slot: "saturday_opening",
              family_id: FAMILY,
              family_display_name: "Minta család",
              is_own: true,
              duty_id: DUTY,
              phone: "x",
            },
            {
              week_start: "2026-08-31",
              slot: "shelter_cleaning",
              family_id: null,
              family_display_name: null,
              is_own: null,
              duty_id: null,
            },
          ],
        },
        PLAN,
      ),
  });
  const outcome = await port.overview();
  assert.equal(outcome.state, "success");
  if (outcome.state !== "success") return;
  assert.deepEqual(
    outcome.data.items.map((item) => item.job),
    ["indoor_cleaning", "front_garden", "water_carrying", "weekend_animal_care"],
  );
  assert.deepEqual(outcome.data.weekendItems[0], {
    weekStart: "2026-08-31",
    slot: "saturday_opening",
    familyId: FAMILY,
    familyDisplayName: "Minta család",
    isOwn: true,
    dutyId: DUTY,
  });
  assert.deepEqual(outcome.data.weekendItems[1], {
    weekStart: "2026-08-31",
    slot: "shelter_cleaning",
    isOwn: false,
  });
  assert.equal(JSON.stringify(outcome.data).includes("phone"), false);
});

test("a rota or a weekend slot the database does not define is a malformed response", async () => {
  const bad = (items: unknown[], weekend: unknown[]) =>
    rota({
      rpc: () =>
        envelope("success", null, { overview_state: "published", items, weekend_items: weekend }),
    });
  await assert.rejects(
    () => bad([overviewItem({ job: "roofing" })], []).port.overview(),
    TerminalDataFailure,
  );
  await assert.rejects(
    () =>
      bad(
        [],
        [{ week_start: "2026-08-31", slot: "monday_opening", is_own: false }],
      ).port.overview(),
    TerminalDataFailure,
  );
});

test("nothing published is a success with its own state, not a refusal and not an empty list (BR24.1)", async () => {
  const { port } = rota({
    rpc: () =>
      envelope("success", null, {
        overview_state: "nothing_published",
        school_year: null,
        items: [],
        weekend_items: [],
      }),
  });
  const outcome = await port.overview();
  assert.deepEqual(outcome, {
    state: "success",
    data: { overviewState: "nothing_published", items: [], weekendItems: [] },
  });
});

test("an overview of an unknown state is a malformed response", async () => {
  const { port } = rota({
    rpc: () => envelope("success", null, { overview_state: "draft", items: [], weekend_items: [] }),
  });
  await assert.rejects(() => port.overview(), TerminalDataFailure);
});

const cardItem = {
  duty_id: DUTY,
  job: "indoor_cleaning",
  slot: null,
  title: "Belső takarítás",
  family_display_name: "Minta család",
  week_start: "2026-08-31",
  week_end: "2026-09-06",
  no_fixed_day: true,
  is_break_week: false,
  includes_watering: false,
  bottles_at_week_end: false,
  day: null,
  part_of_day: null,
  weekend: null,
  own_pick: null,
};

test("the duty card maps the week and says there is no fixed day for a weekly duty (BR24.2, BR24.3)", async () => {
  const item = cardItem;
  const { fake, port } = rota({ rpc: () => envelope("success", null, { item }, DUTY) });
  const outcome = await port.dutyCard({ dutyId: DUTY });
  assert.deepEqual(fake.rpcCalls, [{ name: "rota_duty_card", args: { p_duty_id: DUTY } }]);
  assert.deepEqual(outcome, {
    state: "success",
    data: {
      dutyId: DUTY,
      job: "indoor_cleaning",
      title: "Belső takarítás",
      familyDisplayName: "Minta család",
      weekStart: "2026-08-31",
      weekEnd: "2026-09-06",
      noFixedDay: true,
      isBreakWeek: false,
      includesWatering: false,
      bottlesAtWeekEnd: false,
    },
  });
  const wrong = rota({
    rpc: () => envelope("success", null, { item: { ...item, no_fixed_day: "yes" } }),
  });
  await assert.rejects(() => wrong.port.dutyCard({ dutyId: DUTY }), TerminalDataFailure);
  const denied = await rota({
    rpc: () => envelope("denied", "authorization_denied"),
  }).port.dutyCard({ dutyId: DUTY });
  assert.deepEqual(denied, { state: "denied" });
});

const weekendState = {
  week_start: "2026-12-07",
  picks_close_at: "2026-12-12T23:00:00+00:00",
  change_until: "2026-12-11T11:00:00+00:00",
  weekend_family_display_name: "Hétvégi család",
  slots: [
    {
      slot: "saturday_opening",
      duty_id: DUTY_2,
      place_version: 3,
      holder_family_display_name: "Hétvégi család",
      held_by_weekend_family: true,
      picked: false,
    },
    {
      slot: "sunday_closing",
      duty_id: DUTY,
      place_version: 2,
      holder_family_display_name: "Minta család",
      held_by_weekend_family: false,
      picked: true,
    },
  ],
  pickers: [
    {
      job: "indoor_cleaning",
      family_display_name: "Minta család",
      state: "picked",
      slot: "sunday_closing",
    },
    { job: "front_garden", family_display_name: null, state: "not_needed", slot: null },
  ],
};

test("a picking family's duty card carries the weekend, its own pick state and the free slots with their versions (BR63.4, BR65.3)", async () => {
  const item = {
    ...cardItem,
    weekend: weekendState,
    own_pick: {
      rota_week_id: WEEK,
      state: "open",
      slot: null,
      can_pick: true,
      free_slots: [{ slot: "saturday_opening", duty_id: DUTY_2, place_version: 3 }],
      picks_close_at: "2026-12-12T23:00:00+00:00",
      change_until: "2026-12-11T11:00:00+00:00",
    },
  };
  const { port } = rota({ rpc: () => envelope("success", null, { item }, DUTY) });
  const outcome = await port.dutyCard({ dutyId: DUTY });
  assert.equal(outcome.state, "success");
  if (outcome.state !== "success") return;
  assert.deepEqual(outcome.data.ownPick, {
    rotaWeekId: WEEK,
    state: "open",
    canPick: true,
    freeSlots: [{ slot: "saturday_opening", dutyId: DUTY_2, placeVersion: 3 }],
    picksCloseAt: "2026-12-12T23:00:00+00:00",
    changeUntil: "2026-12-11T11:00:00+00:00",
  });
  assert.equal(outcome.data.weekend?.weekendFamilyDisplayName, "Hétvégi család");
  assert.deepEqual(outcome.data.weekend?.slots[1], {
    slot: "sunday_closing",
    dutyId: DUTY,
    placeVersion: 2,
    holderFamilyDisplayName: "Minta család",
    heldByWeekendFamily: false,
    picked: true,
  });
  assert.deepEqual(outcome.data.weekend?.pickers, [
    {
      job: "indoor_cleaning",
      familyDisplayName: "Minta család",
      state: "picked",
      slot: "sunday_closing",
    },
    { job: "front_garden", state: "not_needed" },
  ]);
});

test("a weekend duty card maps the slot, the day and the part of the day, and a front-garden or water card its flags (BR65.2)", async () => {
  const slotCard = {
    ...cardItem,
    job: "weekend_animal_care",
    slot: "sunday_opening",
    title: "Vasárnap reggeli nyitás",
    no_fixed_day: false,
    day: "sunday",
    part_of_day: "morning",
  };
  const slot = await rota({
    rpc: () => envelope("success", null, { item: slotCard }, DUTY),
  }).port.dutyCard({ dutyId: DUTY });
  assert.equal(slot.state, "success");
  if (slot.state === "success") {
    assert.equal(slot.data.job, "weekend_animal_care");
    assert.equal(slot.data.slot, "sunday_opening");
    assert.equal(slot.data.noFixedDay, false);
    assert.equal(slot.data.day, "sunday");
    assert.equal(slot.data.partOfDay, "morning");
    assert.equal("weekend" in slot.data, false);
  }
  const garden = await rota({
    rpc: () =>
      envelope(
        "success",
        null,
        { item: { ...cardItem, job: "front_garden", includes_watering: true } },
        DUTY,
      ),
  }).port.dutyCard({ dutyId: DUTY });
  assert.equal(garden.state === "success" && garden.data.includesWatering, true);
  const water = await rota({
    rpc: () =>
      envelope(
        "success",
        null,
        { item: { ...cardItem, job: "water_carrying", bottles_at_week_end: true } },
        DUTY,
      ),
  }).port.dutyCard({ dutyId: DUTY });
  assert.equal(water.state === "success" && water.data.bottlesAtWeekEnd, true);
});

test("a duty card with an unknown slot, day, pick state or rota is a malformed response", async () => {
  for (const change of [
    { slot: "monday_opening" },
    { day: "friday" },
    { part_of_day: "noon" },
    { job: "roofing" },
    {
      own_pick: {
        rota_week_id: WEEK,
        state: "maybe",
        can_pick: false,
        free_slots: [],
        picks_close_at: "a",
        change_until: "b",
      },
    },
  ]) {
    const { port } = rota({
      rpc: () => envelope("success", null, { item: { ...cardItem, ...change } }, DUTY),
    });
    await assert.rejects(() => port.dutyCard({ dutyId: DUTY }), TerminalDataFailure);
  }
});

const unpickedItem = {
  rota_week_id: WEEK,
  job: "indoor_cleaning",
  week_start: "2026-12-07",
  family_display_name: "Minta család",
  weekend_family_display_name: "Hétvégi család",
  picks_close_at: "2026-12-12T23:00:00+00:00",
  change_until: "2026-12-11T11:00:00+00:00",
  free_slots: [{ slot: "saturday_closing", duty_id: DUTY_2, place_version: 1 }],
};

test("the unpicked list maps the open picks with their free slots and the missed ones without them (BR63.8, BR65.4)", async () => {
  const { fake, port } = rota({
    rpc: () =>
      envelope(
        "success",
        null,
        {
          items: [unpickedItem],
          missed: [
            {
              rota_week_id: DUTY,
              job: "front_garden",
              week_start: "2026-11-30",
              family_display_name: "Másik család",
              weekend_family_display_name: "Hétvégi család",
            },
          ],
        },
        PLAN,
      ),
  });
  const outcome = await port.unpickedList();
  assert.deepEqual(fake.rpcCalls, [{ name: "weekend_unpicked_list", args: {} }]);
  assert.equal(outcome.state, "success");
  if (outcome.state !== "success") return;
  assert.deepEqual(outcome.data.items[0], {
    rotaWeekId: WEEK,
    job: "indoor_cleaning",
    weekStart: "2026-12-07",
    familyDisplayName: "Minta család",
    weekendFamilyDisplayName: "Hétvégi család",
    picksCloseAt: "2026-12-12T23:00:00+00:00",
    changeUntil: "2026-12-11T11:00:00+00:00",
    freeSlots: [{ slot: "saturday_closing", dutyId: DUTY_2, placeVersion: 1 }],
  });
  assert.deepEqual(outcome.data.missed[0], {
    rotaWeekId: DUTY,
    job: "front_garden",
    weekStart: "2026-11-30",
    familyDisplayName: "Másik család",
    weekendFamilyDisplayName: "Hétvégi család",
    freeSlots: [],
  });
});

test("the unpicked list refused for anyone but a super admin stays denied, and an empty list is a success", async () => {
  const denied = await rota({
    rpc: () => envelope("denied", "authorization_denied"),
  }).port.unpickedList();
  assert.deepEqual(denied, { state: "denied" });
  const empty = await rota({
    rpc: () => envelope("success", null, { items: [], missed: [] }),
  }).port.unpickedList();
  assert.deepEqual(empty, { state: "success", data: { items: [], missed: [] } });
  await assert.rejects(
    () =>
      rota({
        rpc: () =>
          envelope("success", null, {
            items: [{ ...unpickedItem, job: "water_carrying" }],
            missed: [],
          }),
      }).port.unpickedList(),
    TerminalDataFailure,
  );
});

test("the standing, pick and assign commands pass their key and version to the named function (BR60.1, BR63.4, BR63.6)", async () => {
  const { fake, port } = rota({ rpc: () => envelope("success", null, { version: 2 }, WEEK) });
  const key = "key-0001-abcdefgh";
  assert.deepEqual(
    await port.setStanding({
      idempotencyKey: key,
      familyId: FAMILY,
      schoolYearId: YEAR,
      standing: "leaving",
      expectedVersion: 0,
    }),
    { state: "success", data: { id: WEEK, version: 2 } },
  );
  await port.pickSlot({
    idempotencyKey: key,
    rotaWeekId: WEEK,
    slot: "sunday_opening",
    expectedVersion: 3,
  });
  await port.assignSlot({
    idempotencyKey: key,
    rotaWeekId: WEEK,
    slot: "saturday_closing",
    expectedVersion: 4,
  });
  assert.deepEqual(fake.rpcCalls, [
    {
      name: "family_standing_set",
      args: {
        p_idempotency_key: key,
        p_family_id: FAMILY,
        p_school_year_id: YEAR,
        p_standing: "leaving",
        p_expected_version: 0,
      },
    },
    {
      name: "weekend_pick_set",
      args: {
        p_idempotency_key: key,
        p_rota_week_id: WEEK,
        p_slot: "sunday_opening",
        p_expected_version: 3,
      },
    },
    {
      name: "weekend_pick_assign",
      args: {
        p_idempotency_key: key,
        p_rota_week_id: WEEK,
        p_slot: "saturday_closing",
        p_expected_version: 4,
      },
    },
  ]);
});

test("a refused standing, pick or assign keeps the state and code of the refusal", async () => {
  const cases: [string, string, "validation" | "conflict" | "invalidated"][] = [
    ["validation", "STANDING_INVALID", "validation"],
    ["conflict", "WEEKEND_SLOT_TAKEN", "conflict"],
    ["conflict", "WEEKEND_PICK_CLOSED", "conflict"],
    ["conflict", "WEEKEND_PICK_LOCKED", "conflict"],
    ["validation", "WEEKEND_PICK_NOT_NEEDED", "validation"],
    ["validation", "WEEKEND_SLOT_NOT_PICKABLE", "validation"],
    ["conflict", "VERSION_CONFLICT", "conflict"],
  ];
  for (const [state, code, expected] of cases) {
    const { port } = rota({ rpc: () => envelope(state, code) });
    const outcome = await port.pickSlot({
      idempotencyKey: "key-0001-abcdefgh",
      rotaWeekId: WEEK,
      slot: "sunday_opening",
      expectedVersion: 1,
    });
    const seen = outcome as { state: string; code?: string };
    assert.deepEqual([seen.state, seen.code], [expected, code], code);
  }
  const { port } = rota({ rpc: () => envelope("denied", "authorization_denied") });
  assert.deepEqual(
    await port.assignSlot({
      idempotencyKey: "key-0001-abcdefgh",
      rotaWeekId: WEEK,
      slot: "sunday_opening",
      expectedVersion: 1,
    }),
    { state: "denied" },
  );
});

test("every command passes its key and version to the named function and returns the new version", async () => {
  const { fake, port } = rota({ rpc: () => envelope("success", null, { version: 4 }, WEEK) });
  const key = "key-0001-abcdefgh";
  assert.deepEqual(
    await port.addBreakWeek({ idempotencyKey: key, schoolYearId: YEAR, weekStart: "2026-12-21" }),
    {
      state: "success",
      data: { id: WEEK, version: 4 },
    },
  );
  await port.removeBreakWeek({ idempotencyKey: key, breakWeekId: WEEK, expectedVersion: 1 });
  await port.makeDraft({ idempotencyKey: key, schoolYearId: YEAR });
  await port.setWeek({ idempotencyKey: key, weekId: WEEK, familyId: null, expectedVersion: 2 });
  await port.discard({ idempotencyKey: key, planId: PLAN, expectedVersion: 3, changedWeeks: 2 });
  await port.publish({ idempotencyKey: key, planId: PLAN, expectedVersion: 3 });
  assert.deepEqual(fake.rpcCalls, [
    {
      name: "break_week_add",
      args: {
        p_idempotency_key: key,
        p_school_year_id: YEAR,
        p_week_start: "2026-12-21",
        p_label: null,
      },
    },
    {
      name: "break_week_remove",
      args: { p_idempotency_key: key, p_break_week_id: WEEK, p_expected_version: 1 },
    },
    { name: "rota_plan_make", args: { p_idempotency_key: key, p_school_year_id: YEAR } },
    {
      name: "rota_week_set",
      args: { p_idempotency_key: key, p_week_id: WEEK, p_family_id: null, p_expected_version: 2 },
    },
    {
      name: "rota_plan_discard",
      args: { p_idempotency_key: key, p_plan_id: PLAN, p_expected_version: 3, p_changed_weeks: 2 },
    },
    {
      name: "rota_plan_publish",
      args: { p_idempotency_key: key, p_plan_id: PLAN, p_expected_version: 3 },
    },
  ]);
});

test("a refused command keeps the state and the code of the refusal, so the screen can explain it", async () => {
  const cases: [string, string, unknown][] = [
    ["conflict", "ROTA_PLAN_EXISTS", { state: "conflict", code: "ROTA_PLAN_EXISTS" }],
    ["conflict", "ROTA_PLAN_PUBLISHED", { state: "conflict", code: "ROTA_PLAN_PUBLISHED" }],
    ["conflict", "DUTY_ROTA_MANAGED", { state: "conflict", code: "DUTY_ROTA_MANAGED" }],
    [
      "invalidated",
      "ROTA_DISCARD_OUTDATED",
      { state: "invalidated", code: "ROTA_DISCARD_OUTDATED" },
    ],
    ["conflict", "VERSION_CONFLICT", { state: "conflict", code: "VERSION_CONFLICT" }],
    ["denied", "authorization_denied", { state: "denied" }],
  ];
  for (const [state, code, expected] of cases) {
    const { port } = rota({ rpc: () => envelope(state, code) });
    assert.deepEqual(
      await port.publish({ idempotencyKey: "key-0001-abcdefgh", planId: PLAN, expectedVersion: 1 }),
      expected,
      code,
    );
  }
  for (const code of [
    "ROTA_WEEKS_EMPTY",
    "ROTA_BREAK_WEEK",
    "ROTA_FAMILY_INELIGIBLE",
    "BREAK_WEEK_INVALID",
    "BREAK_WEEK_EXISTS",
  ]) {
    const { port } = rota({ rpc: () => envelope("validation", code) });
    const outcome = await port.makeDraft({
      idempotencyKey: "key-0001-abcdefgh",
      schoolYearId: YEAR,
    });
    assert.equal(outcome.state, "validation");
    assert.equal(outcome.state === "validation" && outcome.code, code);
  }
});

test("the task list leaves rota duties out and a task is looked up as a manual duty only (BR24.4)", async () => {
  const fake = fakeData({ table: () => ok([]) });
  const scope: Scope = { id: ORG, type: "organization", organizationId: ORG };
  const adapter = createAdminPort(fake.database);
  const run = (operation: AdminOperation, payload: Record<string, unknown> = {}) =>
    adapter.execute<unknown>({ actorId: "ignored", operation, scope, payload });
  await run("tasks.list");
  const tasks = fake.queries.find((query) => query.table === "tasks");
  assert.ok(tasks);
  assert.deepEqual(
    tasks.steps.find((step) => step[0] === "eq"),
    ["eq", "origin_kind", "manual"],
  );
  const events = fake.queries.find((query) => query.table === "events");
  assert.equal(
    events?.steps.some((step) => step[1] === "origin_kind"),
    false,
  );
  fake.queries.length = 0;
  await run("tasks.save", { id: DUTY, expectedVersion: 1, title: "x" });
  const lookup = fake.queries.filter((query) => query.table === "tasks");
  assert.ok(lookup.length > 0);
  for (const query of lookup) {
    assert.ok(query.steps.some((step) => step[1] === "origin_kind" && step[2] === "manual"));
  }
});
