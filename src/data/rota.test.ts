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
      week_start: "2026-09-07",
      is_break: false,
      family_id: null,
      family_display_name: null,
      empty_reason: "cleared",
      changed_by_admin: true,
      version: 2,
    },
  ],
  families: [{ family_id: FAMILY, display_name: "Minta család", weeks: 9, above_lowest: false }],
  changed_weeks: 2,
  blockers: {
    empty_weeks: [{ week_start: "2026-09-07", reason: "cleared" }],
    break_weeks: [],
    ineligible_weeks: [],
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
  assert.deepEqual(outcome.data.blockers.emptyWeeks, ["2026-09-07"]);
  assert.equal(outcome.data.canPublish, false);
  assert.equal(outcome.data.families[0]?.weeks, 9);
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
      }),
  });
  const outcome = await port.overview();
  assert.equal(outcome.state, "success");
  if (outcome.state !== "success") return;
  assert.equal(outcome.data.items[0]?.isOwn, false);
});

test("nothing published is a success with its own state, not a refusal and not an empty list (BR24.1)", async () => {
  const { port } = rota({
    rpc: () =>
      envelope("success", null, {
        overview_state: "nothing_published",
        school_year: null,
        items: [],
      }),
  });
  const outcome = await port.overview();
  assert.deepEqual(outcome, {
    state: "success",
    data: { overviewState: "nothing_published", items: [] },
  });
});

test("an overview of an unknown state is a malformed response", async () => {
  const { port } = rota({
    rpc: () => envelope("success", null, { overview_state: "draft", items: [] }),
  });
  await assert.rejects(() => port.overview(), TerminalDataFailure);
});

test("the duty card maps the week and always says there is no fixed day (BR24.2, BR24.3)", async () => {
  const item = {
    duty_id: DUTY,
    job: "indoor_cleaning",
    title: "Belső takarítás",
    family_display_name: "Minta család",
    week_start: "2026-08-31",
    week_end: "2026-09-06",
    no_fixed_day: true,
    is_break_week: false,
  };
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
    },
  });
  const wrong = rota({
    rpc: () => envelope("success", null, { item: { ...item, no_fixed_day: false } }),
  });
  await assert.rejects(() => wrong.port.dutyCard({ dutyId: DUTY }), TerminalDataFailure);
  const denied = await rota({
    rpc: () => envelope("denied", "authorization_denied"),
  }).port.dutyCard({ dutyId: DUTY });
  assert.deepEqual(denied, { state: "denied" });
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
