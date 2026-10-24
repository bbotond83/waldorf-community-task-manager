import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import { applyMigrations, readMigrationFiles } from "../../scripts/db/runner.ts";
import { FRESH_SCHEMA_SETTINGS } from "../../scripts/db/migrate.ts";
import {
  ADMIN_G1,
  callFunction,
  openDirectoryDatabase,
  OTHER_ADMIN,
  PARENT_F1,
  seedDirectoryWorld,
  SUPER_ADMIN,
} from "./directory-support.ts";
import {
  dirRow,
  IMPORT_SCHEMAS,
  importKeyOf,
  preview,
  type ParsedRow,
  type PreviewModel,
  seedImportAccounts,
  SUPER_ADMIN_2,
  taskRow,
} from "./import-support.ts";
import { root } from "./stack-support.ts";

/** U4's elevated functions (security definer) and who may execute each: the entries added to U2's catalogue (BR42.4). */
const ELEVATED_U4: Record<string, "authenticated" | "service_role"> = {
  notification_actor_parent: "authenticated",
  notification_list: "authenticated",
  notification_mark_read: "authenticated",
  reminder_list: "authenticated",
  reminder_retry: "authenticated",
  reminder_run_due: "authenticated",
  reminder_run_due_system: "service_role",
  import_run_reached: "authenticated",
  import_preview_create: "authenticated",
  import_conflict_resolve: "authenticated",
  import_commit: "authenticated",
  import_recover: "authenticated",
  import_status: "authenticated",
  import_cancel: "authenticated",
  import_mark_interrupted: "authenticated",
  import_expire: "authenticated",
  import_expire_system: "service_role",
};

/** The plain internal functions of the import: not security definer, executable by no application role. */
const INTERNAL_U4 = [
  "import_payload_valid",
  "import_time",
  "import_unit_ref",
  "import_conflict_skip_only",
  "import_first",
  "import_active_year",
  "import_fingerprint",
  "import_task_units",
  "import_family_changed",
  "import_task_changed",
  "import_match",
  "import_run_model",
  "import_expire_org",
  "import_expire_run",
  "import_expire_all",
  "import_super_organization",
  "import_step_key",
  "import_require",
  "import_find_family",
  "import_effective",
  "import_family_payload",
  "import_apply",
  "import_after_lifecycle",
];

const U4_TABLES = [
  "notifications",
  "reminder_jobs",
  "reminder_recipients",
  "reminder_attempts",
  "sheet_registry",
  "import_runs",
  "import_rows",
  "import_staged_rows",
  "import_conflicts",
];

/** The result codes the database side of the import answers (BR42.3); the parser answers the other five. */
const DATABASE_CODES: [string, string[]][] = [
  [
    "import_commit",
    [
      "IMPORT_FINGERPRINT_CHANGED",
      "IMPORT_CONFLICT_UNRESOLVED",
      "IMPORT_CONFIRMATION_REQUIRED",
      "IMPORT_PREVIEW_STALE",
    ],
  ],
  [
    "import_apply",
    ["IMPORT_MATCH_CHANGED", "IMPORT_FINGERPRINT_CHANGED", "IMPORT_CONFLICT_UNRESOLVED"],
  ],
  ["import_conflict_resolve", ["IMPORT_PREVIEW_STALE", "IMPORT_CONFLICT_UNRESOLVED"]],
  ["import_recover", ["IMPORT_RECOVERY_NOT_AVAILABLE", "IMPORT_RECOVERY_ACTION_INVALID"]],
];

/**
 * The catalogue of U4's database objects: every elevated function with its allowed callers, every internal one
 * closed to the application roles, every table with its policies and the service-role privilege list, the stored
 * result codes, the dashboard count, and repeatability of U4's migration files (BR41.12, BR42.4, NFR1.51,
 * NFR1.56, NFR6.17).
 */
for (const schema of IMPORT_SCHEMAS) {
  describe(`import catalogue in ${schema}`, () => {
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

    const functions = async () =>
      (
        await db.query(
          `select p.proname, p.prosecdef, p.proconfig,
                  has_function_privilege('anon', p.oid, 'execute') as anon,
                  has_function_privilege('authenticated', p.oid, 'execute') as authenticated,
                  has_function_privilege('service_role', p.oid, 'execute') as service_role,
                  has_function_privilege('public', p.oid, 'execute') as public
             from pg_proc p where p.pronamespace = current_schema()::regnamespace and p.prokind = 'f'`,
        )
      ).rows as {
        proname: string;
        prosecdef: boolean;
        proconfig: string[] | null;
        anon: boolean;
        authenticated: boolean;
        service_role: boolean;
        public: boolean;
      }[];
    const call = (account: string, sql: string, values: unknown[] = []) =>
      callFunction(db, schema, account, sql, values);
    const run = (rows: readonly ParsedRow[], account = SUPER_ADMIN) =>
      preview(db, schema, account, rows);

    it("lists every elevated function of U4 with its caller: security definer, a pinned search path, executable by the named role only (BR42.4)", async () => {
      const all = await functions();
      for (const [name, who] of Object.entries(ELEVATED_U4)) {
        const rows = all.filter((row) => row.proname === name);
        assert.ok(rows.length >= 1, `${name} exists`);
        for (const row of rows) {
          assert.equal(row.prosecdef, true, `${name} is security definer`);
          const pinned = (row.proconfig ?? []).find((setting) =>
            setting.startsWith("search_path="),
          );
          assert.ok(
            pinned?.includes(`"${schema}"`) && pinned.endsWith(", pg_catalog"),
            `${name}: ${pinned}`,
          );
          assert.deepEqual(
            [row.anon, row.public, row.authenticated, row.service_role],
            [false, false, who === "authenticated", who === "service_role"],
            name,
          );
        }
      }
      // One role per function: the system caller's functions have their own names (the `_system` suffix).
      assert.deepEqual(
        Object.entries(ELEVATED_U4)
          .filter(([, who]) => who === "service_role")
          .map(([name]) => name)
          .sort(),
        ["import_expire_system", "reminder_run_due_system"],
      );
    });

    it("keeps the import's internal functions closed to every application role, with a pinned search path, and none of them security definer (BR42.4)", async () => {
      const all = await functions();
      for (const name of INTERNAL_U4) {
        const rows = all.filter((row) => row.proname === name);
        assert.ok(rows.length >= 1, `${name} exists`);
        for (const row of rows) {
          assert.equal(row.prosecdef, false, `${name} is a plain function`);
          assert.deepEqual(
            [row.anon, row.public, row.authenticated, row.service_role],
            [false, false, false, false],
            name,
          );
          const pinned = (row.proconfig ?? []).find((setting) =>
            setting.startsWith("search_path="),
          );
          assert.ok(pinned?.includes(`"${schema}"`), `${name}: ${pinned}`);
        }
      }
      const known = new Set([...Object.keys(ELEVATED_U4), ...INTERNAL_U4]);
      // The notification helpers and cores of the first batch are covered by U2's catalogue test.
      const unlisted = all
        .map((row) => row.proname)
        .filter((name) => name.startsWith("import_") && !known.has(name));
      assert.deepEqual(unlisted, [], "an import function that no list names");
    });

    it("gives every U4 table row-level security, the policies of the design and no other, and the service-role key no right (BR42.4, NFR1.52)", async () => {
      const rls = (
        await db.query(
          "select relname, relrowsecurity from pg_class where relnamespace = current_schema()::regnamespace and relkind = 'r' and relname = any($1) order by 1",
          [U4_TABLES],
        )
      ).rows as { relname: string; relrowsecurity: boolean }[];
      assert.equal(rls.length, U4_TABLES.length);
      assert.ok(
        rls.every((row) => row.relrowsecurity),
        "row-level security on every U4 table",
      );
      const policies = (
        await db.query(
          "select tablename, policyname, cmd, roles::text as roles from pg_policies where schemaname = current_schema() and tablename = any($1) order by tablename, policyname",
          [U4_TABLES],
        )
      ).rows as { tablename: string; policyname: string; cmd: string; roles: string }[];
      assert.deepEqual(
        policies.map((policy) => [policy.tablename, policy.policyname, policy.cmd]),
        [
          ["import_conflicts", "import_conflicts_read", "SELECT"],
          ["import_rows", "import_rows_read", "SELECT"],
          ["import_runs", "import_runs_read", "SELECT"],
          ["import_staged_rows", "import_staged_rows_delete", "DELETE"],
          ["import_staged_rows", "import_staged_rows_read", "SELECT"],
          ["notifications", "notifications_mark_read", "UPDATE"],
          ["notifications", "notifications_read", "SELECT"],
          ["sheet_registry", "sheet_registry_read", "SELECT"],
        ],
      );
      assert.ok(
        policies.every((policy) => policy.roles === "{authenticated}"),
        "policies for signed-in accounts only",
      );
      for (const table of U4_TABLES) {
        const rights = (
          await db.query(
            "select has_table_privilege('service_role', $1, 'select,insert,update,delete,truncate,references,trigger') as service, has_table_privilege('anon', $1, 'select,insert,update,delete,truncate') as anon, has_table_privilege('public', $1, 'select,insert,update,delete') as public",
            [`"${schema}"."${table}"`],
          )
        ).rows[0];
        assert.deepEqual(rights, { service: false, anon: false, public: false }, table);
      }
      // Of all the functions of the schema, the service-role key may execute exactly the system functions of the two blocks.
      const service = (await functions())
        .filter((row) => row.service_role && /^(import_|reminder_|notification_)/.test(row.proname))
        .map((row) => row.proname)
        .sort();
      assert.deepEqual(service, ["import_expire_system", "reminder_run_due_system"]);
    });

    it("stores the result codes of the database side of the import in the functions that answer them (BR42.3)", async () => {
      for (const [name, codes] of DATABASE_CODES) {
        const source = (
          await db.query(
            "select prosrc from pg_proc where proname = $1 and pronamespace = current_schema()::regnamespace",
            [name],
          )
        ).rows[0].prosrc as string;
        for (const code of codes)
          assert.ok(source.includes(`'${code}'`), `${name} answers ${code}`);
      }
      const apply = (
        await db.query(
          "select prosrc from pg_proc where proname = 'import_apply' and pronamespace = current_schema()::regnamespace",
        )
      ).rows[0].prosrc as string;
      assert.ok(apply.includes("IMPORT_MATCH_CHANGED"));
    });

    it("counts the asking super admin's open import conflicts on the dashboard and nothing for anybody else (BR41.12)", async () => {
      const count = async (account: string) =>
        (await call(account, "dashboard_get()")).open_import_conflicts as number;
      assert.equal(await count(SUPER_ADMIN), 0);
      const rows = [
        dirRow(2, {
          Csoport: "Boróka",
          Család: "Fenyő család",
          "Szülő neve": "Új Szülő",
          "E-mail": "uj@example.test",
        }),
        taskRow(2, {
          Csoport: "Ismeretlen csoport",
          Feladat: "Máshol",
          Kezdés: "2031-01-05 10:00",
          Befejezés: "2031-01-05 12:00",
          Létszám: "2",
        }),
        taskRow(3, {
          Csoport: "Boróka",
          Feladat: "Hibás",
          Kezdés: "holnap",
          Befejezés: "2031-01-05 12:00",
          Létszám: "2",
        }),
      ];
      let model: PreviewModel = await run(rows);
      assert.equal(model.conflicts.length, 3);
      assert.equal(await count(SUPER_ADMIN), 3);
      assert.equal(await count(SUPER_ADMIN_2), 0, "another super admin's runs are not counted");
      assert.equal(await count(ADMIN_G1), 0, "a group admin sees zero");
      assert.equal(await count(OTHER_ADMIN), 0);
      const resolve = async (conflict: string, version: number) =>
        (await call(SUPER_ADMIN, "import_conflict_resolve($1, $2, $3, $4, 'keep_existing')", [
          importKeyOf("r"),
          model.run_id,
          version,
          conflict,
        ])) as unknown as PreviewModel;
      model = {
        ...(await resolve(model.conflicts[0]!.id, model.version)),
        conflicts: model.conflicts,
      };
      assert.equal(await count(SUPER_ADMIN), 2, "a decided conflict no longer counts");
      // States: previewed, confirmed and interrupted count; committed, cancelled and expired do not.
      for (const [state, expected] of [
        ["interrupted", 2],
        ["confirmed", 2],
        ["committed", 0],
        ["cancelled", 0],
        ["expired", 0],
        ["previewed", 2],
      ] as const) {
        await db.query(
          "update import_runs set status = $2, step = case when $2 = 'interrupted' then 6 when $2 in ('committed') then 7 else 5 end, committed_at = case when $2 = 'committed' then now() else null end where id = $1",
          [model.run_id, state],
        );
        assert.equal(await count(SUPER_ADMIN), expected, state);
      }
      assert.equal((await call(PARENT_F1, "dashboard_get()")).state, "denied");
    });

    it("applies U4's migration files again without changing anything, in the default and in a worker schema (NFR6.17)", async () => {
      const files = readMigrationFiles(`${root}supabase/migrations`);
      const u4 = files.map((file) => file.name).filter((name) => name >= "20261036");
      assert.ok(u4.length >= 7, "the notification files and the four import files");
      assert.deepEqual([...u4].sort(), u4, "U4's files sort in their own order after U3's");
      assert.ok(
        u4.includes("20261039_import_schema.sql") &&
          u4.includes("20261042_import_dashboard_lifecycle.sql"),
      );
      const snapshot = async () =>
        (
          await db.query(
            `select (select count(*)::int from pg_proc where pronamespace = current_schema()::regnamespace) as functions,
                    (select count(*)::int from pg_class where relnamespace = current_schema()::regnamespace and relkind = 'r') as tables,
                    (select count(*)::int from pg_policies where schemaname = current_schema()) as policies,
                    (select count(*)::int from sheet_registry) as sheets,
                    (select count(*)::int from pg_indexes where schemaname = current_schema()) as indexes`,
          )
        ).rows[0];
      const before = await snapshot();
      const result = await applyMigrations({
        client: db,
        schema,
        files,
        log: () => {},
        now: () => Date.now(),
        freshSchemaSettings: FRESH_SCHEMA_SETTINGS,
      });
      assert.deepEqual(result.applied, []);
      assert.ok(
        u4.every((name) => result.upToDate.includes(name)),
        "every U4 file is recorded as applied",
      );
      await db.query(`set search_path to "${schema}", pg_catalog`);
      assert.deepEqual(await snapshot(), before);
      assert.equal((before as { sheets: number }).sheets, 17, "the registry survives a data reset");
    });
  });
}
