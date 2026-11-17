import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import {
  asActor,
  DIRECTORY_SCHEMAS,
  FAMILY_1,
  FAMILY_2,
  FAMILY_NO_GROUP,
  openDirectoryDatabase,
  ORGANIZATION,
  PARENT_F1,
  SUPER_ADMIN,
  YEAR_1,
} from "./directory-support.ts";
import { FAMILY_SIX, seedRotaWorld, setChangeover } from "./rota-full-support.ts";
import { bindSchema, failureOf, openDatabase } from "./stack-support.ts";
import {
  pickCommand,
  publishedWeekend,
  slotOf,
  type WeekendWorld,
} from "./weekend-picks-support.ts";

/**
 * The three checks of the timed run (BR64): the Wednesday reminder to a family that has not picked and the notices about
 * a missing picking family (daily run, weekend_picks_reminder), the Friday-noon alert to the administrators
 * (weekend_picks_alert) and the Friday reminder before a rota week (daily run, rota_week_reminder). Each is run the way
 * the timer runs it: as the system, through timed_checks_run_system with a chosen moment.
 *
 * The fixed list: allowed (a notice for each due case); refused (a draft plan and a week with nobody sends nothing);
 * out of reach (a notice goes to the parents of the right family only and its text names no other family); outdated
 * screen (not meaningful: the checks run from the timer and read the state at the moment of the run); repeated click
 * (a second run and a run a day late send nothing twice); two at once (two runs together send each notice once).
 */
type Check = { check: string; outcome: string; created: number; skipped: number };
type Run = { state: string; checks: Check[] };
type Moments = {
  reminder_from: Date;
  wednesday: Date;
  friday_noon: Date;
  saturday: Date;
  starts_at: Date;
  ends_at: Date;
};

const SERVICE = { role: "service_role" as const };
const ADMIN_PARENT_ROW = "99999999-0000-4000-8000-0000000a6001";
const HOUR = 3_600_000;

for (const schema of DIRECTORY_SCHEMAS) {
  describe(`the rota and weekend checks in ${schema}`, () => {
    let db: pg.Client;
    let second: pg.Client;
    before(async () => {
      db = await openDirectoryDatabase(schema);
      second = await openDatabase();
      await bindSchema(second, schema);
    });
    after(async () => {
      await second.end();
      await db.end();
    });
    beforeEach(async () => {
      await seedRotaWorld(db, schema);
      // The administrator is also a parent of a family, as in the community, so the alerts have a recipient.
      await db.query(
        "insert into parents (id, organization_id, family_id, display_name, account_id) values ($1, $2, $3, 'Rendszergazda Réka', $4)",
        [ADMIN_PARENT_ROW, ORGANIZATION, FAMILY_SIX, SUPER_ADMIN],
      );
    });

    const world = () => publishedWeekend(db, schema);
    const momentsOf = async (week: string): Promise<Moments> =>
      (await db.query("select * from rota_week_times($1::date)", [week])).rows[0] as Moments;
    const run = (kind: "daily" | "friday_noon", moment: Date, client: pg.Client = db) =>
      asActor(client, schema, SERVICE, async () => {
        const result = await client.query("select timed_checks_run_system($1, $2) as result", [
          kind,
          moment,
        ]);
        return result.rows[0].result as Run;
      });
    const created = (answer: Run, name: string) => {
      const found = answer.checks.find((check) => check.check === name);
      assert.ok(found, `${name} is in the run`);
      assert.equal(found.outcome, "success", `${name} ran without failing`);
      return found.created;
    };
    const notices = async (kind: string) =>
      (
        await db.query(
          `select n.parent_id, p.family_id, n.task_id, n.dedupe_key
             from notifications n join parents p on p.id = n.parent_id
            where n.kind = $1 order by n.parent_id`,
          [kind],
        )
      ).rows as { parent_id: string; family_id: string; task_id: string; dedupe_key: string }[];
    const text = async (kind: string, parent: string, duty: string) =>
      String(
        (
          await db.query("select detail from notice_describe($1, 'task', $2, $3)", [
            kind,
            duty,
            parent,
          ])
        ).rows[0]?.detail,
      );
    const dutyOf = async (rotaWeekId: string) =>
      (
        await db.query(
          "select t.id from tasks t where t.origin_kind = 'rota_week' and t.origin_id = $1",
          [rotaWeekId],
        )
      ).rows[0]!.id as string;

    it("BR64.1 the Wednesday reminder: not before Wednesday, one notice for each parent of a family that has not picked, none after Saturday begins", async () => {
      const w: WeekendWorld = await world();
      const m = await momentsOf(w.week);
      const early = await run("daily", new Date(m.wednesday.getTime() - HOUR));
      assert.equal(created(early, "weekend_picks_reminder"), 0, "not due yet");
      assert.deepEqual(await notices("weekend_pick_reminder"), []);

      const due = await run("daily", new Date(m.wednesday.getTime() + HOUR));
      const reminders = await notices("weekend_pick_reminder");
      assert.equal(created(due, "weekend_picks_reminder"), reminders.length);
      assert.deepEqual(
        [...new Set(reminders.map((row) => row.family_id))].sort(),
        [FAMILY_1, FAMILY_2].sort(),
        "the two picking families, never the weekend family",
      );
      assert.ok(!reminders.some((row) => row.family_id === FAMILY_NO_GROUP));

      // From Saturday on no reminder is due (the alert to the administrators is a different notice).
      await run("daily", new Date(m.saturday.getTime() + HOUR));
      assert.equal((await notices("weekend_pick_reminder")).length, reminders.length);
    });

    it("BR64.1 a family that has already picked gets no reminder, the other still does", async () => {
      const w: WeekendWorld = await world();
      const slot = await slotOf(db, w, "sunday_opening");
      const picked = await pickCommand(
        db,
        schema,
        PARENT_F1,
        w.indoor.id,
        "sunday_opening",
        slot.place_version,
      );
      assert.equal(picked.state, "success", JSON.stringify(picked));
      const m = await momentsOf(w.week);
      await run("daily", new Date(m.wednesday.getTime() + HOUR));
      const families = new Set(
        (await notices("weekend_pick_reminder")).map((row) => row.family_id),
      );
      assert.deepEqual([...families], [FAMILY_2]);
    });

    it("BR64.5 a second run and a run a day late send nothing twice", async () => {
      const w: WeekendWorld = await world();
      const m = await momentsOf(w.week);
      const first = await run("daily", new Date(m.wednesday.getTime() + HOUR));
      const sent = created(first, "weekend_picks_reminder");
      assert.ok(sent > 0);
      const again = await run("daily", new Date(m.wednesday.getTime() + 2 * HOUR));
      assert.equal(created(again, "weekend_picks_reminder"), 0, "a second run sends nothing");
      const dayLate = await run("daily", new Date(m.wednesday.getTime() + 25 * HOUR));
      assert.equal(
        created(dayLate, "weekend_picks_reminder"),
        0,
        "a run a day later sends nothing again",
      );
      assert.equal((await notices("weekend_pick_reminder")).length, sent);
    });

    it("BR64.5 a run that comes late still sends what is due and was not sent", async () => {
      const w: WeekendWorld = await world();
      const m = await momentsOf(w.week);
      // The Wednesday run never happened: the Friday run is the first one and still sends the reminder.
      const friday = await run("daily", new Date(m.friday_noon.getTime() - HOUR));
      assert.ok(created(friday, "weekend_picks_reminder") > 0);
      assert.ok((await notices("weekend_pick_reminder")).length > 0);
    });

    it("BR64.2 the Friday-noon alert: not before noon, once to each administrator for a week nobody has picked in, none for a week with a pick", async () => {
      const w: WeekendWorld = await world();
      const m = await momentsOf(w.week);
      const before = await run("friday_noon", new Date(m.friday_noon.getTime() - HOUR));
      assert.equal(created(before, "weekend_picks_alert"), 0, "before noon");
      const slot = await slotOf(db, w, "sunday_opening");
      await pickCommand(db, schema, PARENT_F1, w.indoor.id, "sunday_opening", slot.place_version);
      const due = await run("friday_noon", new Date(m.friday_noon.getTime() + HOUR));
      const alerts = await notices("weekend_pick_overdue");
      assert.equal(created(due, "weekend_picks_alert"), alerts.length);
      assert.ok(alerts.length > 0, "the front garden family has not picked");
      const duties = new Set(alerts.map((row) => row.task_id));
      assert.deepEqual(
        [...duties],
        [await dutyOf(w.front.id)],
        "only the front-garden week, not the one with a pick",
      );
      const again = await run("friday_noon", new Date(m.friday_noon.getTime() + 2 * HOUR));
      assert.equal(created(again, "weekend_picks_alert"), 0, "a second run sends nothing");
      const after = await run("friday_noon", new Date(m.saturday.getTime() + HOUR));
      assert.equal(created(after, "weekend_picks_alert"), 0, "Saturday is past the alert");
    });

    it("BR64.2 and BR64.5 a daily run that comes after Friday noon sends the alert that was missed, and the Friday run then adds none", async () => {
      const w: WeekendWorld = await world();
      const m = await momentsOf(w.week);
      const lateDaily = await run("daily", new Date(m.friday_noon.getTime() + HOUR));
      const alerts = (await notices("weekend_pick_overdue")).length;
      assert.ok(alerts > 0, "the late daily run sent the alert");
      assert.ok(created(lateDaily, "weekend_picks_reminder") >= alerts);
      const friday = await run("friday_noon", new Date(m.friday_noon.getTime() + 2 * HOUR));
      assert.equal(created(friday, "weekend_picks_alert"), 0);
      assert.equal((await notices("weekend_pick_overdue")).length, alerts);
    });

    it("BR64.3 a picking family is missing: the weekend family and the administrators are told once", async () => {
      const w = await world();
      // A published plan cannot have an empty front garden, so the family leaves after publishing.
      await db.query(
        "update rota_weeks set family_id = null, empty_reason = 'cleared' where id = $1",
        [w.front.id],
      );
      const m = await momentsOf(w.week);
      const first = await run("daily", new Date(m.wednesday.getTime() + HOUR));
      assert.ok(created(first, "weekend_picks_reminder") > 0);
      const returned = await notices("weekend_slot_returned");
      assert.ok(returned.length > 0, "the weekend family is told");
      assert.ok(returned.every((row) => row.family_id === FAMILY_NO_GROUP));
      const missing = await notices("weekend_picker_missing");
      assert.ok(missing.length > 0, "the administrators are told");
      const sent = returned.length + missing.length;
      await run("daily", new Date(m.wednesday.getTime() + 25 * HOUR));
      assert.equal(
        (await notices("weekend_slot_returned")).length +
          (await notices("weekend_picker_missing")).length,
        sent,
        "a later run tells nobody again",
      );
    });

    for (const reason of ["leaving", "new", "archived"] as const) {
      it(`BR64.3 a picking family that is ${reason} on the week's Monday owes no pick: the weekend family and the administrators are told once, the family is not reminded`, async () => {
        const w = await world();
        const m = await momentsOf(w.week);
        if (reason === "archived") {
          await db.query(
            "update families set status = 'archived', archived_at = now() where id = $1",
            [w.indoor.family],
          );
        } else {
          const changeover = reason === "leaving" ? "$1::date - 1" : "$1::date + 30";
          await setChangeover(
            db,
            String((await db.query(`select (${changeover})::text as d`, [w.week])).rows[0].d),
          );
          await db.query(
            `insert into family_year_standings (organization_id, family_id, school_year_id, standing)
             values ($1, $2, $3, $4)
             on conflict (family_id, school_year_id) do update set standing = excluded.standing`,
            [ORGANIZATION, w.indoor.family, YEAR_1, reason],
          );
        }
        assert.equal(
          (await db.query("select weekend_pick_owed($1) as owed", [w.indoor.id])).rows[0].owed,
          false,
          "an ineligible family cannot pick, so none is owed",
        );
        assert.equal(
          (await db.query("select weekend_pick_owed($1) as owed", [w.front.id])).rows[0].owed,
          true,
          "the other picking family still owes one",
        );

        await run("daily", new Date(m.wednesday.getTime() + HOUR));
        const reminded = new Set((await notices("weekend_pick_reminder")).map((r) => r.family_id));
        assert.ok(!reminded.has(w.indoor.family), "the ineligible family is not reminded");
        assert.ok(reminded.has(w.front.family), "the other family is reminded");
        const returned = await notices("weekend_slot_returned");
        assert.ok(returned.length > 0, "the weekend family is told");
        assert.ok(returned.every((row) => row.family_id === FAMILY_NO_GROUP));
        assert.ok(
          (await notices("weekend_picker_missing")).length > 0,
          "the administrators are told",
        );
        assert.ok(
          (await notices("weekend_picker_missing")).every((row) =>
            row.dedupe_key.includes(":indoor_cleaning"),
          ),
          `only for the indoor-cleaning week: ${JSON.stringify(await notices("weekend_picker_missing"))}`,
        );
        const sent = returned.length + (await notices("weekend_picker_missing")).length;
        await run("daily", new Date(m.wednesday.getTime() + 25 * HOUR));
        assert.equal(
          (await notices("weekend_slot_returned")).length +
            (await notices("weekend_picker_missing")).length,
          sent,
          "a later run tells nobody again",
        );
      });
    }

    it("BR64.4 the Friday reminder before a rota week: from the Friday before, to the family of each rota duty and of the shelter cleaning, once", async () => {
      const w: WeekendWorld = await world();
      const m = await momentsOf(w.week);
      const early = await run("daily", new Date(m.reminder_from.getTime() - HOUR));
      assert.equal(created(early, "rota_week_reminder"), 0, "not due yet");
      const due = await run("daily", new Date(m.reminder_from.getTime() + HOUR));
      const reminders = await notices("rota_week_reminder");
      assert.equal(created(due, "rota_week_reminder"), reminders.length);
      const holders = new Set(reminders.map((row) => row.family_id));
      for (const family of [FAMILY_1, FAMILY_2, FAMILY_NO_GROUP]) {
        assert.ok(holders.has(family), `family ${family} holds a duty that week and is reminded`);
      }
      const again = await run("daily", new Date(m.reminder_from.getTime() + 2 * HOUR));
      assert.equal(created(again, "rota_week_reminder"), 0, "a second run sends nothing");
      const dayLate = await run("daily", new Date(m.starts_at.getTime() - HOUR));
      assert.equal(
        created(dayLate, "rota_week_reminder"),
        0,
        "a run on the Sunday sends nothing again",
      );
      const started = await run("daily", new Date(m.starts_at.getTime() + HOUR));
      assert.equal(
        created(started, "rota_week_reminder"),
        0,
        "after the week has begun nothing is due",
      );
    });

    it("BR64.4 a run a day late sends the reminder that was missed", async () => {
      const w: WeekendWorld = await world();
      const m = await momentsOf(w.week);
      const late = await run("daily", new Date(m.starts_at.getTime() - 2 * HOUR));
      assert.ok(created(late, "rota_week_reminder") > 0);
    });

    it("a draft plan and a week with nobody send nothing", async () => {
      const w: WeekendWorld = await world();
      const m = await momentsOf(w.week);
      await db.query(
        "update rota_plans set status = 'draft', published_at = null, published_by = null where status = 'published'",
      );
      const answer = await run("daily", new Date(m.wednesday.getTime() + HOUR));
      assert.equal(created(answer, "weekend_picks_reminder"), 0);
      assert.equal(created(answer, "rota_week_reminder"), 0);
      assert.equal((await notices("weekend_pick_reminder")).length, 0);
    });

    it("two runs at once send each notice once", async () => {
      const w: WeekendWorld = await world();
      const m = await momentsOf(w.week);
      const moment = new Date(m.wednesday.getTime() + HOUR);
      const outcomes = await Promise.all([
        failureOf(() => run("daily", moment, db)),
        failureOf(() => run("daily", moment, second)),
      ]);
      assert.ok(
        outcomes.some((error) => error === undefined),
        "one run finished",
      );
      const keys = (await notices("weekend_pick_reminder")).map(
        (row) => `${row.parent_id}:${row.dedupe_key}`,
      );
      assert.equal(new Set(keys).size, keys.length, "no notice twice");
      assert.ok(keys.length > 0);
    });

    it("a check that fails is recorded and the others of the run still run", async () => {
      const w: WeekendWorld = await world();
      const m = await momentsOf(w.week);
      await db.query(
        `create function test_rota_broken_check(p_now timestamptz) returns jsonb language plpgsql as $$ begin
           raise exception 'forced'; end $$`,
      );
      try {
        await db.query(
          "insert into timed_check_registry (check_name, function_name, run_kind, lock_step, added_by) values ('aaa_forced_failure', 'test_rota_broken_check', 'daily', 1, 'test')",
        );
        const answer = await run("daily", new Date(m.wednesday.getTime() + HOUR));
        assert.equal(answer.state, "success");
        assert.equal(
          answer.checks.find((check) => check.check === "aaa_forced_failure")?.outcome,
          "failed",
        );
        assert.ok(created(answer, "weekend_picks_reminder") > 0, "the reminder check still ran");
        assert.equal(created(answer, "rota_week_reminder"), 0);
      } finally {
        await db.query("delete from timed_check_registry where added_by = 'test'");
        await db.query("drop function if exists test_rota_broken_check(timestamptz)");
      }
    });

    it("the notice texts name the week and the duty, never another family, and the links lead to the duty card or the dashboard", async () => {
      const w: WeekendWorld = await world();
      const m = await momentsOf(w.week);
      await run("daily", new Date(m.wednesday.getTime() + HOUR));
      await run("daily", new Date(m.reminder_from.getTime() + HOUR));
      await run("friday_noon", new Date(m.friday_noon.getTime() + HOUR));
      const names = (await db.query("select display_name from families")).rows.map((row) =>
        String(row.display_name),
      );
      const kinds = ["weekend_pick_reminder", "weekend_pick_overdue", "rota_week_reminder"];
      let checked = 0;
      for (const kind of kinds) {
        for (const row of await notices(kind)) {
          const detail = await text(kind, row.parent_id, row.task_id);
          assert.ok(detail.length > 10, `${kind}: has a text`);
          for (const name of names) {
            assert.ok(!detail.includes(name), `${kind}: the text names no family (${name})`);
          }
          const path = String(
            (
              await db.query("select path from notice_describe($1, 'task', $2, $3)", [
                kind,
                row.task_id,
                row.parent_id,
              ])
            ).rows[0]!.path,
          );
          assert.match(
            path,
            kind === "weekend_pick_overdue" ? /^\/admin$/ : /^\/szulo\/beosztas\/[0-9a-f-]{36}$/,
          );
          checked += 1;
        }
      }
      assert.ok(checked >= 4, `texts checked: ${checked}`);
    });

    it("each check takes under 2 seconds on a published plan of the whole school year (NFR9.2)", async () => {
      const w: WeekendWorld = await world();
      const m = await momentsOf(w.week);
      const plain = await db.query("select count(*)::int as n from rota_weeks");
      assert.ok((plain.rows[0]!.n as number) > 100, "the plan holds the whole year");
      for (const [kind, moment, name] of [
        ["daily", new Date(m.wednesday.getTime() + HOUR), "weekend_picks_reminder"],
        ["daily", new Date(m.reminder_from.getTime() + HOUR), "rota_week_reminder"],
        ["friday_noon", new Date(m.friday_noon.getTime() + HOUR), "weekend_picks_alert"],
      ] as const) {
        const started = performance.now();
        const answer = await run(kind, moment);
        const elapsed = performance.now() - started;
        created(answer, name);
        assert.ok(elapsed < 2000, `${name}: ${elapsed.toFixed(0)} ms`);
      }
    });
  });
}
