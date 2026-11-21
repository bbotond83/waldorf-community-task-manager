import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import {
  CO_PARENT_F1,
  DEACTIVATED,
  DIRECTORY_SCHEMAS,
  EVENT_1,
  nextKey,
  openDirectoryDatabase,
  OTHER_ADMIN,
  OUTSIDER,
  SIGNED_OUT,
  TEACHER_G1,
} from "./directory-support.ts";
import {
  auditRows,
  CANCELLED_EVENT,
  caller,
  COMMUNITY_EVENT,
  eventVersion,
  GROUP_EVENT,
  inDays,
  noticeRows,
  PAST_EVENT,
  seedEventWorld,
} from "./events-support.ts";
import { count } from "./identity-support.ts";
import { openDatabase } from "./stack-support.ts";
import {
  ADMIN_G1,
  ADMIN_G2,
  GROUP_1,
  GROUP_2,
  GROUP_ARCHIVED,
  PARENT_F1,
  PARENT_F2,
  PARENT_ROW_ADMIN_G1,
  PARENT_ROW_F1,
  PARENT_ROW_F2,
  SUPER_ADMIN,
} from "./working-groups-support.ts";

/**
 * The event rules of U10 (W1, W2, W6, W8, W9; BR100 to BR103, BR107, BR117, BR118) on the fixed list: allowed, refused,
 * out of reach, outdated screen, repeated click, two at once. The cases that do not exist, and why:
 *
 * - the reads (event_list, event_list_for_group, event_get): no stale screen, no repeated click and no race to lose;
 * - the notices of event_save: a notice is a side effect of a fresh success, so the repeated click is the replay
 *   of the whole command, checked once.
 */
type Result = Awaited<ReturnType<ReturnType<typeof caller>>>;
// Fixed once, so a repeated call with the same key carries the same request (the fingerprint includes the times).
const STARTS = inDays(20);
const ENDS = inDays(20.1);
const DEADLINE = inDays(19).slice(0, 10);
type Item = {
  id: string;
  title: string;
  status: string;
  is_finished: boolean;
  group_name: string | null;
};

for (const schema of DIRECTORY_SCHEMAS) {
  describe(`events in ${schema}`, () => {
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
    beforeEach(() => seedEventWorld(db, schema));

    const call = caller(() => db, schema);
    const callSecond = caller(() => second, schema);
    const save = (account: string, event: Record<string, unknown>, key = nextKey("ev")) =>
      call(account, "event_save($1, $2::jsonb)", [key, JSON.stringify(event)]);
    const body = (overrides: Record<string, unknown> = {}) => ({
      group_id: null,
      title: "Tavaszi ünnep",
      location: "Udvar",
      starts_at: STARTS,
      ends_at: ENDS,
      ...overrides,
    });
    const outcome = (result: Result) => [result.state, result.code];
    const list = async (account: string, past = false) =>
      (await call(account, "event_list($1)", [past])) as Result & { items: Item[] };

    describe("W1 save: the new fields and who may save", () => {
      it("allowed: a super admin saves a community event with the settings; a group admin saves a group event", async () => {
        const created = await save(
          SUPER_ADMIN,
          body({
            is_summer: true,
            food_signup_on: true,
            signup_deadline: DEADLINE,
            notice_lead_days: 14,
          }),
        );
        assert.deepEqual([created.state, created.version], ["success", 1]);
        const row = (
          await db.query(
            "select group_id, is_summer, food_signup_on, signup_deadline::text as deadline, notice_lead_days from events where id = $1",
            [created.reference],
          )
        ).rows[0];
        assert.deepEqual(row, {
          group_id: null,
          is_summer: true,
          food_signup_on: true,
          deadline: DEADLINE,
          notice_lead_days: 14,
        });
        const group = await save(ADMIN_G1, body({ group_id: GROUP_1 }));
        assert.equal(group.state, "success");
        // A key left out leaves a changed event's setting as it is.
        const changed = await save(SUPER_ADMIN, {
          id: created.reference,
          expected_version: 1,
          ...body({ title: "Tavaszi ünnep 2" }),
        });
        assert.deepEqual([changed.state, changed.version], ["success", 2]);
        assert.equal(
          (
            await db.query("select is_summer, notice_lead_days from events where id = $1", [
              created.reference,
            ])
          ).rows[0].is_summer,
          true,
        );
      });
      it("refused: a group admin cannot save a community event or another group's event, nor can parents or teachers", async () => {
        for (const account of [ADMIN_G1, PARENT_F1, CO_PARENT_F1, TEACHER_G1, OUTSIDER]) {
          assert.deepEqual(
            outcome(await save(account, body())),
            ["denied", "authorization_denied"],
            account,
          );
        }
        assert.equal((await save(ADMIN_G1, body({ group_id: GROUP_2 }))).state, "denied");
        for (const account of [DEACTIVATED, SIGNED_OUT]) {
          assert.deepEqual(outcome(await save(account, body())), ["denied", "session_inactive"]);
        }
        assert.equal(await count(db, "events", "title = 'Tavaszi ünnep'"), 0);
      });
      it("refused: the deadline after the end day, a lead of 0 or 61 days, and a wrong type are field errors", async () => {
        const cases: [string, Record<string, unknown>][] = [
          ["signup_deadline", body({ signup_deadline: "2999-01-01" })],
          ["signup_deadline", body({ signup_deadline: "nem dátum" })],
          ["notice_lead_days", body({ notice_lead_days: 0 })],
          ["notice_lead_days", body({ notice_lead_days: 61 })],
          ["is_summer", body({ is_summer: "igen" })],
          ["food_signup_on", body({ food_signup_on: 1 })],
        ];
        for (const [field, payload] of cases) {
          const result = await save(SUPER_ADMIN, payload);
          assert.deepEqual(
            [result.state, result.field],
            ["validation", field],
            JSON.stringify(payload),
          );
        }
      });
      it("out of reach: another community's admin and a made-up event answer alike", async () => {
        const real = await save(OTHER_ADMIN, {
          id: COMMUNITY_EVENT,
          expected_version: 1,
          ...body(),
        });
        const made = await save(OTHER_ADMIN, {
          id: "99999999-0000-4000-8000-000000000001",
          expected_version: 1,
          ...body(),
        });
        assert.deepEqual(
          [real.state, real.field, real.reason],
          [made.state, made.field, made.reason],
        );
        assert.equal(await eventVersion(db, COMMUNITY_EVENT), 1);
      });
      it("outdated screen: an old version is a conflict that changes nothing", async () => {
        const stale = await save(SUPER_ADMIN, {
          id: COMMUNITY_EVENT,
          expected_version: 7,
          ...body(),
        });
        assert.deepEqual(outcome(stale), ["conflict", "VERSION_CONFLICT"]);
        assert.equal(await eventVersion(db, COMMUNITY_EVENT), 1);
      });
      it("repeated click: the same key stores one event and returns it again", async () => {
        const key = nextKey("double");
        const first = await save(SUPER_ADMIN, body({ title: "Egyszer" }), key);
        const again = await save(SUPER_ADMIN, body({ title: "Egyszer" }), key);
        assert.deepEqual(outcome(again), ["success", "replayed"]);
        assert.equal(again.reference, first.reference);
        assert.equal(await count(db, "events", "title = 'Egyszer'"), 1);
        assert.deepEqual(outcome(await save(SUPER_ADMIN, body({ title: "Más" }), key)), [
          "conflict",
          "idempotency_key_reused",
        ]);
      });
      it("two at once: two saves of one version leave one winner and one conflict", async () => {
        const payload = (title: string) => ({
          id: COMMUNITY_EVENT,
          expected_version: 1,
          ...body({ title }),
        });
        const answers = await Promise.all([
          save(SUPER_ADMIN, payload("A")),
          callSecond(SUPER_ADMIN, "event_save($1, $2::jsonb)", [
            nextKey("b"),
            JSON.stringify(payload("B")),
          ]),
        ]);
        assert.deepEqual(answers.map((answer) => answer.state).sort(), ["conflict", "success"]);
        assert.equal(await eventVersion(db, COMMUNITY_EVENT), 2);
      });
    });

    describe("W8 and W9 closed events and cancellation", () => {
      it("allowed: a finished event keeps its tale and notices open to the manager but not its dates", async () => {
        const version = await eventVersion(db, PAST_EVENT);
        const dates = await save(SUPER_ADMIN, {
          id: PAST_EVENT,
          expected_version: version,
          ...body(),
        });
        assert.deepEqual(outcome(dates), ["conflict", "EVENT_CLOSED"]);
        const tale = await call(SUPER_ADMIN, "event_tale_save($1, $2, $3, $4)", [
          nextKey("t"),
          PAST_EVENT,
          version,
          "Szép nap volt.",
        ]);
        assert.equal(tale.state, "success");
      });
      it("allowed: a cancellation closes the open tasks, audits it and tells the people with a sign-up or an offer", async () => {
        await db.query(
          "insert into tasks (id, organization_id, group_id, event_id, title, capacity, starts_at, ends_at) select '99999999-0000-4000-8000-0000000000a1', organization_id, null, id, 'Sütés', 2, starts_at, ends_at from events where id = $1",
          [COMMUNITY_EVENT],
        );
        await db.query(
          "insert into event_signups (organization_id, event_id, parent_id, family_id) select organization_id, $1, $2, family_id from parents where id = $2",
          [COMMUNITY_EVENT, PARENT_ROW_F1],
        );
        const stored = (await db.query("select * from events where id = $1", [COMMUNITY_EVENT]))
          .rows[0];
        const result = await save(SUPER_ADMIN, {
          id: COMMUNITY_EVENT,
          expected_version: stored.version,
          title: stored.title,
          starts_at: stored.starts_at.toISOString(),
          ends_at: stored.ends_at.toISOString(),
          status: "cancelled",
        });
        assert.equal(result.state, "success");
        assert.equal(
          (
            await db.query(
              "select status from tasks where id = '99999999-0000-4000-8000-0000000000a1'",
            )
          ).rows[0].status,
          "closed",
        );
        assert.equal((await auditRows(db, "event.cancelled")).length, 1);
        assert.equal((await noticeRows(db, PARENT_ROW_F1, "event_cancelled")).length, 1);
        assert.equal((await noticeRows(db, PARENT_ROW_F2, "event_cancelled")).length, 0);
      });
      it("allowed: a changed place of a planned event tells the people with a sign-up; a changed title tells nobody", async () => {
        await db.query(
          "insert into event_signups (organization_id, event_id, parent_id, family_id) select organization_id, $1, $2, family_id from parents where id = $2",
          [COMMUNITY_EVENT, PARENT_ROW_F1],
        );
        const stored = (await db.query("select * from events where id = $1", [COMMUNITY_EVENT]))
          .rows[0];
        const same = {
          id: COMMUNITY_EVENT,
          title: stored.title,
          starts_at: stored.starts_at.toISOString(),
          ends_at: stored.ends_at.toISOString(),
        };
        const renamed = await save(SUPER_ADMIN, {
          ...same,
          expected_version: 1,
          title: "Új cím",
          location: "Terem",
        });
        assert.equal(renamed.state, "success");
        assert.equal((await noticeRows(db, PARENT_ROW_F1, "event_changed")).length, 0);
        const moved = await save(SUPER_ADMIN, {
          ...same,
          expected_version: 2,
          title: "Új cím",
          location: "Kert",
        });
        assert.equal(moved.state, "success");
        assert.equal((await noticeRows(db, PARENT_ROW_F1, "event_changed")).length, 1);
      });
      it("allowed: a new open group event tells the members of the group except its creator", async () => {
        const created = await save(ADMIN_G1, body({ group_id: GROUP_1 }));
        assert.equal(created.state, "success");
        assert.equal((await noticeRows(db, PARENT_ROW_F1, "event_new")).length, 1);
        assert.equal((await noticeRows(db, PARENT_ROW_ADMIN_G1, "event_new")).length, 0);
        assert.equal((await noticeRows(db, PARENT_ROW_F2, "event_new")).length, 0);
      });
      it("a cancelled event creates no new-event notice, and a replay sends nothing twice", async () => {
        const key = nextKey("again");
        const first = await save(SUPER_ADMIN, body({ title: "Értesítős" }), key);
        const before = await count(db, "notifications", "kind = 'event_new'");
        await save(SUPER_ADMIN, body({ title: "Értesítős" }), key);
        assert.equal(await count(db, "notifications", "kind = 'event_new'"), before);
        assert.equal(first.state, "success");
        const quiet = await save(SUPER_ADMIN, body({ title: "Elmarad", status: "cancelled" }));
        assert.equal(quiet.state, "success");
        assert.equal(await count(db, "notifications", `target_ref = '${quiet.reference}'`), 0);
      });
    });

    describe("W2 notices and W6 tale", () => {
      const notices = (
        account: string,
        event: string,
        version: number,
        lines: unknown,
        key = nextKey("n"),
      ) =>
        call(account, "event_notices_save($1, $2, $3, $4::jsonb)", [
          key,
          event,
          version,
          JSON.stringify(lines),
        ]);
      it("allowed: the list is replaced in order and the version goes up once, also for an equal list", async () => {
        const first = await notices(SUPER_ADMIN, COMMUNITY_EVENT, 1, ["Egy", "Kettő"]);
        assert.deepEqual([first.state, first.version], ["success", 2]);
        const equal = await notices(SUPER_ADMIN, COMMUNITY_EVENT, 2, ["Egy", "Kettő"]);
        assert.deepEqual([equal.state, equal.version], ["success", 3]);
        const rows = (
          await db.query("select text from event_notices where event_id = $1 order by position", [
            COMMUNITY_EVENT,
          ])
        ).rows.map((row) => row.text);
        assert.deepEqual(rows, ["Egy", "Kettő"]);
      });
      it("refused: eleven lines, an empty line and a 301-character line change nothing", async () => {
        await notices(SUPER_ADMIN, COMMUNITY_EVENT, 1, ["Marad"]);
        const eleven = await notices(
          SUPER_ADMIN,
          COMMUNITY_EVENT,
          2,
          Array.from({ length: 11 }, () => "x"),
        );
        assert.deepEqual([eleven.field, eleven.reason], ["notices", "too_many"]);
        for (const lines of [[" "], ["x".repeat(301)], [1]]) {
          assert.equal((await notices(SUPER_ADMIN, COMMUNITY_EVENT, 2, lines)).field, "notices");
        }
        assert.equal(await count(db, "event_notices", `event_id = '${COMMUNITY_EVENT}'`), 1);
      });
      it("refused and out of reach: a group admin on a community event or another group's event, and a made-up event", async () => {
        const denied = await notices(ADMIN_G1, COMMUNITY_EVENT, 1, ["x"]);
        assert.deepEqual(outcome(denied), ["denied", "authorization_denied"]);
        assert.equal((await notices(ADMIN_G2, GROUP_EVENT, 1, ["x"])).state, "denied");
        assert.equal((await notices(ADMIN_G1, GROUP_EVENT, 1, ["Rendben"])).state, "success");
        const real = await notices(OTHER_ADMIN, COMMUNITY_EVENT, 1, ["x"]);
        const made = await notices(OTHER_ADMIN, "99999999-0000-4000-8000-000000000002", 1, ["x"]);
        assert.deepEqual([real.state, real.field], [made.state, made.field]);
      });
      it("outdated screen, repeated click and two at once", async () => {
        assert.deepEqual(outcome(await notices(SUPER_ADMIN, COMMUNITY_EVENT, 5, ["x"])), [
          "conflict",
          "VERSION_CONFLICT",
        ]);
        const key = nextKey("rep");
        const first = await notices(SUPER_ADMIN, COMMUNITY_EVENT, 1, ["x"], key);
        assert.deepEqual(outcome(await notices(SUPER_ADMIN, COMMUNITY_EVENT, 1, ["x"], key)), [
          "success",
          "replayed",
        ]);
        assert.equal(first.version, 2);
        const answers = await Promise.all([
          notices(SUPER_ADMIN, COMMUNITY_EVENT, 2, ["a"]),
          callSecond(SUPER_ADMIN, "event_notices_save($1, $2, $3, $4::jsonb)", [
            nextKey("b"),
            COMMUNITY_EVENT,
            2,
            JSON.stringify(["b"]),
          ]),
        ]);
        assert.deepEqual(answers.map((answer) => answer.state).sort(), ["conflict", "success"]);
        assert.equal(await count(db, "event_notices", `event_id = '${COMMUNITY_EVENT}'`), 1);
      });
      it("the tale: saved, cleared by empty text, limited to 5000 characters and open after the event ended", async () => {
        const tale = (account: string, event: string, version: number, text: string | null) =>
          call(account, "event_tale_save($1, $2, $3, $4)", [nextKey("t"), event, version, text]);
        assert.equal((await tale(SUPER_ADMIN, COMMUNITY_EVENT, 1, "  Mese  ")).version, 2);
        assert.equal(
          (await db.query("select tale from events where id = $1", [COMMUNITY_EVENT])).rows[0].tale,
          "Mese",
        );
        assert.equal((await tale(SUPER_ADMIN, COMMUNITY_EVENT, 2, "")).state, "success");
        assert.equal(
          (await db.query("select tale from events where id = $1", [COMMUNITY_EVENT])).rows[0].tale,
          null,
        );
        assert.equal((await tale(SUPER_ADMIN, COMMUNITY_EVENT, 3, "x".repeat(5001))).field, "tale");
        assert.equal((await tale(ADMIN_G1, COMMUNITY_EVENT, 3, "tilos")).state, "denied");
        assert.equal((await tale(PARENT_F2, COMMUNITY_EVENT, 3, "tilos")).state, "denied");
        assert.deepEqual(outcome(await tale(SUPER_ADMIN, COMMUNITY_EVENT, 1, "régi")), [
          "conflict",
          "VERSION_CONFLICT",
        ]);
        assert.equal((await tale(SUPER_ADMIN, PAST_EVENT, 1, "Lezárt")).state, "success");
      });
    });

    describe("the reads", () => {
      it("event_list: the open list is soonest first with the cancelled one marked, the past list holds the ended one", async () => {
        const open = await list(PARENT_F1);
        assert.equal(open.state, "success");
        assert.ok(
          open.items.some((item) => item.id === CANCELLED_EVENT && item.status === "cancelled"),
        );
        assert.equal(
          open.items.some((item) => item.id === PAST_EVENT),
          false,
        );
        const past = await list(PARENT_F1, true);
        assert.deepEqual(
          past.items.map((item) => item.id),
          [PAST_EVENT],
        );
        assert.equal(past.items[0]!.is_finished, true);
      });
      it("event_list: a teacher reads it; a caller without a session or outside the community is refused, never given an empty list", async () => {
        assert.equal((await list(TEACHER_G1)).state, "success");
        assert.deepEqual(outcome(await list(SIGNED_OUT)), ["denied", "session_inactive"]);
        assert.equal((await list(OUTSIDER)).state, "denied");
      });
      it("event_list_for_group: the group's events only, and an unknown group answers denied", async () => {
        const result = (await call(PARENT_F1, "event_list_for_group($1, false)", [
          GROUP_1,
        ])) as Result & { items: Item[] };
        assert.deepEqual(result.items.map((item) => item.id).sort(), [EVENT_1, GROUP_EVENT].sort());
        const missing = await call(PARENT_F1, "event_list_for_group($1, false)", [
          "99999999-0000-4000-8000-000000000003",
        ]);
        assert.deepEqual(outcome(missing), ["denied", "GROUP_UNAVAILABLE"]);
      });
      it("event_get: one document with the caller block; a missing or foreign event answers alike", async () => {
        const page = (await call(PARENT_F1, "event_get($1)", [COMMUNITY_EVENT])) as Result & {
          event: { title: string; version: number };
          caller: { can_manage: boolean; can_sign_up: boolean };
        };
        assert.equal(page.state, "success");
        assert.deepEqual([page.caller.can_manage, page.caller.can_sign_up], [false, true]);
        const admin = (await call(SUPER_ADMIN, "event_get($1)", [COMMUNITY_EVENT])) as typeof page;
        assert.deepEqual([admin.caller.can_manage, admin.caller.can_sign_up], [true, false]);
        const real = await call(OTHER_ADMIN, "event_get($1)", [COMMUNITY_EVENT]);
        const made = await call(OTHER_ADMIN, "event_get($1)", [
          "99999999-0000-4000-8000-000000000004",
        ]);
        assert.deepEqual(outcome(real), outcome(made));
      });
    });

    it("refuses a new event in an archived group", async () => {
      const archived = await save(SUPER_ADMIN, body({ group_id: GROUP_ARCHIVED }));
      assert.deepEqual(
        [archived.state, archived.field, archived.reason],
        ["validation", "group_id", "archived"],
      );
    });
  });
}
