import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import {
  ADMIN_G1,
  ADMIN_G2,
  auditEvents,
  authenticated,
  asActor,
  callAs,
  count,
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
  OTHER_ORGANIZATION,
  OUTSIDER,
  PARENT_F1,
  PARENT_F2,
  seedIdentityWorld,
  SUPER_ADMIN,
  TEACHER_G1,
  uuid,
} from "./identity-support.ts";
import { ensureAccount, openDatabase, sessionIdFor, bindSchema } from "./stack-support.ts";

const SECOND_SUPER = "bbbbbbbb-0000-4000-8000-000000000021";

/** Grant changes, deactivation, reactivation and account lookup: reach, audit, atomicity and the last-super-admin race (BR2.2, BR2.14, NFR1.12, NFR6.3). */
for (const schema of IDENTITY_SCHEMAS) {
  describe(`identity grants in ${schema}`, () => {
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

    let counter = 0;
    const key = () => `grant-key-${(counter += 1)}`;
    const change = (
      account: string,
      action: "add" | "revoke",
      subject: string,
      role: string,
      scopeType: string,
      scope: string,
      connection: pg.Client = db,
      theKey = key(),
    ) =>
      callAs(connection, schema, authenticated(account), "grant_change($1, $2, $3, $4, $5, $6)", [
        theKey,
        action,
        subject,
        role,
        scopeType,
        scope,
      ]);
    const deactivate = (account: string, target: string, connection: pg.Client = db) =>
      callAs(connection, schema, authenticated(account), "account_deactivate($1, $2)", [
        key(),
        target,
      ]);
    const reactivate = (account: string, target: string) =>
      callAs(db, schema, authenticated(account), "account_reactivate($1, $2)", [key(), target]);
    const version = async (account: string) =>
      (
        await db.query(
          "select authorization_version from app_authorization_versions where subject_id = $1",
          [account],
        )
      ).rows[0]?.authorization_version as number;
    const activeGrants = async (account: string) =>
      (
        await db.query(
          "select role, scope_id from app_role_grants where subject_id = $1 and revoked_at is null order by role, scope_id",
          [account],
        )
      ).rows;
    const addSecondSuper = async () => {
      await ensureAccount(db, { id: SECOND_SUPER, organization: ORGANIZATION });
      await db.query(
        "insert into app_role_grants (subject_id, role, scope_type, scope_id, organization_id) values ($1, 'super_admin', 'organization', $2, $2)",
        [SECOND_SUPER, ORGANIZATION],
      );
      await db.query(
        "insert into app_authorization_versions (subject_id, authorization_version) values ($1, 1)",
        [SECOND_SUPER],
      );
    };

    describe("grant_change", () => {
      it("lets a super admin add a grant, raising the version and writing role.grant with the group", async () => {
        const result = await change(SUPER_ADMIN, "add", PARENT_F1, "parent", "family", FAMILY_2);
        assert.equal(result.state, "success");
        assert.equal(await version(PARENT_F1), 2);
        assert.equal((await activeGrants(PARENT_F1)).length, 2);
        const granted = (
          await db.query(
            "select granted_by_account_id from app_role_grants where subject_id = $1 and scope_id = $2",
            [PARENT_F1, FAMILY_2],
          )
        ).rows[0];
        assert.equal(granted.granted_by_account_id, SUPER_ADMIN);
        const [event] = await auditEvents(db);
        assert.deepEqual(
          [
            event!.action,
            event!.outcome,
            event!.actor_account_id,
            event!.actor_role,
            event!.target_type,
            event!.target_id,
            event!.group_id,
            event!.organization_id,
          ],
          [
            "role.grant",
            "success",
            SUPER_ADMIN,
            "super_admin",
            "account",
            PARENT_F1,
            GROUP_2,
            ORGANIZATION,
          ],
        );
      });

      it("lets a group admin add parent and teacher grants within their group only", async () => {
        assert.equal(
          (await change(ADMIN_G1, "add", OUTSIDER, "parent", "family", FAMILY_1)).state,
          "success",
        );
        assert.equal(
          (await change(ADMIN_G1, "add", OUTSIDER, "kindergarten_teacher", "group", GROUP_1)).state,
          "success",
        );
        const refused: [string, string, string][] = [
          ["parent", "family", FAMILY_2],
          ["kindergarten_teacher", "group", GROUP_2],
          ["group_admin", "group", GROUP_1],
          ["super_admin", "organization", ORGANIZATION],
        ];
        for (const [role, scopeType, scope] of refused) {
          const result = await change(ADMIN_G1, "add", OUTSIDER, role, scopeType, scope);
          assert.equal(result.state, "denied", `${role} ${scopeType}`);
        }
        assert.equal((await activeGrants(OUTSIDER)).length, 2);
        const events = await auditEvents(db);
        assert.equal(events.filter((event) => event.outcome === "denied").length, 4);
        assert.ok(events.every((event) => event.actor_account_id === ADMIN_G1));
      });

      it("refuses a parent, a teacher and an account without a grant", async () => {
        for (const account of [PARENT_F1, TEACHER_G1, OUTSIDER]) {
          assert.equal(
            (await change(account, "add", PARENT_F2, "parent", "family", FAMILY_1)).state,
            "denied",
            account,
          );
        }
        assert.deepEqual(await activeGrants(PARENT_F2), [{ role: "parent", scope_id: FAMILY_2 }]);
      });

      it("answers account_not_found for an account of another organization, in both directions", async () => {
        const foreign = await change(OTHER_ADMIN, "add", PARENT_F1, "parent", "family", FAMILY_1);
        assert.equal(foreign.code, "account_not_found");
        const reverse = await change(SUPER_ADMIN, "add", OTHER_ADMIN, "parent", "family", FAMILY_1);
        assert.equal(reverse.code, "account_not_found");
        assert.equal((await auditEvents(db)).length, 0);
      });

      it("refuses an existing grant, a family that does not exist in the organization, and a role and scope that do not pair", async () => {
        assert.equal(
          (await change(SUPER_ADMIN, "add", PARENT_F1, "parent", "family", FAMILY_1)).code,
          "grant_exists",
        );
        assert.equal(
          (await change(SUPER_ADMIN, "add", PARENT_F1, "parent", "family", uuid(55))).code,
          "scope_not_found",
        );
        assert.equal(
          (await change(SUPER_ADMIN, "add", PARENT_F1, "parent", "group", GROUP_1)).code,
          "grant_invalid",
        );
        assert.equal(
          (await change(SUPER_ADMIN, "add", PARENT_F1, "super_admin", "organization", GROUP_1))
            .code,
          "grant_invalid",
        );
        assert.equal(await version(PARENT_F1), 1);
      });

      it("revokes a grant, raising the version and writing role.revoke; a missing grant is a validation result", async () => {
        const result = await change(SUPER_ADMIN, "revoke", PARENT_F1, "parent", "family", FAMILY_1);
        assert.equal(result.state, "success");
        assert.deepEqual(await activeGrants(PARENT_F1), []);
        assert.equal(await version(PARENT_F1), 2);
        assert.equal((await auditEvents(db))[0]!.action, "role.revoke");
        assert.equal(
          (await change(SUPER_ADMIN, "revoke", PARENT_F1, "parent", "family", FAMILY_1)).code,
          "grant_not_found",
        );
      });

      it("lets a group admin revoke within their group and refuses another group's grants", async () => {
        assert.equal(
          (await change(ADMIN_G1, "revoke", TEACHER_G1, "kindergarten_teacher", "group", GROUP_1))
            .state,
          "success",
        );
        assert.equal(
          (await change(ADMIN_G2, "revoke", PARENT_F1, "parent", "family", FAMILY_1)).state,
          "denied",
        );
        assert.equal(
          (await change(ADMIN_G1, "revoke", ADMIN_G2, "group_admin", "group", GROUP_2)).state,
          "denied",
        );
        assert.equal((await activeGrants(PARENT_F1)).length, 1);
        assert.equal((await activeGrants(ADMIN_G2)).length, 1);
      });

      it("makes a revoked grant stop working on the very next request", async () => {
        // The grant is what the access probe reads; the family table follows the parent's link, not the grant.
        const read = () =>
          asActor(
            db,
            schema,
            authenticated(PARENT_F1),
            async () =>
              (await db.query("select scope_probe('family', $1) as answer", [FAMILY_1])).rows[0]
                .answer as string,
          );
        assert.equal(await read(), "allowed");
        await change(SUPER_ADMIN, "revoke", PARENT_F1, "parent", "family", FAMILY_1);
        assert.equal(await read(), "denied");
      });

      it("never removes the last active super admin, and refuses a removal that only looks like one", async () => {
        const last = await change(
          SUPER_ADMIN,
          "revoke",
          SUPER_ADMIN,
          "super_admin",
          "organization",
          ORGANIZATION,
        );
        assert.equal(last.state, "conflict");
        assert.equal(last.code, "last_super_admin");
        await addSecondSuper();
        assert.equal(
          (
            await change(
              SUPER_ADMIN,
              "revoke",
              SECOND_SUPER,
              "super_admin",
              "organization",
              ORGANIZATION,
            )
          ).state,
          "success",
        );
        assert.equal(
          (
            await change(
              SUPER_ADMIN,
              "revoke",
              SUPER_ADMIN,
              "super_admin",
              "organization",
              ORGANIZATION,
            )
          ).code,
          "last_super_admin",
        );
      });

      it("lets only one of two concurrent revocations of each other's super admin grant pass (two connections)", async () => {
        await addSecondSuper();
        const second = await openDatabase();
        try {
          await bindSchema(second, schema);
          const [a, b] = await Promise.all([
            change(
              SUPER_ADMIN,
              "revoke",
              SECOND_SUPER,
              "super_admin",
              "organization",
              ORGANIZATION,
              db,
            ),
            change(
              SECOND_SUPER,
              "revoke",
              SUPER_ADMIN,
              "super_admin",
              "organization",
              ORGANIZATION,
              second,
            ),
          ]);
          // The loser is refused: with the conflict result when it waited on the lock, or as denied when the
          // winner had already committed before its own check (its grant is gone). Either way one admin stays.
          const states = [a.state, b.state];
          assert.equal(states.filter((state) => state === "success").length, 1);
          assert.ok(
            states.some((state) => state === "conflict" || state === "denied"),
            states.join(),
          );
          assert.equal(
            await count(
              db,
              "app_role_grants",
              `role = 'super_admin' and revoked_at is null and organization_id = '${ORGANIZATION}'`,
            ),
            1,
          );
        } finally {
          await second.end();
        }
      });

      it("serializes two removals that both passed the reach check, through the row lock (deterministic two-connection race)", async () => {
        await addSecondSuper();
        const [first, second, holder] = [
          await openDatabase(),
          await openDatabase(),
          await openDatabase(),
        ];
        try {
          for (const connection of [first, second, holder]) await bindSchema(connection, schema);
          // The holder keeps both super admin grants locked, so both calls pass their reach check and then wait.
          await holder.query("begin");
          await holder.query(
            "select 1 from app_role_grants where role = 'super_admin' and revoked_at is null for update",
          );
          const pending = [
            change(
              SUPER_ADMIN,
              "revoke",
              SECOND_SUPER,
              "super_admin",
              "organization",
              ORGANIZATION,
              first,
            ),
            change(
              SECOND_SUPER,
              "revoke",
              SUPER_ADMIN,
              "super_admin",
              "organization",
              ORGANIZATION,
              second,
            ),
          ];
          await new Promise((resolve) => setTimeout(resolve, 400));
          await holder.query("commit");
          const results = await Promise.all(pending);
          assert.deepEqual(results.map((result) => result.state).sort(), ["conflict", "success"]);
          assert.ok(results.some((result) => result.code === "last_super_admin"));
        } finally {
          await Promise.all([first.end(), second.end(), holder.end()]);
        }
      });

      it("returns the stored result for a repeated key and nothing new is written", async () => {
        const first = await change(
          SUPER_ADMIN,
          "add",
          OUTSIDER,
          "parent",
          "family",
          FAMILY_1,
          db,
          "repeat-key",
        );
        const second = await change(
          SUPER_ADMIN,
          "add",
          OUTSIDER,
          "parent",
          "family",
          FAMILY_1,
          db,
          "repeat-key",
        );
        assert.equal(second.state, "success");
        assert.equal(second.code, "replayed");
        assert.equal(second.reference, first.reference);
        assert.equal(await count(db, "audit_events"), 1);
        assert.equal(await version(OUTSIDER), 2);
        const reused = await change(
          SUPER_ADMIN,
          "add",
          OUTSIDER,
          "kindergarten_teacher",
          "group",
          GROUP_1,
          db,
          "repeat-key",
        );
        assert.equal(reused.code, "idempotency_key_reused");
      });

      it("rolls the whole change back when the audit event cannot be written, and the same key then succeeds (atomic with the event)", async () => {
        await db.query(
          "create function fail_audit_insert() returns trigger language plpgsql as $$ begin raise exception 'injected failure'; end $$",
        );
        await db.query(
          "create trigger inject_audit_failure before insert on audit_events for each row execute function fail_audit_insert()",
        );
        try {
          const error = await failureOf(() =>
            change(SUPER_ADMIN, "add", OUTSIDER, "parent", "family", FAMILY_1, db, "atomic-key"),
          );
          assert.equal(error?.message, "injected failure");
        } finally {
          await db.query("drop trigger inject_audit_failure on audit_events");
          await db.query("drop function fail_audit_insert()");
        }
        assert.deepEqual(await activeGrants(OUTSIDER), []);
        assert.equal(await version(OUTSIDER), undefined);
        assert.equal(await count(db, "idempotency_records", "idempotency_key = 'atomic-key'"), 0);
        assert.equal(
          (
            await change(
              SUPER_ADMIN,
              "add",
              OUTSIDER,
              "parent",
              "family",
              FAMILY_1,
              db,
              "atomic-key",
            )
          ).state,
          "success",
        );
      });
    });

    describe("deactivation and reactivation", () => {
      it("deactivates an account at once for the database, raising the version and writing account.deactivate", async () => {
        const result = await deactivate(SUPER_ADMIN, PARENT_F1);
        assert.equal(result.state, "success");
        assert.equal(
          (await db.query("select status from accounts where id = $1", [PARENT_F1])).rows[0].status,
          "deactivated",
        );
        assert.equal(await version(PARENT_F1), 2);
        const [event] = await auditEvents(db);
        assert.deepEqual(
          [
            event!.action,
            event!.actor_account_id,
            event!.target_id,
            event!.organization_id,
            event!.outcome,
          ],
          ["account.deactivate", SUPER_ADMIN, PARENT_F1, ORGANIZATION, "success"],
        );
        const read = await asActor(db, schema, authenticated(PARENT_F1), async () => ({
          families: (await db.query("select id from families")).rows.length,
          active: (await db.query("select current_session_is_active() as a")).rows[0].a,
        }));
        assert.deepEqual(read, { families: 0, active: false });
        assert.ok(
          sessionIdFor(PARENT_F1),
          "the session row still exists: only the account status changed",
        );
        assert.equal(
          await count(db, "app_role_grants", `subject_id = '${PARENT_F1}' and revoked_at is null`),
          1,
          "grants stay stored",
        );
      });

      it("reactivates it, and refuses a change that changes nothing", async () => {
        await deactivate(SUPER_ADMIN, PARENT_F1);
        assert.equal((await deactivate(SUPER_ADMIN, PARENT_F1)).code, "account_status_unchanged");
        const result = await reactivate(SUPER_ADMIN, PARENT_F1);
        assert.equal(result.state, "success");
        assert.equal(
          (await auditEvents(db)).map((event) => event.action).join(),
          "account.deactivate,account.reactivate",
        );
        assert.equal((await reactivate(SUPER_ADMIN, PARENT_F1)).code, "account_status_unchanged");
        const families = await asActor(
          db,
          schema,
          authenticated(PARENT_F1),
          async () => (await db.query("select id from families")).rows.length,
        );
        assert.equal(families, 1, "the account works again");
      });

      it("is for super admins only: group admins, parents and teachers are denied with an event", async () => {
        for (const account of [ADMIN_G1, PARENT_F2, TEACHER_G1]) {
          assert.equal((await deactivate(account, PARENT_F1)).state, "denied", account);
          assert.equal((await reactivate(account, DEACTIVATED)).state, "denied", account);
        }
        assert.equal(
          (await auditEvents(db)).filter((event) => event.outcome === "denied").length,
          6,
        );
        assert.equal(
          (await db.query("select status from accounts where id = $1", [PARENT_F1])).rows[0].status,
          "active",
        );
      });

      it("answers account_not_found for another organization's account, in both directions, without an event", async () => {
        assert.equal((await deactivate(OTHER_ADMIN, PARENT_F1)).code, "account_not_found");
        assert.equal((await deactivate(SUPER_ADMIN, OTHER_ADMIN)).code, "account_not_found");
        assert.equal((await deactivate(SUPER_ADMIN, uuid(77))).code, "account_not_found");
        assert.equal(await count(db, "audit_events"), 0);
        assert.ok(OTHER_ORGANIZATION);
      });

      // The loser of the race below is refused when the winner has already deactivated its account: its own
      // session is no longer active, so the function answers "denied" (session_inactive). That outcome depends
      // on timing in the race test, so it is pinned here without any race.
      it("refuses a super admin whose own account was just deactivated, and leaves one admin", async () => {
        await addSecondSuper();
        assert.equal((await deactivate(SUPER_ADMIN, SECOND_SUPER)).state, "success");
        const refused = await deactivate(SECOND_SUPER, SUPER_ADMIN);
        assert.equal(refused.state, "denied");
        assert.equal(refused.code, "session_inactive");
        assert.equal(
          await count(
            db,
            "accounts",
            `status = 'active' and id in ('${SUPER_ADMIN}', '${SECOND_SUPER}')`,
          ),
          1,
        );
      });

      it("never deactivates the last active super admin, even for two concurrent deactivations of each other", async () => {
        assert.equal((await deactivate(SUPER_ADMIN, SUPER_ADMIN)).code, "last_super_admin");
        await addSecondSuper();
        const second = await openDatabase();
        try {
          await bindSchema(second, schema);
          // The loser is refused in one of three ways, depending on timing: the conflict result (it reached the
          // last-admin check first), "denied" (the winner had already deactivated its account, so its own session
          // was no longer active), or an insufficient-privilege error. All three leave one admin.
          const outcome = (work: Promise<{ state: string }>) =>
            work.then(
              (result) => result.state,
              (error: { code?: string }) => `error ${error.code}`,
            );
          const outcomes = await Promise.all([
            outcome(deactivate(SUPER_ADMIN, SECOND_SUPER, db)),
            outcome(deactivate(SECOND_SUPER, SUPER_ADMIN, second)),
          ]);
          assert.equal(outcomes.filter((state) => state === "success").length, 1);
          assert.ok(
            outcomes.some(
              (state) => state === "conflict" || state === "denied" || state === "error 42501",
            ),
            outcomes.join(),
          );
          assert.equal(
            await count(
              db,
              "accounts",
              `status = 'active' and id in ('${SUPER_ADMIN}', '${SECOND_SUPER}')`,
            ),
            1,
          );
        } finally {
          await second.end();
        }
      });

      it("rolls back with its event and returns the stored result for a repeated key", async () => {
        const first = await callAs(
          db,
          schema,
          authenticated(SUPER_ADMIN),
          "account_deactivate($1, $2)",
          ["deact-key", PARENT_F1],
        );
        const again = await callAs(
          db,
          schema,
          authenticated(SUPER_ADMIN),
          "account_deactivate($1, $2)",
          ["deact-key", PARENT_F1],
        );
        assert.equal(again.code, "replayed");
        assert.equal(again.reference, first.reference);
        assert.equal(await count(db, "audit_events"), 1);
        await db.query("update accounts set status = 'active' where id = $1", [PARENT_F1]);
        await db.query(
          "create function fail_audit_insert() returns trigger language plpgsql as $$ begin raise exception 'injected failure'; end $$",
        );
        await db.query(
          "create trigger inject_audit_failure before insert on audit_events for each row execute function fail_audit_insert()",
        );
        try {
          const error = await failureOf(() =>
            callAs(db, schema, authenticated(SUPER_ADMIN), "account_deactivate($1, $2)", [
              randomUUID(),
              PARENT_F1,
            ]),
          );
          assert.equal(error?.message, "injected failure");
        } finally {
          await db.query("drop trigger inject_audit_failure on audit_events");
          await db.query("drop function fail_audit_insert()");
        }
        assert.equal(
          (await db.query("select status from accounts where id = $1", [PARENT_F1])).rows[0].status,
          "active",
        );
      });
    });

    describe("account_find_by_email", () => {
      const find = (account: string, address: string) =>
        callAs(db, schema, authenticated(account), "account_find_by_email($1)", [address]);
      const emailOf = async (account: string) =>
        (await db.query("select email from accounts where id = $1", [account])).rows[0]
          .email as string;

      it("lets a super admin find any account of the organization, returning the id and the status only", async () => {
        const found = await find(SUPER_ADMIN, `  ${(await emailOf(OUTSIDER)).toUpperCase()} `);
        assert.equal(found.state, "success");
        assert.equal(found.reference, OUTSIDER);
        assert.equal(found.code, "active");
        assert.deepEqual(Object.keys(found).sort(), ["code", "reference", "state"]);
        assert.equal((await find(SUPER_ADMIN, await emailOf(DEACTIVATED))).code, "deactivated");
      });

      it("lets a group admin find only accounts holding a grant in their group", async () => {
        assert.equal((await find(ADMIN_G1, await emailOf(PARENT_F1))).reference, PARENT_F1);
        assert.equal((await find(ADMIN_G1, await emailOf(TEACHER_G1))).reference, TEACHER_G1);
        for (const hidden of [PARENT_F2, OUTSIDER, ADMIN_G2]) {
          const result = await find(ADMIN_G1, await emailOf(hidden));
          assert.equal(result.state, "validation", hidden);
          assert.equal(result.code, "account_not_found");
        }
      });

      it("never finds an account of another organization, and answers the same as for an unknown address", async () => {
        const foreign = await find(SUPER_ADMIN, await emailOf(OTHER_ADMIN));
        const unknown = await find(SUPER_ADMIN, "nobody@example.test");
        assert.deepEqual(foreign, unknown);
        assert.equal((await find(OTHER_ADMIN, await emailOf(PARENT_F1))).code, "account_not_found");
      });

      it("shows nothing to a parent or a teacher", async () => {
        for (const account of [PARENT_F1, TEACHER_G1, OUTSIDER]) {
          assert.equal(
            (await find(account, await emailOf(PARENT_F2))).code,
            "account_not_found",
            account,
          );
        }
      });
    });
  });
}
