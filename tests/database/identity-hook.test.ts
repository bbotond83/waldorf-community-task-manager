import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import { createAdminAccess } from "../../src/identity/admin-client.ts";
import { createSignInService } from "../../src/identity/service.ts";
import {
  asActor,
  authenticated,
  count,
  failureOf,
  openIdentityDatabase,
  SUPER_ADMIN,
} from "./identity-support.ts";
import { serviceKey, stackSettings } from "./stack-support.ts";

/**
 * The password-verification hook against the real sign-in service (owner decision, BR2.3): direct calls to the
 * service are locked after five wrong passwords, with no screen involved. The hook is wired to the default
 * schema (config.toml), so this file runs there.
 */
const SCHEMA = "public";
const settings = stackSettings();
const apiUrl = settings.apiUrl.replace(/\/$/, "");

describe("the password-verification hook locks direct calls to the sign-in service", () => {
  let db: pg.Client;
  const admin = createAdminAccess({ url: apiUrl, serviceKey: serviceKey(), schema: SCHEMA });
  const service = createSignInService({ url: apiUrl, publicKey: settings.publicKey });
  const secret = () => `Pw-${randomBytes(6).toString("hex")}-1`;

  before(async () => {
    db = await openIdentityDatabase(SCHEMA);
  });
  after(async () => {
    await db.end();
  });
  beforeEach(async () => {
    await db.query("delete from sign_in_attempts");
  });

  async function user(tag: string) {
    const address = `${SCHEMA}.hook-${tag}-${randomBytes(3).toString("hex")}@example.test`;
    const password = secret();
    const created = await admin.createUser({ email: address, password, invitationId: "hook-test" });
    assert.ok(created.ok);
    await db.query("update auth.users set raw_app_meta_data = '{}'::jsonb where id = $1", [
      created.value.id,
    ]);
    return { id: created.value.id, address, password };
  }
  const attempts = (id: string) =>
    count(
      db,
      "sign_in_attempts",
      `email_hash = encode(sha256(convert_to('hook:${id}', 'UTF8')), 'hex')`,
    );

  it("refuses the sixth attempt, even with the right password, after five direct wrong attempts", async () => {
    const who = await user("lock");
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const wrong = await service.passwordSignIn(who.address, `wrong-password-${attempt}`);
      assert.ok(!wrong.ok && wrong.kind === "rejected", "a wrong password is rejected");
    }
    assert.equal(await attempts(who.id), 5);
    const refused = await service.passwordSignIn(who.address, who.password);
    assert.ok(
      !refused.ok && refused.kind === "rejected",
      "the right password is refused while locked",
    );
    assert.equal(await attempts(who.id), 5, "attempts made while locked are not recorded");
    for (let attempt = 0; attempt < 3; attempt += 1)
      await service.passwordSignIn(who.address, "wrong-password-x");
    assert.equal(await attempts(who.id), 5, "the lock never extends itself");
  });

  it("lets the right password in before the lock, and clears the count", async () => {
    const who = await user("clear");
    for (let attempt = 0; attempt < 4; attempt += 1)
      await service.passwordSignIn(who.address, `wrong-password-${attempt}`);
    assert.equal(await attempts(who.id), 4);
    assert.ok((await service.passwordSignIn(who.address, who.password)).ok);
    assert.equal(await attempts(who.id), 0);
  });

  it("opens again 15 minutes after the fifth attempt (controllable clock)", async () => {
    const who = await user("clock");
    for (let attempt = 0; attempt < 5; attempt += 1)
      await service.passwordSignIn(who.address, `wrong-password-${attempt}`);
    assert.ok(!(await service.passwordSignIn(who.address, who.password)).ok);
    await db.query(
      "update sign_in_attempts set attempted_at = attempted_at - interval '16 minutes'",
    );
    assert.ok((await service.passwordSignIn(who.address, who.password)).ok);
  });

  it("counts parallel wrong attempts atomically: only five are recorded and the rest are rejected as locked", async () => {
    const who = await user("race");
    const results = await Promise.all(
      Array.from({ length: 14 }, (_, index) =>
        service.passwordSignIn(who.address, `wrong-password-${index}`),
      ),
    );
    assert.ok(results.every((result) => !result.ok));
    assert.equal(await attempts(who.id), 5);
    assert.ok(!(await service.passwordSignIn(who.address, who.password)).ok);
  });

  it("keeps accounts apart: locking one account leaves another able to sign in", async () => {
    const locked = await user("a");
    const other = await user("b");
    for (let attempt = 0; attempt < 5; attempt += 1)
      await service.passwordSignIn(locked.address, `wrong-password-${attempt}`);
    assert.ok((await service.passwordSignIn(other.address, other.password)).ok);
  });

  it("is executable only by the sign-in service's own role", async () => {
    for (const actor of [
      { role: "anon" as const },
      { role: "service_role" as const },
      authenticated(SUPER_ADMIN),
    ]) {
      const error = await failureOf(() =>
        asActor(db, SCHEMA, actor, () =>
          db.query(`select password_verification_hook('{"user_id": "x", "valid": false}'::jsonb)`),
        ),
      );
      assert.equal(error?.code, "42501", actor.role);
    }
    const privileges = await db.query(
      "select has_function_privilege('supabase_auth_admin', 'password_verification_hook(jsonb)', 'execute') as allowed",
    );
    assert.equal(privileges.rows[0].allowed, true);
  });

  it("makes the service itself require a letter and a digit in every new password", async () => {
    for (const bad of ["abcdefgh", "12345678"]) {
      const created = await admin.createUser({
        email: `${SCHEMA}.req-${randomBytes(3).toString("hex")}@example.test`,
        password: bad,
        invitationId: "hook-test",
      });
      assert.ok(
        !created.ok && created.kind === "rejected" && created.code === "weak_password",
        bad,
      );
    }
  });
});
