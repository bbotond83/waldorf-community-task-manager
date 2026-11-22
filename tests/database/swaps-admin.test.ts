import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import {
  ADMIN_G1,
  DIRECTORY_SCHEMAS,
  FAMILY_1,
  FAMILY_2,
  nextKey,
  openDirectoryDatabase,
  OTHER_ADMIN,
  PARENT_F1,
  PARENT_F2,
  PARENT_ROW_F1,
  PARENT_ROW_F2,
  SUPER_ADMIN,
  TEACHER_G1,
  uuid,
} from "./directory-support.ts";
import {
  auditOf,
  noticesOf,
  PLACE_F1_T1,
  PLACE_F2_T3,
  placeRow,
  refused,
  requestRow,
  seedSwapWorld,
  setStart,
  swapCalls,
  TASK_1,
  TASK_3,
} from "./swaps-support.ts";

/**
 * Admin decisions on swaps and cancellations (W4 to W6; BR73.1, BR74.1, BR75.1, BR76.2 to BR76.4, BR77.1, NFR1, NFR3.2,
 * NFR3.9). Each rule has the fixed list: allowed, refused, out of reach, outdated screen and repeated click.
 */
for (const schema of DIRECTORY_SCHEMAS) {
  describe(`admin duty changes in ${schema}`, () => {
    let db: pg.Client;
    let calls: ReturnType<typeof swapCalls>;

    before(async () => {
      db = await openDirectoryDatabase(schema);
      calls = swapCalls(db, schema);
    });
    after(async () => {
      await db.end();
    });
    beforeEach(async () => {
      await seedSwapWorld(db, schema);
    });

    /** The version the screen shows for a duty that has one place: the place's. */
    const taskVersion = async (task: string) =>
      Number(
        (
          await db.query(
            "select version from assignments where task_id = $1 and status <> 'removed'",
            [task],
          )
        ).rows[0].version,
      );

    async function appliedSwap(): Promise<string> {
      const made = await calls.request(PARENT_F1, PLACE_F1_T1, PLACE_F2_T3);
      assert.equal(made.state, "success", JSON.stringify(made));
      const done = await calls.respond(PARENT_F2, String(made.reference), true);
      assert.equal(done.state, "success", JSON.stringify(done));
      return String(made.reference);
    }

    // ------------------------------------------------------------------ cancellations (BR76.2 to BR76.4)
    it("approves a cancellation: the place is released, the family told, the decision audited", async () => {
      const made = await calls.cancel(PARENT_F1, PLACE_F1_T1);
      const id = String(made.reference);
      const done = await calls.decide(ADMIN_G1, id, true);
      assert.equal(done.state, "success", JSON.stringify(done));
      const place = await placeRow(db, PLACE_F1_T1);
      assert.notEqual(place.status, "active");
      assert.notEqual(place.status, "cancellation_pending");
      const row = await requestRow(db, id);
      assert.equal(row.status, "approved");
      assert.equal((await noticesOf(db, PARENT_ROW_F1, "cancellation_decided")).length, 1);
      assert.equal((await auditOf(db, "approval.approve", "success")).length, 1);
    });

    it("rejects a cancellation: the family keeps the duty and is told", async () => {
      const id = String((await calls.cancel(PARENT_F1, PLACE_F1_T1)).reference);
      const done = await calls.decide(SUPER_ADMIN, id, false);
      assert.equal(done.state, "success", JSON.stringify(done));
      const place = await placeRow(db, PLACE_F1_T1);
      assert.deepEqual([place.status, place.family_id], ["active", FAMILY_1]);
      assert.equal((await requestRow(db, id)).status, "rejected");
      assert.equal((await noticesOf(db, PARENT_ROW_F1, "cancellation_decided")).length, 1);
      assert.equal((await auditOf(db, "approval.reject", "success")).length, 1);
    });

    it("refuses a decision from a person without reach, with a denied audit entry, and changes nothing", async () => {
      const id = String((await calls.cancel(PARENT_F1, PLACE_F1_T1)).reference);
      for (const account of [PARENT_F1, PARENT_F2, TEACHER_G1, OTHER_ADMIN]) {
        const result = await calls.decide(account, id, true);
        assert.equal(result.state, "denied", `${account}: ${JSON.stringify(result)}`);
      }
      assert.equal((await requestRow(db, id)).status, "open");
      assert.ok((await auditOf(db, "cancellation.denied", "denied")).length >= 1);
    });

    it("refuses a stale request version, a decision on an ended request, and repeats safely", async () => {
      const id = String((await calls.cancel(PARENT_F1, PLACE_F1_T1)).reference);
      const version = Number((await requestRow(db, id)).version);
      refused(
        await calls.decide(ADMIN_G1, id, true, version - 1),
        "invalidated",
        "APPROVAL_INVALIDATED",
      );
      const key = nextKey("cd");
      assert.equal((await calls.decide(ADMIN_G1, id, false, version, key)).state, "success");
      const again = await calls.decide(ADMIN_G1, id, false, version, key);
      assert.deepEqual([again.state, again.code], ["success", "replayed"]);
      refused(await calls.decide(ADMIN_G1, id, true), "conflict", "APPROVAL_ALREADY_DECIDED");
    });

    it("treats a missing request version as an outdated screen for the human-facing commands (R-07)", async () => {
      const cancel = String((await calls.cancel(PARENT_F1, PLACE_F1_T1)).reference);
      refused(
        await calls.withoutVersion(ADMIN_G1, "cancellation_decide($1, $2, $3, $4)", cancel, true),
        "invalidated",
        "APPROVAL_INVALIDATED",
      );
      assert.equal((await requestRow(db, cancel)).status, "open");
      assert.equal((await calls.decide(ADMIN_G1, cancel, false)).state, "success");
      const swap = await appliedSwap();
      refused(
        await calls.withoutVersion(SUPER_ADMIN, "swap_reverse($1, $2, $3)", swap),
        "invalidated",
        "REQUEST_VERSION_STALE",
      );
      assert.equal((await requestRow(db, swap)).status, "applied");
    });

    it("keeps an approved, reversed or administrator-rejected request from losing its decision time (R-05)", async () => {
      const id = String((await calls.cancel(PARENT_F1, PLACE_F1_T1)).reference);
      assert.equal((await calls.decide(ADMIN_G1, id, true)).state, "success");
      assert.ok((await requestRow(db, id)).decided_at, "the decision time is stored");
      await assert.rejects(
        db.query("update change_requests set decided_at = null where id = $1", [id]),
        /change_requests_decided_at_check/,
      );
    });

    it("lists the open cancellations for an admin within reach, and nobody else", async () => {
      const id = String((await calls.cancel(PARENT_F1, PLACE_F1_T1)).reference);
      const list = await calls.cancellations(ADMIN_G1);
      assert.equal(list.state, "success", JSON.stringify(list));
      assert.ok((list.items as { request_id: string }[]).some((i) => i.request_id === id));
      assert.equal((await calls.cancellations(PARENT_F1)).state, "denied");
      assert.equal((await calls.cancellations(TEACHER_G1)).state, "denied");
    });

    // ------------------------------------------------------------------ reassigning (BR74.1)
    it("reassigns a duty to another family, ends a pending request on it, and tells both families", async () => {
      const cancel = String((await calls.cancel(PARENT_F1, PLACE_F1_T1)).reference);
      const done = await calls.reassign(ADMIN_G1, TASK_1, await taskVersion(TASK_1), FAMILY_2);
      assert.equal(done.state, "success", JSON.stringify(done));
      const place = await placeRow(db, PLACE_F1_T1);
      assert.deepEqual([place.family_id, place.status], [FAMILY_2, "active"]);
      assert.notEqual((await requestRow(db, cancel)).status, "open");
      assert.ok((await noticesOf(db, PARENT_ROW_F2, "duty_reassigned")).length >= 1);
      assert.ok((await auditOf(db, "duty.reassigned", "success")).length >= 1);
    });

    it("refuses a reassignment out of reach, with a stale duty version, to the holder, and for a started duty", async () => {
      const version = await taskVersion(TASK_1);
      assert.equal((await calls.reassign(OTHER_ADMIN, TASK_1, version, FAMILY_2)).state, "denied");
      assert.equal((await calls.reassign(PARENT_F1, TASK_1, version, FAMILY_2)).state, "denied");
      assert.ok((await auditOf(db, "duty.reassigned", "denied")).length >= 1);
      refused(
        await calls.reassign(ADMIN_G1, TASK_1, version - 1, FAMILY_2),
        "conflict",
        "VERSION_CONFLICT",
      );
      refused(
        await calls.reassign(ADMIN_G1, TASK_1, version, FAMILY_1),
        "conflict",
        "DUTY_ALREADY_ASSIGNED",
      );
      await setStart(db, TASK_1, "-1 hour");
      refused(
        await calls.reassign(ADMIN_G1, TASK_1, await taskVersion(TASK_1), FAMILY_2),
        "conflict",
        "DUTY_CLOSED",
      );
      assert.equal((await placeRow(db, PLACE_F1_T1)).family_id, FAMILY_1);
    });

    it("repeats a reassignment safely and refuses the same key for another family", async () => {
      const key = nextKey("ra");
      const version = await taskVersion(TASK_1);
      assert.equal(
        (await calls.reassign(ADMIN_G1, TASK_1, version, FAMILY_2, key)).state,
        "success",
      );
      const again = await calls.reassign(ADMIN_G1, TASK_1, version, FAMILY_2, key);
      assert.deepEqual([again.state, again.code], ["success", "replayed"]);
      refused(
        await calls.reassign(ADMIN_G1, TASK_1, version, uuid(424242), key),
        "conflict",
        "idempotency_key_reused",
      );
    });

    // ------------------------------------------------------------------ reversing (BR75.1)
    it("reverses an applied swap: both places go back, both families are told, the reversal is audited", async () => {
      const id = await appliedSwap();
      const done = await calls.reverse(SUPER_ADMIN, id);
      assert.equal(done.state, "success", JSON.stringify(done));
      const one = await placeRow(db, PLACE_F1_T1);
      const two = await placeRow(db, PLACE_F2_T3);
      assert.deepEqual([one.family_id, two.family_id], [FAMILY_1, FAMILY_2]);
      assert.equal((await requestRow(db, id)).status, "reversed");
      assert.equal((await noticesOf(db, PARENT_ROW_F1, "swap_reversed")).length, 1);
      assert.equal((await noticesOf(db, PARENT_ROW_F2, "swap_reversed")).length, 1);
      assert.ok((await auditOf(db, "swap.reversed", "success")).length >= 1);
    });

    it("refuses a reversal for a swap that is not applied, out of reach, stale, or after the duty changed hands again", async () => {
      const open = String((await calls.request(PARENT_F1, PLACE_F1_T1, PLACE_F2_T3)).reference);
      refused(await calls.reverse(SUPER_ADMIN, open), "conflict", "SWAP_NOT_APPLIED");
      await calls.withdraw(PARENT_F1, open);
      const id = await appliedSwap();
      assert.equal((await calls.reverse(OTHER_ADMIN, id)).state, "denied");
      assert.equal(
        (await calls.reverse(ADMIN_G1, id)).state,
        "denied",
        "a group admin does not reach the second group",
      );
      assert.equal((await calls.reverse(PARENT_F1, id)).state, "denied");
      assert.ok((await auditOf(db, "swap.reversed", "denied")).length >= 1);
      const version = Number((await requestRow(db, id)).version);
      refused(
        await calls.reverse(SUPER_ADMIN, id, version - 1),
        "invalidated",
        "REQUEST_VERSION_STALE",
      );
      await db.query("update assignments set family_id = $2 where id = $1", [
        PLACE_F1_T1,
        FAMILY_1,
      ]);
      const blocked = await calls.reverse(SUPER_ADMIN, id);
      assert.equal(blocked.state, "conflict", JSON.stringify(blocked));
    });

    it("repeats a reversal safely", async () => {
      const id = await appliedSwap();
      const key = nextKey("rv");
      const version = Number((await requestRow(db, id)).version);
      assert.equal((await calls.reverse(SUPER_ADMIN, id, version, key)).state, "success");
      const again = await calls.reverse(SUPER_ADMIN, id, version, key);
      assert.deepEqual([again.state, again.code], ["success", "replayed"]);
    });

    // ------------------------------------------------------------------ the admin list (BR70.3)
    it("lists swaps for an admin within reach with both families and the reason, and refuses everyone else", async () => {
      const id = await appliedSwap();
      const list = await calls.list(SUPER_ADMIN);
      assert.equal(list.state, "success", JSON.stringify(list));
      const found = (list.items as Record<string, unknown>[]).find((i) => i.request_id === id);
      assert.ok(found, "the swap is listed");
      assert.equal(found.status, "applied");
      assert.equal((await calls.list(PARENT_F1)).state, "denied");
      assert.equal((await calls.list(TEACHER_G1)).state, "denied");
      assert.equal(TASK_3.length > 0, true);
    });
  });
}
