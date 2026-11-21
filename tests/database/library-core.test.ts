import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import { FRESH_SCHEMA_SETTINGS } from "../../scripts/db/migrate.ts";
import { applyMigrations, readMigrationFiles, TRACKING_SCHEMA } from "../../scripts/db/runner.ts";
import {
  CO_PARENT_F1,
  DEACTIVATED,
  DIRECTORY_SCHEMAS,
  FAMILY_1,
  ORGANIZATION,
  OTHER_ADMIN,
  OUTSIDER,
  SIGNED_OUT,
  TEACHER_G1,
  uuid,
} from "./directory-support.ts";
import { asActor, authenticated, count, failureOf } from "./identity-support.ts";
import {
  BOOK_A,
  BOOK_B,
  BOOK_FORMER,
  BOOK_OTHER_ORG,
  BOOK_REMOVED,
  BOOK_TYPED,
  caller,
  FAMILY_REMOVED,
  insertBook,
  insertLoan,
  insertWatch,
  PARENT_ROW_REMOVED,
  seedBooks,
  seedLibraryWorld,
} from "./library-support.ts";
import { openDatabase, root } from "./stack-support.ts";
import {
  ADMIN_G1,
  PARENT_F1,
  PARENT_F2,
  PARENT_ROW_F1,
  PARENT_ROW_F2,
  SUPER_ADMIN,
} from "./working-groups-support.ts";

/**
 * The tables, the notice registrations and the two reads of U13 (W2; BR130.1, BR130.2, BR137.1; NFR1, NFR3.4, NFR7.3,
 * NFR7.5, NFR9.4). The reads have no stale screen, no repeated click and no race to lose, so those cases of the fixed
 * list do not exist here; the commands have them in the next files.
 */
type Result = Awaited<ReturnType<ReturnType<typeof caller>>>;
type Item = {
  id: string;
  title: string;
  authors: string;
  description: string | null;
  version: number;
  owner: { kind: string; display_name: string };
  state: string;
  holder_display_name: string | null;
  until: string | null;
  is_own: boolean;
  borrowed_by_me: boolean;
};
type Listing = Result & { items: Item[]; caller: { can_add: boolean } };
type Page = Result & {
  book: Item & { owner: { kind: string; display_name: string } };
  loan: null | {
    id: string;
    version: number;
    holder_display_name: string;
    is_mine: boolean;
    until: string | null;
  };
  caller: Record<string, boolean>;
};

for (const schema of DIRECTORY_SCHEMAS) {
  describe(`library tables, registrations and reads in ${schema}`, () => {
    let db: pg.Client;
    before(async () => {
      db = await openDatabaseFor(schema);
    });
    after(async () => {
      await db.end();
    });
    beforeEach(async () => {
      await seedLibraryWorld(db, schema);
      await seedBooks(db, PARENT_ROW_F1, PARENT_ROW_F2);
    });

    const call = caller(() => db, schema);
    const list = async (account: string, search: string | null = null) =>
      (await call(account, "library_list($1)", [search])) as Listing;
    const get = async (account: string, id: string) =>
      (await call(account, "library_get($1)", [id])) as Page;
    const titles = (listing: Listing) => listing.items.map((item) => item.title);

    describe("the tables refuse what the rules forbid, attacked as the database owner (NFR7.3)", () => {
      const refused = async (sql: string, values: unknown[], code: string) => {
        const error = await failureOf(() => db.query(sql, values));
        assert.ok(error, `expected a refusal for: ${sql}`);
        assert.equal(error.code, code, error.message);
      };
      const bookInsert = (columns: string, marks: string, values: unknown[]) =>
        refused(
          `insert into books (organization_id, ${columns}) values ($1, ${marks})`,
          [ORGANIZATION, ...values],
          "23514",
        );

      it("refused: an owner that is a parent and a typed name, a typed name without a source key", async () => {
        await bookInsert(
          "title, authors, owner_parent_id, owner_name, source_key",
          "'T', 'A', $2, 'Név', 'k1'",
          [PARENT_ROW_F1],
        );
        await bookInsert("title, authors, owner_name", "'T', 'A', 'Név'", []);
      });

      it("refused: an empty or too long title, authors and description", async () => {
        await bookInsert("title, authors", "'', 'A'", []);
        await bookInsert("title, authors", "$2, 'A'", ["x".repeat(201)]);
        await bookInsert("title, authors", "'T', ''", []);
        await bookInsert("title, authors", "'T', $2", ["x".repeat(201)]);
        await bookInsert("title, authors, description", "'T', 'A', $2", ["x".repeat(1001)]);
      });

      it("refused: a second open loan for one book, a return before the borrowing, a date before the borrowing", async () => {
        await insertLoan(db, { book: BOOK_A, parent: PARENT_ROW_F2, family: uuid(202) });
        await refused(
          "insert into loans (organization_id, book_id, borrower_parent_id, borrower_family_id) values ($1, $2, $3, $4)",
          [ORGANIZATION, BOOK_A, PARENT_ROW_F1, FAMILY_1],
          "23505",
        );
        await refused(
          "insert into loans (organization_id, book_id, borrower_parent_id, borrower_family_id, borrowed_at, returned_at) values ($1, $2, $3, $4, now(), now() - interval '1 day')",
          [ORGANIZATION, BOOK_B, PARENT_ROW_F1, FAMILY_1],
          "23514",
        );
        await refused(
          "insert into loans (organization_id, book_id, borrower_parent_id, borrower_family_id, borrowed_at, until) values ($1, $2, $3, $4, now(), current_date - 5)",
          [ORGANIZATION, BOOK_B, PARENT_ROW_F1, FAMILY_1],
          "23514",
        );
      });

      it("refused: a loan with a parent and no family, a second watch of one parent on one book", async () => {
        await refused(
          "insert into loans (organization_id, book_id, borrower_parent_id) values ($1, $2, $3)",
          [ORGANIZATION, BOOK_B, PARENT_ROW_F1],
          "23514",
        );
        await insertLoan(db, { book: BOOK_B, parent: PARENT_ROW_F1, family: FAMILY_1 });
        await insertWatch(db, BOOK_B, PARENT_ROW_F2);
        await refused(
          "insert into return_watches (organization_id, book_id, parent_id) values ($1, $2, $3)",
          [ORGANIZATION, BOOK_B, PARENT_ROW_F2],
          "23505",
        );
      });

      it("allowed: a second book with the same title and authors, a closed loan beside an open one", async () => {
        await db.query(
          "insert into books (organization_id, title, authors, owner_parent_id) select organization_id, title, authors, owner_parent_id from books where id = $1",
          [BOOK_A],
        );
        await insertLoan(db, {
          book: BOOK_A,
          parent: PARENT_ROW_F2,
          family: uuid(202),
          borrowedAt: new Date(Date.now() - 86400000).toISOString(),
          returnedAt: new Date().toISOString(),
        });
        await insertLoan(db, { book: BOOK_A, parent: PARENT_ROW_F2, family: uuid(202) });
        assert.equal(await count(db, "loans", "book_id = '" + BOOK_A + "'"), 2);
      });

      it("refused: every signed-in role reads and writes none of the three tables (NFR1.4)", async () => {
        for (const role of ["anon", "authenticated", "service_role"] as const) {
          for (const table of ["books", "loans", "return_watches"]) {
            const error = await failureOf(() =>
              asActor(db, schema, { role, account: role === "anon" ? undefined : PARENT_F1 }, () =>
                db.query(`select count(*) from ${table}`),
              ),
            );
            assert.equal(error?.code, "42501", `${role} reads ${table}`);
          }
        }
        const write = await failureOf(() =>
          asActor(db, schema, authenticated(SUPER_ADMIN), () =>
            db.query("insert into books (organization_id, title, authors) values ($1, 't', 'a')", [
              ORGANIZATION,
            ]),
          ),
        );
        assert.equal(write?.code, "42501");
      });
    });

    describe("the audit list and the notice registrations", () => {
      it("accepts the five library actions and still the earlier ones, and refuses an unknown one", async () => {
        for (const action of [
          "library_book_returned_by_admin",
          "library_book_changed_by_admin",
          "library_book_removed_by_admin",
          "library_owner_changed_by_admin",
          "library_removal_applied",
          "event.cancelled",
          "role.grant",
        ]) {
          await db.query(
            "insert into audit_events (actor_account_id, actor_role, action, target_type, target_id, organization_id, outcome) values ($1, 'super_admin', $2, 'book', $3, $4, 'success')",
            [SUPER_ADMIN, action, BOOK_A, ORGANIZATION],
          );
        }
        const error = await failureOf(() =>
          db.query(
            "insert into audit_events (actor_account_id, actor_role, action, target_type, target_id, organization_id, outcome) values ($1, 'super_admin', 'library_made_up', 'book', $2, $3, 'success')",
            [SUPER_ADMIN, BOOK_A, ORGANIZATION],
          ),
        );
        assert.equal(error?.code, "23514");
      });

      it("registers the book target with its facts function and the two kinds, and keeps the earlier ones", async () => {
        const target = (
          await db.query("select facts_function from notice_targets where target_type = 'book'")
        ).rows;
        assert.deepEqual(target, [{ facts_function: "book_notice_facts" }]);
        const kinds = (
          await db.query(
            "select kind, title_prefix from notice_kinds where target_type = 'book' order by kind",
          )
        ).rows;
        assert.deepEqual(kinds, [
          { kind: "book_return_due", title_prefix: "Könyvet vissza kell vinni:" },
          { kind: "book_returned", title_prefix: "Könyv visszaérkezett:" },
        ]);
        assert.ok((await count(db, "notice_kinds", "kind = 'event_new'")) === 1);
      });

      it("the facts name the book and the path and nothing else; a removed book still answers (BR137.1, NFR10.1)", async () => {
        await insertLoan(db, { book: BOOK_B, parent: PARENT_ROW_F1, family: FAMILY_1 });
        const facts = (
          await db.query("select * from book_notice_facts($1, $2, 'book_returned')", [
            BOOK_B,
            PARENT_ROW_F1,
          ])
        ).rows[0];
        assert.equal(facts.item_name, "Pál utcai fiúk");
        assert.equal(facts.path, `/szulo/konyvtar/${BOOK_B}`);
        const text = JSON.stringify(facts);
        for (const secret of ["Napraforgó", "Fenyő", "Molnár"]) {
          assert.equal(text.includes(secret), false, secret);
        }
        const removed = (
          await db.query("select * from book_notice_facts($1, $2, 'book_returned')", [
            BOOK_REMOVED,
            PARENT_ROW_F1,
          ])
        ).rows;
        assert.equal(removed[0].item_name, "Törölt könyv");
        assert.equal(
          (
            await db.query("select * from book_notice_facts($1, $2, 'book_returned')", [
              uuid(9999),
              PARENT_ROW_F1,
            ])
          ).rowCount,
          0,
        );
      });
    });

    describe("W2 the list", () => {
      it("allowed: every signed-in reader, a teacher included, gets the books of their community ordered by title, as one document", async () => {
        for (const account of [PARENT_F1, ADMIN_G1, SUPER_ADMIN, TEACHER_G1, CO_PARENT_F1]) {
          const listing = await list(account);
          assert.equal(listing.state, "success", account);
          assert.deepEqual(titles(listing), [
            "A kis herceg",
            "Gazdátlan könyv",
            "Mese a hóemberről",
            "Pál utcai fiúk",
          ]);
        }
      });

      it("answers every yes-or-no field as true or false, never null, also for a typed owner, no loan and a teacher", async () => {
        for (const who of [PARENT_F1, PARENT_F2, TEACHER_G1, SUPER_ADMIN]) {
          const listing = await list(who);
          assert.ok(listing.items.length > 0);
          for (const item of listing.items) {
            assert.equal(typeof item.is_own, "boolean", `is_own of ${item.title}`);
            assert.equal(typeof item.borrowed_by_me, "boolean", `borrowed_by_me of ${item.title}`);
          }
          for (const item of listing.items) {
            const detail = await get(who, item.id);
            for (const [name, value] of Object.entries(detail.caller)) {
              assert.equal(typeof value, "boolean", `${name} of ${item.title}`);
            }
          }
        }
      });

      it("returns exactly the documented fields and no contact detail, child or removed book (NFR1.2)", async () => {
        await insertLoan(db, {
          book: BOOK_B,
          parent: PARENT_ROW_F1,
          family: FAMILY_1,
          until: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
        });
        const listing = await list(PARENT_F2);
        const held = listing.items.find((item) => item.id === BOOK_B)!;
        assert.deepEqual(Object.keys(held).sort(), [
          "authors",
          "borrowed_by_me",
          "description",
          "holder_display_name",
          "id",
          "is_own",
          "owner",
          "state",
          "title",
          "until",
          "version",
        ]);
        assert.deepEqual(Object.keys(held.owner).sort(), ["display_name", "kind"]);
        assert.equal(held.state, "borrowed");
        assert.equal(held.holder_display_name, "Fenyő Anna");
        assert.equal(held.is_own, true);
        assert.match(held.until ?? "", /^\d{4}-\d{2}-\d{2}$/);
        const text = JSON.stringify(listing);
        assert.equal(text.includes("@"), false);
        assert.equal(
          listing.items.some((item) => item.id === BOOK_REMOVED || item.id === BOOK_OTHER_ORG),
          false,
        );
      });

      it("an available book shows no holder; a book with no description is a title and authors only", async () => {
        const listing = await list(PARENT_F1);
        const plain = listing.items.find((item) => item.id === BOOK_B)!;
        assert.deepEqual(
          [plain.state, plain.holder_display_name, plain.until, plain.description],
          ["available", null, null, null],
        );
      });

      it("shows the owner as a parent, as a typed name, or as korábbi tag; and a removed holder as korábbi tag", async () => {
        const listing = await list(PARENT_F1);
        const owner = (id: string) => listing.items.find((item) => item.id === id)!.owner;
        assert.deepEqual(owner(BOOK_A), { kind: "parent", display_name: "Fenyő Anna" });
        assert.deepEqual(owner(BOOK_TYPED), { kind: "typed", display_name: "Régi Gazda" });
        assert.deepEqual(owner(BOOK_FORMER), { kind: "former", display_name: "korábbi tag" });
        await insertBook(db, {
          id: uuid(9710),
          owner: PARENT_ROW_REMOVED,
          title: "Elköltözött gazda",
          authors: "X",
        });
        await insertLoan(db, { book: BOOK_B, parent: PARENT_ROW_REMOVED, family: FAMILY_REMOVED });
        const after = await list(PARENT_F1);
        assert.equal(
          after.items.find((item) => item.id === uuid(9710))!.owner.display_name,
          "korábbi tag",
        );
        assert.equal(
          after.items.find((item) => item.id === BOOK_B)!.holder_display_name,
          "korábbi tag",
        );
      });

      it("search finds by title or authors, ignores case and accents, and treats % and _ as plain characters", async () => {
        await insertBook(db, {
          id: uuid(9711),
          title: "Árvíztűrő tükörfúrógép",
          authors: "Kiss Ödön",
        });
        await insertBook(db, { id: uuid(9712), title: "100% természetes", authors: "Nagy_Béla" });
        assert.deepEqual(titles(await list(PARENT_F1, "arvizturo")), ["Árvíztűrő tükörfúrógép"]);
        assert.deepEqual(titles(await list(PARENT_F1, "ÁRVÍZTŰRŐ")), ["Árvíztűrő tükörfúrógép"]);
        assert.deepEqual(titles(await list(PARENT_F1, "odon")), ["Árvíztűrő tükörfúrógép"]);
        assert.deepEqual(titles(await list(PARENT_F1, "molnar")), ["Pál utcai fiúk"]);
        assert.deepEqual(titles(await list(PARENT_F1, "  herceg  ")), ["A kis herceg"]);
        assert.deepEqual(titles(await list(PARENT_F1, "100%")), ["100% természetes"]);
        assert.deepEqual(titles(await list(PARENT_F1, "%")), ["100% természetes"]);
        assert.deepEqual(titles(await list(PARENT_F1, "_")), ["100% természetes"]);
        assert.deepEqual(titles(await list(PARENT_F1, "\\")), []);
        assert.equal((await list(PARENT_F1, "")).items.length, 6);
        assert.deepEqual(titles(await list(PARENT_F1, "nincs ilyen könyv")), []);
      });

      it("an empty library and an empty search are a success with no items, never a refusal", async () => {
        await db.query("delete from books");
        const empty = await list(PARENT_F1);
        assert.deepEqual([empty.state, empty.items], ["success", []]);
      });

      it("caller says who may add: parents, coordinators and super admins, and not a teacher", async () => {
        assert.equal((await list(PARENT_F1)).caller.can_add, true);
        assert.equal((await list(SUPER_ADMIN)).caller.can_add, true);
        assert.equal((await list(TEACHER_G1)).caller.can_add, false);
      });

      it("out of reach: a reader of another community sees none of these books; an account with no role, a deactivated and a signed-out account are refused", async () => {
        const other = await list(OTHER_ADMIN);
        assert.equal(other.state, "success");
        assert.deepEqual(titles(other), ["Idegen könyv"]);
        assert.deepEqual(
          [(await list(OUTSIDER)).state, (await list(OUTSIDER)).code],
          ["denied", "authorization_denied"],
        );
        assert.equal((await list(DEACTIVATED)).state, "denied");
        assert.deepEqual(
          [(await list(SIGNED_OUT)).state, (await list(SIGNED_OUT)).code],
          ["denied", "session_inactive"],
        );
        const signedOut = await failureOf(() =>
          asActor(db, schema, { role: "anon" }, () => db.query("select library_list(null)")),
        );
        assert.ok(signedOut, "the anonymous role has no right to the read");
      });
    });

    describe("W2 one book", () => {
      it("allowed: the book, where it is, the holder and the caller's own request, with what the caller may do", async () => {
        await insertLoan(db, { book: BOOK_A, parent: PARENT_ROW_F2, family: uuid(202) });
        await insertWatch(db, BOOK_A, uuid(607));
        const owner = await get(PARENT_F1, BOOK_A);
        assert.equal(owner.state, "success");
        assert.equal(owner.book.state, "borrowed");
        assert.equal(owner.loan?.holder_display_name, "Napraforgó Csilla");
        assert.equal(owner.loan?.is_mine, false);
        assert.deepEqual(owner.caller, {
          can_edit: true,
          can_remove: false,
          can_borrow: false,
          can_return: true,
          can_set_until: false,
          can_watch: false,
          is_watching: false,
        });
        const holder = await get(PARENT_F2, BOOK_A);
        assert.equal(holder.caller.can_set_until, true);
        assert.equal(holder.caller.can_watch, false);
        const watcher = await get(ADMIN_G1, BOOK_A);
        assert.deepEqual([watcher.caller.is_watching, watcher.caller.can_watch], [true, false]);
        const other = await get(CO_PARENT_F1, BOOK_A);
        assert.deepEqual(
          [other.caller.can_watch, other.caller.can_borrow, other.caller.can_return],
          [true, false, false],
        );
      });

      it("an available book can be borrowed by a parent with a family who does not own it; a super admin returns a book with no owner with rights", async () => {
        const reader = await get(PARENT_F2, BOOK_A);
        assert.equal(reader.caller.can_borrow, true);
        assert.equal(reader.loan, null);
        assert.equal((await get(PARENT_F1, BOOK_A)).caller.can_borrow, false);
        await insertLoan(db, { book: BOOK_TYPED, parent: PARENT_ROW_F1, family: FAMILY_1 });
        assert.equal((await get(SUPER_ADMIN, BOOK_TYPED)).caller.can_return, true);
        assert.equal((await get(PARENT_F2, BOOK_TYPED)).caller.can_return, false);
        await insertLoan(db, { book: BOOK_B, parent: PARENT_ROW_F1, family: FAMILY_1 });
        assert.equal(
          (await get(SUPER_ADMIN, BOOK_B)).caller.can_return,
          false,
          "an owner with rights records their own return",
        );
        assert.equal((await get(SUPER_ADMIN, BOOK_B)).caller.can_edit, true);
      });

      it("a teacher reads the book and may do nothing; a person with no family cannot borrow", async () => {
        const teacher = await get(TEACHER_G1, BOOK_A);
        assert.equal(teacher.state, "success");
        assert.equal(Object.values(teacher.caller).some(Boolean), false);
        assert.equal(
          (await get(SUPER_ADMIN, BOOK_A)).caller.can_borrow,
          true,
          "the shared world's super admin is a parent too",
        );
      });

      it("a removed book, an unknown id and a book of another community answer as if they did not exist", async () => {
        for (const id of [BOOK_REMOVED, uuid(9998), BOOK_OTHER_ORG]) {
          const result = await get(PARENT_F1, id);
          assert.deepEqual([result.state, result.code], ["denied", "BOOK_UNAVAILABLE"], id);
        }
        assert.deepEqual(
          [(await get(OUTSIDER, BOOK_A)).state, (await get(SIGNED_OUT, BOOK_A)).code],
          ["denied", "session_inactive"],
        );
      });
    });
  });
}

async function openDatabaseFor(schema: string): Promise<pg.Client> {
  const { openDirectoryDatabase } = await import("./directory-support.ts");
  return openDirectoryDatabase(schema);
}

/**
 * The migration over seeded data (NFR7.5): a private schema is built up to the file before this one and filled with
 * rows of the tables the unit leaves alone. The change keeps every row, adds three empty tables, the registry rows and
 * the audit values, and a forced failure leaves the old shape. All names are invented.
 */
describe("library migration over seeded data", () => {
  const schema = "u13_library_migration";
  const CHANGE = "20261058_lending_library.sql";
  const all = readMigrationFiles(`${root}supabase/migrations`);
  const change = all.find((file) => file.name === CHANGE)!;
  const earlier = all.filter((file) => file.name < CHANGE);
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
  const tableCounts = async (): Promise<Record<string, number>> => {
    const tables = (
      await db.query(
        "select table_name from information_schema.tables where table_schema = $1 and table_type = 'BASE TABLE'",
        [schema],
      )
    ).rows.map((row) => row.table_name as string);
    const counts: Record<string, number> = {};
    for (const table of tables) {
      counts[table] = Number(
        (await db.query(`select count(*) as n from "${schema}"."${table}"`)).rows[0].n,
      );
    }
    return counts;
  };

  before(async () => {
    db = await openDatabase();
    await dropSchema();
    await db.query(`create schema ${schema}`);
  });
  after(async () => {
    await dropSchema();
    await db.end();
  });

  it("a forced failure leaves the old shape and every seeded row", async () => {
    await apply(earlier);
    await db.query(`set search_path to ${schema}, pg_catalog`);
    await db.query("insert into organizations (id, name) values ($1, 'Régi iskola')", [
      ORGANIZATION,
    ]);
    await db.query(
      "insert into families (id, organization_id, display_name) values ($1, $2, 'Régi család')",
      [uuid(80001), ORGANIZATION],
    );
    await db.query(
      "insert into parents (id, organization_id, family_id, display_name) values ($1, $2, $3, 'Régi Szülő')",
      [uuid(80002), ORGANIZATION, uuid(80001)],
    );
    await db.query(
      "insert into events (id, organization_id, title, starts_at, ends_at) values ($1, $2, 'Régi ünnep', '2027-01-10T10:00:00Z', '2027-01-10T12:00:00Z')",
      [uuid(80003), ORGANIZATION],
    );
    await assert.rejects(
      apply([{ ...change, sql: change.sql.replace(/commit;\s*$/, "select 1 / 0;\ncommit;\n") }]),
    );
    await db.query("rollback").catch(() => undefined);
    await db.query(`set search_path to ${schema}, pg_catalog`);
    const tables = await db.query(
      "select table_name from information_schema.tables where table_schema = $1 and table_name in ('books', 'loans', 'return_watches')",
      [schema],
    );
    assert.equal(tables.rowCount, 0);
    assert.equal(await count(db, "events"), 1);
    assert.equal(await count(db, "notice_kinds", "kind like 'book%'"), 0);
    await db.query(
      `delete from ${TRACKING_SCHEMA}.applied_migrations where schema_name = $1 and filename = $2`,
      [schema, CHANGE],
    );
  });

  it("keeps every existing row, adds the registry rows and three empty tables (NFR7.5)", async () => {
    await db.query(`set search_path to ${schema}, pg_catalog`);
    const before = await tableCounts();
    const result = await apply([...earlier, change]);
    assert.deepEqual(result.applied, [CHANGE]);
    await db.query(`set search_path to ${schema}, pg_catalog`);
    const after = await tableCounts();
    const grew: Record<string, number> = {
      notice_targets: 1,
      notice_kinds: 2,
      timed_check_registry: 1,
    };
    for (const [table, rows] of Object.entries(before)) {
      assert.equal(after[table], rows + (grew[table] ?? 0), table);
    }
    for (const table of ["books", "loans", "return_watches"]) {
      assert.equal(after[table], 0, table);
    }
    assert.equal(after["events"], 1);
    assert.equal(after["parents"], 1);
  });

  it("registers the daily check as the last daily check, active", async () => {
    await db.query(`set search_path to ${schema}, pg_catalog`);
    const row = (
      await db.query("select * from timed_check_registry where check_name = 'library_return_due'")
    ).rows[0];
    assert.deepEqual(
      [row.function_name, row.run_kind, row.is_active, row.lock_step],
      ["library_due_check", "daily", true, 4],
    );
    const highest = (await db.query("select max(lock_step) as m from timed_check_registry")).rows[0]
      .m;
    assert.equal(highest, 4);
  });

  it("is applied once: a second run applies nothing", async () => {
    const again = await apply([...earlier, change]);
    assert.deepEqual(again.applied, []);
  });
});
