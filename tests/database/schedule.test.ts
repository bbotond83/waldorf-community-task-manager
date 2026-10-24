import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import {
  ADMIN_G1,
  ADMIN_G2,
  asActor,
  authenticated,
  callFunction,
  CO_PARENT_F1,
  DEACTIVATED,
  DIRECTORY_SCHEMAS,
  EVENT_1,
  FAMILY_1,
  FAMILY_2,
  GROUP_1,
  GROUP_2,
  GROUP_OTHER,
  OTHER_ADMIN,
  openDirectoryDatabase,
  OUTSIDER,
  PARENT_F1,
  PARENT_F2,
  seedCoordinationWorld,
  SIGNED_OUT,
  SUPER_ADMIN,
  TASK_1,
  TASK_2,
  TASK_3,
  TEACHER_G1,
  uuid,
} from "./directory-support.ts";

type Result = Awaited<ReturnType<typeof callFunction>>;
type Entry = {
  id: string;
  group_id: string;
  starts_at: string;
  ends_at: string;
  title: string;
  location: string;
  coordination_display_name: string | null;
  owner_display_name: string | null;
  assignee_display_names: string[];
  current_status_label: string;
};

/**
 * The teacher schedule function: the grant per role, the filter rule, the empty state, the shape of an entry
 * and the privacy of what it returns (BR33.1 to BR33.3, NFR1.26, NFR1.29, NFR1.30).
 */
for (const schema of DIRECTORY_SCHEMAS) {
  describe(`teacher schedule in ${schema}`, () => {
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

    const schedule = (
      account: string,
      group: string,
      from: string | null = null,
      to: string | null = null,
    ): Promise<Result> =>
      callFunction(db, schema, account, "schedule_get($1, $2, $3)", [group, from, to]);
    const entries = (result: Result) => result.items as Entry[];
    /** The UTC calendar day an offset in days from now falls on. */
    const day = async (offset: number) =>
      (
        await db.query(
          "select to_char((now() at time zone 'UTC') + $1::interval, 'YYYY-MM-DD') as d",
          [`${offset} days`],
        )
      ).rows[0].d as string;

    it("returns a granted group's tasks ordered by start with the fields of the model (BR33.3)", async () => {
      const result = await schedule(TEACHER_G1, GROUP_1);
      assert.equal(result.state, "success");
      const list = entries(result);
      assert.deepEqual(
        list.map((entry) => entry.id),
        [TASK_1, TASK_2],
      );
      assert.deepEqual(Object.keys(list[0]!).sort(), [
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
      assert.deepEqual(
        [
          list[0]!.title,
          list[0]!.location,
          list[0]!.coordination_display_name,
          list[0]!.owner_display_name,
          list[0]!.assignee_display_names,
          list[0]!.current_status_label,
          list[0]!.group_id,
        ],
        ["Sütés", "Konyha", "Kovács Mária", "Fenyő család", ["Fenyő család"], "open", GROUP_1],
      );
      assert.deepEqual(
        [
          list[1]!.title,
          list[1]!.coordination_display_name,
          list[1]!.owner_display_name,
          list[1]!.assignee_display_names,
        ],
        ["Kerti munka", null, null, []],
        "a task without an event or a family has no coordination name, owner or assignees",
      );
    });

    it("grants the schedule to teachers, group admins and super admins of the group and to nobody else (BR33.1, NFR1.26)", async () => {
      const expected: [string, string, boolean][] = [
        [TEACHER_G1, GROUP_1, true],
        [TEACHER_G1, GROUP_2, false],
        [ADMIN_G1, GROUP_1, true],
        [ADMIN_G1, GROUP_2, false],
        [ADMIN_G2, GROUP_2, true],
        [ADMIN_G2, GROUP_1, false],
        [SUPER_ADMIN, GROUP_1, true],
        [SUPER_ADMIN, GROUP_2, true],
        [PARENT_F1, GROUP_1, false],
        [CO_PARENT_F1, GROUP_1, false],
        [PARENT_F2, GROUP_2, false],
        [OUTSIDER, GROUP_1, false],
        [OTHER_ADMIN, GROUP_1, false],
        [SUPER_ADMIN, GROUP_OTHER, false],
        [OTHER_ADMIN, GROUP_OTHER, true],
        [SUPER_ADMIN, uuid(99999), false],
      ];
      for (const [account, group, allowed] of expected) {
        const result = await schedule(account, group);
        assert.equal(
          result.state === "success",
          allowed,
          `${account} reading ${group}: ${result.state} ${result.code}`,
        );
        if (!allowed) {
          assert.deepEqual(
            [result.state, result.code, result.items],
            ["denied", "authorization_denied", undefined],
          );
        }
      }
      for (const account of [DEACTIVATED, SIGNED_OUT]) {
        const result = await schedule(account, GROUP_1);
        assert.deepEqual([result.state, result.code], ["denied", "session_inactive"], account);
      }
    });

    it("applies the date filter to the UTC day of the task's start, with one-sided and open limits (BR33.2)", async () => {
      const [d9, d10, d11, d12] = [await day(9), await day(10), await day(11), await day(12)];
      assert.deepEqual(
        entries(await schedule(TEACHER_G1, GROUP_1, d10, d10)).map((entry) => entry.id),
        [TASK_1],
      );
      assert.deepEqual(
        entries(await schedule(TEACHER_G1, GROUP_1, d11, d12)).map((entry) => entry.id),
        [TASK_2],
      );
      assert.deepEqual(
        entries(await schedule(TEACHER_G1, GROUP_1, d9, d12)).map((entry) => entry.id),
        [TASK_1, TASK_2],
      );
      assert.deepEqual(
        entries(await schedule(TEACHER_G1, GROUP_1, d11)).map((entry) => entry.id),
        [TASK_2],
        "a lower limit alone",
      );
      assert.deepEqual(
        entries(await schedule(TEACHER_G1, GROUP_1, null, d10)).map((entry) => entry.id),
        [TASK_1],
        "an upper limit alone",
      );
      assert.deepEqual(
        entries(await schedule(TEACHER_G1, GROUP_1, "", "")).map((entry) => entry.id),
        [TASK_1, TASK_2],
        "no limit",
      );
    });

    it("refuses an invalid filter with VAL-DATE-RANGE and reads nothing (BR33.2)", async () => {
      const day10 = await day(10);
      const bad: [string, string | null, string | null][] = [
        ["31 February", "2031-02-31", "2031-03-02"],
        ["a wrong format", "10.05.2031", day10],
        ["a text", "tomorrow", null],
        ["the start after the end", day10, await day(9)],
        ["more than 31 days", await day(0), await day(32)],
        ["an invalid end", day10, "2031-13-01"],
      ];
      for (const [label, from, to] of bad) {
        const result = await schedule(TEACHER_G1, GROUP_1, from, to);
        assert.deepEqual(
          [result.state, result.code, result.items],
          ["validation", "VAL-DATE-RANGE", undefined],
          label,
        );
      }
      assert.equal(
        (await schedule(TEACHER_G1, GROUP_1, await day(0), await day(31))).state,
        "success",
        "exactly 31 days is allowed",
      );
    });

    it("answers the empty state when nothing falls in the range or the group has no tasks", async () => {
      const far = await day(25);
      const empty = await schedule(TEACHER_G1, GROUP_1, far, far);
      assert.deepEqual([empty.state, empty.items], ["success", []]);
      await db.query("delete from contribution_notes");
      await db.query("delete from change_requests");
      await db.query("delete from assignments where task_id = $1", [TASK_3]);
      await db.query("delete from tasks where group_id = $1", [GROUP_2]);
      assert.deepEqual(entries(await schedule(ADMIN_G2, GROUP_2)), []);
    });

    it("derives the status label: cancelled for a cancelled task or event, full when the places are taken, else open", async () => {
      const labels = async () =>
        Object.fromEntries(
          entries(await schedule(TEACHER_G1, GROUP_1)).map((entry) => [
            entry.id,
            entry.current_status_label,
          ]),
        );
      assert.deepEqual(await labels(), { [TASK_1]: "open", [TASK_2]: "open" });
      await db.query(
        "insert into assignments (organization_id, task_id, family_id, source) values ($1, $2, $3, 'admin_assign')",
        [
          (await db.query("select organization_id from tasks where id = $1", [TASK_2])).rows[0]
            .organization_id,
          TASK_2,
          FAMILY_2,
        ],
      );
      assert.equal((await labels())[TASK_2], "full");
      await db.query("update tasks set status = 'cancelled' where id = $1", [TASK_2]);
      assert.equal((await labels())[TASK_2], "cancelled");
      await db.query("update events set status = 'cancelled' where id = $1", [EVENT_1]);
      assert.equal(
        (await labels())[TASK_1],
        "cancelled",
        "the event is cancelled, the task is not",
      );
    });

    it("names the owner by the earliest assignment and lists assignees in creation order, leaving out removed places", async () => {
      const organization = (
        await db.query("select organization_id from tasks where id = $1", [TASK_1])
      ).rows[0].organization_id;
      await db.query("update tasks set capacity = 4 where id = $1", [TASK_1]);
      await db.query(
        "update assignments set created_at = now() - interval '2 days' where task_id = $1",
        [TASK_1],
      );
      await db.query(
        "insert into assignments (organization_id, task_id, family_id, source, created_at) values ($1, $2, $3, 'admin_assign', now() - interval '3 days')",
        [organization, TASK_1, FAMILY_2],
      );
      const [entry] = entries(await schedule(TEACHER_G1, GROUP_1));
      assert.equal(entry!.owner_display_name, "Napraforgó család");
      assert.deepEqual(entry!.assignee_display_names, ["Napraforgó család", "Fenyő család"]);
      await db.query(
        "update assignments set status = 'removed' where task_id = $1 and family_id = $2",
        [TASK_1, FAMILY_2],
      );
      const [after] = entries(await schedule(TEACHER_G1, GROUP_1));
      assert.deepEqual(
        [after!.owner_display_name, after!.assignee_display_names],
        ["Fenyő család", ["Fenyő család"]],
      );
    });

    it("returns no contact details, notes, profiles or people's ids (NFR1.29, NFR1.30)", async () => {
      const text = JSON.stringify(await schedule(TEACHER_G1, GROUP_1));
      for (const secret of [
        "anna@example.test",
        "bela@example.test",
        "+36 30 111 2222",
        "Pécs",
        "mogyoró",
        "terítők",
        "sütemény",
        "Almás pite",
        "Szívesen főzök",
        "Fenyő Anna",
        "Fenyő Gergő",
        FAMILY_1,
        PARENT_F1,
      ]) {
        assert.equal(text.includes(secret), false, secret);
      }
      const ids = new Set<string>();
      for (const entry of entries(await schedule(TEACHER_G1, GROUP_1))) {
        for (const value of Object.values(entry))
          if (typeof value === "string" && /^[0-9a-f-]{36}$/.test(value)) ids.add(value);
      }
      assert.deepEqual(
        [...ids].sort(),
        [GROUP_1, TASK_1, TASK_2].sort(),
        "only the task's and the group's ids",
      );
    });

    it("lets a teacher read the schedule function only, never the tables behind it", async () => {
      for (const table of [
        "tasks",
        "events",
        "assignments",
        "families",
        "parents",
        "parent_contacts",
        "children",
        "contribution_notes",
        "change_requests",
      ]) {
        const rows = await asActor(
          db,
          schema,
          authenticated(TEACHER_G1),
          async () =>
            (await db.query(`select count(*)::int as n from ${table}`)).rows[0].n as number,
        );
        assert.equal(rows, 0, table);
      }
    });
  });
}
