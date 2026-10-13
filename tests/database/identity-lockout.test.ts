import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import {
  asServiceRole,
  authenticated,
  callAs,
  count,
  emailHashFor,
  failureOf,
  IDENTITY_SCHEMAS,
  openIdentityDatabase,
  seedIdentityWorld,
  SUPER_ADMIN,
  asActor,
} from "./identity-support.ts";
import { openDatabase, bindSchema } from "./stack-support.ts";

/** The sign-in lockout with a controllable clock: attempt rows are moved back in time (BR2.3, NFR1.10). */
for (const schema of IDENTITY_SCHEMAS) {
  describe(`sign-in lockout in ${schema}`, () => {
    let db: pg.Client;
    const hash = emailHashFor("locked@example.test");

    before(async () => {
      db = await openIdentityDatabase(schema);
    });
    after(async () => {
      await db.end();
    });
    beforeEach(async () => {
      await seedIdentityWorld(db, schema);
    });

    const check = (value = hash) =>
      callAs(db, schema, asServiceRole, "sign_in_lockout_check($1)", [value]);
    const record = (value = hash) =>
      callAs(db, schema, asServiceRole, "sign_in_attempt_record($1)", [value]);
    /** Moves every attempt of the hash back in time: the clock of the test. */
    const age = (minutes: number, value = hash) =>
      db.query(
        "update sign_in_attempts set attempted_at = attempted_at - make_interval(mins => $1) where email_hash = $2",
        [minutes, value],
      );

    it("is open for an address with no attempts, and the same for any hash (no account is looked up)", async () => {
      assert.equal((await check()).code, "open");
      assert.equal((await check(emailHashFor("someone-else@example.test"))).code, "open");
    });

    it("locks on the fifth wrong attempt and not before", async () => {
      for (let attempt = 1; attempt <= 4; attempt += 1) {
        assert.equal((await record()).code, "recorded", `attempt ${attempt}`);
        assert.equal((await check()).code, "open", `after attempt ${attempt}`);
      }
      assert.equal((await record()).code, "recorded");
      assert.equal((await check()).code, "locked");
    });

    it("does not record attempts made while locked, so the lock never extends itself", async () => {
      for (let attempt = 0; attempt < 5; attempt += 1) await record();
      assert.equal(await count(db, "sign_in_attempts"), 5);
      for (let attempt = 0; attempt < 4; attempt += 1)
        assert.equal((await record()).code, "locked");
      assert.equal(await count(db, "sign_in_attempts"), 5);
      await age(14);
      assert.equal(
        (await check()).code,
        "locked",
        "still locked 14 minutes after the fifth attempt",
      );
      await age(2);
      assert.equal((await check()).code, "open", "open 16 minutes after the fifth attempt");
    });

    it("counts the 15 minutes from the fifth attempt, not from the first", async () => {
      await db.query(
        "insert into sign_in_attempts (email_hash, attempted_at) select $1, now() - make_interval(mins => m) from unnest(array[14, 13, 12, 11, 10]) as m",
        [hash],
      );
      assert.equal((await check()).code, "locked");
      await age(6);
      assert.equal(
        (await check()).code,
        "open",
        "16 minutes after the newest, 20 after the oldest",
      );
      await db.query("delete from sign_in_attempts");
      await db.query(
        "insert into sign_in_attempts (email_hash, attempted_at) select $1, now() - make_interval(mins => m) from unnest(array[14, 13, 12, 11, 10]) as m",
        [hash],
      );
      await age(4);
      assert.equal(
        (await check()).code,
        "locked",
        "the oldest is 18 minutes old but the fifth only 14",
      );
    });

    it("does not lock for five attempts spread over more than 15 minutes", async () => {
      await db.query(
        "insert into sign_in_attempts (email_hash, attempted_at) select $1, now() - make_interval(mins => m) from unnest(array[40, 30, 20, 10, 1]) as m",
        [hash],
      );
      assert.equal((await check()).code, "open");
    });

    it("clears the attempts after a successful sign-in", async () => {
      for (let attempt = 0; attempt < 5; attempt += 1) await record();
      assert.equal((await check()).code, "locked");
      assert.equal(
        (await callAs(db, schema, asServiceRole, "sign_in_attempt_clear($1)", [hash])).code,
        "cleared",
      );
      assert.equal((await check()).code, "open");
      assert.equal(await count(db, "sign_in_attempts"), 0);
    });

    it("keeps the hashes apart: locking one address leaves another open", async () => {
      for (let attempt = 0; attempt < 5; attempt += 1) await record();
      assert.equal((await check(emailHashFor("other@example.test"))).code, "open");
    });

    it("keeps at most 20 attempts per hash", async () => {
      await db.query(
        "insert into sign_in_attempts (email_hash, attempted_at) select $1, now() - make_interval(mins => 300 - m) from generate_series(1, 30) as m",
        [hash],
      );
      assert.equal((await record()).code, "recorded");
      assert.equal(await count(db, "sign_in_attempts", `email_hash = '${hash}'`), 20);
    });

    it("refuses a malformed hash without storing anything", async () => {
      for (const bad of ["", "abc", "Z".repeat(64), "A".repeat(64)]) {
        assert.equal(
          (await callAs(db, schema, asServiceRole, "sign_in_attempt_record($1)", [bad])).state,
          "validation",
        );
        assert.equal(
          (await callAs(db, schema, asServiceRole, "sign_in_lockout_check($1)", [bad])).state,
          "validation",
        );
      }
      assert.equal(await count(db, "sign_in_attempts"), 0);
    });

    it("is executable only by the service role: signed-in accounts, anon and the table are out of reach", async () => {
      for (const sql of [
        "sign_in_lockout_check($1)",
        "sign_in_attempt_record($1)",
        "sign_in_attempt_clear($1)",
      ]) {
        for (const actor of [authenticated(SUPER_ADMIN), { role: "anon" as const }]) {
          const error = await failureOf(() => callAs(db, schema, actor, sql, [hash]));
          assert.equal(error?.code, "42501", `${sql} as ${actor.role}`);
        }
      }
      const table = await failureOf(() =>
        asActor(db, schema, asServiceRole, () => db.query("select * from sign_in_attempts")),
      );
      assert.equal(table?.code, "42501");
    });

    it("tells the server whether a reset may be sent: active, deactivated or unknown, ignoring case and spaces", async () => {
      const recovery = (address: string) =>
        callAs(db, schema, asServiceRole, "account_recovery_check($1)", [address]);
      const address = (await db.query("select email from accounts where id = $1", [SUPER_ADMIN]))
        .rows[0].email as string;
      assert.equal((await recovery(`  ${address.toUpperCase()}  `)).code, "active");
      await db.query("update accounts set status = 'deactivated' where id = $1", [SUPER_ADMIN]);
      assert.equal((await recovery(address)).code, "deactivated");
      assert.equal((await recovery("nobody@example.test")).code, "unknown");
      assert.equal((await recovery("")).code, "unknown");
      for (const actor of [authenticated(SUPER_ADMIN), { role: "anon" as const }]) {
        const error = await failureOf(() =>
          callAs(db, schema, actor, "account_recovery_check($1)", [address]),
        );
        assert.equal(error?.code, "42501", actor.role);
      }
    });

    it("handles two simultaneous wrong attempts without an error", async () => {
      const second = await openDatabase();
      try {
        await bindSchema(second, schema);
        const [first, other] = await Promise.all([
          callAs(db, schema, asServiceRole, "sign_in_attempt_record($1)", [hash]),
          callAs(second, schema, asServiceRole, "sign_in_attempt_record($1)", [hash]),
        ]);
        assert.equal(first.state, "success");
        assert.equal(other.state, "success");
        assert.equal(await count(db, "sign_in_attempts"), 2);
      } finally {
        await second.end();
      }
    });
  });
}
