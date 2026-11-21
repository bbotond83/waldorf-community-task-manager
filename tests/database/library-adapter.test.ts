import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import { createLibraryPort } from "../../src/data/index.ts";
import { createSignInService } from "../../src/identity/service.ts";
import { createDatabaseClient } from "../../src/runtime/database/client.ts";
import {
  DIRECTORY_SCHEMAS,
  nextKey,
  openDirectoryDatabase,
  PARENT_F1,
  PARENT_F2,
  PARENT_ROW_F1,
  PARENT_ROW_F2,
  seedCoordinationWorld,
  TEACHER_G1,
} from "./directory-support.ts";
import { stackSettings } from "./stack-support.ts";
import { insertBook } from "./library-support.ts";
import { uuid } from "./directory-support.ts";

const settings = stackSettings();
const apiUrl = settings.apiUrl.replace(/\/$/, "");
const SESSION_SECRET = `test-secret-${randomBytes(24).toString("hex")}`;
const PASSWORD = `Pw-${randomBytes(6).toString("hex")}-1`;
const ACCOUNTS = { parent: PARENT_F1, other: PARENT_F2, teacher: TEACHER_G1 } as const;
type Who = keyof typeof ACCOUNTS;

const BOOK_1 = uuid(9801);
const BOOK_2 = uuid(9802);

/**
 * The library port against the real local stack with real sign-in tokens: the data API, the row-level rules and the
 * sign-in service are the stack's own. It proves what the unit tests with a fake gateway cannot: that the names and
 * types the adapter sends are the ones the functions accept (an accented search, a date, a version), and that what
 * comes back is read into the models the screens use.
 */
for (const schema of DIRECTORY_SCHEMAS) {
  describe(`library port in ${schema}`, () => {
    let db: pg.Client;
    const service = createSignInService({ url: apiUrl, publicKey: settings.publicKey });
    const database = createDatabaseClient({
      url: apiUrl,
      publicKey: settings.publicKey,
      sessionSecret: SESSION_SECRET,
      schema,
    });
    const tokens = new Map<string, string>();

    async function port(who: Who) {
      const account = ACCOUNTS[who];
      let token = tokens.get(account);
      if (!token) {
        await db.query(
          `update auth.users set instance_id = '00000000-0000-0000-0000-000000000000',
                  encrypted_password = extensions.crypt($2, extensions.gen_salt('bf')),
                  email_confirmed_at = coalesce(email_confirmed_at, now()),
                  confirmation_token = coalesce(confirmation_token, ''),
                  recovery_token = coalesce(recovery_token, ''),
                  email_change_token_new = coalesce(email_change_token_new, ''),
                  email_change = coalesce(email_change, ''),
                  raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb),
                  raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
            where id = $1`,
          [account, PASSWORD],
        );
        const signedIn = await service.passwordSignIn(`identity.${account}@example.test`, PASSWORD);
        assert.ok(signedIn.ok, `the sign-in service accepts ${who}`);
        token = signedIn.value.accessToken;
        tokens.set(account, token);
      }
      return createLibraryPort(database.forSession(token));
    }

    before(async () => {
      db = await openDirectoryDatabase(schema);
    });
    after(async () => {
      await db.end();
    });
    beforeEach(async () => {
      await seedCoordinationWorld(db, schema);
      await insertBook(db, {
        id: BOOK_1,
        owner: PARENT_ROW_F1,
        title: "A gyermek korai évei",
        authors: "Teszt Szerző",
      });
      await insertBook(db, {
        id: BOOK_2,
        owner: PARENT_ROW_F2,
        title: "Pál utcai fiúk",
        authors: "Molnár Ferenc",
      });
    });

    it("reads the list with and without a search, also with accents and spaces", async () => {
      const parent = await port("parent");
      const all = await parent.list({});
      assert.equal(all.state, "success");
      if (all.state !== "success") return;
      assert.equal(all.data.items.length, 2);
      assert.equal(all.data.canAdd, true);
      for (const search of ["korai évei", "KORAI EVEI", "Teszt"]) {
        const found = await parent.list({ search });
        assert.equal(found.state, "success", search);
        if (found.state === "success")
          assert.deepEqual(
            found.data.items.map((item) => item.id),
            [BOOK_1],
            search,
          );
      }
      const none = await parent.list({ search: "nincs ilyen" });
      assert.equal(none.state === "success" && none.data.items.length, 0);
    });

    it("lets a teacher read the list and a book and refuses every command", async () => {
      const teacher = await port("teacher");
      const list = await teacher.list({});
      assert.equal(list.state === "success" && list.data.canAdd, false);
      const detail = await teacher.detail(BOOK_1);
      assert.equal(detail.state, "success");
      const added = await teacher.addBook({
        idempotencyKey: nextKey("lib"),
        title: "X",
        authors: "Y",
      });
      assert.equal(added.state, "denied");
    });

    it("adds, changes, borrows with a date, watches, returns and removes a book through the data API", async () => {
      const parent = await port("parent");
      const other = await port("other");
      const added = await parent.addBook({
        idempotencyKey: nextKey("lib"),
        title: "Új könyv",
        authors: "Valaki",
        description: "Leírás",
      });
      assert.equal(added.state, "success");
      if (added.state !== "success" || !added.data.id || added.data.version === null)
        return assert.fail("added");
      const bookId = added.data.id;
      const changed = await parent.changeBook({
        idempotencyKey: nextKey("lib"),
        bookId,
        expectedVersion: added.data.version,
        title: "Új könyv 2",
        authors: "Valaki",
      });
      assert.equal(changed.state, "success");
      const detail = await other.detail(bookId);
      assert.equal(detail.state === "success" && detail.data.book.title, "Új könyv 2");
      if (detail.state !== "success") return;
      const until = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);
      const borrowed = await other.borrow({
        idempotencyKey: nextKey("lib"),
        bookId,
        expectedVersion: detail.data.book.version,
        until,
      });
      assert.equal(borrowed.state, "success");
      const borrowedDetail = await other.detail(bookId);
      assert.equal(borrowedDetail.state === "success" && borrowedDetail.data.loan?.until, until);
      if (borrowedDetail.state !== "success" || !borrowedDetail.data.loan)
        return assert.fail("loan");
      const moved = await other.setUntil({
        idempotencyKey: nextKey("lib"),
        loanId: borrowedDetail.data.loan.id,
        expectedVersion: borrowedDetail.data.loan.version,
      });
      assert.equal(moved.state, "success");
      const ownerView = await parent.detail(bookId);
      if (ownerView.state !== "success") return assert.fail("owner view");
      assert.equal(ownerView.data.caller.canReturn, true);
      const returned = await parent.returnBook({
        idempotencyKey: nextKey("lib"),
        bookId,
        expectedVersion: ownerView.data.book.version,
      });
      assert.equal(returned.state, "success");
      const again = await parent.detail(bookId);
      if (again.state !== "success") return assert.fail("again");
      const watching = await other.watch({ idempotencyKey: nextKey("lib"), bookId });
      assert.equal(watching.state, "conflict");
      assert.equal(watching.code, "BOOK_AVAILABLE");
      const removed = await parent.removeBook({
        idempotencyKey: nextKey("lib"),
        bookId,
        expectedVersion: again.data.book.version,
      });
      assert.equal(removed.state, "success");
      const gone = await other.detail(bookId);
      assert.equal(gone.state, "denied");
    });
  });
}
