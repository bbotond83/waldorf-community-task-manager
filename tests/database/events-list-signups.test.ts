import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import {
  DIRECTORY_SCHEMAS,
  EVENT_1,
  nextKey,
  openDirectoryDatabase,
  OUTSIDER,
  SIGNED_OUT,
  TEACHER_G1,
} from "./directory-support.ts";
import {
  caller,
  COMMUNITY_EVENT,
  GROUP_EVENT,
  PAST_EVENT,
  seedEventWorld,
} from "./events-support.ts";
import { GROUP_1, PARENT_F1, PARENT_F2, SUPER_ADMIN } from "./working-groups-support.ts";

/**
 * The sign-up count and the "signed up" flag of the two event lists (BR104.2, BR108.3) on the fixed list. Both lists
 * are reads, so there is no stale screen, no repeated click and no race to lose; the reach itself is the one tested in
 * events-core.test.ts and is checked here only to show it did not change.
 */
type Result = Awaited<ReturnType<ReturnType<typeof caller>>>;
type Item = { id: string; signup_count: number; is_signed_up: boolean } & Record<string, unknown>;
type Listed = Result & { items: Item[]; caller: Record<string, unknown> };

const ITEM_FIELDS = [
  "ends_at",
  "group_id",
  "group_name",
  "id",
  "is_finished",
  "is_signed_up",
  "location",
  "signup_count",
  "starts_at",
  "status",
  "title",
];

for (const schema of DIRECTORY_SCHEMAS) {
  describe(`event list sign-up counts in ${schema}`, () => {
    let db: pg.Client;
    before(async () => {
      db = await openDirectoryDatabase(schema);
    });
    after(async () => {
      await db.end();
    });
    beforeEach(() => seedEventWorld(db, schema));

    const call = caller(() => db, schema);
    const signUp = (account: string, event: string, key = nextKey("ls")) =>
      call(account, "event_signup_add($1, $2, $3, $4)", [key, event, "Hozok sütit", null]);
    const withdraw = (account: string, id: string, version: number) =>
      call(account, "event_signup_withdraw($1, $2, $3)", [nextKey("lw"), id, version]);
    const all = async (account: string, past = false) =>
      (await call(account, "event_list($1)", [past])) as Listed;
    const forGroup = async (account: string, past = false) =>
      (await call(account, "event_list_for_group($1, $2)", [GROUP_1, past])) as Listed;
    const find = (listed: Listed, id: string) => listed.items.find((item) => item.id === id)!;

    it("allowed: the count is the number of sign-ups of each event and the flag is true only for the caller's own", async () => {
      await signUp(PARENT_F1, COMMUNITY_EVENT);
      await signUp(PARENT_F1, COMMUNITY_EVENT);
      await signUp(PARENT_F2, COMMUNITY_EVENT);
      await signUp(PARENT_F2, GROUP_EVENT);
      const first = await all(PARENT_F1);
      assert.deepEqual(
        [find(first, COMMUNITY_EVENT).signup_count, find(first, COMMUNITY_EVENT).is_signed_up],
        [3, true],
      );
      assert.deepEqual(
        [find(first, GROUP_EVENT).signup_count, find(first, GROUP_EVENT).is_signed_up],
        [1, false],
      );
      assert.deepEqual(
        [find(first, EVENT_1).signup_count, find(first, EVENT_1).is_signed_up],
        [0, false],
      );
      const group = await forGroup(PARENT_F2);
      assert.deepEqual(
        [find(group, GROUP_EVENT).signup_count, find(group, GROUP_EVENT).is_signed_up],
        [1, true],
      );
      assert.equal(find(await forGroup(PARENT_F1), GROUP_EVENT).is_signed_up, false);
    });

    it("a withdrawn sign-up is not counted and clears the flag", async () => {
      const added = await signUp(PARENT_F1, COMMUNITY_EVENT);
      await signUp(PARENT_F2, COMMUNITY_EVENT);
      assert.equal((await withdraw(PARENT_F1, added.reference!, 1)).state, "success");
      const listed = await all(PARENT_F1);
      assert.deepEqual(
        [find(listed, COMMUNITY_EVENT).signup_count, find(listed, COMMUNITY_EVENT).is_signed_up],
        [1, false],
      );
    });

    it("a caller with no parent record gets the count and a false flag, and the past list carries both fields too", async () => {
      await signUp(PARENT_F1, COMMUNITY_EVENT);
      const teacher = await all(TEACHER_G1);
      assert.equal(teacher.state, "success");
      assert.deepEqual(
        [find(teacher, COMMUNITY_EVENT).signup_count, find(teacher, COMMUNITY_EVENT).is_signed_up],
        [1, false],
      );
      const past = await all(PARENT_F1, true);
      assert.deepEqual(
        [find(past, PAST_EVENT).signup_count, find(past, PAST_EVENT).is_signed_up],
        [0, false],
      );
      assert.equal((await all(SUPER_ADMIN)).state, "success");
    });

    it("no extra data: each item has exactly the listed fields and the caller block is unchanged", async () => {
      await signUp(PARENT_F1, COMMUNITY_EVENT);
      const listed = await all(PARENT_F1);
      for (const item of listed.items) assert.deepEqual(Object.keys(item).sort(), ITEM_FIELDS);
      assert.deepEqual(Object.keys(listed.caller).sort(), [
        "can_manage_community",
        "managed_group_ids",
      ]);
      const group = await forGroup(PARENT_F1);
      for (const item of group.items) assert.deepEqual(Object.keys(item).sort(), ITEM_FIELDS);
      assert.deepEqual(Object.keys(group.caller), ["can_manage"]);
    });

    it("reach unchanged: the group list holds the group's events only, and no session or another community is refused", async () => {
      assert.deepEqual(
        (await forGroup(PARENT_F1)).items.map((item) => item.id).sort(),
        [EVENT_1, GROUP_EVENT].sort(),
      );
      for (const account of [SIGNED_OUT, OUTSIDER]) {
        assert.equal((await all(account)).state, "denied");
        assert.equal((await forGroup(account)).state, "denied");
      }
    });
  });
}
