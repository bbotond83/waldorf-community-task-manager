import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import {
  ADMIN_G1,
  ADMIN_G2,
  CO_PARENT_F1,
  DIRECTORY_SCHEMAS,
  FAMILY_1,
  FAMILY_2,
  GROUP_1,
  nextKey,
  openDirectoryDatabase,
  OTHER_ADMIN,
  PARENT_F1,
  PARENT_F2,
  PARENT_ROW_CO,
  PARENT_ROW_F1,
  SIGNED_OUT,
  SUPER_ADMIN,
  TEACHER_G1,
  uuid,
} from "./directory-support.ts";
import { failureOf } from "./identity-support.ts";
import {
  auditFor,
  dayOffset,
  insertOccurrence,
  insertSchedule,
  mondayAfter,
  OCC,
  occurrenceRow,
  publishWeeks,
  recurringCalls,
  SCHEDULE_F1,
  SCHEDULE_G1,
  SCHEDULE_WATER,
  seedRecurringWorld,
} from "./recurring-support.ts";
import { openDatabase } from "./stack-support.ts";
import { MEMBERSHIP_F1 } from "./working-groups-support.ts";

/**
 * The three occurrence commands of U9: mark done, undo and skip (W3, W4, W5; BR145, BR146, BR147.2; NFR3.5, NFR3.8,
 * NFR3.9, NFR4.1, NFR5.1, NFR5.4, D-SEC-1). The fixed list for each: allowed, refused, out of reach, outdated screen,
 * repeated click, two at once. The timing of mark done is in recurring-timing.test.ts.
 */
for (const schema of DIRECTORY_SCHEMAS) {
  describe(`recurring occurrence commands in ${schema}`, () => {
    let db: pg.Client;
    let one: pg.Client;
    let two: pg.Client;
    // One open occurrence of each owner kind, all due this week.
    const GROUP_OCC = OCC(1);
    const FAMILY_OCC = OCC(2);
    const ROTA_OCC = OCC(3);
    let monday = "";
    before(async () => {
      db = await openDirectoryDatabase(schema);
      one = await openDatabase();
      two = await openDatabase();
    });
    after(async () => {
      await one.end();
      await two.end();
      await db.end();
    });
    beforeEach(async () => {
      await seedRecurringWorld(db, schema);
      monday = await mondayAfter(db, 0);
      await publishWeeks(db, [{ monday, family: FAMILY_1 }]);
      await insertSchedule(db, { id: SCHEDULE_G1, group: GROUP_1 });
      await insertSchedule(db, { id: SCHEDULE_F1, kind: "family", family: FAMILY_1 });
      await insertSchedule(db, {
        id: SCHEDULE_WATER,
        kind: "rota_week",
        job: "water_carrying",
        interval: 4,
      });
      const today = await dayOffset(db, 0);
      await insertOccurrence(db, { id: GROUP_OCC, schedule: SCHEDULE_G1, due: today });
      await insertOccurrence(db, { id: FAMILY_OCC, schedule: SCHEDULE_F1, due: today });
      await insertOccurrence(db, { id: ROTA_OCC, schedule: SCHEDULE_WATER, due: monday });
    });

    const calls = recurringCalls(() => db, schema);
    const callsOne = recurringCalls(() => one, schema);
    const callsTwo = recurringCalls(() => two, schema);
    const row = async (id: string) => (await occurrenceRow(db, id))!;
    const denied = (result: { state: string; code: string | null }) =>
      assert.deepEqual([result.state, result.code], ["denied", "authorization_denied"]);
    const conflict = (result: { state: string; code: string | null }, code: string) =>
      assert.deepEqual([result.state, result.code], ["conflict", code]);
    const markDone = async (account: string, id: string) =>
      calls.done(account, id, (await row(id)).version);
    const parentOf = async (account: string) =>
      String(
        (await db.query("select id from parents where account_id = $1", [account])).rows[0].id,
      );

    describe("recurring_occurrence_mark_done", () => {
      it("allowed: a member of the group and the coordinator mark a group occurrence: one person, one time, one audit entry (BR145.1)", async () => {
        const result = await markDone(PARENT_F1, GROUP_OCC);
        assert.equal(result.state, "success", JSON.stringify(result));
        assert.equal(result.version, 2);
        const done = await row(GROUP_OCC);
        assert.deepEqual(
          [done.status, done.done_by_parent_id, done.done_by_removed],
          ["done", PARENT_ROW_F1, false],
        );
        assert.ok(done.done_at);
        const audit = await auditFor(db, "recurring_occurrence_done");
        assert.deepEqual(
          audit.map((a) => [a.target_id, a.group_id, a.actor_account_id, a.details]),
          [[GROUP_OCC, GROUP_1, PARENT_F1, null]],
        );
        // The coordinator is a member of the group too.
        await insertOccurrence(db, {
          id: OCC(11),
          schedule: SCHEDULE_G1,
          due: await dayOffset(db, 1),
        });
        assert.equal((await markDone(ADMIN_G1, OCC(11))).state, "success");
        assert.equal((await row(OCC(11))).done_by_parent_id, await parentOf(ADMIN_G1));
      });

      it("allowed: both parents of the owning family mark a family occurrence; the holder of the week marks a rota-week occurrence", async () => {
        assert.equal((await markDone(CO_PARENT_F1, FAMILY_OCC)).state, "success");
        assert.equal((await row(FAMILY_OCC)).done_by_parent_id, PARENT_ROW_CO);
        const rota = await markDone(PARENT_F1, ROTA_OCC);
        assert.equal(rota.state, "success", JSON.stringify(rota));
        assert.equal((await row(ROTA_OCC)).done_by_parent_id, PARENT_ROW_F1);
      });

      it("refused: not a member, a parent of another family, a teacher, a coordinator of another group, a super admin (D-SEC-1), another community and a signed-out caller", async () => {
        for (const account of [PARENT_F2, ADMIN_G2, TEACHER_G1, SUPER_ADMIN, OTHER_ADMIN]) {
          denied(await markDone(account, GROUP_OCC));
        }
        for (const account of [PARENT_F2, ADMIN_G1, TEACHER_G1, SUPER_ADMIN]) {
          denied(await markDone(account, FAMILY_OCC));
          denied(await markDone(account, ROTA_OCC));
        }
        const signedOut = await calls.done(SIGNED_OUT, GROUP_OCC, 1);
        assert.deepEqual([signedOut.state, signedOut.code], ["denied", "session_inactive"]);
        for (const id of [GROUP_OCC, FAMILY_OCC, ROTA_OCC])
          assert.equal((await row(id)).status, "open");
        assert.equal((await auditFor(db, "recurring_occurrence_done")).length, 0);
      });

      it("out of reach: a real occurrence and a made-up id give the same refusal, whole envelope included (NFR4.9)", async () => {
        for (const account of [PARENT_F2, TEACHER_G1, SUPER_ADMIN]) {
          const real = await calls.done(account, FAMILY_OCC, 1);
          const madeUp = await calls.done(account, uuid(99999), 1);
          assert.deepEqual(real, madeUp, account);
        }
        const foreign = await insertSchedule(db, {
          id: uuid(99700),
          group: uuid(503),
          org: "aaaaaaaa-0000-4000-8000-000000000002",
        });
        await insertOccurrence(db, {
          id: uuid(99701),
          schedule: foreign,
          due: await dayOffset(db, 0),
        });
        assert.deepEqual(
          await calls.done(PARENT_F1, uuid(99701), 1),
          await calls.done(PARENT_F1, uuid(99999), 1),
        );
      });

      it("rights lost between two requests apply to the next one: left the group, the week moved to another family (NFR3.8, NFR3.9)", async () => {
        assert.equal((await markDone(PARENT_F1, ROTA_OCC)).state, "success");
        await calls.undo(PARENT_F1, ROTA_OCC, 2);
        await db.query(
          "update rota_weeks set family_id = $1 where week_start = $2 and job = 'water_carrying'",
          [FAMILY_2, monday],
        );
        denied(await markDone(PARENT_F1, ROTA_OCC));
        assert.equal((await markDone(PARENT_F2, ROTA_OCC)).state, "success");
        await db.query("delete from group_memberships where id = $1", [MEMBERSHIP_F1]);
        denied(await markDone(PARENT_F1, GROUP_OCC));
        assert.equal((await row(GROUP_OCC)).status, "open");
      });

      it("outdated screen and closed: a stale version is a conflict; a finished occurrence at its current version is closed (BR145.2)", async () => {
        assert.equal((await calls.done(PARENT_F1, GROUP_OCC, 1)).state, "success");
        conflict(await calls.done(ADMIN_G1, GROUP_OCC, 1), "VERSION_CONFLICT");
        conflict(await calls.done(ADMIN_G1, GROUP_OCC, 2), "RECURRING_CLOSED");
        await insertOccurrence(db, {
          id: OCC(12),
          schedule: SCHEDULE_G1,
          due: await dayOffset(db, 2),
          status: "skipped",
        });
        conflict(await calls.done(PARENT_F1, OCC(12), 1), "RECURRING_CLOSED");
        const missing = await calls.done(PARENT_F1, GROUP_OCC, null as unknown as number);
        assert.deepEqual([missing.state, missing.field], ["validation", "expected_version"]);
        assert.equal((await auditFor(db, "recurring_occurrence_done")).length, 1);
      });

      it("repeated click: one key twice marks once, with one audit entry; the same key for another occurrence is refused (NFR5.1)", async () => {
        const key = nextKey("done");
        const first = await calls.done(PARENT_F1, GROUP_OCC, 1, key);
        const second = await calls.done(PARENT_F1, GROUP_OCC, 1, key);
        assert.equal(first.state, "success");
        assert.deepEqual(
          [second.state, second.code, second.reference],
          ["success", "replayed", GROUP_OCC],
        );
        assert.equal((await auditFor(db, "recurring_occurrence_done")).length, 1);
        assert.equal((await row(GROUP_OCC)).version, 2);
        const reused = await calls.done(PARENT_F1, FAMILY_OCC, 1, key);
        assert.deepEqual([reused.state, reused.code], ["conflict", "idempotency_key_reused"]);
      });

      it("two at once: two people marking one occurrence leave one mark and one conflict, 20 times (NFR5.4)", async () => {
        for (let run = 0; run < 20; run += 1) {
          const id = OCC(100 + run);
          await insertOccurrence(db, {
            id,
            schedule: SCHEDULE_G1,
            due: await dayOffset(db, 3 + run),
          });
          const answers = await Promise.all([
            callsOne.done(PARENT_F1, id, 1),
            callsTwo.done(ADMIN_G1, id, 1),
          ]);
          assert.deepEqual(
            answers.map((a) => a.state).sort(),
            ["conflict", "success"],
            `run ${run}`,
          );
          const done = await row(id);
          assert.equal(done.status, "done");
          const winner = answers[0]!.state === "success" ? PARENT_ROW_F1 : await parentOf(ADMIN_G1);
          assert.equal(done.done_by_parent_id, winner, `run ${run}`);
        }
        assert.equal((await auditFor(db, "recurring_occurrence_done")).length, 20);
      });

      it("two at once: mark done against a skip, in both orders, 20 times each, with no deadlock", async () => {
        for (let run = 0; run < 20; run += 1) {
          const id = OCC(200 + run);
          await insertOccurrence(db, {
            id,
            schedule: SCHEDULE_G1,
            due: await dayOffset(db, 30 + run),
          });
          const mark = () => callsOne.done(PARENT_F1, id, 1);
          const skip = () => callsTwo.skip(ADMIN_G1, id, 1, "Esik az eső.");
          const answers =
            run % 2 === 0
              ? await Promise.all([mark(), skip()])
              : (await Promise.all([skip(), mark()])).reverse();
          assert.deepEqual(
            answers.map((a) => a.state).sort(),
            ["conflict", "success"],
            `run ${run}`,
          );
          const final = await row(id);
          assert.equal(
            final.status,
            answers[0]!.state === "success" ? "done" : "skipped",
            `run ${run}`,
          );
        }
      });

      it("two at once: a week moved to another family while its holder marks is a conflict and nothing is marked (C12)", async () => {
        await two.query("begin");
        await two.query(`set local search_path to ${schema}`);
        try {
          // Like the real swap (rota_adjust_picks_after_change): it locks the rota-week row and takes no family lock.
          await two.query(
            "select id from rota_weeks where week_start = $1 and job = 'water_carrying' for update",
            [monday],
          );
          const pending = callsOne.done(PARENT_F1, ROTA_OCC, 1);
          await new Promise((resolve) => setTimeout(resolve, 300));
          await two.query(
            "update rota_weeks set family_id = $1 where week_start = $2 and job = 'water_carrying'",
            [FAMILY_2, monday],
          );
          await two.query("commit");
          conflict(await pending, "VERSION_CONFLICT");
        } catch (error) {
          await two.query("rollback");
          throw error;
        }
        assert.equal((await row(ROTA_OCC)).status, "open");
        assert.equal((await auditFor(db, "recurring_occurrence_done")).length, 0);
      });

      it("rolls back when the audit entry cannot be written (NFR4.1)", async () => {
        await db.query(
          "create function rec_block_audit() returns trigger language plpgsql as $f$ begin raise exception 'audit blocked'; end $f$",
        );
        await db.query(
          "create trigger rec_block_audit before insert on audit_events for each row when (new.action like 'recurring%') execute function rec_block_audit()",
        );
        try {
          assert.ok(await failureOf(() => calls.done(PARENT_F1, GROUP_OCC, 1)));
          assert.equal((await row(GROUP_OCC)).status, "open");
        } finally {
          await db.query("drop trigger rec_block_audit on audit_events");
          await db.query("drop function rec_block_audit()");
        }
      });
    });

    describe("recurring_occurrence_undo_done", () => {
      const markAs = async (account: string, id: string) => {
        const result = await markDone(account, id);
        assert.equal(result.state, "success", JSON.stringify(result));
      };

      it("allowed: the person who marked it, a coordinator and a super admin, for every owner kind (BR146.2, D-SEC-1)", async () => {
        await markAs(PARENT_F1, GROUP_OCC);
        const byMarker = await calls.undo(PARENT_F1, GROUP_OCC, 2);
        assert.equal(byMarker.state, "success", JSON.stringify(byMarker));
        const open = await row(GROUP_OCC);
        assert.deepEqual(
          [open.status, open.done_by_parent_id, open.done_at, open.done_by_removed, open.version],
          ["open", null, null, false, 3],
        );
        await markAs(PARENT_F1, GROUP_OCC);
        assert.equal((await calls.undo(ADMIN_G1, GROUP_OCC, 4)).state, "success");
        await markAs(PARENT_F1, FAMILY_OCC);
        assert.equal((await calls.undo(SUPER_ADMIN, FAMILY_OCC, 2)).state, "success");
        await markAs(PARENT_F1, ROTA_OCC);
        assert.equal((await calls.undo(SUPER_ADMIN, ROTA_OCC, 2)).state, "success");
        assert.equal((await auditFor(db, "recurring_occurrence_undone")).length, 4);
        assert.equal((await row(ROTA_OCC)).status, "open");
      });

      it("refused: another person of the same family or group who did not mark it, another group's coordinator, a teacher, a parent elsewhere", async () => {
        await markAs(PARENT_F1, FAMILY_OCC);
        denied(await calls.undo(CO_PARENT_F1, FAMILY_OCC, 2));
        denied(await calls.undo(PARENT_F2, FAMILY_OCC, 2));
        denied(await calls.undo(TEACHER_G1, FAMILY_OCC, 2));
        denied(await calls.undo(ADMIN_G1, FAMILY_OCC, 2));
        await markAs(PARENT_F1, GROUP_OCC);
        denied(await calls.undo(ADMIN_G2, GROUP_OCC, 2));
        denied(await calls.undo(PARENT_F2, GROUP_OCC, 2));
        denied(await calls.undo(OTHER_ADMIN, GROUP_OCC, 2));
        denied(await calls.undo(PARENT_F1, uuid(99999), 1));
        assert.equal((await row(FAMILY_OCC)).status, "done");
        assert.equal((await auditFor(db, "recurring_occurrence_undone")).length, 0);
      });

      it("refused: a marker who has lost the right since (left the group, the week moved on) is refused on the next request (NFR3.8)", async () => {
        await markAs(PARENT_F1, GROUP_OCC);
        await db.query("delete from group_memberships where id = $1", [MEMBERSHIP_F1]);
        denied(await calls.undo(PARENT_F1, GROUP_OCC, 2));
        assert.equal((await calls.undo(ADMIN_G1, GROUP_OCC, 2)).state, "success");
        await markAs(PARENT_F1, ROTA_OCC);
        await db.query(
          "update rota_weeks set family_id = $1 where week_start = $2 and job = 'water_carrying'",
          [FAMILY_2, monday],
        );
        denied(await calls.undo(PARENT_F1, ROTA_OCC, 2));
      });

      it("both sides of the 24-hour mark: 23 h 59 min is allowed, 24 h 1 min is too late, for the marker and for a coordinator (BR146.2)", async () => {
        await markAs(PARENT_F1, GROUP_OCC);
        await db.query(
          "update recurring_occurrences set done_at = now() - interval '23 hours 59 minutes' where id = $1",
          [GROUP_OCC],
        );
        assert.equal(
          (await calls.undo(PARENT_F1, GROUP_OCC, (await row(GROUP_OCC)).version)).state,
          "success",
        );
        await markAs(PARENT_F1, GROUP_OCC);
        await db.query(
          "update recurring_occurrences set done_at = now() - interval '24 hours 1 minute' where id = $1",
          [GROUP_OCC],
        );
        const version = (await row(GROUP_OCC)).version;
        conflict(await calls.undo(PARENT_F1, GROUP_OCC, version), "RECURRING_UNDO_TOO_LATE");
        conflict(await calls.undo(ADMIN_G1, GROUP_OCC, version), "RECURRING_UNDO_TOO_LATE");
        conflict(await calls.undo(SUPER_ADMIN, GROUP_OCC, version), "RECURRING_UNDO_TOO_LATE");
        assert.equal((await row(GROUP_OCC)).status, "done");
      });

      it("outdated screen and closed: a stale version is a conflict; an open or skipped occurrence is closed for undo", async () => {
        await markAs(PARENT_F1, GROUP_OCC);
        conflict(await calls.undo(PARENT_F1, GROUP_OCC, 1), "VERSION_CONFLICT");
        conflict(await calls.undo(ADMIN_G1, GROUP_OCC, 1), "VERSION_CONFLICT");
        conflict(await calls.undo(SUPER_ADMIN, FAMILY_OCC, 1), "RECURRING_CLOSED");
      });

      it("repeated click: one key twice undoes once, with one audit entry", async () => {
        await markAs(PARENT_F1, GROUP_OCC);
        const key = nextKey("undo");
        assert.equal((await calls.undo(PARENT_F1, GROUP_OCC, 2, key)).state, "success");
        const second = await calls.undo(PARENT_F1, GROUP_OCC, 2, key);
        assert.deepEqual([second.state, second.code], ["success", "replayed"]);
        assert.equal((await auditFor(db, "recurring_occurrence_undone")).length, 1);
      });

      it("two at once: an undo against a skip on one finished occurrence leaves one change, 20 times", async () => {
        for (let run = 0; run < 20; run += 1) {
          const id = OCC(300 + run);
          await insertOccurrence(db, {
            id,
            schedule: SCHEDULE_G1,
            due: await dayOffset(db, 40 + run),
          });
          await markAs(PARENT_F1, id);
          const undo = () => callsOne.undo(PARENT_F1, id, 2);
          const skip = () => callsTwo.skip(ADMIN_G1, id, 2, "Már nem kell.");
          const answers =
            run % 2 === 0
              ? await Promise.all([undo(), skip()])
              : (await Promise.all([skip(), undo()])).reverse();
          // A skip needs an open occurrence, so against a finished one it can only follow the undo.
          assert.equal(answers[0]!.state, "success", `run ${run}`);
          assert.ok(["success", "conflict"].includes(answers[1]!.state), `run ${run}`);
          assert.equal(
            (await row(id)).status,
            answers[1]!.state === "success" ? "skipped" : "open",
          );
        }
      });

      it("rolls back when the audit entry cannot be written (NFR4.1)", async () => {
        await markAs(PARENT_F1, GROUP_OCC);
        await db.query(
          "create function rec_block_audit() returns trigger language plpgsql as $f$ begin raise exception 'audit blocked'; end $f$",
        );
        await db.query(
          "create trigger rec_block_audit before insert on audit_events for each row when (new.action like 'recurring%') execute function rec_block_audit()",
        );
        try {
          assert.ok(await failureOf(() => calls.undo(PARENT_F1, GROUP_OCC, 2)));
          assert.equal((await row(GROUP_OCC)).status, "done");
        } finally {
          await db.query("drop trigger rec_block_audit on audit_events");
          await db.query("drop function rec_block_audit()");
        }
      });
    });

    describe("recurring_occurrence_skip", () => {
      it("allowed: the coordinator skips a group occurrence; a super admin skips any kind; the reason and the person are kept (BR147.2)", async () => {
        const result = await calls.skip(ADMIN_G1, GROUP_OCC, 1, "  Esik az eső.  ");
        assert.equal(result.state, "success", JSON.stringify(result));
        const skipped = await row(GROUP_OCC);
        assert.deepEqual(
          [
            skipped.status,
            skipped.skipped_reason,
            skipped.skipped_by_account_id,
            skipped.skipped_by_parent_id,
            skipped.skipped_by_removed,
          ],
          ["skipped", "Esik az eső.", ADMIN_G1, await parentOf(ADMIN_G1), false],
        );
        for (const id of [FAMILY_OCC, ROTA_OCC]) {
          const answer = await calls.skip(SUPER_ADMIN, id, 1, "Szünet.");
          assert.equal(answer.state, "success", JSON.stringify(answer));
          const other = await row(id);
          assert.deepEqual(
            [other.skipped_by_account_id, other.skipped_by_parent_id],
            [SUPER_ADMIN, null],
          );
        }
        const audit = await auditFor(db, "recurring_occurrence_skipped");
        assert.equal(audit.length, 3);
        assert.ok(
          audit.every((a) => a.details === null),
          "no reason text in the audit entry",
        );
      });

      it("refused: a parent, a teacher, another group's coordinator, a coordinator on a family or rota-week occurrence, another community", async () => {
        for (const account of [PARENT_F1, CO_PARENT_F1, TEACHER_G1, ADMIN_G2, OTHER_ADMIN]) {
          denied(await calls.skip(account, GROUP_OCC, 1, "Ok."));
        }
        denied(await calls.skip(ADMIN_G1, FAMILY_OCC, 1, "Ok."));
        denied(await calls.skip(ADMIN_G1, ROTA_OCC, 1, "Ok."));
        denied(await calls.skip(PARENT_F1, FAMILY_OCC, 1, "Ok."));
        assert.deepEqual(
          await calls.skip(PARENT_F1, FAMILY_OCC, 1, "Ok."),
          await calls.skip(PARENT_F1, uuid(99999), 1, "Ok."),
        );
        const signedOut = await calls.skip(SIGNED_OUT, GROUP_OCC, 1, "Ok.");
        assert.deepEqual([signedOut.state, signedOut.code], ["denied", "session_inactive"]);
        assert.equal((await auditFor(db, "recurring_occurrence_skipped")).length, 0);
      });

      it("refused: a coordinator whose grant was revoked since is refused on the next request (NFR3.8)", async () => {
        assert.equal((await calls.skip(ADMIN_G1, GROUP_OCC, 1, "Ok.")).state, "success");
        await db.query(
          "update app_role_grants set revoked_at = now() where subject_id = $1 and role = 'group_admin'",
          [ADMIN_G1],
        );
        await insertOccurrence(db, {
          id: OCC(13),
          schedule: SCHEDULE_G1,
          due: await dayOffset(db, 2),
        });
        denied(await calls.skip(ADMIN_G1, OCC(13), 1, "Ok."));
      });

      it("refused: the reason must be 1 to 200 characters after trimming (BR147.2)", async () => {
        for (const reason of [null, "", "   ", "x".repeat(201)]) {
          const result = await calls.skip(ADMIN_G1, GROUP_OCC, 1, reason);
          assert.deepEqual(
            [result.state, result.code, result.field],
            ["validation", "field_invalid", "reason"],
            String(reason),
          );
        }
        assert.equal((await calls.skip(ADMIN_G1, GROUP_OCC, 1, "x".repeat(200))).state, "success");
      });

      it("final: a skipped occurrence cannot be marked, skipped again or undone; outdated and closed codes", async () => {
        assert.equal((await calls.skip(ADMIN_G1, GROUP_OCC, 1, "Ok.")).state, "success");
        conflict(await calls.skip(ADMIN_G1, GROUP_OCC, 1, "Ok."), "VERSION_CONFLICT");
        conflict(await calls.skip(ADMIN_G1, GROUP_OCC, 2, "Ok."), "RECURRING_CLOSED");
        conflict(await calls.done(PARENT_F1, GROUP_OCC, 2), "RECURRING_CLOSED");
        conflict(await calls.undo(ADMIN_G1, GROUP_OCC, 2), "RECURRING_CLOSED");
        assert.equal((await row(GROUP_OCC)).status, "skipped");
      });

      it("repeated click: one key twice skips once; the same key with another reason is refused", async () => {
        const key = nextKey("skip");
        assert.equal((await calls.skip(ADMIN_G1, GROUP_OCC, 1, "Ok.", key)).state, "success");
        const second = await calls.skip(ADMIN_G1, GROUP_OCC, 1, "Ok.", key);
        assert.deepEqual([second.state, second.code], ["success", "replayed"]);
        const other = await calls.skip(ADMIN_G1, GROUP_OCC, 1, "Más ok.", key);
        assert.deepEqual([other.state, other.code], ["conflict", "idempotency_key_reused"]);
        assert.equal((await auditFor(db, "recurring_occurrence_skipped")).length, 1);
      });

      it("two at once: a coordinator and a super admin skipping one occurrence leave one skip, 20 times", async () => {
        for (let run = 0; run < 20; run += 1) {
          const id = OCC(400 + run);
          await insertOccurrence(db, {
            id,
            schedule: SCHEDULE_G1,
            due: await dayOffset(db, 60 + run),
          });
          const answers = await Promise.all([
            callsOne.skip(ADMIN_G1, id, 1, "Egy."),
            callsTwo.skip(SUPER_ADMIN, id, 1, "Kettő."),
          ]);
          assert.deepEqual(
            answers.map((a) => a.state).sort(),
            ["conflict", "success"],
            `run ${run}`,
          );
          assert.equal((await row(id)).status, "skipped");
        }
      });

      it("rolls back when the audit entry cannot be written (NFR4.1)", async () => {
        await db.query(
          "create function rec_block_audit() returns trigger language plpgsql as $f$ begin raise exception 'audit blocked'; end $f$",
        );
        await db.query(
          "create trigger rec_block_audit before insert on audit_events for each row when (new.action like 'recurring%') execute function rec_block_audit()",
        );
        try {
          assert.ok(await failureOf(() => calls.skip(ADMIN_G1, GROUP_OCC, 1, "Ok.")));
          assert.equal((await row(GROUP_OCC)).status, "open");
        } finally {
          await db.query("drop trigger rec_block_audit on audit_events");
          await db.query("drop function rec_block_audit()");
        }
      });
    });

    describe("what a super admin may do with each kind (D-SEC-1, NFR3.5)", () => {
      it("reads, undoes and skips group, family and rota-week occurrences but never marks one done", async () => {
        for (const id of [GROUP_OCC, FAMILY_OCC, ROTA_OCC]) {
          const read = await calls.fn(SUPER_ADMIN, "recurring_occurrence_get($1)", [id]);
          assert.equal(read.state, "success", id);
          const item = (read as unknown as { item: Record<string, unknown> }).item;
          assert.deepEqual(
            [item.can_mark_done, item.can_skip, item.can_undo],
            [false, true, false],
            id,
          );
          denied(await markDone(SUPER_ADMIN, id));
        }
        await markDone(PARENT_F1, FAMILY_OCC);
        const done = await calls.fn(SUPER_ADMIN, "recurring_occurrence_get($1)", [FAMILY_OCC]);
        assert.equal((done as unknown as { item: { can_undo: boolean } }).item.can_undo, true);
      });
    });
  });
}
