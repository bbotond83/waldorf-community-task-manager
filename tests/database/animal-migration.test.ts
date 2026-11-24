import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type pg from "pg";
import { DIRECTORY_SCHEMAS, openDirectoryDatabase } from "./directory-support.ts";

/** The shape the U8 migration leaves behind: the duty origin, the four tables, the registries and the audit list. */
for (const schema of DIRECTORY_SCHEMAS) {
  describe(`animal care migration in ${schema}`, () => {
    let db: pg.Client;
    before(async () => {
      db = await openDirectoryDatabase(schema);
    });
    after(async () => {
      await db.end();
    });

    it("accepts the animal_slot duty origin and still the three earlier ones", async () => {
      const row = await db.query(
        "select pg_get_constraintdef(oid) as def from pg_constraint where conrelid = $1::regclass and conname = 'tasks_origin_kind_check'",
        [`${schema}.tasks`],
      );
      for (const kind of ["manual", "rota_week", "weekend_slot", "animal_slot"]) {
        assert.ok(String(row.rows[0].def).includes(`'${kind}'`), kind);
      }
    });

    it("keeps every earlier audit action valid and adds two", async () => {
      const row = await db.query(
        "select pg_get_constraintdef(oid) as def from pg_constraint where conrelid = $1::regclass and conname = 'audit_events_action_check'",
        [`${schema}.audit_events`],
      );
      for (const action of [
        "role.grant",
        "rota.publish",
        "swap.reversed",
        "recurring_removal_applied",
        "checklist.removal_applied",
        "animal_calendar.saved",
        "animal_slots.created",
      ]) {
        assert.ok(String(row.rows[0].def).includes(`'${action}'`), action);
      }
    });

    it("registers the notice kinds, the target type and the two daily checks", async () => {
      const kinds = await db.query(
        "select kind, target_type from notice_kinds where added_by = 'u8-animal-care' order by kind",
      );
      assert.deepEqual(
        kinds.rows.map((r) => [r.kind, r.target_type]),
        [
          ["animal_empty_slots", "animal_signup"],
          ["animal_empty_slots_alert", "animal_signup"],
          ["animal_fair_share", "animal_signup"],
          ["animal_slot_time_changed", "animal_signup"],
        ],
      );
      const target = await db.query(
        "select facts_function from notice_targets where target_type = 'animal_signup'",
      );
      assert.equal(target.rows[0].facts_function, "animal_notice_facts");
      const checks = await db.query(
        "select function_name, lock_step from timed_check_registry where added_by = 'u8-animal-care' order by function_name",
      );
      assert.deepEqual(
        checks.rows.map((r) => [r.function_name, r.lock_step]),
        [
          ["animal_empty_slots_check", 4],
          ["animal_fair_share_check", 4],
        ],
      );
    });

    it("keeps one slot per calendar, day and part, and one calendar per school year", async () => {
      const keys = await db.query(
        "select conname, pg_get_constraintdef(oid) as def from pg_constraint where conrelid = any($1::regclass[]) and contype = 'u'",
        [
          [
            `${schema}.animal_slots`,
            `${schema}.animal_calendars`,
            `${schema}.animal_fair_share_rounds`,
            `${schema}.info_sections`,
          ],
        ],
      );
      const defs = keys.rows.map((r) => String(r.def));
      assert.ok(defs.some((d) => d.includes("calendar_id, slot_date, part")));
      assert.ok(defs.some((d) => d.includes("(school_year_id)")));
      assert.ok(defs.some((d) => d.includes("calendar_id, month")));
      assert.ok(defs.some((d) => d.includes("organization_id, key")));
    });

    it("has the replaced duty card read granted as before", async () => {
      const row = await db.query(
        "select has_function_privilege('authenticated', p.oid, 'execute') as a, has_function_privilege('anon', p.oid, 'execute') as n from pg_proc p where p.pronamespace = $1::regnamespace and p.proname = 'rota_duty_card'",
        [schema],
      );
      assert.deepEqual([row.rows[0].a, row.rows[0].n], [true, false]);
    });
  });
}
