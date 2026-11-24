import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type pg from "pg";
import { DIRECTORY_SCHEMAS, openDirectoryDatabase } from "./directory-support.ts";

/** The shape the U11 migration leaves behind: seven tables with row security and no direct rights, and the grants. */
const TABLES = [
  "checklist_templates",
  "checklist_template_sections",
  "checklist_template_tasks",
  "event_checklists",
  "event_checklist_sections",
  "event_checklist_tasks",
  "checklist_claims",
];
for (const schema of DIRECTORY_SCHEMAS) {
  describe(`checklist migration in ${schema}`, () => {
    let db: pg.Client;
    before(async () => {
      db = await openDirectoryDatabase(schema);
    });
    after(async () => {
      await db.end();
    });
    it("every table has row security on and no direct rights for the app roles", async () => {
      const rls = await db.query(
        "select relname, relrowsecurity from pg_class where relnamespace = $1::regnamespace and relname = any($2)",
        [schema, TABLES],
      );
      assert.equal(rls.rows.length, TABLES.length);
      assert.ok(rls.rows.every((r) => r.relrowsecurity));
      for (const role of ["authenticated", "anon"]) {
        for (const table of TABLES) {
          const rights = await db.query(
            "select has_table_privilege($1, $2::regclass, 'insert,update,delete') as w",
            [role, `${schema}.${table}`],
          );
          assert.equal(rights.rows[0].w, false, `${role} ${table}`);
        }
      }
    });
    it("only the intended functions are executable by signed-in users; the install is for the service role only", async () => {
      const run = async (role: string, fn: string) =>
        (
          await db.query(
            "select has_function_privilege($1, p.oid, 'execute') as e from pg_proc p where p.pronamespace = $2::regnamespace and p.proname = $3 limit 1",
            [role, schema, fn],
          )
        ).rows[0].e as boolean;
      for (const fn of ["checklist_claim", "checklist_get", "template_save"])
        assert.equal(await run("authenticated", fn), true, fn);
      for (const fn of [
        "checklist_add_task",
        "checklist_claimant_ids",
        "event_lead_notice_check",
        "checklists_removal_apply",
        "checklist_starting_templates_install",
      ]) {
        assert.equal(await run("authenticated", fn), false, fn);
      }
      assert.equal(await run("service_role", "checklist_starting_templates_install"), true);
    });
    it("the new notice kinds and audit actions exist", async () => {
      const kinds = await db.query(
        "select kind from notice_kinds where kind in ('event_lead_time','checklist_unclaimed')",
      );
      assert.equal(kinds.rows.length, 2);
      const def = (
        await db.query(
          "select pg_get_constraintdef(oid) as d from pg_constraint where conname = 'audit_events_action_check' and conrelid = $1::regclass",
          [`${schema}.audit_events`],
        )
      ).rows[0].d as string;
      for (const action of [
        "checklist.template_removed",
        "checklist.template_restored",
        "checklist.claim_removed",
        "checklist.done_undone",
        "checklist.removal_applied",
      ]) {
        assert.ok(def.includes(action), action);
      }
    });
  });
}
