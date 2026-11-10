import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import {
  ADMIN_G1,
  ADMIN_G2,
  ASSIGNMENT_F2_T3,
  asActor,
  authenticated,
  callFunction,
  countAs,
  DIRECTORY_SCHEMAS,
  FAMILY_1,
  FAMILY_2,
  FAMILY_NO_GROUP,
  FAMILY_OTHER,
  nextKey,
  openDirectoryDatabase,
  ORGANIZATION,
  OTHER_ADMIN,
  OTHER_ORGANIZATION,
  OUTSIDER,
  PARENT_F1,
  PARENT_F2,
  SIGNED_OUT,
  seedCoordinationWorld,
  SUPER_ADMIN,
  TASK_3,
  TEACHER_G1,
  uuid,
  YEAR_1,
  YEAR_OTHER,
} from "./directory-support.ts";
import { auditEvents, count } from "./identity-support.ts";
import {
  makeDraft,
  type PlanHandle,
  type PlanView,
  publish,
  readPlan,
  schoolWeekStarts,
} from "./rota-support.ts";
import { failureOf, openDatabase, report, useSchema } from "./stack-support.ts";

/** The fixed-list tests of BR21.1 to BR27.2 (the rota plan, the duty model and the rules around them). */
const ROTA_DUTY = "origin_kind = 'rota_week'";
const OVERVIEW_FIELDS = [
  "duty_id",
  "family_display_name",
  "family_id",
  "is_break",
  "is_own",
  "job",
  "week_start",
];

for (const schema of DIRECTORY_SCHEMAS) {
  describe(`rota plan in ${schema}`, () => {
    let db: pg.Client;
    let second: pg.Client;
    before(async () => {
      db = await openDirectoryDatabase(schema);
      second = await openDatabase();
      await useSchema(second, schema);
    });
    after(async () => {
      await second.end();
      await db.end();
    });
    beforeEach(() => seedCoordinationWorld(db, schema));

    const call = (account: string, sql: string, values: unknown[]) =>
      callFunction(db, schema, account, sql, values);
    const callSecond = (account: string, sql: string, values: unknown[]) =>
      callFunction(second, schema, account, sql, values);
    const setWeek = (
      account: string,
      weekId: string,
      family: string | null,
      version: number,
      key = nextKey("week"),
    ) => call(account, "rota_week_set($1, $2, $3, $4)", [key, weekId, family, version]);
    const discard = (
      account: string,
      plan: PlanHandle,
      changed: number,
      key = nextKey("discard"),
    ) => call(account, "rota_plan_discard($1, $2, $3, $4)", [key, plan.id, plan.version, changed]);
    const activeFamilies = async () =>
      (
        await db.query(
          "select id from families where organization_id = $1 and status = 'active' order by lower(display_name), id",
          [ORGANIZATION],
        )
      ).rows.map((row) => String(row.id));
    const weeksOf = async (family: string) =>
      (
        await db.query(
          "select to_char(w.week_start, 'YYYY-MM-DD') as d from rota_weeks w where w.family_id = $1 order by w.week_start",
          [family],
        )
      ).rows.map((row) => String(row.d));
    const published = async () => {
      const draft = await makeDraft(db, schema);
      const done = await publish(db, schema, draft);
      assert.equal(done.state, "success", JSON.stringify(done));
      return draft;
    };
    const dutyOf = async (family: string) =>
      (
        await db.query(
          "select t.id as task_id, a.id as place_id, a.version as place_version, t.version as task_version from tasks t join assignments a on a.task_id = t.id where t.origin_kind = 'rota_week' and a.family_id = $1 order by t.starts_at limit 1",
          [family],
        )
      ).rows[0] as {
        task_id: string;
        place_id: string;
        place_version: number;
        task_version: number;
      };
    const withTrigger = async (table: string, body: string, run: () => Promise<void>) => {
      const name = `forced_${table}`;
      await db.query(
        `create function "${schema}".${name}() returns trigger language plpgsql as $$ begin ${body} end $$`,
      );
      await db.query(
        `create trigger ${name} before insert on "${schema}".${table} for each row execute function "${schema}".${name}()`,
      );
      try {
        await run();
      } finally {
        await db.query(`drop trigger ${name} on "${schema}".${table}`);
        await db.query(`drop function "${schema}".${name}()`);
      }
    };

    // ---- BR21: the draft ------------------------------------------------------------------------------

    it("BR21.1 super admin makes a draft", async () => {
      const draft = await makeDraft(db, schema);
      const rows = await db.query("select status from rota_plans where id = $1", [draft.id]);
      assert.deepEqual(
        rows.rows.map((row) => row.status),
        ["draft"],
      );
    });

    it("BR21.1 second plan refused", async () => {
      await makeDraft(db, schema);
      const again = await call(SUPER_ADMIN, "rota_plan_make($1, $2)", [nextKey("make"), YEAR_1]);
      assert.deepEqual([again.state, again.code], ["conflict", "ROTA_PLAN_EXISTS"]);
      assert.equal(await count(db, "rota_plans"), 1);
    });

    it("BR21.1 other community", async () => {
      const refused = await call(OTHER_ADMIN, "rota_plan_make($1, $2)", [nextKey("make"), YEAR_1]);
      assert.deepEqual([refused.state, refused.code], ["denied", "authorization_denied"]);
      for (const account of [PARENT_F1, TEACHER_G1, ADMIN_G1]) {
        const result = await call(account, "rota_plan_make($1, $2)", [nextKey("make"), YEAR_1]);
        assert.equal(result.state, "denied");
      }
      assert.equal(await count(db, "rota_plans"), 0);
    });

    it("BR21.1 repeat", async () => {
      const key = nextKey("make");
      const first = await call(SUPER_ADMIN, "rota_plan_make($1, $2)", [key, YEAR_1]);
      const again = await call(SUPER_ADMIN, "rota_plan_make($1, $2)", [key, YEAR_1]);
      assert.deepEqual(
        [again.state, again.code, again.reference],
        ["success", "replayed", first.reference],
      );
      assert.equal(await count(db, "rota_plans"), 1);
    });

    it("BR21.1 two drafts", async () => {
      const [a, b] = await Promise.all([
        call(SUPER_ADMIN, "rota_plan_make($1, $2)", [nextKey("make"), YEAR_1]),
        callSecond(SUPER_ADMIN, "rota_plan_make($1, $2)", [nextKey("make"), YEAR_1]),
      ]);
      assert.deepEqual([a.state, b.state].sort(), ["conflict", "success"]);
      assert.equal(await count(db, "rota_plans"), 1);
    });

    it("BR21.2 row count", async () => {
      await db.query(
        "insert into break_weeks (organization_id, school_year_id, week_start) values ($1, $2, '2026-12-21')",
        [ORGANIZATION, YEAR_1],
      );
      await makeDraft(db, schema);
      const weeks = await schoolWeekStarts(db);
      assert.equal(await count(db, "rota_weeks"), weeks.length);
      const brk = await db.query(
        "select family_id, empty_reason from rota_weeks where week_start = '2026-12-21'",
      );
      assert.deepEqual([brk.rows[0].family_id, brk.rows[0].empty_reason], [null, null]);
    });

    it("BR21.3 active families only", async () => {
      await db.query("update families set status = 'archived', archived_at = now() where id = $1", [
        FAMILY_NO_GROUP,
      ]);
      await db.query("update families set status = 'archived', archived_at = now() where id = $1", [
        FAMILY_1,
      ]);
      await makeDraft(db, schema);
      assert.equal(
        await count(db, "rota_weeks", `family_id in ('${FAMILY_NO_GROUP}', '${FAMILY_1}')`),
        0,
      );
      assert.ok((await count(db, "rota_weeks", "family_id is not null")) > 0);
    });

    it("BR21.3 empty weeks keep a reason", async () => {
      await db.query(
        "update families set status = 'archived', archived_at = now() where organization_id = $1",
        [ORGANIZATION],
      );
      await makeDraft(db, schema);
      assert.equal(
        await count(db, "rota_weeks", "family_id is null and empty_reason = 'no_family'"),
        await count(db, "rota_weeks"),
      );
    });

    it("BR21.4 even spread, same result twice", async () => {
      const draft = await makeDraft(db, schema);
      const first = await readPlan(db, schema);
      const counts = first.families.map((f) => f.weeks);
      assert.ok(Math.max(...counts) - Math.min(...counts) <= 1, JSON.stringify(counts));
      // The cycle starts at the family at (calendar year of the start) modulo (number of families).
      const ordered = await activeFamilies();
      assert.equal(first.items[0]?.family_id, ordered[2026 % ordered.length]);
      assert.equal(first.items[1]?.family_id, ordered[(2026 + 1) % ordered.length]);
      const shape = (view: PlanView) => view.items.map((w) => [w.week_start, w.family_id]);
      const discarded = await discard(SUPER_ADMIN, draft, 0);
      assert.equal(discarded.state, "success", JSON.stringify(discarded));
      await makeDraft(db, schema);
      assert.deepEqual(shape(await readPlan(db, schema)), shape(first));
    });

    it("BR21.4 draft twice after discard", async () => {
      const draft = await makeDraft(db, schema);
      await discard(SUPER_ADMIN, draft, 0);
      const again = await makeDraft(db, schema);
      assert.notEqual(again.id, draft.id);
      assert.equal(await count(db, "rota_plans"), 1);
    });

    it("BR21.5 discard with count", async () => {
      const draft = await makeDraft(db, schema);
      const view = await readPlan(db, schema);
      const week = view.items[3];
      assert.ok(week);
      const changed = await setWeek(SUPER_ADMIN, week.id, FAMILY_2, week.version);
      assert.equal(changed.state, "success");
      const fresh = await readPlan(db, schema);
      assert.equal(fresh.changed_weeks, 1);
      const result = await discard(
        SUPER_ADMIN,
        { id: draft.id, version: fresh.plan?.version ?? 0 },
        1,
      );
      assert.equal(result.state, "success", JSON.stringify(result));
      assert.equal(await count(db, "rota_plans"), 0);
      assert.equal(await count(db, "rota_weeks"), 0);
    });

    it("BR21.5 published plan refused", async () => {
      const draft = await published();
      const result = await discard(SUPER_ADMIN, { id: draft.id, version: draft.version + 1 }, 0);
      assert.deepEqual([result.state, result.code], ["conflict", "ROTA_PLAN_PUBLISHED"]);
      assert.equal(await count(db, "rota_plans"), 1);
    });

    it("BR21.5 other community", async () => {
      const draft = await makeDraft(db, schema);
      const result = await discard(OTHER_ADMIN, draft, 0);
      assert.deepEqual([result.state, result.code], ["denied", "authorization_denied"]);
      assert.equal(await count(db, "rota_plans"), 1);
    });

    it("BR21.5 stale version", async () => {
      const draft = await makeDraft(db, schema);
      const stale = await discard(SUPER_ADMIN, { id: draft.id, version: 7 }, 0);
      assert.deepEqual([stale.state, stale.code], ["conflict", "VERSION_CONFLICT"]);
      const view = await readPlan(db, schema);
      const week = view.items[0];
      assert.ok(week);
      await setWeek(SUPER_ADMIN, week.id, FAMILY_2, week.version);
      const outdated = await discard(SUPER_ADMIN, { id: draft.id, version: draft.version }, 0);
      assert.equal(outdated.code, "VERSION_CONFLICT");
      assert.equal(await count(db, "rota_plans"), 1);
      // The count of hand-changed weeks the screen showed must still be right.
      const fresh = await readPlan(db, schema);
      const wrongCount = await discard(
        SUPER_ADMIN,
        { id: draft.id, version: fresh.plan?.version ?? 0 },
        0,
      );
      assert.deepEqual(
        [wrongCount.state, wrongCount.code],
        ["invalidated", "ROTA_DISCARD_OUTDATED"],
      );
    });

    it("BR21.5 repeat", async () => {
      const draft = await makeDraft(db, schema);
      const key = nextKey("discard");
      const first = await discard(SUPER_ADMIN, draft, 0, key);
      const again = await discard(SUPER_ADMIN, draft, 0, key);
      assert.deepEqual([first.state, again.state, again.code], ["success", "success", "replayed"]);
    });

    it("BR21.5 discard racing publish", async () => {
      const draft = await makeDraft(db, schema);
      const [a, b] = await Promise.all([
        discard(SUPER_ADMIN, draft, 0),
        callSecond(SUPER_ADMIN, "rota_plan_publish($1, $2, $3)", [
          nextKey("publish"),
          draft.id,
          draft.version,
        ]),
      ]);
      assert.equal(a.state === "success" || b.state === "success", true);
      assert.notEqual(a.state === "success", b.state === "success");
      assert.equal(await count(db, "rota_plans"), a.state === "success" ? 0 : 1);
      assert.equal(await count(db, "tasks", ROTA_DUTY), a.state === "success" ? 0 : 44);
    });

    // ---- BR22: adjusting the draft --------------------------------------------------------------------

    it("BR22.1 family and empty", async () => {
      await makeDraft(db, schema);
      const week = (await readPlan(db, schema)).items[4];
      assert.ok(week);
      const set = await setWeek(SUPER_ADMIN, week.id, FAMILY_NO_GROUP, week.version);
      assert.equal(set.state, "success");
      assert.equal((await weeksOf(FAMILY_NO_GROUP)).includes(week.week_start), true);
      const cleared = await setWeek(SUPER_ADMIN, week.id, null, week.version + 1);
      assert.equal(cleared.state, "success");
      const row = await db.query(
        "select family_id, empty_reason, changed_by_admin from rota_weeks where id = $1",
        [week.id],
      );
      assert.deepEqual(row.rows[0], {
        family_id: null,
        empty_reason: "cleared",
        changed_by_admin: true,
      });
    });

    it("BR22.1 archived family refused", async () => {
      await makeDraft(db, schema);
      const week = (await readPlan(db, schema)).items[4];
      assert.ok(week);
      await db.query("update families set status = 'archived', archived_at = now() where id = $1", [
        FAMILY_NO_GROUP,
      ]);
      const archived = await setWeek(SUPER_ADMIN, week.id, FAMILY_NO_GROUP, week.version);
      assert.deepEqual([archived.state, archived.code], ["validation", "ROTA_FAMILY_INELIGIBLE"]);
      const foreign = await setWeek(SUPER_ADMIN, week.id, FAMILY_OTHER, week.version);
      assert.equal(foreign.code, "ROTA_FAMILY_INELIGIBLE");
      const parent = await setWeek(PARENT_F1, week.id, FAMILY_1, week.version);
      assert.equal(parent.state, "denied");
    });

    it("BR22.1 other community, other plan", async () => {
      await makeDraft(db, schema);
      const week = (await readPlan(db, schema)).items[4];
      assert.ok(week);
      const refused = await setWeek(OTHER_ADMIN, week.id, FAMILY_OTHER, week.version);
      assert.deepEqual([refused.state, refused.code], ["denied", "authorization_denied"]);
      const missing = await setWeek(SUPER_ADMIN, uuid(9999), FAMILY_1, 1);
      assert.equal(missing.state, "denied");
    });

    it("BR22.1 stale version", async () => {
      await makeDraft(db, schema);
      const week = (await readPlan(db, schema)).items[4];
      assert.ok(week);
      const stale = await setWeek(SUPER_ADMIN, week.id, FAMILY_2, week.version + 3);
      assert.deepEqual([stale.state, stale.code], ["conflict", "VERSION_CONFLICT"]);
    });

    it("BR22.1 repeat", async () => {
      await makeDraft(db, schema);
      const week = (await readPlan(db, schema)).items[4];
      assert.ok(week);
      const key = nextKey("week");
      const first = await setWeek(SUPER_ADMIN, week.id, FAMILY_2, week.version, key);
      const again = await setWeek(SUPER_ADMIN, week.id, FAMILY_2, week.version, key);
      assert.deepEqual([first.state, again.state, again.code], ["success", "success", "replayed"]);
    });

    it("BR22.1 two editors", async () => {
      await makeDraft(db, schema);
      const view = await readPlan(db, schema);
      const [one, two] = [view.items[1], view.items[2]];
      assert.ok(one && two);
      const [a, b] = await Promise.all([
        setWeek(SUPER_ADMIN, one.id, FAMILY_2, one.version),
        callSecond(SUPER_ADMIN, "rota_week_set($1, $2, $3, $4)", [
          nextKey("week"),
          two.id,
          FAMILY_1,
          two.version,
        ]),
      ]);
      assert.deepEqual([a.state, b.state], ["success", "success"]);
    });

    it("BR22.2 family on break week refused", async () => {
      await db.query(
        "insert into break_weeks (organization_id, school_year_id, week_start) values ($1, $2, '2026-12-21')",
        [ORGANIZATION, YEAR_1],
      );
      await makeDraft(db, schema);
      const week = (await readPlan(db, schema)).items.find((w) => w.week_start === "2026-12-21");
      assert.ok(week);
      const refused = await setWeek(SUPER_ADMIN, week.id, FAMILY_1, week.version);
      assert.deepEqual([refused.state, refused.code], ["validation", "ROTA_BREAK_WEEK"]);
    });

    it("BR22.3 warning, change kept", async () => {
      await makeDraft(db, schema);
      const view = await readPlan(db, schema);
      const others = view.items.filter((w) => w.family_id !== FAMILY_1).slice(0, 4);
      for (const week of others) {
        const set = await setWeek(SUPER_ADMIN, week.id, FAMILY_1, week.version);
        assert.equal(set.state, "success");
      }
      const after = await readPlan(db, schema);
      const row = after.families.find((f) => f.family_id === FAMILY_1);
      assert.equal(row?.above_lowest, true);
      assert.equal((await weeksOf(FAMILY_1)).length, row?.weeks);
    });

    it("BR22.4 sequential result", async () => {
      await makeDraft(db, schema);
      const week = (await readPlan(db, schema)).items[7];
      assert.ok(week);
      const one = await setWeek(SUPER_ADMIN, week.id, FAMILY_1, week.version);
      const two = await setWeek(SUPER_ADMIN, week.id, FAMILY_2, week.version + 1);
      assert.deepEqual([one.state, two.state], ["success", "success"]);
      assert.equal(two.version, week.version + 2);
    });

    it("BR22.4 VERSION_CONFLICT", async () => {
      await makeDraft(db, schema);
      const week = (await readPlan(db, schema)).items[7];
      assert.ok(week);
      await setWeek(SUPER_ADMIN, week.id, FAMILY_1, week.version);
      const stale = await setWeek(SUPER_ADMIN, week.id, FAMILY_2, week.version);
      assert.deepEqual([stale.state, stale.code], ["conflict", "VERSION_CONFLICT"]);
    });

    it("BR22.4 stale version", async () => {
      const draft = await makeDraft(db, schema);
      const week = (await readPlan(db, schema)).items[7];
      assert.ok(week);
      await setWeek(SUPER_ADMIN, week.id, FAMILY_1, week.version);
      const result = await publish(db, schema, draft);
      assert.deepEqual([result.state, result.code], ["conflict", "VERSION_CONFLICT"]);
    });

    it("BR22.4 repeat", async () => {
      await makeDraft(db, schema);
      const week = (await readPlan(db, schema)).items[7];
      assert.ok(week);
      const key = nextKey("week");
      await setWeek(SUPER_ADMIN, week.id, FAMILY_1, week.version, key);
      const again = await setWeek(SUPER_ADMIN, week.id, FAMILY_1, week.version, key);
      assert.equal(again.code, "replayed");
    });

    it("BR22.4 two admins on one week", async () => {
      await makeDraft(db, schema);
      const week = (await readPlan(db, schema)).items[7];
      assert.ok(week);
      const [a, b] = await Promise.all([
        setWeek(SUPER_ADMIN, week.id, FAMILY_1, week.version),
        callSecond(SUPER_ADMIN, "rota_week_set($1, $2, $3, $4)", [
          nextKey("week"),
          week.id,
          FAMILY_2,
          week.version,
        ]),
      ]);
      assert.deepEqual([a.state, b.state].sort(), ["conflict", "success"]);
    });

    it("BR22.5 super admin sees it", async () => {
      await makeDraft(db, schema);
      const view = await readPlan(db, schema);
      assert.equal(view.state, "success");
      assert.equal(view.plan?.status, "draft");
      assert.equal(view.can_publish, true);
    });

    it("BR22.5 parent, teacher see nothing", async () => {
      const before = await call(PARENT_F1, "rota_overview()", []);
      await makeDraft(db, schema);
      for (const account of [PARENT_F1, TEACHER_G1, ADMIN_G1]) {
        const read = await call(account, "rota_plan_get($1)", [YEAR_1]);
        assert.equal(read.state, "denied");
        const overview = await call(account, "rota_overview()", []);
        assert.equal(overview.overview_state, "nothing_published");
      }
      const after = await call(PARENT_F1, "rota_overview()", []);
      assert.deepEqual(after, before);
      assert.equal(await countAs(db, schema, PARENT_F1, "rota_plans"), 0);
      assert.equal(await countAs(db, schema, PARENT_F1, "rota_weeks"), 0);
    });

    it("BR22.5 other community", async () => {
      await makeDraft(db, schema);
      const read = await call(OTHER_ADMIN, "rota_plan_get($1)", [YEAR_1]);
      assert.deepEqual([read.state, read.code], ["denied", "authorization_denied"]);
      const own = await call(OTHER_ADMIN, "rota_plan_get($1)", [YEAR_OTHER]);
      assert.equal(own.state, "success");
      assert.equal(own.plan, null);
    });

    // ---- BR23: publishing -----------------------------------------------------------------------------

    it("BR23.1 complete plan", async () => {
      const draft = await makeDraft(db, schema);
      const result = await publish(db, schema, draft);
      assert.equal(result.state, "success");
      const row = await db.query("select status, published_by from rota_plans where id = $1", [
        draft.id,
      ]);
      assert.deepEqual([row.rows[0].status, row.rows[0].published_by], ["published", SUPER_ADMIN]);
    });

    it("BR23.1 empty weeks, break week, ineligible family refused", async () => {
      const draft = await makeDraft(db, schema);
      const view = await readPlan(db, schema);
      const week = view.items[5];
      assert.ok(week);
      await setWeek(SUPER_ADMIN, week.id, null, week.version);
      const fresh = await readPlan(db, schema);
      assert.equal(fresh.can_publish, false);
      const empty = await publish(db, schema, { id: draft.id, version: fresh.plan?.version ?? 0 });
      assert.deepEqual([empty.state, empty.code], ["validation", "ROTA_WEEKS_EMPTY"]);
      await setWeek(SUPER_ADMIN, week.id, FAMILY_2, week.version + 1);
      // A week that became a break week after it was filled.
      await db.query(
        "insert into break_weeks (organization_id, school_year_id, week_start) values ($1, $2, $3)",
        [ORGANIZATION, YEAR_1, week.week_start],
      );
      const next = await readPlan(db, schema);
      const breakWeek = await publish(db, schema, {
        id: draft.id,
        version: next.plan?.version ?? 0,
      });
      assert.deepEqual([breakWeek.state, breakWeek.code], ["validation", "ROTA_BREAK_WEEK"]);
      await db.query("delete from break_weeks");
      await db.query("update families set status = 'archived', archived_at = now() where id = $1", [
        FAMILY_2,
      ]);
      const ineligible = await publish(db, schema, {
        id: draft.id,
        version: next.plan?.version ?? 0,
      });
      assert.deepEqual(
        [ineligible.state, ineligible.code],
        ["validation", "ROTA_FAMILY_INELIGIBLE"],
      );
      assert.equal(await count(db, "tasks", ROTA_DUTY), 0);
    });

    it("BR23.1 other community", async () => {
      const draft = await makeDraft(db, schema);
      const result = await publish(db, schema, draft, OTHER_ADMIN);
      assert.deepEqual([result.state, result.code], ["denied", "authorization_denied"]);
      for (const account of [PARENT_F1, TEACHER_G1, ADMIN_G1]) {
        assert.equal((await publish(db, schema, draft, account)).state, "denied");
      }
      assert.equal(await count(db, "tasks", ROTA_DUTY), 0);
    });

    it("BR23.1 stale version", async () => {
      const draft = await makeDraft(db, schema);
      const stale = await publish(db, schema, { id: draft.id, version: 9 });
      assert.deepEqual([stale.state, stale.code], ["conflict", "VERSION_CONFLICT"]);
    });

    it("BR23.1 repeat", async () => {
      const draft = await makeDraft(db, schema);
      const key = nextKey("publish");
      const first = await publish(db, schema, draft, SUPER_ADMIN, key);
      const again = await publish(db, schema, draft, SUPER_ADMIN, key);
      assert.deepEqual([first.state, again.state, again.code], ["success", "success", "replayed"]);
    });

    it("BR23.1 publish racing a change", async () => {
      const draft = await makeDraft(db, schema);
      const week = (await readPlan(db, schema)).items[2];
      assert.ok(week);
      const [change, result] = await Promise.all([
        setWeek(SUPER_ADMIN, week.id, FAMILY_NO_GROUP, week.version),
        callSecond(SUPER_ADMIN, "rota_plan_publish($1, $2, $3)", [
          nextKey("publish"),
          draft.id,
          draft.version,
        ]),
      ]);
      const outcome = [
        change.state,
        change.code ?? "null",
        result.state,
        result.code ?? "null",
      ].join("|");
      assert.ok(
        outcome === "success|null|conflict|VERSION_CONFLICT" ||
          outcome === "conflict|ROTA_PLAN_PUBLISHED|success|null",
        outcome,
      );
    });

    it("BR23.2 one duty and one place per week", async () => {
      await published();
      const weeks = await schoolWeekStarts(db);
      assert.equal(await count(db, "tasks", ROTA_DUTY), weeks.length);
      assert.equal(
        await count(db, "assignments", "source = 'rota_publish' and status = 'active'"),
        weeks.length,
      );
      const duty = await db.query(
        "select title, category, capacity, group_id, status, to_char(starts_at at time zone 'Europe/Budapest', 'YYYY-MM-DD HH24:MI:SS') as s, to_char(ends_at at time zone 'Europe/Budapest', 'YYYY-MM-DD HH24:MI:SS') as e from tasks where origin_kind = 'rota_week' order by starts_at limit 1",
      );
      assert.deepEqual(duty.rows[0], {
        title: "Belső takarítás",
        category: "rota_indoor_cleaning",
        capacity: 1,
        group_id: null,
        status: "open",
        s: "2026-08-31 00:00:00",
        e: "2026-09-06 23:59:59",
      });
    });

    it("BR23.2 forced failure rolls back", async () => {
      const draft = await makeDraft(db, schema);
      await withTrigger("notifications", "raise exception 'forced failure';", async () => {
        const failure = await failureOf(() => publish(db, schema, draft));
        assert.ok(failure, "the publish must fail");
      });
      assert.equal(
        (await db.query("select status from rota_plans where id = $1", [draft.id])).rows[0].status,
        "draft",
      );
      assert.equal(await count(db, "tasks", ROTA_DUTY), 0);
      assert.equal(await count(db, "assignments", "source = 'rota_publish'"), 0);
      assert.equal(await count(db, "notifications", "kind = 'rota_published'"), 0);
      assert.equal(await count(db, "audit_events", "action = 'rota.publish'"), 0);
      // The draft still publishes once the failure is gone.
      assert.equal((await publish(db, schema, draft)).state, "success");
    });

    it("BR23.2 no duplicate duty", async () => {
      const draft = await published();
      const key = nextKey("publish");
      const again = await publish(
        db,
        schema,
        { id: draft.id, version: draft.version + 1 },
        SUPER_ADMIN,
        key,
      );
      assert.equal(again.code, "ROTA_PLAN_PUBLISHED");
      assert.equal(await count(db, "tasks", ROTA_DUTY), (await schoolWeekStarts(db)).length);
    });

    it("BR23.2 two publishes", async () => {
      const draft = await makeDraft(db, schema);
      const [a, b] = await Promise.all([
        publish(db, schema, draft),
        callSecond(SUPER_ADMIN, "rota_plan_publish($1, $2, $3)", [
          nextKey("publish"),
          draft.id,
          draft.version,
        ]),
      ]);
      assert.deepEqual([a.state, b.state].sort(), ["conflict", "success"]);
      assert.equal(await count(db, "tasks", ROTA_DUTY), (await schoolWeekStarts(db)).length);
    });

    it("BR23.3 first publish", async () => {
      const draft = await published();
      const row = await db.query(
        "select status, published_at is not null as stamped from rota_plans where id = $1",
        [draft.id],
      );
      assert.deepEqual(row.rows[0], { status: "published", stamped: true });
    });

    it("BR23.3 second refused ROTA_PLAN_PUBLISHED", async () => {
      const draft = await published();
      const again = await publish(db, schema, { id: draft.id, version: draft.version + 1 });
      assert.deepEqual([again.state, again.code], ["conflict", "ROTA_PLAN_PUBLISHED"]);
      const week = await db.query("select id, version from rota_weeks limit 1");
      const edit = await setWeek(SUPER_ADMIN, week.rows[0].id, FAMILY_1, week.rows[0].version);
      assert.equal(edit.code, "ROTA_PLAN_PUBLISHED");
    });

    it("BR23.3 same key returns stored result", async () => {
      const draft = await makeDraft(db, schema);
      const key = nextKey("publish");
      const first = await publish(db, schema, draft, SUPER_ADMIN, key);
      const again = await publish(db, schema, draft, SUPER_ADMIN, key);
      assert.deepEqual(
        [again.state, again.code, again.reference],
        ["success", "replayed", first.reference],
      );
    });

    it("BR23.3 two publishes", async () => {
      const draft = await makeDraft(db, schema);
      const [a, b] = await Promise.all([
        publish(db, schema, draft),
        callSecond(SUPER_ADMIN, "rota_plan_publish($1, $2, $3)", [
          nextKey("publish"),
          draft.id,
          draft.version,
        ]),
      ]);
      const codes = [a.code, b.code];
      assert.ok(codes.includes("ROTA_PLAN_PUBLISHED"), JSON.stringify(codes));
    });

    const expectedParents = async () =>
      (
        await db.query(
          "select count(*)::int as n from parents p join families f on f.id = p.family_id where p.account_id is not null and p.status = 'active' and f.status = 'active' and p.family_id in (select family_id from rota_weeks where family_id is not null)",
        )
      ).rows[0].n as number;

    it("BR23.4 each parent's own weeks", async () => {
      await published();
      assert.equal(
        await count(db, "notifications", "kind = 'rota_published'"),
        await expectedParents(),
      );
      const list = (await call(PARENT_F1, "notification_list()", [])) as unknown as {
        items: { title: string; text: string | null; link: string }[];
      };
      const notice = list.items.find((item) => item.title === "Közzétették a beosztást");
      assert.ok(notice);
      assert.equal(notice.link, "/szulo/beosztas");
      assert.ok(notice.text?.startsWith("Belső takarítás, a ti heteitek: "));
      const mine = await weeksOf(FAMILY_1);
      const first = mine[0]?.split("-") ?? [];
      assert.ok(notice.text?.includes(`${first[0]}. ${first[1]}. ${first[2]}.`), notice.text ?? "");
    });

    it("BR23.4 no other family named", async () => {
      await published();
      const list = (await call(PARENT_F2, "notification_list()", [])) as unknown as {
        items: { text: string | null }[];
      };
      const text = list.items.map((item) => item.text ?? "").join(" ");
      for (const name of ["Fenyő", "Napraforgó", "koordinátor", "Csoport nélküli"]) {
        assert.equal(text.includes(name), false, name);
      }
      const mine = await weeksOf(FAMILY_2);
      const others = (await weeksOf(FAMILY_1)).filter((d) => !mine.includes(d));
      const [y, m, d] = (others[0] ?? "").split("-");
      assert.equal(text.includes(`${y}. ${m}. ${d}.`), false);
    });

    it("BR23.4 one notice per parent on repeat", async () => {
      const draft = await makeDraft(db, schema);
      const key = nextKey("publish");
      await publish(db, schema, draft, SUPER_ADMIN, key);
      const before = await count(db, "notifications", "kind = 'rota_published'");
      await publish(db, schema, draft, SUPER_ADMIN, key);
      assert.equal(await count(db, "notifications", "kind = 'rota_published'"), before);
    });

    it("BR23.4 two publishes, one notice", async () => {
      const draft = await makeDraft(db, schema);
      await Promise.all([
        publish(db, schema, draft),
        callSecond(SUPER_ADMIN, "rota_plan_publish($1, $2, $3)", [
          nextKey("publish"),
          draft.id,
          draft.version,
        ]),
      ]);
      assert.equal(
        await count(db, "notifications", "kind = 'rota_published'"),
        await expectedParents(),
      );
    });

    it("BR23.5 publish and discard events", async () => {
      const draft = await published();
      const events = (await auditEvents(db)).filter((e) => e.action === "rota.publish");
      assert.equal(events.length, 1);
      assert.deepEqual(
        [events[0]?.target_type, events[0]?.target_id, events[0]?.outcome],
        ["rota_plan", draft.id, "success"],
      );
      await db.query("delete from tasks where origin_kind = 'rota_week'").catch(() => undefined);
    });

    it("BR23.5 discard event", async () => {
      const draft = await makeDraft(db, schema);
      await discard(SUPER_ADMIN, draft, 0);
      const events = (await auditEvents(db)).filter((e) => e.action === "rota.discard");
      assert.equal(events.length, 1);
      assert.equal(events[0]?.target_id, draft.id);
    });

    it("BR23.5 failed audit rolls back", async () => {
      const draft = await makeDraft(db, schema);
      await withTrigger(
        "audit_events",
        "if new.action = 'rota.publish' then raise exception 'forced audit failure'; end if; return new;",
        async () => {
          const failure = await failureOf(() => publish(db, schema, draft));
          assert.ok(failure);
        },
      );
      assert.equal(await count(db, "tasks", ROTA_DUTY), 0);
      assert.equal(
        (await db.query("select status from rota_plans where id = $1", [draft.id])).rows[0].status,
        "draft",
      );
    });

    it("BR23.5 one event on repeat", async () => {
      const draft = await makeDraft(db, schema);
      const key = nextKey("publish");
      await publish(db, schema, draft, SUPER_ADMIN, key);
      await publish(db, schema, draft, SUPER_ADMIN, key);
      assert.equal((await auditEvents(db)).filter((e) => e.action === "rota.publish").length, 1);
    });

    it("BR23.6 none planned", async () => {
      await published();
      assert.equal(await count(db, "reminder_jobs"), 0);
      assert.equal(await count(db, "notifications", "kind in ('reminder_7d', 'reminder_24h')"), 0);
    });

    it("BR23.6 tick twice", async () => {
      await published();
      await db.query("select reminder_plan_organization($1)", [ORGANIZATION]);
      await db.query("select reminder_run_due_system($1)", [ORGANIZATION]);
      await db.query("select reminder_run_due_system($1)", [ORGANIZATION]);
      assert.equal(
        await count(
          db,
          "reminder_jobs",
          "task_id in (select id from tasks where origin_kind = 'rota_week')",
        ),
        0,
      );
      assert.equal(await count(db, "notifications", "kind in ('reminder_7d', 'reminder_24h')"), 0);
    });

    // ---- BR24: seeing the rota ------------------------------------------------------------------------

    it("BR24.1 any signed-in role, published only", async () => {
      await makeDraft(db, schema);
      const draft = await call(PARENT_F1, "rota_overview()", []);
      assert.equal(draft.overview_state, "nothing_published");
      assert.deepEqual(draft.items, []);
      const plan = await readPlan(db, schema);
      await publish(db, schema, { id: plan.plan?.id ?? "", version: plan.plan?.version ?? 0 });
      const weeks = await schoolWeekStarts(db);
      for (const account of [PARENT_F1, TEACHER_G1, ADMIN_G1, SUPER_ADMIN]) {
        const view = (await call(account, "rota_overview()", [])) as unknown as {
          state: string;
          overview_state: string;
          items: Record<string, unknown>[];
        };
        assert.equal(view.state, "success");
        assert.equal(view.overview_state, "published");
        assert.equal(view.items.length, weeks.length);
        // The exact field list (NFR1.2): no child name, contact detail or sharing choice.
        assert.deepEqual(Object.keys(view.items[0] ?? {}).sort(), OVERVIEW_FIELDS);
        const own = view.items.filter((item) => item.is_own === true);
        assert.equal(own.length, account === PARENT_F1 ? (await weeksOf(FAMILY_1)).length : 0);
        assert.equal(view.items.filter((item) => item.duty_id !== null).length, own.length);
      }
    });

    it("BR24.1 signed-out denied", async () => {
      await published();
      for (const account of [SIGNED_OUT, OUTSIDER]) {
        const view = await call(account, "rota_overview()", []);
        assert.equal(view.state, "denied");
      }
    });

    it("BR24.1 other community", async () => {
      await published();
      const view = await call(OTHER_ADMIN, "rota_overview()", []);
      assert.equal(view.overview_state, "nothing_published");
      const text = JSON.stringify(view);
      assert.equal(text.includes("Fenyő"), false);
    });

    it("BR24.2 holding family, super admin", async () => {
      await published();
      const duty = await dutyOf(FAMILY_1);
      for (const account of [PARENT_F1, SUPER_ADMIN]) {
        const card = (await call(account, "rota_duty_card($1)", [duty.task_id])) as unknown as {
          state: string;
          item: Record<string, unknown>;
        };
        assert.equal(card.state, "success");
        assert.equal(card.item.family_display_name, "Fenyő család");
      }
    });

    it("BR24.2 other family refused", async () => {
      await published();
      const duty = await dutyOf(FAMILY_1);
      for (const account of [PARENT_F2, TEACHER_G1, ADMIN_G2]) {
        const card = await call(account, "rota_duty_card($1)", [duty.task_id]);
        assert.deepEqual([card.state, card.code], ["denied", "authorization_denied"], account);
      }
    });

    it("BR24.2 other community, made-up id", async () => {
      await published();
      const duty = await dutyOf(FAMILY_1);
      assert.equal((await call(OTHER_ADMIN, "rota_duty_card($1)", [duty.task_id])).state, "denied");
      const made = await call(SUPER_ADMIN, "rota_duty_card($1)", [uuid(9998)]);
      const same = await call(PARENT_F2, "rota_duty_card($1)", [duty.task_id]);
      assert.deepEqual([made.state, made.code], [same.state, same.code]);
    });

    it("BR24.3 card text", async () => {
      await published();
      const duty = await dutyOf(FAMILY_1);
      const card = (await call(PARENT_F1, "rota_duty_card($1)", [duty.task_id])) as unknown as {
        item: Record<string, unknown>;
      };
      assert.deepEqual(Object.keys(card.item).sort(), [
        "duty_id",
        "family_display_name",
        "is_break_week",
        "job",
        "no_fixed_day",
        "title",
        "week_end",
        "week_start",
      ]);
      assert.equal(card.item.job, "indoor_cleaning");
      assert.equal(card.item.no_fixed_day, true);
      assert.equal(card.item.is_break_week, false);
      const start = new Date(`${card.item.week_start}T00:00:00Z`);
      assert.equal(start.getUTCDay(), 1);
      assert.equal(
        new Date(`${card.item.week_end}T00:00:00Z`).getTime() - start.getTime(),
        6 * 86400000,
      );
    });

    it("BR24.4 left out of lists", async () => {
      await published();
      const list = (await call(PARENT_F1, "duty_list()", [])) as unknown as {
        items: { title: string }[];
      };
      assert.equal(
        list.items.some((item) => item.title === "Belső takarítás"),
        false,
      );
      const duty = await dutyOf(FAMILY_1);
      const get = await call(PARENT_F1, "duty_get($1)", [duty.task_id]);
      assert.deepEqual([get.state, get.code], ["validation", "duty_not_found"]);
    });

    it("BR24.4 sign-up refused", async () => {
      await published();
      const duty = await dutyOf(FAMILY_1);
      const result = await call(PARENT_F2, "duty_sign_up($1, $2, $3)", [
        nextKey("sign"),
        duty.task_id,
        duty.task_version,
      ]);
      assert.deepEqual([result.state, result.code], ["conflict", "DUTY_ROTA_MANAGED"]);
    });

    // ---- BR25: protection of rota duties --------------------------------------------------------------

    it("BR25.1 every change function refused DUTY_ROTA_MANAGED", async () => {
      await published();
      const duty = await dutyOf(FAMILY_1);
      const refusedFor = async (account: string, sql: string, values: unknown[]) => {
        const result = await call(account, sql, values);
        assert.deepEqual([result.state, result.code], ["conflict", "DUTY_ROTA_MANAGED"], sql);
      };
      await refusedFor(PARENT_F2, "duty_sign_up($1, $2, $3)", [
        nextKey("a"),
        duty.task_id,
        duty.task_version,
      ]);
      await refusedFor(SUPER_ADMIN, "assignment_assign($1, $2, $3, $4)", [
        nextKey("a"),
        duty.task_id,
        FAMILY_2,
        duty.task_version,
      ]);
      await refusedFor(SUPER_ADMIN, "assignment_remove($1, $2, $3)", [
        nextKey("a"),
        duty.place_id,
        duty.place_version,
      ]);
      await refusedFor(PARENT_F1, "swap_request($1, $2, $3, $4, $5, null)", [
        nextKey("a"),
        duty.place_id,
        duty.place_version,
        ASSIGNMENT_F2_T3,
        1,
      ]);
      await refusedFor(PARENT_F2, "swap_request($1, $2, $3, $4, $5, null)", [
        nextKey("a"),
        ASSIGNMENT_F2_T3,
        1,
        duty.place_id,
        duty.place_version,
      ]);
      await refusedFor(PARENT_F1, "cancellation_request($1, $2, $3, null)", [
        nextKey("a"),
        duty.place_id,
        duty.place_version,
      ]);
      await refusedFor(SUPER_ADMIN, "task_save($1, $2::jsonb)", [
        nextKey("a"),
        JSON.stringify({ id: duty.task_id, expected_version: duty.task_version, title: "Más" }),
      ]);
      await refusedFor(SUPER_ADMIN, "family_archive($1, $2, $3)", [nextKey("a"), FAMILY_1, 1]);
      // The request functions look at the places of the request.
      const request = uuid(9500);
      await db.query(
        "insert into change_requests (id, organization_id, assignment_id, kind, requested_by_parent_id, source_task_id, source_assignment_version) values ($1, $2, $3, 'cancellation', (select id from parents where family_id = $4 and account_id = $5), $6, $7)",
        [
          request,
          ORGANIZATION,
          duty.place_id,
          FAMILY_1,
          PARENT_F1,
          duty.task_id,
          duty.place_version,
        ],
      );
      await refusedFor(PARENT_F1, "swap_withdraw($1, $2)", [nextKey("a"), request]);
      await refusedFor(PARENT_F2, "swap_respond($1, $2, true, null)", [nextKey("a"), request]);
      await refusedFor(SUPER_ADMIN, "swap_decide($1, $2, true, null)", [nextKey("a"), request]);
      await refusedFor(SUPER_ADMIN, "cancellation_decide($1, $2, true, null)", [
        nextKey("a"),
        request,
      ]);
      assert.equal(await count(db, "tasks", "title = 'Más'"), 0);
      assert.equal(
        (await db.query("select status from families where id = $1", [FAMILY_1])).rows[0].status,
        "active",
      );
    });

    it("BR25.1 other community", async () => {
      await published();
      const duty = await dutyOf(FAMILY_1);
      // A caller of another community is not told the duty is a rota duty: they get today's own refusal.
      const result = await call(OTHER_ADMIN, "assignment_remove($1, $2, $3)", [
        nextKey("a"),
        duty.place_id,
        duty.place_version,
      ]);
      assert.notEqual(result.code, "DUTY_ROTA_MANAGED");
      assert.notEqual(result.state, "success");
      const parent = await call(PARENT_F1, "assignment_remove($1, $2, $3)", [
        nextKey("a"),
        duty.place_id,
        duty.place_version,
      ]);
      assert.notEqual(parent.code, "DUTY_ROTA_MANAGED");
    });

    // ---- BR26: the shared duty model ------------------------------------------------------------------

    const create = (
      client: pg.Client,
      origin: string,
      families: (string | null)[],
      source = "rota_publish",
      kind = "rota_week",
    ) =>
      client.query(
        "select duty_create($1, $2, 'Belső takarítás', 'rota_indoor_cleaning', now() + interval '1 day', now() + interval '2 days', null, $3::uuid[], $4) as result",
        [kind, origin, families, source],
      );
    const firstWeek = async () =>
      String((await db.query("select id from rota_weeks order by week_start limit 1")).rows[0].id);

    it("BR26.1 duty and places", async () => {
      await makeDraft(db, schema);
      const week = await firstWeek();
      const made = (await create(db, week, [FAMILY_1, null])).rows[0].result as {
        duty_id: string;
        place_ids: (string | null)[];
      };
      assert.equal(made.place_ids.length, 2);
      assert.equal(made.place_ids[1], null);
      assert.equal(
        await count(db, "tasks", `${ROTA_DUTY} and capacity = 2 and origin_id = '${week}'`),
        1,
      );
      assert.equal(await count(db, "assignments", `task_id = '${made.duty_id}'`), 1);
    });

    it("BR26.1 invalid input refused", async () => {
      await makeDraft(db, schema);
      const week = await firstWeek();
      for (const bad of [
        () => create(db, week, [FAMILY_1], "rota_publish", "unknown_kind"),
        () => create(db, uuid(9700), [FAMILY_1]),
        () => create(db, week, []),
        () => create(db, week, [FAMILY_1], "invented_source"),
        () => create(db, week, [uuid(9701)]),
      ]) {
        const failure = await failureOf(bad);
        assert.ok(failure, "the call must fail");
      }
      assert.equal(await count(db, "tasks", ROTA_DUTY), 0);
    });

    it("BR26.1 other community", async () => {
      await makeDraft(db, schema);
      const week = await firstWeek();
      const failure = await failureOf(() => create(db, week, [FAMILY_OTHER]));
      assert.ok(failure);
      assert.equal(await count(db, "tasks", ROTA_DUTY), 0);
    });

    it("BR26.1 repeat returns same", async () => {
      await makeDraft(db, schema);
      const week = await firstWeek();
      const one = (await create(db, week, [FAMILY_1])).rows[0].result;
      const two = (await create(db, week, [FAMILY_2])).rows[0].result;
      assert.deepEqual(two, one);
      assert.equal(await count(db, "tasks", ROTA_DUTY), 1);
      assert.equal(await count(db, "assignments"), 3 + 1);
    });

    it("BR26.1 two creates, one duty", async () => {
      await makeDraft(db, schema);
      const week = await firstWeek();
      const [a, b] = await Promise.all([
        create(db, week, [FAMILY_1]),
        create(second, week, [FAMILY_1]),
      ]);
      assert.deepEqual(a.rows[0].result.duty_id, b.rows[0].result.duty_id);
      assert.equal(await count(db, "tasks", ROTA_DUTY), 1);
    });

    it("BR26.2 family, coordinator", async () => {
      await published();
      const duty = await dutyOf(FAMILY_1);
      const done = await call(PARENT_F1, "place_mark_done($1, $2, $3)", [
        nextKey("done"),
        duty.place_id,
        duty.place_version,
      ]);
      assert.deepEqual([done.state, done.version], ["success", duty.place_version + 1]);
      assert.equal(
        await count(
          db,
          "assignments",
          `id = '${duty.place_id}' and done_at is not null and done_by is not null`,
        ),
        1,
      );
      // A coordinator of the duty's group marks a place of that group done.
      const coordinator = await call(ADMIN_G2, "place_mark_done($1, $2, $3)", [
        nextKey("done"),
        ASSIGNMENT_F2_T3,
        1,
      ]);
      assert.equal(coordinator.state, "success", JSON.stringify(coordinator));
      assert.equal(TASK_3.length > 0, true);
    });

    it("BR26.2 second mark, other family refused", async () => {
      await published();
      const duty = await dutyOf(FAMILY_1);
      await call(PARENT_F1, "place_mark_done($1, $2, $3)", [
        nextKey("done"),
        duty.place_id,
        duty.place_version,
      ]);
      const first = await db.query("select done_at, done_by from assignments where id = $1", [
        duty.place_id,
      ]);
      const again = await call(PARENT_F1, "place_mark_done($1, $2, $3)", [
        nextKey("done"),
        duty.place_id,
        duty.place_version,
      ]);
      assert.equal(again.state, "success");
      const kept = await db.query("select done_at, done_by from assignments where id = $1", [
        duty.place_id,
      ]);
      assert.deepEqual(kept.rows[0], first.rows[0]);
      for (const account of [PARENT_F2, TEACHER_G1, SUPER_ADMIN, ADMIN_G1]) {
        const refused = await call(account, "place_mark_done($1, $2, $3)", [
          nextKey("done"),
          duty.place_id,
          duty.place_version,
        ]);
        assert.deepEqual(
          [refused.state, refused.code],
          ["denied", "authorization_denied"],
          account,
        );
      }
      const direct = await failureOf(() =>
        db.query("update assignments set done_at = now() - interval '1 day' where id = $1", [
          duty.place_id,
        ]),
      );
      assert.ok(direct, "the mark is set once");
    });

    it("BR26.2 other community", async () => {
      await published();
      const duty = await dutyOf(FAMILY_1);
      const refused = await call(OTHER_ADMIN, "place_mark_done($1, $2, $3)", [
        nextKey("done"),
        duty.place_id,
        duty.place_version,
      ]);
      assert.deepEqual([refused.state, refused.code], ["denied", "authorization_denied"]);
      assert.equal(await count(db, "assignments", "done_at is not null"), 0);
    });

    it("BR26.2 repeat", async () => {
      await published();
      const duty = await dutyOf(FAMILY_1);
      const key = nextKey("done");
      await call(PARENT_F1, "place_mark_done($1, $2, $3)", [
        key,
        duty.place_id,
        duty.place_version,
      ]);
      const again = await call(PARENT_F1, "place_mark_done($1, $2, $3)", [
        key,
        duty.place_id,
        duty.place_version,
      ]);
      assert.deepEqual([again.state, again.code], ["success", "replayed"]);
    });

    it("BR26.2 two marks", async () => {
      await published();
      const duty = await dutyOf(FAMILY_1);
      const [a, b] = await Promise.all([
        call(PARENT_F1, "place_mark_done($1, $2, $3)", [
          nextKey("done"),
          duty.place_id,
          duty.place_version,
        ]),
        callSecond(PARENT_F1, "place_mark_done($1, $2, $3)", [
          nextKey("done"),
          duty.place_id,
          duty.place_version,
        ]),
      ]);
      assert.deepEqual([a.state, b.state], ["success", "success"]);
      assert.equal(await count(db, "assignments", "done_at is not null"), 1);
    });

    const futureDuty = async () => {
      // Two manual duties with a place each, ten days away (the seed's TASK_1/TASK_2 hold other places).
      const task = (n: number) => uuid(9800 + n);
      for (const [n, family] of [
        [1, FAMILY_1],
        [2, FAMILY_2],
      ] as const) {
        await db.query(
          "insert into tasks (id, organization_id, title, capacity, starts_at, ends_at) values ($1, $2, 'Próba', 2, now() + interval '20 days', now() + interval '20 days 2 hours')",
          [task(n), ORGANIZATION],
        );
        await db.query(
          "insert into assignments (id, organization_id, task_id, family_id, source) values ($1, $2, $3, $4, 'admin_assign')",
          [uuid(9810 + n), ORGANIZATION, task(n), family],
        );
      }
      return { a: uuid(9811), b: uuid(9812), taskA: task(1), taskB: task(2) };
    };

    it("BR26.3 exchange, reassign, release", async () => {
      const d = await futureDuty();
      const exchanged = (await db.query("select place_exchange($1, 1, $2, 1) as r", [d.a, d.b]))
        .rows[0].r;
      assert.equal(exchanged.state, "success");
      const holders = (
        await db.query("select family_id from assignments where id in ($1, $2) order by id", [
          d.a,
          d.b,
        ])
      ).rows.map((r) => r.family_id);
      assert.deepEqual(holders, [FAMILY_2, FAMILY_1]);
      const reassigned = (
        await db.query("select place_reassign($1, 2, $2) as r", [d.a, FAMILY_NO_GROUP])
      ).rows[0].r;
      assert.equal(reassigned.state, "success");
      assert.equal(
        await count(db, "assignments", `id = '${d.a}' and family_id = '${FAMILY_NO_GROUP}'`),
        1,
      );
      const released = (await db.query("select place_release($1, 2) as r", [d.b])).rows[0].r;
      assert.equal(released.state, "success");
      assert.equal(await count(db, "assignments", `id = '${d.b}' and status = 'removed'`), 1);
    });

    it("BR26.3 passed duty refused", async () => {
      const d = await futureDuty();
      await db.query(
        "update tasks set starts_at = now() - interval '2 days', ends_at = now() - interval '1 day' where id = $1",
        [d.taskA],
      );
      for (const sql of [
        "place_release($1, 1)",
        "place_reassign($1, 1, '" + FAMILY_NO_GROUP + "')",
      ]) {
        const failure = await failureOf(() => db.query(`select ${sql} as r`, [d.a]));
        assert.ok(failure, sql);
        assert.match(String(failure?.message), /ended with DUTY_CLOSED/);
      }
      const stale = await failureOf(() => db.query("select place_release($1, 9) as r", [d.b]));
      assert.match(String(stale?.message), /VERSION_CONFLICT/);
      const taken = await failureOf(() =>
        db.query("select place_reassign($1, 1, $2) as r", [d.b, FAMILY_2]),
      );
      assert.match(String(taken?.message), /DUTY_ALREADY_ASSIGNED/);
    });

    it("BR26.3 internal only, no caller grant", async () => {
      const d = await futureDuty();
      for (const sql of [
        `place_exchange('${d.a}', 1, '${d.b}', 1)`,
        `place_reassign('${d.a}', 1, '${d.b}')`,
        `place_release('${d.a}', 1)`,
        `duty_create('rota_week', '${d.a}', 'x', 'x', now(), now(), null, array['${d.b}'::uuid], 'rota_publish')`,
      ]) {
        const failure = await failureOf(() =>
          asActor(db, schema, authenticated(SUPER_ADMIN), async () => db.query(`select ${sql}`)),
        );
        assert.equal(failure?.code, "42501", sql);
      }
    });

    it("BR26.3 repeat", async () => {
      const d = await futureDuty();
      await db.query("select place_release($1, 1)", [d.a]);
      const again = await failureOf(() => db.query("select place_release($1, 1)", [d.a]));
      assert.ok(again, "the second release is refused");
    });

    it("BR26.3 two changes", async () => {
      const d = await futureDuty();
      const results = await Promise.allSettled([
        db.query("select place_release($1, 1) as r", [d.a]),
        second.query("select place_reassign($1, 1, $2) as r", [d.a, FAMILY_NO_GROUP]),
      ]);
      assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    });

    // ---- BR27: convention and table access ------------------------------------------------------------

    const SIGNED_IN = [
      "break_week_add(text, uuid, text, text)",
      "break_week_remove(text, uuid, integer)",
      "place_mark_done(text, uuid, integer)",
      "rota_plan_make(text, uuid)",
      "rota_week_set(text, uuid, uuid, integer)",
      "rota_plan_discard(text, uuid, integer, integer)",
      "rota_plan_publish(text, uuid, integer)",
      "school_calendar_get(uuid)",
      "rota_plan_get(uuid)",
      "rota_overview()",
      "rota_duty_card(uuid)",
    ];
    const INTERNAL = [
      "school_year_for(date, uuid)",
      "school_weeks(uuid)",
      "changeover_date(uuid)",
      "duty_create(text, uuid, text, text, timestamptz, timestamptz, uuid, uuid[], text)",
      "place_exchange(uuid, integer, uuid, integer)",
      "place_reassign(uuid, integer, uuid)",
      "place_release(uuid, integer)",
      "duty_rota_managed(uuid[], text)",
    ];
    const privilege = async (role: string, signature: string) =>
      (
        await db.query("select has_function_privilege($1, $2::regprocedure, 'execute') as p", [
          role,
          signature,
        ])
      ).rows[0].p as boolean;

    it("BR27.1 catalogue lists grants", async () => {
      for (const signature of SIGNED_IN) {
        assert.equal(await privilege("authenticated", signature), true, signature);
        for (const role of ["anon", "service_role", "public"]) {
          assert.equal(await privilege(role, signature), false, `${role} ${signature}`);
        }
      }
      for (const signature of INTERNAL) {
        for (const role of ["authenticated", "anon", "service_role", "public"]) {
          assert.equal(await privilege(role, signature), false, `${role} ${signature}`);
        }
      }
      const definer = await db.query(
        "select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = $1 and p.proname = any ($2) and (not p.prosecdef or p.proconfig is null)",
        [
          schema,
          [
            "rota_plan_make",
            "rota_plan_publish",
            "rota_overview",
            "place_mark_done",
            "duty_create",
          ],
        ],
      );
      assert.deepEqual(definer.rows, []);
    });

    it("BR27.1 no table write right", async () => {
      for (const table of ["break_weeks", "rota_plans", "rota_weeks"]) {
        for (const privilegeName of ["insert", "update", "delete", "truncate"]) {
          const row = await db.query(
            "select has_table_privilege('authenticated', $1, $2) as p, has_table_privilege('anon', $1, $2) as q",
            [table, privilegeName],
          );
          assert.deepEqual(
            [row.rows[0].p, row.rows[0].q],
            [false, false],
            `${table} ${privilegeName}`,
          );
        }
      }
    });

    it("BR27.2 reads as allowed", async () => {
      await db.query(
        "insert into break_weeks (organization_id, school_year_id, week_start) values ($1, $2, '2026-12-21')",
        [ORGANIZATION, YEAR_1],
      );
      await makeDraft(db, schema);
      assert.equal(await countAs(db, schema, SUPER_ADMIN, "rota_plans"), 1);
      assert.ok((await countAs(db, schema, SUPER_ADMIN, "rota_weeks")) > 0);
      assert.equal(await countAs(db, schema, PARENT_F1, "break_weeks"), 1);
      assert.equal(await countAs(db, schema, PARENT_F1, "rota_plans"), 0);
    });

    it("BR27.2 direct writes refused", async () => {
      await makeDraft(db, schema);
      for (const sql of [
        "insert into rota_plans (organization_id, school_year_id) values ('" +
          ORGANIZATION +
          "', '" +
          uuid(9900) +
          "')",
        "update rota_weeks set family_id = null",
        "delete from rota_plans",
        "delete from break_weeks",
      ]) {
        const failure = await failureOf(() =>
          asActor(db, schema, authenticated(SUPER_ADMIN), async () => db.query(sql)),
        );
        assert.equal(failure?.code, "42501", sql);
      }
      assert.equal(await count(db, "rota_plans"), 1);
    });

    it("BR27.2 other community", async () => {
      await db.query(
        "insert into break_weeks (organization_id, school_year_id, week_start) values ($1, $2, '2026-12-21')",
        [ORGANIZATION, YEAR_1],
      );
      await makeDraft(db, schema);
      assert.equal(await countAs(db, schema, OTHER_ADMIN, "rota_plans"), 0);
      assert.equal(await countAs(db, schema, OTHER_ADMIN, "rota_weeks"), 0);
      assert.equal(await countAs(db, schema, OTHER_ADMIN, "break_weeks"), 0);
      assert.equal(OTHER_ORGANIZATION.length > 0, true);
    });

    // ---- Timing (NFR9.1, NFR9.2) ----------------------------------------------------------------------

    it("NFR9.1 a full-year publish on 30 families takes under 5 seconds", async () => {
      for (let n = 0; n < 25; n += 1) {
        await db.query(
          "insert into families (id, organization_id, display_name) values ($1, $2, $3)",
          [uuid(9000 + n), ORGANIZATION, `Próba család ${n}`],
        );
      }
      const started = Date.now();
      const draft = await makeDraft(db, schema);
      const made = Date.now() - started;
      const view = Date.now();
      await readPlan(db, schema);
      const read = Date.now() - view;
      const publishStarted = Date.now();
      const result = await publish(db, schema, draft);
      const publishMs = Date.now() - publishStarted;
      assert.equal(result.state, "success");
      const overviewStarted = Date.now();
      await call(PARENT_F1, "rota_overview()", []);
      const overview = Date.now() - overviewStarted;
      report(
        `TIMING rota draft ${made} ms, plan page ${read} ms, publish ${publishMs} ms, overview ${overview} ms (targets: publish 5000, pages 2000)`,
      );
      assert.ok(publishMs < 5000, `publish took ${publishMs} ms`);
      assert.ok(read < 2000 && overview < 2000 && made < 2000, `${read} ${overview} ${made}`);
    });
  });
}
