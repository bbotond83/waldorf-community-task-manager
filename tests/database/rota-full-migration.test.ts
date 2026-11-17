import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type pg from "pg";
import { FRESH_SCHEMA_SETTINGS } from "../../scripts/db/migrate.ts";
import { applyMigrations, readMigrationFiles, TRACKING_SCHEMA } from "../../scripts/db/runner.ts";
import { ORGANIZATION, uuid } from "./directory-support.ts";
import { count } from "./identity-support.ts";
import { openDatabase, root } from "./stack-support.ts";

/**
 * The migration test over seeded data of the Ovis tábla work's U6 (NFR7.1): a private schema is built up to the file
 * before the change and filled with a published plan (its duties, places and notice) and a draft plan; the change keeps
 * every row, adds the three new rotas to both plans as weeks not drafted yet, leaves the existing duties and notices
 * as they were, and a forced failure leaves the old shape and every row. All names are invented.
 */
describe("full rotas migration over seeded data", () => {
  const schema = "u6_rota_migration";
  const CHANGE = "20261053_full_rotas_and_weekend_picks.sql";
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
  const account = uuid(72001);
  const publishedYear = uuid(72002);
  const draftYear = uuid(72003);
  const family = uuid(72004);
  const parent = uuid(72005);
  const publishedPlan = uuid(72006);
  const draftPlan = uuid(72007);
  const PUBLISHED_WEEKS = ["2026-09-07", "2026-09-14"];
  const DRAFT_WEEKS = ["2027-08-02", "2027-08-09"];

  async function seedOldWorld() {
    await db.query(`set search_path to ${schema}, pg_catalog`);
    const org = ORGANIZATION;
    await db.query("insert into organizations (id, name) values ($1, 'Régi iskola')", [org]);
    await db.query(
      "insert into school_years (id, organization_id, name, starts_on, ends_on) values ($1, $3, 'Kész év', '2026-09-01', '2027-06-30'), ($2, $3, 'Tervezett év', '2027-08-01', '2027-08-20')",
      [publishedYear, draftYear, org],
    );
    await db.query(
      "insert into families (id, organization_id, display_name) values ($1, $2, 'Régi család')",
      [family, org],
    );
    await db.query(
      "insert into accounts (id, email, organization_id) values ($1, 'regi@example.test', $2)",
      [account, org],
    );
    await db.query(
      "insert into parents (id, organization_id, family_id, display_name, account_id) values ($1, $2, $3, 'Régi szülő', $4)",
      [parent, org, family, account],
    );
    await db.query(
      "insert into rota_plans (id, organization_id, school_year_id, status, published_at, published_by) values ($1, $3, $4, 'published', now(), $6), ($2, $3, $5, 'draft', null, null)",
      [publishedPlan, draftPlan, org, publishedYear, draftYear, account],
    );
    for (const [index, week] of PUBLISHED_WEEKS.entries()) {
      const weekId = uuid(72010 + index);
      const taskId = uuid(72020 + index);
      await db.query(
        "insert into rota_weeks (id, organization_id, plan_id, job, week_start, family_id) values ($1, $2, $3, 'indoor_cleaning', $4, $5)",
        [weekId, org, publishedPlan, week, family],
      );
      await db.query(
        "insert into tasks (id, organization_id, title, category, capacity, starts_at, ends_at, origin_kind, origin_id) values ($1, $2, 'Belső takarítás', 'rota_indoor_cleaning', 1, $3::date, $3::date + 7, 'rota_week', $4)",
        [taskId, org, week, weekId],
      );
      await db.query(
        "insert into assignments (id, organization_id, task_id, family_id, source) values ($1, $2, $3, $4, 'rota_publish')",
        [uuid(72030 + index), org, taskId, family],
      );
    }
    for (const [index, week] of DRAFT_WEEKS.entries()) {
      await db.query(
        "insert into rota_weeks (id, organization_id, plan_id, job, week_start, family_id, empty_reason) values ($1, $2, $3, 'indoor_cleaning', $4, $5, $6)",
        [
          uuid(72040 + index),
          org,
          draftPlan,
          week,
          index === 0 ? family : null,
          index === 0 ? null : "no_family",
        ],
      );
    }
    await db.query(
      `insert into notifications (organization_id, parent_id, kind, target_type, target_ref, dedupe_key)
       values ($1, $2, 'rota_published', 'rota_plan', $3, 'rota_published:old')`,
      [org, parent, publishedPlan],
    );
  }

  const columns = async (table: string) =>
    (
      await db.query(
        "select column_name from information_schema.columns where table_schema = $1 and table_name = $2",
        [schema, table],
      )
    ).rowCount;

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
    assert.equal(await count(db, "rota_weeks"), 4);
    assert.equal(await count(db, "rota_plans"), 2);
    assert.equal(await count(db, "tasks"), 2);
    assert.equal(await count(db, "assignments"), 2);
    assert.equal(await count(db, "notifications"), 1);
    const added = await db.query(
      "select table_name from information_schema.tables where table_schema = $1 and table_name in ('weekend_slots', 'family_year_standings')",
      [schema],
    );
    assert.equal(added.rowCount, 0);
    // The old lists still refuse the new rotas.
    await assert.rejects(
      db.query(
        "insert into rota_weeks (organization_id, plan_id, job, week_start) values ($1, $2, 'front_garden', '2026-09-07')",
        [ORGANIZATION, publishedPlan],
      ),
    );
    await db.query(
      `delete from ${TRACKING_SCHEMA}.applied_migrations where schema_name = $1 and filename = $2`,
      [schema, CHANGE],
    );
    assert.ok(((await columns("rota_weeks")) ?? 0) > 0);
  });

  it("keeps every row and adds the new rotas as weeks not drafted yet", async () => {
    const result = await apply([...earlier, change]);
    assert.deepEqual(result.applied, [CHANGE]);
    await db.query(`set search_path to ${schema}, pg_catalog`);
    // Every plan gets three rows for each of its indoor-cleaning weeks, one for each new rota (BR62.6).
    assert.equal(await count(db, "rota_weeks"), 4 + 4 * 3);
    for (const job of ["front_garden", "water_carrying", "weekend_animal_care"]) {
      const rows = await db.query(
        "select plan_id, to_char(week_start, 'YYYY-MM-DD') as d, family_id, empty_reason from rota_weeks where job = $1 order by week_start",
        [job],
      );
      assert.equal(rows.rowCount, 4, job);
      for (const row of rows.rows) {
        assert.deepEqual(
          [row.family_id, row.empty_reason],
          [null, "not_drafted"],
          `${job} ${row.d}`,
        );
      }
      assert.deepEqual(
        rows.rows.map((r) => r.d),
        [...PUBLISHED_WEEKS, ...DRAFT_WEEKS],
      );
    }
    // The indoor-cleaning rows are as they were, hand-made or empty.
    const indoor = await db.query(
      "select to_char(week_start, 'YYYY-MM-DD') as d, family_id, empty_reason from rota_weeks where job = 'indoor_cleaning' order by week_start",
    );
    assert.deepEqual(
      indoor.rows.map((r) => [r.d, r.family_id, r.empty_reason]),
      [
        [PUBLISHED_WEEKS[0], family, null],
        [PUBLISHED_WEEKS[1], family, null],
        [DRAFT_WEEKS[0], family, null],
        [DRAFT_WEEKS[1], null, "no_family"],
      ],
    );
  });

  it("leaves the existing duties, places and notice as they were", async () => {
    await db.query(`set search_path to ${schema}, pg_catalog`);
    assert.equal(await count(db, "tasks"), 2);
    assert.equal(
      await count(db, "tasks", "origin_kind = 'rota_week' and category = 'rota_indoor_cleaning'"),
      2,
    );
    assert.equal(
      await count(db, "assignments", "source = 'rota_publish' and status = 'active'"),
      2,
    );
    assert.equal(await count(db, "notifications", "kind = 'rota_published'"), 1);
    assert.equal(await count(db, "weekend_slots"), 0);
    assert.equal(await count(db, "family_year_standings"), 0);
    // The new values are accepted now: a weekend duty origin and a pick source.
    const weekend = await db.query(
      "select id from rota_weeks where job = 'weekend_animal_care' limit 1",
    );
    const slot = uuid(72050);
    await db.query(
      "insert into weekend_slots (id, organization_id, weekend_week_id, slot) values ($1, $2, $3, 'saturday_opening')",
      [slot, ORGANIZATION, weekend.rows[0].id],
    );
    await db.query(
      "insert into tasks (organization_id, title, category, capacity, starts_at, ends_at, origin_kind, origin_id) values ($1, 'Szombat reggeli nyitás', 'rota_weekend_opening', 1, now(), now() + interval '1 hour', 'weekend_slot', $2)",
      [ORGANIZATION, slot],
    );
  });

  it("runs once", async () => {
    const result = await apply([...earlier, change]);
    assert.deepEqual(result.applied, []);
  });
});
