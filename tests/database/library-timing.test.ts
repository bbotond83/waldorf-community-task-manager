import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type pg from "pg";
import {
  DIRECTORY_SCHEMAS,
  nextKey,
  ORGANIZATION,
  openDirectoryDatabase,
  uuid,
} from "./directory-support.ts";
import { caller, insertBook, seedLibraryWorld, PARENT_ROW_SUPER } from "./library-support.ts";
import { ensureAccount, report } from "./stack-support.ts";
import { PARENT_F1, PARENT_F2, PARENT_ROW_F1, PARENT_ROW_F2 } from "./working-groups-support.ts";

/**
 * Timings of the library's database side on a 300-book set with loan history, open loans and one book with twenty
 * watchers (NFR9.2: add, borrow and return under 1.5 seconds; the daily check under 5 seconds; the list and a book
 * page under 2 seconds). Each call is timed as the median of five runs after one warm-up call, and fails above its
 * ceiling.
 */
const RUNS = 5;
const WATCHERS = 20;
const BOOKS = 300;

for (const schema of DIRECTORY_SCHEMAS) {
  describe(`library timings in ${schema}`, () => {
    let db: pg.Client;
    const BUSIEST = uuid(9900);
    const watchers: string[] = [];

    before(async () => {
      db = await openDirectoryDatabase(schema);
      await seedLibraryWorld(db, schema);
      // 300 books of two owners, a closed loan on every third and an open loan, held by the super admin's family, on every fifth.
      await db.query(
        `insert into books (id, organization_id, title, authors, owner_parent_id)
         select ('00000000-0000-4000-8000-' || lpad((990000 + n)::text, 12, '0'))::uuid, $1, 'Könyv ' || n, 'Szerző ' || (n % 40),
                case when n % 2 = 0 then $2::uuid else $3::uuid end
           from generate_series(1, $4) n`,
        [ORGANIZATION, PARENT_ROW_F1, PARENT_ROW_F2, BOOKS],
      );
      await insertBook(db, {
        id: BUSIEST,
        owner: PARENT_ROW_F1,
        title: "A legtöbbet kért könyv",
        authors: "Valaki",
      });
      const family = (
        await db.query("select family_id from parents where id = $1", [PARENT_ROW_SUPER])
      ).rows[0].family_id;
      await db.query(
        `insert into loans (organization_id, book_id, borrower_parent_id, borrower_family_id, borrowed_at, returned_at)
         select organization_id, id, $2, $3, now() - interval '40 days', now() - interval '30 days' from books where organization_id = $1
          and right(id::text, 6)::int % 3 = 0 and id <> $4`,
        [ORGANIZATION, PARENT_ROW_SUPER, family, BUSIEST],
      );
      await db.query(
        `insert into loans (organization_id, book_id, borrower_parent_id, borrower_family_id, borrowed_at)
         select organization_id, id, $2, $3, now() - interval '5 days' from books where organization_id = $1
          and right(id::text, 6)::int % 5 = 0 and owner_parent_id <> $2 and id <> $4`,
        [ORGANIZATION, PARENT_ROW_SUPER, family, BUSIEST],
      );
      await db.query(
        `insert into loans (organization_id, book_id, borrower_parent_id, borrower_family_id, borrowed_at)
         values ($1, $2, $3, $4, now() - interval '2 days')`,
        [ORGANIZATION, BUSIEST, PARENT_ROW_SUPER, family],
      );
      for (let n = 0; n < WATCHERS; n += 1) {
        const account = uuid(9910 + n);
        const parent = uuid(9940 + n);
        const fam = uuid(9970 + n);
        watchers.push(parent);
        await ensureAccount(db, { id: account, organization: ORGANIZATION });
        await db.query(
          "insert into families (id, organization_id, display_name) values ($1, $2, $3)",
          [fam, ORGANIZATION, `Figyelő család ${n}`],
        );
        await db.query(
          "insert into parents (id, organization_id, family_id, display_name, account_id, status) values ($1, $2, $3, $4, $5, 'active')",
          [parent, ORGANIZATION, fam, `Figyelő ${n}`, account],
        );
        await db.query(
          "insert into return_watches (organization_id, book_id, parent_id) values ($1, $2, $3)",
          [ORGANIZATION, BUSIEST, parent],
        );
      }
      await db.query("analyze");
    });
    after(async () => {
      await db.end();
    });

    const call = caller(() => db, schema);

    async function timed(
      label: string,
      ceiling: number,
      work: () => Promise<unknown>,
      runs = RUNS,
    ) {
      await work();
      const times: number[] = [];
      for (let run = 0; run < runs; run += 1) {
        const started = performance.now();
        await work();
        times.push(performance.now() - started);
      }
      times.sort((a, b) => a - b);
      const median = times[Math.floor(runs / 2)]!;
      report(
        `${label} in ${schema}: median ${median.toFixed(1)} ms, worst ${times[runs - 1]!.toFixed(1)} ms (fails above ${ceiling} ms)`,
      );
      assert.ok(median < ceiling, `${label}: median ${median.toFixed(0)} ms`);
    }

    it("reads the list and one book page on 300 books (NFR9.1)", async () => {
      await timed("library_list", 2000, () => call(PARENT_F1, "library_list(null)"));
      await timed("library_list search", 2000, () =>
        call(PARENT_F1, "library_list($1)", ["szerzo 7"]),
      );
      await timed("library_get", 2000, () => call(PARENT_F1, "library_get($1)", [BUSIEST]));
    });

    it("adds, borrows and returns a book within 1.5 seconds, the return also telling twenty watchers (NFR9.2)", async () => {
      await timed("library_book_add", 1500, () =>
        call(PARENT_F1, "library_book_add($1, $2, $3, null, null)", [
          nextKey("t"),
          "Új időzített könyv",
          "Szerző",
        ]),
      );
      const free = uuid(9899);
      await insertBook(db, {
        id: free,
        owner: PARENT_ROW_F1,
        title: "Szabad könyv",
        authors: "Valaki",
      });
      let version = 1;
      await timed("borrow and return", 1500, async () => {
        const borrowed = await call(PARENT_F2, "library_book_borrow($1, $2, $3, null)", [
          nextKey("b"),
          free,
          version,
        ]);
        assert.equal(borrowed.state, "success");
        version = borrowed.version as number;
        const returned = await call(PARENT_F1, "library_book_return($1, $2, $3)", [
          nextKey("r"),
          free,
          version,
        ]);
        assert.equal(returned.state, "success");
        version = returned.version as number;
      });
      // The book with twenty watchers: the return tells every one of them, once.
      const busiest = await call(PARENT_F1, "library_get($1)", [BUSIEST]);
      const started = performance.now();
      const returned = await call(PARENT_F1, "library_book_return($1, $2, $3)", [
        nextKey("r"),
        BUSIEST,
        (busiest.book as { version: number }).version,
      ]);
      const elapsed = performance.now() - started;
      report(
        `library_book_return with ${WATCHERS} watchers in ${schema}: ${elapsed.toFixed(1)} ms (fails above 1500 ms)`,
      );
      assert.equal(returned.state, "success");
      assert.ok(elapsed < 1500, `return with watchers: ${elapsed.toFixed(0)} ms`);
      const told = await db.query(
        "select count(*)::int as n from notifications where kind = 'book_returned' and parent_id = any ($1)",
        [watchers],
      );
      assert.equal(told.rows[0].n, WATCHERS);
    });

    it("runs the daily check on the open loans of a leaving family within 5 seconds (NFR9.2)", async () => {
      const year = (
        await db.query("select id from school_years where organization_id = $1 limit 1", [
          ORGANIZATION,
        ])
      ).rows[0].id;
      const family = (
        await db.query("select family_id from parents where id = $1", [PARENT_ROW_SUPER])
      ).rows[0].family_id;
      await db.query(
        "insert into family_year_standings (organization_id, family_id, school_year_id, standing) values ($1, $2, $3, 'leaving')",
        [ORGANIZATION, family, year],
      );
      await db.query(
        "update school_years set changeover_date = (current_date + 10) where id = $1",
        [year],
      );
      await timed("library_due_check", 5000, () => db.query("select library_due_check(now())"), 3);
    });
  });
}
