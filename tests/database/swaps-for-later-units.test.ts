import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import {
  ADMIN_G1,
  DIRECTORY_SCHEMAS,
  FAMILY_1,
  FAMILY_2,
  openDirectoryDatabase,
  PARENT_F1,
  PARENT_F2,
  SUPER_ADMIN,
  PARENT_ROW_F1,
  PARENT_ROW_F2,
} from "./directory-support.ts";
import { authenticated } from "./identity-support.ts";
import { asActor, failureOf, openDatabase } from "./stack-support.ts";
import {
  noticesOf,
  PLACE_AG1_T2,
  PLACE_F1_T1,
  PLACE_F2_T3,
  placeRow,
  refused,
  requestRow,
  seedSwapWorld,
  setStart,
  swapCalls,
  TASK_1,
  TASK_2,
  TASK_3,
} from "./swaps-support.ts";

/**
 * What U7 hands to later units (C9, C16, C19): the daily swap expiry check and the removal pair. Both are internal, so
 * the tests call them as the schema owner and prove that no signed-in role can.
 */
for (const schema of DIRECTORY_SCHEMAS) {
  describe(`swap expiry and removal in ${schema}`, () => {
    let db: pg.Client;
    let other: pg.Client;
    let calls: ReturnType<typeof swapCalls>;

    before(async () => {
      db = await openDirectoryDatabase(schema);
      other = await openDatabase();
      calls = swapCalls(db, schema);
    });
    after(async () => {
      await other.end();
      await db.end();
    });
    beforeEach(async () => {
      await seedSwapWorld(db, schema);
    });

    const check = async (client: pg.Client, now: string) =>
      (
        await client.query(
          `select ${schema}.dutychanges_swap_expiry_check($1::timestamptz) as result`,
          [now],
        )
      ).rows[0].result as { created: number; skipped: number };

    async function openSwap(): Promise<string> {
      const made = await calls.request(PARENT_F1, PLACE_F1_T1, PLACE_F2_T3);
      assert.equal(made.state, "success", JSON.stringify(made));
      return String(made.reference);
    }

    it("is registered as a daily check after the others", async () => {
      const row = (
        await db.query(
          "select run_kind, is_active, lock_step from timed_check_registry where check_name = 'swap_expiry'",
        )
      ).rows[0];
      assert.deepEqual(row, { run_kind: "daily", is_active: true, lock_step: 4 });
      const maxStep = (await db.query("select max(lock_step) as m from timed_check_registry"))
        .rows[0].m;
      assert.equal(row.lock_step, maxStep, "the swap check runs after the existing ones");
    });

    it("leaves a swap alone just before the earlier duty starts and expires it just after, in both clock-change weeks", async () => {
      for (const start of ["2027-03-28T03:00:00Z", "2027-10-31T01:00:00Z"]) {
        await seedSwapWorld(db, schema);
        for (const task of [TASK_1, TASK_3]) {
          await db.query(
            "update tasks set starts_at = $2, ends_at = $2::timestamptz + interval '2 hours' where id = $1",
            [task, start],
          );
        }
        const id = await openSwap();
        const startMs = new Date(start).getTime();
        const before1 = await check(db, new Date(startMs - 1000).toISOString());
        assert.deepEqual(before1, { created: 0, skipped: 0 }, start);
        assert.equal((await requestRow(db, id)).status, "open");
        const after1 = await check(db, new Date(startMs).toISOString());
        const told = Number(
          (await db.query("select count(*) from notifications where kind = 'swap_expired'")).rows[0]
            .count,
        );
        assert.ok(told >= 2, "each family's parents are told");
        assert.equal(after1.created, told, "every notice written is counted once");
        const row = await requestRow(db, id);
        assert.deepEqual([row.status, row.ended_reason], ["expired", "earlier_duty_started"]);
        assert.deepEqual(
          [(await placeRow(db, PLACE_F1_T1)).status, (await placeRow(db, PLACE_F2_T3)).status],
          ["active", "active"],
        );
      }
    });

    it("expires an open cancellation request when its duty has started: the family keeps the duty and is told", async () => {
      const made = await calls.cancel(PARENT_F1, PLACE_F1_T1);
      const id = String(made.reference);
      await setStart(db, TASK_1, "-1 hour");
      const result = await check(db, new Date().toISOString());
      assert.ok(result.created >= 1);
      const row = await requestRow(db, id);
      assert.deepEqual([row.status, row.ended_reason], ["expired", "duty_started"]);
      const place = await placeRow(db, PLACE_F1_T1);
      assert.deepEqual([place.status, place.family_id], ["active", FAMILY_1]);
      assert.equal((await noticesOf(db, PARENT_ROW_F1, "cancellation_decided")).length, 1);
    });

    it("expires several open requests in one run, locking all their duties and places together (BR77.1)", async () => {
      const swap = await openSwap();
      const cancel = String((await calls.cancel(ADMIN_G1, PLACE_AG1_T2)).reference);
      await setStart(db, TASK_1, "-1 hour");
      await setStart(db, TASK_2, "-1 hour");
      const result = await check(db, new Date().toISOString());
      assert.ok(result.created >= 2, JSON.stringify(result));
      assert.equal((await requestRow(db, swap)).status, "expired");
      assert.equal((await requestRow(db, cancel)).status, "expired");
    });

    it("answers SWAP_EXPIRED and CANCELLATION_EXPIRED to the commands before the check has run", async () => {
      const swap = await openSwap();
      const cancel = String((await calls.cancel(ADMIN_G1, PLACE_AG1_T2)).reference);
      await setStart(db, TASK_1, "-1 hour");
      await setStart(db, TASK_2, "-1 hour");
      refused(await calls.respond(PARENT_F2, swap, true), "conflict", "SWAP_EXPIRED");
      refused(await calls.decide(SUPER_ADMIN, cancel, true), "conflict", "CANCELLATION_EXPIRED");
    });

    it("tells each family once and changes nothing more when it runs twice or twice at once", async () => {
      const id = await openSwap();
      await setStart(db, TASK_1, "-1 hour");
      const now = new Date().toISOString();
      const both = await Promise.all([check(db, now), check(other, now)]);
      const told = Number(
        (await db.query("select count(*) from notifications where kind = 'swap_expired'")).rows[0]
          .count,
      );
      assert.ok(told >= 2);
      assert.equal(both[0].created + both[1].created, told, JSON.stringify(both));
      const again = await check(db, now);
      assert.deepEqual(again, { created: 0, skipped: 0 });
      assert.equal((await noticesOf(db, PARENT_ROW_F2, "swap_expired")).length, 1);
      assert.equal((await noticesOf(db, PARENT_ROW_F1, "swap_expired")).length, 1);
      assert.equal((await requestRow(db, id)).status, "expired");
    });

    it("is callable by no signed-in role", async () => {
      for (const sql of [
        `select dutychanges_swap_expiry_check(now())`,
        `select dutychanges_removal_preview('family', '${FAMILY_1}')`,
        `select dutychanges_removal_apply('family', '${FAMILY_1}')`,
      ]) {
        const failure = await failureOf(() =>
          asActor(db, schema, authenticated(PARENT_F1), () => db.query(sql)),
        );
        assert.equal(failure?.code, "42501", sql);
      }
    });

    it("keeps place_add from every signed-in role and has retired swap_decide (NFR3.4, NFR3.5)", async () => {
      const failure = await failureOf(() =>
        asActor(db, schema, authenticated(PARENT_F1), () =>
          db.query(`select place_add('${TASK_1}', '${FAMILY_1}')`),
        ),
      );
      assert.equal(failure?.code, "42501");
      const gone = await db.query(
        "select count(*)::int as n from pg_proc p join pg_namespace n on n.oid = p.pronamespace where p.proname = 'swap_decide' and n.nspname = $1",
        [schema],
      );
      assert.equal(gone.rows[0].n, 0, "swap_decide no longer exists, so no role can call it");
    });

    // ------------------------------------------------------------------ the removal pair (C16)
    const removal = async (fn: "preview" | "apply", kind: string, id: string) =>
      (await db.query(`select dutychanges_removal_${fn}($1, $2) as result`, [kind, id])).rows[0]
        .result as {
        to_clear: number;
        to_flag: number;
      };

    it("previews counts only and applies: open requests of the removed family are cancelled and the other family told", async () => {
      const base = await removal("preview", "family", FAMILY_1);
      const id = await openSwap();
      const preview = await removal("preview", "family", FAMILY_1);
      assert.deepEqual(Object.keys(preview).sort(), ["to_clear", "to_flag"]);
      assert.deepEqual(preview, { to_clear: base.to_clear + 1, to_flag: base.to_flag + 1 });
      assert.equal((await requestRow(db, id)).status, "open", "a preview changes nothing");
      const done = await removal("apply", "family", FAMILY_1);
      assert.deepEqual(done, preview);
      const row = await requestRow(db, id);
      assert.deepEqual(
        [row.status, row.ended_reason, row.reason],
        ["cancelled", "family_removed", null],
      );
      assert.deepEqual(
        [(await placeRow(db, PLACE_F1_T1)).status, (await placeRow(db, PLACE_F2_T3)).status],
        ["active", "active"],
      );
      assert.equal((await noticesOf(db, PARENT_ROW_F2, "swap_cancelled")).length, 1);
      assert.equal((await noticesOf(db, PARENT_ROW_F1, "swap_cancelled")).length, 0);
      assert.equal(
        Number(
          (await db.query("select count(*) from change_requests where id = $1", [id])).rows[0]
            .count,
        ),
        1,
        "the rows are kept",
      );
      assert.deepEqual(await removal("preview", "family", FAMILY_1), { to_clear: 0, to_flag: 0 });
    });

    it("clears the person fields of a removed parent on ended requests and keeps the rows", async () => {
      const base = await removal("preview", "parent", PARENT_ROW_F1);
      const id = await openSwap();
      await calls.withdraw(PARENT_F1, id);
      assert.equal((await requestRow(db, id)).requested_by_parent_id, PARENT_ROW_F1);
      const preview = await removal("preview", "parent", PARENT_ROW_F1);
      assert.ok(preview.to_clear > base.to_clear && preview.to_flag === 0, JSON.stringify(preview));
      await removal("apply", "parent", PARENT_ROW_F1);
      assert.deepEqual(await removal("preview", "parent", PARENT_ROW_F1), {
        to_clear: 0,
        to_flag: 0,
      });
      assert.equal((await requestRow(db, id)).requested_by_parent_id, null);
      assert.equal((await requestRow(db, id)).status, "withdrawn");
    });

    it("does nothing for a subject with no requests, an unknown kind or an unknown id", async () => {
      const nothing = { to_clear: 0, to_flag: 0 };
      assert.deepEqual(
        await removal("apply", "family", "00000000-0000-4000-8000-00000000dead"),
        nothing,
      );
      assert.deepEqual(await removal("apply", "parent", PARENT_ROW_F2), nothing);
      assert.deepEqual(await removal("preview", "organization", FAMILY_2), nothing);
      assert.deepEqual(await removal("apply", "organization", FAMILY_2), nothing);
    });
  });
}
