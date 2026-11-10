import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import { FRESH_SCHEMA_SETTINGS } from "../../scripts/db/migrate.ts";
import { applyMigrations, readMigrationFiles, TRACKING_SCHEMA } from "../../scripts/db/runner.ts";
import { buildSeedPlan } from "../../scripts/db/seed/data.ts";
import { writeSeedPlan } from "../../scripts/db/seed/write.ts";
import { resetWorkerData } from "../../scripts/db/worker.ts";
import {
  ADMIN_G1,
  ADMIN_G2,
  callFunction,
  DIRECTORY_SCHEMAS,
  EVENT_1,
  EVENT_OTHER,
  GROUP_1,
  GROUP_2,
  GROUP_OTHER,
  nextKey,
  openDirectoryDatabase,
  ORGANIZATION,
  OTHER_ADMIN,
  OTHER_ORGANIZATION,
  OUTSIDER,
  PARENT_F1,
  seedCoordinationWorld,
  SUPER_ADMIN,
  TASK_2,
  TEACHER_G1,
  uuid,
  YEAR_1,
  YEAR_OTHER,
} from "./directory-support.ts";
import { count } from "./identity-support.ts";
import { openDatabase, root } from "./stack-support.ts";

/** The fixed-list tests of BR1.2, BR1.3, BR1.4, BR2.1 to BR2.5 and BR7.1, by the names of the Unit's test plan. */
const when = { starts_at: "2027-03-01T10:00:00Z", ends_at: "2027-03-01T12:00:00Z" };
const eventBody = (group: string | null, extra: object = {}) =>
  JSON.stringify({ group_id: group, title: "Tavaszi nap", ...when, ...extra });
const taskBody = (group: string | null, extra: object = {}) =>
  JSON.stringify({ group_id: group, title: "Pakolás", capacity: 2, ...when, ...extra });
const groupBody = (extra: object) =>
  JSON.stringify({
    school_year_id: YEAR_1,
    name: "Kertész",
    description: "Rendben tartja.",
    ...extra,
  });

for (const schema of DIRECTORY_SCHEMAS) {
  describe(`community structure in ${schema}`, () => {
    let db: pg.Client;
    let second: pg.Client;
    before(async () => {
      db = await openDirectoryDatabase(schema);
      second = await openDatabase();
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
    const saveEvent = (account: string, body: string, key = nextKey("event")) =>
      call(account, "event_save($1, $2::jsonb)", [key, body]);
    const saveTask = (account: string, body: string, key = nextKey("task")) =>
      call(account, "task_save($1, $2::jsonb)", [key, body]);
    const saveGroup = (account: string, body: string, key = nextKey("group")) =>
      call(account, "structure_save($1, 'group', $2::jsonb)", [key, body]);

    it("BR1.2 allowed", async () => {
      const event = await saveEvent(ADMIN_G1, eventBody(GROUP_1));
      assert.equal(event.state, "success");
      assert.equal(
        await count(db, "events", `id = '${event.reference}' and group_id = '${GROUP_1}'`),
        1,
      );
      const task = await saveTask(ADMIN_G1, taskBody(GROUP_1));
      assert.equal(task.state, "success");
    });
    it("BR1.2 refused archived", async () => {
      await db.query("update groups set status = 'archived' where id = $1", [GROUP_1]);
      const before = await count(db, "events");
      const result = await saveEvent(SUPER_ADMIN, eventBody(GROUP_1));
      assert.deepEqual(
        [result.state, result.field, result.reason],
        ["validation", "group_id", "archived"],
      );
      assert.equal(await count(db, "events"), before);
    });
    it("BR1.2 other community", async () => {
      const bySuper = await saveTask(SUPER_ADMIN, taskBody(GROUP_OTHER));
      assert.deepEqual([bySuper.state, bySuper.field], ["validation", "group_id"]);
      const byGroupAdmin = await saveTask(ADMIN_G1, taskBody(GROUP_OTHER));
      assert.equal(byGroupAdmin.state, "denied");
    });
    it("BR1.2 stale version", async () => {
      const result = await saveEvent(
        ADMIN_G1,
        eventBody(GROUP_1, { id: EVENT_1, expected_version: 99 }),
      );
      assert.deepEqual([result.state, result.code], ["conflict", "VERSION_CONFLICT"]);
    });
    it("BR1.2 repeat", async () => {
      const key = nextKey("repeat");
      const first = await saveEvent(ADMIN_G1, eventBody(GROUP_1), key);
      const again = await saveEvent(ADMIN_G1, eventBody(GROUP_1), key);
      assert.equal(again.reference, first.reference);
      assert.equal(again.code, "replayed");
      assert.equal(await count(db, "events", "title = 'Tavaszi nap'"), 1);
    });

    it("BR1.3 allowed", async () => {
      assert.equal(
        (await saveTask(ADMIN_G1, taskBody(GROUP_1, { event_id: EVENT_1 }))).state,
        "success",
      );
      const community = await saveEvent(SUPER_ADMIN, eventBody(null));
      const task = await saveTask(SUPER_ADMIN, taskBody(null, { event_id: community.reference }));
      assert.equal(task.state, "success");
      assert.equal(await count(db, "tasks", `id = '${task.reference}' and group_id is null`), 1);
    });
    it("BR1.3 refused mismatch, direct write", async () => {
      const result = await saveTask(SUPER_ADMIN, taskBody(GROUP_2, { event_id: EVENT_1 }));
      assert.deepEqual(
        [result.state, result.field, result.reason],
        ["validation", "event_id", "group_mismatch"],
      );
      const empty = await saveTask(SUPER_ADMIN, taskBody(null, { event_id: EVENT_1 }));
      assert.deepEqual([empty.field, empty.reason], ["event_id", "group_mismatch"]);
      await assert.rejects(
        db.query(
          `insert into tasks (organization_id, group_id, event_id, title, capacity, starts_at, ends_at)
           values ($1, null, $2, 'Közvetlen', 1, now(), now())`,
          [ORGANIZATION, EVENT_1],
        ),
        { code: "23514" },
      );
      await assert.rejects(
        db.query("update events set group_id = null where id = $1", [EVENT_1]),
        (error: Error & { code?: string }) => ["23514", "23503"].includes(error.code ?? ""),
      );
    });
    it("BR1.3 other group's event", async () => {
      const result = await saveTask(ADMIN_G2, taskBody(GROUP_2, { event_id: EVENT_1 }));
      assert.equal(result.state, "denied");
      const missing = await saveTask(ADMIN_G2, taskBody(GROUP_2, { event_id: uuid(99123) }));
      assert.deepEqual(missing, result);
    });
    it("BR1.3 stale version", async () => {
      const result = await saveTask(
        ADMIN_G1,
        taskBody(GROUP_1, { id: TASK_2, expected_version: 99 }),
      );
      assert.equal(result.code, "VERSION_CONFLICT");
    });
    it("BR1.3 repeat", async () => {
      const key = nextKey("repeat");
      const body = taskBody(GROUP_1, { event_id: EVENT_1 });
      const first = await saveTask(ADMIN_G1, body, key);
      const again = await saveTask(ADMIN_G1, body, key);
      assert.deepEqual([again.reference, again.code], [first.reference, "replayed"]);
    });

    it("BR2.2 allowed", async () => {
      const result = await saveGroup(SUPER_ADMIN, groupBody({}));
      assert.equal(result.state, "success");
      assert.equal(
        await count(db, "groups", `id = '${result.reference}' and description = 'Rendben tartja.'`),
        1,
      );
    });
    it("BR2.2 refused empty, duplicate", async () => {
      const empty = await saveGroup(SUPER_ADMIN, groupBody({ description: "  " }));
      assert.deepEqual([empty.state, empty.field], ["validation", "description"]);
      const long = await saveGroup(SUPER_ADMIN, groupBody({ description: "x".repeat(1001) }));
      assert.equal(long.field, "description");
      const duplicate = await saveGroup(SUPER_ADMIN, groupBody({ name: "BORÓKA" }));
      assert.deepEqual([duplicate.field, duplicate.reason], ["name", "taken"]);
    });
    it("BR2.2 stale version", async () => {
      const result = await saveGroup(
        SUPER_ADMIN,
        groupBody({ id: GROUP_1, name: "Boróka", expected_version: 99 }),
      );
      assert.equal(result.code, "VERSION_CONFLICT");
    });
    it("BR2.2 repeat", async () => {
      const key = nextKey("repeat");
      const first = await saveGroup(SUPER_ADMIN, groupBody({}), key);
      const again = await saveGroup(SUPER_ADMIN, groupBody({}), key);
      assert.deepEqual([again.reference, again.code], [first.reference, "replayed"]);
    });
    it("BR2.2 two editors", async () => {
      const body = groupBody({ id: GROUP_1, name: "Boróka új", expected_version: 1 });
      const results = await Promise.all([
        saveGroup(SUPER_ADMIN, body),
        callSecond(SUPER_ADMIN, "structure_save($1, 'group', $2::jsonb)", [nextKey("g"), body]),
      ]);
      assert.deepEqual(results.map((result) => result.state).sort(), ["conflict", "success"]);
    });

    it("BR2.3 each role", async () => {
      for (const account of [PARENT_F1, TEACHER_G1, ADMIN_G1, SUPER_ADMIN]) {
        const result = await call(account, "working_group_list()", []);
        assert.equal(result.state, "success");
        const items = result.items as Record<string, unknown>[];
        assert.deepEqual(
          items.map((item) => item.name),
          ["Boróka", "Napraforgó"],
        );
        assert.deepEqual(Object.keys(items[0]!).sort(), [
          "description",
          "id",
          "name",
          "school_year_id",
          "school_year_name",
        ]);
      }
    });
    it("BR2.3 no role denied", async () => {
      assert.equal((await call(OUTSIDER, "working_group_list()", [])).state, "denied");
    });
    it("BR2.3 other community", async () => {
      const result = await call(OTHER_ADMIN, "working_group_list()", []);
      assert.deepEqual(
        (result.items as { id: string }[]).map((item) => item.id),
        [GROUP_OTHER],
      );
    });

    it("BR2.5 super admin", async () => {
      assert.equal((await saveGroup(SUPER_ADMIN, groupBody({}))).state, "success");
    });
    it("BR2.5 group admin refused", async () => {
      const edit = groupBody({ id: GROUP_1, name: "Átnevezett", expected_version: 1 });
      assert.equal((await saveGroup(ADMIN_G1, edit)).state, "denied");
      const archive = await call(ADMIN_G1, "directory_archive_item($1, 'group', $2, 1)", [
        nextKey("a"),
        GROUP_1,
      ]);
      assert.equal(archive.state, "denied");
      const restore = await call(ADMIN_G1, "directory_restore_item($1, 'group', $2, 1)", [
        nextKey("r"),
        GROUP_1,
      ]);
      assert.equal(restore.state, "denied");
    });
    it("BR2.5 other community", async () => {
      const result = await saveGroup(
        SUPER_ADMIN,
        JSON.stringify({ id: GROUP_OTHER, name: "X", description: "Y", expected_version: 1 }),
      );
      assert.deepEqual(
        [result.state, result.field, result.reason],
        ["validation", "id", "not_found"],
      );
      const year = await saveGroup(
        SUPER_ADMIN,
        JSON.stringify({ school_year_id: YEAR_OTHER, name: "X", description: "Y" }),
      );
      assert.deepEqual([year.field, year.reason], ["school_year_id", "not_found"]);
    });
    it("BR2.5 stale version", async () => {
      const result = await call(SUPER_ADMIN, "directory_archive_item($1, 'group', $2, 99)", [
        nextKey("a"),
        GROUP_1,
      ]);
      assert.equal(result.code, "VERSION_CONFLICT");
    });
    it("BR2.5 repeat", async () => {
      const key = nextKey("a");
      const sql = "directory_archive_item($1, 'group', $2, 1)";
      assert.equal((await call(SUPER_ADMIN, sql, [key, GROUP_1])).state, "success");
      assert.equal((await call(SUPER_ADMIN, sql, [key, GROUP_1])).code, "replayed");
    });
    it("BR2.5 two editors", async () => {
      const results = await Promise.all([
        call(SUPER_ADMIN, "directory_archive_item($1, 'group', $2, 1)", [nextKey("a"), GROUP_1]),
        callSecond(SUPER_ADMIN, "structure_save($1, 'group', $2::jsonb)", [
          nextKey("g"),
          groupBody({ id: GROUP_1, name: "Más", expected_version: 1 }),
        ]),
      ]);
      assert.deepEqual(results.map((result) => result.state).sort(), ["conflict", "success"]);
    });

    it("BR7.1 catalogue", async () => {
      const tables = await db.query(
        `select tablename from pg_tables where schemaname = $1
          and (tablename like 'import%' or tablename in ('sheet_registry', 'app_import_runs'))`,
        [schema],
      );
      assert.deepEqual(tables.rows, []);
      const functions = await db.query(
        `select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = $1 and (p.proname like 'import%' or p.proname = 'dashboard_import_conflicts'
                or p.prosrc ~ '(import_runs|import_staged_rows|sheet_registry|import_expire)')`,
        [schema],
      );
      assert.deepEqual(functions.rows, []);
      const action = await db.query(
        `select pg_get_constraintdef(oid) as definition from pg_constraint
          where conname = 'audit_events_action_check' and connamespace = $1::regnamespace`,
        [schema],
      );
      assert.match(String(action.rows[0]?.definition), /import\.commit/);
    });

    it("BR2.1 six listed", async () => {
      await resetWorkerData(db, schema);
      await writeSeedPlan(db as never, buildSeedPlan(schema, "small"));
      const groups = await db.query(`select name, description from "${schema}".groups`);
      assert.deepEqual(groups.rows.map((row) => String(row.name)).toSorted(), [
        "Játszókert",
        "Karbantartó",
        "Kreatív-alkotó",
        "Nagytakarítás szervezése",
        "Állatgondozás",
        "Ünnep-előkészítő",
      ]);
      assert.ok(groups.rows.every((row) => String(row.description).length > 0));
    });
    it("BR2.1 seed twice", async () => {
      await resetWorkerData(db, schema);
      const plan = buildSeedPlan(schema, "small");
      await writeSeedPlan(db as never, plan);
      await writeSeedPlan(db as never, plan);
      assert.equal(await count(db, "groups"), 6);
    });
  });
}

/** The clean start, on a private schema built up to the file before the structure change (NFR7.1). */
describe("clean start (BR1.4)", () => {
  const schema = "u1_clean_start";
  const CHANGE = "20261047_community_foundation.sql";
  const all = readMigrationFiles(`${root}supabase/migrations`);
  const change = all.find((file) => file.name === CHANGE)!;
  const earlier = all.filter((file) => file.name < CHANGE);
  const LISTED = [
    "change_requests",
    "contribution_notes",
    "assignments",
    "tasks",
    "events",
    "notifications",
    "reminder_attempts",
    "reminder_recipients",
    "reminder_jobs",
    "group_memberships",
    "groups",
    "children",
    "parent_contacts",
    "parents",
    "families",
    "invitations",
  ];
  const KEPT = [
    "organizations",
    "school_years",
    "accounts",
    "organization_settings",
    "audit_events",
  ];
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
  const owner = uuid(70001);
  async function seedOldWorld() {
    await db.query(`set search_path to ${schema}, pg_catalog`);
    const org = ORGANIZATION;
    await db.query("insert into organizations (id, name) values ($1, 'Régi')", [org]);
    await db.query(
      "insert into school_years (id, organization_id, name, starts_on, ends_on) values ($1, $2, 'Régi év', '2026-09-01', '2027-06-30')",
      [uuid(70002), org],
    );
    await db.query(
      "insert into groups (id, organization_id, school_year_id, name) values ($1, $2, $3, 'Óvodai csoport')",
      [uuid(70003), org, uuid(70002)],
    );
    await db.query(
      "insert into families (id, organization_id, display_name) values ($1, $2, 'Régi család')",
      [uuid(70004), org],
    );
    await db.query(
      "insert into group_memberships (organization_id, family_id, group_id) values ($1, $2, $3)",
      [org, uuid(70004), uuid(70003)],
    );
    await db.query(
      "insert into parents (id, organization_id, family_id, display_name) values ($1, $2, $3, 'Régi szülő')",
      [uuid(70005), org, uuid(70004)],
    );
    await db.query("insert into parent_contacts (parent_id, organization_id) values ($1, $2)", [
      uuid(70005),
      org,
    ]);
    await db.query(
      "insert into children (id, organization_id, family_id, display_name) values ($1, $2, $3, 'Régi gyermek')",
      [uuid(70006), org, uuid(70004)],
    );
    await db.query(
      "insert into accounts (id, email, organization_id) values ($1, 'regi@example.test', $2)",
      [owner, org],
    );
    for (const [role, type, scope] of [
      ["super_admin", "organization", org],
      ["group_admin", "group", uuid(70003)],
      ["kindergarten_teacher", "group", uuid(70003)],
      ["parent", "family", uuid(70004)],
    ] as const) {
      await db.query(
        "insert into app_role_grants (id, subject_id, role, scope_type, scope_id, organization_id) values (gen_random_uuid(), $1, $2, $3, $4, $5)",
        [owner, role, type, scope, org],
      );
    }
    await db.query(
      `insert into invitations (email, role, scope_type, scope_id, organization_id, token_hash, created_by_account_id)
       values ('m@example.test', 'parent', 'family', $1, $2, $3, $4)`,
      [uuid(70004), org, "a".repeat(64), owner],
    );
    await db.query(
      "insert into events (id, organization_id, group_id, title, starts_at, ends_at) values ($1, $2, $3, 'Régi', now(), now())",
      [uuid(70007), org, uuid(70003)],
    );
    await db.query(
      "insert into tasks (id, organization_id, group_id, event_id, title, capacity, starts_at, ends_at) values ($1, $2, $3, $4, 'Régi', 2, now(), now())",
      [uuid(70008), org, uuid(70003), uuid(70007)],
    );
    await db.query(
      "insert into assignments (id, organization_id, task_id, family_id, source) values ($1, $2, $3, $4, 'import')",
      [uuid(70009), org, uuid(70008), uuid(70004)],
    );
    await db.query(
      `insert into change_requests (organization_id, assignment_id, kind, requested_by_parent_id, source_task_id, source_assignment_version)
       values ($1, $2, 'cancellation', $3, $4, 1)`,
      [org, uuid(70009), uuid(70005), uuid(70008)],
    );
    await db.query(
      "insert into contribution_notes (organization_id, assignment_id, text) values ($1, $2, 'r')",
      [org, uuid(70009)],
    );
    await db.query(
      `insert into reminder_jobs (id, organization_id, task_id, threshold, task_starts_at, scheduled_for, correlation_id)
       values ($1, $2, $3, '7d', now(), now(), 'abcdef')`,
      [uuid(70010), org, uuid(70008)],
    );
    await db.query(
      "insert into reminder_recipients (organization_id, reminder_job_id, family_id) values ($1, $2, $3)",
      [org, uuid(70010), uuid(70004)],
    );
    await db.query(
      "insert into reminder_attempts (organization_id, reminder_job_id, attempt_number, outcome) values ($1, $2, 1, 'simulated_sent')",
      [org, uuid(70010)],
    );
    await db.query(
      `insert into notifications (organization_id, parent_id, kind, target_type, target_ref, task_id, task_starts_at, dedupe_key)
       values ($1, $2, 'sign_up_confirmed', 'task', $3, $3, now(), 'k')`,
      [org, uuid(70005), uuid(70008)],
    );
    await db.query(
      "insert into organization_settings (organization_id, key, value) values ($1, 'kulcs', 'ertek')",
      [org],
    );
    await db.query(
      `insert into audit_events (id, actor_account_id, actor_role, action, target_type, target_id, organization_id, outcome)
       values (gen_random_uuid(), $1, 'system', 'import.commit', 'import', $2, $3, 'success')`,
      [owner, uuid(70011), org],
    );
  }

  before(async () => {
    db = await openDatabase();
    await dropSchema();
    await db.query(`create schema ${schema}`);
  });
  after(async () => {
    await dropSchema();
    await db.end();
  });

  it("BR1.4 forced failure rolls back", async () => {
    await apply(earlier);
    await seedOldWorld();
    await assert.rejects(
      apply([{ ...change, sql: change.sql.replace(/commit;\s*$/, "select 1 / 0;\ncommit;\n") }]),
    );
    await db.query("rollback").catch(() => undefined);
    await db.query(`set search_path to ${schema}, pg_catalog`);
    for (const table of LISTED) assert.equal(await count(db, table), 1, table);
    assert.equal(await count(db, "app_role_grants"), 4);
    assert.equal(await count(db, "import_runs"), 0);
    const column = await db.query(
      "select 1 from information_schema.columns where table_schema = $1 and table_name = 'group_memberships' and column_name = 'family_id'",
      [schema],
    );
    assert.equal(column.rowCount, 1);
    await db.query(
      `delete from ${TRACKING_SCHEMA}.applied_migrations where schema_name = $1 and filename = $2`,
      [schema, CHANGE],
    );
  });

  it("BR1.4 removes all listed", async () => {
    const result = await apply([...earlier, change]);
    assert.deepEqual(result.applied, [CHANGE]);
    await db.query(`set search_path to ${schema}, pg_catalog`);
    for (const table of LISTED) assert.equal(await count(db, table), 0, table);
    for (const table of KEPT) assert.equal(await count(db, table), 1, table);
    const grants = await db.query("select role from app_role_grants");
    assert.deepEqual(grants.rows, [{ role: "super_admin" }]);
    assert.equal(await count(db, "audit_events", "action = 'import.commit'"), 1);
  });

  it("BR1.4 runs once", async () => {
    const result = await apply([...earlier, change]);
    assert.deepEqual(result.applied, []);
  });
});

// A named constant keeps the other organization in the fixture imports even where one schema's rows are unused.
void OTHER_ORGANIZATION;
void EVENT_OTHER;
