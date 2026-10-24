import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import { SHEET_REGISTRY } from "../../src/import-parser/template.ts";
import {
  ADMIN_G1,
  asActor,
  authenticated,
  countAs,
  DEACTIVATED,
  openDirectoryDatabase,
  ORGANIZATION,
  OTHER_ORGANIZATION,
  PARENT_F1,
  SIGNED_OUT,
  SUPER_ADMIN,
  TEACHER_G1,
  OTHER_ADMIN,
  OUTSIDER,
  seedDirectoryWorld,
  uuid,
} from "./directory-support.ts";
import {
  DIRECTORY_SHEET,
  hex64,
  IMPORT_SCHEMAS,
  insertConflict,
  insertRow,
  insertRun,
  insertStaged,
  seedImportAccounts,
  seedRun,
  SUPER_ADMIN_2,
  SUPER_ADMIN_3,
  TASK_SHEET,
} from "./import-support.ts";
import { ensureAccount, failureOf } from "./stack-support.ts";

const IMPORT_TABLES = [
  "sheet_registry",
  "import_runs",
  "import_rows",
  "import_staged_rows",
  "import_conflicts",
] as const;

/**
 * Import schema: constraints, indexes, the registry seed, the policies per caller (above all the staged rows
 * that only the starting super admin reads), cross-organization isolation and the privilege list (BR41.1,
 * BR41.7, BR41.10, NFR1.44, NFR1.45, NFR1.52, NFR1.53, NFR3.13).
 */
for (const schema of IMPORT_SCHEMAS) {
  describe(`import schema in ${schema}`, () => {
    let db: pg.Client;

    before(async () => {
      db = await openDirectoryDatabase(schema);
    });
    after(async () => {
      await db.end();
    });
    beforeEach(async () => {
      await seedDirectoryWorld(db, schema);
      await seedImportAccounts(db);
    });

    const code = async (sql: string, values: unknown[] = []) =>
      (await failureOf(() => db.query(sql, values)))?.code;

    it("seeds exactly the 17 sheets of the template: 8 interactive and 9 archive, in the order and with the texts of the parser's list (BR41.10)", async () => {
      const rows = (
        await db.query(
          "select sheet, mode, destination, owner_label, sort_order from sheet_registry order by sort_order",
        )
      ).rows as { sheet: string; mode: string; destination: string; owner_label: string }[];
      assert.equal(rows.length, 17);
      assert.equal(rows.filter((row) => row.mode === "interactive").length, 8);
      assert.equal(rows.filter((row) => row.mode === "read_only_archive").length, 9);
      assert.deepEqual(
        rows.map((row) => [row.sheet, row.mode, row.destination, row.owner_label]),
        SHEET_REGISTRY.map((entry) => [
          entry.sheet,
          entry.mode,
          entry.destination,
          entry.ownerLabel,
        ]),
        "the table and src/import-parser/template.ts agree",
      );
      assert.equal(
        await code("update sheet_registry set mode = 'paper' where sort_order = 1"),
        "23514",
      );
      assert.equal(
        await code(
          "insert into sheet_registry (sheet, mode, destination, owner_label, sort_order) values ('Tizennyolcadik', 'interactive', 'x', 'y', 18)",
        ),
        "23514",
        "no eighteenth sheet fits",
      );
    });

    it("limits a run's status, step, name, fingerprint, counts and dates (entities)", async () => {
      const insert = (column: string, value: unknown) => {
        const row: Record<string, unknown> = {
          organization_id: ORGANIZATION,
          workbook_name: "a.xlsx",
          workbook_fingerprint: hex64(),
          total_rows: 3,
          started_by_account_id: SUPER_ADMIN_3,
          expires_at: new Date(Date.now() + 7 * 86_400_000).toISOString(),
          [column]: value,
        };
        const columns = Object.keys(row);
        return code(
          `insert into import_runs (${columns.join(", ")}) values (${columns.map((_, index) => `$${index + 1}`).join(", ")})`,
          columns.map((name) => row[name]),
        );
      };
      assert.equal(await insert("status", "paused"), "23514");
      assert.equal(await insert("step", 3), "23514", "steps 1 to 3 are the screen's own");
      assert.equal(await insert("step", 8), "23514");
      assert.equal(
        await insert("workbook_name", "kert/terv.xlsx"),
        "23514",
        "a file name has no path",
      );
      assert.equal(await insert("workbook_name", "C:\\iskola\\terv.xlsx"), "23514");
      assert.equal(await insert("workbook_name", ""), "23514");
      assert.equal(await insert("workbook_name", "x".repeat(201)), "23514");
      assert.equal(await insert("workbook_fingerprint", "NOT-A-HASH"), "23514");
      assert.equal(
        await insert("imported_rows", 4),
        "23514",
        "imported plus skipped never exceed the total",
      );
      assert.equal(
        await insert("committed_at", new Date().toISOString()),
        "23514",
        "committed_at belongs to committed runs",
      );
      assert.equal(await insert("status", "committed"), "23514", "a committed run has its time");
      assert.equal(await insert("changed_summary", JSON.stringify({ a: 1 })), "23514");
      assert.equal(await insert("workbook_name", "kerti-munka.xlsx"), undefined);
      assert.equal(
        await insert("expires_at", new Date(Date.now() - 86_400_000).toISOString()),
        "23514",
        "a run expires after it was created",
      );
    });

    it("allows one open run per super admin and organization, and a new one once the old one is finished (BR41.3)", async () => {
      await insertRun(db, { startedBy: SUPER_ADMIN });
      for (const status of ["previewed", "confirmed", "interrupted"]) {
        await assert.rejects(
          insertRun(db, { startedBy: SUPER_ADMIN, status }),
          { code: "23505" },
          status,
        );
      }
      // Another super admin, and another organization, have their own run.
      await insertRun(db, { startedBy: SUPER_ADMIN_2 });
      await insertRun(db, { startedBy: SUPER_ADMIN, organization: OTHER_ORGANIZATION });
      // Finished runs stay as history and do not count.
      for (const status of ["committed", "recovered", "cancelled", "expired"]) {
        await insertRun(db, { startedBy: SUPER_ADMIN, status });
      }
      await db.query(
        "update import_runs set status = 'cancelled' where started_by_account_id = $1 and status = 'previewed'",
        [SUPER_ADMIN],
      );
      await insertRun(db, { startedBy: SUPER_ADMIN });
    });

    it("keeps a row's sheet registered, its source key unique per run and its organization that of its run (BR41.10)", async () => {
      const run = await insertRun(db, { startedBy: SUPER_ADMIN });
      await insertRow(db, { run, row: 2 });
      await assert.rejects(insertRow(db, { run, row: 2 }), { code: "23505" });
      await insertRow(db, { run, row: 2, sheet: TASK_SHEET });
      assert.equal(
        await code(
          "insert into import_rows (organization_id, import_run_id, sheet, row_number, source_key) values ($1, $2, 'Ismeretlen lap', 3, 'Ismeretlen lap:3')",
          [ORGANIZATION, run],
        ),
        "23503",
        "only the 17 registered sheets",
      );
      assert.equal(
        await code(
          "insert into import_rows (organization_id, import_run_id, sheet, row_number, source_key) values ($1, $2, $3, 0, 'x:0')",
          [ORGANIZATION, run, DIRECTORY_SHEET],
        ),
        "23514",
      );
      assert.equal(
        await code(
          "insert into import_rows (organization_id, import_run_id, sheet, row_number, source_key, outcome) values ($1, $2, $3, 9, 'k9', 'lost')",
          [ORGANIZATION, run, DIRECTORY_SHEET],
        ),
        "23514",
      );
      assert.equal(
        await code(
          "insert into import_rows (organization_id, import_run_id, sheet, row_number, source_key) values ($1, $2, $3, 9, 'k9')",
          [OTHER_ORGANIZATION, run, DIRECTORY_SHEET],
        ),
        "23503",
        "a row cannot belong to another organization than its run",
      );
    });

    it("accepts only an object of short string values as a staged payload, and ties a staged row to its import row (BR41.7)", async () => {
      const run = await insertRun(db, { startedBy: SUPER_ADMIN });
      await insertRow(db, { run, row: 2 });
      const stage = (payload: unknown, row = 2) =>
        code(
          "insert into import_staged_rows (organization_id, import_run_id, source_key, payload, unit_ref) values ($1, $2, $3, $4::jsonb, $5)",
          [ORGANIZATION, run, `${DIRECTORY_SHEET}:${row}`, JSON.stringify(payload), hex64()],
        );
      assert.equal(await stage(["not", "an", "object"]), "23514");
      assert.equal(await stage({ Család: 12 }), "23514", "values are strings");
      assert.equal(await stage({ Család: null }), "23514");
      assert.equal(await stage({ Család: { nested: "x" } }), "23514");
      assert.equal(
        await stage({ "Opcionális profil": "x".repeat(10001) }),
        "23514",
        "10000 characters at most",
      );
      const wide = Object.fromEntries(Array.from({ length: 21 }, (_, index) => [`k${index}`, "v"]));
      assert.equal(await stage(wide), "23514", "at most twenty columns");
      assert.equal(
        await stage({ Család: "Hosszú", "Opcionális profil": "x".repeat(10000) }),
        undefined,
      );
      assert.equal(await stage({ Család: "Második" }), "23505", "one staged row per source key");
      assert.equal(
        await stage({ Család: "Árva" }, 7),
        "23503",
        "a staged row needs its import row",
      );
      assert.equal(
        await code(
          "insert into import_staged_rows (organization_id, import_run_id, source_key, payload, unit_ref) values ($1, $2, $3, '{}'::jsonb, 'nem-hash')",
          [ORGANIZATION, run, `${DIRECTORY_SHEET}:2`],
        ),
        "23514",
        "the unit reference is a hash",
      );
    });

    it("keeps the matched record all-or-nothing and the conflict message in step with the class (BR41.4, BR41.6)", async () => {
      const run = await insertRun(db, { startedBy: SUPER_ADMIN });
      await insertRow(db, { run, row: 2 });
      await insertStaged(db, { run, row: 2 });
      const update = (set: string) =>
        code(`update import_staged_rows set ${set} where import_run_id = $1`, [run]);
      assert.equal(
        await update("matched_record_type = 'family'"),
        "23514",
        "type without id and version",
      );
      assert.equal(
        await update(
          "matched_record_type = 'person', matched_record_id = gen_random_uuid(), matched_record_version = 1",
        ),
        "23514",
      );
      assert.equal(
        await update(
          "matched_record_type = 'task', matched_record_id = gen_random_uuid(), matched_record_version = 0",
        ),
        "23514",
      );
      assert.equal(
        await update(
          "matched_record_type = 'family', matched_record_id = gen_random_uuid(), matched_record_version = 3",
        ),
        undefined,
      );
      assert.equal(
        await update("match_class = 'conflict'"),
        "23514",
        "a conflict names its reason",
      );
      assert.equal(
        await update("conflict_message = 'Az elem már létezik.'"),
        "23514",
        "a reason belongs to a conflict",
      );
      assert.equal(
        await update("match_class = 'conflict', conflict_message = 'Nem szerepel a listán.'"),
        "23514",
        "the reason is from the closed list",
      );
      assert.equal(
        await update("match_class = 'conflict', conflict_message = 'Ismeretlen csoport.'"),
        undefined,
      );
      assert.equal(await update("match_class = 'maybe', conflict_message = null"), "23514");
    });

    it("keeps one conflict per row, a closed reason list and a closed resolution list, and raises the conflict version on a decision (BR41.5)", async () => {
      const run = await insertRun(db, { startedBy: SUPER_ADMIN });
      const row = await insertRow(db, { run, row: 2, outcome: "conflict" });
      const other = await insertRow(db, { run, row: 3, outcome: "conflict" });
      const conflict = await insertConflict(db, { run, row });
      await assert.rejects(insertConflict(db, { run, row }), { code: "23505" });
      await assert.rejects(insertConflict(db, { run, row: other, message: "Valami baj van." }), {
        code: "23514",
      });
      await assert.rejects(insertConflict(db, { run, row: other, resolution: "maybe" }), {
        code: "23514",
      });
      assert.equal(
        await code(
          "insert into import_conflicts (organization_id, import_run_id, import_row_id, row_label, message) values ($1, $2, $3, 'x', 'Az elem már létezik.')",
          [ORGANIZATION, run, uuid(7777)],
        ),
        "23503",
        "a conflict needs a row of its own run",
      );
      assert.equal(
        await code(
          "insert into import_conflicts (organization_id, import_run_id, import_row_id, row_label, message) values ($1, $2, $3, 'x', 'Az elem már létezik.')",
          [OTHER_ORGANIZATION, run, other],
        ),
        "23503",
      );
      const before = (
        await db.query("select version from import_conflicts where id = $1", [conflict])
      ).rows[0].version as number;
      await db.query("update import_conflicts set resolution = 'use_import' where id = $1", [
        conflict,
      ]);
      const after = (
        await db.query("select version from import_conflicts where id = $1", [conflict])
      ).rows[0].version as number;
      assert.equal(after, before + 1);
    });

    it("has the indexes the policies and functions need (NFR3.13)", async () => {
      const indexes = (
        await db.query(
          "select tablename, indexdef from pg_indexes where schemaname = current_schema() and tablename = any($1)",
          [[...IMPORT_TABLES]],
        )
      ).rows as { tablename: string; indexdef: string }[];
      const has = (table: string, fragment: string) =>
        indexes.some((row) => row.tablename === table && row.indexdef.includes(fragment));
      assert.ok(
        has("import_runs", "UNIQUE INDEX import_runs_one_open") &&
          has("import_runs", "(organization_id, started_by_account_id)"),
        "one open run per starter",
      );
      assert.ok(
        has("import_runs", "(organization_id, started_by_account_id, created_at DESC)"),
        "the status lookup",
      );
      assert.ok(has("import_runs", "(status, expires_at)"), "the expiry sweep");
      assert.ok(has("import_rows", "(import_run_id, source_key)"), "rows by run and source key");
      assert.ok(has("import_rows", "(import_run_id, outcome)"), "outcomes by run");
      assert.ok(
        has("import_staged_rows", "(import_run_id, source_key)"),
        "staged rows by source key",
      );
      assert.ok(has("import_staged_rows", "(import_run_id, unit_ref)"), "staged rows by unit");
      assert.ok(has("import_conflicts", "(import_run_id, resolution)"), "open conflicts by run");
      assert.ok(has("import_conflicts", "(import_row_id)"), "one conflict per row");
    });

    /** Rows each viewer sees of the first super admin's run: one run, one row, one staged row, one conflict. */
    const SEES_RUN: [string, string, number][] = [
      ["the starting super admin", SUPER_ADMIN, 1],
      ["a second super admin of the organization", SUPER_ADMIN_2, 0],
      ["a group admin", ADMIN_G1, 0],
      ["a teacher", TEACHER_G1, 0],
      ["a parent", PARENT_F1, 0],
      ["an account without a grant", OUTSIDER, 0],
      ["a deactivated account", DEACTIVATED, 0],
      ["an account without a session", SIGNED_OUT, 0],
      ["a super admin of another organization", OTHER_ADMIN, 0],
    ];

    it("shows the run, its rows and its conflicts to the starting super admin only, and the staged rows likewise (BR41.1, BR41.7, NFR1.44)", async () => {
      await seedRun(db, SUPER_ADMIN);
      for (const table of [
        "import_runs",
        "import_rows",
        "import_staged_rows",
        "import_conflicts",
      ]) {
        for (const [who, account, rows] of SEES_RUN) {
          assert.equal(await countAs(db, schema, account, table), rows, `${table} as ${who}`);
        }
      }
      const anon = await failureOf(() =>
        asActor(db, schema, { role: "anon" }, () =>
          db.query("select count(*) from import_staged_rows"),
        ),
      );
      assert.equal(anon?.code, "42501", "the signed-out role has no table right");
    });

    it("lets only the starting super admin delete staged rows, and no role write a run, a row or a conflict directly (BR41.7)", async () => {
      const { run, staged } = await seedRun(db, SUPER_ADMIN);
      const remove = (account: string) =>
        asActor(
          db,
          schema,
          authenticated(account),
          async () =>
            (await db.query("delete from import_staged_rows where id = $1", [staged])).rowCount,
        );
      for (const account of [SUPER_ADMIN_2, ADMIN_G1, PARENT_F1, OTHER_ADMIN]) {
        assert.equal(await remove(account), 0, `${account} deletes nothing`);
      }
      assert.equal(
        (
          await db.query("select count(*)::int as n from import_staged_rows where id = $1", [
            staged,
          ])
        ).rows[0].n,
        1,
      );
      for (const sql of [
        "update import_runs set status = 'cancelled'",
        "delete from import_runs",
        "insert into import_runs (organization_id, workbook_name, workbook_fingerprint, total_rows, started_by_account_id, expires_at) values ('" +
          ORGANIZATION +
          "', 'a.xlsx', '" +
          hex64() +
          "', 1, '" +
          SUPER_ADMIN +
          "', now() + interval '1 day')",
        "update import_rows set outcome = 'created'",
        "delete from import_rows",
        "update import_conflicts set resolution = 'use_import'",
        "delete from import_conflicts",
        "update import_staged_rows set payload = '{}'::jsonb",
        "update sheet_registry set mode = 'interactive'",
        "delete from sheet_registry",
      ]) {
        const failure = await failureOf(() =>
          asActor(db, schema, authenticated(SUPER_ADMIN), () => db.query(sql)),
        );
        assert.equal(failure?.code, "42501", sql.slice(0, 60));
      }
      assert.equal(await remove(SUPER_ADMIN), 1, "the starter deletes their own staged row");
      assert.equal(
        (await db.query("select count(*)::int as n from import_runs where id = $1", [run])).rows[0]
          .n,
        1,
        "the run itself stays",
      );
    });

    it("stops the starter's access when the account is deactivated or its session is gone, and for a revoked super admin grant (BR41.1)", async () => {
      await seedRun(db, SUPER_ADMIN_3);
      assert.equal(await countAs(db, schema, SUPER_ADMIN_3, "import_staged_rows"), 1);
      await db.query("update accounts set status = 'deactivated' where id = $1", [SUPER_ADMIN_3]);
      assert.equal(await countAs(db, schema, SUPER_ADMIN_3, "import_staged_rows"), 0);
      assert.equal(await countAs(db, schema, SUPER_ADMIN_3, "import_runs"), 0);
      await ensureAccount(db, { id: SUPER_ADMIN_3, organization: ORGANIZATION });
      assert.equal(await countAs(db, schema, SUPER_ADMIN_3, "import_staged_rows"), 1);
      await db.query(
        "update app_role_grants set revoked_at = now() where subject_id = $1 and role = 'super_admin'",
        [SUPER_ADMIN_3],
      );
      assert.equal(
        await countAs(db, schema, SUPER_ADMIN_3, "import_staged_rows"),
        0,
        "no longer a super admin",
      );
      assert.equal(await countAs(db, schema, SUPER_ADMIN_3, "import_conflicts"), 0);
    });

    it("isolates organizations: each super admin sees only their own runs and the other organization's are invisible (NFR1.45, NFR1.53)", async () => {
      await seedRun(db, SUPER_ADMIN);
      await seedRun(db, OTHER_ADMIN, { organization: OTHER_ORGANIZATION });
      assert.equal(await countAs(db, schema, SUPER_ADMIN, "import_runs"), 1);
      assert.equal(await countAs(db, schema, OTHER_ADMIN, "import_runs"), 1);
      assert.equal(
        await countAs(
          db,
          schema,
          SUPER_ADMIN,
          "import_runs",
          `organization_id = '${OTHER_ORGANIZATION}'`,
        ),
        0,
      );
      assert.equal(
        await countAs(
          db,
          schema,
          OTHER_ADMIN,
          "import_staged_rows",
          `organization_id = '${ORGANIZATION}'`,
        ),
        0,
      );
      assert.equal(await countAs(db, schema, OTHER_ADMIN, "import_staged_rows"), 1);
      const reached = (account: string, run: string, organization: string) =>
        asActor(
          db,
          schema,
          authenticated(account),
          async () =>
            (await db.query("select import_run_reached($1, $2) as ok", [run, organization])).rows[0]
              .ok as boolean,
        );
      const first = (
        await db.query("select id from import_runs where organization_id = $1", [ORGANIZATION])
      ).rows[0].id as string;
      assert.equal(await reached(SUPER_ADMIN, first, ORGANIZATION), true);
      assert.equal(await reached(OTHER_ADMIN, first, ORGANIZATION), false);
      assert.equal(await reached(OTHER_ADMIN, first, OTHER_ORGANIZATION), false);
      assert.equal(await reached(SUPER_ADMIN_2, first, ORGANIZATION), false);
    });

    it("lets super admins read the sheet registry and nobody else, and the registry is not editable (BR41.10)", async () => {
      assert.equal(await countAs(db, schema, SUPER_ADMIN, "sheet_registry"), 17);
      assert.equal(await countAs(db, schema, OTHER_ADMIN, "sheet_registry"), 17);
      for (const account of [ADMIN_G1, TEACHER_G1, PARENT_F1, OUTSIDER, DEACTIVATED, SIGNED_OUT]) {
        assert.equal(await countAs(db, schema, account, "sheet_registry"), 0, account);
      }
    });

    it("gives the service-role key and the signed-out role no table right on any import table, and signed-in accounts only the reads they need (NFR1.52)", async () => {
      await seedRun(db, SUPER_ADMIN);
      for (const role of ["service_role", "anon"] as const) {
        for (const table of IMPORT_TABLES) {
          for (const sql of [
            `select count(*) from ${table}`,
            `delete from ${table}`,
            `update ${table} set ${table === "sheet_registry" ? "sheet" : "id"} = ${table === "sheet_registry" ? "sheet" : "id"}`,
          ]) {
            const failure = await failureOf(() =>
              asActor(db, schema, { role }, () => db.query(sql)),
            );
            assert.equal(failure?.code, "42501", `${role}: ${sql}`);
          }
        }
      }
      const rights = (
        await db.query(
          `select t.table_name,
                  has_table_privilege('service_role', quote_ident(t.table_schema) || '.' || quote_ident(t.table_name), 'select,insert,update,delete') as service,
                  has_table_privilege('anon', quote_ident(t.table_schema) || '.' || quote_ident(t.table_name), 'select,insert,update,delete') as anon,
                  has_table_privilege('authenticated', quote_ident(t.table_schema) || '.' || quote_ident(t.table_name), 'insert,update,truncate') as writes,
                  has_table_privilege('authenticated', quote_ident(t.table_schema) || '.' || quote_ident(t.table_name), 'delete') as removes
             from information_schema.tables t
            where t.table_schema = current_schema() and t.table_name = any($1) order by 1`,
          [[...IMPORT_TABLES]],
        )
      ).rows;
      assert.equal(rights.length, 5);
      for (const row of rights) {
        assert.deepEqual(
          [row.service, row.anon, row.writes, row.removes],
          [false, false, false, row.table_name === "import_staged_rows"],
          String(row.table_name),
        );
      }
      const grants = (
        await db.query(
          "select has_function_privilege('authenticated', 'import_run_reached(uuid, uuid)', 'execute') as authenticated, has_function_privilege('anon', 'import_run_reached(uuid, uuid)', 'execute') as anon, has_function_privilege('service_role', 'import_run_reached(uuid, uuid)', 'execute') as service, has_function_privilege('authenticated', 'import_payload_valid(jsonb)', 'execute') as payload",
        )
      ).rows[0];
      assert.deepEqual(grants, {
        authenticated: true,
        anon: false,
        service: false,
        payload: false,
      });
    });
  });
}
