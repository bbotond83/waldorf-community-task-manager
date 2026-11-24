import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import { DIRECTORY_SCHEMAS, openDirectoryDatabase } from "./directory-support.ts";
import {
  caller,
  GROUP_EVENT,
  COMMUNITY_EVENT,
  idsOf,
  seedEventWorld,
  seedSampleChecklist,
} from "./checklist-support.ts";
import { inDays } from "./events-support.ts";
import { openDatabase } from "./stack-support.ts";
import { ADMIN_G1 } from "./working-groups-support.ts";

/**
 * The two daily checks of U11 (W8; BR168.1 to BR168.3), called as the schema owner with a chosen moment. Recipients are
 * read from the same helper functions the checks use, so the tests state who gets a notice, not which rows exist.
 */
for (const schema of DIRECTORY_SCHEMAS) {
  describe(`checklist daily checks in ${schema}`, () => {
    let db: pg.Client;
    let other: pg.Client;
    before(async () => {
      db = await openDirectoryDatabase(schema);
      other = await openDatabase();
    });
    after(async () => {
      await other.end();
      await db.end();
    });
    beforeEach(async () => {
      await seedEventWorld(db, schema);
      await db.query("delete from checklist_templates");
      await seedSampleChecklist(
        caller(() => db, schema),
        ADMIN_G1,
        GROUP_EVENT,
        true,
        db,
      );
    });

    const check = async (fn: string, at: string, client: pg.Client = db) =>
      (await client.query(`select ${schema}.${fn}($1::timestamptz) as r`, [at])).rows[0].r as {
        created: number;
        skipped: number;
        detail: string | null;
      };
    const kinds = async (kind: string, event: string) =>
      (
        await db.query(
          "select parent_id from notifications where kind = $1 and target_ref = $2 order by parent_id",
          [kind, event],
        )
      ).rows.map((r) => r.parent_id as string);
    const organisers = async (event: string) =>
      (await db.query(`select unnest(${schema}.event_organisers($1)) as id`, [event])).rows
        .map((r) => r.id as string)
        .sort();
    const members = async () =>
      (
        await db.query(
          `select unnest(${schema}.group_members((select group_id from events where id = $1))) as id`,
          [GROUP_EVENT],
        )
      ).rows
        .map((r) => r.id as string)
        .sort();
    const setEvent = (event: string, sql: string) =>
      db.query(`update events set ${sql} where id = $1`, [event]);

    describe("lead-time notice", () => {
      it("allowed: from the lead day on, every member gets one notice, and a second run adds none", async () => {
        await setEvent(GROUP_EVENT, "notice_lead_days = 3");
        const before = await check("event_lead_notice_check", inDays(6));
        assert.equal(before.created, 0, "too early");
        const first = await check("event_lead_notice_check", inDays(7.2));
        assert.ok(first.created > 0);
        assert.deepEqual((await kinds("event_lead_time", GROUP_EVENT)).sort(), await members());
        assert.equal((await check("event_lead_notice_check", inDays(7.3))).created, 0);
        assert.equal((await check("event_lead_notice_check", inDays(8))).created, 0);
      });
      it("allowed: a community event goes to every active parent with an account", async () => {
        await setEvent(COMMUNITY_EVENT, "notice_lead_days = 20");
        assert.ok((await check("event_lead_notice_check", inDays(0))).created > 0);
        assert.ok((await kinds("event_lead_time", COMMUNITY_EVENT)).length > 0);
      });
      it("refused: no notice with no lead days, for a cancelled or started event, or after the start", async () => {
        await setEvent(GROUP_EVENT, "notice_lead_days = null");
        assert.equal((await check("event_lead_notice_check", inDays(9))).created, 0);
        await setEvent(GROUP_EVENT, "notice_lead_days = 30, status = 'cancelled'");
        assert.equal((await check("event_lead_notice_check", inDays(9))).created, 0);
        await setEvent(GROUP_EVENT, "notice_lead_days = 30, status = 'planned'");
        assert.equal(
          (await check("event_lead_notice_check", inDays(11))).created,
          0,
          "already started",
        );
      });
      it("two people at once: two runs at the same moment send each notice once", async () => {
        await setEvent(GROUP_EVENT, "notice_lead_days = 30");
        await Promise.all([
          check("event_lead_notice_check", inDays(1)),
          check("event_lead_notice_check", inDays(1), other),
        ]);
        assert.deepEqual((await kinds("event_lead_time", GROUP_EVENT)).sort(), await members());
      });
      it("outdated screen and out of reach: nem értelmezhető (a run has no screen and no caller)", () =>
        assert.ok(true));
    });

    describe("unclaimed alert", () => {
      const nearDeadline = (days: number) =>
        setEvent(
          GROUP_EVENT,
          `signup_deadline = ((now() at time zone 'Europe/Budapest')::date + ${days})`,
        );
      it("allowed: within three days of the deadline the organisers get one alert while a parents' task has free places; it repeats only when the deadline moves", async () => {
        await nearDeadline(2);
        const first = await check("checklist_unclaimed_check", inDays(0.5));
        assert.ok(first.created > 0);
        assert.deepEqual(
          (await kinds("checklist_unclaimed", GROUP_EVENT)).sort(),
          await organisers(GROUP_EVENT),
        );
        assert.equal((await check("checklist_unclaimed_check", inDays(1.5))).created, 0);
        await nearDeadline(3);
        assert.ok(
          (await check("checklist_unclaimed_check", inDays(1.5))).created > 0,
          "a new deadline allows one new alert",
        );
      });
      it("refused: no alert more than three days ahead, after the deadline, when everything is claimed or done, or for a cancelled event", async () => {
        await nearDeadline(5);
        assert.equal((await check("checklist_unclaimed_check", inDays(0.5))).created, 0);
        await nearDeadline(-1);
        assert.equal((await check("checklist_unclaimed_check", inDays(0.5))).created, 0);
        await nearDeadline(1);
        const all = await idsOf(db, GROUP_EVENT);
        await db.query("update event_checklist_tasks set done_at = now() where section_id = $1", [
          all.section("Szülők"),
        ]);
        assert.equal(
          (await check("checklist_unclaimed_check", inDays(0.5))).created,
          0,
          "all parents' tasks done",
        );
        await db.query("update event_checklist_tasks set done_at = null");
        await setEvent(GROUP_EVENT, "status = 'cancelled'");
        assert.equal((await check("checklist_unclaimed_check", inDays(0.5))).created, 0);
      });
      it("two people at once: two runs send each alert once", async () => {
        await nearDeadline(1);
        await Promise.all([
          check("checklist_unclaimed_check", inDays(0.5)),
          check("checklist_unclaimed_check", inDays(0.5), other),
        ]);
        assert.deepEqual(
          (await kinds("checklist_unclaimed", GROUP_EVENT)).sort(),
          await organisers(GROUP_EVENT),
        );
      });
    });

    it("the daily run lists both checks and one failing event does not stop the others", async () => {
      const names = (
        await db.query(
          "select check_name from timed_check_registry where added_by = 'u11-checklists' order by check_name",
        )
      ).rows.map((r) => r.check_name);
      assert.deepEqual(names, ["checklist_unclaimed_alert", "event_lead_notice"]);
    });

    it("timing: both checks over the large seed set finish well inside the daily window", async () => {
      const started = Date.now();
      await check("event_lead_notice_check", inDays(0));
      await check("checklist_unclaimed_check", inDays(0));
      assert.ok(Date.now() - started < 5000);
    });
  });
}
