import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import {
  ADMIN_G1,
  ADMIN_G2,
  ASSIGNMENT_F2_T3,
  callFunction,
  countAs,
  DIRECTORY_SCHEMAS,
  EVENT_1,
  EVENT_2,
  EVENT_OTHER,
  FAMILY_1,
  FAMILY_2,
  FAMILY_OTHER,
  GROUP_1,
  GROUP_2,
  GROUP_OTHER,
  nextKey,
  openDirectoryDatabase,
  ORGANIZATION,
  OTHER_ADMIN,
  OUTSIDER,
  PARENT_F1,
  PARENT_F2,
  PARENT_ROW_F1,
  REQUEST_1,
  seedCoordinationWorld,
  SUPER_ADMIN,
  TASK_2,
  TASK_3,
  TEACHER_G1,
  uuid,
} from "./directory-support.ts";
import {
  auditEvents,
  count,
  FAMILY_ADMIN_G1,
  PARENT_ROW_ADMIN_G1,
  tokenHashFor,
} from "./identity-support.ts";
import { bindSchema, openDatabase } from "./stack-support.ts";

/** The fixed-list tests of BR3.1 to BR3.13 and BR5.1, by the names of the Unit's test plan. */
const when = { starts_at: "2027-03-01T10:00:00Z", ends_at: "2027-03-01T12:00:00Z" };
const eventBody = (group: string | null, extra: object = {}) =>
  JSON.stringify({ group_id: group, title: "Tavaszi nap", ...when, ...extra });
const taskBody = (group: string | null, extra: object = {}) =>
  JSON.stringify({ group_id: group, title: "Pakolás", capacity: 2, ...when, ...extra });
const MADE_UP = uuid(99777);

for (const schema of DIRECTORY_SCHEMAS) {
  describe(`community roles in ${schema}`, () => {
    let db: pg.Client;
    let second: pg.Client;
    before(async () => {
      db = await openDirectoryDatabase(schema);
      second = await openDatabase();
    });
    after(async () => {
      await second.end();
      await db.end();
    });
    beforeEach(() => seedCoordinationWorld(db, schema));

    const call = (account: string, sql: string, values: unknown[] = []) =>
      callFunction(db, schema, account, sql, values);
    const callSecond = (account: string, sql: string, values: unknown[] = []) =>
      callFunction(second, schema, account, sql, values);
    const saveEvent = (account: string, body: string, key = nextKey("event")) =>
      call(account, "event_save($1, $2::jsonb)", [key, body]);
    const saveTask = (account: string, body: string, key = nextKey("task")) =>
      call(account, "task_save($1, $2::jsonb)", [key, body]);
    const grant = (
      account: string,
      change: string,
      subject: string,
      role: string,
      type: string,
      scope: string,
      key = nextKey("grant"),
    ) =>
      call(account, "grant_change($1, $2, $3, $4, $5, $6)", [
        key,
        change,
        subject,
        role,
        type,
        scope,
      ]);
    const canManage = async (account: string, group: string | null) =>
      (await call(account, "can_manage_group($1)", [group])) as unknown as boolean;
    const addGrant = (subject: string, role: string, type: string, scope: string) =>
      db.query(
        "insert into app_role_grants (subject_id, role, scope_type, scope_id, organization_id) values ($1, $2, $3, $4, $5)",
        [subject, role, type, scope, ORGANIZATION],
      );

    it("BR3.1 each pair", async () => {
      const subject = uuid(90001);
      await addGrant(subject, "parent", "family", FAMILY_1);
      await addGrant(subject, "group_admin", "group", GROUP_1);
      await addGrant(subject, "kindergarten_teacher", "organization", ORGANIZATION);
      await addGrant(subject, "super_admin", "organization", ORGANIZATION);
      assert.equal(await count(db, "app_role_grants", `subject_id = '${subject}'`), 4);
    });
    it("BR3.1 refused other pair", async () => {
      for (const [role, type, scope] of [
        ["kindergarten_teacher", "group", GROUP_1],
        ["group_admin", "organization", ORGANIZATION],
        ["parent", "group", GROUP_1],
        ["super_admin", "group", GROUP_1],
      ] as const) {
        await assert.rejects(addGrant(uuid(90002), role, type, scope), { code: "23514" });
      }
      const refused = await grant(
        SUPER_ADMIN,
        "add",
        PARENT_F1,
        "kindergarten_teacher",
        "group",
        GROUP_1,
      );
      assert.deepEqual([refused.state, refused.code], ["validation", "grant_invalid"]);
    });

    it("BR3.2 true", async () => {
      assert.equal(await canManage(ADMIN_G1, GROUP_1), true);
      assert.equal(await canManage(SUPER_ADMIN, GROUP_1), true);
      assert.equal(await canManage(SUPER_ADMIN, null), true);
    });
    it("BR3.2 revoked, archived parent", async () => {
      await db.query("update parents set status = 'archived' where id = $1", [PARENT_ROW_ADMIN_G1]);
      assert.equal(await canManage(ADMIN_G1, GROUP_1), false);
      await db.query("update parents set status = 'active' where id = $1", [PARENT_ROW_ADMIN_G1]);
      await db.query("update families set status = 'archived', archived_at = now() where id = $1", [
        FAMILY_ADMIN_G1,
      ]);
      assert.equal(await canManage(ADMIN_G1, GROUP_1), false);
      await db.query("update families set status = 'active', archived_at = null where id = $1", [
        FAMILY_ADMIN_G1,
      ]);
      assert.equal(await canManage(ADMIN_G1, GROUP_1), true);
      await db.query("update app_role_grants set revoked_at = now() where subject_id = $1", [
        ADMIN_G1,
      ]);
      assert.equal(await canManage(ADMIN_G1, GROUP_1), false);
    });
    it("BR3.2 other group", async () => {
      assert.equal(await canManage(ADMIN_G1, GROUP_2), false);
      assert.equal(await canManage(ADMIN_G1, null), false);
      assert.equal(await canManage(SUPER_ADMIN, GROUP_OTHER), false);
    });

    it("BR3.3 allowed, two groups", async () => {
      await addGrant(ADMIN_G1, "group_admin", "group", GROUP_2);
      assert.equal((await saveEvent(ADMIN_G1, eventBody(GROUP_1))).state, "success");
      assert.equal((await saveEvent(ADMIN_G1, eventBody(GROUP_2))).state, "success");
      assert.equal(await countAs(db, schema, ADMIN_G1, "tasks", `id = '${TASK_3}'`), 1);
    });
    it("BR3.3 parent refused", async () => {
      assert.equal((await saveEvent(PARENT_F1, eventBody(GROUP_1))).state, "denied");
    });
    it("BR3.3 ungranted group", async () => {
      assert.equal((await saveEvent(ADMIN_G1, eventBody(GROUP_2))).state, "denied");
      assert.equal(await countAs(db, schema, ADMIN_G1, "tasks", `id = '${TASK_3}'`), 0);
    });
    it("BR3.3 stale version", async () => {
      const result = await saveTask(
        ADMIN_G1,
        taskBody(GROUP_1, { id: TASK_2, expected_version: 99 }),
      );
      assert.equal(result.code, "VERSION_CONFLICT");
    });
    it("BR3.3 repeat", async () => {
      const key = nextKey("repeat");
      const first = await saveTask(ADMIN_G1, taskBody(GROUP_1), key);
      const again = await saveTask(ADMIN_G1, taskBody(GROUP_1), key);
      assert.deepEqual([again.reference, again.code], [first.reference, "replayed"]);
    });
    it("BR3.3 two admins", async () => {
      const body = eventBody(GROUP_1, { id: EVENT_1, expected_version: 1 });
      const results = await Promise.all([
        saveEvent(ADMIN_G1, body),
        callSecond(SUPER_ADMIN, "event_save($1, $2::jsonb)", [nextKey("e"), body]),
      ]);
      assert.deepEqual(results.map((result) => result.state).sort(), ["conflict", "success"]);
    });

    it("BR3.4 every command", async () => {
      await db.query(
        `insert into reminder_jobs (id, organization_id, task_id, threshold, task_starts_at, scheduled_for, correlation_id)
         values ($1, $2, $3, '7d', now(), now(), 'abcdef')`,
        [uuid(90010), ORGANIZATION, TASK_3],
      );
      const community = uuid(90011);
      await db.query(
        "insert into tasks (id, organization_id, group_id, title, capacity, starts_at, ends_at) values ($1, $2, null, 'Közös', 2, now() + interval '3 days', now() + interval '4 days')",
        [community, ORGANIZATION],
      );
      const key = () => nextKey("deny");
      const calls: [string, unknown[]][] = [
        [
          "event_save($1, $2::jsonb)",
          [key(), eventBody(GROUP_2, { id: EVENT_2, expected_version: 1 })],
        ],
        ["event_save_notes($1, $2, 1, 'a', 'b', 'c')", [key(), EVENT_2]],
        [
          "task_save($1, $2::jsonb)",
          [key(), taskBody(GROUP_2, { id: TASK_3, expected_version: 1 })],
        ],
        [
          "task_save($1, $2::jsonb)",
          [key(), taskBody(null, { id: community, expected_version: 1 })],
        ],
        ["assignment_assign($1, $2, $3, 1)", [key(), TASK_3, FAMILY_1]],
        ["assignment_assign($1, $2, $3, 1)", [key(), community, FAMILY_1]],
        ["assignment_remove($1, $2, 1)", [key(), ASSIGNMENT_F2_T3]],
        ["reminder_retry($1, $2, 1)", [key(), uuid(90010)]],
        ["directory_save($1, $2::jsonb)", [key(), JSON.stringify({ display_name: "Új" })]],
        [
          "structure_save($1, 'group', $2::jsonb)",
          [key(), JSON.stringify({ name: "U", description: "D" })],
        ],
        ["directory_archive_item($1, 'group', $2, 1)", [key(), GROUP_2]],
        ["family_archive($1, $2, 1)", [key(), FAMILY_2]],
        ["family_restore($1, $2, 1)", [key(), FAMILY_2]],
        ["lifecycle_run($1, $2, 1, true)", [key(), FAMILY_2]],
        ["settings_save($1, 1, true, 'duty')", [key()]],
      ];
      for (const [sql, values] of calls) {
        assert.equal((await call(ADMIN_G1, sql, values)).state, "denied", sql);
      }
      // The approval of group 1's request belongs to group 1's admin.
      const decide = await call(ADMIN_G2, "cancellation_decide($1, $2, true, null)", [
        key(),
        REQUEST_1,
      ]);
      assert.equal(decide.state, "denied");
    });
    it("BR3.4 direct calls and reads", async () => {
      for (const [table, where] of [
        ["events", `id = '${EVENT_2}'`],
        ["tasks", `id = '${TASK_3}'`],
        ["assignments", `id = '${ASSIGNMENT_F2_T3}'`],
        ["families", `id = '${FAMILY_2}'`],
        ["parents", `family_id = '${FAMILY_2}'`],
        ["children", `family_id = '${FAMILY_2}'`],
        ["parent_contacts", "true"],
      ] as const) {
        assert.equal(await countAs(db, schema, ADMIN_G1, table, where), 0, table);
      }
      // NFR3.3: a real item out of reach and a made-up id answer alike.
      for (const [sql, real] of [
        ["event_save_notes($1, $2, 1, 'a', 'b', 'c')", EVENT_2],
        ["assignment_remove($1, $2, 1)", ASSIGNMENT_F2_T3],
      ] as const) {
        const onReal = await call(ADMIN_G1, sql, [nextKey("a"), real]);
        const onMade = await call(ADMIN_G1, sql, [nextKey("b"), MADE_UP]);
        assert.deepEqual(onReal, onMade, sql);
      }
      const realAssign = await call(ADMIN_G1, "assignment_assign($1, $2, $3, 1)", [
        nextKey("c"),
        TASK_3,
        FAMILY_1,
      ]);
      const madeAssign = await call(ADMIN_G1, "assignment_assign($1, $2, $3, 1)", [
        nextKey("d"),
        MADE_UP,
        FAMILY_1,
      ]);
      assert.deepEqual(realAssign, madeAssign);
    });

    it("BR3.5 super admin", async () => {
      const result = await saveEvent(SUPER_ADMIN, eventBody(null));
      assert.equal(result.state, "success");
      assert.equal(await count(db, "events", `id = '${result.reference}' and group_id is null`), 1);
      assert.equal((await saveTask(SUPER_ADMIN, taskBody(null))).state, "success");
    });
    it("BR3.5 group admin refused", async () => {
      assert.equal((await saveEvent(ADMIN_G1, eventBody(null))).state, "denied");
      assert.equal((await saveTask(ADMIN_G1, taskBody(null))).state, "denied");
    });
    it("BR3.5 other community", async () => {
      const result = await saveEvent(
        SUPER_ADMIN,
        eventBody(null, { id: EVENT_OTHER, expected_version: 1 }),
      );
      assert.deepEqual(
        [result.state, result.field, result.reason],
        ["validation", "id", "not_found"],
      );
    });
    it("BR3.5 stale version", async () => {
      const created = await saveEvent(SUPER_ADMIN, eventBody(null));
      const result = await saveEvent(
        SUPER_ADMIN,
        eventBody(null, { id: created.reference, expected_version: 99 }),
      );
      assert.equal(result.code, "VERSION_CONFLICT");
    });
    it("BR3.5 repeat", async () => {
      const key = nextKey("repeat");
      const first = await saveEvent(SUPER_ADMIN, eventBody(null), key);
      const again = await saveEvent(SUPER_ADMIN, eventBody(null), key);
      assert.deepEqual([again.reference, again.code], [first.reference, "replayed"]);
    });
    it("BR3.5 two editors", async () => {
      const created = await saveEvent(SUPER_ADMIN, eventBody(null));
      const body = eventBody(null, { id: created.reference, expected_version: 1 });
      const results = await Promise.all([
        saveEvent(SUPER_ADMIN, body),
        callSecond(SUPER_ADMIN, "event_save($1, $2::jsonb)", [nextKey("e"), body]),
      ]);
      assert.deepEqual(results.map((result) => result.state).sort(), ["conflict", "success"]);
    });

    it("BR3.6 allowed", async () => {
      const result = await grant(SUPER_ADMIN, "add", PARENT_F1, "group_admin", "group", GROUP_2);
      assert.equal(result.state, "success");
      assert.equal(await canManage(PARENT_F1, GROUP_2), true);
    });
    it("BR3.6 no parent, invitation refused", async () => {
      const noParent = await grant(SUPER_ADMIN, "add", OUTSIDER, "group_admin", "group", GROUP_1);
      assert.deepEqual([noParent.state, noParent.code], ["validation", "parent_required"]);
      const invitation = await call(
        SUPER_ADMIN,
        "invitation_create($1, $2, 'group_admin', 'group', $3, $4)",
        [nextKey("i"), "uj@example.test", GROUP_1, tokenHashFor("group-admin")],
      );
      assert.deepEqual([invitation.state, invitation.code], ["validation", "invitation_invalid"]);
    });
    it("BR3.6 other community", async () => {
      const result = await grant(
        SUPER_ADMIN,
        "add",
        PARENT_F1,
        "group_admin",
        "group",
        GROUP_OTHER,
      );
      assert.deepEqual([result.state, result.code], ["validation", "scope_not_found"]);
    });
    it("BR3.6 repeat", async () => {
      const key = nextKey("grant");
      await grant(SUPER_ADMIN, "add", PARENT_F1, "group_admin", "group", GROUP_2, key);
      const again = await grant(
        SUPER_ADMIN,
        "add",
        PARENT_F1,
        "group_admin",
        "group",
        GROUP_2,
        key,
      );
      assert.equal(again.code, "replayed");
      assert.equal(
        await count(db, "app_role_grants", `subject_id = '${PARENT_F1}' and role = 'group_admin'`),
        1,
      );
    });
    it("BR3.6 two grants", async () => {
      const sql = "grant_change($1, 'add', $2, 'group_admin', 'group', $3)";
      const results = await Promise.all([
        call(SUPER_ADMIN, sql, [nextKey("a"), PARENT_F1, GROUP_2]),
        callSecond(SUPER_ADMIN, sql, [nextKey("b"), PARENT_F1, GROUP_2]),
      ]);
      assert.deepEqual(results.map((result) => result.state).sort(), ["conflict", "success"]);
    });

    it("BR3.7 whole community", async () => {
      await db.query(
        "insert into tasks (id, organization_id, group_id, title, capacity, starts_at, ends_at) values ($1, $2, null, 'Közös', 2, now() + interval '3 days', now() + interval '4 days')",
        [uuid(90020), ORGANIZATION],
      );
      const ids = (result: Record<string, unknown>) =>
        (result.items as { id: string }[]).map((item) => item.id);
      const all = await call(TEACHER_G1, "schedule_get('all')");
      assert.ok(
        ids(all).includes(TASK_2) && ids(all).includes(TASK_3) && ids(all).includes(uuid(90020)),
      );
      assert.deepEqual(ids(await call(TEACHER_G1, "schedule_get('community')")), [uuid(90020)]);
      assert.ok(
        ids(await call(TEACHER_G1, "schedule_get('group', $1)", [GROUP_2])).includes(TASK_3),
      );
      assert.deepEqual(Object.keys((all.items as object[])[0]!).sort(), [
        "assignee_display_names",
        "coordination_display_name",
        "current_status_label",
        "ends_at",
        "group_id",
        "id",
        "location",
        "owner_display_name",
        "starts_at",
        "title",
      ]);
    });
    it("BR3.7 writes refused", async () => {
      assert.equal((await saveEvent(TEACHER_G1, eventBody(GROUP_1))).state, "denied");
      assert.equal(
        (
          await call(TEACHER_G1, "assignment_assign($1, $2, $3, 1)", [
            nextKey("a"),
            TASK_2,
            FAMILY_1,
          ])
        ).state,
        "denied",
      );
      assert.equal(await countAs(db, schema, TEACHER_G1, "tasks"), 0);
    });
    it("BR3.7 other community", async () => {
      assert.equal(
        (await call(TEACHER_G1, "schedule_get('group', $1)", [GROUP_OTHER])).state,
        "denied",
      );
      const items = (await call(TEACHER_G1, "schedule_get('all')")).items as { group_id: string }[];
      assert.ok(items.every((item) => item.group_id !== GROUP_OTHER));
    });

    it("BR3.8 super admin", async () => {
      const added = await grant(
        SUPER_ADMIN,
        "add",
        OUTSIDER,
        "kindergarten_teacher",
        "organization",
        ORGANIZATION,
      );
      assert.equal(added.state, "success");
      const invited = await call(
        SUPER_ADMIN,
        "invitation_create($1, $2, 'kindergarten_teacher', 'organization', $3, $4)",
        [nextKey("i"), "ovono@example.test", ORGANIZATION, tokenHashFor("teacher-invite")],
      );
      assert.equal(invited.state, "success");
    });
    it("BR3.8 group admin refused", async () => {
      const result = await grant(
        ADMIN_G1,
        "add",
        OUTSIDER,
        "kindergarten_teacher",
        "organization",
        ORGANIZATION,
      );
      assert.equal(result.state, "denied");
    });
    it("BR3.8 other community", async () => {
      const result = await grant(
        SUPER_ADMIN,
        "add",
        OTHER_ADMIN,
        "kindergarten_teacher",
        "organization",
        ORGANIZATION,
      );
      assert.deepEqual([result.state, result.code], ["validation", "account_not_found"]);
    });
    it("BR3.8 repeat", async () => {
      const key = nextKey("grant");
      await grant(
        SUPER_ADMIN,
        "add",
        OUTSIDER,
        "kindergarten_teacher",
        "organization",
        ORGANIZATION,
        key,
      );
      const again = await grant(
        SUPER_ADMIN,
        "add",
        OUTSIDER,
        "kindergarten_teacher",
        "organization",
        ORGANIZATION,
        key,
      );
      assert.equal(again.code, "replayed");
    });
    it("BR3.8 two grants", async () => {
      const sql = "grant_change($1, 'add', $2, 'kindergarten_teacher', 'organization', $3)";
      const results = await Promise.all([
        call(SUPER_ADMIN, sql, [nextKey("a"), OUTSIDER, ORGANIZATION]),
        callSecond(SUPER_ADMIN, sql, [nextKey("b"), OUTSIDER, ORGANIZATION]),
      ]);
      assert.deepEqual(results.map((result) => result.state).sort(), ["conflict", "success"]);
    });

    const familyBody = (extra: object) =>
      JSON.stringify({ display_name: "Átírt család", ...extra });
    const saveFamily = (account: string, body: string, key = nextKey("family")) =>
      call(account, "directory_save($1, $2::jsonb)", [key, body]);
    it("BR3.9 super admin, own family", async () => {
      const result = await saveFamily(
        SUPER_ADMIN,
        familyBody({ family_id: FAMILY_1, expected_version: 1 }),
      );
      assert.equal(result.state, "success");
      assert.equal(await countAs(db, schema, PARENT_F1, "families"), 1);
      assert.equal(await countAs(db, schema, SUPER_ADMIN, "families", `id = '${FAMILY_2}'`), 1);
    });
    it("BR3.9 group admin, teacher refused", async () => {
      for (const account of [ADMIN_G1, TEACHER_G1]) {
        const result = await saveFamily(
          account,
          familyBody({ family_id: FAMILY_1, expected_version: 1 }),
        );
        assert.equal(result.state, "denied");
        assert.equal(await countAs(db, schema, account, "families", `id = '${FAMILY_1}'`), 0);
        assert.equal(await countAs(db, schema, account, "parents", `family_id = '${FAMILY_1}'`), 0);
      }
    });
    it("BR3.9 other community", async () => {
      const result = await saveFamily(
        SUPER_ADMIN,
        familyBody({ family_id: FAMILY_OTHER, expected_version: 1 }),
      );
      assert.deepEqual([result.state, result.code], ["validation", "family_not_found"]);
    });
    it("BR3.9 stale version", async () => {
      const result = await saveFamily(
        SUPER_ADMIN,
        familyBody({ family_id: FAMILY_1, expected_version: 99 }),
      );
      assert.equal(result.code, "VERSION_CONFLICT");
    });
    it("BR3.9 repeat", async () => {
      const key = nextKey("repeat");
      const body = familyBody({ family_id: FAMILY_1, expected_version: 1 });
      await saveFamily(SUPER_ADMIN, body, key);
      assert.equal((await saveFamily(SUPER_ADMIN, body, key)).code, "replayed");
    });
    it("BR3.9 two editors", async () => {
      const body = familyBody({ family_id: FAMILY_1, expected_version: 1 });
      const results = await Promise.all([
        saveFamily(SUPER_ADMIN, body),
        callSecond(SUPER_ADMIN, "directory_save($1, $2::jsonb)", [nextKey("f"), body]),
      ]);
      assert.deepEqual(results.map((result) => result.state).sort(), ["conflict", "success"]);
    });

    it("BR3.10 exact fields", async () => {
      const result = await call(ADMIN_G1, "family_name_list()");
      const items = result.items as Record<string, unknown>[];
      assert.ok(items.length > 0);
      for (const item of items) assert.deepEqual(Object.keys(item).sort(), ["display_name", "id"]);
    });
    it("BR3.10 parent refused", async () => {
      assert.equal((await call(PARENT_F1, "family_name_list()")).state, "denied");
    });
    it("BR3.10 other community", async () => {
      const items = (await call(ADMIN_G1, "family_name_list()")).items as { id: string }[];
      assert.ok(items.every((item) => item.id !== FAMILY_OTHER));
    });

    it("BR3.11 active until revoked", async () => {
      assert.equal((await saveEvent(ADMIN_G1, eventBody(GROUP_1))).state, "success");
    });
    it("BR3.11 next request denied", async () => {
      await grant(SUPER_ADMIN, "revoke", ADMIN_G1, "group_admin", "group", GROUP_1);
      assert.equal((await saveEvent(ADMIN_G1, eventBody(GROUP_1))).state, "denied");
      assert.equal(await countAs(db, schema, ADMIN_G1, "events", `group_id = '${GROUP_1}'`), 0);
      await db.query("update families set status = 'archived', archived_at = now() where id = $1", [
        FAMILY_1,
      ]);
      assert.equal((await call(PARENT_F1, "working_group_list()")).state, "denied");
      assert.equal((await call(PARENT_F1, "duty_list()")).code, "no_family");
    });
    it("BR3.11 repeat revoke", async () => {
      const key = nextKey("grant");
      await grant(SUPER_ADMIN, "revoke", ADMIN_G1, "group_admin", "group", GROUP_1, key);
      const again = await grant(
        SUPER_ADMIN,
        "revoke",
        ADMIN_G1,
        "group_admin",
        "group",
        GROUP_1,
        key,
      );
      assert.equal(again.code, "replayed");
      const missing = await grant(SUPER_ADMIN, "revoke", ADMIN_G1, "group_admin", "group", GROUP_1);
      assert.equal(missing.code, "grant_not_found");
    });
    it("BR3.11 revoke while acting", async () => {
      const results = await Promise.all([
        saveEvent(ADMIN_G1, eventBody(GROUP_1)),
        callSecond(SUPER_ADMIN, "grant_change($1, 'revoke', $2, 'group_admin', 'group', $3)", [
          nextKey("g"),
          ADMIN_G1,
          GROUP_1,
        ]),
      ]);
      assert.ok(["success", "denied"].includes(results[0].state));
      assert.equal(results[1].state, "success");
      assert.equal((await saveEvent(ADMIN_G1, eventBody(GROUP_1))).state, "denied");
    });

    it("BR3.12 event written", async () => {
      await grant(SUPER_ADMIN, "add", PARENT_F1, "group_admin", "group", GROUP_2);
      await grant(SUPER_ADMIN, "revoke", PARENT_F1, "group_admin", "group", GROUP_2);
      const events = (await auditEvents(db)).filter((event) => event.target_id === PARENT_F1);
      assert.deepEqual(
        events.map((event) => [event.action, event.group_id, event.details]),
        [
          ["role.grant", GROUP_2, "grant:group_admin"],
          ["role.revoke", GROUP_2, "grant:group_admin"],
        ],
      );
      assert.ok(!JSON.stringify(events).includes("Fenyő"));
    });
    it("BR3.12 failed audit rolls back", async () => {
      await db.query(`create or replace function audit_refuse_test() returns trigger language plpgsql
        as $$ begin raise exception 'audit down'; end $$`);
      await db.query(
        "create trigger audit_refuse_test before insert on audit_events for each row execute function audit_refuse_test()",
      );
      try {
        await assert.rejects(grant(SUPER_ADMIN, "add", PARENT_F1, "group_admin", "group", GROUP_2));
        assert.equal(
          await count(
            db,
            "app_role_grants",
            `subject_id = '${PARENT_F1}' and role = 'group_admin'`,
          ),
          0,
        );
      } finally {
        await db.query("drop trigger audit_refuse_test on audit_events");
        await db.query("drop function audit_refuse_test()");
      }
    });
    it("BR3.12 one event on repeat", async () => {
      const key = nextKey("grant");
      await grant(SUPER_ADMIN, "add", PARENT_F1, "group_admin", "group", GROUP_2, key);
      await grant(SUPER_ADMIN, "add", PARENT_F1, "group_admin", "group", GROUP_2, key);
      assert.equal(
        (await auditEvents(db)).filter((event) => event.target_id === PARENT_F1).length,
        1,
      );
    });

    it("BR3.13 parent allowed", async () => {
      assert.equal((await call(PARENT_F2, "duty_list()")).state, "success");
      assert.equal((await call(PARENT_F1, "current_parent_id()")) as unknown, PARENT_ROW_F1);
      assert.equal((await call(PARENT_F1, "current_family_id()")) as unknown, FAMILY_1);
    });
    it("BR3.13 teacher, super admin denied", async () => {
      for (const account of [TEACHER_G1, SUPER_ADMIN]) {
        const list = await call(account, "duty_list()");
        assert.deepEqual([list.state, list.code], ["denied", "no_family"]);
        const signUp = await call(account, "duty_sign_up($1, $2, 1)", [nextKey("s"), TASK_2]);
        assert.deepEqual([signUp.state, signUp.code], ["denied", "no_family"]);
      }
    });

    it("BR5.1 name, removed label", async () => {
      await bindSchema(db, schema);
      const parentName = async (id: string) =>
        (await db.query("select parent_display_name($1) as v", [id])).rows[0].v;
      const familyName = async (id: string) =>
        (await db.query("select family_display_name($1) as v", [id])).rows[0].v;
      assert.equal(await parentName(PARENT_ROW_F1), "Fenyő Anna");
      assert.equal(await familyName(FAMILY_1), "Fenyő család");
      await db.query("update families set anonymized_at = now() where id = $1", [FAMILY_1]);
      assert.equal(await parentName(PARENT_ROW_F1), "korábbi tag");
      assert.equal(await familyName(FAMILY_1), "korábbi tag");
      assert.equal(await parentName(MADE_UP), null);
      assert.equal(await familyName(MADE_UP), null);
    });
  });
}
