import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import {
  callFunction,
  DIRECTORY_SCHEMAS,
  nextKey,
  openDirectoryDatabase,
  PARENT_F1,
  PARENT_F2,
} from "./directory-support.ts";
import { openDatabase } from "./stack-support.ts";
import {
  activePlace,
  dutyVersion,
  PARENT_SIX,
  seedAnimalWorld,
  slotAfter,
} from "./animal-support.ts";

/**
 * Two people at once on the same slot (BR81.3, BR82.5, BR89.1, NFR5): the duty and place locks, taken in one fixed
 * order, let exactly one call win and never leave two active places on a slot. Each call has its own connection.
 */
const RUNS = 12;

for (const schema of DIRECTORY_SCHEMAS) {
  describe(`animal slot races in ${schema}`, () => {
    let db: pg.Client;
    let pool: pg.Client[];
    before(async () => {
      db = await openDirectoryDatabase(schema);
      pool = await Promise.all(Array.from({ length: 3 }, () => openDatabase()));
    });
    after(async () => {
      await Promise.all(pool.map((connection) => connection.end()));
      await db.end();
    });
    beforeEach(() => seedAnimalWorld(db, schema));

    const call = (index: number, account: string, sql: string, values: unknown[]) =>
      callFunction(pool[index]!, schema, account, sql, values);
    const activeCount = async (duty: string) =>
      Number(
        (
          await db.query(
            "select count(*)::int as n from assignments where task_id = $1 and status <> 'removed'",
            [duty],
          )
        ).rows[0].n,
      );

    it("lets exactly one of three families take the same free slot", async () => {
      for (let run = 0; run < RUNS; run += 1) {
        const slot = await slotAfter(db, 3, "morning", run);
        const version = await dutyVersion(db, slot.duty_id);
        const accounts = [PARENT_F1, PARENT_F2, PARENT_SIX];
        const answers = await Promise.all(
          accounts.map((account, index) =>
            call(index, account, "duty_sign_up($1, $2, $3)", [
              nextKey("race"),
              slot.duty_id,
              version,
            ]),
          ),
        );
        assert.equal(
          answers.filter((a) => a.state === "success").length,
          1,
          `run ${run}: ${JSON.stringify(answers)}`,
        );
        assert.equal(await activeCount(slot.duty_id), 1);
      }
    });

    it("lets one of two give-ups of the same place win", async () => {
      for (let run = 0; run < RUNS; run += 1) {
        const slot = await slotAfter(db, 3, "afternoon", run);
        const taken = await call(0, PARENT_F1, "duty_sign_up($1, $2, $3)", [
          nextKey("race"),
          slot.duty_id,
          await dutyVersion(db, slot.duty_id),
        ]);
        assert.equal(taken.state, "success");
        const place = (await activePlace(db, slot.duty_id))!;
        const answers = await Promise.all(
          [0, 1].map((index) =>
            call(index, PARENT_F1, "slot_give_up($1, $2, $3)", [
              nextKey("race"),
              place.id,
              place.version,
            ]),
          ),
        );
        assert.equal(
          answers.filter((a) => a.state === "success").length,
          1,
          `run ${run}: ${JSON.stringify(answers)}`,
        );
        assert.equal(await activeCount(slot.duty_id), 0);
      }
    });

    it("never leaves two active places when a give-up meets a sign-up of another family", async () => {
      for (let run = 0; run < RUNS; run += 1) {
        const slot = await slotAfter(db, 3, "morning", run + 20);
        await call(0, PARENT_F1, "duty_sign_up($1, $2, $3)", [
          nextKey("race"),
          slot.duty_id,
          await dutyVersion(db, slot.duty_id),
        ]);
        const place = (await activePlace(db, slot.duty_id))!;
        const version = await dutyVersion(db, slot.duty_id);
        const answers = await Promise.all([
          call(0, PARENT_F1, "slot_give_up($1, $2, $3)", [
            nextKey("race"),
            place.id,
            place.version,
          ]),
          call(1, PARENT_F2, "duty_sign_up($1, $2, $3)", [nextKey("race"), slot.duty_id, version]),
        ]);
        assert.equal(answers[0]!.state, "success", `run ${run}: ${JSON.stringify(answers)}`);
        assert.ok(
          ["conflict", "invalidated", "success"].includes(answers[1]!.state),
          JSON.stringify(answers),
        );
        assert.ok((await activeCount(slot.duty_id)) <= 1, `run ${run}`);
      }
    });
  });
}
