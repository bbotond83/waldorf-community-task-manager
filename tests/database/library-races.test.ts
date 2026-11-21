import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import { DIRECTORY_SCHEMAS, nextKey, openDirectoryDatabase } from "./directory-support.ts";
import {
  auditRows,
  BOOK_A,
  BOOK_TYPED,
  bookRow,
  caller,
  insertLoan,
  insertWatch,
  loanRows,
  noticeRows,
  PARENT_ROW_SUPER,
  seedBooks,
  seedLibraryWorld,
  watchRows,
} from "./library-support.ts";
import { openDatabase } from "./stack-support.ts";
import {
  ADMIN_G1,
  PARENT_F1,
  PARENT_F2,
  PARENT_ROW_ADMIN_G1,
  PARENT_ROW_CO,
  PARENT_ROW_F1,
  PARENT_ROW_F2,
  SUPER_ADMIN,
  CO_PARENT_F1,
} from "./working-groups-support.ts";

/**
 * The races of U13 (NFR5.2 to NFR5.6): two callers at once on separate connections, so the book lock (not a
 * client-side queue) decides who passes. Every case repeats 20 times; a deadlock would fail the run.
 */
const RUNS = 20;
type Answer = { state: string; code?: string | null };

for (const schema of DIRECTORY_SCHEMAS) {
  describe(`library races in ${schema}`, () => {
    let db: pg.Client;
    let one: pg.Client;
    let two: pg.Client;
    before(async () => {
      db = await openDirectoryDatabase(schema);
      one = await openDatabase();
      two = await openDatabase();
    });
    after(async () => {
      await one.end();
      await two.end();
      await db.end();
    });
    beforeEach(async () => {
      await seedLibraryWorld(db, schema);
      await seedBooks(db, PARENT_ROW_F1, PARENT_ROW_F2);
    });

    const on = (connection: pg.Client) => caller(() => connection, schema);
    const version = async (book: string) => (await bookRow(db, book))!.version;
    /** Clears the loans, the requests and the notices of the book so a run starts clean. */
    async function reset(book: string) {
      await db.query("delete from return_watches where book_id = $1", [book]);
      await db.query("delete from loans where book_id = $1", [book]);
      await db.query("update books set removed_at = null where id = $1", [book]);
    }
    const both = <T>(a: () => Promise<T>, b: () => Promise<T>) => Promise.all([a(), b()]);
    const successes = (answers: Answer[]) =>
      answers.filter((answer) => answer.state === "success").length;

    it("two borrows at once: one wins, the other gets BOOK_NOT_AVAILABLE or VERSION_CONFLICT, one open loan remains", async () => {
      for (let run = 0; run < RUNS; run += 1) {
        await reset(BOOK_A);
        const v = await version(BOOK_A);
        const answers = await both(
          () =>
            on(one)(PARENT_F2, "library_book_borrow($1, $2, $3, null)", [nextKey("r"), BOOK_A, v]),
          () =>
            on(two)(ADMIN_G1, "library_book_borrow($1, $2, $3, null)", [nextKey("r"), BOOK_A, v]),
        );
        assert.equal(successes(answers), 1, `run ${run}`);
        const loser = answers.find((answer) => answer.state !== "success")!;
        assert.ok(
          ["BOOK_NOT_AVAILABLE", "VERSION_CONFLICT"].includes(loser.code ?? ""),
          loser.code ?? undefined,
        );
        assert.equal(
          (await loanRows(db, BOOK_A)).filter((loan) => loan.returned_at === null).length,
          1,
        );
      }
    });

    it("two returns at once: one wins, the other is refused, and the watchers are told once", async () => {
      for (let run = 0; run < RUNS; run += 1) {
        await reset(BOOK_A);
        await db.query("delete from notifications where kind = 'book_returned'");
        await insertLoan(db, {
          book: BOOK_A,
          parent: PARENT_ROW_F2,
          family: (await db.query("select family_id from parents where id = $1", [PARENT_ROW_F2]))
            .rows[0].family_id,
        });
        await insertWatch(db, BOOK_A, PARENT_ROW_CO);
        await db.query("update books set updated_at = now() where id = $1", [BOOK_A]);
        const v = await version(BOOK_A);
        const answers = await both(
          () => on(one)(PARENT_F1, "library_book_return($1, $2, $3)", [nextKey("r"), BOOK_A, v]),
          () => on(two)(PARENT_F1, "library_book_return($1, $2, $3)", [nextKey("r"), BOOK_A, v]),
        );
        assert.equal(successes(answers), 1, `run ${run}`);
        const loser = answers.find((answer) => answer.state !== "success")!;
        assert.ok(
          ["BOOK_NOT_ON_LOAN", "VERSION_CONFLICT"].includes(loser.code ?? ""),
          loser.code ?? undefined,
        );
        assert.equal((await noticeRows(db, PARENT_ROW_CO, "book_returned")).length, 1);
      }
    });

    it("the owner and a super admin return at once: only the owner may, so exactly one return and one refusal", async () => {
      for (let run = 0; run < RUNS; run += 1) {
        await reset(BOOK_A);
        await insertLoan(db, {
          book: BOOK_A,
          parent: PARENT_ROW_F2,
          family: (await db.query("select family_id from parents where id = $1", [PARENT_ROW_F2]))
            .rows[0].family_id,
        });
        await db.query("update books set updated_at = now() where id = $1", [BOOK_A]);
        const v = await version(BOOK_A);
        const answers = await both(
          () => on(one)(PARENT_F1, "library_book_return($1, $2, $3)", [nextKey("r"), BOOK_A, v]),
          () => on(two)(SUPER_ADMIN, "library_book_return($1, $2, $3)", [nextKey("r"), BOOK_A, v]),
        );
        assert.deepEqual(
          answers.map((answer) => answer.state).sort(),
          ["denied", "success"],
          `run ${run}`,
        );
      }
    });

    it("a super admin and the typed owner's book: two super-admin returns at once give one return, one audit entry", async () => {
      for (let run = 0; run < RUNS; run += 1) {
        await reset(BOOK_TYPED);
        const before = (await auditRows(db, "library_book_returned_by_admin")).length;
        await insertLoan(db, {
          book: BOOK_TYPED,
          parent: PARENT_ROW_F2,
          family: (await db.query("select family_id from parents where id = $1", [PARENT_ROW_F2]))
            .rows[0].family_id,
        });
        await db.query("update books set updated_at = now() where id = $1", [BOOK_TYPED]);
        const v = await version(BOOK_TYPED);
        const answers = await both(
          () =>
            on(one)(SUPER_ADMIN, "library_book_return($1, $2, $3)", [nextKey("r"), BOOK_TYPED, v]),
          () =>
            on(two)(SUPER_ADMIN, "library_book_return($1, $2, $3)", [nextKey("r"), BOOK_TYPED, v]),
        );
        assert.equal(successes(answers), 1, `run ${run}`);
        assert.equal((await auditRows(db, "library_book_returned_by_admin")).length - before, 1);
      }
    });

    for (const order of ["watch wins the lock", "return wins the lock"] as const) {
      it(`a return and a request to be told at once (${order}): the request is either told and ended, or refused as BOOK_AVAILABLE`, async () => {
        for (let run = 0; run < RUNS; run += 1) {
          await reset(BOOK_A);
          await db.query("delete from notifications where kind = 'book_returned'");
          await insertLoan(db, {
            book: BOOK_A,
            parent: PARENT_ROW_F2,
            family: (await db.query("select family_id from parents where id = $1", [PARENT_ROW_F2]))
              .rows[0].family_id,
          });
          await db.query("update books set updated_at = now() where id = $1", [BOOK_A]);
          const v = await version(BOOK_A);
          const ret = () =>
            on(one)(PARENT_F1, "library_book_return($1, $2, $3)", [nextKey("r"), BOOK_A, v]);
          const ask = () =>
            on(two)(CO_PARENT_F1, "library_watch_add($1, $2)", [nextKey("r"), BOOK_A]);
          const [returned, asked] =
            order === "watch wins the lock"
              ? (await Promise.all([ask(), ret()])).reverse()
              : await both(ret, ask);
          assert.equal(returned.state, "success", `run ${run}`);
          const told = (await noticeRows(db, PARENT_ROW_CO, "book_returned")).length;
          if (asked.state === "success") {
            assert.equal(told, 1, "asked before the return: told once");
          } else {
            assert.equal(asked.code, "BOOK_AVAILABLE");
            assert.equal(told, 0);
          }
          assert.deepEqual(await watchRows(db, BOOK_A), [], "no request outlives the return");
        }
      });
    }

    for (const order of ["borrow first", "removal first"] as const) {
      it(`a removal and a borrow at once (${order}): never a removed book on loan`, async () => {
        for (let run = 0; run < RUNS; run += 1) {
          await reset(BOOK_A);
          const v = await version(BOOK_A);
          const borrow = () =>
            on(one)(PARENT_F2, "library_book_borrow($1, $2, $3, null)", [nextKey("r"), BOOK_A, v]);
          const remove = () =>
            on(two)(PARENT_F1, "library_book_remove($1, $2, $3)", [nextKey("r"), BOOK_A, v]);
          const answers =
            order === "borrow first"
              ? await both(borrow, remove)
              : (await both(remove, borrow)).reverse();
          const [borrowed, removed] = answers;
          const book = (await bookRow(db, BOOK_A))!;
          const open = (await loanRows(db, BOOK_A)).filter((loan) => loan.returned_at === null);
          assert.equal(
            borrowed.state === "success" && removed.state === "success",
            false,
            `run ${run}: both cannot win`,
          );
          assert.equal(
            book.removed_at !== null && open.length > 0,
            false,
            "a removed book is never on loan",
          );
          assert.equal(successes([borrowed, removed]) <= 1, true);
        }
      });
    }

    it("a borrow and the owner changing the book at once: the borrow either carries the old version or is refused as outdated", async () => {
      for (let run = 0; run < RUNS; run += 1) {
        await reset(BOOK_A);
        const v = await version(BOOK_A);
        const answers = await both(
          () =>
            on(one)(PARENT_F2, "library_book_borrow($1, $2, $3, null)", [nextKey("r"), BOOK_A, v]),
          () =>
            on(two)(
              PARENT_F1,
              "library_book_change($1, $2, $3, 'A kis herceg', 'Saint-Exupéry', $4)",
              [nextKey("r"), BOOK_A, v, `Leírás ${run}`],
            ),
        );
        assert.ok(successes(answers) >= 1, `run ${run}`);
        assert.equal(
          (await loanRows(db, BOOK_A)).filter((loan) => loan.returned_at === null).length <= 1,
          true,
        );
      }
    });

    it("two requests to be told by the same parent at once: one request, the other ALREADY_WATCHING", async () => {
      for (let run = 0; run < RUNS; run += 1) {
        await reset(BOOK_A);
        await insertLoan(db, {
          book: BOOK_A,
          parent: PARENT_ROW_F2,
          family: (await db.query("select family_id from parents where id = $1", [PARENT_ROW_F2]))
            .rows[0].family_id,
        });
        const answers = await both(
          () => on(one)(CO_PARENT_F1, "library_watch_add($1, $2)", [nextKey("r"), BOOK_A]),
          () => on(two)(CO_PARENT_F1, "library_watch_add($1, $2)", [nextKey("r"), BOOK_A]),
        );
        assert.equal(successes(answers), 1, `run ${run}`);
        assert.equal(
          answers.find((answer) => answer.state !== "success")!.code,
          "ALREADY_WATCHING",
        );
        assert.deepEqual(await watchRows(db, BOOK_A), [PARENT_ROW_CO]);
      }
    });

    it("the admin and super-admin requests keep their own rows when many ask at once", async () => {
      await reset(BOOK_A);
      await insertLoan(db, {
        book: BOOK_A,
        parent: PARENT_ROW_F2,
        family: (await db.query("select family_id from parents where id = $1", [PARENT_ROW_F2]))
          .rows[0].family_id,
      });
      const answers = await both(
        () => on(one)(ADMIN_G1, "library_watch_add($1, $2)", [nextKey("r"), BOOK_A]),
        () => on(two)(SUPER_ADMIN, "library_watch_add($1, $2)", [nextKey("r"), BOOK_A]),
      );
      assert.equal(successes(answers), 2);
      assert.deepEqual(await watchRows(db, BOOK_A), [PARENT_ROW_ADMIN_G1, PARENT_ROW_SUPER].sort());
      void PARENT_F1;
    });
  });
}
