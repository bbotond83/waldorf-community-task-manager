import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import {
  asActor,
  callFunction,
  GROUP_1,
  openDirectoryDatabase,
  ORGANIZATION,
  PARENT_F1,
  seedDirectoryWorld,
  SUPER_ADMIN,
} from "./directory-support.ts";
import {
  archiveRow,
  budapestText,
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
import { sessionIdFor } from "./identity-support.ts";
import { resetWorkerData } from "../../scripts/db/worker.ts";

/** Fictitious personal values: they must never be found outside the staged rows and the family records themselves. */
const PERSONAL = [
  "Zöldfa",
  "Zsombor",
  "Zsuzsi",
  "zoldfa",
  "913 2468",
  "Zalaszentgrót",
  "kék kabát",
  "Törlendő",
];

const START = budapestText(20, 10);
const END = budapestText(20, 12);

const workbook = (): ParsedRow[] => [
  dirRow(2, {
    Csoport: "Boróka",
    Család: "Zöldfa család",
    "Szülő neve": "Zöldfa Zsombor",
    "E-mail": "zsombor.zoldfa@example.test",
    Telefon: "+36 70 913 2468",
    Helység: "Zalaszentgrót",
    "Opcionális profil": "Kedvenc kék kabát",
    Hozzájárulás: "igen",
  }),
  dirRow(3, { Csoport: "Boróka", Család: "Zöldfa család", "Gyermek neve": "Zöldfa Zsuzsi" }),
  taskRow(2, {
    Csoport: "Boróka",
    Feladat: "Kerti nap",
    Kezdés: START,
    Befejezés: END,
    Létszám: "2",
    Család: "Zöldfa család",
  }),
  taskRow(3, {
    Csoport: "Boróka",
    Feladat: "Kerti nap",
    Kezdés: START,
    Befejezés: END,
    Létszám: "2",
    Család: "Zöldfa Zsombor <img src=x onerror=alert(1)>",
  }),
  archiveRow(2),
];

/**
 * What the import leaves behind (BR41.7, BR41.8, BR42.4, NFR1.46, NFR3.12): the long-term history holds no
 * name, e-mail address or phone number; the staged rows are readable by the starting super admin alone and gone
 * when the run ends; the conflict list shows only a sheet, a row number and a fixed text.
 */
for (const schema of IMPORT_SCHEMAS) {
  describe(`import privacy in ${schema}`, () => {
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

    const call = (account: string, sql: string, values: unknown[] = []) =>
      callFunction(db, schema, account, sql, values);
    const run = (rows: readonly ParsedRow[] = workbook(), account = SUPER_ADMIN) =>
      preview(db, schema, account, rows);
    /** Every table the import or its neighbours keep history in, as text, for a leftover search. */
    const HISTORY = [
      "import_runs",
      "import_rows",
      "import_conflicts",
      "import_staged_rows",
      "audit_events",
      "idempotency_records",
      "reminder_jobs",
      "reminder_recipients",
      "reminder_attempts",
      "notifications",
      "change_requests",
      "contribution_notes",
      "lifecycle_holds",
      "sheet_registry",
    ];
    const dump = async (table: string) =>
      JSON.stringify((await db.query(`select * from ${table}`)).rows);
    const leftovers = async (tables = HISTORY) => {
      const found: string[] = [];
      for (const table of tables) {
        const text = (await dump(table)).toLowerCase();
        for (const value of PERSONAL) {
          if (text.includes(value.toLowerCase())) found.push(`${table}: ${value}`);
        }
      }
      return found;
    };
    const resolveAll = async (model: PreviewModel) => {
      let version = model.version;
      for (const conflict of model.conflicts) {
        const result = (await call(
          SUPER_ADMIN,
          "import_conflict_resolve($1, $2, $3, $4, 'keep_existing')",
          [importKeyOf("res"), model.run_id, version, conflict.id],
        )) as unknown as PreviewModel;
        version = result.version;
        model = result;
      }
      return model;
    };

    it("keeps names, e-mail addresses, phone numbers and notes out of every history table while the rows are staged, and out of every function result (BR41.7, NFR1.46)", async () => {
      const model = await run();
      assert.equal(model.state, "success");
      // The staged payload is where they are, so the search is meaningful.
      const staged = (await dump("import_staged_rows")).toLowerCase();
      for (const value of ["zöldfa", "zsombor", "913 2468", "zalaszentgrót", "kék kabát"]) {
        assert.ok(staged.includes(value), `the staged rows hold ${value}`);
      }
      assert.deepEqual(
        await leftovers(HISTORY.filter((table) => table !== "import_staged_rows")),
        [],
      );
      const results = [
        model,
        await call(SUPER_ADMIN, "import_status()"),
        await resolveAll(model),
        await call(SUPER_ADMIN, "import_expire()"),
      ];
      const text = JSON.stringify(results).toLowerCase();
      for (const value of PERSONAL) {
        assert.equal(text.includes(value.toLowerCase()), false, `a function result holds ${value}`);
      }
      assert.equal(text.includes("onerror"), false, "a hostile cell is never echoed");
    });

    it("leaves no personal value anywhere in the import's own tables or the audit log after a commit, while the family records hold them as they should (BR41.8, BR42.4)", async () => {
      const model = await run();
      const committed = (await call(SUPER_ADMIN, "import_commit($1, $2, $3, 'yes')", [
        importKeyOf("c"),
        model.run_id,
        model.fingerprint,
      ])) as unknown as PreviewModel & { state: string };
      assert.equal(
        committed.state,
        "conflict",
        "the open conflict of the hostile row blocks the commit",
      );
      const resolved = await resolveAll(model);
      const done = (await call(SUPER_ADMIN, "import_commit($1, $2, $3, 'yes')", [
        importKeyOf("c2"),
        model.run_id,
        resolved.fingerprint,
      ])) as unknown as PreviewModel & { state: string };
      assert.equal(done.state, "success");
      assert.deepEqual(await leftovers(), [], "no history table holds a personal value");
      // The records themselves do: they are the purpose of the import.
      const records = (
        await db.query(
          "select (select count(*)::int from parents where display_name = 'Zöldfa Zsombor') as parents, (select count(*)::int from parent_contacts where contact_email = 'zsombor.zoldfa@example.test') as contacts, (select count(*)::int from children where display_name = 'Zöldfa Zsuzsi') as children",
        )
      ).rows[0];
      assert.deepEqual(records, { parents: 1, contacts: 1, children: 1 });
      // Not even the note lives anywhere but the parent's own row.
      assert.equal(
        (
          await db.query(
            "select count(*)::int as n from parents where optional_profile = 'Kedvenc kék kabát'",
          )
        ).rows[0].n,
        1,
      );
    });

    it("shows a conflict as a sheet, a row number and one of the fixed texts, and nothing of the row's content (BR41.4)", async () => {
      const model = await run();
      assert.ok(model.conflicts.length >= 1, "the unknown family of the second task row");
      const allowed = [
        "Több egyező család.",
        "Az elem már létezik.",
        "Ismétlődő sor a fájlban.",
        "Ismeretlen csoport.",
        "Ismeretlen család.",
        "Hibás adat a sorban.",
        "Több egyező feladat.",
        "Az elem megváltozott.",
      ];
      for (const conflict of model.conflicts) {
        assert.deepEqual(Object.keys(conflict).sort(), [
          "id",
          "message",
          "resolution",
          "row_label",
          "skip_only",
        ]);
        assert.match(conflict.row_label, /^[^<>@]+ · \d+\. sor$/);
        assert.ok(allowed.includes(conflict.message), conflict.message);
        assert.equal(conflict.resolution, null);
      }
      const stored = (await db.query("select row_label, message from import_conflicts")).rows as {
        row_label: string;
        message: string;
      }[];
      assert.deepEqual(
        stored.map((row) => row.row_label).sort(),
        model.conflicts.map((conflict) => conflict.row_label).sort(),
      );
      assert.ok(stored.every((row) => allowed.includes(row.message)));
      // The model's own keys never include a payload.
      assert.equal(
        Object.keys(model).some((key) => /payload|values|email|phone/i.test(key)),
        false,
      );
    });

    it("lets only the starting super admin read the staged rows: a second super admin, a parent and the service-role key see none, and a second admin's preview leaves them alone (BR41.7)", async () => {
      const model = await run();
      const other = await run(
        [dirRow(2, { Csoport: "Boróka", Család: "Másik család", "Szülő neve": "Másik Mária" })],
        SUPER_ADMIN_2,
      );
      assert.equal(other.state, "success");
      const readStaged = (role: "authenticated" | "service_role", account?: string) =>
        asActor(
          db,
          schema,
          { role, account, session: account ? sessionIdFor(account) : undefined },
          async () =>
            (await db.query("select payload::text as payload from import_staged_rows")).rows.map(
              (row) => String(row.payload),
            ),
        );
      const first = await readStaged("authenticated", SUPER_ADMIN);
      const second = await readStaged("authenticated", SUPER_ADMIN_2);
      assert.ok(
        first.length === 4 && first.every((payload) => !payload.includes("Másik")),
        "the starter sees only their own rows",
      );
      assert.deepEqual(second.length, 1);
      assert.ok(
        second.every((payload) => !payload.includes("Zöldfa")),
        "the second admin sees none of the first's",
      );
      assert.deepEqual(await readStaged("authenticated", PARENT_F1), []);
      await assert.rejects(readStaged("service_role"), { code: "42501" });
      // The second admin's functions neither see nor touch the first run.
      assert.equal(
        ((await call(SUPER_ADMIN_2, "import_status()")) as unknown as { run: { run_id: string } })
          .run.run_id,
        other.run_id,
      );
      const cancel = await call(SUPER_ADMIN_2, "import_cancel($1)", [model.run_id]);
      assert.equal(cancel.code, "IMPORT_PREVIEW_STALE");
      assert.equal(
        (
          await db.query(
            "select count(*)::int as n from import_staged_rows where import_run_id = $1",
            [model.run_id],
          )
        ).rows[0].n,
        4,
      );
    });

    it("deletes the staged rows when a run is cancelled or expires, and then no personal value is left in the import's tables (BR41.8)", async () => {
      const cancelled = await run();
      assert.ok((await leftovers(["import_staged_rows"])).length > 0);
      await call(SUPER_ADMIN, "import_cancel($1)", [cancelled.run_id]);
      assert.deepEqual(await leftovers(), []);

      const aged = await run();
      await db.query(
        "update import_runs set created_at = now() - interval '8 days', expires_at = now() - interval '1 hour' where id = $1",
        [aged.run_id],
      );
      assert.ok((await leftovers(["import_staged_rows"])).length > 0, "nothing expires by itself");
      const swept = await call(SUPER_ADMIN, "import_expire()");
      assert.equal(swept.expired, 1);
      assert.deepEqual(await leftovers(), []);
      // The history of both runs remains, with counts and labels.
      const runs = (await db.query("select status, total_rows from import_runs order by status"))
        .rows;
      assert.deepEqual(runs, [
        { status: "cancelled", total_rows: 5 },
        { status: "expired", total_rows: 5 },
      ]);
      assert.equal((await db.query("select count(*)::int as n from import_rows")).rows[0].n, 10);
    });

    it("leaves no staged row behind when the schema is reset by the test and seed tooling (BR41.8)", async () => {
      const model = await run();
      assert.ok((await leftovers(["import_staged_rows"])).length > 0);
      await resetWorkerData(db, schema);
      assert.equal(
        (await db.query("select count(*)::int as n from import_staged_rows")).rows[0].n,
        0,
        "the reset empties the staged rows with every other table",
      );
      assert.equal(
        (await db.query("select count(*)::int as n from import_runs where id = $1", [model.run_id]))
          .rows[0].n,
        0,
      );
      assert.ok(
        (await db.query("select count(*)::int as n from sheet_registry")).rows[0].n > 0,
        "only the reference table of the sheets stays",
      );
    });

    it("matches the staged rows of a removed family by its id and by its name inside its own groups only, so another group's family of the same name keeps its rows (BR42.4)", async () => {
      const family = (
        await db.query(
          "insert into families (organization_id, display_name) values ($1, 'Ikernév család') returning id",
          [ORGANIZATION],
        )
      ).rows[0].id as string;
      await db.query(
        "insert into group_memberships (organization_id, family_id, group_id) values ($1, $2, $3)",
        [ORGANIZATION, family, GROUP_1],
      );
      const model = await run([
        dirRow(2, { Csoport: "Boróka", Család: "Ikernév család", "Szülő neve": "Iker Ilona" }),
        taskRow(2, {
          Csoport: "Boróka",
          Feladat: "Kerti nap",
          Kezdés: START,
          Befejezés: END,
          Létszám: "2",
          Család: "Ikernév család",
        }),
        taskRow(3, {
          Csoport: "Napraforgó",
          Feladat: "Kerti nap",
          Kezdés: START,
          Befejezés: END,
          Létszám: "2",
          Család: "Ikernév család",
        }),
        dirRow(3, { Csoport: "Napraforgó", Család: "Ikernév család", "Szülő neve": "Iker Imre" }),
      ]);
      assert.equal(model.state, "success");
      const remaining = async () =>
        (
          await db.query(
            "select payload ->> 'Csoport' as grp, payload ->> 'Feladat' as task from import_staged_rows order by 1, 2 nulls first",
          )
        ).rows;
      assert.equal((await remaining()).length, 4);
      await db.query(
        "update families set status = 'archived', archived_at = now() - interval '40 days' where id = $1",
        [family],
      );
      const version = (await db.query("select version from families where id = $1", [family]))
        .rows[0].version as number;
      const removed = await call(SUPER_ADMIN, "lifecycle_run($1, $2, $3, true)", [
        importKeyOf("life"),
        family,
        version,
      ]);
      assert.equal(removed.state, "success", JSON.stringify(removed));
      // The directory row of the family (matched by its id) and the task row in its own group are gone; both
      // rows of the other group, which only share the name, stay.
      assert.deepEqual(await remaining(), [
        { grp: "Napraforgó", task: null },
        { grp: "Napraforgó", task: "Kerti nap" },
      ]);
    });

    it("removes the staged rows that name or are matched to a family the lifecycle removed, so the commit asks for a new upload (BR42.4, NFR1.56)", async () => {
      const family = (
        await db.query(
          "insert into families (organization_id, display_name) values ($1, 'Törlendő család') returning id",
          [ORGANIZATION],
        )
      ).rows[0].id as string;
      await db.query(
        "insert into group_memberships (organization_id, family_id, group_id) values ($1, $2, $3)",
        [ORGANIZATION, family, GROUP_1],
      );
      const parent = (
        await db.query(
          "insert into parents (organization_id, family_id, display_name) values ($1, $2, 'Törlendő Tóbiás') returning id",
          [ORGANIZATION, family],
        )
      ).rows[0].id as string;
      await db.query(
        "insert into parent_contacts (parent_id, organization_id, contact_email) values ($1, $2, 'tobias@example.test')",
        [parent, ORGANIZATION],
      );
      const model = await run([
        dirRow(2, {
          Csoport: "Boróka",
          Család: "Törlendő család",
          "Szülő neve": "Törlendő Tóbiás",
          "E-mail": "tobias@example.test",
          Helység: "Zalaszentgrót",
        }),
        taskRow(2, {
          Csoport: "Boróka",
          Feladat: "Kerti nap",
          Kezdés: START,
          Befejezés: END,
          Létszám: "2",
          Család: "Törlendő család",
        }),
        dirRow(3, { Csoport: "Boróka", Család: "Maradó család", "Szülő neve": "Maradó Mónika" }),
      ]);
      assert.equal(model.state, "success");
      assert.equal(
        (await db.query("select count(*)::int as n from import_staged_rows")).rows[0].n,
        3,
      );

      await db.query(
        "update families set status = 'archived', archived_at = now() - interval '40 days' where id = $1",
        [family],
      );
      await db.query("update parents set status = 'archived' where id = $1", [parent]);
      const version = (await db.query("select version from families where id = $1", [family]))
        .rows[0].version as number;
      const removed = await call(SUPER_ADMIN, "lifecycle_run($1, $2, $3, true)", [
        importKeyOf("life"),
        family,
        version,
      ]);
      assert.equal(removed.state, "success", JSON.stringify(removed));
      assert.deepEqual(
        (
          await db.query(
            "select count(*)::int as n from import_staged_rows where payload::text like '%Törlendő%'",
          )
        ).rows[0].n,
        0,
        "no staged row names the family any more",
      );
      assert.equal(
        (await db.query("select count(*)::int as n from import_staged_rows")).rows[0].n,
        1,
        "the other family's row stays",
      );
      assert.deepEqual(
        await leftovers(
          HISTORY.filter((table) => table !== "import_staged_rows" && table !== "sheet_registry"),
        ),
        [],
      );
      const commit = await call(SUPER_ADMIN, "import_commit($1, $2, $3, 'yes')", [
        importKeyOf("after"),
        model.run_id,
        model.fingerprint,
      ]);
      assert.deepEqual([commit.state, commit.code], ["conflict", "IMPORT_FINGERPRINT_CHANGED"]);
      assert.equal(
        (await db.query("select status from import_runs where id = $1", [model.run_id])).rows[0]
          .status,
        "previewed",
      );
    });
  });
}
