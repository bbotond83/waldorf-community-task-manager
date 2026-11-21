import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import {
  CO_PARENT_F1,
  DEACTIVATED,
  DIRECTORY_SCHEMAS,
  nextKey,
  openDirectoryDatabase,
  OTHER_ADMIN,
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
  BOOK_OTHER_ORG,
  BOOK_REMOVED,
  BOOK_TYPED,
  bookRow,
  caller,
  insertLoan,
  insertWatch,
  loanRows,
  noticeRows,
  PARENT_ROW_NO_ACCOUNT_LIB,
  PARENT_ROW_OTHER_LIB,
  PARENT_ROW_REMOVED,
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
} from "./working-groups-support.ts";

/**
 * Add, change and remove a book (W1, W7; BR131.1, BR131.2, BR132.1, BR132.2, BR139.2; NFR3.2, NFR4.1) on the fixed list:
 * allowed, refused, out of reach, outdated screen, repeated click, two at once. The two-at-once cases of add (two
 * different books are two books) have no meaning and the same-key case is the repeated click; the 20-fold races of the
 * borrow and return commands are in library-races.test.ts.
 */
type Result = Awaited<ReturnType<ReturnType<typeof caller>>>;

for (const schema of DIRECTORY_SCHEMAS) {
  describe(`add, change and remove a book in ${schema}`, () => {
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
    beforeEach(async () => {
      await seedLibraryWorld(db, schema);
      await seedBooks(db, PARENT_ROW_F1, PARENT_ROW_F2);
    });

    const call = caller(() => db, schema);
    const callSecond = caller(() => second, schema);
    const outcome = (result: Result) => [result.state, result.code];
    const invalid = (result: Result) => [result.state, result.code, result.field, result.reason];
    const add = (
      account: string,
      title: string | null = "Új könyv",
      authors: string | null = "Új Szerző",
      description: string | null = null,
      owner: string | null = null,
      key = nextKey("a"),
    ) =>
      call(account, "library_book_add($1, $2, $3, $4, $5)", [
        key,
        title,
        authors,
        description,
        owner,
      ]);
    const change = (
      account: string,
      id: string,
      version: number | null,
      title: string | null = "Módosított",
      authors: string | null = "Módosított Szerző",
      description: string | null = null,
      owner: string | null = null,
      key = nextKey("c"),
    ) =>
      call(account, "library_book_change($1, $2, $3, $4, $5, $6, $7)", [
        key,
        id,
        version,
        title,
        authors,
        description,
        owner,
      ]);
    const remove = (account: string, id: string, version: number | null, key = nextKey("r")) =>
      call(account, "library_book_remove($1, $2, $3)", [key, id, version]);

    describe("W1 add a book", () => {
      it("allowed: a parent, a coordinator and a super admin add; the owner is the adder and the book is available", async () => {
        for (const [account, owner] of [
          [PARENT_F1, PARENT_ROW_F1],
          [ADMIN_G1, PARENT_ROW_ADMIN_G1],
          [SUPER_ADMIN, PARENT_ROW_SUPER],
        ] as const) {
          const result = await add(account, " Mese ", " Szerző ", "  Rövid leírás  ");
          assert.deepEqual([result.state, result.version], ["success", 1]);
          const row = (await bookRow(db, result.reference!))!;
          assert.deepEqual(
            [
              row.title,
              row.authors,
              row.description,
              row.owner_parent_id,
              row.owner_name,
              row.removed_at,
            ],
            ["Mese", "Szerző", "Rövid leírás", owner, null, null],
          );
          assert.equal((await loanRows(db, result.reference!)).length, 0);
        }
      });

      it("allowed: another active parent as owner, no description, and a second copy of the same title", async () => {
        const first = await add(PARENT_F1, "Ugyanaz", "Ugyanő", null, PARENT_ROW_F2);
        assert.equal((await bookRow(db, first.reference!))!.owner_parent_id, PARENT_ROW_F2);
        assert.equal((await bookRow(db, first.reference!))!.description, null);
        const copy = await add(PARENT_F1, "Ugyanaz", "Ugyanő");
        assert.equal(copy.state, "success");
        assert.notEqual(copy.reference, first.reference);
        const blank = await add(PARENT_F1, "Üres leírás", "X", "   ");
        assert.equal((await bookRow(db, blank.reference!))!.description, null);
      });

      it("refused: a teacher, an account with no role, a deactivated and a signed-out account", async () => {
        assert.deepEqual(outcome(await add(TEACHER_G1)), ["denied", "authorization_denied"]);
        assert.deepEqual(outcome(await add(OUTSIDER)), ["denied", "authorization_denied"]);
        assert.equal((await add(DEACTIVATED)).state, "denied");
        assert.deepEqual(outcome(await add(SIGNED_OUT)), ["denied", "session_inactive"]);
        assert.equal(await count(db, "books", "title = 'Új könyv'"), 0);
      });

      it("refused: an empty or too long title, authors or description, each on its own field", async () => {
        assert.deepEqual(invalid(await add(PARENT_F1, "  ")), [
          "validation",
          "field_invalid",
          "title",
          "invalid",
        ]);
        assert.equal((await add(PARENT_F1, null)).field, "title");
        assert.equal((await add(PARENT_F1, "x".repeat(201))).field, "title");
        assert.equal((await add(PARENT_F1, "T", "")).field, "authors");
        assert.equal((await add(PARENT_F1, "T", "x".repeat(201))).field, "authors");
        assert.equal((await add(PARENT_F1, "T", "A", "x".repeat(1001))).field, "description");
        assert.equal(
          (await add(PARENT_F1, "x".repeat(200), "x".repeat(200), "x".repeat(1000))).state,
          "success",
        );
        assert.equal(await count(db, "books", "title = 'T'"), 0);
      });

      it("refused: an owner who is unknown, of another community, removed, without an account or a teacher", async () => {
        const reason = async (owner: string) =>
          invalid(await add(PARENT_F1, "T", "A", null, owner));
        assert.deepEqual(await reason(uuid(9999)), [
          "validation",
          "field_invalid",
          "owner",
          "unknown",
        ]);
        assert.deepEqual(await reason(PARENT_ROW_OTHER_LIB), [
          "validation",
          "field_invalid",
          "owner",
          "unknown",
        ]);
        assert.deepEqual(await reason(PARENT_ROW_REMOVED), [
          "validation",
          "field_invalid",
          "owner",
          "not_a_parent",
        ]);
        assert.deepEqual(await reason(PARENT_ROW_NO_ACCOUNT_LIB), [
          "validation",
          "field_invalid",
          "owner",
          "not_a_parent",
        ]);
        assert.deepEqual(await reason(TEACHER_G1), [
          "validation",
          "field_invalid",
          "owner",
          "unknown",
        ]);
      });

      it("out of reach: a super admin of another community cannot name a parent of this one, and a book they add is theirs alone", async () => {
        const result = await add(OTHER_ADMIN, "T", "A", null, PARENT_ROW_F1);
        assert.deepEqual(invalid(result), ["validation", "field_invalid", "owner", "unknown"]);
        const noOwner = await add(OTHER_ADMIN, "T", "A");
        assert.deepEqual(invalid(noOwner), ["validation", "field_invalid", "owner", "unknown"]);
      });

      it("repeated click: the same key adds one book and returns the first answer; a changed request under the key conflicts", async () => {
        const key = nextKey("dup");
        const first = await add(PARENT_F1, "Egyszer", "Szerző", null, null, key);
        const again = await add(PARENT_F1, "Egyszer", "Szerző", null, null, key);
        assert.deepEqual(
          [again.state, again.code, again.reference],
          ["success", "replayed", first.reference],
        );
        assert.equal(await count(db, "books", "title = 'Egyszer'"), 1);
        const changed = await add(PARENT_F1, "Másképp", "Szerző", null, null, key);
        assert.deepEqual(outcome(changed), ["conflict", "idempotency_key_reused"]);
        assert.equal(await count(db, "books", "title = 'Másképp'"), 0);
      });

      it("writes no audit entry for an ordinary add", async () => {
        await add(PARENT_F1);
        const rows = await db.query(
          "select count(*)::int as n from audit_events where action like 'library%'",
        );
        assert.equal(rows.rows[0].n, 0);
      });
    });

    describe("W7 change a book", () => {
      it("allowed: the owner changes title, authors, description; the version rises by one; a description can be cleared", async () => {
        const result = await change(PARENT_F1, BOOK_A, 1, "Új cím", "Új szerző", "Új leírás");
        assert.deepEqual([result.state, result.version], ["success", 2]);
        const row = (await bookRow(db, BOOK_A))!;
        assert.deepEqual(
          [row.title, row.authors, row.description, row.owner_parent_id],
          ["Új cím", "Új szerző", "Új leírás", PARENT_ROW_F1],
        );
        const cleared = await change(PARENT_F1, BOOK_A, 2, "Új cím", "Új szerző", null);
        assert.equal((await bookRow(db, BOOK_A))!.description, null);
        assert.equal(cleared.version, 3);
        assert.equal((await auditRows(db, "library_book_changed_by_admin")).length, 0);
      });

      it("allowed: the owner names another parent as owner, and the old owner has no right any more", async () => {
        const result = await change(
          PARENT_F1,
          BOOK_A,
          1,
          "A kis herceg",
          "Saint-Exupéry",
          "Mese.",
          PARENT_ROW_F2,
        );
        assert.equal(result.state, "success");
        assert.equal((await bookRow(db, BOOK_A))!.owner_parent_id, PARENT_ROW_F2);
        assert.deepEqual(outcome(await change(PARENT_F1, BOOK_A, 2)), [
          "denied",
          "authorization_denied",
        ]);
        assert.equal((await change(PARENT_F2, BOOK_A, 2)).state, "success");
        assert.equal(
          (await auditRows(db, "library_owner_changed_by_admin")).length,
          0,
          "an owner who is not a super admin leaves no audit entry",
        );
      });

      it("allowed: a super admin changes a book they do not own and it is audited with no title or name (BR139.2)", async () => {
        const result = await change(
          SUPER_ADMIN,
          BOOK_A,
          1,
          "Titkos új cím",
          "Titkos szerző",
          "Titkos leírás",
        );
        assert.equal(result.state, "success");
        const rows = await auditRows(db, "library_book_changed_by_admin");
        assert.equal(rows.length, 1);
        assert.deepEqual(
          [rows[0]!.outcome, rows[0]!.target_id, rows[0]!.details, rows[0]!.actor_account_id],
          ["success", BOOK_A, null, SUPER_ADMIN],
        );
        assert.equal(JSON.stringify(rows).includes("Titkos"), false);
      });

      it("allowed: a super admin names an owner on a typed-name book and the typed name goes; the change of owner is audited once", async () => {
        const result = await change(
          SUPER_ADMIN,
          BOOK_TYPED,
          1,
          "Mese a hóemberről",
          "Ismeretlen",
          null,
          PARENT_ROW_F1,
        );
        assert.equal(result.state, "success");
        const row = (await bookRow(db, BOOK_TYPED))!;
        assert.deepEqual([row.owner_parent_id, row.owner_name], [PARENT_ROW_F1, null]);
        assert.equal((await auditRows(db, "library_owner_changed_by_admin")).length, 1);
        assert.equal((await auditRows(db, "library_book_changed_by_admin")).length, 0);
        assert.equal(
          (await change(PARENT_F1, BOOK_TYPED, 2)).state,
          "success",
          "the new owner now has rights",
        );
      });

      it("a watch of the new owner on the book is deleted; a new owner who holds the book is refused", async () => {
        await insertLoan(db, { book: BOOK_A, parent: PARENT_ROW_F2, family: uuid(202) });
        await insertWatch(db, BOOK_A, PARENT_ROW_ADMIN_G1);
        await insertWatch(db, BOOK_A, PARENT_ROW_CO);
        const refused = await change(
          PARENT_F1,
          BOOK_A,
          1,
          "A kis herceg",
          "Saint-Exupéry",
          "Mese.",
          PARENT_ROW_F2,
        );
        assert.deepEqual(invalid(refused), [
          "validation",
          "field_invalid",
          "owner",
          "holder_or_owner",
        ]);
        assert.equal((await bookRow(db, BOOK_A))!.owner_parent_id, PARENT_ROW_F1);
        const ok = await change(
          PARENT_F1,
          BOOK_A,
          1,
          "A kis herceg",
          "Saint-Exupéry",
          "Mese.",
          PARENT_ROW_ADMIN_G1,
        );
        assert.equal(ok.state, "success");
        assert.deepEqual(await watchRows(db, BOOK_A), [PARENT_ROW_CO]);
        assert.equal((await loanRows(db, BOOK_A)).length, 1, "the loan is not touched");
      });

      it("refused: the borrower, another parent, a coordinator, a teacher and an account with no role", async () => {
        for (const account of [PARENT_F2, CO_PARENT_F1, ADMIN_G1, TEACHER_G1, OUTSIDER]) {
          assert.deepEqual(
            outcome(await change(account, BOOK_A, 1)),
            ["denied", "authorization_denied"],
            account,
          );
        }
        assert.deepEqual(outcome(await change(SIGNED_OUT, BOOK_A, 1)), [
          "denied",
          "session_inactive",
        ]);
        assert.equal((await bookRow(db, BOOK_A))!.version, 1);
      });

      it("refused: bad fields, a bad owner, a missing version and a removed book", async () => {
        assert.equal((await change(PARENT_F1, BOOK_A, 1, "", "A")).field, "title");
        assert.equal((await change(PARENT_F1, BOOK_A, 1, "T", "")).field, "authors");
        assert.equal(
          (await change(PARENT_F1, BOOK_A, 1, "T", "A", "x".repeat(1001))).field,
          "description",
        );
        assert.deepEqual(
          invalid(await change(PARENT_F1, BOOK_A, 1, "T", "A", null, PARENT_ROW_REMOVED)),
          ["validation", "field_invalid", "owner", "not_a_parent"],
        );
        assert.equal((await change(PARENT_F1, BOOK_A, null)).field, "expected_version");
        assert.deepEqual(outcome(await change(PARENT_F1, BOOK_REMOVED, 1)), [
          "conflict",
          "BOOK_REMOVED",
        ]);
        assert.equal((await bookRow(db, BOOK_A))!.version, 1);
      });

      it("out of reach: a made-up book and a real book of another owner give the same denied answer; a super admin of another community finds no such book", async () => {
        const real = await change(PARENT_F2, BOOK_A, 1);
        const made = await change(PARENT_F2, uuid(9999), 1);
        assert.deepEqual(outcome(real), outcome(made));
        assert.deepEqual(outcome(made), ["denied", "authorization_denied"]);
        assert.deepEqual(outcome(await change(PARENT_F2, BOOK_OTHER_ORG, 1)), [
          "denied",
          "authorization_denied",
        ]);
        assert.deepEqual(invalid(await change(OTHER_ADMIN, BOOK_A, 1)), [
          "validation",
          "field_invalid",
          "book_id",
          "not_found",
        ]);
        assert.equal((await bookRow(db, BOOK_A))!.title, "A kis herceg");
      });

      it("outdated screen: a stale version is refused and nothing is overwritten", async () => {
        assert.equal((await change(PARENT_F1, BOOK_A, 1, "Első")).state, "success");
        const stale = await change(PARENT_F1, BOOK_A, 1, "Második");
        assert.deepEqual(outcome(stale), ["conflict", "VERSION_CONFLICT"]);
        assert.equal((await bookRow(db, BOOK_A))!.title, "Első");
      });

      it("repeated click: the same key changes the book once and returns the first answer", async () => {
        const key = nextKey("chg");
        const first = await change(PARENT_F1, BOOK_A, 1, "Egyszer", "S", null, null, key);
        const again = await change(PARENT_F1, BOOK_A, 1, "Egyszer", "S", null, null, key);
        assert.deepEqual([first.state, again.code], ["success", "replayed"]);
        assert.equal((await bookRow(db, BOOK_A))!.version, 2);
        assert.deepEqual(
          outcome(await change(PARENT_F1, BOOK_A, 1, "Máshogy", "S", null, null, key)),
          ["conflict", "idempotency_key_reused"],
        );
      });

      it("two at once: the owner and a super admin change the book together; one wins, the other is told to reload", async () => {
        const [owner, admin] = await Promise.all([
          change(PARENT_F1, BOOK_A, 1, "Tulajdonos"),
          callSecond(SUPER_ADMIN, "library_book_change($1, $2, $3, $4, $5, $6, $7)", [
            nextKey("x"),
            BOOK_A,
            1,
            "Admin",
            "S",
            null,
            null,
          ]),
        ]);
        const states = [owner.state, admin.state].sort();
        assert.deepEqual(states, ["conflict", "success"]);
        const loser = owner.state === "conflict" ? owner : admin;
        assert.equal(loser.code, "VERSION_CONFLICT");
        assert.equal((await bookRow(db, BOOK_A))!.version, 2);
      });

      it("rolls back when the audit entry cannot be written (NFR4.1)", async () => {
        await db.query(
          "create function lib_block_audit() returns trigger language plpgsql as $f$ begin raise exception 'audit blocked'; end $f$",
        );
        await db.query(
          "create trigger lib_block_audit before insert on audit_events for each row when (new.action like 'library%') execute function lib_block_audit()",
        );
        try {
          const error = await failureOf(() => change(SUPER_ADMIN, BOOK_A, 1, "Nem marad meg"));
          assert.ok(error, "the call fails");
          const row = (await bookRow(db, BOOK_A))!;
          assert.deepEqual([row.title, row.version], ["A kis herceg", 1]);
          assert.ok(await failureOf(() => remove(SUPER_ADMIN, BOOK_A, 1)));
          assert.equal((await bookRow(db, BOOK_A))!.removed_at, null);
        } finally {
          await db.query("drop trigger lib_block_audit on audit_events");
          await db.query("drop function lib_block_audit()");
        }
      });
    });

    describe("W7 remove a book", () => {
      it("allowed: the owner removes an available book; it leaves the list, its closed loans stay, its requests end without a notice", async () => {
        await insertLoan(db, {
          book: BOOK_A,
          parent: PARENT_ROW_F2,
          family: uuid(202),
          borrowedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
          returnedAt: new Date(Date.now() - 86400000).toISOString(),
        });
        await insertWatch(db, BOOK_A, PARENT_ROW_CO);
        const result = await remove(PARENT_F1, BOOK_A, 1);
        assert.deepEqual([result.state, result.version], ["success", 2]);
        assert.notEqual((await bookRow(db, BOOK_A))!.removed_at, null);
        assert.equal((await loanRows(db, BOOK_A)).length, 1);
        assert.deepEqual(await watchRows(db, BOOK_A), []);
        assert.equal((await noticeRows(db, PARENT_ROW_CO, "book_returned")).length, 0);
        const listing = (await call(PARENT_F2, "library_list($1)", [null])) as Result & {
          items: { id: string }[];
        };
        assert.equal(
          listing.items.some((item) => item.id === BOOK_A),
          false,
        );
        assert.equal((await auditRows(db, "library_book_removed_by_admin")).length, 0);
      });

      it("allowed: a super admin removes a book they do not own and it is audited with no title or name", async () => {
        assert.equal((await remove(SUPER_ADMIN, BOOK_B, 1)).state, "success");
        const rows = await auditRows(db, "library_book_removed_by_admin");
        assert.deepEqual([rows.length, rows[0]!.target_id, rows[0]!.details], [1, BOOK_B, null]);
      });

      it("refused: a borrowed book cannot be removed, and nothing changes", async () => {
        await insertLoan(db, { book: BOOK_A, parent: PARENT_ROW_F2, family: uuid(202) });
        await insertWatch(db, BOOK_A, PARENT_ROW_CO);
        assert.deepEqual(outcome(await remove(PARENT_F1, BOOK_A, 1)), ["conflict", "BOOK_ON_LOAN"]);
        assert.deepEqual(outcome(await remove(SUPER_ADMIN, BOOK_A, 1)), [
          "conflict",
          "BOOK_ON_LOAN",
        ]);
        assert.equal((await bookRow(db, BOOK_A))!.removed_at, null);
        assert.deepEqual(await watchRows(db, BOOK_A), [PARENT_ROW_CO]);
      });

      it("refused: another parent, a coordinator, a teacher, no role and a book already removed", async () => {
        for (const account of [PARENT_F2, ADMIN_G1, TEACHER_G1, OUTSIDER]) {
          assert.deepEqual(
            outcome(await remove(account, BOOK_A, 1)),
            ["denied", "authorization_denied"],
            account,
          );
        }
        assert.deepEqual(outcome(await remove(PARENT_F1, BOOK_REMOVED, 1)), [
          "conflict",
          "BOOK_REMOVED",
        ]);
        assert.equal((await remove(PARENT_F1, BOOK_A, null)).field, "expected_version");
      });

      it("out of reach: a made-up book answers like a real book of someone else", async () => {
        assert.deepEqual(
          outcome(await remove(PARENT_F2, uuid(9999), 1)),
          outcome(await remove(PARENT_F2, BOOK_A, 1)),
        );
        assert.deepEqual(outcome(await remove(PARENT_F2, BOOK_OTHER_ORG, 1)), [
          "denied",
          "authorization_denied",
        ]);
      });

      it("outdated screen: a stale version is refused", async () => {
        assert.equal((await change(PARENT_F1, BOOK_A, 1, "Új")).state, "success");
        assert.deepEqual(outcome(await remove(PARENT_F1, BOOK_A, 1)), [
          "conflict",
          "VERSION_CONFLICT",
        ]);
        assert.equal((await bookRow(db, BOOK_A))!.removed_at, null);
      });

      it("repeated click: the same key removes once; a second press with a new key is told the book is gone", async () => {
        const key = nextKey("rm");
        assert.equal((await remove(PARENT_F1, BOOK_A, 1, key)).state, "success");
        assert.equal((await remove(PARENT_F1, BOOK_A, 1, key)).code, "replayed");
        assert.deepEqual(outcome(await remove(PARENT_F1, BOOK_A, 2)), ["conflict", "BOOK_REMOVED"]);
      });

      it("two at once: the owner and a super admin remove together; one wins", async () => {
        const [owner, admin] = await Promise.all([
          remove(PARENT_F1, BOOK_A, 1),
          callSecond(SUPER_ADMIN, "library_book_remove($1, $2, $3)", [nextKey("x"), BOOK_A, 1]),
        ]);
        assert.deepEqual([owner.state, admin.state].sort(), ["conflict", "success"]);
        const loser = owner.state === "conflict" ? owner : admin;
        assert.ok(
          ["VERSION_CONFLICT", "BOOK_REMOVED"].includes(String(loser.code)),
          String(loser.code),
        );
        assert.equal(await count(db, "books", `id = '${BOOK_A}' and removed_at is not null`), 1);
      });
    });
  });
}
