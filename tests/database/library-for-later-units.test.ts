import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import { DIRECTORY_SCHEMAS, ORGANIZATION, openDirectoryDatabase } from "./directory-support.ts";
import { asServiceRole, callAs } from "./identity-support.ts";
import {
  auditRows,
  BOOK_A,
  BOOK_B,
  BOOK_TYPED,
  BOOK_REMOVED,
  FAMILY_NO_ACCOUNT_LIB,
  FAMILY_REMOVED,
  insertLoan,
  insertWatch,
  loanRows,
  noticeRows,
  PARENT_ROW_NO_ACCOUNT_LIB,
  PARENT_ROW_REMOVED,
  seedBooks,
  seedLibraryWorld,
  watchRows,
} from "./library-support.ts";
import { asActor, failureOf, openDatabase, bindSchema } from "./stack-support.ts";
import {
  PARENT_F1,
  PARENT_ROW_CO,
  PARENT_ROW_F1,
  PARENT_ROW_F2,
  SUPER_ADMIN,
} from "./working-groups-support.ts";

/**
 * What later units call (NFR6.4): the daily return reminder (C9), the removal block U14 runs (C16) and the one-off
 * load of the migration script (C17). All are internal, so the checks call them as the schema owner or the service
 * role; the signed-in roles get no right to any of them.
 */
type Counts = { created: number; skipped: number };

for (const schema of DIRECTORY_SCHEMAS) {
  describe(`library functions for later units in ${schema}`, () => {
    let db: pg.Client;
    let second: pg.Client;
    let year: string;
    let familyF2: string;
    before(async () => {
      db = await openDirectoryDatabase(schema);
      second = await openDatabase();
      await bindSchema(second, schema);
    });
    after(async () => {
      await second.end();
      await db.end();
    });
    beforeEach(async () => {
      await seedLibraryWorld(db, schema);
      await seedBooks(db, PARENT_ROW_F1, PARENT_ROW_F2);
      year = (
        await db.query("select id from school_years where organization_id = $1 limit 1", [
          ORGANIZATION,
        ])
      ).rows[0].id;
      familyF2 = (await db.query("select family_id from parents where id = $1", [PARENT_ROW_F2]))
        .rows[0].family_id;
    });

    // ------------------------------------------------------------------ the daily check
    const dueCheck = async (moment: string, client: pg.Client = db) =>
      (await client.query("select library_due_check($1::timestamptz) as r", [moment])).rows[0]
        .r as Counts;
    const reminders = (parent = PARENT_ROW_F2) => noticeRows(db, parent, "book_return_due");
    /** The year's changeover date, set directly so a window can sit around a clock-change day. */
    const setChangeover = (date: string) =>
      db.query("update school_years set changeover_date = $2 where id = $1", [year, date]);
    const leaving = (family = familyF2, standing = "leaving") =>
      db.query(
        "insert into family_year_standings (organization_id, family_id, school_year_id, standing) values ($1, $2, $3, $4)",
        [ORGANIZATION, family, year, standing],
      );
    const holdBook = (book = BOOK_A, family = familyF2, parent = PARENT_ROW_F2) =>
      insertLoan(db, { book, parent, family });

    it("sends one notice per parent with an account of a leaving family holding a book, from 30 days before the changeover to the day before", async () => {
      await setChangeover("2027-03-15");
      await leaving();
      const loan = await holdBook();
      assert.deepEqual(
        await dueCheck("2027-02-12T12:00:00Z"),
        { created: 0, skipped: 0 },
        "31 days before",
      );
      assert.equal((await reminders()).length, 0);
      assert.deepEqual(
        await dueCheck("2027-02-13T12:00:00Z"),
        { created: 1, skipped: 0 },
        "30 days before",
      );
      const row = (await reminders())[0]!;
      assert.deepEqual([row.target_type, row.target_ref], ["book", BOOK_A]);
      const described = (
        await db.query("select * from notice_describe('book_return_due', 'book', $1, $2)", [
          BOOK_A,
          PARENT_ROW_F2,
        ])
      ).rows[0];
      assert.equal(described.title, "Könyvet vissza kell vinni: A kis herceg");
      assert.equal(described.path, `/szulo/konyvtar/${BOOK_A}`);
      assert.ok(
        String(described.detail ?? described.body ?? "").includes("2027"),
        "the text shows the changeover date",
      );
      assert.equal((await loanRows(db, BOOK_A))[0]!.id, loan, "the loan is untouched");
    });

    it("window ends: the last day before the changeover still sends, the changeover day sends nothing", async () => {
      await setChangeover("2027-03-15");
      await leaving();
      await holdBook();
      assert.equal((await dueCheck("2027-03-14T12:00:00Z")).created, 1);
      await db.query("delete from notifications where kind = 'book_return_due'");
      assert.deepEqual(await dueCheck("2027-03-15T12:00:00Z"), { created: 0, skipped: 0 });
      assert.equal((await reminders()).length, 0);
    });

    it("the clock-change weeks: the window follows Budapest dates, not UTC (spring and autumn)", async () => {
      // Spring: clocks go forward on 2027-03-28 at 02:00. Changeover 29 March, so 28 March is the last day.
      await setChangeover("2027-03-29");
      await leaving();
      await holdBook();
      assert.equal(
        (await dueCheck("2027-03-28T21:30:00Z")).created,
        1,
        "23:30 on the 28th (UTC+2) is in",
      );
      await db.query("delete from notifications where kind = 'book_return_due'");
      assert.equal(
        (await dueCheck("2027-03-28T22:30:00Z")).created,
        0,
        "00:30 on the 29th (UTC+2) is out",
      );
      // Autumn: clocks go back on 2026-10-25 at 03:00. Changeover 26 October.
      await setChangeover("2026-10-26");
      assert.equal(
        (await dueCheck("2026-10-25T22:30:00Z")).created,
        1,
        "23:30 on the 25th (UTC+1) is in",
      );
      await db.query("delete from notifications where kind = 'book_return_due'");
      assert.equal(
        (await dueCheck("2026-10-25T23:30:00Z")).created,
        0,
        "00:30 on the 26th (UTC+1) is out",
      );
      // The first day of the window in each change week.
      assert.equal(
        (await dueCheck("2026-09-25T21:59:00Z")).created,
        0,
        "23:59 on 25 September (UTC+2) is before",
      );
      assert.equal(
        (await dueCheck("2026-09-25T22:00:00Z")).created,
        1,
        "00:00 on 26 September (UTC+2) is in",
      );
    });

    it("a second run the same day, and a later run in the window, send nothing new", async () => {
      await setChangeover("2027-03-15");
      await leaving();
      await holdBook();
      assert.equal((await dueCheck("2027-03-01T08:00:00Z")).created, 1);
      assert.deepEqual(await dueCheck("2027-03-01T08:00:00Z"), { created: 0, skipped: 1 });
      assert.deepEqual(await dueCheck("2027-03-10T08:00:00Z"), { created: 0, skipped: 1 });
      assert.equal((await reminders()).length, 1);
    });

    it("two runs at once send one notice", async () => {
      await setChangeover("2027-03-15");
      await leaving();
      await holdBook();
      const answers = await Promise.all([
        dueCheck("2027-03-01T08:00:00Z", db),
        dueCheck("2027-03-01T08:00:00Z", second),
      ]);
      assert.equal(answers[0]!.created + answers[1]!.created, 1);
      assert.equal((await reminders()).length, 1);
    });

    it("sends nothing for a returned book, a staying or new family, a removed book, or a loan whose link was cleared", async () => {
      await setChangeover("2027-03-15");
      const f1 = (await db.query("select family_id from parents where id = $1", [PARENT_ROW_F1]))
        .rows[0].family_id;
      await leaving(f1);
      await insertLoan(db, {
        book: BOOK_B,
        parent: PARENT_ROW_F1,
        family: f1,
        returnedAt: "2027-02-01T10:00:00Z",
        borrowedAt: "2027-01-01T10:00:00Z",
      });
      await insertLoan(db, { book: BOOK_TYPED, parent: PARENT_ROW_F2, family: familyF2 });
      await insertLoan(db, { book: BOOK_REMOVED, parent: PARENT_ROW_F1, family: f1 });
      await insertLoan(db, { book: BOOK_A, parent: null, family: null });
      assert.deepEqual(
        await dueCheck("2027-03-01T08:00:00Z"),
        { created: 0, skipped: 0 },
        "staying, returned, removed and cleared",
      );
      await db.query("delete from family_year_standings");
      await leaving(familyF2, "new");
      assert.equal((await dueCheck("2027-03-01T08:00:00Z")).created, 0, "a new family is not told");
      assert.equal(await count(db, "notifications", "kind = 'book_return_due'"), 0);
    });

    it("tells only parents with an account; a leaving family with none counts as skipped", async () => {
      await setChangeover("2027-03-15");
      await leaving(FAMILY_NO_ACCOUNT_LIB);
      await insertLoan(db, {
        book: BOOK_A,
        parent: PARENT_ROW_NO_ACCOUNT_LIB,
        family: FAMILY_NO_ACCOUNT_LIB,
      });
      assert.deepEqual(await dueCheck("2027-03-01T08:00:00Z"), { created: 0, skipped: 1 });
    });

    it("is not callable by a signed-in account or the service role directly", async () => {
      for (const actor of [
        { role: "authenticated" as const, account: SUPER_ADMIN },
        { role: "anon" as const },
        asServiceRole,
      ]) {
        const failure = await failureOf(() =>
          asActor(db, schema, actor, () => db.query("select library_due_check(now())")),
        );
        assert.equal(failure?.code, "42501", actor.role);
      }
    });

    it("runs in the daily run after the other checks; a failing run is recorded while the others still run", async () => {
      await setChangeover("2027-03-15");
      await leaving();
      await holdBook();
      const run = () =>
        asActor(
          db,
          schema,
          asServiceRole,
          async () =>
            (
              await db.query("select timed_checks_run_system('daily', $1::timestamptz) as r", [
                "2027-03-01T08:00:00Z",
              ])
            ).rows[0].r as {
              checks: {
                check: string;
                outcome: string;
                created: number;
                error_code: string | null;
              }[];
            },
        );
      const ok = await run();
      const names = ok.checks.map((check) => check.check);
      assert.ok(names.includes("library_return_due"), "the check is part of the daily run");
      assert.equal(ok.checks.find((check) => check.check === "library_return_due")!.created, 1);
      await db.query("delete from notifications where kind = 'book_return_due'");
      await db.query(
        "create function lib_block_notice() returns trigger language plpgsql as $f$ begin raise exception 'blocked'; end $f$",
      );
      await db.query(
        "create trigger lib_block_notice before insert on notifications for each row execute function lib_block_notice()",
      );
      try {
        const broken = await run();
        const mine = broken.checks.find((check) => check.check === "library_return_due")!;
        assert.equal(mine.outcome, "failed");
        assert.ok(
          broken.checks.some(
            (check) => check.check !== "library_return_due" && check.outcome === "success",
          ),
          "the other checks ran",
        );
      } finally {
        await db.query("drop trigger lib_block_notice on notifications");
        await db.query("drop function lib_block_notice()");
      }
      assert.equal(
        (
          await db.query(
            "select count(*)::int as n from timed_check_runs where check_name = 'library_return_due' and outcome = 'failed'",
          )
        ).rows[0].n >= 1,
        true,
      );
    });

    // ------------------------------------------------------------------ the removal block
    const preview = async (kind: string, id: string) =>
      (await db.query("select library_removal_preview($1, $2) as r", [kind, id])).rows[0].r as {
        to_clear: number;
        to_flag: number;
        held_loan_ids: string[];
      };
    const apply = async (kind: string, id: string) =>
      (await db.query("select library_removal_apply($1, $2) as r", [kind, id])).rows[0].r as {
        to_clear: number;
        to_flag: number;
        held_loan_ids: string[];
      };

    /** The second family's parent owns book B, asked to be told about A, borrowed A once and still holds the typed book. */
    async function seedRemoval() {
      const closed = await insertLoan(db, {
        book: BOOK_A,
        parent: PARENT_ROW_F2,
        family: familyF2,
        returnedAt: "2027-01-02T10:00:00Z",
        borrowedAt: "2027-01-01T10:00:00Z",
      });
      const open = await insertLoan(db, {
        book: BOOK_TYPED,
        parent: PARENT_ROW_F2,
        family: familyF2,
      });
      const other = await insertLoan(db, {
        book: BOOK_A,
        parent: PARENT_ROW_F1,
        family: (await db.query("select family_id from parents where id = $1", [PARENT_ROW_F1]))
          .rows[0].family_id,
      });
      await insertWatch(db, BOOK_A, PARENT_ROW_F2);
      await insertWatch(db, BOOK_A, PARENT_ROW_CO);
      return { closed, open, other };
    }

    for (const kind of ["parent", "family"] as const) {
      it(`removal of a ${kind}: the preview says what the apply does; watches and owner links go, closed loans lose the borrower, the open loan is flagged and left`, async () => {
        const { closed, open } = await seedRemoval();
        const subject = kind === "parent" ? PARENT_ROW_F2 : familyF2;
        const expected = await preview(kind, subject);
        assert.deepEqual(
          [expected.to_clear, expected.to_flag, expected.held_loan_ids],
          [3, 1, [open]],
        );
        const before = (await auditRows(db, "library_removal_applied")).length;
        const done = await apply(kind, subject);
        assert.deepEqual(done, expected);
        assert.deepEqual(
          await watchRows(db, BOOK_A),
          [PARENT_ROW_CO],
          "only the removed person's request goes",
        );
        const closedRow = (
          await db.query("select borrower_parent_id, borrower_family_id from loans where id = $1", [
            closed,
          ])
        ).rows[0];
        assert.deepEqual(
          [closedRow.borrower_parent_id, closedRow.borrower_family_id],
          [null, null],
        );
        const openRow = (
          await db.query("select borrower_parent_id, returned_at from loans where id = $1", [open])
        ).rows[0];
        assert.deepEqual(
          [openRow.borrower_parent_id, openRow.returned_at],
          [PARENT_ROW_F2, null],
          "the open loan stays",
        );
        assert.equal(
          (await db.query("select owner_parent_id from books where id = $1", [BOOK_B])).rows[0]
            .owner_parent_id,
          null,
        );
        const audits = await auditRows(db, "library_removal_applied");
        assert.equal(audits.length - before, 1);
        assert.equal(audits[audits.length - 1]!.details, "cleared:3:flagged:1");
        assert.equal(JSON.stringify(done).includes("Mese"), false, "no title in the answer");
      });
    }

    it("removal of a subject that holds nothing, an unknown id and another kind all give zero counts", async () => {
      assert.deepEqual(await apply("parent", PARENT_ROW_REMOVED), {
        to_clear: 0,
        to_flag: 0,
        held_loan_ids: [],
      });
      assert.deepEqual(await apply("parent", "99999999-0000-4000-8000-000000000999"), {
        to_clear: 0,
        to_flag: 0,
        held_loan_ids: [],
      });
      assert.deepEqual(await apply("group", familyF2), {
        to_clear: 0,
        to_flag: 0,
        held_loan_ids: [],
      });
      assert.deepEqual(await preview("family", FAMILY_REMOVED), {
        to_clear: 0,
        to_flag: 0,
        held_loan_ids: [],
      });
    });

    it("running the removal twice finds nothing the second time", async () => {
      await seedRemoval();
      await apply("family", familyF2);
      const again = await apply("family", familyF2);
      assert.equal(again.to_clear, 0);
      assert.equal(again.to_flag, 1, "the held loan is still reported");
    });

    it("a failure midway rolls the whole removal back", async () => {
      await seedRemoval();
      await db.query(
        "create function lib_block_audit() returns trigger language plpgsql as $f$ begin if new.action = 'library_removal_applied' then raise exception 'blocked'; end if; return new; end $f$",
      );
      await db.query(
        "create trigger lib_block_audit before insert on audit_events for each row execute function lib_block_audit()",
      );
      try {
        assert.ok(await failureOf(() => apply("family", familyF2)));
      } finally {
        await db.query("drop trigger lib_block_audit on audit_events");
        await db.query("drop function lib_block_audit()");
      }
      assert.equal((await watchRows(db, BOOK_A)).length, 2);
      assert.equal(
        (await db.query("select owner_parent_id from books where id = $1", [BOOK_B])).rows[0]
          .owner_parent_id,
        PARENT_ROW_F2,
      );
    });

    it("two removals of the same family at once end consistent", async () => {
      await seedRemoval();
      await Promise.all([
        apply("family", familyF2),
        second.query("select library_removal_apply('family', $1)", [familyF2]),
      ]);
      assert.deepEqual(await watchRows(db, BOOK_A), [PARENT_ROW_CO]);
    });

    it("is not callable by a signed-in account or the service role", async () => {
      for (const actor of [
        { role: "authenticated" as const, account: SUPER_ADMIN },
        { role: "authenticated" as const, account: PARENT_F1 },
        asServiceRole,
      ]) {
        for (const call of [
          "library_removal_preview('parent', $1)",
          "library_removal_apply('parent', $1)",
        ]) {
          const failure = await failureOf(() =>
            asActor(db, schema, actor, () => db.query(`select ${call}`, [PARENT_ROW_F2])),
          );
          assert.equal(failure?.code, "42501", call);
        }
      }
    });

    // ------------------------------------------------------------------ the one-off load
    const load = (source: string, book: unknown, actor = asServiceRole) =>
      callAs(db, schema, actor, "migration_load_book($1, $2, $3::jsonb)", [
        source,
        ORGANIZATION,
        JSON.stringify(book),
      ]);
    const typed = {
      title: "Betöltött mese",
      authors: "Kitalált Szerző",
      description: "Leírás",
      owner_name: "Kitalált Gazda",
    };

    it("loads a book with a typed owner as available and creates nothing the second time", async () => {
      const first = await load("sor-1", typed);
      assert.equal(first.state, "success", JSON.stringify(first));
      const row = (
        await db.query(
          "select title, authors, owner_name, owner_parent_id, removed_at, source_key from books where id = $1",
          [first.reference],
        )
      ).rows[0];
      assert.deepEqual(row, {
        title: "Betöltött mese",
        authors: "Kitalált Szerző",
        owner_name: "Kitalált Gazda",
        owner_parent_id: null,
        removed_at: null,
        source_key: "sor-1",
      });
      assert.equal((await loanRows(db, first.reference!)).length, 0);
      const again = await load("sor-1", typed);
      assert.deepEqual(
        [again.state, again.code, again.reference],
        ["success", "replayed", first.reference],
      );
      assert.equal(await count(db, "books", "source_key = 'sor-1'"), 1);
    });

    it("loads a book owned by an active parent of the loaded directory, and refuses an unknown, archived or other-community parent", async () => {
      const ok = await load("sor-2", {
        title: "Szülői könyv",
        authors: "Szerző",
        owner_parent_id: PARENT_ROW_F1,
      });
      assert.equal(ok.state, "success");
      assert.equal(
        (await db.query("select owner_parent_id from books where id = $1", [ok.reference])).rows[0]
          .owner_parent_id,
        PARENT_ROW_F1,
      );
      const unknown = await load("sor-3", {
        title: "T",
        authors: "A",
        owner_parent_id: "99999999-0000-4000-8000-000000000999",
      });
      assert.deepEqual([unknown.state, unknown.field], ["validation", "owner_parent_id"]);
      const archived = await load("sor-4", {
        title: "T",
        authors: "A",
        owner_parent_id: PARENT_ROW_REMOVED,
      });
      assert.deepEqual([archived.state, archived.field], ["validation", "owner_parent_id"]);
      assert.equal(await count(db, "books", "source_key in ('sor-3', 'sor-4')"), 0);
    });

    it("names the field of a bad row and never its value, and the next row is unaffected", async () => {
      const cases: [string, unknown, string][] = [
        ["sor-5", { ...typed, title: "" }, "title"],
        ["sor-6", { ...typed, authors: "x".repeat(201) }, "authors"],
        ["sor-7", { ...typed, description: "d".repeat(1001) }, "description"],
        ["sor-8", { title: "T", authors: "A" }, "owner"],
        ["sor-9", { ...typed, owner_parent_id: PARENT_ROW_F1 }, "owner"],
        ["sor-10", { ...typed, owner_name: "n".repeat(201) }, "owner_name"],
      ];
      for (const [key, body, field] of cases) {
        const refused = await load(key, body);
        assert.deepEqual([refused.state, refused.field], ["validation", field], key);
        assert.equal(
          JSON.stringify(refused).includes("Kitalált"),
          false,
          "no cell value in the answer",
        );
      }
      assert.equal((await load("sor-11", typed)).state, "success");
      assert.equal((await load("sor-12", [] as unknown)).state, "validation");
    });

    it("is for the service role only: every signed-in role is refused and nothing is created", async () => {
      for (const account of [SUPER_ADMIN, PARENT_F1]) {
        const failure = await failureOf(() =>
          callAs(
            db,
            schema,
            { role: "authenticated", account },
            "migration_load_book($1, $2, $3::jsonb)",
            ["sor-13", ORGANIZATION, JSON.stringify(typed)],
          ),
        );
        assert.ok(failure === undefined || failure.code === "42501");
      }
      const anon = await failureOf(() =>
        callAs(db, schema, { role: "anon" }, "migration_load_book($1, $2, $3::jsonb)", [
          "sor-13",
          ORGANIZATION,
          JSON.stringify(typed),
        ]),
      );
      assert.equal(anon?.code, "42501");
      assert.equal(await count(db, "books", "source_key = 'sor-13'"), 0);
    });
  });
}

async function count(db: pg.Client, table: string, where = "true"): Promise<number> {
  return (await db.query(`select count(*)::int as n from ${table} where ${where}`)).rows[0]
    .n as number;
}
