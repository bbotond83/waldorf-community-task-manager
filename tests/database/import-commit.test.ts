import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import {
  ADMIN_G1,
  ASSIGNMENT_F1_T1,
  callFunction,
  FAMILY_1,
  FAMILY_2,
  GROUP_1,
  nextKey,
  openDirectoryDatabase,
  ORGANIZATION,
  PARENT_F1,
  PARENT_F2,
  PARENT_ROW_F2,
  REQUEST_1,
  seedCoordinationWorld,
  seedDirectoryWorld,
  SUPER_ADMIN,
  TASK_1,
  TASK_2,
  uuid,
} from "./directory-support.ts";
import { auditEvents, sessionIdFor } from "./identity-support.ts";
import {
  archiveRow,
  ARCHIVE_SHEETS,
  budapestText,
  decisions,
  dirRow,
  IMPORT_SCHEMAS,
  importKeyOf,
  insertTaskAt,
  type ParsedRow,
  preview,
  type PreviewModel,
  seedImportAccounts,
  SUPER_ADMIN_2,
  TASK_SHEET,
  taskRow,
} from "./import-support.ts";
import { failureOf, openDatabase } from "./stack-support.ts";

const START = budapestText(12, 10);
const END = budapestText(12, 12);
const KERTI_START = budapestText(13, 9);
const KERTI_END = budapestText(13, 11);
const EXISTING_START = budapestText(14, 8);
const EVENT = "Tavaszi nagytakarítás";

type Outcome = PreviewModel & {
  created_rows: number;
  updated_rows: number;
  archived_rows: number;
  run_status: string;
};

/** The fictitious workbook of these tests: 13 rows over both directory and task sheets and archive sheets. */
function workbook(): ParsedRow[] {
  return [
    dirRow(2, {
      Csoport: "Boróka",
      Család: "Mézes család",
      "Szülő neve": "Mézes Márta",
      "E-mail": "Marta@Example.test",
      Telefon: "+36 20 333 4444",
      Helység: "Pécs",
      "Opcionális profil": "Szeret főzni.",
      Hozzájárulás: "igen",
    }),
    dirRow(3, { Csoport: "Boróka", Család: "Mézes család", "Gyermek neve": "Mézes Máté" }),
    dirRow(4, {
      Csoport: "Napraforgó",
      Család: "Napraforgó család",
      "Szülő neve": "Napraforgó Csilla",
    }),
    dirRow(5, {
      Csoport: "Napraforgó",
      Család: "Napraforgó család",
      "Gyermek neve": "Napraforgó Új",
    }),
    dirRow(6, {
      Csoport: "Boróka",
      Család: "Fenyő család",
      "Szülő neve": "Fenyő Anna",
      "E-mail": "anna@example.test",
      Telefon: "+36 30 111 2222",
      Helység: "Pécs",
    }),
    dirRow(7, { Csoport: "Tölgy", Család: "Tölgyes család", "Szülő neve": "Tölgyes Tamás" }),
    taskRow(2, {
      Csoport: "Boróka",
      Esemény: EVENT,
      Feladat: "Havi takarítás",
      Kategória: "takarítás",
      Kezdés: START,
      Befejezés: END,
      Helyszín: "Tornaterem",
      Létszám: "2",
      Család: "Fenyő család",
    }),
    taskRow(3, {
      Csoport: "Boróka",
      Esemény: EVENT,
      Feladat: "Havi takarítás",
      Kezdés: START,
      Befejezés: END,
      Létszám: "2",
      Család: "Hiányzó család",
    }),
    taskRow(4, {
      Csoport: "Boróka",
      Esemény: EVENT,
      Feladat: "Kerti munka",
      Kezdés: KERTI_START,
      Befejezés: KERTI_END,
      Létszám: "3",
    }),
    taskRow(5, {
      Csoport: "Boróka",
      Feladat: "Gyorsjavítás",
      Kezdés: EXISTING_START,
      Befejezés: EXISTING_START.replace(" 08:", " 10:"),
      Létszám: "4",
    }),
    archiveRow(2, ARCHIVE_SHEETS[0]),
    archiveRow(3, ARCHIVE_SHEETS[0]),
    archiveRow(2, ARCHIVE_SHEETS[3]),
  ];
}

/**
 * Import commit on the real stack: counts, codes, re-matching, atomicity, recovery, repeats, races, the audit
 * event and the absence of notices (BR41.6, BR41.9, BR41.10, NFR6.19, NFR6.20, NFR6.26, NFR3.15, NFR1.54,
 * NFR1.55, NFR1.60).
 */
for (const schema of IMPORT_SCHEMAS) {
  describe(`import commit in ${schema}`, () => {
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

    const call = (account: string, sql: string, values: unknown[] = [], client = db) =>
      callFunction(client, schema, account, sql, values);
    const run = (rows: readonly ParsedRow[], account = SUPER_ADMIN, client = db) =>
      preview(client, schema, account, rows);
    const commit = (
      model: Pick<PreviewModel, "run_id" | "fingerprint">,
      options: {
        account?: string;
        confirmation?: string | null;
        fingerprint?: string;
        key?: string;
        client?: pg.Client;
      } = {},
    ) =>
      call(
        options.account ?? SUPER_ADMIN,
        "import_commit($1, $2, $3, $4)",
        [
          options.key ?? importKeyOf("commit"),
          model.run_id,
          options.fingerprint ?? model.fingerprint,
          options.confirmation === undefined ? "yes" : options.confirmation,
        ],
        options.client ?? db,
      ) as Promise<Outcome & { state: string; code: string | null }>;
    const resolveAll = async (model: PreviewModel, resolution = "keep_existing") => {
      let version = model.version;
      let current: PreviewModel = model;
      for (const conflict of model.conflicts) {
        current = (await call(SUPER_ADMIN, "import_conflict_resolve($1, $2, $3, $4, $5)", [
          importKeyOf("res"),
          model.run_id,
          version,
          conflict.id,
          resolution,
        ])) as unknown as PreviewModel;
        assert.equal(current.state, "success");
        version = current.version;
      }
      return current;
    };
    const count = async (sql: string, values: unknown[] = []) =>
      (await db.query(sql, values)).rows[0].n as number;
    const runRow = async (id: string) =>
      (
        await db.query(
          "select status, step, version, imported_rows, skipped_rows, total_rows, committed_at from import_runs where id = $1",
          [id],
        )
      ).rows[0] as {
        status: string;
        step: number;
        version: number;
        imported_rows: number;
        skipped_rows: number;
        total_rows: number;
        committed_at: Date | null;
      };
    /** The state of the data the commit may change, for "nothing happened" comparisons. */
    const snapshot = async () =>
      JSON.stringify(
        (
          await db.query(
            `select (select count(*) from families) as families, (select coalesce(sum(version), 0) from families) as family_versions,
                    (select count(*) from parents) as parents, (select count(*) from children) as children,
                    (select count(*) from groups) as groups, (select count(*) from events) as events,
                    (select count(*) from tasks) as tasks, (select coalesce(sum(version), 0) from tasks) as task_versions,
                    (select count(*) from assignments) as assignments, (select count(*) from reminder_jobs) as jobs,
                    (select count(*) from notifications) as notices, (select count(*) from audit_events) as audit`,
          )
        ).rows[0],
      );
    const keyCount = () => count("select count(*)::int as n from idempotency_records");

    async function world() {
      await insertTaskAt(db, {
        group: GROUP_1,
        title: "Gyorsjavítás",
        startsText: EXISTING_START,
        capacity: 2,
        location: "Kert",
      });
    }

    it("commits a workbook through the save functions and reports the real counts: created, updated, skipped and archived rows (BR41.6, BR41.10)", async () => {
      await world();
      const model = await run(workbook());
      assert.equal(model.state, "success");
      assert.deepEqual(
        model.conflicts.map((c) => c.message),
        ["Ismeretlen család."],
        "Hiányzó család exists nowhere",
      );
      const resolved = await resolveAll(model);
      assert.equal(resolved.model_state, "confirmed");

      const outcome = await commit(resolved);
      assert.deepEqual(
        [outcome.state, outcome.code, outcome.run_status, outcome.step],
        ["success", null, "committed", 7],
      );
      assert.deepEqual(
        [
          outcome.imported_rows,
          outcome.skipped_rows,
          outcome.total_rows,
          outcome.created_rows,
          outcome.updated_rows,
          outcome.archived_rows,
        ],
        [8, 5, 13, 5, 3, 3],
      );
      assert.deepEqual((await runRow(model.run_id)).committed_at !== null, true);
      const rows = (
        await db.query(
          "select sheet, row_number as row, outcome from import_rows where import_run_id = $1 order by sheet, row_number",
          [model.run_id],
        )
      ).rows as { sheet: string; row: number; outcome: string }[];
      assert.deepEqual(
        rows.filter((r) => r.sheet === "Szülők elérhetősége").map((r) => r.outcome),
        ["created", "created", "updated", "updated", "skipped", "created"],
        "family rows: new, updated by name, unchanged, new in a new group",
      );
      assert.deepEqual(
        rows.filter((r) => r.sheet === "Kinti - benti takarítás 2025-26").map((r) => r.outcome),
        ["created", "skipped", "created", "updated"],
        "task rows: the conflicted family row is skipped",
      );
      assert.equal(rows.filter((r) => r.outcome === "archived").length, 3);
      assert.equal(
        await count("select count(*)::int as n from import_staged_rows where import_run_id = $1", [
          model.run_id,
        ]),
        0,
        "the staged rows are gone",
      );

      // The records exist as the file said.
      const family = (
        await db.query(
          "select f.id, f.display_name from families f where f.display_name = 'Mézes család'",
        )
      ).rows;
      assert.equal(family.length, 1);
      const parent = (
        await db.query(
          "select p.display_name, p.optional_profile, p.optional_profile_consent, c.contact_email, c.contact_phone, c.locality from parents p join parent_contacts c on c.parent_id = p.id where p.family_id = $1",
          [family[0].id],
        )
      ).rows;
      assert.deepEqual(parent, [
        {
          display_name: "Mézes Márta",
          optional_profile: "Szeret főzni.",
          optional_profile_consent: true,
          contact_email: "marta@example.test",
          contact_phone: "+36 20 333 4444",
          locality: "Pécs",
        },
      ]);
      assert.equal(
        await count(
          "select count(*)::int as n from children where family_id = $1 and display_name = 'Mézes Máté'",
          [family[0].id],
        ),
        1,
      );
      assert.equal(
        await count(
          "select count(*)::int as n from group_memberships where family_id = $1 and group_id = $2 and status = 'active'",
          [family[0].id, GROUP_1],
        ),
        1,
      );
      assert.equal(
        await count(
          "select count(*)::int as n from children where family_id = $1 and display_name = 'Napraforgó Új'",
          [FAMILY_2],
        ),
        1,
        "the child was added to the existing family",
      );
      assert.equal(
        await count("select count(*)::int as n from children where family_id = $1", [FAMILY_2]),
        2,
        "the existing child stays",
      );
      const group = (
        await db.query("select g.id, g.school_year_id from groups g where g.name = 'Tölgy'")
      ).rows;
      assert.equal(group.length, 1, "the group was created in the active school year");
      assert.equal(
        await count(
          "select count(*)::int as n from group_memberships m join families f on f.id = m.family_id where f.display_name = 'Tölgyes család' and m.group_id = $1",
          [group[0].id],
        ),
        1,
      );

      const tasks = (
        await db.query(
          "select t.title, t.capacity, t.category, t.location, t.status, t.event_id, t.starts_at = ($2::timestamp at time zone 'Europe/Budapest') as starts_ok from tasks t where t.group_id = $1 order by t.title",
          [GROUP_1, START],
        )
      ).rows;
      assert.deepEqual(
        tasks.map((t) => [t.title, t.capacity]),
        [
          ["Gyorsjavítás", 4],
          ["Havi takarítás", 2],
          ["Kerti munka", 3],
        ],
      );
      const havi = tasks.find((t) => t.title === "Havi takarítás");
      assert.deepEqual(
        [havi.category, havi.location, havi.status, havi.starts_ok],
        ["takarítás", "Tornaterem", "open", true],
      );
      assert.equal(
        tasks.find((t) => t.title === "Gyorsjavítás").location,
        "Kert",
        "a column the file leaves empty keeps the task's value",
      );
      const events = (
        await db.query(
          "select e.title, e.starts_at = ($1::timestamp at time zone 'Europe/Budapest') as starts_ok, e.ends_at = ($2::timestamp at time zone 'Europe/Budapest') as ends_ok from events e",
          [START, KERTI_END],
        )
      ).rows;
      assert.deepEqual(
        events,
        [{ title: EVENT, starts_ok: true, ends_ok: true }],
        "one event, spanning its tasks",
      );
      assert.equal(
        await count("select count(*)::int as n from tasks where event_id is not null"),
        2,
      );
      const assignments = (
        await db.query("select a.family_id, a.source, a.status from assignments a")
      ).rows;
      assert.deepEqual(assignments, [{ family_id: FAMILY_1, source: "import", status: "active" }]);
      assert.equal(
        await count("select count(*)::int as n from families where display_name = 'Fenyő család'"),
        1,
        "the unchanged family is not duplicated",
      );

      // The screen's model after the commit.
      const status = (await call(SUPER_ADMIN, "import_status()")) as unknown as { run: Outcome };
      assert.deepEqual(
        [status.run.model_state, status.run.imported_rows, status.run.skipped_rows],
        ["committed", 8, 5],
      );
    });

    it("writes no notice for imported assignments but plans their reminder jobs and recipients, and writes one audit event with counts and the run id only (NFR6.26, BR41.6)", async () => {
      await world();
      const model = await run(workbook());
      await commit(await resolveAll(model));
      assert.equal(
        await count("select count(*)::int as n from notifications"),
        0,
        "no parent receives a notice from an import",
      );
      const jobs = (
        await db.query(
          "select j.threshold, j.status, (select count(*)::int from reminder_recipients r where r.reminder_job_id = j.id and r.status = 'active') as recipients from reminder_jobs j join tasks t on t.id = j.task_id where t.title = 'Havi takarítás' order by j.threshold",
        )
      ).rows;
      assert.deepEqual(jobs, [
        { threshold: "24h", status: "queued", recipients: 1 },
        { threshold: "7d", status: "queued", recipients: 1 },
      ]);
      assert.equal(
        await count(
          "select count(*)::int as n from reminder_jobs j join tasks t on t.id = j.task_id where t.title = 'Kerti munka'",
        ),
        0,
        "a task with no family has no job",
      );

      const events = (await auditEvents(db)).filter((event) => event.action === "import.commit");
      assert.equal(events.length, 1, "exactly one audit event");
      assert.deepEqual(
        [
          events[0]!.actor_account_id,
          events[0]!.actor_role,
          events[0]!.target_type,
          events[0]!.target_id,
          events[0]!.outcome,
          events[0]!.details,
          events[0]!.group_id,
        ],
        [
          SUPER_ADMIN,
          "super_admin",
          "import_run",
          model.run_id,
          "success",
          "imported:8:skipped:5",
          null,
        ],
      );
      const everything = JSON.stringify(await db.query("select * from audit_events"));
      for (const personal of ["Mézes", "Márta", "marta@", "+36 20", "Fenyő", "Tölgy"]) {
        assert.equal(everything.includes(personal), false, `${personal} is not in the audit log`);
      }
      // The reminder tick later creates the reminder notices for the linked parent, as for any assignment.
      await db.query("update reminder_jobs set scheduled_for = now() - interval '1 minute'");
      const tick = await call(PARENT_F1, "reminder_run_due()");
      assert.equal(tick.state, "success");
      assert.ok(
        (await count(
          "select count(*)::int as n from notifications where kind in ('reminder_7d', 'reminder_24h')",
        )) >= 2,
      );
      assert.equal(
        await count(
          "select count(*)::int as n from notifications where kind not in ('reminder_7d', 'reminder_24h')",
        ),
        0,
      );
    });

    it("answers each IMPORT code and changes nothing: stale, fingerprint, open conflict, missing confirmation, other admins (BR41.6, BR42.3)", async () => {
      await world();
      const model = await run(workbook());
      const before = await snapshot();
      const code = async (result: { state: string; code: string | null }) => [
        result.state,
        result.code,
      ];
      assert.deepEqual(await code(await commit(model, { fingerprint: "0".repeat(64) })), [
        "conflict",
        "IMPORT_FINGERPRINT_CHANGED",
      ]);
      assert.deepEqual(await code(await commit(model, { fingerprint: "" })), [
        "conflict",
        "IMPORT_FINGERPRINT_CHANGED",
      ]);
      assert.deepEqual(
        await code(await commit(model)),
        ["conflict", "IMPORT_CONFLICT_UNRESOLVED"],
        "an open conflict blocks the commit",
      );
      const resolved = await resolveAll(model);
      for (const confirmation of [null, "", "no", "YES", "igen"]) {
        assert.deepEqual(
          await code(await commit(resolved, { confirmation })),
          ["conflict", "IMPORT_CONFIRMATION_REQUIRED"],
          String(confirmation),
        );
      }
      assert.deepEqual(
        await code(await commit(resolved, { account: SUPER_ADMIN_2 })),
        ["invalidated", "IMPORT_PREVIEW_STALE"],
        "another super admin's run does not exist for them",
      );
      assert.deepEqual(
        await code(await commit({ run_id: uuid(8801), fingerprint: model.fingerprint })),
        ["invalidated", "IMPORT_PREVIEW_STALE"],
      );
      assert.deepEqual(await code(await commit(resolved, { account: ADMIN_G1 })), [
        "denied",
        "authorization_denied",
      ]);
      assert.equal(await snapshot(), before, "no refusal changed any data");
      assert.equal((await runRow(model.run_id)).status, "confirmed");
      assert.equal(
        (await count("select count(*)::int as n from import_staged_rows where import_run_id = $1", [
          model.run_id,
        ])) > 0,
        true,
      );

      // Tampering with the staged rows after the preview changes the fingerprint the commit recomputes.
      await db.query(
        "update import_staged_rows set payload = jsonb_set(payload, '{Család}', '\"Másik család\"') where source_key like '%:7'",
      );
      assert.deepEqual(await code(await commit(resolved)), [
        "conflict",
        "IMPORT_FINGERPRINT_CHANGED",
      ]);
      assert.equal((await runRow(model.run_id)).status, "confirmed");
    });

    it("re-matches inside the commit: a family added, changed or archived since the preview applies nothing and sends the run back with a new conflict (BR41.6)", async () => {
      await world();
      const rows = [
        dirRow(2, {
          Csoport: "Boróka",
          Család: "Mézes család",
          "Szülő neve": "Mézes Márta",
          "E-mail": "marta@example.test",
        }),
        dirRow(3, {
          Csoport: "Napraforgó",
          Család: "Napraforgó család",
          "Szülő neve": "Napraforgó Csilla",
          Helység: "Mecsek",
        }),
        task(4),
      ];
      function task(row: number) {
        return taskRow(row, {
          Csoport: "Boróka",
          Feladat: "Gyorsjavítás",
          Kezdés: EXISTING_START,
          Befejezés: EXISTING_START.replace(" 08:", " 10:"),
          Létszám: "4",
        });
      }

      // A family with that e-mail is added by hand between preview and commit.
      let model = await run(rows);
      assert.equal(model.conflicts.length, 0);
      const added = (
        await db.query(
          "insert into families (organization_id, display_name) values ($1, 'Kézzel felvett') returning id",
          [ORGANIZATION],
        )
      ).rows[0].id as string;
      await db.query(
        "insert into group_memberships (organization_id, family_id, group_id) values ($1, $2, $3)",
        [ORGANIZATION, added, GROUP_1],
      );
      const parent = (
        await db.query(
          "insert into parents (organization_id, family_id, display_name) values ($1, $2, 'Kézi Kata') returning id",
          [ORGANIZATION, added],
        )
      ).rows[0].id as string;
      await db.query(
        "insert into parent_contacts (parent_id, organization_id, contact_email) values ($1, $2, 'marta@example.test')",
        [parent, ORGANIZATION],
      );
      const baseline = await snapshot();
      let outcome = await commit(model);
      assert.deepEqual([outcome.state, outcome.code], ["conflict", "IMPORT_MATCH_CHANGED"]);
      assert.equal(await snapshot(), baseline, "nothing was applied");
      assert.deepEqual(
        [outcome.run_status, outcome.step, outcome.version, outcome.model_state],
        ["previewed", 4, 2, "conflicts"],
      );
      assert.deepEqual(
        outcome.conflicts.map((c) => [c.message, c.resolution, c.skip_only]),
        [["Az elem megváltozott.", null, false]],
      );
      assert.equal(
        await count("select count(*)::int as n from import_staged_rows where import_run_id = $1", [
          model.run_id,
        ]),
        3,
        "the staged rows stay",
      );
      assert.equal(
        (
          await db.query(
            "select outcome from import_rows where import_run_id = $1 and row_number = 2 and sheet like 'Szülők%'",
            [model.run_id],
          )
        ).rows[0].outcome,
        "conflict",
      );
      // The admin sees the new conflict, decides, and the commit goes through.
      const again = await commit(outcome);
      assert.deepEqual([again.state, again.code], ["conflict", "IMPORT_CONFLICT_UNRESOLVED"]);
      const resolved = await resolveAll(outcome, "use_import");
      assert.equal(resolved.model_state, "confirmed");
      outcome = await commit(resolved);
      assert.deepEqual([outcome.state, outcome.run_status], ["success", "committed"]);
      assert.equal(
        await count("select count(*)::int as n from families where display_name = 'Mézes család'"),
        1,
        "use_import renamed the family that was added by hand",
      );
      assert.equal(
        await count(
          "select count(*)::int as n from families where id = $1 and display_name = 'Mézes család'",
          [added],
        ),
        1,
      );

      // The matched record moves (a version bump) or goes (archived): the same.
      await seedDirectoryWorld(db, schema);
      await seedImportAccounts(db);
      await world();
      model = await run(rows);
      await db.query("update families set display_name = 'Napraforgó család' where id = $1", [
        FAMILY_2,
      ]);
      outcome = await commit(model);
      assert.deepEqual(
        [outcome.state, outcome.code],
        ["conflict", "IMPORT_MATCH_CHANGED"],
        "a version that moved",
      );
      assert.deepEqual(
        outcome.conflicts.map((c) => c.message),
        ["Az elem megváltozott."],
      );
      await seedDirectoryWorld(db, schema);
      await seedImportAccounts(db);
      await world();
      model = await run(rows);
      await db.query("update families set status = 'archived', archived_at = now() where id = $1", [
        FAMILY_2,
      ]);
      outcome = await commit(model);
      assert.deepEqual(
        [outcome.state, outcome.code],
        ["conflict", "IMPORT_MATCH_CHANGED"],
        "a record archived",
      );
      await seedDirectoryWorld(db, schema);
      await seedImportAccounts(db);
      await world();
      model = await run(rows);
      await db.query("update tasks set capacity = 3 where title = 'Gyorsjavítás'");
      outcome = await commit(model);
      assert.deepEqual(
        [outcome.state, outcome.code],
        ["conflict", "IMPORT_MATCH_CHANGED"],
        "a task changed",
      );
    });

    it("honours keep_existing and use_import: keep leaves the record alone, use_import overwrites it or creates a new one (BR41.5, BR41.6)", async () => {
      const clash = [
        dirRow(2, {
          Csoport: "Boróka",
          Család: "Fenyő család",
          "Szülő neve": "Fenyő Új",
          "E-mail": "uj@example.test",
          Helység: "Siklós",
        }),
        dirRow(3, {
          Csoport: "Boróka",
          Család: "Vegyes család",
          "Szülő neve": "Vegyes Ági",
          "E-mail": "anna@example.test",
        }),
        dirRow(4, {
          Csoport: "Boróka",
          Család: "Vegyes család",
          "Szülő neve": "Vegyes Béla",
          "E-mail": "csilla@example.test",
        }),
      ];
      let model = await run(clash);
      assert.deepEqual(
        model.conflicts.map((c) => c.message),
        ["Az elem már létezik.", "Több egyező család."],
      );
      const keep = await commit(await resolveAll(model, "keep_existing"));
      assert.deepEqual([keep.state, keep.imported_rows, keep.skipped_rows], ["success", 0, 3]);
      assert.equal(
        await count("select count(*)::int as n from families"),
        4,
        "no family was created or removed",
      );
      assert.equal(
        await count("select count(*)::int as n from parents where display_name = 'Fenyő Új'"),
        0,
      );

      model = await run(clash);
      const use = await commit(await resolveAll(model, "use_import"));
      assert.deepEqual(
        [use.state, use.imported_rows, use.skipped_rows, use.created_rows, use.updated_rows],
        ["success", 3, 0, 2, 1],
      );
      const fenyo = (
        await db.query(
          "select c.contact_email, c.locality, p.display_name from parents p left join parent_contacts c on c.parent_id = p.id where p.family_id = $1 order by p.display_name",
          [FAMILY_1],
        )
      ).rows;
      assert.ok(
        fenyo.some(
          (row) =>
            row.display_name === "Fenyő Új" &&
            row.contact_email === "uj@example.test" &&
            row.locality === "Siklós",
        ),
        "the existing family was updated with the file's parent",
      );
      assert.ok(
        fenyo.some((row) => row.display_name === "Fenyő Anna"),
        "its other parents stay",
      );
      assert.equal(
        await count("select count(*)::int as n from families where display_name = 'Vegyes család'"),
        1,
        "several matches: use_import creates a new family",
      );
    });

    it("rolls the whole commit back when a save fails midway, run status included, and the same key works once the fault is gone (BR41.6, BR41.9, NFR6.20)", async () => {
      await world();
      const model = await run(workbook());
      const resolved = await resolveAll(model);
      const key = importKeyOf("rollback");
      const before = await snapshot();
      const keysBefore = await keyCount();
      const runBefore = await runRow(model.run_id);
      await inFailingTransaction("tasks", async (execute) => {
        // The families, the group and the event are written before the first task insert fails.
        const failure = await failureOf(() =>
          execute(SUPER_ADMIN, "import_commit($1, $2, $3, 'yes')", [
            key,
            model.run_id,
            resolved.fingerprint,
          ]),
        );
        assert.equal(failure?.code, "XX000", "the error reaches the caller");
        assert.equal(await snapshot(), before, "every earlier write was undone");
        assert.equal(
          await keyCount(),
          keysBefore,
          "no idempotency record of a save function was kept",
        );
        assert.deepEqual(
          await runRow(model.run_id),
          runBefore,
          "the run is exactly as before: status, step, version",
        );
        assert.equal(
          (await count(
            "select count(*)::int as n from import_staged_rows where import_run_id = $1",
            [model.run_id],
          )) > 0,
          true,
        );
        assert.equal(
          (await auditEvents(db)).filter((event) => event.action === "import.commit").length,
          0,
        );
        await db.query("drop trigger injected_failure on tasks");
        const retry = (await execute(SUPER_ADMIN, "import_commit($1, $2, $3, 'yes')", [
          key,
          model.run_id,
          resolved.fingerprint,
        ])) as Outcome & { state: string };
        assert.deepEqual(
          [retry.state, retry.run_status, retry.imported_rows],
          ["success", "committed", 8],
        );
      });
      assert.deepEqual(await runRow(model.run_id), runBefore, "the outer rollback left nothing");
      assert.equal(await snapshot(), before);

      // A failure in a later step (the places) rolls back the same way.
      await inFailingTransaction("assignments", async (execute) => {
        const failure = await failureOf(() =>
          execute(SUPER_ADMIN, "import_commit($1, $2, $3, 'yes')", [
            importKeyOf("late"),
            model.run_id,
            resolved.fingerprint,
          ]),
        );
        assert.equal(failure?.code, "XX000");
        assert.equal(await snapshot(), before);
      });
    });

    it("recovers an interrupted run: the failed commit rolled back, the run is marked interrupted, and 'resume' commits from the staged rows with the same fingerprint (BR41.9)", async () => {
      await world();
      const model = await run(workbook());
      const resolved = await resolveAll(model);
      const before = await snapshot();
      await inFailingTransaction("tasks", async (execute) => {
        const failure = await failureOf(() =>
          execute(SUPER_ADMIN, "import_commit($1, $2, $3, 'yes')", [
            importKeyOf("fail"),
            model.run_id,
            resolved.fingerprint,
          ]),
        );
        assert.equal(failure?.code, "XX000");
        assert.equal(await snapshot(), before);
        const marked = (await execute(SUPER_ADMIN, "import_mark_interrupted($1, $2, 'yes')", [
          model.run_id,
          resolved.fingerprint,
        ])) as Outcome & { state: string };
        assert.deepEqual(
          [marked.state, marked.run_status, marked.step],
          ["success", "interrupted", 6],
        );
        assert.equal(
          (await count(
            "select count(*)::int as n from import_staged_rows where import_run_id = $1",
            [model.run_id],
          )) > 0,
          true,
          "still staged",
        );
        // A plain commit of an interrupted run is refused: the way back is the recovery.
        const direct = (await execute(SUPER_ADMIN, "import_commit($1, $2, $3, 'yes')", [
          importKeyOf("direct"),
          model.run_id,
          resolved.fingerprint,
        ])) as Outcome & { state: string; code: string };
        assert.deepEqual([direct.state, direct.code], ["invalidated", "IMPORT_PREVIEW_STALE"]);
        await db.query("drop trigger injected_failure on tasks");
        const recovered = (await execute(SUPER_ADMIN, "import_recover($1, $2, 'resume')", [
          importKeyOf("recover"),
          model.run_id,
        ])) as Outcome & { state: string };
        assert.deepEqual(
          [
            recovered.state,
            recovered.run_status,
            recovered.step,
            recovered.imported_rows,
            recovered.skipped_rows,
            recovered.fingerprint,
          ],
          ["success", "recovered", 7, 8, 5, resolved.fingerprint],
        );
        assert.equal(
          (await auditEvents(db)).filter((event) => event.action === "import.commit").length,
          1,
          "one audit event for the recovered run",
        );
        assert.equal(
          await count(
            "select count(*)::int as n from import_staged_rows where import_run_id = $1",
            [model.run_id],
          ),
          0,
        );
        const again = (await execute(SUPER_ADMIN, "import_recover($1, $2, 'resume')", [
          importKeyOf("twice"),
          model.run_id,
        ])) as Outcome & { state: string; code: string };
        assert.deepEqual(
          [again.state, again.code],
          ["conflict", "IMPORT_RECOVERY_NOT_AVAILABLE"],
          "a recovered run cannot be recovered again",
        );
      });
    });

    it("commits once for a repeated key or a double click, and a second click with another key finds the run committed (BR41.6, NFR1.55)", async () => {
      await world();
      const model = await run(workbook());
      const resolved = await resolveAll(model);
      const key = importKeyOf("click");
      const first = await commit(resolved, { key });
      const replay = await commit(resolved, { key });
      assert.deepEqual(
        [first.state, first.code, replay.state, replay.code],
        ["success", null, "success", "replayed"],
      );
      assert.deepEqual(
        [replay.imported_rows, replay.skipped_rows, replay.run_status],
        [first.imported_rows, first.skipped_rows, "committed"],
      );
      const other = await commit(resolved);
      assert.deepEqual([other.state, other.code], ["invalidated", "IMPORT_PREVIEW_STALE"]);
      const reused = await commit(
        { run_id: uuid(8802), fingerprint: resolved.fingerprint },
        { key },
      );
      assert.deepEqual([reused.state, reused.code], ["conflict", "idempotency_key_reused"]);
      assert.equal(
        await count("select count(*)::int as n from families where display_name = 'Mézes család'"),
        1,
      );
      assert.equal(
        (await auditEvents(db)).filter((event) => event.action === "import.commit").length,
        1,
      );

      // Two connections click at the same moment with the same key: one commits, the other gets the stored answer.
      await seedDirectoryWorld(db, schema);
      await seedImportAccounts(db);
      await world();
      const second = await openDatabase();
      extra.push(second);
      await second.query(`set search_path to "${schema}", pg_catalog`);
      const model2 = await run(workbook());
      const resolved2 = await resolveAll(model2);
      const same = importKeyOf("double");
      const both = await Promise.all([
        commit(resolved2, { key: same }),
        commit(resolved2, { key: same, client: second }),
      ]);
      assert.deepEqual(
        both.map((result) => result.state),
        ["success", "success"],
      );
      assert.deepEqual(both.map((result) => result.code).sort(), [null, "replayed"].sort());
      // And with two different keys at once: exactly one wins.
      await seedDirectoryWorld(db, schema);
      await seedImportAccounts(db);
      await world();
      const model3 = await run(workbook());
      const resolved3 = await resolveAll(model3);
      const different = await Promise.all([
        commit(resolved3),
        commit(resolved3, { client: second }),
      ]);
      assert.deepEqual(
        different.map((result) => result.code).sort(),
        ["IMPORT_PREVIEW_STALE", null].sort(),
      );
      assert.equal(
        await count("select count(*)::int as n from families where display_name = 'Mézes család'"),
        1,
      );
      assert.equal(
        (await auditEvents(db)).filter((event) => event.action === "import.commit").length,
        1,
      );
    });

    it("commits against a concurrent archive of a matched family or a swap decision on its tasks without a deadlock, and ends consistent (NFR1.54, NFR3.15)", async () => {
      const second = await openDatabase();
      extra.push(second);
      await second.query(`set search_path to "${schema}", pg_catalog`);
      const rows = (suffix: string) => [
        dirRow(2, {
          Csoport: "Boróka",
          Család: "Fenyő család",
          "Szülő neve": "Fenyő Anna",
          "E-mail": "anna@example.test",
          Helység: `Mecsek ${suffix}`,
        }),
        taskRow(3, {
          Csoport: "Boróka",
          Feladat: "Gyorsjavítás",
          Kezdés: EXISTING_START,
          Befejezés: EXISTING_START.replace(" 08:", " 10:"),
          Létszám: "5",
          Család: "Fenyő család",
        }),
      ];
      for (let attempt = 0; attempt < 6; attempt += 1) {
        await seedDirectoryWorld(db, schema);
        await seedImportAccounts(db);
        await world();
        const model = await run(rows(String(attempt)));
        const familyVersion = (
          await db.query("select version from families where id = $1", [FAMILY_1])
        ).rows[0].version as number;
        const results = await Promise.all([
          commit(model),
          call(
            SUPER_ADMIN,
            "family_archive($1, $2, $3)",
            [nextKey("arch"), FAMILY_1, familyVersion],
            second,
          ),
        ]);
        const [committed, archived] = results as [
          Outcome & { state: string; code: string | null },
          { state: string; code: string | null },
        ];
        assert.ok(
          committed.state === "success" || committed.code === "IMPORT_MATCH_CHANGED",
          `attempt ${attempt}: commit answered ${committed.state}/${committed.code}`,
        );
        assert.ok(
          ["success", "conflict"].includes(archived.state),
          `attempt ${attempt}: archive answered ${archived.state}/${archived.code}`,
        );
        if (committed.state === "success") {
          assert.equal(archived.state, "conflict", "the archive saw the family's new version");
          assert.equal(
            await count("select count(*)::int as n from parent_contacts where locality = $1", [
              `Mecsek ${attempt}`,
            ]),
            1,
          );
        } else {
          assert.equal(
            archived.state,
            "success",
            "the archive came first, the commit saw the change",
          );
          assert.equal(
            await count(
              "select count(*)::int as n from families where id = $1 and status = 'archived'",
              [FAMILY_1],
            ),
            1,
          );
        }
        assert.equal(
          await count(
            "select count(*)::int as n from import_runs where status in ('committed', 'previewed')",
          ),
          1,
        );
      }
    });

    it("commits against a swap that exchanges the places of two tasks the import also changes, without a deadlock (NFR1.54, NFR3.15)", async () => {
      const second = await openDatabase();
      extra.push(second);
      await second.query(`set search_path to "${schema}", pg_catalog`);
      const A_F2_T2 = uuid(851);
      const stamp = (id: string) =>
        db
          .query(
            "select to_char(starts_at at time zone 'Europe/Budapest', 'YYYY-MM-DD HH24:MI') as s, to_char(ends_at at time zone 'Europe/Budapest', 'YYYY-MM-DD HH24:MI') as e from tasks where id = $1",
            [id],
          )
          .then((result) => result.rows[0] as { s: string; e: string });
      const outcomes: string[] = [];
      for (let attempt = 0; attempt < 6; attempt += 1) {
        await seedCoordinationWorld(db, schema);
        await seedImportAccounts(db);
        await db.query(
          "insert into group_memberships (organization_id, family_id, group_id) values ($1, $2, $3)",
          [ORGANIZATION, FAMILY_2, GROUP_1],
        );
        await db.query("update change_requests set status = 'withdrawn' where id = $1", [
          REQUEST_1,
        ]);
        await db.query("update assignments set status = 'active' where id = $1", [
          ASSIGNMENT_F1_T1,
        ]);
        await db.query(
          "update tasks set capacity = 3, starts_at = date_trunc('hour', starts_at), ends_at = date_trunc('hour', ends_at) where id in ($1, $2)",
          [TASK_1, TASK_2],
        );
        await db.query(
          "insert into assignments (id, organization_id, task_id, family_id, parent_id, source) values ($1, $2, $3, $4, $5, 'parent_sign_up')",
          [A_F2_T2, ORGANIZATION, TASK_2, FAMILY_2, PARENT_ROW_F2],
        );
        const version = async (table: string, id: string) =>
          (await db.query(`select version from ${table} where id = $1`, [id])).rows[0]
            .version as number;
        const requested = await call(
          PARENT_F1,
          "swap_request($1, $2, $3, $4, $5, 'Időpont-ütközés')",
          [
            nextKey("sw"),
            ASSIGNMENT_F1_T1,
            await version("assignments", ASSIGNMENT_F1_T1),
            A_F2_T2,
            await version("assignments", A_F2_T2),
          ],
        );
        assert.equal(requested.state, "success");
        const one = await stamp(TASK_1);
        const two = await stamp(TASK_2);
        const model = await run([
          taskRow(2, {
            Csoport: "Boróka",
            Feladat: "Sütés",
            Kezdés: one.s,
            Befejezés: one.e,
            Létszám: "5",
          }),
          taskRow(3, {
            Csoport: "Boróka",
            Feladat: "Kerti munka",
            Kezdés: two.s,
            Befejezés: two.e,
            Létszám: "5",
          }),
        ]);
        assert.deepEqual(
          (await decisions(db, model.run_id)).map((row) => row.class),
          ["update", "update"],
        );
        const [committed, responded] = (await Promise.all([
          commit(model),
          call(
            PARENT_F2,
            "swap_respond($1, $2, true, null)",
            [nextKey("rs"), requested.reference],
            second,
          ),
        ])) as [
          Outcome & { state: string; code: string | null },
          { state: string; code: string | null },
        ];
        assert.ok(
          committed.state === "success" || committed.code === "IMPORT_MATCH_CHANGED",
          `commit answered ${committed.state}/${committed.code}`,
        );
        assert.ok(
          ["success", "conflict", "invalidated"].includes(responded.state),
          `respond answered ${responded.state}/${responded.code}`,
        );
        outcomes.push(`${committed.code ?? committed.state}/${responded.state}`);
        if (committed.state === "success") {
          assert.equal(
            await count(
              "select count(*)::int as n from tasks where id in ($1, $2) and capacity = 5",
              [TASK_1, TASK_2],
            ),
            2,
          );
        }
        assert.equal(
          await count("select count(*)::int as n from assignments where status <> 'removed'"),
          4,
          "no place was lost or doubled",
        );
      }
      assert.equal(outcomes.length, 6);
    });

    it("counts a workbook of archive rows only as skipped and applies nothing else, and an empty plan commits cleanly (BR41.10)", async () => {
      const model = await run([
        archiveRow(2, ARCHIVE_SHEETS[0]),
        archiveRow(3, ARCHIVE_SHEETS[1]),
        archiveRow(2, ARCHIVE_SHEETS[8]),
      ]);
      assert.equal(model.step, 5);
      const before = await snapshot();
      const outcome = await commit(model);
      assert.deepEqual(
        [
          outcome.state,
          outcome.run_status,
          outcome.imported_rows,
          outcome.skipped_rows,
          outcome.archived_rows,
        ],
        ["success", "committed", 0, 3, 3],
      );
      const afterwards = JSON.parse(await snapshot()) as Record<string, number>;
      const was = JSON.parse(before) as Record<string, number>;
      assert.deepEqual(
        Object.entries(afterwards).filter(
          ([name, value]) => value !== was[name] && name !== "audit" && name !== "keys",
        ),
        [],
        "no record changed",
      );
      assert.equal(
        await count(
          "select count(*)::int as n from import_rows where import_run_id = $1 and outcome = 'archived'",
          [model.run_id],
        ),
        3,
      );
      assert.equal(
        await count("select count(*)::int as n from import_staged_rows where import_run_id = $1", [
          model.run_id,
        ]),
        0,
      );
      // The committed run is final: nothing in the preview can be changed any more.
      const resolve = await call(
        SUPER_ADMIN,
        "import_conflict_resolve($1, $2, $3, $4, 'keep_existing')",
        [importKeyOf("late"), model.run_id, outcome.version, uuid(1)],
      );
      assert.deepEqual([resolve.state, resolve.code], ["invalidated", "IMPORT_PREVIEW_STALE"]);
      const cancel = await call(SUPER_ADMIN, "import_cancel($1)", [model.run_id]);
      assert.deepEqual([cancel.state, cancel.code], ["invalidated", "IMPORT_PREVIEW_STALE"]);
    });

    it("finds an existing event by group and title instead of creating a second one, reuses a task a second import matches, and a repeated import changes nothing (BR41.4, BR41.6)", async () => {
      await world();
      const first = await run(workbook());
      const outcome = await commit(await resolveAll(first));
      assert.equal(outcome.state, "success");

      // The same workbook again: families are matched, tasks are matched, the event is found. Only the place of
      // Mézes család, which the first import skipped because the family did not exist yet, is new.
      const later = () =>
        workbook().map((row) =>
          row.sheet === TASK_SHEET && row.row === 3
            ? { ...row, values: { ...row.values, Család: "Mézes család" } }
            : row,
        );
      const second = await run(later());
      assert.equal(second.conflicts.length, 0);
      const classes = (await decisions(db, second.run_id)).map((row) => [
        row.sheet.slice(0, 4),
        row.row,
        row.class,
      ]);
      assert.deepEqual(
        classes.filter(([, , cls]) => cls !== "none"),
        [["Kint", 3, "update"]],
        "nothing else differs the second time",
      );
      const again = await commit(second);
      assert.deepEqual(
        [
          again.state,
          again.imported_rows,
          again.skipped_rows,
          again.total_rows,
          again.updated_rows,
        ],
        ["success", 1, 12, 13, 1],
      );
      assert.equal(
        await count("select count(*)::int as n from events"),
        1,
        "the event was found, not created again",
      );
      assert.equal(await count("select count(*)::int as n from tasks"), 3);
      assert.equal(
        await count("select count(*)::int as n from families"),
        6,
        "no family was created again",
      );
      assert.equal(
        await count("select count(*)::int as n from assignments where source = 'import'"),
        2,
      );
      assert.equal(await count("select count(*)::int as n from notifications"), 0);

      // A third time nothing at all changes: the same data, the same versions.
      const settled = await snapshot();
      const versions = (
        await db.query(
          "select (select sum(version) from tasks) as t, (select sum(version) from families) as f, (select sum(version) from assignments) as a",
        )
      ).rows[0];
      const third = await run(later());
      assert.deepEqual(
        (await decisions(db, third.run_id)).map((row) => row.class),
        Array(10).fill("none"),
      );
      const last = await commit(third);
      assert.deepEqual([last.state, last.imported_rows, last.skipped_rows], ["success", 0, 13]);
      assert.equal(
        await snapshot(),
        JSON.stringify({
          ...JSON.parse(settled),
          audit: String(Number(JSON.parse(settled).audit) + 1),
        }),
      );
      assert.deepEqual(
        (
          await db.query(
            "select (select sum(version) from tasks) as t, (select sum(version) from families) as f, (select sum(version) from assignments) as a",
          )
        ).rows[0],
        versions,
        "no record was touched",
      );
      assert.equal(
        (await auditEvents(db)).filter((event) => event.action === "import.commit").length,
        3,
        "one event per committed run",
      );
    });

    it("commits a first import in which the task rows name groups and families the same workbook creates: directory rows first, task rows after, in one commit (Amendment A)", async () => {
      const first = await run([
        dirRow(2, {
          Csoport: "Nefelejcs",
          Család: "Nefelejcs család",
          "Szülő neve": "Nefelejcs Nóra",
          "E-mail": "nora@example.test",
        }),
        dirRow(3, {
          Csoport: "Nefelejcs",
          Család: "Nefelejcs család",
          "Gyermek neve": "Nefelejcs Nándi",
        }),
        dirRow(4, { Csoport: "Boróka", Család: "Újonnan érkezett család", "Szülő neve": "Új Ági" }),
        taskRow(2, {
          Csoport: "Nefelejcs",
          Esemény: EVENT,
          Feladat: "Virágültetés",
          Kezdés: START,
          Befejezés: END,
          Létszám: "2",
          Család: "Nefelejcs család",
        }),
        taskRow(3, {
          Csoport: "Boróka",
          Feladat: "Ajtófestés",
          Kezdés: KERTI_START,
          Befejezés: KERTI_END,
          Létszám: "2",
          Család: "Újonnan érkezett család",
        }),
        taskRow(4, {
          Csoport: "Sehol csoport",
          Feladat: "Árva munka",
          Kezdés: START,
          Befejezés: END,
          Létszám: "1",
        }),
      ]);
      assert.deepEqual(
        first.conflicts.map((c) => c.message),
        ["Ismeretlen csoport."],
        "only the group that exists nowhere is a conflict",
      );
      const resolved = await resolveAll(first);
      const outcome = await commit(resolved);
      assert.deepEqual(
        [outcome.state, outcome.code, outcome.run_status],
        ["success", null, "committed"],
      );
      assert.deepEqual(
        [outcome.created_rows, outcome.updated_rows, outcome.imported_rows, outcome.skipped_rows],
        [5, 0, 5, 1],
      );
      assert.equal(
        await count("select count(*)::int as n from groups where name = 'Nefelejcs'"),
        1,
        "the group was created",
      );
      assert.deepEqual(
        (
          await db.query(
            "select t.title, g.name as grp, f.display_name as family, a.source from tasks t join groups g on g.id = t.group_id join assignments a on a.task_id = t.id join families f on f.id = a.family_id order by t.title",
          )
        ).rows,
        [
          {
            title: "Ajtófestés",
            grp: "Boróka",
            family: "Újonnan érkezett család",
            source: "import",
          },
          { title: "Virágültetés", grp: "Nefelejcs", family: "Nefelejcs család", source: "import" },
        ],
      );
      assert.equal(
        await count("select count(*)::int as n from tasks where title = 'Árva munka'"),
        0,
        "the unknown group's row was skipped",
      );
      assert.equal(await count("select count(*)::int as n from notifications"), 0);
      assert.ok(
        (await count(
          "select count(*)::int as n from reminder_jobs j join tasks t on t.id = j.task_id where t.title = 'Virágültetés'",
        )) > 0,
        "the reminder jobs of the new task were planned",
      );
      assert.equal(
        (await auditEvents(db)).filter((event) => event.action === "import.commit").length,
        1,
      );
    });

    /**
     * Runs `work` in one transaction in which a trigger makes every insert into `table` fail, and rolls the whole
     * transaction back at the end (DDL included). `execute` calls a function as an account and returns its result
     * (a failure is thrown and rolled back to a savepoint, so the transaction stays usable).
     */
    async function inFailingTransaction(
      table: string,
      work: (
        execute: (
          account: string,
          sql: string,
          values: unknown[],
        ) => Promise<Record<string, unknown>>,
      ) => Promise<void>,
    ) {
      await db.query("begin");
      try {
        await db.query(`set local search_path to "${schema}", pg_catalog`);
        await db.query(
          "create function injected_failure() returns trigger language plpgsql as $f$ begin raise exception 'injected failure' using errcode = 'XX000'; end $f$",
        );
        await db.query(
          `create trigger injected_failure before insert on ${table} for each row execute function injected_failure()`,
        );
        const execute = async (account: string, sql: string, values: unknown[]) => {
          await db.query("savepoint attempt");
          try {
            await db.query("set local role authenticated");
            await db.query("select set_config('request.jwt.claims', $1, true)", [
              JSON.stringify({
                sub: account,
                role: "authenticated",
                session_id: sessionIdFor(account),
              }),
            ]);
            await db.query("select set_config('request.jwt.claim.sub', $1, true)", [account]);
            const result = await db.query(`select (${sql}) as result`, values);
            await db.query("reset role");
            await db.query("release savepoint attempt");
            return result.rows[0].result as Record<string, unknown>;
          } catch (error) {
            await db.query("rollback to savepoint attempt");
            await db.query("reset role");
            throw error;
          }
        };
        await work(execute);
      } finally {
        await db.query("rollback");
      }
    }
  });
}
