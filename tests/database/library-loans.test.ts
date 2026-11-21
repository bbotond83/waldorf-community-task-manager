import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import { createAdminAccess } from "../../src/identity/admin-client.ts";
import { createSmtpTransport } from "../../src/identity/mail.ts";
import { main } from "../../scripts/timed-run.ts";
import {
  CO_PARENT_F1,
  DEACTIVATED,
  DIRECTORY_SCHEMAS,
  FAMILY_2,
  nextKey,
  openDirectoryDatabase,
  OUTSIDER,
  SIGNED_OUT,
  TEACHER_G1,
  uuid,
} from "./directory-support.ts";
import { count, failureOf } from "./identity-support.ts";
import {
  auditRows,
  BOOK_A,
  BOOK_B,
  BOOK_FORMER,
  BOOK_OTHER_ORG,
  BOOK_REMOVED,
  BOOK_TYPED,
  bookRow,
  caller,
  FAMILY_REMOVED,
  inDaysDate,
  insertLoan,
  insertWatch,
  loanRows,
  noticeRows,
  PARENT_ROW_REMOVED,
  PARENT_ROW_SUPER,
  seedBooks,
  seedLibraryWorld,
  watchRows,
} from "./library-support.ts";
import { serviceKey, stackSettings } from "./stack-support.ts";
import {
  ADMIN_G1,
  PARENT_F1,
  PARENT_F2,
  PARENT_ROW_ADMIN_G1,
  PARENT_ROW_CO,
  PARENT_ROW_F1,
  PARENT_ROW_F2,
  SUPER_ADMIN,
} from "./working-groups-support.ts";

/**
 * Borrow, set the date, return and the two watch commands (W3, W4, W5; BR133.1 to BR135.2, BR137.1, BR138.1) on the
 * fixed list: allowed, refused, out of reach, outdated screen, repeated click, two at once. The two-at-once cases are
 * in library-races.test.ts (20 runs each, with no deadlock). The watch commands take no version, so "outdated screen"
 * has no meaning for them.
 */
type Result = Awaited<ReturnType<ReturnType<typeof caller>>>;
const MAIL_API = "http://127.0.0.1:54324/api/v1";
const APP_URL = "http://127.0.0.1:3000";

for (const schema of DIRECTORY_SCHEMAS) {
  describe(`borrow, return and watches in ${schema}`, () => {
    let db: pg.Client;
    before(async () => {
      db = await openDirectoryDatabase(schema);
    });
    after(async () => {
      await db.end();
    });
    beforeEach(async () => {
      await seedLibraryWorld(db, schema);
      await seedBooks(db, PARENT_ROW_F1, PARENT_ROW_F2);
    });

    const call = caller(() => db, schema);
    const outcome = (result: Result) => [result.state, result.code];
    const invalid = (result: Result) => [result.state, result.code, result.field, result.reason];
    const borrow = (
      account: string,
      book: string,
      version: number | null = 1,
      until: string | null = null,
      key = nextKey("b"),
    ) => call(account, "library_book_borrow($1, $2, $3, $4)", [key, book, version, until]);
    const setUntil = (
      account: string,
      loan: string,
      version: number | null,
      until: string | null,
      key = nextKey("u"),
    ) => call(account, "library_loan_set_until($1, $2, $3, $4)", [key, loan, version, until]);
    const giveBack = (account: string, book: string, version: number | null, key = nextKey("g")) =>
      call(account, "library_book_return($1, $2, $3)", [key, book, version]);
    const watch = (account: string, book: string, key = nextKey("w")) =>
      call(account, "library_watch_add($1, $2)", [key, book]);
    const unwatch = (account: string, book: string, key = nextKey("v")) =>
      call(account, "library_watch_remove($1, $2)", [key, book]);
    const notices = (parent: string) => noticeRows(db, parent, "book_returned");

    describe("W3 borrow", () => {
      it("allowed: a parent borrows an available book; the book is borrowed, its version rises and the loan holds the parent and family", async () => {
        const result = await borrow(PARENT_F2, BOOK_A);
        assert.deepEqual([result.state, result.version], ["success", 2]);
        const loans = await loanRows(db, BOOK_A);
        assert.equal(loans.length, 1);
        assert.deepEqual(
          [
            loans[0]!.borrower_parent_id,
            loans[0]!.borrower_family_id,
            loans[0]!.until,
            loans[0]!.returned_at,
            loans[0]!.id,
          ],
          [PARENT_ROW_F2, FAMILY_2, null, null, result.reference],
        );
        assert.equal((await bookRow(db, BOOK_A))!.version, 2);
        const page = (await call(PARENT_F1, "library_get($1)", [BOOK_A])) as Result & {
          book: { state: string };
          loan: { holder_display_name: string };
        };
        assert.deepEqual(
          [page.book.state, page.loan.holder_display_name],
          ["borrowed", "Napraforgó Csilla"],
        );
        assert.equal(
          (await auditRows(db, "library_book_returned_by_admin")).length,
          0,
          "an ordinary borrow is not audited",
        );
      });

      it("allowed: with an until date today or a year ahead; any number of books; a family member of the owner; a coordinator; a super admin", async () => {
        assert.equal((await borrow(PARENT_F2, BOOK_A, 1, inDaysDate(0))).state, "success");
        assert.equal((await loanRows(db, BOOK_A))[0]!.until, inDaysDate(0));
        assert.equal((await borrow(PARENT_F2, BOOK_TYPED, 1, inDaysDate(365))).state, "success");
        assert.equal((await borrow(PARENT_F2, BOOK_FORMER, 1)).state, "success");
        assert.equal(
          (await borrow(CO_PARENT_F1, BOOK_B)).state,
          "success",
          "a family member other than the owner may borrow",
        );
        const second = await borrow(ADMIN_G1, BOOK_A, 2);
        assert.deepEqual(outcome(second), ["conflict", "BOOK_NOT_AVAILABLE"]);
        await db.query("update loans set returned_at = now() where book_id = $1", [BOOK_A]);
        await db.query("update books set updated_at = now() where id = $1", [BOOK_A]);
        assert.equal((await borrow(SUPER_ADMIN, BOOK_A, 3)).state, "success");
      });

      it("allowed: the borrower's own request on the book is deleted in the same step (BR133.1)", async () => {
        await insertLoan(db, {
          book: BOOK_A,
          parent: PARENT_ROW_F2,
          family: FAMILY_2,
          returnedAt: new Date().toISOString(),
          borrowedAt: new Date(Date.now() - 86400000).toISOString(),
        });
        await insertWatch(db, BOOK_A, PARENT_ROW_ADMIN_G1);
        await insertWatch(db, BOOK_A, PARENT_ROW_CO);
        assert.equal((await borrow(ADMIN_G1, BOOK_A)).state, "success");
        assert.deepEqual(await watchRows(db, BOOK_A), [PARENT_ROW_CO]);
      });

      it("refused: the owner of the book, a teacher, a person with no role, a deactivated and a signed-out account", async () => {
        assert.deepEqual(invalid(await borrow(PARENT_F1, BOOK_A)), [
          "validation",
          "field_invalid",
          "book",
          "own_book",
        ]);
        assert.deepEqual(outcome(await borrow(TEACHER_G1, BOOK_A)), [
          "denied",
          "authorization_denied",
        ]);
        assert.deepEqual(outcome(await borrow(OUTSIDER, BOOK_A)), [
          "denied",
          "authorization_denied",
        ]);
        assert.equal((await borrow(DEACTIVATED, BOOK_A)).state, "denied");
        assert.deepEqual(outcome(await borrow(SIGNED_OUT, BOOK_A)), ["denied", "session_inactive"]);
        assert.equal((await loanRows(db, BOOK_A)).length, 0);
      });

      it("refused: a borrowed book, a removed book, a missing version, and a date before today or more than a year ahead", async () => {
        await borrow(PARENT_F2, BOOK_A);
        assert.deepEqual(outcome(await borrow(ADMIN_G1, BOOK_A, 2)), [
          "conflict",
          "BOOK_NOT_AVAILABLE",
        ]);
        assert.deepEqual(outcome(await borrow(PARENT_F2, BOOK_REMOVED)), [
          "conflict",
          "BOOK_REMOVED",
        ]);
        assert.equal((await borrow(PARENT_F2, BOOK_TYPED, null)).field, "expected_version");
        assert.deepEqual(invalid(await borrow(PARENT_F2, BOOK_TYPED, 1, inDaysDate(-1))), [
          "validation",
          "field_invalid",
          "until",
          "before_today",
        ]);
        assert.deepEqual(invalid(await borrow(PARENT_F2, BOOK_TYPED, 1, inDaysDate(366))), [
          "validation",
          "field_invalid",
          "until",
          "too_far",
        ]);
        assert.equal((await loanRows(db, BOOK_TYPED)).length, 0);
      });

      it("out of reach: a made-up book and a book of another community answer the same way", async () => {
        const made = await borrow(PARENT_F2, uuid(9999));
        assert.deepEqual(invalid(made), ["validation", "field_invalid", "book", "not_found"]);
        assert.deepEqual(invalid(await borrow(PARENT_F2, BOOK_OTHER_ORG)), invalid(made));
      });

      it("outdated screen: a stale version on an available book is refused and no loan is made", async () => {
        await db.query("update books set title = 'Közben módosult' where id = $1", [BOOK_A]);
        assert.deepEqual(outcome(await borrow(PARENT_F2, BOOK_A, 1)), [
          "conflict",
          "VERSION_CONFLICT",
        ]);
        assert.equal((await loanRows(db, BOOK_A)).length, 0);
        assert.equal((await borrow(PARENT_F2, BOOK_A, 2)).state, "success");
      });

      it("repeated click: the same key makes one loan and returns the first answer; the same key with another date conflicts", async () => {
        const key = nextKey("dup");
        const first = await borrow(PARENT_F2, BOOK_A, 1, null, key);
        const again = await borrow(PARENT_F2, BOOK_A, 1, null, key);
        assert.deepEqual(
          [again.state, again.code, again.reference],
          ["success", "replayed", first.reference],
        );
        assert.equal((await loanRows(db, BOOK_A)).length, 1);
        assert.deepEqual(outcome(await borrow(PARENT_F2, BOOK_A, 1, inDaysDate(3), key)), [
          "conflict",
          "idempotency_key_reused",
        ]);
      });
    });

    describe("W3 the borrower changes the date", () => {
      it("allowed: the borrower sets, changes and clears the date; the loan's version rises each time", async () => {
        const loan = (await borrow(PARENT_F2, BOOK_A)).reference!;
        const set = await setUntil(PARENT_F2, loan, 1, inDaysDate(7));
        assert.deepEqual([set.state, set.version], ["success", 2]);
        assert.equal((await loanRows(db, BOOK_A))[0]!.until, inDaysDate(7));
        assert.equal((await setUntil(PARENT_F2, loan, 2, inDaysDate(30))).version, 3);
        assert.equal((await setUntil(PARENT_F2, loan, 3, null)).state, "success");
        assert.equal((await loanRows(db, BOOK_A))[0]!.until, null);
        assert.equal((await bookRow(db, BOOK_A))!.version, 2, "the book's version is untouched");
        assert.equal(
          (await noticeRows(db, PARENT_ROW_F1, "book_returned")).length,
          0,
          "nothing is sent",
        );
      });

      it("refused: the owner, another parent, a teacher and a closed loan; bad dates and a missing version", async () => {
        const loan = (await borrow(PARENT_F2, BOOK_A)).reference!;
        for (const account of [PARENT_F1, CO_PARENT_F1, SUPER_ADMIN, TEACHER_G1, OUTSIDER]) {
          assert.deepEqual(
            outcome(await setUntil(account, loan, 1, inDaysDate(3))),
            ["denied", "authorization_denied"],
            account,
          );
        }
        assert.deepEqual(invalid(await setUntil(PARENT_F2, loan, 1, inDaysDate(-1))), [
          "validation",
          "field_invalid",
          "until",
          "before_today",
        ]);
        assert.deepEqual(invalid(await setUntil(PARENT_F2, loan, 1, inDaysDate(400))), [
          "validation",
          "field_invalid",
          "until",
          "too_far",
        ]);
        assert.equal((await setUntil(PARENT_F2, loan, null, null)).field, "expected_version");
        await giveBack(PARENT_F1, BOOK_A, 2);
        assert.deepEqual(outcome(await setUntil(PARENT_F2, loan, 1, inDaysDate(3))), [
          "conflict",
          "BOOK_NOT_ON_LOAN",
        ]);
        assert.equal((await loanRows(db, BOOK_A))[0]!.until, null);
      });

      it("out of reach: a real loan of another parent and a made-up loan give the same answer", async () => {
        const loan = (await borrow(PARENT_F2, BOOK_A)).reference!;
        assert.deepEqual(
          outcome(await setUntil(CO_PARENT_F1, loan, 1, null)),
          outcome(await setUntil(CO_PARENT_F1, uuid(9999), 1, null)),
        );
      });

      it("outdated screen and repeated click: a stale loan version is refused; the same key changes the date once", async () => {
        const loan = (await borrow(PARENT_F2, BOOK_A)).reference!;
        await setUntil(PARENT_F2, loan, 1, inDaysDate(5));
        assert.deepEqual(outcome(await setUntil(PARENT_F2, loan, 1, inDaysDate(9))), [
          "conflict",
          "VERSION_CONFLICT",
        ]);
        assert.equal((await loanRows(db, BOOK_A))[0]!.until, inDaysDate(5));
        const key = nextKey("sd");
        assert.equal((await setUntil(PARENT_F2, loan, 2, inDaysDate(6), key)).state, "success");
        assert.equal((await setUntil(PARENT_F2, loan, 2, inDaysDate(6), key)).code, "replayed");
        assert.equal((await loanRows(db, BOOK_A))[0]!.version, 3);
      });
    });

    describe("W4 return", () => {
      it("allowed: the owner records the return; the loan stays as history, the version rises, the book is available and borrowable again", async () => {
        await borrow(PARENT_F2, BOOK_A);
        const result = await giveBack(PARENT_F1, BOOK_A, 2);
        assert.deepEqual([result.state, result.version], ["success", 3]);
        const loans = await loanRows(db, BOOK_A);
        assert.equal(loans.length, 1);
        assert.notEqual(loans[0]!.returned_at, null);
        assert.equal(
          loans[0]!.borrower_parent_id,
          PARENT_ROW_F2,
          "a present borrower stays on the history",
        );
        assert.equal((await auditRows(db, "library_book_returned_by_admin")).length, 0);
        assert.equal((await borrow(CO_PARENT_F1, BOOK_A, 3)).state, "success");
        assert.equal((await loanRows(db, BOOK_A)).length, 2);
      });

      it("allowed: a super admin records the return of a book with a typed owner or with no owner with rights, and it is audited (BR134.2, BR139.2)", async () => {
        await borrow(PARENT_F2, BOOK_TYPED);
        await borrow(PARENT_F2, BOOK_FORMER);
        assert.equal((await giveBack(SUPER_ADMIN, BOOK_TYPED, 2)).state, "success");
        assert.equal((await giveBack(SUPER_ADMIN, BOOK_FORMER, 2)).state, "success");
        const rows = await auditRows(db, "library_book_returned_by_admin");
        assert.deepEqual(rows.map((row) => row.target_id).sort(), [BOOK_FORMER, BOOK_TYPED].sort());
        assert.ok(
          rows.every((row) => row.details === null && row.actor_account_id === SUPER_ADMIN),
        );
      });

      it("allowed: the links of a loan whose borrower was removed meanwhile are cleared in the same step (BR139.1)", async () => {
        await insertLoan(db, { book: BOOK_A, parent: PARENT_ROW_REMOVED, family: FAMILY_REMOVED });
        await db.query("update books set updated_at = now() where id = $1", [BOOK_A]);
        assert.equal((await giveBack(PARENT_F1, BOOK_A, 2)).state, "success");
        const loan = (await loanRows(db, BOOK_A))[0]!;
        assert.deepEqual([loan.borrower_parent_id, loan.borrower_family_id], [null, null]);
        assert.notEqual(loan.returned_at, null);
      });

      it("refused: the borrower, another parent, a coordinator, a teacher, no role, and a super admin for a book whose owner has rights", async () => {
        await borrow(PARENT_F2, BOOK_A);
        for (const account of [
          PARENT_F2,
          CO_PARENT_F1,
          ADMIN_G1,
          TEACHER_G1,
          OUTSIDER,
          SUPER_ADMIN,
        ]) {
          assert.deepEqual(
            outcome(await giveBack(account, BOOK_A, 2)),
            ["denied", "authorization_denied"],
            account,
          );
        }
        assert.deepEqual(outcome(await giveBack(SIGNED_OUT, BOOK_A, 2)), [
          "denied",
          "session_inactive",
        ]);
        assert.equal((await loanRows(db, BOOK_A))[0]!.returned_at, null);
        assert.equal((await giveBack(PARENT_F1, BOOK_A, null)).field, "expected_version");
      });

      it("refused: a book with no open loan is BOOK_NOT_ON_LOAN with a current version; a removed book is BOOK_REMOVED", async () => {
        assert.deepEqual(outcome(await giveBack(PARENT_F1, BOOK_A, 1)), [
          "conflict",
          "BOOK_NOT_ON_LOAN",
        ]);
        assert.deepEqual(outcome(await giveBack(PARENT_F1, BOOK_REMOVED, 1)), [
          "conflict",
          "BOOK_REMOVED",
        ]);
      });

      it("out of reach: a made-up book answers like a real book of someone else", async () => {
        await borrow(PARENT_F2, BOOK_B, 1).catch(() => undefined);
        assert.deepEqual(
          outcome(await giveBack(CO_PARENT_F1, uuid(9999), 1)),
          outcome(await giveBack(CO_PARENT_F1, BOOK_A, 1)),
        );
        assert.deepEqual(outcome(await giveBack(CO_PARENT_F1, BOOK_OTHER_ORG, 1)), [
          "denied",
          "authorization_denied",
        ]);
      });

      it("outdated screen: the second press gets VERSION_CONFLICT on the old version and BOOK_NOT_ON_LOAN on the current one", async () => {
        await borrow(PARENT_F2, BOOK_A);
        assert.equal((await giveBack(PARENT_F1, BOOK_A, 2)).state, "success");
        assert.deepEqual(outcome(await giveBack(PARENT_F1, BOOK_A, 2)), [
          "conflict",
          "VERSION_CONFLICT",
        ]);
        assert.deepEqual(outcome(await giveBack(PARENT_F1, BOOK_A, 3)), [
          "conflict",
          "BOOK_NOT_ON_LOAN",
        ]);
        assert.equal((await loanRows(db, BOOK_A)).length, 1);
      });

      it("repeated click: the same key records one return and tells the watchers once", async () => {
        await borrow(PARENT_F2, BOOK_A);
        await watch(CO_PARENT_F1, BOOK_A);
        const key = nextKey("ret");
        const first = await giveBack(PARENT_F1, BOOK_A, 2, key);
        const again = await giveBack(PARENT_F1, BOOK_A, 2, key);
        assert.deepEqual([first.state, again.code], ["success", "replayed"]);
        assert.equal((await notices(PARENT_ROW_CO)).length, 1);
        assert.deepEqual(outcome(await giveBack(PARENT_F1, BOOK_A, 3, key)), [
          "conflict",
          "idempotency_key_reused",
        ]);
      });
    });

    describe("W5 be told when it is back", () => {
      it("allowed: a parent, a coordinator and a super admin ask; taking the request back succeeds, also when there is none", async () => {
        await borrow(PARENT_F2, BOOK_A);
        for (const account of [CO_PARENT_F1, ADMIN_G1, SUPER_ADMIN]) {
          assert.equal((await watch(account, BOOK_A)).state, "success", account);
        }
        assert.deepEqual(
          await watchRows(db, BOOK_A),
          [PARENT_ROW_ADMIN_G1, PARENT_ROW_CO, PARENT_ROW_SUPER].sort(),
        );
        assert.equal((await unwatch(CO_PARENT_F1, BOOK_A)).state, "success");
        assert.equal((await unwatch(CO_PARENT_F1, BOOK_A)).state, "success");
        assert.deepEqual(
          await watchRows(db, BOOK_A),
          [PARENT_ROW_ADMIN_G1, PARENT_ROW_SUPER].sort(),
        );
        assert.equal((await unwatch(PARENT_F1, BOOK_B)).state, "success");
      });

      it("refused: an available book, the holder, the owner, a second request, a removed book, a teacher and no role", async () => {
        assert.deepEqual(outcome(await watch(CO_PARENT_F1, BOOK_A)), [
          "conflict",
          "BOOK_AVAILABLE",
        ]);
        await borrow(PARENT_F2, BOOK_A);
        assert.deepEqual(invalid(await watch(PARENT_F2, BOOK_A)), [
          "validation",
          "field_invalid",
          "book",
          "holder_or_owner",
        ]);
        assert.deepEqual(invalid(await watch(PARENT_F1, BOOK_A)), [
          "validation",
          "field_invalid",
          "book",
          "holder_or_owner",
        ]);
        assert.equal((await watch(CO_PARENT_F1, BOOK_A)).state, "success");
        assert.deepEqual(outcome(await watch(CO_PARENT_F1, BOOK_A)), [
          "conflict",
          "ALREADY_WATCHING",
        ]);
        assert.deepEqual(outcome(await watch(CO_PARENT_F1, BOOK_REMOVED)), [
          "conflict",
          "BOOK_REMOVED",
        ]);
        assert.deepEqual(outcome(await watch(TEACHER_G1, BOOK_A)), [
          "denied",
          "authorization_denied",
        ]);
        assert.deepEqual(outcome(await watch(OUTSIDER, BOOK_A)), [
          "denied",
          "authorization_denied",
        ]);
        assert.deepEqual(outcome(await watch(SIGNED_OUT, BOOK_A)), ["denied", "session_inactive"]);
        assert.deepEqual(outcome(await unwatch(TEACHER_G1, BOOK_A)), [
          "denied",
          "authorization_denied",
        ]);
        assert.equal(await count(db, "return_watches"), 1);
      });

      it("out of reach: a made-up book and a book of another community are not found; removing a request on them changes nothing", async () => {
        assert.deepEqual(invalid(await watch(CO_PARENT_F1, uuid(9999))), [
          "validation",
          "field_invalid",
          "book",
          "not_found",
        ]);
        assert.deepEqual(invalid(await watch(CO_PARENT_F1, BOOK_OTHER_ORG)), [
          "validation",
          "field_invalid",
          "book",
          "not_found",
        ]);
        assert.equal((await unwatch(CO_PARENT_F1, uuid(9999))).state, "success");
        assert.equal((await unwatch(CO_PARENT_F1, BOOK_OTHER_ORG)).state, "success");
      });

      it("repeated click: the same key makes one request; a second press with a new key is told so", async () => {
        await borrow(PARENT_F2, BOOK_A);
        const key = nextKey("dupw");
        const first = await watch(CO_PARENT_F1, BOOK_A, key);
        const again = await watch(CO_PARENT_F1, BOOK_A, key);
        assert.deepEqual(
          [first.state, again.code, again.reference],
          ["success", "replayed", first.reference],
        );
        assert.equal(await count(db, "return_watches"), 1);
        assert.deepEqual(outcome(await watch(CO_PARENT_F1, BOOK_A)), [
          "conflict",
          "ALREADY_WATCHING",
        ]);
      });
    });

    describe("W5 the notice at the return (BR135.2, BR137.1)", () => {
      it("tells every active watcher once with the book's title and link, then ends the requests; the person recording the return is left out", async () => {
        await borrow(PARENT_F2, BOOK_TYPED);
        await watch(CO_PARENT_F1, BOOK_TYPED);
        await watch(ADMIN_G1, BOOK_TYPED);
        await watch(SUPER_ADMIN, BOOK_TYPED);
        const result = await giveBack(SUPER_ADMIN, BOOK_TYPED, 2);
        assert.equal(result.state, "success");
        assert.equal((await notices(PARENT_ROW_CO)).length, 1);
        assert.equal((await notices(PARENT_ROW_ADMIN_G1)).length, 1);
        assert.equal(
          (await notices(PARENT_ROW_SUPER)).length,
          0,
          "the person recording the return is not told",
        );
        const row = (await notices(PARENT_ROW_CO))[0]!;
        assert.deepEqual([row.target_type, row.target_ref], ["book", BOOK_TYPED]);
        const described = (
          await db.query("select * from notice_describe('book_returned', 'book', $1, $2)", [
            BOOK_TYPED,
            PARENT_ROW_CO,
          ])
        ).rows[0];
        assert.equal(described.title, "Könyv visszaérkezett: Mese a hóemberről");
        assert.equal(described.path, `/szulo/konyvtar/${BOOK_TYPED}`);
        const text = JSON.stringify(described);
        for (const secret of ["Napraforgó", "Régi Gazda", "Első Koordinátor", "Admin Anna"]) {
          assert.equal(text.includes(secret), false, secret);
        }
        assert.deepEqual(await watchRows(db, BOOK_TYPED), []);
        await borrow(PARENT_F2, BOOK_TYPED, 3);
        await giveBack(SUPER_ADMIN, BOOK_TYPED, 4);
        assert.equal(
          (await notices(PARENT_ROW_CO)).length,
          1,
          "the requests ended: the next return tells nobody",
        );
      });

      it("a book with no requests sends nothing; a watcher who is no longer active is not told", async () => {
        await borrow(PARENT_F2, BOOK_A);
        await giveBack(PARENT_F1, BOOK_A, 2);
        assert.equal(await count(db, "notifications", "kind = 'book_returned'"), 0);
        await borrow(PARENT_F2, BOOK_A, 3);
        await watch(CO_PARENT_F1, BOOK_A);
        await db.query("update parents set status = 'archived' where id = $1", [PARENT_ROW_CO]);
        assert.equal((await giveBack(PARENT_F1, BOOK_A, 4)).state, "success");
        assert.equal((await notices(PARENT_ROW_CO)).length, 0);
        assert.deepEqual(await watchRows(db, BOOK_A), [], "the request ends all the same");
      });

      it("a forced failure midway leaves the book borrowed, the requests in place and no notice (NFR7.1)", async () => {
        await borrow(PARENT_F2, BOOK_A);
        await watch(CO_PARENT_F1, BOOK_A);
        await db.query(
          "create function lib_block_notice() returns trigger language plpgsql as $f$ begin raise exception 'notice blocked'; end $f$",
        );
        await db.query(
          "create trigger lib_block_notice before insert on notifications for each row execute function lib_block_notice()",
        );
        try {
          assert.ok(await failureOf(() => giveBack(PARENT_F1, BOOK_A, 2)), "the call fails");
        } finally {
          await db.query("drop trigger lib_block_notice on notifications");
          await db.query("drop function lib_block_notice()");
        }
        assert.equal((await loanRows(db, BOOK_A))[0]!.returned_at, null);
        assert.equal((await bookRow(db, BOOK_A))!.version, 2);
        assert.deepEqual(await watchRows(db, BOOK_A), [PARENT_ROW_CO]);
        assert.equal((await giveBack(PARENT_F1, BOOK_A, 2)).state, "success", "a retry works");
      });

      it("a refusal from the notice function is a fault and rolls the return back (a missing registry row)", async () => {
        await borrow(PARENT_F2, BOOK_A);
        await watch(CO_PARENT_F1, BOOK_A);
        const saved = (await db.query("select * from notice_kinds where kind = 'book_returned'"))
          .rows[0];
        assert.ok(saved, "the kind is registered");
        await db.query("delete from notice_kinds where kind = 'book_returned'");
        let result: Result;
        try {
          result = await giveBack(PARENT_F1, BOOK_A, 2);
        } finally {
          const columns = Object.keys(saved);
          await db.query(
            `insert into notice_kinds (${columns.join(", ")}) values (${columns.map((_, i) => `$${i + 1}`).join(", ")})`,
            columns.map((c) => saved[c]),
          );
        }
        assert.equal(result.state, "validation");
        assert.equal((await loanRows(db, BOOK_A))[0]!.returned_at, null);
        assert.deepEqual(await watchRows(db, BOOK_A), [PARENT_ROW_CO]);
        assert.equal((await bookRow(db, BOOK_A))!.version, 2);
      });

      it("a failed email later never touches the return: the in-app notice and the closed loan stay", async () => {
        await borrow(PARENT_F2, BOOK_A);
        await watch(CO_PARENT_F1, BOOK_A);
        await giveBack(PARENT_F1, BOOK_A, 2);
        await db.query(
          "update email_deliveries set status = 'failed', attempts_in_round = 3, finished_at = now() where parent_id = $1",
          [PARENT_ROW_CO],
        );
        assert.notEqual((await loanRows(db, BOOK_A))[0]!.returned_at, null);
        assert.equal((await notices(PARENT_ROW_CO)).length, 1);
      });
    });
  });
}

/**
 * The real local mail catcher: a return with one watcher sends one email to that watcher, with the book's title and
 * link and nothing about the holder, the owner or another watcher (AC17.1.1, AC17.1.6, NFR10.1).
 */
describe("a book notice email through the local mail catcher", () => {
  const SCHEMA = "worker_3";
  let db: pg.Client;
  before(async () => {
    db = await openDirectoryDatabase(SCHEMA);
  });
  after(async () => {
    await db.end();
  });
  beforeEach(async () => {
    await seedLibraryWorld(db, SCHEMA);
    await seedBooks(db, PARENT_ROW_F1, PARENT_ROW_F2);
  });

  it("delivers the return notice to the watcher only", async () => {
    const call = caller(() => db, SCHEMA);
    await call(PARENT_F2, "library_book_borrow($1, $2, 1, null)", [nextKey("m"), BOOK_A]);
    await call(CO_PARENT_F1, "library_watch_add($1, $2)", [nextKey("m"), BOOK_A]);
    await call(ADMIN_G1, "library_watch_add($1, $2)", [nextKey("m"), BOOK_A]);
    const returned = await call(PARENT_F1, "library_book_return($1, $2, 2)", [
      nextKey("m"),
      BOOK_A,
    ]);
    assert.equal(returned.state, "success");
    const settings = stackSettings();
    const logs: string[] = [];
    const code = await main(["--mode", "deliver"], {
      environment: {
        SUPABASE_URL: settings.apiUrl,
        SUPABASE_SERVICE_ROLE_KEY: serviceKey(),
        DATABASE_SCHEMA: SCHEMA,
        APP_PUBLIC_URL: APP_URL,
        SMTP_HOST: "127.0.0.1",
        SMTP_PORT: "54325",
        SMTP_FROM: "no-reply@example.test",
      },
      readFile: () => undefined,
      createAdmin: createAdminAccess,
      createTransport: createSmtpTransport,
      now: () => Date.now(),
      log: (line) => logs.push(line),
    });
    assert.equal(code, 0, logs.join("\n"));
    const address = `identity.${CO_PARENT_F1}@example.test`;
    const search = await fetch(`${MAIL_API}/search?query=${encodeURIComponent(`to:${address}`)}`);
    const found = (await search.json()) as { messages: { ID: string }[] };
    assert.ok(found.messages[0], "the watcher's email reached the catcher");
    const message = (await (
      await fetch(`${MAIL_API}/message/${found.messages[0]!.ID}`)
    ).json()) as {
      To: { Address: string }[];
      Subject: string;
      Text: string;
      HTML: string;
    };
    assert.equal(message.To.length, 1);
    assert.equal(message.To[0]!.Address, address);
    assert.equal(message.Subject, "Könyv visszaérkezett: A kis herceg");
    assert.ok(message.Text.includes(`${APP_URL}/szulo/konyvtar/${BOOK_A}`));
    const other = `identity.${ADMIN_G1}@example.test`;
    for (const part of [message.Text, message.HTML, message.Subject]) {
      for (const secret of [other, "Napraforgó", "Fenyő", "Első Koordinátor"]) {
        assert.equal(part.includes(secret), false, secret);
      }
    }
  });
});
