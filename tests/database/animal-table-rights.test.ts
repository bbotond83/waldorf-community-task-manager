import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import {
  authenticated,
  DIRECTORY_SCHEMAS,
  openDirectoryDatabase,
  OUTSIDER,
  asActor,
} from "./directory-support.ts";
import { failureOf } from "./stack-support.ts";
import { ADMIN_G1, PARENT_F1, seedAnimalWorld, SUPER_ADMIN, TEACHER_G1 } from "./animal-support.ts";

/**
 * The four new tables are read only through functions (NFR3.8): row security on, no policy and no right for any
 * signed-in role, so a direct select, insert, update or delete fails with a permission error whoever asks.
 */
const TABLES = ["animal_calendars", "animal_slots", "animal_fair_share_rounds", "info_sections"];

for (const schema of DIRECTORY_SCHEMAS) {
  describe(`animal and information table rights in ${schema}`, () => {
    let db: pg.Client;
    before(async () => {
      db = await openDirectoryDatabase(schema);
    });
    after(async () => {
      await db.end();
    });
    beforeEach(() => seedAnimalWorld(db, schema));

    it("has row security on and no right for any application role", async () => {
      const rls = await db.query(
        "select relname, relrowsecurity from pg_class where relnamespace = $1::regnamespace and relname = any($2)",
        [schema, TABLES],
      );
      assert.equal(rls.rows.length, TABLES.length);
      assert.ok(rls.rows.every((row) => row.relrowsecurity));
      for (const role of ["authenticated", "anon", "service_role"]) {
        for (const table of TABLES) {
          const rights = await db.query(
            "select has_table_privilege($1, $2::regclass, 'select,insert,update,delete') as any_right",
            [role, `${schema}.${table}`],
          );
          assert.equal(rights.rows[0].any_right, false, `${role} on ${table}`);
        }
      }
      const policies = await db.query(
        "select count(*)::int as n from pg_policies where schemaname = $1 and tablename = any($2)",
        [schema, TABLES],
      );
      assert.equal(policies.rows[0].n, 0);
    });

    it("refuses a direct read as every signed-in role (refused, out of reach)", async () => {
      for (const account of [SUPER_ADMIN, ADMIN_G1, PARENT_F1, TEACHER_G1, OUTSIDER]) {
        for (const table of TABLES) {
          const failure = await failureOf(() =>
            asActor(db, schema, authenticated(account), () => db.query(`select * from ${table}`)),
          );
          assert.equal(failure?.code, "42501", `${account} on ${table}`);
        }
      }
    });

    it("keeps the internal functions away from signed-in roles (refused)", async () => {
      const internal = [
        "animal_fair_share_check",
        "animal_empty_slots_check",
        "animal_notice_facts",
        "info_links_for_duty",
        "info_section_owner_group",
        "animal_fair_share_figures",
        "info_starting_sections_install",
      ];
      for (const fn of internal) {
        const row = await db.query(
          "select has_function_privilege('authenticated', p.oid, 'execute') as a, has_function_privilege('anon', p.oid, 'execute') as n from pg_proc p where p.pronamespace = $1::regnamespace and p.proname = $2",
          [schema, fn],
        );
        assert.equal(row.rows.length, 1, fn);
        assert.deepEqual([row.rows[0].a, row.rows[0].n], [false, false], fn);
      }
      const install = await db.query(
        "select has_function_privilege('service_role', p.oid, 'execute') as s from pg_proc p where p.pronamespace = $1::regnamespace and p.proname = 'info_starting_sections_install'",
        [schema],
      );
      assert.equal(install.rows[0].s, true);
      for (const fn of [
        "animal_slots_list",
        "slot_give_up",
        "info_sections_list",
        "animal_calendar_save",
      ]) {
        const row = await db.query(
          "select has_function_privilege('authenticated', p.oid, 'execute') as a, has_function_privilege('anon', p.oid, 'execute') as n from pg_proc p where p.pronamespace = $1::regnamespace and p.proname = $2",
          [schema, fn],
        );
        assert.deepEqual([row.rows[0].a, row.rows[0].n], [true, false], fn);
      }
    });
  });
}
