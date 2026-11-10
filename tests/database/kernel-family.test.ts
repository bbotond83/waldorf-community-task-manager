import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import {
  ADMIN_G1,
  ADMIN_G2,
  ASSIGNMENT_F1_T1,
  asActor,
  authenticated,
  CO_PARENT_F1,
  callFunction,
  CHILD_F1,
  DIRECTORY_SCHEMAS,
  FAMILY_1,
  FAMILY_2,
  FAMILY_NO_GROUP,
  GROUP_1,
  nextKey,
  OTHER_ADMIN,
  openDirectoryDatabase,
  ORGANIZATION,
  OUTSIDER,
  PARENT_F1,
  PARENT_F2,
  PARENT_ROW_CO,
  PARENT_ROW_F1,
  PARENT_ROW_F2,
  REQUEST_1,
  seedCoordinationWorld,
  SUPER_ADMIN,
  TASK_1,
  TASK_2,
  TEACHER_G1,
  uuid,
} from "./directory-support.ts";
import { auditEvents, count } from "./identity-support.ts";
import { ensureAccount, openDatabase } from "./stack-support.ts";

type Result = Awaited<ReturnType<typeof callFunction>>;

const TASK_PAST = uuid(817);
const A_PAST = uuid(871);
const A_F2_T2 = uuid(851);
const SECOND_SUPER = "bbbbbbbb-0000-4000-8000-000000000031";

/**
 * Archiving and restoring a family, the dashboard counts and the governance revoke: the cascade, the reach,
 * the stale versions, history kept, the crossing of an archive with a swap and a sign-up, and the grant rules
 * (BR30.7, BR32.5, BR32.10, NFR3.8, NFR6.10, NFR6.11).
 */
for (const schema of DIRECTORY_SCHEMAS) {
  describe(`family archive, dashboard and governance in ${schema}`, () => {
    let db: pg.Client;

    before(async () => {
      db = await openDirectoryDatabase(schema);
    });
    after(async () => {
      await db.end();
    });
    beforeEach(async () => {
      await seedWorld();
    });

    async function seedWorld() {
      await seedCoordinationWorld(db, schema);
      // Family 2 joins group 1 and holds an active place on task 2; family 1's seeded cancellation request
      // stays open. A started task of group 1 carries a place of family 1 as history.
      await db.query("update tasks set capacity = 3 where id = $1", [TASK_2]);
      await db.query(
        "insert into assignments (id, organization_id, task_id, family_id, parent_id, source) values ($1, $2, $3, $4, $5, 'parent_sign_up')",
        [A_F2_T2, ORGANIZATION, TASK_2, FAMILY_2, PARENT_ROW_F2],
      );
      await db.query(
        `insert into tasks (id, organization_id, group_id, title, capacity, starts_at, ends_at, location)
         values ($1, $2, $3, 'Tavaszi nagytakarítás', 2, now() - interval '3 days', now() - interval '3 days' + interval '2 hours', 'Kert')`,
        [TASK_PAST, ORGANIZATION, GROUP_1],
      );
      await db.query(
        "insert into assignments (id, organization_id, task_id, family_id, source) values ($1, $2, $3, $4, 'admin_assign')",
        [A_PAST, ORGANIZATION, TASK_PAST, FAMILY_1],
      );
    }

    const fn = (account: string, sql: string, values: unknown[] = []): Promise<Result> =>
      callFunction(db, schema, account, sql, values);
    const familyVersion = async (id = FAMILY_1) =>
      (await db.query("select version from families where id = $1", [id])).rows[0]
        .version as number;
    const archive = async (
      account: string,
      family = FAMILY_1,
      version?: number,
      key = nextKey("ar"),
    ) =>
      fn(account, "family_archive($1, $2, $3)", [
        key,
        family,
        version ?? (await familyVersion(family)),
      ]);
    const restore = async (account: string, family = FAMILY_1, version?: number) =>
      fn(account, "family_restore($1, $2, $3)", [
        nextKey("rs"),
        family,
        version ?? (await familyVersion(family)),
      ]);
    const status = async (table: string, id: string) =>
      (await db.query(`select status from ${table} where id = $1`, [id])).rows[0].status as string;
    const taskVersion = async (id: string) =>
      (await db.query("select version from tasks where id = $1", [id])).rows[0].version as number;
    const refused = (result: Result, state: string, code: string) =>
      assert.deepEqual([result.state, result.code], [state, code]);

    it("archives the family, its people and its future places, withdraws its requests and keeps the history (BR30.7)", async () => {
      const [t1, tPast] = [await taskVersion(TASK_1), await taskVersion(TASK_PAST)];
      const result = await archive(SUPER_ADMIN);
      assert.deepEqual([result.state, result.removed_places], ["success", 1]);
      const family = (
        await db.query("select status, archived_at, version from families where id = $1", [
          FAMILY_1,
        ])
      ).rows[0];
      assert.equal(family.status, "archived");
      assert.ok(family.archived_at);
      assert.equal(result.version, family.version);
      for (const [table, id] of [
        ["parents", PARENT_ROW_F1],
        ["parents", PARENT_ROW_CO],
        ["children", CHILD_F1],
      ] as const) {
        assert.equal(await status(table, id), "archived", `${table} ${id}`);
      }
      assert.equal(
        await status("assignments", ASSIGNMENT_F1_T1),
        "removed",
        "the future place is free again",
      );
      assert.equal(
        await status("assignments", A_PAST),
        "active",
        "a place on a task that started stays as history",
      );
      assert.equal(await status("change_requests", REQUEST_1), "withdrawn");
      assert.equal(await taskVersion(TASK_1), t1 + 1, "the task version rose");
      assert.equal(await taskVersion(TASK_PAST), tPast, "a started task is left alone");
      assert.equal(
        await count(db, "accounts", "status = 'deactivated'"),
        1,
        "only the seeded deactivated account",
      );
      assert.equal(await count(db, "audit_events"), 0, "an archive writes no audit event");
      assert.equal(
        await count(db, "assignments", `family_id = '${FAMILY_2}' and status = 'active'`),
        2,
      );
    });

    it("returns another family's source place to active when its swap request targeted an archived place", async () => {
      await db.query("update change_requests set status = 'withdrawn' where id = $1", [REQUEST_1]);
      await db.query("update assignments set status = 'active' where id = $1", [ASSIGNMENT_F1_T1]);
      // Family 2 asks to swap its place on task 2 for family 1's place on task 1 (stored as the owner).
      await db.query("update assignments set status = 'swap_pending' where id = $1", [A_F2_T2]);
      const source = (await db.query("select version from assignments where id = $1", [A_F2_T2]))
        .rows[0].version;
      const target = (
        await db.query("select version from assignments where id = $1", [ASSIGNMENT_F1_T1])
      ).rows[0].version;
      await db.query(
        `insert into change_requests (id, organization_id, assignment_id, target_assignment_id, kind, requested_by_parent_id,
           source_task_id, source_assignment_version, target_task_id, target_assignment_version)
         values ($1, $2, $3, $4, 'swap', $5, $6, $7, $8, $9)`,
        [
          uuid(890),
          ORGANIZATION,
          A_F2_T2,
          ASSIGNMENT_F1_T1,
          PARENT_ROW_F2,
          TASK_2,
          source,
          TASK_1,
          target,
        ],
      );
      assert.equal((await archive(SUPER_ADMIN)).state, "success");
      assert.equal(await status("change_requests", uuid(890)), "withdrawn");
      assert.equal(await status("assignments", A_F2_T2), "active");
      assert.equal(await status("assignments", ASSIGNMENT_F1_T1), "removed");
    });

    it("lets only a super admin archive (BR30.1, BR30.7, BR3.9)", async () => {
      for (const account of [ADMIN_G1, ADMIN_G2, PARENT_F1, CO_PARENT_F1, TEACHER_G1, OUTSIDER]) {
        refused(await archive(account), "denied", "authorization_denied");
      }
      refused(await archive(OTHER_ADMIN), "validation", "family_not_found");
      refused(await archive(SUPER_ADMIN, uuid(99999), 1), "validation", "family_not_found");
      assert.equal(await status("families", FAMILY_1), "active");
      assert.equal((await archive(SUPER_ADMIN)).state, "success");
    });

    it("refuses a stale or repeated archive, and every group admin (BR3.9)", async () => {
      refused(await archive(ADMIN_G1, FAMILY_NO_GROUP), "denied", "authorization_denied");
      assert.equal(
        (await archive(SUPER_ADMIN, FAMILY_NO_GROUP)).state,
        "success",
        "a super admin reaches it",
      );
      refused(await archive(SUPER_ADMIN, FAMILY_1, 99), "conflict", "VERSION_CONFLICT");
      assert.equal(await status("families", FAMILY_1), "active", "nothing changed");
      const missing = await fn(SUPER_ADMIN, "family_archive($1, $2, null)", [nextKey(), FAMILY_1]);
      assert.deepEqual([missing.state, missing.field], ["validation", "expected_version"]);
      assert.equal((await archive(SUPER_ADMIN)).state, "success");
      refused(await archive(SUPER_ADMIN), "conflict", "VERSION_CONFLICT");
    });

    it("hides the archived family from its parents and from the lists, while super admins still read it (BR30.7, BR3.9)", async () => {
      assert.equal((await archive(SUPER_ADMIN)).state, "success");
      refused(await fn(PARENT_F1, "duty_list()"), "denied", "no_family");
      refused(
        await fn(CO_PARENT_F1, "duty_sign_up($1, $2, 1)", [nextKey(), TASK_2]),
        "denied",
        "no_family",
      );
      const parentRows = await asActor(
        db,
        schema,
        authenticated(PARENT_F1),
        async () => (await db.query("select id from families")).rows.length,
      );
      assert.equal(parentRows, 0);
      const adminRows = await asActor(
        db,
        schema,
        authenticated(SUPER_ADMIN),
        async () =>
          (await db.query("select id from families where status = 'archived'")).rows.length,
      );
      assert.equal(adminRows, 1);
    });

    it("restores the people but not the removed places, and refuses a stale, active or unreachable restore (BR30.7)", async () => {
      assert.equal((await archive(SUPER_ADMIN)).state, "success");
      refused(await restore(ADMIN_G1), "denied", "authorization_denied");
      refused(await restore(ADMIN_G2), "denied", "authorization_denied");
      refused(await restore(SUPER_ADMIN, FAMILY_1, 99), "conflict", "VERSION_CONFLICT");
      const restored = await restore(SUPER_ADMIN);
      assert.deepEqual([restored.state, restored.version], ["success", await familyVersion()]);
      assert.deepEqual(
        [
          await status("families", FAMILY_1),
          await status("parents", PARENT_ROW_F1),
          await status("children", CHILD_F1),
        ],
        ["active", "active", "active"],
      );
      assert.equal(
        await status("assignments", ASSIGNMENT_F1_T1),
        "removed",
        "removed places are not brought back",
      );
      assert.equal(
        (await db.query("select archived_at from families where id = $1", [FAMILY_1])).rows[0]
          .archived_at,
        null,
      );
      refused(await restore(SUPER_ADMIN), "conflict", "RESTORE_CONFLICT");
      refused(await restore(SUPER_ADMIN, FAMILY_2), "conflict", "RESTORE_CONFLICT");
      assert.equal(
        (
          await fn(PARENT_F1, "duty_sign_up($1, $2, $3)", [
            nextKey(),
            TASK_1,
            await taskVersion(TASK_1),
          ])
        ).state,
        "success",
      );
    });

    it("returns the stored result for a repeated archive key and changes nothing more (NFR6.11)", async () => {
      const key = nextKey("same");
      const first = await archive(SUPER_ADMIN, FAMILY_1, undefined, key);
      const version = await taskVersion(TASK_1);
      const again = await fn(SUPER_ADMIN, "family_archive($1, $2, $3)", [key, FAMILY_1, 1]);
      assert.deepEqual([first.state, again.state, again.code], ["success", "success", "replayed"]);
      assert.equal(await taskVersion(TASK_1), version);
    });

    it("rolls back the whole archive when a step fails: nothing of it is stored (NFR6.10)", async () => {
      // A trigger that refuses archiving the children after the places were already removed.
      await db.query(
        `create function refuse_child_archive() returns trigger language plpgsql as $$ begin
           if new.status = 'archived' then raise exception 'injected failure' using errcode = 'XX000'; end if; return new; end $$`,
      );
      await db.query(
        "create trigger refuse_child_archive before update on children for each row execute function refuse_child_archive()",
      );
      try {
        const failure = await archive(SUPER_ADMIN).then(
          () => undefined,
          (error: Error & { code?: string }) => error,
        );
        assert.equal(failure?.code, "XX000");
      } finally {
        await db.query("drop trigger refuse_child_archive on children");
        await db.query("drop function refuse_child_archive()");
      }
      assert.equal(await status("families", FAMILY_1), "active");
      assert.equal(await status("assignments", ASSIGNMENT_F1_T1), "cancellation_pending");
      assert.equal(await status("change_requests", REQUEST_1), "open");
      assert.equal(await status("parents", PARENT_ROW_F1), "active");
    });

    it("never deadlocks and stays consistent when an archive crosses a swap confirmation or a sign-up (NFR3.8)", async () => {
      const connections = [await openDatabase(), await openDatabase()];
      try {
        for (let round = 0; round < 6; round += 1) {
          await seedWorld();
          await db.query("update change_requests set status = 'withdrawn' where id = $1", [
            REQUEST_1,
          ]);
          await db.query("update assignments set status = 'active' where id = $1", [
            ASSIGNMENT_F1_T1,
          ]);
          const asg = async (id: string) =>
            (await db.query("select version, task_id from assignments where id = $1", [id]))
              .rows[0];
          // Family 1 asks family 2 for a swap (as the owner), then family 2 confirms while family 1 is archived.
          await db.query("update assignments set status = 'swap_pending' where id = $1", [
            ASSIGNMENT_F1_T1,
          ]);
          const source = await asg(ASSIGNMENT_F1_T1);
          const target = await asg(A_F2_T2);
          await db.query(
            `insert into change_requests (id, organization_id, assignment_id, target_assignment_id, kind, requested_by_parent_id,
               source_task_id, source_assignment_version, target_task_id, target_assignment_version)
             values ($1, $2, $3, $4, 'swap', $5, $6, $7, $8, $9)`,
            [
              uuid(891),
              ORGANIZATION,
              ASSIGNMENT_F1_T1,
              A_F2_T2,
              PARENT_ROW_F1,
              TASK_1,
              source.version,
              TASK_2,
              target.version,
            ],
          );
          const version = await familyVersion();
          const [archived, responded] = await Promise.all([
            callFunction(connections[0]!, schema, SUPER_ADMIN, "family_archive($1, $2, $3)", [
              nextKey("x"),
              FAMILY_1,
              version,
            ]),
            callFunction(connections[1]!, schema, PARENT_F2, "swap_respond($1, $2, true, null)", [
              nextKey("y"),
              uuid(891),
            ]),
          ]);
          assert.equal(archived.state, "success", `round ${round}`);
          assert.ok(
            responded.state === "success" ||
              responded.code === "SWAP_REQUEST_NOT_OPEN" ||
              responded.code === "SWAP_CANNOT_BE_APPLIED",
            `round ${round}: ${responded.state} ${responded.code}`,
          );
          assert.equal(
            await count(
              db,
              "assignments",
              `family_id = '${FAMILY_1}' and task_id in ('${TASK_1}', '${TASK_2}') and status <> 'removed'`,
            ),
            0,
            `round ${round}`,
          );
          assert.equal(await count(db, "change_requests", "status = 'open'"), 0, `round ${round}`);
          assert.equal(await status("assignments", A_F2_T2), "active", `round ${round}`);
        }
        // A sign-up of the family against its own archive: the place exists only if it is removed again.
        for (let round = 0; round < 4; round += 1) {
          await seedWorld();
          const version = await familyVersion();
          const taskVersion1 = await taskVersion(TASK_2);
          const [archived, signed] = await Promise.all([
            callFunction(connections[0]!, schema, SUPER_ADMIN, "family_archive($1, $2, $3)", [
              nextKey("a"),
              FAMILY_1,
              version,
            ]),
            callFunction(connections[1]!, schema, PARENT_F1, "duty_sign_up($1, $2, $3)", [
              nextKey("b"),
              TASK_2,
              taskVersion1,
            ]),
          ]);
          assert.equal(archived.state, "success", `round ${round}`);
          assert.ok(
            signed.state === "success" ||
              signed.code === "no_family" ||
              signed.code === "DUTY_VERSION_STALE",
            `${signed.state} ${signed.code}`,
          );
          assert.equal(
            await count(
              db,
              "assignments",
              `family_id = '${FAMILY_1}' and task_id = '${TASK_2}' and status <> 'removed'`,
            ),
            0,
            `round ${round}: an archived family holds no future place`,
          );
        }
      } finally {
        await Promise.all(connections.map((connection) => connection.end()));
      }
    });

    it("counts the open approvals of the admin's reach, and no longer has import conflicts to count (BR32.5, BR7.1)", async () => {
      const dashboard = (account: string) => fn(account, "dashboard_get()");
      const answer = await dashboard(SUPER_ADMIN);
      assert.deepEqual([answer.state, answer.open_approvals], ["success", 1]);
      assert.equal("open_import_conflicts" in answer, false);
      assert.equal((await dashboard(ADMIN_G1)).open_approvals, 1);
      assert.equal(
        (await dashboard(ADMIN_G2)).open_approvals,
        0,
        "another group's admin counts nothing of group 1",
      );
      await db.query(
        "update change_requests set status = 'approved', decided_by_account_id = $2, decided_at = now() where id = $1",
        [REQUEST_1, SUPER_ADMIN],
      );
      assert.equal((await dashboard(SUPER_ADMIN)).open_approvals, 0);
      for (const account of [PARENT_F1, TEACHER_G1, OUTSIDER])
        refused(await dashboard(account), "denied", "authorization_denied");
      assert.equal(
        (await dashboard(OTHER_ADMIN)).open_approvals,
        0,
        "another organization's requests are not counted",
      );
      const remaining = await db.query(
        "select 1 from pg_proc where proname = 'dashboard_import_conflicts' and pronamespace = current_schema()::regnamespace",
      );
      assert.equal(remaining.rowCount, 0, "the import's count is gone with the import");
    });

    describe("governance_revoke", () => {
      const grantOf = async (subject: string, role: string) =>
        (
          await db.query(
            "select id from app_role_grants where subject_id = $1 and role = $2 and revoked_at is null",
            [subject, role],
          )
        ).rows[0].id as string;
      const authVersion = async (subject: string) =>
        (
          await db.query(
            "select authorization_version from app_authorization_versions where subject_id = $1",
            [subject],
          )
        ).rows[0].authorization_version as number;
      const revoke = (
        account: string,
        grant: string,
        version: number | null,
        key = nextKey("gr"),
      ) => fn(account, "governance_revoke($1, $2, $3)", [key, grant, version]);

      it("revokes another admin's grant through U2's function, raising the authorization version and auditing it", async () => {
        const grant = await grantOf(ADMIN_G1, "group_admin");
        const result = await revoke(SUPER_ADMIN, grant, await authVersion(ADMIN_G1));
        assert.equal(result.state, "success");
        assert.equal(result.authorization_version, 2);
        assert.equal(
          await count(db, "app_role_grants", `id = '${grant}' and revoked_at is not null`),
          1,
        );
        const [event] = await auditEvents(db);
        assert.deepEqual(
          [event!.action, event!.outcome, event!.target_id, event!.actor_account_id],
          ["role.revoke", "success", ADMIN_G1, SUPER_ADMIN],
        );
        // A group admin may revoke a teacher grant of their own group, not of another.
        const teacher = await grantOf(TEACHER_G1, "kindergarten_teacher");
        refused(
          await revoke(ADMIN_G2, teacher, await authVersion(TEACHER_G1)),
          "denied",
          "authorization_denied",
        );
        assert.equal(
          (await revoke(SUPER_ADMIN, teacher, await authVersion(TEACHER_G1))).state,
          "success",
        );
      });

      it("refuses a stale version, an admin's own grant and a grant outside the reach", async () => {
        const mine = await grantOf(SUPER_ADMIN, "super_admin");
        refused(
          await revoke(SUPER_ADMIN, mine, await authVersion(SUPER_ADMIN)),
          "conflict",
          "GRANT_SELF_LOCKOUT",
        );
        const theirs = await grantOf(ADMIN_G1, "group_admin");
        refused(await revoke(SUPER_ADMIN, theirs, 99), "invalidated", "GRANT_STALE");
        refused(await revoke(SUPER_ADMIN, theirs, null), "invalidated", "GRANT_STALE");
        refused(
          await revoke(ADMIN_G2, theirs, await authVersion(ADMIN_G1)),
          "denied",
          "authorization_denied",
        );
        refused(
          await revoke(PARENT_F1, theirs, await authVersion(ADMIN_G1)),
          "denied",
          "authorization_denied",
        );
        refused(
          await revoke(OTHER_ADMIN, theirs, await authVersion(ADMIN_G1)),
          "denied",
          "authorization_denied",
        );
        refused(await revoke(SUPER_ADMIN, uuid(99999), 1), "denied", "authorization_denied");
        assert.equal(
          await count(db, "app_role_grants", "revoked_at is not null"),
          0,
          "nothing was revoked",
        );
        // A group admin refusing their own grant, and a super admin with a second super admin still cannot.
        await ensureAccount(db, { id: SECOND_SUPER, organization: ORGANIZATION });
        await db.query(
          "insert into app_role_grants (subject_id, role, scope_type, scope_id, organization_id) values ($1, 'super_admin', 'organization', $2, $2)",
          [SECOND_SUPER, ORGANIZATION],
        );
        await db.query(
          "insert into app_authorization_versions (subject_id, authorization_version) values ($1, 1)",
          [SECOND_SUPER],
        );
        const second = await grantOf(SECOND_SUPER, "super_admin");
        assert.equal(
          (await revoke(SUPER_ADMIN, second, 1)).state,
          "success",
          "with two super admins one may be revoked",
        );
        refused(
          await revoke(SUPER_ADMIN, mine, await authVersion(SUPER_ADMIN)),
          "conflict",
          "GRANT_SELF_LOCKOUT",
        );
      });

      it("returns the stored answer for a repeated key", async () => {
        const grant = await grantOf(ADMIN_G1, "group_admin");
        const key = nextKey("same-grant");
        const version = await authVersion(ADMIN_G1);
        const first = await revoke(SUPER_ADMIN, grant, version, key);
        const again = await revoke(SUPER_ADMIN, grant, version, key);
        assert.deepEqual(
          [first.state, again.state, again.code],
          ["success", "success", "replayed"],
        );
        assert.equal(await count(db, "audit_events"), 1);
      });
    });
  });
}
