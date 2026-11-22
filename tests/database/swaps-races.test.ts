import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import {
  ADMIN_G1,
  callFunction,
  DIRECTORY_SCHEMAS,
  FAMILY_1,
  FAMILY_2,
  nextKey,
  openDirectoryDatabase,
  PARENT_F1,
  PARENT_F2,
  SUPER_ADMIN,
} from "./directory-support.ts";
import { FAMILY_SIX } from "./rota-full-support.ts";
import { openDatabase } from "./stack-support.ts";
import {
  PLACE_F1_T1,
  PLACE_F2_T3,
  placeRow,
  requestRow,
  requestVersion,
  seedSwapWorld,
  TASK_1,
} from "./swaps-support.ts";

/**
 * Two people at once on the same swap or duty (BR77.1, NFR5): the duty and place locks, taken in one fixed order, let
 * exactly one call win and never leave a place stuck as pending without an open request. Each call has its own connection.
 */
const RUNS = 20;

for (const schema of DIRECTORY_SCHEMAS) {
  describe(`swap races in ${schema}`, () => {
    let db: pg.Client;
    let pool: pg.Client[];
    before(async () => {
      db = await openDirectoryDatabase(schema);
      pool = await Promise.all(Array.from({ length: 2 }, () => openDatabase()));
    });
    after(async () => {
      await Promise.all(pool.map((connection) => connection.end()));
      await db.end();
    });
    beforeEach(() => seedSwapWorld(db, schema));

    const call = (index: number, account: string, sql: string, values: unknown[]) =>
      callFunction(pool[index]!, schema, account, sql, values);

    /** No place waits for a request that is not open, and no open request has a place that is not waiting. */
    async function assertConsistent(label: string) {
      const stuck = await db.query(
        "select a.id from assignments a where a.status in ('swap_pending', 'cancellation_pending') and not exists (select 1 from change_requests r where r.status = 'open' and (r.assignment_id = a.id or r.target_assignment_id = a.id))",
      );
      assert.deepEqual(stuck.rows, [], `${label}: a place is stuck`);
      const lost = await db.query(
        "select r.id from change_requests r join assignments a on a.id in (r.assignment_id, r.target_assignment_id) where r.status = 'open' and a.status not in ('swap_pending', 'cancellation_pending')",
      );
      assert.deepEqual(lost.rows, [], `${label}: an open request lost its place`);
    }

    const propose = (
      index: number,
      account: string,
      source: string,
      target: string,
      sv: number,
      tv: number,
    ) =>
      call(index, account, "swap_request($1, $2, $3, $4, $5, 'Ok')", [
        nextKey("race"),
        source,
        sv,
        target,
        tv,
      ]);

    it("lets one of two opposite proposals on the same two places win", async () => {
      for (let run = 0; run < RUNS; run += 1) {
        await seedSwapWorld(db, schema);
        const sv = (await placeRow(db, PLACE_F1_T1)).version;
        const tv = (await placeRow(db, PLACE_F2_T3)).version;
        const answers = await Promise.all([
          propose(0, PARENT_F1, PLACE_F1_T1, PLACE_F2_T3, sv, tv),
          propose(1, PARENT_F2, PLACE_F2_T3, PLACE_F1_T1, tv, sv),
        ]);
        assert.equal(
          answers.filter((a) => a.state === "success").length,
          1,
          `run ${run}: ${JSON.stringify(answers)}`,
        );
        assert.equal(
          Number(
            (await db.query("select count(*) from change_requests where status = 'open'")).rows[0]
              .count,
          ),
          1,
        );
        await assertConsistent(`run ${run}`);
      }
    });

    it("lets one of an acceptance and a withdrawal win", async () => {
      for (let run = 0; run < RUNS; run += 1) {
        await seedSwapWorld(db, schema);
        const made = await propose(
          0,
          PARENT_F1,
          PLACE_F1_T1,
          PLACE_F2_T3,
          (await placeRow(db, PLACE_F1_T1)).version,
          (await placeRow(db, PLACE_F2_T3)).version,
        );
        const id = String(made.reference);
        const answers = await Promise.all([
          call(0, PARENT_F2, "swap_respond($1, $2, true, 1)", [nextKey("race"), id]),
          call(1, PARENT_F1, "swap_withdraw($1, $2)", [nextKey("race"), id]),
        ]);
        assert.equal(
          answers.filter((a) => a.state === "success").length,
          1,
          `run ${run}: ${JSON.stringify(answers)}`,
        );
        const status = String((await requestRow(db, id)).status);
        assert.ok(["applied", "withdrawn"].includes(status), status);
        const owner = (await placeRow(db, PLACE_F1_T1)).family_id;
        assert.equal(owner === FAMILY_2, status === "applied", `run ${run}`);
        await assertConsistent(`run ${run}`);
      }
    });

    it("lets one of an acceptance and an admin reassignment of the same duty win", async () => {
      for (let run = 0; run < RUNS; run += 1) {
        await seedSwapWorld(db, schema);
        const made = await propose(
          0,
          PARENT_F1,
          PLACE_F1_T1,
          PLACE_F2_T3,
          (await placeRow(db, PLACE_F1_T1)).version,
          (await placeRow(db, PLACE_F2_T3)).version,
        );
        const id = String(made.reference);
        const version = (await placeRow(db, PLACE_F1_T1)).version;
        const answers = await Promise.all([
          call(0, PARENT_F2, "swap_respond($1, $2, true, 1)", [nextKey("race"), id]),
          call(1, ADMIN_G1, "duty_reassign($1, $2, $3, $4)", [
            nextKey("race"),
            TASK_1,
            version,
            FAMILY_2,
          ]),
        ]);
        // Whatever the order, every place ends up active with a family and no request is left half done.
        const open = Number(
          (await db.query("select count(*) from change_requests where status = 'open'")).rows[0]
            .count,
        );
        assert.equal(open, 0, `run ${run}: ${JSON.stringify(answers)}`);
        assert.equal((await placeRow(db, PLACE_F1_T1)).status, "active");
        await assertConsistent(`run ${run}`);
      }
    });

    it("lets one of two decisions on the same cancellation win", async () => {
      for (let run = 0; run < RUNS; run += 1) {
        await seedSwapWorld(db, schema);
        const made = await callFunction(
          pool[0]!,
          schema,
          PARENT_F1,
          "cancellation_request($1, $2, $3, 'Beteg')",
          [nextKey("race"), PLACE_F1_T1, (await placeRow(db, PLACE_F1_T1)).version],
        );
        const id = String(made.reference);
        const answers = await Promise.all([
          call(0, ADMIN_G1, "cancellation_decide($1, $2, true, 1)", [nextKey("race"), id]),
          call(1, SUPER_ADMIN, "cancellation_decide($1, $2, false, 1)", [nextKey("race"), id]),
        ]);
        assert.equal(
          answers.filter((a) => a.state === "success").length,
          1,
          `run ${run}: ${JSON.stringify(answers)}`,
        );
        await assertConsistent(`run ${run}`);
      }
    });
    it("lets one of an acceptance and a refusal of the same swap win", async () => {
      for (let run = 0; run < RUNS; run += 1) {
        await seedSwapWorld(db, schema);
        const made = await propose(
          0,
          PARENT_F1,
          PLACE_F1_T1,
          PLACE_F2_T3,
          (await placeRow(db, PLACE_F1_T1)).version,
          (await placeRow(db, PLACE_F2_T3)).version,
        );
        const id = String(made.reference);
        const answers = await Promise.all([
          call(0, PARENT_F2, "swap_respond($1, $2, true, 1)", [nextKey("race"), id]),
          call(1, PARENT_F2, "swap_respond($1, $2, false, 1)", [nextKey("race"), id]),
        ]);
        assert.equal(
          answers.filter((a) => a.state === "success").length,
          1,
          `run ${run}: ${JSON.stringify(answers)}`,
        );
        assert.ok(["applied", "declined"].includes(String((await requestRow(db, id)).status)));
        await assertConsistent(`run ${run}`);
      }
    });

    it("lets one of a cancellation request and a swap request on the same place win", async () => {
      for (let run = 0; run < RUNS; run += 1) {
        await seedSwapWorld(db, schema);
        const sv = (await placeRow(db, PLACE_F1_T1)).version;
        const tv = (await placeRow(db, PLACE_F2_T3)).version;
        const answers = await Promise.all([
          call(0, PARENT_F1, "cancellation_request($1, $2, $3, 'Beteg')", [
            nextKey("race"),
            PLACE_F1_T1,
            sv,
          ]),
          propose(1, PARENT_F2, PLACE_F2_T3, PLACE_F1_T1, tv, sv),
        ]);
        assert.equal(
          answers.filter((a) => a.state === "success").length,
          1,
          `run ${run}: ${JSON.stringify(answers)}`,
        );
        assert.equal(
          Number(
            (await db.query("select count(*) from change_requests where status = 'open'")).rows[0]
              .count,
          ),
          1,
        );
        await assertConsistent(`run ${run}`);
      }
    });

    it("lets one of two reassignments of the same duty win", async () => {
      for (let run = 0; run < RUNS; run += 1) {
        await seedSwapWorld(db, schema);
        const version = (await placeRow(db, PLACE_F1_T1)).version;
        const answers = await Promise.all([
          call(0, ADMIN_G1, "duty_reassign($1, $2, $3, $4)", [
            nextKey("race"),
            TASK_1,
            version,
            FAMILY_2,
          ]),
          call(1, SUPER_ADMIN, "duty_reassign($1, $2, $3, $4)", [
            nextKey("race"),
            TASK_1,
            version,
            FAMILY_SIX,
          ]),
        ]);
        assert.equal(
          answers.filter((a) => a.state === "success").length,
          1,
          `run ${run}: ${JSON.stringify(answers)}`,
        );
        assert.ok(
          answers.some((a) => a.code === "VERSION_CONFLICT"),
          JSON.stringify(answers),
        );
        await assertConsistent(`run ${run}`);
      }
    });

    it("lets one of two reversals of the same applied swap win", async () => {
      for (let run = 0; run < RUNS; run += 1) {
        await seedSwapWorld(db, schema);
        const made = await propose(
          0,
          PARENT_F1,
          PLACE_F1_T1,
          PLACE_F2_T3,
          (await placeRow(db, PLACE_F1_T1)).version,
          (await placeRow(db, PLACE_F2_T3)).version,
        );
        const id = String(made.reference);
        assert.equal(
          (await call(0, PARENT_F2, "swap_respond($1, $2, true, 1)", [nextKey("race"), id])).state,
          "success",
        );
        const appliedVersion = await requestVersion(db, id);
        const answers = await Promise.all([
          call(0, SUPER_ADMIN, "swap_reverse($1, $2, $3)", [nextKey("race"), id, appliedVersion]),
          call(1, SUPER_ADMIN, "swap_reverse($1, $2, $3)", [nextKey("race"), id, appliedVersion]),
        ]);
        assert.equal(
          answers.filter((a) => a.state === "success").length,
          1,
          `run ${run}: ${JSON.stringify(answers)}`,
        );
        assert.equal((await placeRow(db, PLACE_F1_T1)).family_id, FAMILY_1);
        assert.equal(String((await requestRow(db, id)).status), "reversed");
        await assertConsistent(`run ${run}`);
      }
    });
  });
}
