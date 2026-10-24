import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import {
  ADMIN_G1,
  asActor,
  callFunction,
  DEACTIVATED,
  FAMILY_1,
  FAMILY_2,
  FAMILY_NO_GROUP,
  GROUP_1,
  openDirectoryDatabase,
  ORGANIZATION,
  OTHER_ADMIN,
  OTHER_ORGANIZATION,
  OUTSIDER,
  PARENT_F1,
  seedDirectoryWorld,
  SIGNED_OUT,
  SUPER_ADMIN,
  TEACHER_G1,
  uuid,
} from "./directory-support.ts";
import {
  archiveRow,
  ARCHIVE_SHEETS,
  budapestText,
  decisions,
  dirRow,
  IMPORT_SCHEMAS,
  importKeyOf,
  insertConflict,
  insertTaskAt,
  type ParsedRow,
  preview,
  type PreviewModel,
  seedImportAccounts,
  seedRun,
  SUPER_ADMIN_2,
  SUPER_ADMIN_3,
  taskRow,
  TASK_SHEETS,
} from "./import-support.ts";
import { failureOf, openDatabase } from "./stack-support.ts";

const START = budapestText(12, 10);
const END = budapestText(12, 12);

/** A usable task row of the first group (the family is optional). */
const task = (row: number, values: Record<string, string> = {}) =>
  taskRow(row, {
    Csoport: "Boróka",
    Feladat: "Havi takarítás",
    Kezdés: START,
    Befejezés: END,
    Létszám: "2",
    ...values,
  });

/**
 * Import preview, matching, resolution, status, cancel, expiry, interruption and recovery codes on the real
 * stack (BR41.1, BR41.3 to BR41.5, BR41.8, BR41.9, BR41.13, NFR3.14, NFR1.47).
 */
for (const schema of IMPORT_SCHEMAS) {
  describe(`import functions in ${schema}`, () => {
    let db: pg.Client;
    const extra: pg.Client[] = [];

    before(async () => {
      db = await openDirectoryDatabase(schema);
    });
    after(async () => {
      await Promise.all(extra.map((client) => client.end()));
      await db.end();
    });
    beforeEach(async () => {
      await seedDirectoryWorld(db, schema);
      await seedImportAccounts(db);
    });

    const call = (account: string, sql: string, values: unknown[] = []) =>
      callFunction(db, schema, account, sql, values);
    const run = (rows: readonly ParsedRow[], account = SUPER_ADMIN, name?: string) =>
      preview(db, schema, account, rows, name);
    const staged = async (runId: string) =>
      (
        await db.query(
          "select count(*)::int as n from import_staged_rows where import_run_id = $1",
          [runId],
        )
      ).rows[0].n as number;
    const resolve = (
      account: string,
      model: Pick<PreviewModel, "run_id" | "version">,
      conflict: string,
      resolution: string,
      version: number = model.version,
    ) =>
      call(account, "import_conflict_resolve($1, $2, $3, $4, $5)", [
        importKeyOf("resolve"),
        model.run_id,
        version,
        conflict,
        resolution,
      ]) as Promise<PreviewModel & { state: string; code: string | null }>;
    const status = async (account = SUPER_ADMIN) =>
      (await call(account, "import_status()")) as unknown as {
        state: string;
        code: string | null;
        run: (PreviewModel & { run_status: string }) | null;
      };
    const familyVersion = async (id: string) =>
      (await db.query("select version from families where id = $1", [id])).rows[0]
        .version as number;
    /** What the adapter sends after a commit failed with a retryable failure: the commit's own fingerprint and confirmation. */
    const mark = (
      account: string,
      model: Pick<PreviewModel, "run_id" | "fingerprint">,
      confirmation: string | null = "yes",
      fingerprint: string | null = model.fingerprint,
    ) =>
      call(account, "import_mark_interrupted($1, $2, $3)", [
        model.run_id,
        fingerprint,
        confirmation,
      ]) as Promise<PreviewModel & { state: string; code: string | null }>;
    const housekeeping = () =>
      asActor(
        db,
        schema,
        { role: "service_role" },
        async () =>
          (await db.query("select identity_housekeeping() as result")).rows[0].result as {
            state: string;
            import_runs_expired: number;
          },
      );
    const agedOver = (runId: string) =>
      db.query(
        "update import_runs set created_at = now() - interval '8 days', expires_at = now() - interval '1 hour' where id = $1",
        [runId],
      );
    const runStatus = async (runId: string) =>
      (await db.query("select status from import_runs where id = $1", [runId])).rows[0]
        .status as string;

    it("stages a valid workbook with a fingerprint, the totals and the changed-row summary, and keeps archive rows out of the staged table (BR41.3, BR41.10)", async () => {
      const model = await run(
        [
          dirRow(2, {
            Csoport: "Boróka",
            Család: "Mézes család",
            "Szülő neve": "Mézes Márta",
            "E-mail": "marta@example.test",
            Telefon: "+36 20 333 4444",
            Helység: "Pécs",
          }),
          dirRow(3, { Csoport: "Boróka", Család: "Mézes család", "Gyermek neve": "Mézes Máté" }),
          task(2, { Család: "Fenyő család" }),
          archiveRow(2),
          archiveRow(3, ARCHIVE_SHEETS[1]),
        ],
        SUPER_ADMIN,
        "tavaszi-feladatok.xlsx",
      );
      assert.equal(model.state, "success");
      assert.equal(model.reference, model.run_id);
      assert.match(model.fingerprint, /^[0-9a-f]{64}$/);
      assert.equal(model.workbook_name, "tavaszi-feladatok.xlsx");
      assert.deepEqual(
        [model.step, model.model_state, model.total_rows, model.version],
        [5, "preview", 5, 1],
      );
      assert.deepEqual(model.conflicts, []);
      assert.deepEqual(model.changed_rows, ["Boróka csoport: 3 módosítás"]);
      assert.equal(await staged(model.run_id), 3, "the archive rows are not staged");
      const rows = (
        await db.query(
          "select outcome, count(*)::int as n from import_rows where import_run_id = $1 group by 1",
          [model.run_id],
        )
      ).rows;
      assert.deepEqual(rows, [{ outcome: "staged", n: 5 }]);
      assert.deepEqual(
        (await decisions(db, model.run_id)).map((row) => [row.class, row.type]),
        [
          ["create", null],
          ["create", null],
          ["create", null],
        ],
      );
      const stored = (
        await db.query(
          "select status, step, expires_at - created_at as span from import_runs where id = $1",
          [model.run_id],
        )
      ).rows[0];
      assert.deepEqual([stored.status, stored.step], ["previewed", 5]);
      assert.equal(stored.span.days, 7, "the run lives seven days (BR41.8)");
    });

    it("rejects a file name with a path, a malformed row list, an unknown sheet, a repeated row and a non-string cell, and creates no run (BR41.2)", async () => {
      const valid = [dirRow(2, { Csoport: "Boróka", Család: "Mézes család" })];
      const refusals: [string, unknown, string][] = [
        ["kert/terv.xlsx", valid, "field_invalid"],
        ["", valid, "field_invalid"],
        ["terv.xlsx", [], "request_invalid"],
        ["terv.xlsx", { sheet: "x" }, "request_invalid"],
        [
          "terv.xlsx",
          [{ sheet: "Nincs ilyen lap", row: 2, values: { Csoport: "x" } }],
          "request_invalid",
        ],
        [
          "terv.xlsx",
          [{ sheet: valid[0]!.sheet, row: 0, values: { Csoport: "x" } }],
          "request_invalid",
        ],
        ["terv.xlsx", [{ sheet: valid[0]!.sheet, row: 2 }], "request_invalid"],
        [
          "terv.xlsx",
          [{ sheet: valid[0]!.sheet, row: 2, values: { Csoport: 7 } }],
          "request_invalid",
        ],
        [
          "terv.xlsx",
          [{ sheet: valid[0]!.sheet, row: 2, values: { Csoport: "x".repeat(10001) } }],
          "request_invalid",
        ],
        ["terv.xlsx", [...valid, ...valid], "request_invalid"],
        [
          "terv.xlsx",
          [{ sheet: valid[0]!.sheet, row: 2, values: { Csoport: "x" }, warnings: -1 }],
          "request_invalid",
        ],
      ];
      for (const [name, rows, code] of refusals) {
        const result = await call(SUPER_ADMIN, "import_preview_create($1, $2, $3::jsonb)", [
          importKeyOf("bad"),
          name,
          JSON.stringify(rows),
        ]);
        assert.equal(result.state, "validation", name + JSON.stringify(rows).slice(0, 60));
        assert.equal(result.code, code, name + JSON.stringify(rows).slice(0, 60));
      }
      assert.equal((await db.query("select count(*)::int as n from import_runs")).rows[0].n, 0);
      // An archive row never carries content: values sent with one are ignored, not stored.
      const archive = await run([
        { ...archiveRow(2), values: { Titok: "ne mentsd" } } as ParsedRow,
        ...valid,
      ]);
      assert.equal(archive.state, "success");
      assert.equal(await staged(archive.run_id), 1);
    });

    it("keeps the optional profile only with the consent mark 'igen', whatever the parser did (BR41.2)", async () => {
      const model = await run([
        dirRow(2, {
          Csoport: "Boróka",
          Család: "Mézes család",
          "Szülő neve": "Mézes Márta",
          "Opcionális profil": "Szeret főzni.",
          Hozzájárulás: "igen",
        }),
        dirRow(3, {
          Csoport: "Boróka",
          Család: "Mézes család",
          "Szülő neve": "Mézes Mihály",
          "Opcionális profil": "Titok.",
          Hozzájárulás: "nem",
        }),
        dirRow(4, {
          Csoport: "Boróka",
          Család: "Mézes család",
          "Szülő neve": "Mézes Mária",
          "Opcionális profil": "Titok.",
          Hozzájárulás: "",
        }),
      ]);
      const payloads = (
        await db.query(
          "select payload from import_staged_rows s join import_rows r on r.import_run_id = s.import_run_id and r.source_key = s.source_key where s.import_run_id = $1 order by r.row_number",
          [model.run_id],
        )
      ).rows.map((row) => row.payload as Record<string, string>);
      assert.equal(payloads[0]!["Opcionális profil"], "Szeret főzni.");
      assert.equal("Opcionális profil" in payloads[1]!, false);
      assert.equal("Opcionális profil" in payloads[2]!, false);
    });

    it("matches a family by the ordered table: e-mail hit, name hit, differing e-mails, several hits, duplicate in the file, a new family (BR41.4)", async () => {
      const anna = {
        Csoport: "Boróka",
        Család: "Fenyő család",
        "Szülő neve": "Fenyő Anna",
        "E-mail": "anna@example.test",
        Telefon: "+36 30 111 2222",
        Helység: "Pécs",
      };
      const decide = async (rows: ParsedRow[]) => {
        const model = await run(rows);
        return { model, rows: await decisions(db, model.run_id) };
      };

      // Step 1: one e-mail hit is an update; nothing differing is "none".
      let result = await decide([dirRow(2, anna)]);
      assert.deepEqual(
        [result.rows[0]!.class, result.rows[0]!.type, result.rows[0]!.matched],
        ["none", "family", FAMILY_1],
      );
      assert.equal(
        result.rows[0]!.version,
        await familyVersion(FAMILY_1),
        "the version is recorded",
      );
      result = await decide([dirRow(2, { ...anna, Helység: "Mecsek" })]);
      assert.deepEqual([result.rows[0]!.class, result.rows[0]!.matched], ["update", FAMILY_1]);
      assert.deepEqual(result.model.changed_rows, ["Boróka csoport: 1 módosítás"]);

      // Step 2: no e-mail in the file, one family of that name in the group: an update.
      result = await decide([
        dirRow(2, {
          Csoport: "Napraforgó",
          Család: "Napraforgó család",
          "Szülő neve": "Napraforgó Csilla",
        }),
        dirRow(3, {
          Csoport: "Napraforgó",
          Család: "Napraforgó család",
          "Gyermek neve": "Napraforgó Új",
        }),
      ]);
      assert.deepEqual(
        result.rows.map((row) => [row.class, row.matched]),
        [
          ["update", FAMILY_2],
          ["update", FAMILY_2],
        ],
      );
      assert.deepEqual(
        result.rows.map((row) => row.is_leader),
        [true, false],
      );

      // Differing e-mails on a name hit: a conflict, with the family recorded for 'use import'.
      result = await decide([
        dirRow(2, {
          Csoport: "Boróka",
          Család: "Fenyő család",
          "Szülő neve": "Új Szülő",
          "E-mail": "uj@example.test",
        }),
      ]);
      assert.deepEqual(
        [result.rows[0]!.class, result.rows[0]!.message, result.rows[0]!.matched],
        ["conflict", "Az elem már létezik.", FAMILY_1],
      );
      assert.deepEqual(
        result.model.conflicts.map((c) => [c.message, c.skip_only]),
        [["Az elem már létezik.", false]],
      );
      assert.equal(result.model.step, 4);
      assert.equal(result.model.model_state, "conflicts");

      // Two families by e-mail: a conflict nothing can be recorded for.
      result = await decide([
        dirRow(2, {
          Csoport: "Boróka",
          Család: "Vegyes család",
          "Szülő neve": "Vegyes Ági",
          "E-mail": "anna@example.test",
        }),
        dirRow(3, {
          Csoport: "Boróka",
          Család: "Vegyes család",
          "Szülő neve": "Vegyes Béla",
          "E-mail": "csilla@example.test",
        }),
      ]);
      assert.deepEqual(
        [result.rows[0]!.message, result.rows[0]!.matched, result.rows[1]!.message],
        ["Több egyező család.", null, "Több egyező család."],
      );
      assert.equal(
        result.model.conflicts.length,
        1,
        "one conflict for the family, on its first row",
      );

      // The second workbook group that resolves to an already claimed family is a duplicate in the file.
      result = await decide([
        dirRow(2, { ...anna, Helység: "Mecsek" }),
        dirRow(3, {
          Csoport: "Napraforgó",
          Család: "Más család",
          "Szülő neve": "Más Béla",
          "E-mail": "bela@example.test",
        }),
      ]);
      assert.deepEqual(
        result.rows.map((row) => [row.class, row.message, row.matched]),
        [
          ["update", null, FAMILY_1],
          ["conflict", "Ismétlődő sor a fájlban.", FAMILY_1],
        ],
      );

      // Two families of the same name in the group: several hits.
      const twin = (
        await db.query(
          "insert into families (organization_id, display_name) values ($1, 'Fenyő család') returning id",
          [ORGANIZATION],
        )
      ).rows[0].id;
      await db.query(
        "insert into group_memberships (organization_id, family_id, group_id) values ($1, $2, $3)",
        [ORGANIZATION, twin, GROUP_1],
      );
      result = await decide([
        dirRow(2, { Csoport: "Boróka", Család: "Fenyő család", "Szülő neve": "Fenyő Anna" }),
      ]);
      assert.deepEqual(
        [result.rows[0]!.class, result.rows[0]!.message],
        ["conflict", "Több egyező család."],
      );
      await db.query("delete from group_memberships where family_id = $1", [twin]);
      await db.query("delete from families where id = $1", [twin]);

      // A new family; an archived family is not matched (it is out of play), and a group that does not exist is created.
      await db.query("update families set status = 'archived', archived_at = now() where id = $1", [
        FAMILY_1,
      ]);
      result = await decide([
        dirRow(2, anna),
        dirRow(3, { Csoport: "Új csoport", Család: "Csupa új", "Szülő neve": "Új Ági" }),
      ]);
      assert.deepEqual(
        result.rows.map((row) => [row.class, row.matched]),
        [
          ["create", null],
          ["create", null],
        ],
      );
      assert.deepEqual(result.model.changed_rows, [
        "Boróka csoport: 1 módosítás",
        "Új csoport csoport: 1 módosítás",
      ]);

      // Without an active school year no group can be created: the group is unknown.
      await db.query("update school_years set status = 'archived' where organization_id = $1", [
        ORGANIZATION,
      ]);
      result = await decide([dirRow(2, { Csoport: "Boróka", Család: "Mézes család" })]);
      assert.deepEqual(
        [result.rows[0]!.message, result.model.conflicts[0]!.skip_only],
        ["Ismeretlen csoport.", true],
      );
    });

    it("matches a task by group, title and start, decides the assigned family row by row and refuses what cannot be applied (BR41.4)", async () => {
      const existing = await insertTaskAt(db, {
        group: GROUP_1,
        title: "Havi takarítás",
        startsText: START,
        capacity: 2,
      });
      const version = (await db.query("select version from tasks where id = $1", [existing]))
        .rows[0].version as number;
      const decide = async (rows: ParsedRow[]) => {
        const model = await run(rows);
        return { model, rows: await decisions(db, model.run_id) };
      };
      const summary = (rows: Awaited<ReturnType<typeof decisions>>) =>
        rows.map((row) => [row.class, row.message, row.row_conflict]);

      // An existing task with the same values: nothing to do; with a family not yet assigned: an update; a new family on a full task: refused.
      let result = await decide([task(2), task(3, { Család: "Fenyő család" })]);
      assert.deepEqual(summary(result.rows), [
        ["none", null, false],
        ["update", null, false],
      ]);
      assert.deepEqual(
        [result.rows[0]!.type, result.rows[0]!.matched, result.rows[0]!.version],
        ["task", existing, version],
      );
      // The capacity of 2 holds: a repeated family is a no-op, and a third family does not fit.
      const third = (
        await db.query(
          "insert into families (organization_id, display_name) values ($1, 'Harmadik család') returning id",
          [ORGANIZATION],
        )
      ).rows[0].id;
      const fourth = (
        await db.query(
          "insert into families (organization_id, display_name) values ($1, 'Negyedik család') returning id",
          [ORGANIZATION],
        )
      ).rows[0].id;
      await db.query(
        "insert into group_memberships (organization_id, family_id, group_id) values ($1, $2, $4), ($1, $3, $4)",
        [ORGANIZATION, third, fourth, GROUP_1],
      );
      result = await decide([
        task(2, { Család: "Fenyő család" }),
        task(3, { Család: "Fenyő család" }),
        task(4, { Család: "Harmadik család" }),
        task(5, { Család: "Negyedik család" }),
      ]);
      assert.deepEqual(
        summary(result.rows),
        [
          ["update", null, false],
          ["none", null, false],
          ["update", null, false],
          ["conflict", "Hibás adat a sorban.", true],
        ],
        "a repeated family is a no-op",
      );
      // A family of another group, and an unknown one, are row-level conflicts of their own.
      result = await decide([
        task(2, { Család: "Nincs ilyen" }),
        task(3, { Létszám: "1", Család: "Fenyő család" }),
      ]);
      assert.deepEqual(
        result.rows.map((row) => [row.message, row.row_conflict]),
        [
          ["Ismeretlen család.", true],
          [null, false],
        ],
      );
      assert.equal(result.model.conflicts.length, 1);
      assert.match(
        result.model.conflicts[0]!.row_label,
        /^Kinti - benti takarítás 2025-26 · 2\. sor$/,
      );

      // A different capacity or end changes the task; a smaller capacity than the places taken is refused.
      result = await decide([task(2, { Létszám: "4" })]);
      assert.deepEqual(summary(result.rows), [["update", null, false]]);
      await db.query(
        "insert into assignments (organization_id, task_id, family_id, source) values ($1, $2, $3, 'admin_assign')",
        [ORGANIZATION, existing, FAMILY_1],
      );
      await db.query(
        "insert into assignments (organization_id, task_id, family_id, source) values ($1, $2, $3, 'admin_assign')",
        [ORGANIZATION, existing, FAMILY_NO_GROUP],
      );
      result = await decide([task(2, { Létszám: "1" })]);
      assert.deepEqual(summary(result.rows), [["conflict", "Hibás adat a sorban.", false]]);

      // Two tasks of the same title and start cannot be told apart; an unknown group and unusable values are conflicts only a skip resolves.
      await insertTaskAt(db, { group: GROUP_1, title: "Havi takarítás", startsText: START });
      result = await decide([task(2)]);
      assert.deepEqual(
        [result.rows[0]!.message, result.model.conflicts[0]!.skip_only],
        ["Több egyező feladat.", true],
      );
      result = await decide([
        task(2, { Csoport: "Ismeretlen csoport", Feladat: "Máshol" }),
        task(3, { Csoport: "Ismeretlen csoport", Feladat: "Máshol", Család: "Fenyő család" }),
        task(4, { Feladat: "Hibás idő", Kezdés: "holnap" }),
        task(5, { Feladat: "Rossz sorrend", Befejezés: budapestText(11, 9) }),
        task(6, { Feladat: "Nulla fő", Létszám: "0" }),
      ]);
      assert.deepEqual(
        result.rows.map((row) => row.message),
        [
          "Ismeretlen csoport.",
          "Ismeretlen csoport.",
          "Hibás adat a sorban.",
          "Hibás adat a sorban.",
          "Hibás adat a sorban.",
        ],
      );
      assert.equal(
        result.model.conflicts.length,
        4,
        "a conflict per unit (two rows of one task share one)",
      );
      assert.ok(result.model.conflicts.every((conflict) => conflict.skip_only));
    });

    it("lets a task row name a group or family the same workbook creates on its directory sheet, and keeps unknown references conflicts (Amendment A, BR41.4)", async () => {
      const decide = async (rows: ParsedRow[]) => {
        const model = await run(rows);
        return { model, rows: await decisions(db, model.run_id) };
      };
      const summary = (rows: Awaited<ReturnType<typeof decisions>>) =>
        rows.map((row) => [row.class, row.message, row.row_conflict]);
      const newDirectory = dirRow(2, {
        Csoport: "Nefelejcs",
        Család: "Nefelejcs család",
        "Szülő neve": "Nefelejcs Nóra",
      });

      // A group and a family only the file creates: the task and its assignment are decided as new.
      let result = await decide([
        newDirectory,
        task(2, { Csoport: "Nefelejcs", Család: "Nefelejcs család" }),
        task(3, { Csoport: "Nefelejcs", Feladat: "Másik munka" }),
      ]);
      assert.deepEqual(summary(result.rows), [
        ["create", null, false],
        ["create", null, false],
        ["create", null, false],
      ]);
      assert.equal(result.model.conflicts.length, 0);
      assert.equal(result.rows[1]!.type, null, "nothing existing was matched");

      // A new family in an existing group is resolved against the run's own directory rows as well,
      // and two rows of one family on one task count once.
      result = await decide([
        dirRow(2, { Csoport: "Boróka", Család: "Újonnan érkezett család", "Szülő neve": "Új Ági" }),
        task(2, { Család: "Újonnan érkezett család" }),
        task(3, { Család: "Újonnan érkezett család" }),
        task(4, { Feladat: "Más", Család: "Újonnan érkezett család" }),
      ]);
      assert.deepEqual(
        summary(result.rows)
          .map((row) => row[0])
          .sort(),
        ["create", "create", "create", "none"],
        "the repeated family row of one task is a no-op, the rest are new",
      );

      // The family's capacity still counts: a third new family on a task of two places is refused.
      result = await decide([
        dirRow(2, { Csoport: "Boróka", Család: "Egyes család", "Szülő neve": "Egy Egon" }),
        dirRow(3, { Csoport: "Boróka", Család: "Kettes család", "Szülő neve": "Két Kata" }),
        dirRow(4, { Csoport: "Boróka", Család: "Hármas család", "Szülő neve": "Három Hugó" }),
        task(2, { Család: "Egyes család" }),
        task(3, { Család: "Kettes család" }),
        task(4, { Család: "Hármas család" }),
      ]);
      // (the helper lists the task sheet before the directory sheet)
      assert.deepEqual(summary(result.rows).slice(0, 3), [
        ["create", null, false],
        ["create", null, false],
        ["conflict", "Hibás adat a sorban.", true],
      ]);

      // References that exist nowhere are still conflicts: the group, and a family of the group.
      result = await decide([
        newDirectory,
        task(2, { Csoport: "Sehol csoport", Feladat: "Máshol" }),
        task(3, { Csoport: "Nefelejcs", Feladat: "Harmadik", Család: "Nincs ilyen család" }),
        task(4, { Csoport: "Boróka", Feladat: "Negyedik", Család: "Nefelejcs család" }),
      ]);
      assert.deepEqual(
        result.rows.map((row) => row.message),
        ["Ismeretlen csoport.", "Ismeretlen család.", "Ismeretlen család.", null],
        "a family created in another group does not count for this group",
      );

      // A directory unit that is itself a conflict creates nothing the task rows may use.
      result = await decide([
        dirRow(2, {
          Csoport: "Zsálya",
          Család: "Zsálya család",
          "Szülő neve": "Zsálya Zsolt",
          "E-mail": "nem-cim",
        }),
        task(2, { Csoport: "Zsálya", Feladat: "Zsálya munka", Család: "Zsálya család" }),
      ]);
      assert.deepEqual(
        result.rows.map((row) => row.message),
        ["Ismeretlen csoport.", "Hibás adat a sorban."],
      );
    });

    it("keeps one open run per super admin: a second preview cancels the first and deletes its staged rows, a replay returns the same run, and two previews at once leave one (BR41.3, NFR3.14)", async () => {
      const rows = [dirRow(2, { Csoport: "Boróka", Család: "Mézes család" })];
      const key = importKeyOf("same");
      const first = (await call(SUPER_ADMIN, "import_preview_create($1, 'a.xlsx', $2::jsonb)", [
        key,
        JSON.stringify(rows),
      ])) as unknown as PreviewModel;
      const replay = (await call(SUPER_ADMIN, "import_preview_create($1, 'a.xlsx', $2::jsonb)", [
        key,
        JSON.stringify(rows),
      ])) as unknown as PreviewModel;
      assert.deepEqual(
        [replay.state, replay.code, replay.run_id],
        ["success", "replayed", first.run_id],
      );
      const reused = await call(SUPER_ADMIN, "import_preview_create($1, 'b.xlsx', $2::jsonb)", [
        key,
        JSON.stringify(rows),
      ]);
      assert.deepEqual([reused.state, reused.code], ["conflict", "idempotency_key_reused"]);

      const second = await run(rows);
      assert.notEqual(second.run_id, first.run_id);
      const runs = (
        await db.query("select id, status, version from import_runs order by created_at")
      ).rows;
      assert.deepEqual(
        runs.map((row) => row.status),
        ["cancelled", "previewed"],
      );
      assert.equal(await staged(first.run_id), 0);
      assert.equal(await staged(second.run_id), 1);
      // Another super admin's run is untouched.
      const other = await run(rows, SUPER_ADMIN_2);
      assert.equal(
        (await db.query("select count(*)::int as n from import_runs where status = 'previewed'"))
          .rows[0].n,
        2,
      );
      assert.notEqual(other.run_id, second.run_id);

      // Two tabs preview at the same moment: both succeed, exactly one run stays open.
      const connection = await openDatabase();
      extra.push(connection);
      await connection.query(`set search_path to "${schema}", pg_catalog`);
      const results = await Promise.all([
        preview(db, schema, SUPER_ADMIN, rows),
        preview(connection, schema, SUPER_ADMIN, rows),
      ]);
      assert.deepEqual(
        results.map((result) => result.state),
        ["success", "success"],
      );
      assert.equal(
        (
          await db.query(
            "select count(*)::int as n from import_runs where started_by_account_id = $1 and status = 'previewed'",
            [SUPER_ADMIN],
          )
        ).rows[0].n,
        1,
      );
      assert.equal(
        (
          await db.query(
            "select count(*)::int as n from import_staged_rows s join import_runs r on r.id = s.import_run_id where r.started_by_account_id = $1",
            [SUPER_ADMIN],
          )
        ).rows[0].n,
        1,
        "only the open run keeps staged rows",
      );
    });

    it("resolves a conflict on a current run, hands out the new version each time, confirms the run with the last one, and refuses stale, unknown and impossible decisions (BR41.5)", async () => {
      const model = await run([
        dirRow(2, {
          Csoport: "Boróka",
          Család: "Fenyő család",
          "Szülő neve": "Új Szülő",
          "E-mail": "uj@example.test",
        }),
        task(2, { Csoport: "Ismeretlen csoport", Feladat: "Máshol" }),
      ]);
      const [exists, unknown] = model.conflicts;
      assert.equal(model.conflicts.length, 2);
      const first = await resolve(SUPER_ADMIN, model, exists!.id, "keep-existing");
      assert.deepEqual(
        [first.state, first.version, first.model_state, first.step],
        ["success", 2, "conflicts", 4],
      );
      assert.equal(first.conflicts.find((c) => c.id === exists!.id)!.resolution, "keep_existing");

      const stale = await resolve(SUPER_ADMIN, model, unknown!.id, "keep_existing");
      assert.deepEqual([stale.state, stale.code], ["invalidated", "IMPORT_PREVIEW_STALE"]);
      const missingRun = await call(
        SUPER_ADMIN,
        "import_conflict_resolve($1, $2, 1, $3, 'keep_existing')",
        [importKeyOf("r"), uuid(8881), unknown!.id],
      );
      assert.deepEqual(
        [missingRun.state, missingRun.code],
        ["invalidated", "IMPORT_PREVIEW_STALE"],
      );
      for (const [conflict, resolution] of [
        [uuid(8882), "keep_existing"],
        [unknown!.id, "merge"],
        [unknown!.id, ""],
        [unknown!.id, "use_import"],
      ] as const) {
        const refused = await resolve(
          SUPER_ADMIN,
          { run_id: model.run_id, version: first.version },
          conflict,
          resolution,
        );
        assert.deepEqual(
          [refused.state, refused.code],
          ["conflict", "IMPORT_CONFLICT_UNRESOLVED"],
          `${conflict} ${resolution}`,
        );
      }
      assert.equal((await status()).run!.version, 2, "refusals change nothing");

      const second = await resolve(
        SUPER_ADMIN,
        { run_id: model.run_id, version: first.version },
        unknown!.id,
        "keep_existing",
      );
      assert.deepEqual(
        [second.version, second.model_state, second.step, second.run_status],
        [3, "confirmed", 5, "confirmed"],
      );
      // A decision can still be changed on a confirmed run, and use_import is allowed where there is something to import into.
      const changed = await resolve(
        SUPER_ADMIN,
        { run_id: model.run_id, version: second.version },
        exists!.id,
        "use_import",
      );
      assert.deepEqual(
        [changed.state, changed.version, changed.model_state],
        ["success", 4, "confirmed"],
      );
      assert.equal(changed.conflicts.find((c) => c.id === exists!.id)!.resolution, "use_import");

      // The same key replays; a replay does not move the version.
      const key = importKeyOf("again");
      const one = await call(
        SUPER_ADMIN,
        "import_conflict_resolve($1, $2, $3, $4, 'keep_existing')",
        [key, model.run_id, changed.version, exists!.id],
      );
      const two = await call(
        SUPER_ADMIN,
        "import_conflict_resolve($1, $2, $3, $4, 'keep_existing')",
        [key, model.run_id, changed.version, exists!.id],
      );
      assert.deepEqual([one.state, two.state, two.code], ["success", "success", "replayed"]);
      assert.equal((await status()).run!.version, 5);

      // Only the starter: another super admin, a group admin and a parent cannot decide.
      const foreign = await resolve(
        SUPER_ADMIN_2,
        { run_id: model.run_id, version: 5 },
        exists!.id,
        "keep_existing",
      );
      assert.deepEqual([foreign.state, foreign.code], ["invalidated", "IMPORT_PREVIEW_STALE"]);
      for (const account of [ADMIN_G1, PARENT_F1]) {
        const denied = await resolve(
          account,
          { run_id: model.run_id, version: 5 },
          exists!.id,
          "keep_existing",
        );
        assert.deepEqual([denied.state, denied.code], ["denied", "authorization_denied"]);
      }
    });

    it("maps every run state to the screen state and returns the latest run of the asking super admin only (BR41.13)", async () => {
      assert.deepEqual(
        [(await status()).state, (await status()).run],
        ["success", null],
        "no run: the upload form",
      );
      const conflicted = await run([
        dirRow(2, {
          Csoport: "Boróka",
          Család: "Fenyő család",
          "Szülő neve": "Új",
          "E-mail": "uj@example.test",
        }),
      ]);
      let current = (await status()).run!;
      assert.deepEqual(
        [current.run_id, current.model_state, current.step],
        [conflicted.run_id, "conflicts", 4],
      );
      const clean = await run([dirRow(2, { Csoport: "Boróka", Család: "Mézes család" })]);
      current = (await status()).run!;
      assert.deepEqual(
        [current.run_id, current.model_state, current.step, current.total_rows],
        [clean.run_id, "preview", 5, 1],
      );
      assert.equal(
        (await status(SUPER_ADMIN_2)).run,
        null,
        "another super admin sees nothing of it",
      );
      const set = async (statusName: string) => {
        await db.query(
          `update import_runs set status = $2, step = case $2 when 'interrupted' then 6 when 'confirmed' then 5 when 'cancelled' then 5 else 7 end,
                  committed_at = case when $2 in ('committed', 'recovered') then now() else null end where id = $1`,
          [clean.run_id, statusName],
        );
        return (await status()).run;
      };
      assert.equal((await set("confirmed"))!.model_state, "confirmed");
      assert.equal((await set("interrupted"))!.model_state, "interrupted");
      const done = (await set("committed"))!;
      assert.deepEqual([done.model_state, done.step], ["committed", 7]);
      assert.equal((await set("recovered"))!.model_state, "recovered");
      assert.equal(await set("cancelled"), null, "a cancelled run is not returned");
      assert.equal(await set("expired"), null, "an expired run is not returned");
      // A finished run stays visible until the next upload supersedes it.
      await set("committed");
      const next = await run([dirRow(2, { Csoport: "Boróka", Család: "Újabb család" })]);
      assert.equal((await status()).run!.run_id, next.run_id);
      for (const account of [ADMIN_G1, TEACHER_G1, PARENT_F1, OUTSIDER, DEACTIVATED, SIGNED_OUT]) {
        const answer = await status(account);
        assert.deepEqual([answer.state, answer.run], ["denied", undefined], account);
      }
      assert.equal(
        (await status(OTHER_ADMIN)).run,
        null,
        "a super admin of another organization sees nothing",
      );
    });

    it("cancels an open run and deletes its staged rows, answers a repeat, and refuses a finished or foreign run (BR41.8)", async () => {
      const model = await run([dirRow(2, { Csoport: "Boróka", Család: "Mézes család" })]);
      assert.equal(await staged(model.run_id), 1);
      const foreign = await call(SUPER_ADMIN_2, "import_cancel($1)", [model.run_id]);
      assert.deepEqual([foreign.state, foreign.code], ["invalidated", "IMPORT_PREVIEW_STALE"]);
      assert.equal(await staged(model.run_id), 1);
      const cancelled = await call(SUPER_ADMIN, "import_cancel($1)", [model.run_id]);
      assert.deepEqual([cancelled.state, cancelled.run_status], ["success", "cancelled"]);
      assert.equal(await staged(model.run_id), 0, "no personal data is kept");
      assert.equal((await call(SUPER_ADMIN, "import_cancel($1)", [model.run_id])).state, "success");
      assert.equal((await status()).run, null);
      // The history stays: the run and its rows, without personal data.
      assert.equal(
        (
          await db.query("select count(*)::int as n from import_rows where import_run_id = $1", [
            model.run_id,
          ])
        ).rows[0].n,
        1,
      );
      const done = await run([dirRow(2, { Csoport: "Boróka", Család: "Mézes család" })]);
      await db.query(
        "update import_runs set status = 'committed', step = 7, committed_at = now() where id = $1",
        [done.run_id],
      );
      const refused = await call(SUPER_ADMIN, "import_cancel($1)", [done.run_id]);
      assert.deepEqual([refused.state, refused.code], ["invalidated", "IMPORT_PREVIEW_STALE"]);
      for (const account of [ADMIN_G1, PARENT_F1]) {
        assert.equal((await call(account, "import_cancel($1)", [done.run_id])).state, "denied");
      }
    });

    it("expires runs after seven days with a controllable clock, deletes their staged rows, and lets only super admins or the system caller sweep (BR41.8)", async () => {
      const old = await run([dirRow(2, { Csoport: "Boróka", Család: "Mézes család" })]);
      const aged = (runId: string) =>
        db.query(
          "update import_runs set created_at = now() - interval '8 days', expires_at = now() - interval '1 day' where id = $1",
          [runId],
        );
      await aged(old.run_id);
      const fresh = await run(
        [dirRow(2, { Csoport: "Boróka", Család: "Újabb család" })],
        SUPER_ADMIN_2,
      );
      assert.equal(await staged(old.run_id), 1, "nothing expires by itself");
      const swept = await call(SUPER_ADMIN, "import_expire()");
      assert.deepEqual([swept.state, swept.expired], ["success", 1]);
      assert.equal(
        (await db.query("select status from import_runs where id = $1", [old.run_id])).rows[0]
          .status,
        "expired",
      );
      assert.equal(await staged(old.run_id), 0);
      assert.equal(await staged(fresh.run_id), 1, "a run inside its seven days is kept");
      assert.equal(
        (await call(SUPER_ADMIN, "import_expire()")).expired,
        0,
        "a second sweep changes nothing",
      );

      // The status call sweeps first; an interrupted run expires like any other.
      const interrupted = await run([dirRow(2, { Csoport: "Boróka", Család: "Mézes család" })]);
      await mark(SUPER_ADMIN, interrupted);
      await aged(interrupted.run_id);
      assert.equal((await status()).run, null);
      assert.equal(await staged(interrupted.run_id), 0);

      // The system sweep has its own function; the member function refuses other callers and other organizations.
      const system = await asActor(
        db,
        schema,
        { role: "service_role" },
        async () =>
          (await db.query("select import_expire_system($1) as result", [ORGANIZATION])).rows[0]
            .result as { state: string; expired: number },
      );
      assert.deepEqual([system.state, system.expired], ["success", 0]);
      const unknown = await asActor(
        db,
        schema,
        { role: "service_role" },
        async () =>
          (await db.query("select import_expire_system($1) as result", [uuid(8890)])).rows[0]
            .result as { state: string; code: string },
      );
      assert.deepEqual([unknown.state, unknown.code], ["validation", "organization_not_found"]);
      const asUser = await failureOf(() =>
        call(SUPER_ADMIN, "import_expire_system($1)", [ORGANIZATION]),
      );
      assert.equal(asUser?.code, "42501", "a signed-in account cannot call the system function");
      for (const account of [ADMIN_G1, TEACHER_G1, PARENT_F1, OUTSIDER, DEACTIVATED, SIGNED_OUT]) {
        assert.equal((await call(account, "import_expire()")).state, "denied", account);
      }
      assert.equal(
        (await call(SUPER_ADMIN, "import_expire($1)", [uuid(8891)])).code,
        "authorization_denied",
      );
    });

    it("marks an open run interrupted once and refuses recovery for a wrong action, a run that is not interrupted and an expired one (BR41.9)", async () => {
      const model = await run([dirRow(2, { Csoport: "Boróka", Család: "Mézes család" })]);
      const recover = (account: string, runId: string, action: string) =>
        call(account, "import_recover($1, $2, $3)", [importKeyOf("recover"), runId, action]);
      const early = await recover(SUPER_ADMIN, model.run_id, "resume");
      assert.deepEqual(
        [early.state, early.code],
        ["conflict", "IMPORT_RECOVERY_NOT_AVAILABLE"],
        "a run that is not interrupted",
      );
      const foreign = await mark(SUPER_ADMIN_2, model);
      assert.deepEqual([foreign.state, foreign.code], ["invalidated", "IMPORT_PREVIEW_STALE"]);
      const marked = await mark(SUPER_ADMIN, model);
      assert.deepEqual(
        [marked.state, marked.run_status, marked.step, marked.version, marked.model_state],
        ["success", "interrupted", 6, 2, "interrupted"],
      );
      const again = await mark(SUPER_ADMIN, model);
      assert.deepEqual(
        [again.state, again.version],
        ["success", 2],
        "marking twice changes nothing",
      );
      assert.equal(await staged(model.run_id), 1, "the staged rows are kept for the recovery");

      for (const action of ["retry", "", "RESUME", "cancel"]) {
        const invalid = await recover(SUPER_ADMIN, model.run_id, action);
        assert.deepEqual(
          [invalid.state, invalid.code],
          ["conflict", "IMPORT_RECOVERY_ACTION_INVALID"],
          action,
        );
      }
      const other = await recover(SUPER_ADMIN_2, model.run_id, "resume");
      assert.deepEqual(
        [other.state, other.code],
        ["conflict", "IMPORT_RECOVERY_NOT_AVAILABLE"],
        "another admin's run does not exist for them",
      );
      assert.equal((await recover(ADMIN_G1, model.run_id, "resume")).code, "authorization_denied");
      await db.query(
        "update import_runs set created_at = now() - interval '8 days', expires_at = now() - interval '1 minute' where id = $1",
        [model.run_id],
      );
      const expired = await recover(SUPER_ADMIN, model.run_id, "resume");
      assert.deepEqual(
        [expired.state, expired.code],
        ["conflict", "IMPORT_RECOVERY_NOT_AVAILABLE"],
        "the seven days have passed",
      );
      const missing = await recover(SUPER_ADMIN, uuid(8892), "resume");
      assert.equal(missing.code, "IMPORT_RECOVERY_NOT_AVAILABLE");
      await db.query(
        "update import_runs set status = 'committed', committed_at = now(), step = 7 where id = $1",
        [model.run_id],
      );
      assert.equal((await mark(SUPER_ADMIN, model)).code, "IMPORT_PREVIEW_STALE");
    });

    it("removes the staged rows of an abandoned run through the housekeeping, in every organization, without anyone opening the import screen (BR41.8)", async () => {
      const abandoned = await run([dirRow(2, { Csoport: "Boróka", Család: "Mézes család" })]);
      const interrupted = await run(
        [dirRow(2, { Csoport: "Boróka", Család: "Újabb család" })],
        SUPER_ADMIN_2,
      );
      await mark(SUPER_ADMIN_2, interrupted);
      const recent = await run(
        [dirRow(2, { Csoport: "Boróka", Család: "Friss család" })],
        SUPER_ADMIN_3,
      );
      // Another organization's run, inserted directly: the housekeeping looks at every organization.
      const foreignRun = await seedRun(db, OTHER_ADMIN, { organization: OTHER_ORGANIZATION });
      await agedOver(abandoned.run_id);
      await agedOver(interrupted.run_id);
      await agedOver(foreignRun.run);
      assert.equal(await staged(abandoned.run_id), 1, "nothing expires by itself");

      const done = await housekeeping();
      assert.deepEqual([done.state, done.import_runs_expired], ["success", 3]);
      for (const id of [abandoned.run_id, interrupted.run_id, foreignRun.run]) {
        assert.equal(await runStatus(id), "expired", id);
        assert.equal(await staged(id), 0, "its staged rows are gone");
      }
      assert.equal(
        await runStatus(recent.run_id),
        "previewed",
        "a run inside its seven days stays",
      );
      assert.equal(await staged(recent.run_id), 1);
      assert.equal(
        (
          await db.query("select count(*)::int as n from import_rows where import_run_id = $1", [
            abandoned.run_id,
          ])
        ).rows[0].n,
        1,
        "the history (counts and labels) stays",
      );
      assert.equal((await housekeeping()).import_runs_expired, 0, "a second run changes nothing");
      const asUser = await call(SUPER_ADMIN, "identity_housekeeping()").catch(
        (error: { code?: string }) => error,
      );
      assert.equal(
        (asUser as { code?: string }).code,
        "42501",
        "a signed-in account cannot run it",
      );
    });

    it("deletes the staged rows when a commit, a recovery or an interruption finds the run past its seven days, and answers with the stored code (BR41.8)", async () => {
      const expire = async (model: PreviewModel) => {
        await agedOver(model.run_id);
        assert.equal(await staged(model.run_id), 1, "still staged before the call");
      };
      const afterwards = async (model: PreviewModel) => {
        assert.equal(await runStatus(model.run_id), "expired");
        assert.equal(await staged(model.run_id), 0, "no staged row is left");
      };
      const commit = await run([dirRow(2, { Csoport: "Boróka", Család: "Mézes család" })]);
      await expire(commit);
      const refusedCommit = await call(SUPER_ADMIN, "import_commit($1, $2, $3, 'yes')", [
        importKeyOf("late"),
        commit.run_id,
        commit.fingerprint,
      ]);
      assert.deepEqual(
        [refusedCommit.state, refusedCommit.code],
        ["invalidated", "IMPORT_PREVIEW_STALE"],
      );
      await afterwards(commit);

      const recover = await run([dirRow(2, { Csoport: "Boróka", Család: "Mézes család" })]);
      await mark(SUPER_ADMIN, recover);
      await expire(recover);
      const refusedRecover = await call(SUPER_ADMIN, "import_recover($1, $2, 'resume')", [
        importKeyOf("late"),
        recover.run_id,
      ]);
      assert.deepEqual(
        [refusedRecover.state, refusedRecover.code],
        ["conflict", "IMPORT_RECOVERY_NOT_AVAILABLE"],
      );
      await afterwards(recover);

      const marking = await run([dirRow(2, { Csoport: "Boróka", Család: "Mézes család" })]);
      await expire(marking);
      const refusedMark = await mark(SUPER_ADMIN, marking);
      assert.deepEqual(
        [refusedMark.state, refusedMark.code],
        ["invalidated", "IMPORT_PREVIEW_STALE"],
      );
      await afterwards(marking);
    });

    it("interrupts a run only after the commit's own checks: the fingerprint, no open conflict and the confirmation, so a recovery cannot skip them (BR41.9)", async () => {
      const model = await run([dirRow(2, { Csoport: "Boróka", Család: "Mézes család" })]);
      const recover = () =>
        call(SUPER_ADMIN, "import_recover($1, $2, 'resume')", [
          importKeyOf("recover"),
          model.run_id,
        ]);
      for (const [label, args, code] of [
        [
          "no confirmation",
          [model.run_id, model.fingerprint, null],
          "IMPORT_CONFIRMATION_REQUIRED",
        ],
        [
          "a wrong confirmation",
          [model.run_id, model.fingerprint, "no"],
          "IMPORT_CONFIRMATION_REQUIRED",
        ],
        ["no fingerprint", [model.run_id, null, "yes"], "IMPORT_FINGERPRINT_CHANGED"],
        [
          "another fingerprint",
          [model.run_id, "0".repeat(64), "yes"],
          "IMPORT_FINGERPRINT_CHANGED",
        ],
      ] as const) {
        const refused = await call(SUPER_ADMIN, "import_mark_interrupted($1, $2, $3)", [...args]);
        assert.deepEqual([refused.state, refused.code], ["conflict", code], label);
        assert.equal(await runStatus(model.run_id), "previewed", `${label}: the run is untouched`);
        const direct = await recover();
        assert.deepEqual(
          [direct.state, direct.code],
          ["conflict", "IMPORT_RECOVERY_NOT_AVAILABLE"],
          `${label}: nothing to recover`,
        );
      }
      assert.equal(await staged(model.run_id), 1);

      // An open conflict also keeps the run from being interrupted.
      const conflicted = await run(
        [dirRow(2, { Csoport: "Boróka", Család: "Újabb család" })],
        SUPER_ADMIN_2,
      );
      const conflictRow = (
        await db.query("select id from import_rows where import_run_id = $1", [conflicted.run_id])
      ).rows[0].id as string;
      await insertConflict(db, { run: conflicted.run_id, row: conflictRow });
      const open = await mark(SUPER_ADMIN_2, conflicted);
      assert.deepEqual([open.state, open.code], ["conflict", "IMPORT_CONFLICT_UNRESOLVED"]);

      // With all three the run is interrupted, and only then can it be recovered.
      const ok = await mark(SUPER_ADMIN, model);
      assert.deepEqual([ok.state, ok.run_status], ["success", "interrupted"]);
      const resumed = await recover();
      assert.equal(resumed.state, "success", JSON.stringify(resumed));
    });

    it("lets only super admins of the organization call any import function, and no function accepts the service-role key or a signed-out request (BR41.1, NFR1.47)", async () => {
      const model = await run([dirRow(2, { Csoport: "Boróka", Család: "Mézes család" })]);
      const rows = JSON.stringify([dirRow(2, { Csoport: "Boróka", Család: "Mézes család" })]);
      const calls: [string, unknown[]][] = [
        ["import_preview_create($1, 'x.xlsx', $2::jsonb)", [importKeyOf("p"), rows]],
        [
          "import_conflict_resolve($1, $2, 1, $3, 'keep_existing')",
          [importKeyOf("r"), model.run_id, uuid(1)],
        ],
        ["import_commit($1, $2, $3, 'yes')", [importKeyOf("c"), model.run_id, model.fingerprint]],
        ["import_recover($1, $2, 'resume')", [importKeyOf("v"), model.run_id]],
        ["import_status()", []],
        ["import_cancel($1)", [model.run_id]],
        ["import_mark_interrupted($1, $2, 'yes')", [model.run_id, model.fingerprint]],
        ["import_expire()", []],
      ];
      for (const [sql, values] of calls) {
        for (const account of [ADMIN_G1, TEACHER_G1, PARENT_F1, OUTSIDER]) {
          const result = await call(account, sql, values);
          assert.deepEqual(
            [result.state, result.code],
            ["denied", "authorization_denied"],
            `${sql} as ${account}`,
          );
        }
        for (const account of [DEACTIVATED, SIGNED_OUT]) {
          const result = await call(account, sql, values);
          assert.deepEqual(
            [result.state, result.code],
            ["denied", "session_inactive"],
            `${sql} as ${account}`,
          );
        }
        const service = await failureOf(() =>
          asActor(db, schema, { role: "service_role" }, () =>
            db.query(`select ${sql} as result`, values),
          ),
        );
        assert.equal(service?.code, "42501", `${sql} as the service-role key`);
        const anon = await failureOf(() =>
          asActor(db, schema, { role: "anon" }, () => db.query(`select ${sql} as result`, values)),
        );
        assert.equal(anon?.code, "42501", `${sql} signed out`);
      }
      // A super admin of another organization can call, and finds nothing of this organization's run.
      const foreign = await call(OTHER_ADMIN, "import_cancel($1)", [model.run_id]);
      assert.deepEqual([foreign.state, foreign.code], ["invalidated", "IMPORT_PREVIEW_STALE"]);
      assert.equal(await staged(model.run_id), 1);
      assert.equal(TASK_SHEETS.length, 7);
    });
  });
}
