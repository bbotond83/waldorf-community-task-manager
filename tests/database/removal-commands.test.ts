import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import {
  ADMIN_G1,
  callFunction,
  CO_PARENT_F1,
  DIRECTORY_SCHEMAS,
  FAMILY_1,
  FAMILY_2,
  FAMILY_NO_GROUP,
  nextKey,
  openDirectoryDatabase,
  ORGANIZATION,
  OTHER_ADMIN,
  PARENT_F1,
  PARENT_F2,
  PARENT_ROW_CO,
  PARENT_ROW_F1,
  PARENT_ROW_F2,
  SIGNED_OUT,
  SUPER_ADMIN,
  TEACHER_G1,
  uuid,
} from "./directory-support.ts";
import { auditEvents, count } from "./identity-support.ts";
import {
  callAndHold,
  DUTY_ROTA,
  FAMILY_1_ACCOUNTS,
  familyVersion,
  GROUP_GARDEN,
  GROUP_GARDEN_NAME,
  parentVersion,
  refusedWith,
  removeFamily,
  removeParent,
  seedRemovalWorld,
  snapshot,
  STEP_ORDER,
  stepsOf,
  succeeded,
  TODO_CLAIMED,
} from "./removal-support.ts";
import { openDatabase, useSchema } from "./stack-support.ts";

const grantSuperAdmin = (db: pg.Client, account: string) =>
  db.query(
    "insert into app_role_grants (subject_id, role, scope_type, scope_id, organization_id) values ($1, 'super_admin', 'organization', $2, $2)",
    [account, ORGANIZATION],
  );

const versionsOfAccounts = async (db: pg.Client, accounts: readonly string[]) => {
  const result = await db.query(
    "select subject_id, authorization_version from app_authorization_versions where subject_id = any ($1::uuid[])",
    [accounts],
  );
  return new Map(
    result.rows.map((row) => [String(row.subject_id), Number(row.authorization_version)]),
  );
};

/**
 * `parent_remove` and `family_archive` on the fixed list (U14; BR200, BR201, BR203, BR207; NFR3.1, NFR3.3 to NFR3.6,
 * NFR4.1, NFR4.2, NFR5.2 to NFR5.4, NFR11.1, NFR11.5): allowed, refused, out of reach, outdated screen and repeated
 * click here, two people at once in removal-races.test.ts.
 */
for (const schema of DIRECTORY_SCHEMAS) {
  describe(`removal commands in ${schema}`, () => {
    let db: pg.Client;
    let other: pg.Client;

    before(async () => {
      db = await openDirectoryDatabase(schema);
      other = await openDatabase();
      await useSchema(other, schema);
    });
    after(async () => {
      await other.end();
      await db.end();
    });
    beforeEach(async () => {
      await seedRemovalWorld(db, schema);
    });

    const fn = (account: string, sql: string, values: unknown[] = []) =>
      callFunction(db, schema, account, sql, values);

    it("allowed: removing a family runs the eleven steps in order, archives its people and keeps its names", async () => {
      const version = await familyVersion(db, FAMILY_1);
      const result = succeeded(await removeFamily(db, schema));
      assert.deepEqual(
        stepsOf(result).map((step) => step.block),
        STEP_ORDER,
      );
      assert.equal(result.reference, FAMILY_1);
      assert.equal(result.version, version + 1);
      assert.equal(
        await count(db, "parents", `family_id = '${FAMILY_1}' and status = 'active'`),
        0,
      );
      assert.equal(
        await count(db, "children", `family_id = '${FAMILY_1}' and status = 'active'`),
        0,
      );
      assert.equal(await count(db, "families", `id = '${FAMILY_1}' and status = 'archived'`), 1);
      const names = await db.query(
        "select display_name from parents where family_id = $1 order by display_name",
        [FAMILY_1],
      );
      assert.deepEqual(
        names.rows.map((row) => row.display_name),
        ["Fenyő Anna", "Fenyő Béla", "Fenyő Dóra", "Fenyő Emma"],
        "a removed family's stored names stay until the later run (NFR1.4)",
      );
      assert.equal(await count(db, "families", `id = '${FAMILY_2}' and status = 'active'`), 1);
    });

    it("allowed: removing a parent runs the eleven steps and replaces that parent's stored name at once", async () => {
      const result = succeeded(await removeParent(db, schema));
      assert.deepEqual(
        stepsOf(result).map((step) => step.block),
        STEP_ORDER,
      );
      const row = await db.query(
        "select status, display_name, account_id from parents where id = $1",
        [PARENT_ROW_F1],
      );
      assert.deepEqual(row.rows[0], {
        status: "archived",
        display_name: "Anonimizált szülő",
        account_id: null,
      });
      assert.equal(await count(db, "families", `id = '${FAMILY_1}' and status = 'active'`), 1);
      assert.equal(
        await count(db, "parents", `id = '${PARENT_ROW_CO}' and display_name = 'Fenyő Béla'`),
        1,
      );
      assert.equal(
        await count(db, "assignments", `family_id = '${FAMILY_1}' and status = 'removed'`),
        0,
      );
    });

    it("allowed: the result names every ended account, read before the steps, and each is refused at its next request (NFR3.1, NFR3.2, NFR3.6)", async () => {
      const before = await versionsOfAccounts(db, FAMILY_1_ACCOUNTS);
      const held = await fn(PARENT_F1, "directory_list()");
      assert.equal(held.state, "success");

      const result = succeeded(await removeFamily(db, schema));

      assert.deepEqual(result.ended_account_ids, FAMILY_1_ACCOUNTS);
      refusedWith(await fn(PARENT_F1, "directory_list()"), "denied", "session_inactive");
      refusedWith(await fn(CO_PARENT_F1, "directory_list()"), "denied", "session_inactive");
      const after = await versionsOfAccounts(db, FAMILY_1_ACCOUNTS);
      for (const account of FAMILY_1_ACCOUNTS) {
        assert.ok((after.get(account) ?? 0) > (before.get(account) ?? 0), account);
      }
    });

    it("allowed: removing one parent ends only that parent's account and keeps account_id in the result", async () => {
      const result = succeeded(await removeParent(db, schema));
      assert.deepEqual([result.account_id, result.ended_account_ids], [PARENT_F1, [PARENT_F1]]);
      refusedWith(await fn(PARENT_F1, "directory_list()"), "denied", "session_inactive");
      assert.equal((await fn(CO_PARENT_F1, "directory_list()")).state, "success");
    });

    it("allowed: removing a group's only coordinator goes ahead and names the group left without one (BR203.1)", async () => {
      const result = succeeded(await removeParent(db, schema));
      assert.deepEqual(result.groups_left_without_coordinator, [
        { group_id: GROUP_GARDEN, name: GROUP_GARDEN_NAME },
      ]);
      assert.equal(
        await count(
          db,
          "app_role_grants",
          `scope_id = '${GROUP_GARDEN}' and role = 'group_admin' and revoked_at is null`,
        ),
        0,
      );
    });

    it("allowed: a group with another coordinator is not listed", async () => {
      await db.query(
        "insert into app_role_grants (subject_id, role, scope_type, scope_id, organization_id) values ($1, 'group_admin', 'group', $2, $3)",
        [PARENT_F2, GROUP_GARDEN, ORGANIZATION],
      );
      const result = succeeded(await removeFamily(db, schema));
      assert.deepEqual(result.groups_left_without_coordinator, []);
    });

    it("allowed: one audit row per removal names the subject and holds counts only, and earlier rows stay (NFR4.1 to NFR4.3, NFR1.2)", async () => {
      // A row the removed account wrote itself, before the removal.
      await db.query("begin");
      await db.query(`set local search_path to "${schema}", pg_catalog`);
      await db.query("select set_config('request.jwt.claim.sub', $1, true)", [PARENT_F1]);
      await db.query(
        "select platform_audit_write('profile.sharing_changed', 'parent', $1, $2, null, 'success', 'on')",
        [PARENT_ROW_F1, ORGANIZATION],
      );
      await db.query("commit");
      const earlier = await auditEvents(db);

      const parent = succeeded(await removeParent(db, schema, PARENT_ROW_CO));
      const family = succeeded(await removeFamily(db, schema));

      const rows = await auditEvents(db);
      assert.deepEqual(rows.slice(0, earlier.length), earlier, "earlier rows are unchanged");
      for (const [action, subject, kind, result, ended] of [
        ["lifecycle.parent_removed", PARENT_ROW_CO, "parent", parent, 1],
        ["lifecycle.family_removed", FAMILY_1, "family", family, 3],
      ] as const) {
        const written = rows.filter((row) => row.action === action);
        assert.equal(written.length, 1, action);
        const expected = `${stepsOf(result)
          .map((step) => `${step.block}:${step.to_clear}:${step.to_flag}`)
          .join(".")}.ended_accounts:${ended}`;
        assert.deepEqual(
          [
            written[0]!.target_id,
            written[0]!.target_type,
            written[0]!.actor_account_id,
            written[0]!.outcome,
            written[0]!.details,
          ],
          [subject, kind, SUPER_ADMIN, "success", expected],
        );
      }
    });

    for (const [label, account] of [
      ["a parent of another family", PARENT_F2],
      ["a parent of the same family", CO_PARENT_F1],
      ["a group admin", ADMIN_G1],
      ["a teacher", TEACHER_G1],
    ] as const) {
      it(`refused: ${label} removes neither a parent nor a family and nothing changes (NFR3.4)`, async () => {
        const before = await snapshot(db, schema);
        refusedWith(
          await removeParent(db, schema, PARENT_ROW_F1, account),
          "denied",
          "authorization_denied",
        );
        refusedWith(
          await removeFamily(db, schema, FAMILY_1, account),
          "denied",
          "authorization_denied",
        );
        assert.deepEqual(await snapshot(db, schema), before);
      });
    }

    it("refused: a signed-out account and an anonymous caller", async () => {
      refusedWith(
        await removeParent(db, schema, PARENT_ROW_F1, SIGNED_OUT),
        "denied",
        "session_inactive",
      );
      refusedWith(
        await removeFamily(db, schema, FAMILY_1, SIGNED_OUT),
        "denied",
        "session_inactive",
      );
      for (const sql of [
        "parent_remove('k', null, 1)",
        "family_archive('k', null, 1)",
        "family_archive_core('k', null, 1)",
        "lifecycle_removal_apply('family', null)",
        "duties_removal_apply('family', null)",
        "working_groups_sole_coordinator_groups('family', null)",
      ]) {
        await db.query("begin");
        await db.query(`set local search_path to "${schema}", pg_catalog`);
        await db.query("set local role anon");
        await assert.rejects(db.query(`select ${sql}`), { code: "42501" }, sql);
        await db.query("rollback");
      }
    });

    it("refused: no signed-in account may call a step, the core or a helper directly (NFR3.5)", async () => {
      for (const sql of [
        "family_archive_core('k', null, 1)",
        "lifecycle_removal_apply('family', null)",
        "lifecycle_removal_refusal('family', null, null)",
        "lifecycle_subject_accounts('family', null)",
        "lifecycle_stored_result_details('family.archive', 'k')",
        "duties_removal_preview('family', null)",
        "duties_removal_apply('family', null)",
        "working_groups_sole_coordinator_groups('family', null)",
      ]) {
        await assert.rejects(fn(SUPER_ADMIN, sql), { code: "42501" }, sql);
      }
    });

    it("refused: a super admin removes neither their own parent record nor their own family (NFR3.3)", async () => {
      await grantSuperAdmin(db, PARENT_F1);
      const before = await snapshot(db, schema);
      refusedWith(
        await removeParent(db, schema, PARENT_ROW_F1, PARENT_F1),
        "conflict",
        "SELF_REMOVAL",
      );
      refusedWith(await removeFamily(db, schema, FAMILY_1, PARENT_F1), "conflict", "SELF_REMOVAL");
      assert.deepEqual(await snapshot(db, schema), before);
      succeeded(await removeParent(db, schema, PARENT_ROW_CO, PARENT_F1));
    });

    it("allowed: another super admin removes a family that holds other super admins, because one stays", async () => {
      await grantSuperAdmin(db, PARENT_F1);
      await grantSuperAdmin(db, CO_PARENT_F1);
      succeeded(await removeFamily(db, schema));
    });

    it("refused: the guard names last_super_admin when no active super admin would be left outside the subject (NFR3.3)", async () => {
      await grantSuperAdmin(db, PARENT_F1);
      await db.query(
        "update app_role_grants set revoked_at = now() where subject_id = $1 and role = 'super_admin'",
        [SUPER_ADMIN],
      );
      // No command can reach this: the caller is always a super admin outside the subject. The guard is asked directly.
      await db.query("begin");
      await db.query(`set local search_path to "${schema}", pg_catalog`);
      await db.query("select set_config('request.jwt.claim.sub', $1, true)", [PARENT_F2]);
      for (const [kind, id] of [
        ["family", FAMILY_1],
        ["parent", PARENT_ROW_F1],
      ]) {
        const answer = await db.query("select lifecycle_removal_refusal($1, $2, $3) as r", [
          kind,
          id,
          ORGANIZATION,
        ]);
        assert.equal(answer.rows[0].r, "last_super_admin", kind);
      }
      await db.query("rollback");
    });

    it("refused: a family's last active parent is not removed alone (BR200.2)", async () => {
      const before = await snapshot(db, schema);
      refusedWith(
        await removeParent(db, schema, PARENT_ROW_F2),
        "conflict",
        "PARENT_LAST_IN_FAMILY",
      );
      assert.deepEqual(await snapshot(db, schema), before);
    });

    it("out of reach: a super admin of another community, and an id that matches nothing", async () => {
      const before = await snapshot(db, schema);
      refusedWith(
        await removeParent(db, schema, PARENT_ROW_F1, OTHER_ADMIN),
        "validation",
        "parent_not_found",
      );
      refusedWith(
        await removeFamily(db, schema, FAMILY_1, OTHER_ADMIN),
        "validation",
        "family_not_found",
      );
      refusedWith(
        await removeParent(db, schema, uuid(999999), SUPER_ADMIN, nextKey("no"), 1),
        "validation",
        "parent_not_found",
      );
      refusedWith(
        await removeFamily(db, schema, uuid(999999), SUPER_ADMIN, nextKey("no"), 1),
        "validation",
        "family_not_found",
      );
      assert.deepEqual(await snapshot(db, schema), before);
    });

    it("refused callers take no lock: they answer while another session holds the family and its duties", async () => {
      await grantSuperAdmin(db, PARENT_F1);
      const versions = {
        family: await familyVersion(db, FAMILY_1),
        parent: await parentVersion(db, PARENT_ROW_F1),
      };
      await other.query("begin");
      try {
        await other.query("select 1 from families for update");
        await other.query("select 1 from tasks for update");
        await other.query("select 1 from assignments for update");
        await db.query("set lock_timeout = '2s'");
        const cases = [
          [ADMIN_G1, "authorization_denied"],
          [TEACHER_G1, "authorization_denied"],
          [OTHER_ADMIN, "_not_found"],
          [PARENT_F1, "SELF_REMOVAL"],
        ] as const;
        for (const [account, code] of cases) {
          for (const result of [
            await removeFamily(db, schema, FAMILY_1, account, nextKey("nl"), versions.family),
            await removeParent(db, schema, PARENT_ROW_F1, account, nextKey("nl"), versions.parent),
          ]) {
            assert.ok(String(result.code).includes(code), JSON.stringify(result));
          }
        }
      } finally {
        await db.query("set lock_timeout = 0");
        await other.query("rollback");
      }
    });

    it("outdated screen: an old version, or a subject already removed, is refused and nothing changes (NFR5.4)", async () => {
      const before = await snapshot(db, schema);
      refusedWith(
        await removeFamily(
          db,
          schema,
          FAMILY_1,
          SUPER_ADMIN,
          nextKey("old"),
          (await familyVersion(db, FAMILY_1)) + 1,
        ),
        "conflict",
        "VERSION_CONFLICT",
      );
      refusedWith(
        await removeParent(
          db,
          schema,
          PARENT_ROW_F1,
          SUPER_ADMIN,
          nextKey("old"),
          (await parentVersion(db, PARENT_ROW_F1)) + 1,
        ),
        "conflict",
        "VERSION_CONFLICT",
      );
      assert.deepEqual(await snapshot(db, schema), before);
      succeeded(await removeFamily(db, schema));
      refusedWith(await removeFamily(db, schema), "conflict", "VERSION_CONFLICT");
      refusedWith(await removeParent(db, schema), "conflict", "VERSION_CONFLICT");
    });

    for (const [name, remove, subject, version] of [
      ["family_archive", removeFamily, FAMILY_1, familyVersion],
      ["parent_remove", removeParent, PARENT_ROW_F1, parentVersion],
    ] as const) {
      it(`repeated click: ${name} returns the stored result with the same ended accounts and runs nothing again (NFR5.3)`, async () => {
        const key = nextKey("twice");
        const asked = await version(db, subject);
        const first = succeeded(await remove(db, schema, subject, SUPER_ADMIN, key, asked));
        const after = await snapshot(db, schema);

        const second = succeeded(await remove(db, schema, subject, SUPER_ADMIN, key, asked));

        assert.equal(second.code, "replayed");
        assert.deepEqual({ ...second, code: first.code }, first);
        assert.deepEqual(await snapshot(db, schema), after);
        refusedWith(
          await remove(db, schema, subject, SUPER_ADMIN, key, asked + 1),
          "conflict",
          "idempotency_key_reused",
        );
      });
    }

    for (const [name, remove, action] of [
      ["family", () => removeFamily(db, schema), "lifecycle.family_removed"],
      ["parent", () => removeParent(db, schema), "lifecycle.parent_removed"],
    ] as const) {
      it(`all or nothing: a failed audit write leaves every table unchanged when a ${name} is removed (NFR4.1, NFR11.1)`, async () => {
        const before = await snapshot(db, schema);
        await db.query(
          `alter table "${schema}".audit_events add constraint removal_test_block check (action <> '${action}') not valid`,
        );
        try {
          await assert.rejects(remove(), { code: "23514" });
        } finally {
          await db.query(`alter table "${schema}".audit_events drop constraint removal_test_block`);
        }
        assert.deepEqual(await snapshot(db, schema), before);
      });

      it(`all or nothing: a step that refuses leaves every table unchanged when a ${name} is removed (NFR11.1)`, async () => {
        const before = await snapshot(db, schema);
        await db.query(
          `create function "${schema}".removal_test_refuse() returns trigger language plpgsql set search_path to "${schema}", pg_catalog as $$
           begin perform platform_abort('conflict', 'TEST_STEP_REFUSED'); return new; end $$`,
        );
        await db.query(
          `create trigger removal_test_refuse before update on "${schema}".group_memberships for each row execute function "${schema}".removal_test_refuse()`,
        );
        try {
          refusedWith(await remove(), "conflict", "TEST_STEP_REFUSED");
        } finally {
          await db.query(`drop trigger removal_test_refuse on "${schema}".group_memberships`);
          await db.query(`drop function "${schema}".removal_test_refuse()`);
        }
        assert.deepEqual(await snapshot(db, schema), before);
      });
    }

    it("allowed: a removal that holds its transaction open is not visible to others until it commits", async () => {
      const version = await familyVersion(db, FAMILY_1);
      const held = await callAndHold(db, schema, SUPER_ADMIN, "family_archive($1, $2, $3)", [
        nextKey("open"),
        FAMILY_1,
        version,
      ]);
      assert.equal(held.state, "success");
      const seen = await other.query("select status from families where id = $1", [FAMILY_1]);
      assert.equal(seen.rows[0].status, "active");
      await db.query("commit");
    });

    it("restore: the family, its parents and children come back, the flags clear and what the removal ended stays ended (NFR11.5)", async () => {
      succeeded(await removeFamily(db, schema));
      const flagged = () =>
        db.query("select count(*)::int as n from rota_flagged_duties($1) where family_id = $2", [
          ORGANIZATION,
          FAMILY_1,
        ]);
      await db.query(`set search_path to "${schema}", pg_catalog`);
      assert.ok((await flagged()).rows[0].n >= 3, "kept rota, weekend and slot places are flagged");

      succeeded(
        await fn(SUPER_ADMIN, "family_restore($1, $2, $3)", [
          nextKey("rs"),
          FAMILY_1,
          await familyVersion(db, FAMILY_1),
        ]),
      );

      await db.query(`set search_path to "${schema}", pg_catalog`);
      assert.equal((await flagged()).rows[0].n, 0);
      assert.equal(
        await count(db, "parents", `family_id = '${FAMILY_1}' and status = 'active'`),
        4,
      );
      assert.equal(
        await count(db, "children", `family_id = '${FAMILY_1}' and status = 'active'`),
        1,
      );
      assert.equal(
        await count(db, "parents", `family_id = '${FAMILY_1}' and account_id is not null`),
        0,
      );
      assert.equal(
        await count(db, "accounts", `id = '${PARENT_F1}' and status = 'deactivated'`),
        1,
      );
      assert.equal(
        await count(
          db,
          "group_memberships",
          `parent_id = '${PARENT_ROW_F1}' and status = 'active'`,
        ),
        0,
      );
      assert.equal(
        await count(
          db,
          "app_role_grants",
          `subject_id = '${PARENT_F1}' and role = 'group_admin' and revoked_at is null`,
        ),
        0,
      );
      assert.equal(
        await count(
          db,
          "todo_tasks",
          `id = '${TODO_CLAIMED}' and claimant_parent_id is null and needs_attention`,
        ),
        1,
      );
      assert.equal(await count(db, "notifications", `parent_id = '${PARENT_ROW_F1}'`), 0);
      assert.equal(
        await count(
          db,
          "assignments",
          `family_id = '${FAMILY_1}' and task_id = '${DUTY_ROTA}' and status = 'active'`,
        ),
        1,
      );
    });

    // Current behaviour that the removal and restore screens' wording rests on: the directory loses the address, the
    // closed sign-in account keeps it. Changing either side means changing those screens' sentences.
    it("restore: the directory has no address, the closed account keeps it, and it cannot be entered again", async () => {
      const address = (await db.query("select email from accounts where id = $1", [PARENT_F1]))
        .rows[0].email as string;
      succeeded(await removeFamily(db, schema));
      succeeded(
        await fn(SUPER_ADMIN, "family_restore($1, $2, $3)", [
          nextKey("rs"),
          FAMILY_1,
          await familyVersion(db, FAMILY_1),
        ]),
      );
      assert.equal(
        await count(
          db,
          "parent_profiles",
          `parent_id = '${PARENT_ROW_F1}' and email_on_record is null and phone is null and not sharing_consent`,
        ),
        1,
      );
      assert.equal(await count(db, "accounts", `id = '${PARENT_F1}' and email = '${address}'`), 1);
      const edited = await fn(SUPER_ADMIN, "parent_edit($1, $2, $3, $4)", [
        nextKey("pe"),
        PARENT_ROW_F1,
        await parentVersion(db, PARENT_ROW_F1),
        JSON.stringify({ email: address }),
      ]);
      assert.equal(edited.code, "EMAIL_UNAVAILABLE", JSON.stringify(edited));
    });

    it("restore: a parent who had been removed on their own does not come back with the family (BR207.1)", async () => {
      succeeded(await removeParent(db, schema, PARENT_ROW_CO));
      succeeded(await removeFamily(db, schema));
      succeeded(
        await fn(SUPER_ADMIN, "family_restore($1, $2, $3)", [
          nextKey("rs"),
          FAMILY_1,
          await familyVersion(db, FAMILY_1),
        ]),
      );
      assert.equal(
        await count(db, "parents", `id = '${PARENT_ROW_CO}' and status = 'archived'`),
        1,
      );
      assert.equal(await count(db, "parents", `id = '${PARENT_ROW_F1}' and status = 'active'`), 1);
    });

    it("allowed: a family that holds nothing is removed with zero counts for every step", async () => {
      const result = succeeded(await removeFamily(db, schema, FAMILY_NO_GROUP));
      assert.deepEqual(
        stepsOf(result).filter((step) => step.to_clear > 0 || step.to_flag > 0),
        [],
      );
      assert.deepEqual(result.ended_account_ids, []);
      assert.equal(result.removed_places, 0);
    });
  });
}
