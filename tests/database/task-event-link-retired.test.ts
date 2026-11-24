import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import {
  ADMIN_G1,
  EVENT_1,
  EVENT_2,
  DIRECTORY_SCHEMAS,
  nextKey,
  openDirectoryDatabase,
  seedCoordinationWorld,
  TASK_1,
  TASK_2,
} from "./directory-support.ts";
import { caller } from "./working-groups-support.ts";
import { openDatabase } from "./stack-support.ts";
import { SUPER_ADMIN } from "./working-groups-support.ts";

/**
 * U11 retires the event link of a duty (BR169.1, Q1): no save creates one. Today's task screen sends the task's own
 * event back on every edit, and a save may remove the link, so those two stay allowed. The rest of task_save is
 * covered by community-duties.test.ts and coordination-functions.test.ts.
 */
for (const schema of DIRECTORY_SCHEMAS) {
  describe(`duty event link retired in ${schema}`, () => {
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

    const call = caller(() => db, schema);
    const callSecond = caller(() => second, schema);
    const bodyOf = (extra: Record<string, unknown>) => ({
      group_id: undefined,
      title: "Feladat",
      capacity: 2,
      starts_at: "2031-05-01T08:00:00Z",
      ends_at: "2031-05-01T10:00:00Z",
      ...extra,
    });
    const save = (
      account: string,
      body: Record<string, unknown>,
      key = nextKey("task"),
      run = call,
    ) => run(account, "task_save($1, $2::jsonb)", [key, JSON.stringify(body)]);
    const linkOf = async (id: string) =>
      (await db.query("select event_id from tasks where id = $1", [id])).rows[0].event_id as
        string | null;
    const group = async (id: string) =>
      (await db.query("select group_id from tasks where id = $1", [id])).rows[0].group_id as
        string | null;

    it("allowed: a task with no event is created and changed exactly as before", async () => {
      const created = await save(SUPER_ADMIN, bodyOf({}));
      assert.equal(created.state, "success");
      const changed = await save(
        SUPER_ADMIN,
        bodyOf({ id: created.reference, expected_version: 1, title: "Más" }),
      );
      assert.equal(changed.state, "success");
    });
    it("allowed: saving a task that is already linked with its own event keeps the link, and leaving the field out keeps it", async () => {
      const groupId = await group(TASK_1);
      const kept = await save(
        ADMIN_G1,
        bodyOf({
          id: TASK_1,
          expected_version: 1,
          group_id: groupId,
          event_id: EVENT_1,
          title: "Sütés 2",
        }),
      );
      assert.equal(kept.state, "success");
      assert.equal(await linkOf(TASK_1), EVENT_1);
      const silent = await save(
        ADMIN_G1,
        bodyOf({ id: TASK_1, expected_version: 2, group_id: groupId, title: "Sütés 3" }),
      );
      assert.equal(silent.state, "success");
      assert.equal(await linkOf(TASK_1), EVENT_1);
    });
    it("allowed: the link can be removed", async () => {
      const groupId = await group(TASK_1);
      const removed = await save(
        ADMIN_G1,
        bodyOf({ id: TASK_1, expected_version: 1, group_id: groupId, event_id: null }),
      );
      assert.equal(removed.state, "success");
      assert.equal(await linkOf(TASK_1), null);
    });
    it("refused: a new task, an unlinked task and a task moved to another event cannot get a link; nothing is written", async () => {
      const refused = (result: Record<string, unknown>) => [
        result.state,
        result.field,
        result.reason,
      ];
      const groupId = await group(TASK_1);
      assert.deepEqual(
        refused(await save(SUPER_ADMIN, bodyOf({ group_id: groupId, event_id: EVENT_1 }))),
        ["validation", "event_id", "retired"],
      );
      assert.deepEqual(
        refused(
          await save(
            SUPER_ADMIN,
            bodyOf({
              id: TASK_2,
              expected_version: 1,
              group_id: await group(TASK_2),
              event_id: EVENT_2,
            }),
          ),
        ),
        ["validation", "event_id", "retired"],
      );
      assert.deepEqual(
        refused(
          await save(
            ADMIN_G1,
            bodyOf({ id: TASK_1, expected_version: 1, group_id: groupId, event_id: EVENT_2 }),
          ),
        ),
        ["validation", "event_id", "retired"],
      );
      assert.equal(await linkOf(TASK_2), null);
      assert.equal(await linkOf(TASK_1), EVENT_1);
      assert.equal(
        (await db.query("select count(*)::int as n from tasks where title = 'Feladat'")).rows[0].n,
        0,
      );
    });
    it("outdated screen and repeated click: an old version still conflicts; the same key replays; the retirement does not hide either", async () => {
      const groupId = await group(TASK_1);
      const key = nextKey("same");
      const first = await save(
        ADMIN_G1,
        bodyOf({ id: TASK_1, expected_version: 1, group_id: groupId, event_id: EVENT_1 }),
        key,
      );
      const again = await save(
        ADMIN_G1,
        bodyOf({ id: TASK_1, expected_version: 1, group_id: groupId, event_id: EVENT_1 }),
        key,
      );
      assert.deepEqual(
        [again.state, again.code, again.reference],
        ["success", "replayed", first.reference],
      );
      const stale = await save(
        ADMIN_G1,
        bodyOf({ id: TASK_1, expected_version: 1, group_id: groupId, event_id: EVENT_1 }),
      );
      assert.deepEqual([stale.state, stale.code], ["conflict", "VERSION_CONFLICT"]);
    });
    it("two people at once: two saves at one version leave one winner and the link intact", async () => {
      const groupId = await group(TASK_1);
      const body = bodyOf({
        id: TASK_1,
        expected_version: 1,
        group_id: groupId,
        event_id: EVENT_1,
      });
      const answers = await Promise.all([
        save(ADMIN_G1, body),
        save(ADMIN_G1, body, nextKey("b"), callSecond),
      ]);
      assert.deepEqual(answers.map((answer) => answer.state).sort(), ["conflict", "success"]);
      assert.equal(await linkOf(TASK_1), EVENT_1);
    });
  });
}
