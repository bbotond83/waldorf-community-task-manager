import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
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
  ORGANIZATION,
  seedIdentityWorld,
  SUPER_ADMIN,
  tokenHashFor,
} from "./identity-support.ts";
import { ensureAccount, report, sessionIdFor } from "./stack-support.ts";

/** Housekeeping with a controllable clock, and the removal of a user's sessions (BR2.2, BR2.12, BR2.21, NFR6.7, NFR4.5). */
for (const schema of IDENTITY_SCHEMAS) {
  describe(`identity housekeeping in ${schema}`, () => {
    let db: pg.Client;

    before(async () => {
      db = await openIdentityDatabase(schema);
    });
    after(async () => {
      await db.end();
    });
    beforeEach(async () => {
      await seedIdentityWorld(db, schema);
    });

    const email = (tag: string) => `${schema}.${tag}@example.test`;
    const housekeeping = () => callAs(db, schema, asServiceRole, "identity_housekeeping()");
    const signInUser = async (tag: string, ageMinutes: number, invitationId?: string) => {
      const id = randomUUID();
      await db.query(
        "insert into auth.users (id, aud, role, email, raw_app_meta_data, created_at, updated_at) values ($1, 'authenticated', 'authenticated', $2, $3, now() - make_interval(mins => $4), now())",
        [
          id,
          email(tag),
          JSON.stringify(invitationId ? { invitation_id: invitationId } : {}),
          ageMinutes,
        ],
      );
      return id;
    };
    const userExists = async (id: string) => (await count(db, "auth.users", `id = '${id}'`)) === 1;

    it("removes sign-in attempts older than 15 minutes and keeps recent ones", async () => {
      const hash = emailHashFor("old@example.test");
      await db.query(
        "insert into sign_in_attempts (email_hash, attempted_at) select $1, now() - make_interval(mins => m) from unnest(array[1, 5, 14, 16, 60]) as m",
        [hash],
      );
      const result = await housekeeping();
      assert.equal(result.state, "success");
      assert.equal(result.attempts_removed, 2);
      assert.equal(await count(db, "sign_in_attempts"), 3);
    });

    it("keeps at most 20 attempts per hash", async () => {
      const hash = emailHashFor("many@example.test");
      await db.query(
        "insert into sign_in_attempts (email_hash, attempted_at) select $1, now() - make_interval(secs => s) from generate_series(1, 30) as s",
        [hash],
      );
      await housekeeping();
      assert.equal(await count(db, "sign_in_attempts"), 20);
    });

    it("removes orphaned invitation users older than an hour that have no Account, and nothing else", async () => {
      const orphan = await signInUser("orphan", 120, randomUUID());
      const young = await signInUser("young", 30, randomUUID());
      const withAccount = await signInUser("kept", 300, randomUUID());
      await db.query("insert into accounts (id, email, organization_id) values ($1, $2, $3)", [
        withAccount,
        email("kept"),
        ORGANIZATION,
      ]);
      const untagged = await signInUser("untagged", 500);
      const result = await housekeeping();
      assert.equal(result.users_removed, 1);
      assert.equal(await userExists(orphan), false);
      for (const kept of [young, withAccount, untagged]) assert.equal(await userExists(kept), true);
    });

    it("removes ended invitations 90 days after they ended, and only those", async () => {
      const insert = async (status: string, tag: string, daysAgo: number) => {
        const result = await db.query(
          "insert into invitations (email, role, scope_type, scope_id, organization_id, token_hash, created_by_account_id, status, created_at, expires_at) values ($1, 'parent', 'family', $2, $3, $4, $5, $6, now() - interval '200 days', now() - interval '193 days') returning id",
          [email(tag), randomUUID(), ORGANIZATION, tokenHashFor(tag), SUPER_ADMIN, status],
        );
        // The version trigger stamps updated_at on every change: switch it off to move the clock back.
        await db.query("alter table invitations disable trigger invitations_touch_version");
        await db.query(
          "update invitations set updated_at = now() - make_interval(days => $2) where id = $1",
          [result.rows[0].id, daysAgo],
        );
        await db.query("alter table invitations enable trigger invitations_touch_version");
        return result.rows[0].id as string;
      };
      const oldRevoked = await insert("revoked", "a", 100);
      const oldAccepted = await insert("accepted", "b", 91);
      const recentRevoked = await insert("revoked", "c", 30);
      const oldPending = await insert("pending", "d", 100);
      const result = await housekeeping();
      assert.equal(result.invitations_removed, 2);
      const left = (await db.query("select id from invitations")).rows.map((row) => row.id);
      assert.deepEqual(left.sort(), [recentRevoked, oldPending].sort());
      assert.ok(oldRevoked && oldAccepted);
      assert.equal(
        result.invitations_expired,
        1,
        "the pending one is past its expiry (reported for the log)",
      );
    });

    it("is safe to run repeatedly: a second run removes nothing", async () => {
      await signInUser("orphan2", 120, randomUUID());
      await db.query(
        "insert into sign_in_attempts (email_hash, attempted_at) values ($1, now() - interval '1 hour')",
        [emailHashFor("x@example.test")],
      );
      const first = await housekeeping();
      const second = await housekeeping();
      assert.equal(first.users_removed, 1);
      assert.deepEqual(
        [second.attempts_removed, second.users_removed, second.invitations_removed],
        [0, 0, 0],
      );
    });

    it("is executable only by the service role", async () => {
      for (const actor of [authenticated(SUPER_ADMIN), { role: "anon" as const }]) {
        const error = await failureOf(() => callAs(db, schema, actor, "identity_housekeeping()"));
        assert.equal(error?.code, "42501", actor.role);
      }
    });

    it("runs within 5 seconds on a data set of 300 accounts (reported)", async () => {
      await db.query(
        `insert into auth.users (id, aud, role, email, raw_app_meta_data, created_at, updated_at)
         select gen_random_uuid(), 'authenticated', 'authenticated', $1 || '.bulk' || n || '@example.test', case when n % 3 = 0 then '{"invitation_id": "x"}'::jsonb else '{}'::jsonb end, now() - interval '3 hours', now()
           from generate_series(1, 300) as n`,
        [schema],
      );
      await db.query(
        `insert into accounts (id, email, organization_id) select u.id, lower(u.email), $2 from auth.users u where u.email like $1 and (u.raw_app_meta_data ? 'invitation_id') is not true`,
        [`${schema}.bulk%`, ORGANIZATION],
      );
      await db.query(
        "insert into sign_in_attempts (email_hash, attempted_at) select md5(n::text) || md5(n::text), now() - interval '2 hours' from generate_series(1, 300) as n",
      );
      const started = performance.now();
      const result = await housekeeping();
      const seconds = (performance.now() - started) / 1000;
      report(
        `housekeeping in ${schema} on 300 accounts: ${seconds.toFixed(2)} s (target 5 s), removed ${result.users_removed} users and ${result.attempts_removed} attempts`,
      );
      assert.equal(result.users_removed, 100);
      assert.equal(result.attempts_removed, 300);
      assert.ok(seconds < 5);
    });

    describe("sessions_remove", () => {
      const remove = (user: string, keep: string | null = null) =>
        callAs(db, schema, asServiceRole, "sessions_remove($1, $2)", [user, keep]);
      /** A user of its own, so removing its sessions never touches the shared test identities of other files. */
      const privateUser = async () => {
        const id = randomUUID();
        await ensureAccount(db, {
          id,
          organization: ORGANIZATION,
          email: email(`private-${id.slice(0, 8)}`),
        });
        return id;
      };

      it("deletes every session of a user together with its refresh tokens, and no other user's", async () => {
        const user = await privateUser();
        const extra = randomUUID();
        await db.query(
          "insert into auth.sessions (id, user_id, created_at, updated_at, refreshed_at) values ($1, $2, now(), now(), now() at time zone 'utc')",
          [extra, user],
        );
        await db.query(
          "insert into auth.refresh_tokens (token, user_id, session_id, revoked) values ($1, $2, $3, false)",
          [randomUUID(), user, extra],
        );
        const bystander = await privateUser();
        const result = await remove(user);
        assert.equal(result.state, "success");
        assert.equal(result.removed, 2);
        assert.equal(await count(db, "auth.sessions", `user_id = '${user}'`), 0);
        assert.equal(await count(db, "auth.refresh_tokens", `session_id = '${extra}'`), 0);
        assert.equal(await count(db, "auth.sessions", `user_id = '${bystander}'`), 1);
      });

      it("can keep one session, so a person who just reset a password stays signed in", async () => {
        const user = await privateUser();
        const other = randomUUID();
        await db.query(
          "insert into auth.sessions (id, user_id, created_at, updated_at, refreshed_at) values ($1, $2, now(), now(), now() at time zone 'utc')",
          [other, user],
        );
        const result = await remove(user, other);
        assert.equal(result.removed, 1);
        assert.equal(await count(db, "auth.sessions", `id = '${other}'`), 1);
        assert.equal(await count(db, "auth.sessions", `id = '${sessionIdFor(user)}'`), 0);
      });

      it("makes the removed session inactive for the database at once", async () => {
        const user = await privateUser();
        await remove(user);
        const active = await callAs(
          db,
          schema,
          authenticated(user),
          "jsonb_build_object('state', 'success', 'reference', null, 'code', current_session_is_active()::text)",
        );
        assert.equal(active.code, "false");
      });

      it("is executable only by the service role and refuses a missing user", async () => {
        for (const actor of [authenticated(SUPER_ADMIN), { role: "anon" as const }]) {
          const error = await failureOf(() =>
            callAs(db, schema, actor, "sessions_remove($1, null)", [SUPER_ADMIN]),
          );
          assert.equal(error?.code, "42501", actor.role);
        }
        assert.equal(
          (await callAs(db, schema, asServiceRole, "sessions_remove(null, null)")).state,
          "validation",
        );
      });
    });
  });
}
