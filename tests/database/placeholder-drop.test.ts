import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import { IDENTITY_SCHEMAS, seedIdentityWorld } from "./identity-support.ts";
import { bindSchema, lockSchemas, openDatabase, prepareSchema, root } from "./stack-support.ts";

/** Every schema a database test file may use: the default one and the four worker schemas. */
const ALL_TEST_SCHEMAS = ["public", "worker_1", "worker_2", "worker_3", "worker_4"] as const;

const DROP_FILE = readFileSync(`${root}supabase/migrations/20261035_placeholder_drop.sql`, "utf8");
const TABLES = ["app_families", "app_assignments"];

/** Files of the production source (not tests, not migrations) that could still name a placeholder table. */
function productionFiles(directory: string, found: string[] = []): string[] {
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    if (name === "node_modules" || name === ".next") continue;
    if (statSync(path).isDirectory()) productionFiles(path, found);
    else if (/\.(ts|tsx|mjs|sql)$/.test(name) && !/\.test\.tsx?$/.test(name)) found.push(path);
  }
  return found;
}

/** The catalogue-checked drop of the placeholder tables (NFR6.14): dropped when unused, kept and named when used. */
for (const schema of IDENTITY_SCHEMAS) {
  describe(`placeholder table removal in ${schema}`, () => {
    let db: pg.Client;
    const notices: string[] = [];
    const listener = (notice: { message?: string }) => notices.push(notice.message ?? "");

    before(async () => {
      // The drop file reads the catalogue (policies and views) of every schema before it filters to its own,
      // which takes read locks on tables of other schemas. Another test file truncating its own schema at the
      // same moment could then deadlock with it (the cause of the one failed run in a full directory run), so
      // this file takes the locks of every test schema, in sorted order, and runs alone.
      db = await openDatabase();
      try {
        await lockSchemas(db, ALL_TEST_SCHEMAS);
        await prepareSchema(db, schema);
      } catch (error) {
        await db.end().catch(() => undefined);
        throw error;
      }
      db.on("notice", listener);
    });
    after(async () => {
      db.off("notice", listener);
      await db.end();
    });
    beforeEach(async () => {
      await seedIdentityWorld(db, schema);
      notices.length = 0;
    });

    const exists = async (table: string) =>
      (await db.query("select to_regclass($1) is not null as present", [table])).rows[0]
        .present as boolean;
    const recreate = async () => {
      for (const table of TABLES) {
        await db.query(
          `create table ${table} (id uuid primary key, organization_id uuid not null, scope_id uuid not null)`,
        );
      }
    };
    const cleanUp = async () => {
      await bindSchema(db, schema);
      await db.query("drop function if exists deliberate_user()");
      await db.query("drop view if exists deliberate_view");
      for (const table of TABLES) await db.query(`drop table if exists ${table} cascade`);
    };

    it("has dropped every placeholder table after the migrations", async () => {
      assert.equal(await exists("app_families"), false);
      assert.equal(await exists("app_assignments"), false);
      assert.equal(await exists("app_import_runs"), false);
    });

    it("leaves no function, policy, view or foreign key that names a placeholder table", async () => {
      for (const table of TABLES) {
        const users = await db.query(
          `select p.proname as name from pg_proc p where p.pronamespace = current_schema()::regnamespace and position($1 in p.prosrc) > 0
           union all select pol.policyname from pg_policies pol where pol.schemaname = current_schema()
             and (position($1 in coalesce(pol.qual, '')) > 0 or position($1 in coalesce(pol.with_check, '')) > 0)
           union all select v.viewname from pg_views v where v.schemaname = current_schema() and position($1 in v.definition) > 0`,
          [table],
        );
        assert.deepEqual(users.rows, [], table);
      }
    });

    it("leaves no production source file that names a placeholder table", () => {
      const offenders = productionFiles(root.replace(/\/$/, "")).filter((file) => {
        if (
          file.includes("/supabase/migrations/") ||
          file.includes("/tests/") ||
          file.includes("/aidlc/") ||
          file.includes("/.claude/")
        )
          return false;
        const text = readFileSync(file, "utf8");
        return TABLES.some((table) => text.includes(table));
      });
      assert.deepEqual(offenders, []);
    });

    it("drops the tables when nothing names them (the file run on a schema that still has them)", async () => {
      await recreate();
      try {
        await db.query(DROP_FILE);
        assert.equal(await exists("app_families"), false);
        assert.equal(await exists("app_assignments"), false);
        assert.deepEqual(
          notices.filter((notice) => notice.includes("placeholder")),
          [],
        );
      } finally {
        await cleanUp();
      }
    });

    it("keeps a table and names the user when a function still reads it, and drops the other", async () => {
      await recreate();
      await db.query(
        "create function deliberate_user() returns bigint language sql as $$ select count(*) from app_families $$",
      );
      try {
        await db.query(DROP_FILE);
        assert.equal(await exists("app_families"), true, "kept because of the deliberate user");
        assert.equal(await exists("app_assignments"), false, "the unused table is still dropped");
        const warning = notices.find((notice) => notice.includes("app_families"));
        assert.ok(warning?.includes("function deliberate_user"), warning);
      } finally {
        await cleanUp();
      }
    });

    it("keeps a table when a view or a policy of another table names it", async () => {
      await recreate();
      await db.query("create view deliberate_view as select id from app_assignments");
      try {
        await db.query(DROP_FILE);
        assert.equal(await exists("app_assignments"), true);
        assert.ok(notices.some((notice) => notice.includes("view deliberate_view")));
      } finally {
        await cleanUp();
      }
    });
  });
}
