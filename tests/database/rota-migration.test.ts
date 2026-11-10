import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type pg from "pg";
import { FRESH_SCHEMA_SETTINGS } from "../../scripts/db/migrate.ts";
import { applyMigrations, readMigrationFiles, TRACKING_SCHEMA } from "../../scripts/db/runner.ts";
import { ORGANIZATION, uuid } from "./directory-support.ts";
import { count } from "./identity-support.ts";
import { openDatabase, root } from "./stack-support.ts";

/**
 * The migration test over seeded data of the Ovis tábla work's U2 (NFR7.1): a private schema is built up to the file
 * before the change and filled with one row for every table the change touches; the change then keeps every row,
 * gives each the new columns' defaults, and a forced failure leaves the old shape and every row as they were.
 */
describe("rota slice migration over seeded data", () => {
  const schema = "u2_rota_migration";
  const CHANGE = "20261048_first_rota_slice.sql";
  const all = readMigrationFiles(`${root}supabase/migrations`);
  const change = all.find((file) => file.name === CHANGE)!;
  const earlier = all.filter((file) => file.name < CHANGE);
  let db: pg.Client;

  const apply = (files: typeof all) =>
    applyMigrations({
      client: db as never,
      schema,
      files,
      log: () => {},
      now: () => Date.now(),
      freshSchemaSettings: FRESH_SCHEMA_SETTINGS,
    });
  const dropSchema = async () => {
    await db.query("reset search_path");
    await db.query(`drop schema if exists ${schema} cascade`);
    await db.query(`delete from ${TRACKING_SCHEMA}.applied_migrations where schema_name = $1`, [
      schema,
    ]);
  };
  const owner = uuid(71001);
  const year = uuid(71002);
  const family = uuid(71003);
  const parent = uuid(71004);
  const task = uuid(71005);

  async function seedOldWorld() {
    await db.query(`set search_path to ${schema}, pg_catalog`);
    const org = ORGANIZATION;
    await db.query("insert into organizations (id, name) values ($1, 'Régi iskola')", [org]);
    await db.query(
      "insert into school_years (id, organization_id, name, starts_on, ends_on) values ($1, $2, 'Régi év', '2026-09-01', '2027-06-30'), ($3, $2, 'Késői év', '2027-08-01', '2027-08-20')",
      [year, org, uuid(71006)],
    );
    await db.query(
      "insert into families (id, organization_id, display_name) values ($1, $2, 'Régi család')",
      [family, org],
    );
    await db.query(
      "insert into accounts (id, email, organization_id) values ($1, 'regi@example.test', $2)",
      [owner, org],
    );
    await db.query(
      "insert into parents (id, organization_id, family_id, display_name, account_id) values ($1, $2, $3, 'Régi szülő', $4)",
      [parent, org, family, owner],
    );
    await db.query(
      "insert into tasks (id, organization_id, title, capacity, starts_at, ends_at) values ($1, $2, 'Régi feladat', 3, now() + interval '5 days', now() + interval '6 days')",
      [task, org],
    );
    for (const [n, source] of [
      [1, "parent_sign_up"],
      [2, "admin_assign"],
      [3, "swap"],
    ] as const) {
      const other = uuid(71010 + n);
      await db.query(
        "insert into families (id, organization_id, display_name) values ($1, $2, $3)",
        [other, org, `Másik család ${n}`],
      );
      await db.query(
        "insert into assignments (id, organization_id, task_id, family_id, source) values ($1, $2, $3, $4, $5)",
        [uuid(71020 + n), org, task, other, source],
      );
    }
    await db.query(
      `insert into notifications (organization_id, parent_id, kind, target_type, target_ref, task_id, task_starts_at, dedupe_key)
       values ($1, $2, 'sign_up_confirmed', 'task', $3, $3, now(), 'k1'), ($1, $2, 'place_removed', 'task', $3, $3, now(), 'k2')`,
      [org, parent, task],
    );
    await db.query(
      `insert into audit_events (id, actor_account_id, actor_role, action, target_type, target_id, organization_id, outcome)
       values (gen_random_uuid(), $1, 'system', 'role.grant', 'grant', $2, $3, 'success')`,
      [owner, uuid(71030), org],
    );
  }

  const TOUCHED = ["school_years", "tasks", "assignments", "notifications", "audit_events"];

  before(async () => {
    db = await openDatabase();
    await dropSchema();
    await db.query(`create schema ${schema}`);
  });
  after(async () => {
    await dropSchema();
    await db.end();
  });

  it("a forced failure leaves the old shape and every seeded row", async () => {
    await apply(earlier);
    await seedOldWorld();
    await assert.rejects(
      apply([{ ...change, sql: change.sql.replace(/commit;\s*$/, "select 1 / 0;\ncommit;\n") }]),
    );
    await db.query("rollback").catch(() => undefined);
    await db.query(`set search_path to ${schema}, pg_catalog`);
    const expected = {
      school_years: 2,
      tasks: 1,
      assignments: 3,
      notifications: 2,
      audit_events: 1,
    };
    for (const table of TOUCHED) {
      assert.equal(await count(db, table), expected[table as keyof typeof expected], table);
    }
    const added = await db.query(
      "select table_name from information_schema.tables where table_schema = $1 and table_name in ('break_weeks', 'rota_plans', 'rota_weeks')",
      [schema],
    );
    assert.equal(added.rowCount, 0);
    const column = await db.query(
      "select 1 from information_schema.columns where table_schema = $1 and table_name = 'school_years' and column_name = 'changeover_date'",
      [schema],
    );
    assert.equal(column.rowCount, 0);
    await db.query(
      `delete from ${TRACKING_SCHEMA}.applied_migrations where schema_name = $1 and filename = $2`,
      [schema, CHANGE],
    );
  });

  it("keeps every row and gives each its new columns", async () => {
    const result = await apply([...earlier, change]);
    assert.deepEqual(result.applied, [CHANGE]);
    await db.query(`set search_path to ${schema}, pg_catalog`);
    // school_years: every year gets the changeover date, 1 July of the calendar year it ends, never before it starts.
    const years = await db.query(
      "select name, to_char(changeover_date, 'YYYY-MM-DD') as d from school_years order by starts_on",
    );
    assert.deepEqual(years.rows, [
      { name: "Régi év", d: "2027-07-01" },
      { name: "Késői év", d: "2027-08-01" },
    ]);
    // tasks: every existing duty is a manual one with no origin.
    const tasks = await db.query("select origin_kind, origin_id from tasks");
    assert.deepEqual(tasks.rows, [{ origin_kind: "manual", origin_id: null }]);
    // assignments: every source stays valid and no place is marked done.
    assert.equal(await count(db, "assignments"), 3);
    assert.equal(await count(db, "assignments", "done_at is null and done_by is null"), 3);
    assert.deepEqual(
      (await db.query("select source from assignments order by source")).rows.map((r) => r.source),
      ["admin_assign", "parent_sign_up", "swap"],
    );
    // notifications: the old kinds and their task link stay; the new kind is accepted only without a task.
    assert.equal(await count(db, "notifications", "task_id is not null"), 2);
    await db.query(
      `insert into notifications (organization_id, parent_id, kind, target_type, target_ref, dedupe_key)
       values ($1, $2, 'rota_published', 'rota_plan', $3, 'rota_published:x:y')`,
      [ORGANIZATION, parent, uuid(71040)],
    );
    await assert.rejects(
      db.query(
        `insert into notifications (organization_id, parent_id, kind, target_type, target_ref, task_id, task_starts_at, dedupe_key)
         values ($1, $2, 'rota_published', 'rota_plan', $3, $4, now(), 'bad')`,
        [ORGANIZATION, parent, uuid(71040), task],
      ),
    );
    await assert.rejects(
      db.query(
        `insert into notifications (organization_id, parent_id, kind, target_type, target_ref, dedupe_key)
         values ($1, $2, 'sign_up_confirmed', 'task', $3, 'bad2')`,
        [ORGANIZATION, parent, task],
      ),
    );
    // audit_events: the old action stays; the two new actions are accepted.
    assert.equal(await count(db, "audit_events", "action = 'role.grant'"), 1);
    for (const action of ["rota.publish", "rota.discard"]) {
      await db.query(
        `insert into audit_events (id, actor_account_id, actor_role, action, target_type, target_id, organization_id, outcome)
         values (gen_random_uuid(), $1, 'system', $2, 'rota_plan', $3, $4, 'success')`,
        [owner, action, uuid(71041), ORGANIZATION],
      );
    }
    // The new tables are empty: nothing is planned until the owner makes a draft.
    for (const table of ["break_weeks", "rota_plans", "rota_weeks"]) {
      assert.equal(await count(db, table), 0, table);
    }
  });

  it("runs once", async () => {
    const result = await apply([...earlier, change]);
    assert.deepEqual(result.applied, []);
  });
});
