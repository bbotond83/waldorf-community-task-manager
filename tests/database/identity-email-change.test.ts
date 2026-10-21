import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { after, before, describe, it } from "node:test";
import type pg from "pg";
import { createSignInService } from "../../src/identity/service.ts";
import {
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
