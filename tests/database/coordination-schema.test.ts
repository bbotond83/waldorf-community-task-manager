import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import {
  ASSIGNMENT_F1_T1,
  ASSIGNMENT_F2_T3,
  asActor,
  authenticated,
  CO_PARENT_F1,
  countAs,
  DIRECTORY_SCHEMAS,
  EVENT_1,
  EVENT_2,
  FAMILY_1,
  FAMILY_2,
  GROUP_1,
  GROUP_2,
  NOTE_1,
  openDirectoryDatabase,
  ORGANIZATION,
  OTHER_ORGANIZATION,
  PARENT_F1,
  PARENT_F2,
  PARENT_ROW_F1,
  REQUEST_1,
  seedCoordinationWorld,
  SUPER_ADMIN,
  TASK_1,
  TASK_2,
  TASK_3,
  VIEWERS,
  type ViewerName,
} from "./directory-support.ts";
import { failureOf } from "./stack-support.ts";

const COORDINATION_TABLES = [
  "events",
  "tasks",
  "assignments",
  "change_requests",
  "contribution_notes",
] as const;

/** Coordination tables: constraints, unique rules, indexes, the role matrix and note visibility (BR31.1, BR31.8, BR31.9, NFR1.26, NFR1.29, NFR1.31, NFR3.6). */
for (const schema of DIRECTORY_SCHEMAS) {
  describe(`coordination schema in ${schema}`, () => {
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

    const code = async (sql: string, values: unknown[] = []) =>
      (await failureOf(() => db.query(sql, values)))?.code;
    const insertTask = (overrides: Record<string, unknown> = {}) => {
      const row = {
        organization_id: ORGANIZATION,
        group_id: GROUP_1,
        title: "Új feladat",
        capacity: 2,
        starts_at: "2030-01-01T10:00:00Z",
        ends_at: "2030-01-01T12:00:00Z",
        ...overrides,
      };
      const columns = Object.keys(row);
      return db.query(
        `insert into tasks (${columns.join(", ")}) values (${columns.map((_, index) => `$${index + 1}`).join(", ")}) returning id, location, status, category`,
        Object.values(row),
      );
    };

    it("limits a task's capacity, times and status, defaults its place and category, and keeps it in its event's group", async () => {
      for (const capacity of [0, 51]) {
        assert.equal(
          await failureOf(() => insertTask({ capacity })).then((e) => e?.code),
          "23514",
          `capacity ${capacity}`,
        );
      }
      assert.equal(
        await failureOf(() => insertTask({ ends_at: "2030-01-01T09:00:00Z" })).then((e) => e?.code),
        "23514",
      );
      assert.equal(
        await failureOf(() => insertTask({ status: "paused" })).then((e) => e?.code),
        "23514",
      );
      assert.equal(await failureOf(() => insertTask({ title: "" })).then((e) => e?.code), "23514");
      // The event of another group cannot be used: the pair (event, group) must exist.
      assert.equal(
        await failureOf(() => insertTask({ event_id: EVENT_2 })).then((e) => e?.code),
        "23503",
      );
      const withEvent = await insertTask({ event_id: EVENT_1 });
      assert.equal(withEvent.rows[0].status, "open");
      const bare = await insertTask();
      assert.deepEqual([bare.rows[0].location, bare.rows[0].category], ["-", "general"]);
    });

    it("limits an event's notes, times and status", async () => {
      const insertEvent = (overrides: Record<string, unknown>) => {
        const row = {
          organization_id: ORGANIZATION,
          group_id: GROUP_1,
          title: "Ünnep",
          starts_at: "2030-01-01T10:00:00Z",
          ends_at: "2030-01-01T12:00:00Z",
          ...overrides,
        };
        const columns = Object.keys(row);
        return db.query(
          `insert into events (${columns.join(", ")}) values (${columns.map((_, index) => `$${index + 1}`).join(", ")})`,
          Object.values(row),
        );
      };
      for (const overrides of [
        { allergen_note: "x".repeat(301) },
        { supply_note: "x".repeat(301) },
        { food_note: "x".repeat(301) },
        { location: "x".repeat(201) },
        { ends_at: "2030-01-01T09:00:00Z" },
        { status: "postponed" },
      ]) {
        assert.equal(
          await failureOf(() => insertEvent(overrides)).then((e) => e?.code),
          "23514",
          JSON.stringify(overrides).slice(0, 40),
        );
      }
      await insertEvent({ allergen_note: "x".repeat(300) });
    });

    it("allows one place per family and task that is not removed, and a new one after a removal (answer Q4)", async () => {
      const place = (family: string, task: string, status = "active") =>
        db.query(
          "insert into assignments (organization_id, task_id, family_id, source, status) values ($1, $2, $3, 'admin_assign', $4)",
          [ORGANIZATION, task, family, status],
        );
      assert.equal(
        await failureOf(() => place(FAMILY_1, TASK_1)).then((e) => e?.code),
        "23505",
        "duplicate",
      );
      assert.equal(
        await failureOf(() => place(FAMILY_1, TASK_1, "swap_pending")).then((e) => e?.code),
        "23505",
      );
      await db.query("update assignments set status = 'removed' where id = $1", [ASSIGNMENT_F1_T1]);
      await place(FAMILY_1, TASK_1);
      assert.equal(
        (
          await db.query(
            "select count(*)::int as n from assignments where family_id = $1 and task_id = $2",
            [FAMILY_1, TASK_1],
          )
        ).rows[0].n,
        2,
        "the removed place stays as history",
      );
      assert.equal(
        await failureOf(() => place(FAMILY_1, TASK_1, "unknown")).then((e) => e?.code),
        "23514",
      );
    });

    it("never lets the taken places exceed the capacity, judged on the final state of a transaction", async () => {
      // TASK_2 has one place. A second family cannot take it.
      const take = (family: string) =>
        db.query(
          "insert into assignments (organization_id, task_id, family_id, source) values ($1, $2, $3, 'admin_assign')",
          [ORGANIZATION, TASK_2, family],
        );
      await take(FAMILY_1);
      const over = await failureOf(() => take(FAMILY_2));
      assert.equal(over?.code, "23514");
      assert.match(over?.message ?? "", /over capacity/);
      // A removed place frees the capacity.
      await db.query("update assignments set status = 'removed' where task_id = $1", [TASK_2]);
      await take(FAMILY_2);
      // Two full tasks may exchange their places inside one transaction: only the end state counts.
      await db.query("update tasks set capacity = 1 where id = $1", [TASK_3]);
      await db.query("update assignments set status = 'active' where id = $1", [ASSIGNMENT_F1_T1]);
      await db.query("update tasks set capacity = 1 where id = $1", [TASK_1]);
      await db.query("begin");
      try {
        await db.query("update assignments set task_id = $1 where id = $2", [
          TASK_3,
          ASSIGNMENT_F1_T1,
        ]);
        await db.query("update assignments set task_id = $1 where id = $2", [
          TASK_1,
          ASSIGNMENT_F2_T3,
        ]);
        await db.query("commit");
      } catch (error) {
        await db.query("rollback");
        throw error;
      }
      assert.deepEqual(
        (
          await db.query("select task_id from assignments where id in ($1, $2) order by id", [
            ASSIGNMENT_F1_T1,
            ASSIGNMENT_F2_T3,
          ])
        ).rows.map((row) => row.task_id),
        [TASK_3, TASK_1],
      );
      // Moving a place onto a task that is full for good is still refused.
      assert.equal(
        await failureOf(() =>
          db.query("update assignments set task_id = $1 where id = $2", [TASK_3, ASSIGNMENT_F2_T3]),
        ).then((e) => e?.code),
        "23514",
      );
    });

    it("allows one open change request per assignment and keeps swap and cancellation fields consistent", async () => {
      const request = (overrides: Record<string, unknown> = {}) => {
        const row = {
          organization_id: ORGANIZATION,
          assignment_id: ASSIGNMENT_F1_T1,
          kind: "cancellation",
          requested_by_parent_id: PARENT_ROW_F1,
          source_task_id: TASK_1,
          source_assignment_version: 1,
          ...overrides,
        };
        const columns = Object.keys(row);
        return db.query(
          `insert into change_requests (${columns.join(", ")}) values (${columns.map((_, index) => `$${index + 1}`).join(", ")})`,
          Object.values(row),
        );
      };
      assert.equal(
        await failureOf(() => request()).then((e) => e?.code),
        "23505",
        "a second open request",
      );
      assert.equal(
        await failureOf(() => request({ kind: "swap" })).then((e) => e?.code),
        "23514",
        "a swap needs its target",
      );
      assert.equal(
        await failureOf(() =>
          request({ assignment_id: ASSIGNMENT_F2_T3, target_assignment_id: ASSIGNMENT_F1_T1 }),
        ).then((e) => e?.code),
        "23514",
        "a cancellation has no target",
      );
      await db.query("update change_requests set status = 'withdrawn' where id = $1", [REQUEST_1]);
      await request();
      await request({
        assignment_id: ASSIGNMENT_F2_T3,
        kind: "swap",
        target_assignment_id: ASSIGNMENT_F1_T1,
        target_task_id: TASK_1,
        target_assignment_version: 1,
        source_task_id: TASK_3,
      });
      assert.equal(
        await failureOf(() =>
          db.query(
            "update change_requests set status = 'approved' where assignment_id = $1 and status = 'open'",
            [ASSIGNMENT_F1_T1],
          ),
        ).then((e) => e?.code),
        "23514",
        "a decision names who decided and when",
      );
      assert.equal(
        await failureOf(() => request({ reason: "x".repeat(501), status: "applied" })).then(
          (e) => e?.code,
        ),
        "23514",
      );
    });

    it("keeps one contribution note per assignment, at most 500 characters", async () => {
      assert.equal(
        await code(
          "insert into contribution_notes (organization_id, assignment_id, text) values ($1, $2, 'második')",
          [ORGANIZATION, ASSIGNMENT_F1_T1],
        ),
        "23505",
      );
      assert.equal(
        await code("update contribution_notes set text = $2 where id = $1", [
          NOTE_1,
          "x".repeat(501),
        ]),
        "23514",
      );
      await db.query("update contribution_notes set text = '' where id = $1", [NOTE_1]);
    });

    it("has the indexes the policies and functions need (NFR3.6)", async () => {
      const indexes = (
        await db.query(
          "select tablename, indexdef from pg_indexes where schemaname = current_schema() and tablename = any($1)",
          [[...COORDINATION_TABLES]],
        )
      ).rows as { tablename: string; indexdef: string }[];
      const has = (table: string, fragment: string) =>
        indexes.some((row) => row.tablename === table && row.indexdef.includes(fragment));
      assert.ok(has("assignments", "(task_id, status)"), "assignments by task");
      assert.ok(has("assignments", "(family_id, status)"), "assignments by family and status");
      assert.ok(has("assignments", "(family_id, task_id)"), "one place per family and task");
      assert.ok(has("tasks", "(group_id, starts_at)"), "tasks by group and start");
      assert.ok(has("events", "(group_id, starts_at)"), "events by group and time");
      assert.ok(
        has("change_requests", "(assignment_id, status)"),
        "requests by assignment and status",
      );
      assert.ok(has("change_requests", "(assignment_id)"), "one open request");
    });

    it("raises the version on every accepted update of tasks, assignments and events", async () => {
      for (const [table, id] of [
        ["tasks", TASK_1],
        ["assignments", ASSIGNMENT_F1_T1],
        ["events", EVENT_1],
        ["change_requests", REQUEST_1],
        ["contribution_notes", NOTE_1],
      ] as const) {
        const read = async () =>
          (await db.query(`select version from ${table} where id = $1`, [id])).rows[0]
            .version as number;
        const before = await read();
        await db.query(`update ${table} set organization_id = organization_id where id = $1`, [id]);
        assert.equal(await read(), before + 1, table);
      }
    });

    const MATRIX: Record<string, Partial<Record<ViewerName, number>>> = {
      events: {
        parent: 0,
        coParent: 0,
        parentOther: 0,
        teacher: 0,
        adminSame: 1,
        adminOther: 1,
        super: 2,
        nogrant: 0,
        deactivated: 0,
        signedOut: 0,
        otherOrganizationAdmin: 1,
      },
      tasks: {
        parent: 0,
        coParent: 0,
        parentOther: 0,
        teacher: 0,
        adminSame: 2,
        adminOther: 1,
        super: 3,
        nogrant: 0,
        deactivated: 0,
        signedOut: 0,
        otherOrganizationAdmin: 1,
      },
      assignments: {
        parent: 1,
        coParent: 1,
        parentOther: 1,
        teacher: 0,
        adminSame: 1,
        adminOther: 1,
        super: 2,
        nogrant: 0,
        deactivated: 0,
        signedOut: 0,
        otherOrganizationAdmin: 1,
      },
      change_requests: {
        parent: 1,
        coParent: 1,
        parentOther: 0,
        teacher: 0,
        adminSame: 1,
        adminOther: 0,
        super: 1,
        nogrant: 0,
        deactivated: 0,
        signedOut: 0,
        otherOrganizationAdmin: 0,
      },
      contribution_notes: {
        parent: 1,
        coParent: 1,
        parentOther: 1,
        teacher: 0,
        adminSame: 1,
        adminOther: 1,
        super: 2,
        nogrant: 0,
        deactivated: 0,
        signedOut: 0,
        otherOrganizationAdmin: 0,
      },
    };

    it("shows each role exactly its rows of every Coordination table, the co-parent and every other role included (NFR1.26)", async () => {
      for (const [table, expected] of Object.entries(MATRIX)) {
        for (const [viewer, rows] of Object.entries(expected) as [ViewerName, number][]) {
          assert.equal(
            await countAs(db, schema, VIEWERS[viewer], table),
            rows,
            `${table} as ${viewer}`,
          );
        }
      }
    });

    it("keeps the allergen, supply and food notes of an event from every parent, teacher and admin out of reach (BR31.9, NFR1.29)", async () => {
      const notesAs = (account: string) =>
        asActor(
          db,
          schema,
          authenticated(account),
          async () =>
            (
              await db.query(
                "select id, allergen_note, supply_note, food_note from events order by id",
              )
            ).rows as {
              id: string;
              allergen_note: string | null;
            }[],
        );
      // Parents and teachers read no event rows at all: the use-case functions of the next steps return
      // the allergen note to the assigned family only.
      for (const account of [
        PARENT_F1,
        CO_PARENT_F1,
        PARENT_F2,
        VIEWERS.teacher,
        VIEWERS.nogrant,
      ]) {
        assert.deepEqual(await notesAs(account), [], account);
      }
      // Admins read the notes of the events of their groups only.
      assert.deepEqual(
        (await notesAs(VIEWERS.adminSame)).map((row) => [row.id, row.allergen_note]),
        [[EVENT_1, "mogyoró"]],
      );
      assert.deepEqual(
        (await notesAs(VIEWERS.adminOther)).map((row) => row.id),
        [EVENT_2],
      );
    });

    it("shows a contribution note to the assigned family, its co-parent and admins in reach, never to other families or teachers (BR31.8)", async () => {
      const notesAs = (account: string) =>
        asActor(db, schema, authenticated(account), async () =>
          (await db.query("select text from contribution_notes order by text")).rows.map(
            (row) => row.text as string,
          ),
        );
      assert.deepEqual(await notesAs(PARENT_F1), ["Almás pite"]);
      assert.deepEqual(await notesAs(CO_PARENT_F1), ["Almás pite"]);
      assert.deepEqual(await notesAs(PARENT_F2), ["Girland"]);
      assert.deepEqual(await notesAs(VIEWERS.teacher), []);
      assert.deepEqual(await notesAs(VIEWERS.adminSame), ["Almás pite"]);
      assert.deepEqual(await notesAs(VIEWERS.adminOther), ["Girland"]);
      assert.deepEqual(await notesAs(SUPER_ADMIN), ["Almás pite", "Girland"]);
      // An archived family's parents lose the note and the place with the family.
      await db.query("update families set status = 'archived', archived_at = now() where id = $1", [
        FAMILY_1,
      ]);
      assert.deepEqual(await notesAs(PARENT_F1), []);
      assert.equal(await countAs(db, schema, PARENT_F1, "assignments"), 0);
      assert.equal(
        await countAs(db, schema, VIEWERS.adminSame, "assignments"),
        1,
        "the admin in reach still sees the history",
      );
    });

    it("isolates organizations: an admin of the other organization reads nothing of the first and the other way round", async () => {
      for (const table of COORDINATION_TABLES) {
        assert.equal(
          await countAs(
            db,
            schema,
            VIEWERS.otherOrganizationAdmin,
            table,
            `organization_id = '${ORGANIZATION}'`,
          ),
          0,
          `${table}: other organization's admin`,
        );
        assert.equal(
          await countAs(
            db,
            schema,
            SUPER_ADMIN,
            table,
            `organization_id = '${OTHER_ORGANIZATION}'`,
          ),
          0,
          `${table}: first organization's super admin`,
        );
      }
    });

    it("reaches an assignment through its task's group, and no other way, for admins", async () => {
      const reached = (account: string, assignment: string) =>
        asActor(
          db,
          schema,
          authenticated(account),
          async () =>
            (
              await db.query(
                "select coordination_assignment_reached($1, $2) as r, coordination_task_reached($1, $3) as t",
                [ORGANIZATION, assignment, TASK_1],
              )
            ).rows[0] as { r: boolean; t: boolean },
        );
      assert.deepEqual(await reached(VIEWERS.adminSame, ASSIGNMENT_F1_T1), { r: true, t: true });
      assert.deepEqual(await reached(VIEWERS.adminOther, ASSIGNMENT_F1_T1), { r: false, t: false });
      assert.deepEqual(await reached(VIEWERS.teacher, ASSIGNMENT_F1_T1), { r: false, t: false });
      assert.deepEqual(await reached(PARENT_F1, ASSIGNMENT_F1_T1), { r: false, t: false });
      // The task's group is what counts: moving the task to the other group moves the reach.
      await db.query("update tasks set group_id = $1, event_id = null where id = $2", [
        GROUP_2,
        TASK_1,
      ]);
      assert.deepEqual(await reached(VIEWERS.adminSame, ASSIGNMENT_F1_T1), { r: false, t: false });
      assert.deepEqual(await reached(VIEWERS.adminOther, ASSIGNMENT_F1_T1), { r: true, t: true });
    });

    it("gives no application role a right to write any Coordination table and the service role no right at all", async () => {
      for (const table of COORDINATION_TABLES) {
        const column = "organization_id";
        const statements = [
          `insert into ${table} default values`,
          `update ${table} set ${column} = ${column}`,
          `delete from ${table}`,
        ];
        for (const sql of statements) {
          for (const actor of [
            authenticated(SUPER_ADMIN),
            { role: "anon" as const },
            { role: "service_role" as const },
          ]) {
            const failure = await failureOf(() => asActor(db, schema, actor, () => db.query(sql)));
            assert.equal(failure?.code, "42501", `${actor.role} on ${table}: ${sql}`);
          }
        }
        for (const actor of [{ role: "anon" as const }, { role: "service_role" as const }]) {
          const failure = await failureOf(() =>
            asActor(db, schema, actor, () => db.query(`select 1 from ${table}`)),
          );
          assert.equal(failure?.code, "42501", `${actor.role} reads ${table}`);
        }
      }
      const privileges = (
        await db.query(
          `select table_name from information_schema.role_table_grants
            where table_schema = current_schema() and table_name = any($1) and grantee = 'service_role'`,
          [[...COORDINATION_TABLES]],
        )
      ).rows;
      assert.deepEqual(privileges, []);
    });
  });
}
