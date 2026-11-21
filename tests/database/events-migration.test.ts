import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type pg from "pg";
import { FRESH_SCHEMA_SETTINGS } from "../../scripts/db/migrate.ts";
import { applyMigrations, readMigrationFiles, TRACKING_SCHEMA } from "../../scripts/db/runner.ts";
import { ORGANIZATION, uuid } from "./directory-support.ts";
import { count } from "./identity-support.ts";
import { openDatabase, root } from "./stack-support.ts";

/**
 * The migration test over seeded data of the Ovis tábla work's U10 (NFR7.5): a private schema is built up to the file
 * before the change and filled with events (with the old notes and the typed coordinator name), a duty on one of them
 * and a place on the duty; the change keeps every event, duty and place, drops the four old columns without
 * conversion, adds the five new fields with their defaults, creates the four new tables empty, and a forced failure
 * leaves the old shape and every row. All names are invented.
 */
describe("events and sign-ups migration over seeded data", () => {
  const schema = "u10_events_migration";
  const CHANGE = "20261056_events_and_signups.sql";
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
  const year = uuid(80001);
  const group = uuid(80002);
  const eventOne = uuid(80003);
  const eventTwo = uuid(80004);
  const task = uuid(80005);
  const family = uuid(80006);
  const assignment = uuid(80007);

  async function seedOldWorld() {
    await db.query(`set search_path to ${schema}, pg_catalog`);
    await db.query("insert into organizations (id, name) values ($1, 'Régi iskola')", [
      ORGANIZATION,
    ]);
    await db.query(
      "insert into school_years (id, organization_id, name, starts_on, ends_on) values ($1, $2, 'Év', '2026-09-01', '2027-06-30')",
      [year, ORGANIZATION],
    );
    await db.query(
      "insert into groups (id, organization_id, school_year_id, name, description, status) values ($1, $2, $3, 'Régi csoport', 'Leírás', 'active')",
      [group, ORGANIZATION, year],
    );
    await db.query(
      `insert into events (id, organization_id, group_id, title, location, coordinator_name, starts_at, ends_at, allergen_note, supply_note, food_note)
       values ($1, $3, $4, 'Régi ünnep', 'Terem', 'Régi Név', '2027-01-10T10:00:00Z', '2027-01-10T12:00:00Z', 'tej', 'terítő', 'pite'),
              ($2, $3, $4, 'Másik ünnep', null, null, '2027-02-10T10:00:00Z', '2027-02-10T12:00:00Z', null, null, null)`,
      [eventOne, eventTwo, ORGANIZATION, group],
    );
    await db.query(
      "insert into tasks (id, organization_id, group_id, event_id, title, capacity, starts_at, ends_at) values ($1, $2, $3, $4, 'Sütés', 2, '2027-01-10T10:00:00Z', '2027-01-10T12:00:00Z')",
      [task, ORGANIZATION, group, eventOne],
    );
    await db.query(
      "insert into families (id, organization_id, display_name) values ($1, $2, 'Régi család')",
      [family, ORGANIZATION],
    );
    await db.query(
      "insert into assignments (id, organization_id, task_id, family_id, source) values ($1, $2, $3, $4, 'admin_assign')",
      [assignment, ORGANIZATION, task, family],
    );
  }

  const eventColumns = async () =>
    (
      await db.query(
        "select column_name from information_schema.columns where table_schema = $1 and table_name = 'events'",
        [schema],
      )
    ).rows.map((row) => row.column_name as string);

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
    assert.equal(await count(db, "events"), 2);
    assert.equal(await count(db, "tasks"), 1);
    assert.equal(await count(db, "assignments"), 1);
    const columns = await eventColumns();
    assert.ok(columns.includes("allergen_note") && columns.includes("coordinator_name"));
    assert.equal(columns.includes("tale"), false);
    const tables = await db.query(
      "select table_name from information_schema.tables where table_schema = $1 and table_name in ('event_notices', 'event_roles', 'event_signups', 'food_offers')",
      [schema],
    );
    assert.equal(tables.rowCount, 0);
    await db.query(
      `delete from ${TRACKING_SCHEMA}.applied_migrations where schema_name = $1 and filename = $2`,
      [schema, CHANGE],
    );
  });

  it("keeps every event, duty and place, drops the four old columns and adds the new fields with their defaults", async () => {
    const result = await apply([...earlier, change]);
    assert.deepEqual(result.applied, [CHANGE]);
    await db.query(`set search_path to ${schema}, pg_catalog`);
    assert.equal(await count(db, "events"), 2);
    assert.equal(await count(db, "tasks"), 1);
    assert.equal(await count(db, "assignments"), 1);
    const columns = await eventColumns();
    for (const gone of ["allergen_note", "supply_note", "food_note", "coordinator_name"]) {
      assert.equal(columns.includes(gone), false, gone);
    }
    for (const added of [
      "is_summer",
      "signup_deadline",
      "notice_lead_days",
      "food_signup_on",
      "tale",
    ]) {
      assert.ok(columns.includes(added), added);
    }
    const row = (
      await db.query(
        "select title, location, is_summer, food_signup_on, signup_deadline, notice_lead_days, tale from events where id = $1",
        [eventOne],
      )
    ).rows[0];
    assert.deepEqual(row, {
      title: "Régi ünnep",
      location: "Terem",
      is_summer: false,
      food_signup_on: false,
      signup_deadline: null,
      notice_lead_days: null,
      tale: null,
    });
    for (const table of ["event_notices", "event_roles", "event_signups", "food_offers"]) {
      assert.equal(await count(db, table), 0, table);
    }
  });

  it("registers the event target and its three kinds, and keeps the earlier kinds", async () => {
    await db.query(`set search_path to ${schema}, pg_catalog`);
    const kinds = (await db.query("select kind from notice_kinds order by kind")).rows.map(
      (row) => row.kind,
    );
    for (const kind of ["event_new", "event_cancelled", "event_changed", "coordinator_appointed"]) {
      assert.ok(kinds.includes(kind), kind);
    }
    assert.equal(await count(db, "notice_targets", "target_type = 'event'"), 1);
  });

  it("is applied once: a second run applies nothing", async () => {
    const again = await apply([...earlier, change]);
    assert.deepEqual(again.applied, []);
  });
});
