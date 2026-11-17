import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import {
  ADMIN_G1,
  asActor,
  authenticated,
  DIRECTORY_SCHEMAS,
  FAMILY_1,
  FAMILY_2,
  FAMILY_NO_GROUP,
  openDirectoryDatabase,
  PARENT_F1,
  SUPER_ADMIN,
  TEACHER_G1,
} from "./directory-support.ts";
import { FAMILY_SIX, seedRotaWorld } from "./rota-full-support.ts";
import { makeDraft } from "./rota-support.ts";
import { failureOf } from "./stack-support.ts";
import {
  futureWeek,
  pickCommand,
  pickInvariantProblems,
  publishedWeekend,
  slotOf,
  type WeekendWorld,
} from "./weekend-picks-support.ts";

/**
 * The functions this unit gives to later units (C11, C12, C16): the clash check, the follow-up of picks after a duty
 * changes hands, the family of a rota week, and the removal preview and apply. They are internal, so they are called
 * here as the schema owner (the system caller); every signed-in account and every application role is refused. The
 * grant list is checked by name: exactly the commands and reads of this unit reach signed-in accounts, nothing else.
 *
 * The fixed list: allowed (owner calls); refused (every application role, a malformed list); out of reach (a draft plan
 * names no family; a family with nothing ahead has nothing to flag); outdated screen (not meaningful: internal functions
 * take no version); repeated click (a second call changes nothing more); two at once (the callers are inside their
 * own transaction, the lock order is the one of the commands, covered by weekend-picks-races).
 */
const INTERNAL_FUNCTIONS = [
  "rota_check_change(jsonb)",
  "rota_adjust_picks_after_change(jsonb)",
  "rota_family_for(text, date)",
  "rota_planning_removal_preview(text, uuid)",
  "rota_planning_removal_apply(text, uuid)",
  "weekend_picks_due_check(timestamptz)",
  "weekend_picks_alert_check(timestamptz)",
  "rota_week_reminder_check(timestamptz)",
  "weekend_pick_alert_send(timestamptz)",
  "notice_facts_task(uuid, uuid, text)",
  "family_may_hold_duty(uuid, date)",
  "family_standing(uuid, uuid)",
  "rota_flagged_duties(uuid)",
] as const;
const SIGNED_IN_FUNCTIONS = [
  "weekend_pick_set(text, uuid, text, integer)",
  "weekend_pick_assign(text, uuid, text, integer)",
  "rota_duty_card(uuid)",
  "rota_overview()",
  "weekend_unpicked_list()",
  "family_standing_set(text, uuid, uuid, text, integer)",
  "school_calendar_get(uuid)",
] as const;

for (const schema of DIRECTORY_SCHEMAS) {
  describe(`rota functions for later units in ${schema}`, () => {
    let db: pg.Client;
    before(async () => {
      db = await openDirectoryDatabase(schema);
    });
    after(async () => {
      await db.end();
    });
    beforeEach(() => seedRotaWorld(db, schema));

    const world = () => publishedWeekend(db, schema);
    const owner = async (sql: string, params: unknown[] = []) => (await db.query(sql, params)).rows;
    const placeOfRotaWeek = async (rotaWeekId: string) =>
      (
        await owner(
          "select a.id from tasks t join assignments a on a.task_id = t.id and a.status <> 'removed' where t.origin_kind = 'rota_week' and t.origin_id = $1",
          [rotaWeekId],
        )
      )[0]!.id as string;
    const check = async (changes: unknown) =>
      (await owner("select rota_check_change($1::jsonb) as r", [JSON.stringify(changes)]))[0]!
        .r as { allowed: boolean; code: string | null };

    it("C11 rota_check_change: a family that would hold indoor cleaning and front garden in one week is a clash; any other change is allowed and nothing is written", async () => {
      const w: WeekendWorld = await world();
      const indoorPlace = await placeOfRotaWeek(w.indoor.id);
      const before = JSON.stringify(
        await owner("select id, family_id from rota_weeks order by id"),
      );
      assert.deepEqual(await check([{ place_id: indoorPlace, new_family_id: FAMILY_SIX }]), {
        allowed: true,
        code: null,
      });
      // The front garden of that week belongs to FAMILY_2: handing indoor cleaning to it makes both jobs one family's.
      assert.deepEqual(await check([{ place_id: indoorPlace, new_family_id: w.front.family }]), {
        allowed: false,
        code: "ROTA_SAME_WEEK_CLASH",
      });
      // Two changes taken together: the swap of the two places is not a clash, each family keeps one job.
      const frontPlace = await placeOfRotaWeek(w.front.id);
      assert.equal(
        (
          await check([
            { place_id: indoorPlace, new_family_id: w.front.family },
            { place_id: frontPlace, new_family_id: w.indoor.family },
          ])
        ).allowed,
        true,
      );
      assert.equal(
        JSON.stringify(await owner("select id, family_id from rota_weeks order by id")),
        before,
        "a check writes nothing",
      );
    });

    it("C11 rota_check_change: an empty list is allowed, a list that is not an array is refused with request_invalid", async () => {
      assert.equal((await check([])).allowed, true);
      assert.deepEqual(await check({ place_id: "x" }), { allowed: false, code: "request_invalid" });
      assert.deepEqual(await check(null), { allowed: false, code: "request_invalid" });
    });

    it("C11 rota_adjust_picks_after_change: a pick stays with its slot when the week goes to another family, and goes back to the weekend family when the week goes to them", async () => {
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
      const indoorPlace = await placeOfRotaWeek(w.indoor.id);

      await owner("select rota_adjust_picks_after_change($1::jsonb)", [
        JSON.stringify([{ place_id: indoorPlace, new_family_id: FAMILY_SIX }]),
      ]);
      assert.equal(
        (await owner("select family_id from rota_weeks where id = $1", [w.indoor.id]))[0]!
          .family_id,
        FAMILY_SIX,
        "the rota week follows the change",
      );
      const moved = await slotOf(db, w, "sunday_opening");
      assert.equal(moved.family_id, FAMILY_SIX, "the picked slot moves with the picking family");
      assert.equal(moved.source, "weekend_pick");
      assert.deepEqual(await pickInvariantProblems(db), []);

      await owner("select rota_adjust_picks_after_change($1::jsonb)", [
        JSON.stringify([{ place_id: indoorPlace, new_family_id: w.weekend.family }]),
      ]);
      const back = await slotOf(db, w, "sunday_opening");
      assert.equal(back.family_id, w.weekend.family, "the slot returns to the weekend family");
      assert.equal(back.source, "rota_publish");
      assert.equal(
        (await owner("select count(*)::int as n from weekend_picks"))[0]!.n,
        0,
        "the pick is gone",
      );
      assert.deepEqual(await pickInvariantProblems(db), []);
    });

    it("C11 rota_adjust_picks_after_change: a repeated call with the same change changes nothing more; a list that is not an array is refused", async () => {
      const w: WeekendWorld = await world();
      const indoorPlace = await placeOfRotaWeek(w.indoor.id);
      const changes = JSON.stringify([{ place_id: indoorPlace, new_family_id: FAMILY_SIX }]);
      await owner("select rota_adjust_picks_after_change($1::jsonb)", [changes]);
      const families = async () =>
        JSON.stringify(await owner("select id, family_id from rota_weeks order by id"));
      const snapshot = await families();
      await owner("select rota_adjust_picks_after_change($1::jsonb)", [changes]);
      assert.equal(await families(), snapshot);
      const error = await failureOf(() =>
        db.query("select rota_adjust_picks_after_change('{}'::jsonb)"),
      );
      assert.equal(error?.code, "22023");
    });

    it("C12 rota_family_for: the family of a job's row in the published plan; null for a draft, an unknown week and a week with no family", async () => {
      const w: WeekendWorld = await world();
      const answer = async (job: string, week: string) =>
        (await owner("select rota_family_for($1, $2::date) as f", [job, week]))[0]!.f as
          string | null;
      assert.equal(await answer("indoor_cleaning", w.week), FAMILY_1);
      assert.equal(await answer("front_garden", w.week), FAMILY_2);
      assert.equal(await answer("weekend_animal_care", w.week), FAMILY_NO_GROUP);
      assert.equal(await answer("indoor_cleaning", "2001-01-01"), null);
      assert.equal(await answer("no_such_job", w.week), null);
    });

    it("C12 rota_family_for: a draft plan names nobody, only a published plan counts", async () => {
      const draft = await makeDraft(db, schema);
      const week = await futureWeek(db, 28);
      await db.query(
        "update rota_weeks set family_id = $1 where plan_id = $2 and job = 'indoor_cleaning' and week_start = $3",
        [FAMILY_1, draft.id, week],
      );
      const rows = await owner("select rota_family_for('indoor_cleaning', $1::date) as f", [week]);
      assert.equal(rows[0]!.f, null);
    });

    it("C16 removal preview and apply: the same count of future weeks and picks, nothing written, 0 for a parent or a family with nothing ahead", async () => {
      const w: WeekendWorld = await world();
      const slot = await slotOf(db, w, "sunday_opening");
      await pickCommand(db, schema, PARENT_F1, w.indoor.id, "sunday_opening", slot.place_version);
      const before = JSON.stringify(
        await owner("select id, family_id, version from rota_weeks order by id"),
      );
      const preview = (
        await owner("select rota_planning_removal_preview('family', $1) as r", [FAMILY_1])
      )[0]!.r as { to_clear: number; to_flag: number };
      const applied = (
        await owner("select rota_planning_removal_apply('family', $1) as r", [FAMILY_1])
      )[0]!.r as { to_clear: number; to_flag: number };
      assert.deepEqual(applied, preview);
      assert.equal(preview.to_clear, 0);
      const rows = await owner(
        "select (select count(*)::int from rota_weeks where family_id = $1 and week_start >= date_trunc('week', now())::date) + (select count(*)::int from weekend_picks pk join rota_weeks w on w.id = pk.rota_week_id where w.family_id = $1 and w.week_start >= date_trunc('week', now())::date) as n",
        [FAMILY_1],
      );
      assert.equal(preview.to_flag, rows[0]!.n);
      assert.ok(preview.to_flag >= 2, "the family's week and its pick both count");
      assert.equal(
        JSON.stringify(await owner("select id, family_id, version from rota_weeks order by id")),
        before,
      );
      const parent = (
        await owner("select rota_planning_removal_preview('parent', $1) as r", [FAMILY_1])
      )[0]!.r as { to_flag: number };
      assert.equal(parent.to_flag, 0);
      const nothing = (
        await owner(
          "select rota_planning_removal_preview('family', '99999999-0000-4000-8000-000000000001') as r",
        )
      )[0]!.r as { to_flag: number };
      assert.equal(nothing.to_flag, 0);
    });

    it("refused: no application role and no signed-in account can call any internal function of this unit (NFR3.1)", async () => {
      const roles = [
        { role: "anon" as const },
        authenticated(PARENT_F1),
        authenticated(TEACHER_G1),
        authenticated(ADMIN_G1),
        authenticated(SUPER_ADMIN),
        { role: "service_role" as const },
      ];
      const calls = [
        "select rota_check_change('[]'::jsonb)",
        "select rota_adjust_picks_after_change('[]'::jsonb)",
        "select rota_family_for('indoor_cleaning', current_date)",
        "select rota_planning_removal_preview('family', gen_random_uuid())",
        "select rota_planning_removal_apply('family', gen_random_uuid())",
        "select weekend_picks_due_check(now())",
        "select weekend_picks_alert_check(now())",
        "select rota_week_reminder_check(now())",
      ];
      for (const actor of roles) {
        for (const sql of calls) {
          const error = await failureOf(() => asActor(db, schema, actor, () => db.query(sql)));
          assert.equal(error?.code, "42501", `${actor.role}: ${sql}`);
        }
      }
    });

    it("the grant list by name: signed-in accounts reach the commands and reads of this unit and nothing internal; anon reaches none", async () => {
      const has = async (role: string, signature: string) =>
        (
          await owner("select has_function_privilege($1, $2::regprocedure, 'execute') as ok", [
            role,
            `"${schema}".${signature}`,
          ])
        )[0]!.ok as boolean;
      for (const signature of INTERNAL_FUNCTIONS) {
        for (const role of ["anon", "authenticated", "service_role"]) {
          assert.equal(await has(role, signature), false, `${role} must not reach ${signature}`);
        }
      }
      for (const signature of SIGNED_IN_FUNCTIONS) {
        assert.equal(
          await has("authenticated", signature),
          true,
          `authenticated reaches ${signature}`,
        );
        assert.equal(await has("anon", signature), false, `anon must not reach ${signature}`);
        assert.equal(
          await has("service_role", signature),
          false,
          `service_role must not reach ${signature}`,
        );
      }
    });
  });
}
