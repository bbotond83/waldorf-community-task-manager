import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import {
  ADMIN_G1,
  ADMIN_G2,
  ASSIGNMENT_F1_T1,
  asActor,
  CO_PARENT_F1,
  callFunction,
  DEACTIVATED,
  DIRECTORY_SCHEMAS,
  EVENT_1,
  EVENT_2,
  FAMILY_1,
  FAMILY_2,
  GROUP_1,
  GROUP_2,
  GROUP_OTHER,
  nextKey,
  OTHER_ADMIN,
  openDirectoryDatabase,
  ORGANIZATION,
  OUTSIDER,
  PARENT_F1,
  PARENT_F2,
  REQUEST_1,
  seedCoordinationWorld,
  SUPER_ADMIN,
  TASK_1,
  TASK_2,
  TASK_3,
  TEACHER_G1,
  uuid,
} from "./directory-support.ts";
import { count } from "./identity-support.ts";
import { failureOf } from "./stack-support.ts";

type Result = Awaited<ReturnType<typeof callFunction>>;

const START = "2031-05-01T10:00:00Z";
const END = "2031-05-01T12:00:00Z";

/** Event, task and note functions: reach, validation, stale versions, cancellation, the family's own note, repeated keys (BR31.1, BR31.8, NFR6.11, NFR6.12). */
for (const schema of DIRECTORY_SCHEMAS) {
  describe(`coordination functions in ${schema}`, () => {
    let db: pg.Client;

    before(async () => {
      db = await openDirectoryDatabase(schema);
    });
    after(async () => {
      await db.end();
    });
    beforeEach(async () => {
      await seedCoordinationWorld(db, schema);
    });

    const eventSave = (account: string, payload: unknown, key = nextKey("ev")): Promise<Result> =>
      callFunction(db, schema, account, "event_save($1, $2::jsonb)", [
        key,
        JSON.stringify(payload),
      ]);
    const taskSave = (account: string, payload: unknown, key = nextKey("tk")): Promise<Result> =>
      callFunction(db, schema, account, "task_save($1, $2::jsonb)", [key, JSON.stringify(payload)]);
    const notes = (
      account: string,
      eventId: string,
      version: number | null,
      allergen: string | null,
      supply: string | null = null,
      food: string | null = null,
    ) =>
      callFunction(db, schema, account, "event_save_notes($1, $2, $3, $4, $5, $6)", [
        nextKey("nt"),
        eventId,
        version,
        allergen,
        supply,
        food,
      ]);
    const contribution = (
      account: string,
      task: string,
      text: string | null,
      key = nextKey("co"),
    ) => callFunction(db, schema, account, "contribution_save($1, $2, $3)", [key, task, text]);
    const one = async (sql: string, values: unknown[] = []) =>
      (await db.query(sql, values)).rows[0] as Record<string, unknown>;

    const newEvent = {
      group_id: GROUP_1,
      title: "Téli ünnep",
      location: "Terem",
      coordinator_name: "Nagy Éva",
      starts_at: START,
      ends_at: END,
    };
    const newTask = {
      group_id: GROUP_1,
      title: "Takarítás",
      capacity: 2,
      starts_at: START,
      ends_at: END,
    };

    it("creates and changes an event for an admin who reaches its group, and refuses everyone else (BR31.1)", async () => {
      const created = await eventSave(ADMIN_G1, newEvent);
      assert.deepEqual([created.state, created.version], ["success", 1]);
      const row = await one(
        "select title, location, coordinator_name, status from events where id = $1",
        [created.reference],
      );
      assert.deepEqual(row, {
        title: "Téli ünnep",
        location: "Terem",
        coordinator_name: "Nagy Éva",
        status: "planned",
      });
      const changed = await eventSave(ADMIN_G1, {
        ...newEvent,
        id: created.reference,
        expected_version: 1,
        title: "Téli ünnep 2",
      });
      assert.deepEqual([changed.state, changed.version], ["success", 2]);
      for (const account of [ADMIN_G2, PARENT_F1, CO_PARENT_F1, TEACHER_G1, OUTSIDER]) {
        assert.equal((await eventSave(account, newEvent)).state, "denied", account);
      }
      assert.equal(
        (await eventSave(ADMIN_G2, { ...newEvent, id: created.reference, expected_version: 2 }))
          .state,
        "denied",
        "a group admin of another group",
      );
      assert.equal(
        (await eventSave(SUPER_ADMIN, { ...newEvent, group_id: GROUP_2 })).state,
        "success",
      );
      const inactive = await eventSave(DEACTIVATED, newEvent);
      assert.deepEqual([inactive.state, inactive.code], ["denied", "session_inactive"]);
    });

    it("validates an event's fields and refuses a stale version without changing anything", async () => {
      const cases: [string, unknown][] = [
        ["title", { ...newEvent, title: " " }],
        ["title", { ...newEvent, title: "x".repeat(201) }],
        ["location", { ...newEvent, location: "x".repeat(201) }],
        ["coordinator_name", { ...newEvent, coordinator_name: "x".repeat(201) }],
        ["starts_at", { ...newEvent, starts_at: "nem dátum" }],
        ["ends_at", { ...newEvent, ends_at: "2031-05-01T09:00:00Z" }],
        ["status", { ...newEvent, status: "postponed" }],
        ["group_id", { ...newEvent, group_id: "nem-uuid" }],
      ];
      for (const [field, payload] of cases) {
        const result = await eventSave(SUPER_ADMIN, payload);
        assert.deepEqual(
          [result.state, result.code, result.field],
          ["validation", "field_invalid", field],
          field,
        );
      }
      const foreignGroup = await eventSave(SUPER_ADMIN, { ...newEvent, group_id: GROUP_OTHER });
      assert.deepEqual([foreignGroup.field, foreignGroup.reason], ["group_id", "not_found"]);
      const crossOrganization = await eventSave(OTHER_ADMIN, {
        ...newEvent,
        id: EVENT_1,
        expected_version: 1,
      });
      assert.equal(
        crossOrganization.state,
        "validation",
        "a group of another organization is not found",
      );
      const stale = await eventSave(SUPER_ADMIN, {
        ...newEvent,
        id: EVENT_1,
        expected_version: 9,
        title: "Elavult",
      });
      assert.deepEqual([stale.state, stale.code], ["conflict", "VERSION_CONFLICT"]);
      assert.equal(
        (await one("select title from events where id = $1", [EVENT_1])).title,
        "Őszi ünnep",
      );
      assert.equal(await count(db, "events"), 3);
    });

    it("closes the open tasks of a cancelled event and keeps their places; the group of an event with tasks is locked", async () => {
      const cancelled = await eventSave(SUPER_ADMIN, {
        id: EVENT_1,
        expected_version: 1,
        group_id: GROUP_1,
        title: "Őszi ünnep",
        starts_at: START,
        ends_at: END,
        status: "cancelled",
      });
      assert.equal(cancelled.state, "success");
      assert.equal(
        (await one("select status from tasks where id = $1", [TASK_1])).status,
        "closed",
      );
      assert.equal(
        (await one("select status from tasks where id = $1", [TASK_2])).status,
        "open",
        "a task without that event is untouched",
      );
      assert.equal(
        (await one("select status from assignments where id = $1", [ASSIGNMENT_F1_T1])).status,
        "cancellation_pending",
        "existing places stay",
      );
      const moved = await eventSave(SUPER_ADMIN, {
        id: EVENT_2,
        expected_version: 1,
        group_id: GROUP_1,
        title: "Munkanap",
        starts_at: START,
        ends_at: END,
      });
      assert.deepEqual([moved.field, moved.reason], ["group_id", "locked"]);
    });

    it("saves the three event notes with the event's version, clears empty ones and limits their length (BR31.8)", async () => {
      const saved = await notes(ADMIN_G1, EVENT_1, 1, "  tej, tojás ", "evőeszköz", "");
      assert.deepEqual([saved.state, saved.version], ["success", 2]);
      assert.deepEqual(
        await one("select allergen_note, supply_note, food_note from events where id = $1", [
          EVENT_1,
        ]),
        {
          allergen_note: "tej, tojás",
          supply_note: "evőeszköz",
          food_note: null,
        },
      );
      const stale = await notes(ADMIN_G1, EVENT_1, 1, "régi");
      assert.deepEqual([stale.state, stale.code], ["conflict", "VERSION_CONFLICT"]);
      const long = await notes(ADMIN_G1, EVENT_1, 2, "x".repeat(301));
      assert.deepEqual([long.state, long.field], ["validation", "allergen_note"]);
      assert.equal((await notes(ADMIN_G1, EVENT_1, null, "x")).field, "expected_version");
      for (const account of [ADMIN_G2, PARENT_F1, TEACHER_G1, OUTSIDER]) {
        assert.equal((await notes(account, EVENT_1, 2, "tilos")).state, "denied", account);
      }
      assert.equal((await notes(OTHER_ADMIN, EVENT_1, 2, "idegen")).field, "event_id");
      assert.equal(
        (await one("select allergen_note from events where id = $1", [EVENT_1])).allergen_note,
        "tej, tojás",
      );
    });

    it("creates a task with or without an event, takes the place from the event and defaults the rest", async () => {
      const withEvent = await taskSave(ADMIN_G1, {
        ...newTask,
        event_id: EVENT_1,
        category: "konyha",
      });
      assert.deepEqual([withEvent.state, withEvent.version], ["success", 1]);
      assert.deepEqual(
        await one("select location, category, status, event_id from tasks where id = $1", [
          withEvent.reference,
        ]),
        {
          location: "Tornaterem",
          category: "konyha",
          status: "open",
          event_id: EVENT_1,
        },
      );
      const bare = await taskSave(ADMIN_G1, newTask);
      assert.deepEqual(
        await one("select location, category, event_id from tasks where id = $1", [bare.reference]),
        {
          location: "-",
          category: "general",
          event_id: null,
        },
      );
      const own = await taskSave(ADMIN_G1, { ...newTask, location: "Udvar" });
      assert.equal(
        (await one("select location from tasks where id = $1", [own.reference])).location,
        "Udvar",
      );
      for (const account of [ADMIN_G2, PARENT_F1, TEACHER_G1, OUTSIDER]) {
        assert.equal((await taskSave(account, newTask)).state, "denied", account);
      }
    });

    it("validates a task: capacity 1 to 50, not below the places taken, times, the event's group, and no creation as cancelled", async () => {
      const cases: [string, unknown][] = [
        ["capacity", { ...newTask, capacity: 0 }],
        ["capacity", { ...newTask, capacity: 51 }],
        ["capacity", { ...newTask, capacity: "sok" }],
        ["title", { ...newTask, title: "" }],
        ["category", { ...newTask, category: "x".repeat(101) }],
        ["starts_at", { ...newTask, starts_at: null }],
        ["ends_at", { ...newTask, ends_at: "2031-05-01T09:00:00Z" }],
        ["status", { ...newTask, status: "cancelled" }],
        ["event_id", { ...newTask, event_id: "nem-uuid" }],
      ];
      for (const [field, payload] of cases) {
        const result = await taskSave(SUPER_ADMIN, payload);
        assert.deepEqual([result.state, result.field], ["validation", field], field);
      }
      const mismatch = await taskSave(SUPER_ADMIN, { ...newTask, event_id: EVENT_2 });
      assert.deepEqual([mismatch.field, mismatch.reason], ["event_id", "group_mismatch"]);
      // Capacity may equal the taken places but not go below: task 1 has one place taken.
      await db.query(
        "insert into assignments (organization_id, task_id, family_id, source) values ($1, $2, $3, 'admin_assign')",
        [ORGANIZATION, TASK_1, FAMILY_2],
      );
      const below = await taskSave(SUPER_ADMIN, {
        id: TASK_1,
        expected_version: 1,
        group_id: GROUP_1,
        event_id: EVENT_1,
        title: "Sütés",
        capacity: 1,
        starts_at: START,
        ends_at: END,
      });
      assert.deepEqual([below.field, below.reason, below.taken], ["capacity", "below_taken", 2]);
      const equal = await taskSave(SUPER_ADMIN, {
        id: TASK_1,
        expected_version: 1,
        group_id: GROUP_1,
        event_id: EVENT_1,
        title: "Sütés",
        capacity: 2,
        starts_at: START,
        ends_at: END,
      });
      assert.equal(equal.state, "success");
      assert.equal(await count(db, "tasks"), 4, "no refusal created a task");
    });

    it("refuses a stale task version, keeps a cancelled task final, and keeps the group of a task with places", async () => {
      const base = {
        group_id: GROUP_1,
        event_id: EVENT_1,
        title: "Sütés",
        capacity: 3,
        starts_at: START,
        ends_at: END,
      };
      const stale = await taskSave(SUPER_ADMIN, { ...base, id: TASK_1, expected_version: 5 });
      assert.deepEqual([stale.state, stale.code], ["conflict", "VERSION_CONFLICT"]);
      const moved = await taskSave(SUPER_ADMIN, {
        ...base,
        id: TASK_1,
        expected_version: 1,
        group_id: GROUP_2,
        event_id: null,
      });
      assert.deepEqual(
        [moved.field, moved.reason],
        ["group_id", "locked"],
        "a task with places stays in its group",
      );
      const missingVersion = await taskSave(SUPER_ADMIN, { ...base, id: TASK_1 });
      assert.equal(missingVersion.field, "expected_version");
      const cancelled = await taskSave(SUPER_ADMIN, {
        ...base,
        id: TASK_1,
        expected_version: 1,
        status: "cancelled",
      });
      assert.equal(cancelled.state, "success");
      const again = await taskSave(SUPER_ADMIN, {
        ...base,
        id: TASK_1,
        expected_version: 2,
        status: "open",
      });
      assert.deepEqual([again.field, again.reason], ["id", "cancelled"]);
      assert.equal(
        (await taskSave(ADMIN_G2, { ...base, id: TASK_1, expected_version: 2 })).state,
        "denied",
      );
    });

    it("cancelling a task removes its places and withdraws every open request that involves them, returning other families' sources to active (BR31.1)", async () => {
      // Family 2 holds a place on task 2 (group 1) and has asked to swap it for family 1's place on task 1.
      const other = uuid(900);
      await db.query(
        "insert into assignments (id, organization_id, task_id, family_id, source, status) values ($1, $2, $3, $4, 'swap', 'swap_pending')",
        [other, ORGANIZATION, TASK_2, FAMILY_2],
      );
      await db.query(
        `insert into change_requests (organization_id, assignment_id, target_assignment_id, kind, requested_by_parent_id, source_task_id, source_assignment_version, target_task_id, target_assignment_version)
         values ($1, $2, $3, 'swap', $4, $5, 1, $6, 1)`,
        [ORGANIZATION, other, ASSIGNMENT_F1_T1, uuid(603), TASK_2, TASK_1],
      );
      const result = await taskSave(SUPER_ADMIN, {
        id: TASK_1,
        expected_version: 1,
        group_id: GROUP_1,
        event_id: EVENT_1,
        title: "Sütés",
        capacity: 3,
        starts_at: START,
        ends_at: END,
        status: "cancelled",
      });
      assert.equal(result.state, "success");
      assert.equal(
        (await one("select status from assignments where id = $1", [ASSIGNMENT_F1_T1])).status,
        "removed",
      );
      assert.equal(
        (await one("select status from assignments where id = $1", [other])).status,
        "active",
        "the other family's source is active again",
      );
      assert.equal(await count(db, "change_requests", "status = 'open'"), 0);
      assert.equal(
        (await one("select status from change_requests where id = $1", [REQUEST_1])).status,
        "withdrawn",
      );
      assert.equal(
        await count(db, "assignments", `task_id = '${TASK_1}' and status <> 'removed'`),
        0,
      );
      assert.equal(await count(db, "audit_events"), 0, "task changes are not audited");
    });

    it("closes tasks of a cancelled event: a new one is created closed and a closed one cannot be reopened", async () => {
      await eventSave(SUPER_ADMIN, {
        id: EVENT_1,
        expected_version: 1,
        group_id: GROUP_1,
        title: "Őszi ünnep",
        starts_at: START,
        ends_at: END,
        status: "cancelled",
      });
      const created = await taskSave(SUPER_ADMIN, { ...newTask, event_id: EVENT_1 });
      assert.equal(created.state, "success");
      assert.equal(
        (await one("select status from tasks where id = $1", [created.reference])).status,
        "closed",
      );
      const reopen = await taskSave(SUPER_ADMIN, {
        ...newTask,
        id: TASK_1,
        expected_version: 2,
        event_id: EVENT_1,
        status: "open",
      });
      assert.deepEqual([reopen.field, reopen.reason], ["status", "event_cancelled"]);
      // A task of an event that is not cancelled moves freely between open and closed.
      const closed = await taskSave(SUPER_ADMIN, {
        ...newTask,
        id: TASK_3,
        expected_version: 1,
        group_id: GROUP_2,
        event_id: EVENT_2,
        status: "closed",
      });
      assert.equal(closed.state, "success");
      const open = await taskSave(SUPER_ADMIN, {
        ...newTask,
        id: TASK_3,
        expected_version: 2,
        group_id: GROUP_2,
        event_id: EVENT_2,
        status: "open",
      });
      assert.equal(open.state, "success");
    });

    it("lets a parent of the assigned family save the family's note, last save wins, and refuses everyone else (BR31.8)", async () => {
      const first = await contribution(PARENT_F1, TASK_1, "  Almás pite  ");
      assert.equal(first.state, "success");
      assert.equal(
        (
          await one("select text from contribution_notes where assignment_id = $1", [
            ASSIGNMENT_F1_T1,
          ])
        ).text,
        "Almás pite",
      );
      const co = await contribution(CO_PARENT_F1, TASK_1, "Körtés pite");
      assert.equal(co.state, "success");
      assert.equal(
        await count(db, "contribution_notes", `assignment_id = '${ASSIGNMENT_F1_T1}'`),
        1,
        "one note per place",
      );
      assert.equal(
        (
          await one("select text, version from contribution_notes where assignment_id = $1", [
            ASSIGNMENT_F1_T1,
          ])
        ).text,
        "Körtés pite",
      );
      // Another family's parent has no place on the task, an admin is not a family, and a long text is refused.
      assert.equal((await contribution(PARENT_F2, TASK_1, "Idegen")).state, "denied");
      const admin = await contribution(SUPER_ADMIN, TASK_1, "Admin");
      assert.deepEqual([admin.state, admin.code], ["denied", "no_family"]);
      assert.equal((await contribution(PARENT_F1, TASK_1, "x".repeat(501))).field, "text");
      assert.equal((await contribution(PARENT_F1, TASK_1, null)).field, "text");
      assert.equal(
        (await contribution(PARENT_F1, TASK_3, "Másik feladat")).state,
        "denied",
        "no place on that task",
      );
      assert.equal((await contribution(DEACTIVATED, TASK_1, "Inaktív")).code, "session_inactive");
      // A removed place no longer takes a note, and neither does an archived family.
      await db.query("update assignments set status = 'removed' where id = $1", [ASSIGNMENT_F1_T1]);
      assert.equal((await contribution(PARENT_F1, TASK_1, "Eltávolított")).state, "denied");
      await db.query("update assignments set status = 'active' where id = $1", [ASSIGNMENT_F1_T1]);
      await db.query("update families set status = 'archived', archived_at = now() where id = $1", [
        FAMILY_1,
      ]);
      assert.deepEqual([(await contribution(PARENT_F1, TASK_1, "Archivált")).state], ["denied"]);
    });

    it("returns the stored result for a repeated key and does not store refusals (U1 BR3.6)", async () => {
      const key = nextKey("repeat");
      const first = await taskSave(ADMIN_G1, newTask, key);
      const again = await taskSave(ADMIN_G1, newTask, key);
      assert.deepEqual(
        [again.state, again.reference, again.code],
        ["success", first.reference, "replayed"],
      );
      assert.equal(await count(db, "tasks", "title = 'Takarítás'"), 1);
      assert.deepEqual(
        [(await taskSave(ADMIN_G1, { ...newTask, title: "Más" }, key)).code],
        ["idempotency_key_reused"],
      );
      const refusedKey = nextKey("refused");
      assert.equal(
        (await taskSave(ADMIN_G1, { ...newTask, capacity: 0 }, refusedKey)).state,
        "validation",
      );
      assert.equal(
        (await taskSave(ADMIN_G1, { ...newTask, capacity: 4 }, refusedKey)).state,
        "success",
      );
      const eventKey = nextKey("event-repeat");
      const event = await eventSave(ADMIN_G1, newEvent, eventKey);
      assert.equal((await eventSave(ADMIN_G1, newEvent, eventKey)).reference, event.reference);
      assert.equal(await count(db, "events", "title = 'Téli ünnep'"), 1);
      const noteKey = nextKey("note-repeat");
      const note = await contribution(PARENT_F1, TASK_1, "Egyszer", noteKey);
      assert.equal(
        (await contribution(PARENT_F1, TASK_1, "Egyszer", noteKey)).reference,
        note.reference,
      );
    });

    it("is not callable by anon or the service role", async () => {
      for (const role of ["anon", "service_role"] as const) {
        for (const sql of [
          "event_save('k', '{}'::jsonb)",
          "task_save('k', '{}'::jsonb)",
          "event_save_notes('k', null, null, null, null, null)",
          "contribution_save('k', null, null)",
        ]) {
          const failure = await failureOf(() =>
            asActor(db, schema, { role }, () => db.query(`select ${sql}`)),
          );
          assert.equal(failure?.code, "42501", `${role}: ${sql}`);
        }
      }
    });
  });
}
