import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import { createSignInService } from "../../src/identity/service.ts";
import {
  callFunction,
  DIRECTORY_SCHEMAS,
  nextKey,
  openDirectoryDatabase,
  ORGANIZATION,
  seedDirectoryWorld,
  SUPER_ADMIN,
  uuid,
} from "./directory-support.ts";
import {
  asServiceRole,
  auditEvents,
  callAs,
  count,
  emailHashFor,
  tokenHashFor,
} from "./identity-support.ts";
import {
  ensureAccount,
  lockSchemas,
  openDatabase,
  prepareSchema,
  serviceKey,
  stackSettings,
} from "./stack-support.ts";

const settings = stackSettings();
const apiUrl = settings.apiUrl.replace(/\/$/, "");
const PASSWORD = `Plenty-of-${randomBytes(6).toString("hex")}-1`;
const address = (tag: string) =>
  `emailchange.${tag}.${randomBytes(4).toString("hex")}@example.test`;

async function createUser(email: string): Promise<string> {
  const response = await fetch(`${apiUrl}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: serviceKey(),
      Authorization: `Bearer ${serviceKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password: PASSWORD, email_confirm: true }),
  });
  assert.equal(response.status, 200, "the sign-in service creates the test user");
  return ((await response.json()) as { id: string }).id;
}

async function signIn(email: string): Promise<string> {
  const response = await fetch(`${apiUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: settings.publicKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  assert.equal(response.status, 200, "the user can sign in");
  return ((await response.json()) as { access_token: string }).access_token;
}

/** A signed-in person asking the sign-in service directly to change their own email. */
function changeOwnEmail(token: string, email: string): Promise<Response> {
  return fetch(`${apiUrl}/auth/v1/user`, {
    method: "PUT",
    headers: {
      apikey: settings.publicKey,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email }),
  });
}

/**
 * Regression for the code review's second Major finding: a direct email change used to succeed, so a
 * signed-in person could take a pending invitee's address and password reset for the old address went
 * silent. The trigger on the sign-in user table is global to the database, so this runs once.
 */
describe("sign-in email changes are refused at the sign-in user table", () => {
  let db: pg.Client;
  before(async () => {
    db = await openDatabase();
    await lockSchemas(db, ["public"]);
    await prepareSchema(db, "public");
  });
  after(async () => {
    await db.end();
  });

  const storedEmail = async (id: string) =>
    (await db.query("select email, email_change from auth.users where id = $1", [id])).rows[0] as {
      email: string;
      email_change: string | null;
    };

  it("refuses a signed-in person's direct change to a free address and leaves the user untouched", async () => {
    const original = address("self");
    const id = await createUser(original);
    const token = await signIn(original);
    const response = await changeOwnEmail(token, address("free"));
    assert.ok(response.status >= 400, `the change is refused (got ${response.status})`);
    const stored = await storedEmail(id);
    assert.equal(stored.email, original);
    assert.ok(!stored.email_change, "no email change was started either");
    assert.equal((await signIn(original)).length > 0, true, "the old address still signs in");
  });

  it("refuses taking the address of someone with a pending invitation, so the invitation can still be accepted", async () => {
    const original = address("taker");
    const invitee = address("invitee");
    const id = await createUser(original);
    const token = await signIn(original);
    const response = await changeOwnEmail(token, invitee);
    assert.ok(response.status >= 400, `the change is refused (got ${response.status})`);
    assert.equal((await storedEmail(id)).email, original);
    const free = await db.query(
      "select count(*)::int as n from auth.users where lower(email) = $1",
      [invitee],
    );
    assert.equal(free.rows[0].n, 0, "the invitee's address is still unused by any sign-in user");
  });

  it("keeps password reset working for the original address after a refused change", async () => {
    const original = address("reset");
    await createUser(original);
    const token = await signIn(original);
    await changeOwnEmail(token, address("elsewhere"));
    const service = createSignInService({ url: apiUrl, publicKey: settings.publicKey });
    const outcome = await service.requestRecovery(original);
    assert.equal(outcome.ok, true);
  });

  it("still lets the sign-in service update everything else on the user (last sign-in, password)", async () => {
    const original = address("other");
    const id = await createUser(original);
    await signIn(original);
    const response = await fetch(`${apiUrl}/auth/v1/user`, {
      method: "PUT",
      headers: {
        apikey: settings.publicKey,
        Authorization: `Bearer ${await signIn(original)}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ password: `${PASSWORD}-new` }),
    });
    assert.equal(response.status, 200, "a password change is not an email change");
    assert.equal((await storedEmail(id)).email, original);
  });

  it("refuses an update of the email column made through the database as well, unless the setting allows it", async () => {
    const original = address("sql");
    const id = await createUser(original);
    await assert.rejects(
      () => db.query("update auth.users set email = $2 where id = $1", [id, address("sql-new")]),
      /changing the sign-in email is not allowed/,
    );
    await db.query("begin");
    try {
      await db.query("select set_config('app.identity_email_change', 'allowed', true)");
      const next = address("sql-allowed");
      await db.query("update auth.users set email = $2 where id = $1", [id, next]);
      assert.equal((await storedEmail(id)).email, next);
    } finally {
      await db.query("rollback");
    }
    assert.equal((await storedEmail(id)).email, original, "the rolled-back change left nothing");
  });
});

/**
 * The email-change steps of the database (W5; BR34, the resend limit, NFR1.3 to NFR1.5, NFR3.5, NFR3.6, NFR5), called
 * as the service role the way the app server calls them. The accounts are private to this file, so no other file's
 * shared test identity has its sign-in email changed.
 */
for (const schema of DIRECTORY_SCHEMAS) {
  describe(`email change in ${schema}`, () => {
    let db: pg.Client;
    const extra: pg.Client[] = [];
    let counter = 0;
    const made: string[] = [];

    before(async () => {
      db = await openDirectoryDatabase(schema);
      extra.push(await openDatabase(), await openDatabase());
    });
    after(async () => {
      for (const id of made) {
        await db.query("delete from auth.users where id = $1", [id]).catch(() => undefined);
      }
      await Promise.all(extra.map((client) => client.end()));
      await db.end();
    });
    beforeEach(async () => {
      await seedDirectoryWorld(db, schema);
    });

    /** A parent with an active account of their own, in a family of their own with a second parent. */
    async function makeParent(): Promise<{
      account: string;
      parent: string;
      family: string;
      email: string;
    }> {
      counter += 1;
      const tag = `${process.pid}${counter}`;
      const account = `cccccccc-0000-4000-8000-${tag.padStart(12, "0").slice(-12)}`;
      const email = `emailchange.${tag}@example.test`;
      made.push(account);
      await ensureAccount(db, { id: account, organization: ORGANIZATION, email });
      const family = uuid(30000 + counter);
      const parent = uuid(31000 + counter);
      await db.query(
        "insert into families (id, organization_id, display_name) values ($1, $2, $3)",
        [family, ORGANIZATION, `Levél család ${counter}`],
      );
      await db.query(
        "insert into parents (id, organization_id, family_id, display_name, account_id) values ($1, $2, $3, $4, $5)",
        [parent, ORGANIZATION, family, `Levél szülő ${counter}`, account],
      );
      await db.query(
        "insert into parents (id, organization_id, family_id, display_name) values ($1, $2, $3, $4)",
        [uuid(32000 + counter), ORGANIZATION, family, `Levél társ ${counter}`],
      );
      await db.query(
        "insert into parent_profiles (parent_id, organization_id, email_on_record) values ($1, $2, $3)",
        [parent, ORGANIZATION, email],
      );
      return { account, parent, family, email };
    }
    const request = (
      account: string,
      email: string | null,
      label = "a",
      key = nextKey("req"),
      client: pg.Client = db,
    ) =>
      callAs(client, schema, asServiceRole, "email_change_request($1, $2, $3, $4, $5)", [
        key,
        account,
        email,
        tokenHashFor(`${label}-${key}`),
        emailHashFor(email ?? label),
      ]);
    const confirm = (token: string, client: pg.Client = db) =>
      callAs(client, schema, asServiceRole, "email_change_confirm($1)", [token]);
    const one = async (sql: string, values: unknown[] = []) =>
      (await db.query(sql, values)).rows[0] as Record<string, unknown>;
    const fresh = (tag: string) => `neu.${tag}.${process.pid}.${++counter}@example.test`;
    const pendingToken = async (account: string) =>
      (
        await one(
          "select token_hash from email_change_requests where account_id = $1 and status = 'pending'",
          [account],
        )
      ).token_hash as string;

    it("starts a request: the hash only, 24 hours, one audit row with the account as actor, and the pending address only through the pending read (BR34.1, NFR1.3)", async () => {
      const { account } = await makeParent();
      const next = fresh("one");
      const result = await request(account, next);
      assert.equal(result.state, "success", JSON.stringify(result));
      const row = await one(
        "select new_email, token_hash, status, extract(epoch from expires_at - created_at)::int as span from email_change_requests where account_id = $1",
        [account],
      );
      assert.equal(row.new_email, next);
      assert.match(String(row.token_hash), /^[a-f0-9]{64}$/);
      assert.equal(row.span, 24 * 3600, "24 hours");
      const events = (await auditEvents(db)).filter(
        (event) => event.action === "account.email_change_requested",
      );
      assert.deepEqual(
        events.map((event) => [event.actor_account_id, event.target_id, event.details]),
        [[account, account, null]],
      );
      const pending = await callAs(db, schema, asServiceRole, "email_change_pending($1)", [
        account,
      ]);
      assert.deepEqual([pending.code, pending.new_email], ["pending", next]);
      const list = JSON.stringify(await callFunction(db, schema, SUPER_ADMIN, "directory_list()"));
      assert.ok(!list.includes(next), "the pending address is in no read of the directory");
    });

    it("refuses a bad address and an unchanged address, and answers a taken address the same whichever table matched (BR34.2, NFR1.4)", async () => {
      const { account, email } = await makeParent();
      const other = await makeParent();
      await db.query(
        "insert into invitations (email, role, scope_type, scope_id, organization_id, token_hash, created_by_account_id) values ('offen.meghivo@example.test', 'parent', 'family', $1, $2, $3, $4)",
        [other.family, ORGANIZATION, tokenHashFor("open"), SUPER_ADMIN],
      );
      const invalid = await request(account, "nem-cim");
      const same = await request(account, email);
      assert.deepEqual([invalid.code, same.code], ["EMAIL_INVALID", "EMAIL_INVALID"]);
      const taken = [
        await request(account, other.email),
        await request(account, "anna@example.test"),
        await request(account, "offen.meghivo@example.test"),
      ].map((result) => [result.state, result.code, result.field ?? null]);
      assert.deepEqual(taken, [
        ["validation", "EMAIL_UNAVAILABLE", null],
        ["validation", "EMAIL_UNAVAILABLE", null],
        ["validation", "EMAIL_UNAVAILABLE", null],
      ]);
      assert.equal(await count(db, "email_change_requests", `account_id = '${account}'`), 0);
      assert.equal(await count(db, "email_send_attempts"), 0, "a refused try is not counted");
    });

    it("replaces a pending request with a new one, sends a new link for the pending address, and cancels (BR34.3)", async () => {
      const { account } = await makeParent();
      await request(account, fresh("first"), "one");
      const second = fresh("second");
      await request(account, second, "two");
      assert.deepEqual(
        (
          await db.query("select status from email_change_requests where account_id = $1", [
            account,
          ])
        ).rows
          .map((row) => row.status)
          .sort(),
        ["pending", "replaced"],
      );
      const newLink = await request(account, null, "again");
      assert.equal(newLink.state, "success");
      assert.equal(
        (
          await one(
            "select new_email from email_change_requests where account_id = $1 and status = 'pending'",
            [account],
          )
        ).new_email,
        second,
        "the pending address is kept",
      );
      const key = nextKey("cancel");
      const cancelled = await callAs(db, schema, asServiceRole, "email_change_cancel($1, $2)", [
        key,
        account,
      ]);
      assert.equal(cancelled.state, "success");
      const replay = await callAs(db, schema, asServiceRole, "email_change_cancel($1, $2)", [
        key,
        account,
      ]);
      assert.deepEqual([replay.state, replay.code], ["success", "replayed"]);
      const none = await callAs(db, schema, asServiceRole, "email_change_cancel($1, $2)", [
        nextKey("again"),
        account,
      ]);
      assert.deepEqual([none.state, none.code], ["conflict", "EMAIL_REQUEST_NOT_PENDING"]);
      const noRequest = await request(account, null, "none");
      assert.deepEqual(
        [noRequest.state, noRequest.code],
        ["conflict", "EMAIL_REQUEST_NOT_PENDING"],
      );
    });

    it("answers a repeated click with the stored result, refuses a reused key and refuses a deactivated or unlinked account (BR34.1)", async () => {
      const { account, parent } = await makeParent();
      const key = nextKey("click");
      const target = fresh("click");
      const first = await request(account, target, "c", key);
      const again = await request(account, target, "c", key);
      const reused = await request(account, fresh("click2"), "c", key);
      assert.equal(first.state, "success");
      assert.deepEqual([again.state, again.code], ["success", "replayed"]);
      assert.deepEqual([reused.state, reused.code], ["conflict", "idempotency_key_reused"]);
      await db.query("update parents set account_id = null where id = $1", [parent]);
      assert.equal((await request(account, fresh("unlinked"))).state, "denied");
      await db.query("update parents set account_id = $2 where id = $1", [parent, account]);
      await db.query("update accounts set status = 'deactivated' where id = $1", [account]);
      assert.equal((await request(account, fresh("off"))).state, "denied");
    });

    it("limits requests to three an hour to one address; a refused try writes nothing and the window passes (NFR10.3)", async () => {
      const { account } = await makeParent();
      const target = fresh("limit");
      for (let index = 0; index < 3; index += 1) {
        assert.equal((await request(account, target, "limit")).state, "success", `send ${index}`);
      }
      const refused = await request(account, target, "limit");
      assert.deepEqual([refused.state, refused.code], ["conflict", "EMAIL_RATE_LIMITED"]);
      assert.equal(await count(db, "email_send_attempts", "kind = 'email_change'"), 3);
      await db.query("update email_send_attempts set sent_at = now() - interval '61 minutes'");
      assert.equal((await request(account, target, "limit")).state, "success");
    });

    it("refuses every direct call of a signed-in account, so the password check cannot be skipped (NFR3.5, NFR3.6)", async () => {
      const { account } = await makeParent();
      const calls: [string, unknown[]][] = [
        [
          "email_change_request($1, $2, $3, $4, $5)",
          [nextKey("d"), account, fresh("direct"), tokenHashFor("d"), emailHashFor("d")],
        ],
        ["email_change_cancel($1, $2)", [nextKey("d"), account]],
        ["email_change_confirm($1)", [tokenHashFor("d")]],
        ["email_change_pending($1)", [account]],
        ["account_password_changed($1)", [account]],
      ];
      for (const [sql, values] of calls) {
        for (const actor of [account, SUPER_ADMIN]) {
          const outcome = await callFunction(db, schema, actor, sql, values).then(
            () => "executed",
            (error: { code?: string }) => error.code,
          );
          assert.equal(outcome, "42501", `${sql} as ${actor}`);
        }
      }
      assert.equal(await count(db, "email_change_requests"), 0);
    });

    it("confirms the link: the sign-in email, the account email and the address on record change together, once, with one audit row (BR34.4, BR34.6)", async () => {
      const { account, parent, email } = await makeParent();
      const next = fresh("done");
      await request(account, next);
      const token = await pendingToken(account);
      const done = await confirm(token);
      assert.equal(done.state, "success", JSON.stringify(done));
      assert.equal(done.previous_email, email);
      assert.deepEqual(
        [
          (await one("select email from auth.users where id = $1", [account])).email,
          (await one("select email from accounts where id = $1", [account])).email,
          (await one("select email_on_record from parent_profiles where parent_id = $1", [parent]))
            .email_on_record,
          (await one("select status from email_change_requests where account_id = $1", [account]))
            .status,
        ],
        [next, next, next, "confirmed"],
      );
      assert.equal(
        (await auditEvents(db)).filter((event) => event.action === "account.email_changed").length,
        1,
      );
      const second = await confirm(token);
      assert.deepEqual([second.state, second.code], ["terminal", "EMAIL_LINK_INVALID"]);
      await assert.rejects(
        () => db.query("update auth.users set email = $2 where id = $1", [account, fresh("sql")]),
        /changing the sign-in email is not allowed/,
        "the guard is closed again after the confirmation",
      );
    });

    it("gives one fixed answer to an unknown, expired, deactivated or used link, and cancels a request whose address was taken meanwhile (BR34.4)", async () => {
      const a = await makeParent();
      await request(a.account, fresh("exp"));
      await db.query(
        "update email_change_requests set expires_at = now() - interval '1 minute', created_at = now() - interval '25 hours' where account_id = $1",
        [a.account],
      );
      const expired = await confirm(await pendingToken(a.account).catch(() => tokenHashFor("x")));
      const unknown = await confirm(tokenHashFor("unknown"));
      assert.deepEqual([expired.state, expired.code], ["terminal", "EMAIL_LINK_INVALID"]);
      assert.deepEqual([unknown.state, unknown.code], ["terminal", "EMAIL_LINK_INVALID"]);
      const b = await makeParent();
      await request(b.account, fresh("off"));
      const offToken = await pendingToken(b.account);
      await db.query("update accounts set status = 'deactivated' where id = $1", [b.account]);
      assert.equal((await confirm(offToken)).code, "EMAIL_LINK_INVALID");
      const c = await makeParent();
      const wanted = fresh("race");
      await request(c.account, wanted);
      const token = await pendingToken(c.account);
      await db.query("update parent_profiles set email_on_record = $2 where parent_id = $1", [
        a.parent,
        wanted,
      ]);
      const taken = await confirm(token);
      assert.deepEqual([taken.state, taken.code], ["validation", "EMAIL_UNAVAILABLE"]);
      assert.equal(
        (await one("select status from email_change_requests where account_id = $1", [c.account]))
          .status,
        "cancelled",
        "the request was cancelled and the cancellation committed",
      );
      assert.equal(
        (await one("select email from accounts where id = $1", [c.account])).email,
        c.email,
      );
    });

    it("lets one of two confirmations of one link at once win, repeated without a deadlock (NFR5)", async () => {
      for (let round = 0; round < 5; round += 1) {
        const { account } = await makeParent();
        await request(account, fresh(`two${round}`));
        const token = await pendingToken(account);
        const results = await Promise.all([confirm(token, extra[0]), confirm(token, extra[1])]);
        assert.deepEqual(
          results.map((result) => result.code ?? result.state).sort(),
          ["EMAIL_LINK_INVALID", "success"],
          `round ${round}`,
        );
      }
    });

    it("lets two requests at once leave exactly one pending request, without a deadlock (NFR5)", async () => {
      for (let round = 0; round < 5; round += 1) {
        const { account } = await makeParent();
        const results = await Promise.all([
          request(account, fresh(`ra${round}`), "ra", nextKey("a"), extra[0]),
          request(account, fresh(`rb${round}`), "rb", nextKey("b"), extra[1]),
        ]);
        assert.ok(
          results.every((result) => result.state === "success"),
          JSON.stringify(results),
        );
        assert.equal(
          await count(
            db,
            "email_change_requests",
            `account_id = '${account}' and status = 'pending'`,
          ),
          1,
        );
      }
    });

    it("runs deactivation against confirmation without a deadlock, and removes the pending request with the parent (BR36.3, NFR5.6)", async () => {
      for (let round = 0; round < 6; round += 1) {
        const { account, parent } = await makeParent();
        await request(account, fresh(`dc${round}`));
        const token = await pendingToken(account);
        const results = await Promise.all([
          confirm(token, extra[0]),
          callFunction(extra[1]!, schema, SUPER_ADMIN, "account_deactivate($1, $2)", [
            nextKey("d"),
            account,
          ]),
        ]);
        assert.ok(
          results.every((result) => ["success", "terminal", "conflict"].includes(result.state)),
          JSON.stringify(results),
        );
        assert.equal(
          (await one("select status from accounts where id = $1", [account])).status,
          "deactivated",
        );
        if (round % 2 === 0) {
          await db.query(
            "update email_change_requests set status = 'pending', decided_at = null where account_id = $1 and status = 'cancelled'",
            [account],
          );
          const version = (await one("select version from parents where id = $1", [parent]))
            .version;
          await callFunction(db, schema, SUPER_ADMIN, "parent_remove($1, $2, $3)", [
            nextKey("r"),
            parent,
            version,
          ]);
          assert.equal(await count(db, "email_change_requests", `account_id = '${account}'`), 0);
        }
      }
    });

    it("deletes finished requests 30 days after they finished, expired pending ones too, and resend rows after 24 hours (NFR1.5, NFR10.3)", async () => {
      const { account } = await makeParent();
      await db.query(
        `insert into email_change_requests (account_id, new_email, token_hash, status, created_at, expires_at, decided_at) values
           ($1, 'a.old@example.test', $2, 'confirmed', now() - interval '40 days', now() - interval '39 days', now() - interval '31 days'),
           ($1, 'b.recent@example.test', $3, 'cancelled', now() - interval '10 days', now() - interval '9 days', now() - interval '5 days')`,
        [account, tokenHashFor("h1"), tokenHashFor("h2")],
      );
      await db.query(
        "insert into email_change_requests (account_id, new_email, token_hash, created_at, expires_at) values ($1, 'c.expired@example.test', $2, now() - interval '33 days', now() - interval '32 days')",
        [account, tokenHashFor("h3")],
      );
      await db.query(
        "insert into email_send_attempts (kind, email_hash, sent_at) values ('email_change', $1, now() - interval '25 hours'), ('invitation', $1, now() - interval '1 hour')",
        [emailHashFor("h")],
      );
      const result = await callAs(db, schema, asServiceRole, "identity_housekeeping()", []);
      assert.equal(result.state, "success", JSON.stringify(result));
      assert.deepEqual([result.email_requests_removed, result.send_attempts_removed], [2, 1]);
      assert.deepEqual((await db.query("select new_email from email_change_requests")).rows, [
        { new_email: "b.recent@example.test" },
      ]);
      assert.equal(await count(db, "email_send_attempts"), 1);
    });

    it("writes the password-change audit row with the account as actor, for the service role only (NFR4)", async () => {
      const { account } = await makeParent();
      const done = await callAs(db, schema, asServiceRole, "account_password_changed($1)", [
        account,
      ]);
      assert.equal(done.state, "success");
      const events = (await auditEvents(db)).filter(
        (event) => event.action === "account.password_changed",
      );
      assert.deepEqual(
        events.map((event) => [event.actor_account_id, event.target_id, event.outcome]),
        [[account, account, "success"]],
      );
      const missing = await callAs(db, schema, asServiceRole, "account_password_changed($1)", [
        uuid(99999),
      ]);
      assert.deepEqual([missing.state, missing.code], ["validation", "account_not_found"]);
    });
  });
}
