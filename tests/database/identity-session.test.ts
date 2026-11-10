import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import {
  ADMIN_G1,
  ADMIN_G2,
  asActor,
  asServiceRole,
  ASSIGNMENT_1,
  authenticated,
  callAs,
  DEACTIVATED,
  FAMILY_1,
  FAMILY_2,
  failureOf,
  GROUP_1,
  GROUP_2,
  IDENTITY_SCHEMAS,
  openIdentityDatabase,
  ORGANIZATION,
  OTHER_ADMIN,
  OUTSIDER,
  PARENT_F1,
  PARENT_F2,
  seedGroupAssignment,
  seedIdentityWorld,
  sessionIdFor,
  SIGNED_OUT,
  SUPER_ADMIN,
  TEACHER_G1,
  tokenHashFor,
  uuid,
} from "./identity-support.ts";
import { report } from "./stack-support.ts";

type Matrix = Record<string, Record<string, number>>;

/** Active session and access checks: four token states, and the policy matrix per role and table (BR2.6, BR2.15, NFR1.1, NFR1.2). */
for (const schema of IDENTITY_SCHEMAS) {
  describe(`identity session and policy matrix in ${schema}`, () => {
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

    const active = (account: string, session?: string | null) =>
      asActor(
        db,
        schema,
        authenticated(account, session),
        async () =>
          (await db.query("select current_session_is_active() as active")).rows[0]
            .active as boolean,
      );

    it("is active only for a live session of an active account", async () => {
      assert.equal(await active(SUPER_ADMIN), true);
      assert.equal(await active(PARENT_F1), true);
    });

    it("is not active for a signed-out session, an idle one, a deactivated account or a token that never had a session", async () => {
      assert.equal(await active(SIGNED_OUT), false, "no session row");
      assert.equal(await active(DEACTIVATED), false, "deactivated");
      assert.equal(await active(SUPER_ADMIN, uuid(9999)), false, "unknown session id");
      assert.equal(await active(SUPER_ADMIN, null), false, "no session id claim at all");
      assert.equal(
        await active(SUPER_ADMIN, sessionIdFor(PARENT_F1)),
        false,
        "another account's session",
      );
      await db.query(
        "update auth.sessions set refreshed_at = (now() - interval '31 days') at time zone 'utc' where id = $1",
        [sessionIdFor(SUPER_ADMIN)],
      );
      assert.equal(await active(SUPER_ADMIN), false, "idle for 31 days");
      await db.query(
        "update auth.sessions set refreshed_at = (now() - interval '29 days') at time zone 'utc' where id = $1",
        [sessionIdFor(SUPER_ADMIN)],
      );
      assert.equal(await active(SUPER_ADMIN), true, "idle for 29 days");
      await db.query(
        "update auth.sessions set not_after = now() - interval '1 minute' where id = $1",
        [sessionIdFor(SUPER_ADMIN)],
      );
      assert.equal(await active(SUPER_ADMIN), false, "past its end");
    });

    it("is not active for anon or the service role, which carry no session", async () => {
      for (const actor of [{ role: "anon" as const }, asServiceRole]) {
        const result = await asActor(db, schema, actor, () =>
          db
            .query("select current_session_is_active() as active")
            .catch((error) => ({ rows: [{ error: error.code }] })),
        );
        assert.ok(result.rows[0].active === false || result.rows[0].error === "42501", actor.role);
      }
    });

    it("refuses every policy helper once the session ends, then accepts again for a live one", async () => {
      const helpers = [
        `has_current_role_scope('super_admin', '${ORGANIZATION}', 'organization', '${ORGANIZATION}')`,
        `has_super_scope('${ORGANIZATION}')`,
        `has_core_scope('${ORGANIZATION}', '${GROUP_1}')`,
        `authorization_version_for('${SUPER_ADMIN}') is not null`,
      ];
      for (const helper of helpers) {
        const read = (session?: string | null) =>
          asActor(
            db,
            schema,
            authenticated(SUPER_ADMIN, session),
            async () => (await db.query(`select ${helper} as value`)).rows[0].value,
          );
        assert.equal(await read(), true, helper);
        assert.equal(Boolean(await read(uuid(9999))), false, `${helper} with an unknown session`);
        assert.equal(Boolean(await read(null)), false, `${helper} without a session`);
      }
    });

    /** Expected number of visible rows per table for each of the eight viewers of the seeded world. */
    const MATRIX: Matrix = {
      app_role_grants: {
        parent: 1,
        teacher: 1,
        adminSame: 1,
        adminOther: 1,
        super: 9,
        nogrant: 0,
        deactivated: 0,
        signedOut: 0,
      },
      app_authorization_versions: {
        parent: 1,
        teacher: 1,
        adminSame: 1,
        adminOther: 1,
        super: 1,
        nogrant: 0,
        deactivated: 0,
        signedOut: 0,
      },
      families: {
        parent: 1,
        teacher: 0,
        adminSame: 0,
        adminOther: 0,
        super: 4,
        nogrant: 0,
        deactivated: 0,
        signedOut: 0,
      },
      assignments: {
        parent: 0,
        teacher: 0,
        adminSame: 1,
        adminOther: 0,
        super: 1,
        nogrant: 0,
        deactivated: 0,
        signedOut: 0,
      },
      accounts: {
        parent: 1,
        teacher: 1,
        adminSame: 1,
        adminOther: 1,
        super: 10,
        nogrant: 1,
        deactivated: 0,
        signedOut: 0,
      },
      invitations: {
        parent: 0,
        teacher: 0,
        adminSame: 0,
        adminOther: 0,
        super: 3,
        nogrant: 0,
        deactivated: 0,
        signedOut: 0,
      },
      audit_events: {
        parent: 0,
        teacher: 0,
        adminSame: 1,
        adminOther: 1,
        super: 3,
        nogrant: 0,
        deactivated: 0,
        signedOut: 0,
      },
    };
    const VIEWERS: Record<string, string> = {
      parent: PARENT_F1,
      teacher: TEACHER_G1,
      adminSame: ADMIN_G1,
      adminOther: ADMIN_G2,
      super: SUPER_ADMIN,
      nogrant: OUTSIDER,
      deactivated: DEACTIVATED,
      signedOut: SIGNED_OUT,
    };

    async function seedInvitationsAndEvents() {
      await seedGroupAssignment(db);
      const invite = (
        email: string,
        role: string,
        scopeType: string,
        scope: string,
        by: string,
        label: string,
      ) =>
        db.query(
          "insert into invitations (email, role, scope_type, scope_id, organization_id, token_hash, created_by_account_id) values ($1, $2, $3, $4, $5, $6, $7)",
          [email, role, scopeType, scope, ORGANIZATION, tokenHashFor(label), by],
        );
      await invite("one@example.test", "parent", "family", FAMILY_1, SUPER_ADMIN, "i1");
      await invite(
        "two@example.test",
        "kindergarten_teacher",
        "organization",
        ORGANIZATION,
        SUPER_ADMIN,
        "i2",
      );
      await invite(
        "three@example.test",
        "super_admin",
        "organization",
        ORGANIZATION,
        SUPER_ADMIN,
        "i3",
      );
      for (const group of [GROUP_1, GROUP_2, null]) {
        await db.query(
          "insert into audit_events (actor_account_id, actor_role, action, target_type, target_id, organization_id, group_id, outcome) values ($1, 'super_admin', 'role.grant', 'account', $2, $3, $4, 'success')",
          [SUPER_ADMIN, PARENT_F1, ORGANIZATION, group],
        );
      }
    }

    it("shows each role exactly its rows of every table (the policy matrix)", async () => {
      await seedInvitationsAndEvents();
      for (const [table, expected] of Object.entries(MATRIX)) {
        for (const [viewer, account] of Object.entries(VIEWERS)) {
          const rows = await asActor(db, schema, authenticated(account), async () =>
            table === "invitations"
              ? (await db.query("select id from invitations")).rows
              : (await db.query(`select * from ${table}`)).rows,
          );
          assert.equal(rows.length, expected[viewer], `${table} as ${viewer}`);
        }
      }
    });

    it("shows nothing of any table to a signed-out, idle, deactivated or unregistered token, even a super admin's", async () => {
      await seedInvitationsAndEvents();
      await db.query(
        "update auth.sessions set refreshed_at = (now() - interval '40 days') at time zone 'utc' where id = $1",
        [sessionIdFor(ADMIN_G1)],
      );
      const states: [string, string, string | null | undefined][] = [
        ["signed out", SIGNED_OUT, undefined],
        ["idle", ADMIN_G1, undefined],
        ["deactivated", DEACTIVATED, undefined],
        ["never registered", SUPER_ADMIN, uuid(9998)],
        ["no session claim", SUPER_ADMIN, null],
      ];
      for (const table of Object.keys(MATRIX)) {
        for (const [label, account, session] of states) {
          const rows = await asActor(db, schema, authenticated(account, session), async () =>
            table === "invitations"
              ? (await db.query("select id from invitations")).rows
              : (await db.query(`select * from ${table}`)).rows,
          );
          assert.equal(rows.length, 0, `${table} with a ${label} token`);
        }
      }
    });

    it("refuses every direct write to the family and assignment tables to anyone", async () => {
      // Directory and Coordination tables are changed by their named functions only (U3 BR30.1).
      for (const sql of [
        "insert into families (organization_id, display_name) values ($1, 'Közvetlen család')",
        "update families set display_name = 'Közvetlen család'",
        "delete from assignments",
      ]) {
        for (const session of [undefined, uuid(9997)]) {
          const refused = await failureOf(() =>
            asActor(db, schema, authenticated(SUPER_ADMIN, session), () =>
              db.query(sql, sql.includes("$1") ? [ORGANIZATION] : []),
            ),
          );
          assert.equal(
            refused?.code,
            "42501",
            `${sql} with ${session ? "a dead" : "a live"} token`,
          );
        }
      }
    });

    it("refuses the named functions with each dead token state and never changes anything", async () => {
      const calls = [
        `invitation_create('k', 'a@example.test', 'parent', 'family', '${FAMILY_1}', '${tokenHashFor("dead")}', null)`,
        `invitation_resend('k', '${uuid(1)}', '${tokenHashFor("dead2")}')`,
        `invitation_revoke('k', '${uuid(1)}')`,
        `grant_change('k', 'add', '${PARENT_F1}', 'parent', 'family', '${FAMILY_1}')`,
        `account_deactivate('k', '${PARENT_F1}')`,
        `account_reactivate('k', '${PARENT_F1}')`,
        `account_find_by_email('someone@example.test')`,
      ];
      const states: [string, string, string | null | undefined][] = [
        ["signed out", SIGNED_OUT, undefined],
        ["deactivated", DEACTIVATED, undefined],
        ["never registered", SUPER_ADMIN, uuid(9996)],
      ];
      for (const sql of calls) {
        for (const [label, account, session] of states) {
          const result = await callAs(db, schema, authenticated(account, session), sql);
          assert.equal(result.state, "denied", `${sql} with a ${label} token`);
          assert.equal(result.code, "session_inactive");
        }
      }
      const probe = await asActor(
        db,
        schema,
        authenticated(SUPER_ADMIN, uuid(9995)),
        async () =>
          (await db.query("select scope_probe('family', $1) as answer", [FAMILY_1])).rows[0].answer,
      );
      assert.equal(probe, "denied");
      const direct = await failureOf(() =>
        asActor(db, schema, authenticated(SIGNED_OUT), () =>
          db.query("select platform_idempotency_check('x', 'k', $1)", ["a".repeat(64)]),
        ),
      );
      assert.equal(
        direct?.code,
        "42501",
        "the audited-operation building blocks are not callable at all",
      );
      assert.equal((await db.query("select count(*)::int as n from invitations")).rows[0].n, 0);
      assert.equal((await db.query("select count(*)::int as n from audit_events")).rows[0].n, 0);
    });

    it("keeps the version row and grants of another organization's admin out of reach", async () => {
      const own = await asActor(db, schema, authenticated(OTHER_ADMIN), async () => ({
        grants: (await db.query("select id from app_role_grants")).rows.length,
        families: (await db.query("select id from families")).rows.length,
      }));
      assert.deepEqual(own, { grants: 1, families: 0 });
      assert.ok(FAMILY_2 && PARENT_F2 && ASSIGNMENT_1);
    });

    it("adds little time to an ordinary policy-filtered read (reported; fails above 200 ms)", async () => {
      const runs = 50;
      const measure = async (sql: string) => {
        const times: number[] = [];
        for (let index = 0; index < runs; index += 1) {
          const started = performance.now();
          await asActor(db, schema, authenticated(ADMIN_G1), () => db.query(sql));
          times.push(performance.now() - started);
        }
        return times.sort((a, b) => a - b)[Math.floor(runs / 2)]!;
      };
      const plain = await measure("select count(*) from families");
      const checked = await measure(
        "select count(*) from families where current_session_is_active() and directory_reaches_family(organization_id, id)",
      );
      const overhead = checked - plain;
      report(
        `session and access checks in ${schema}: median ${plain.toFixed(2)} ms plain, ${checked.toFixed(2)} ms with extra checks, overhead ${overhead.toFixed(2)} ms (target 50 ms, fails above 200 ms)`,
      );
      assert.ok(overhead < 200);
    });
  });
}
