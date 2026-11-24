import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import { DIRECTORY_SCHEMAS, nextKey, openDirectoryDatabase } from "./directory-support.ts";
import {
  caller,
  checklistOf,
  GROUP_EVENT,
  idsOf,
  rowsOf,
  seedEventWorld,
  seedSampleChecklist,
} from "./checklist-support.ts";
import { openDatabase } from "./stack-support.ts";
import { ADMIN_G1, ADMIN_G2, PARENT_F1, PARENT_F2 } from "./working-groups-support.ts";

/**
 * Two people at once on a checklist (NFR3, NFR5): the event and task locks decide who passes, never a client-side queue.
 * Each run uses its own connections.
 */
const RUNS = 10;

for (const schema of DIRECTORY_SCHEMAS) {
  describe(`checklist races in ${schema}`, () => {
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

    const run = (index: number, account: string, fn: string, args: unknown[]) =>
      caller(() => pool[index]!, schema)(account, fn, args);
    const states = (answers: { state: string }[]) => answers.map((answer) => answer.state).sort();

    it("never lets three families take the two places of one task: two succeed, one is told it is taken", async () => {
      for (let round = 0; round < RUNS; round += 1) {
        await db.query("truncate checklist_claims");
        const task = (await idsOf(db, GROUP_EVENT)).task("Székek bevitele");
        const answers = await Promise.all(
          [PARENT_F1, PARENT_F2, ADMIN_G2].map((account, index) =>
            run(index, account, "checklist_claim($1, $2, null, null)", [
              nextKey(`r${round}`),
              task,
            ]),
          ),
        );
        assert.deepEqual(states(answers), ["conflict", "success", "success"], `round ${round}`);
        assert.equal(answers.find((answer) => answer.state === "conflict")!.code, "TASK_TAKEN");
        assert.equal((await rowsOf(db, "checklist_claims")).length, 2);
      }
    });

    it("lets the same parent's double click through once: one claim, the other answers ALREADY_CLAIMED", async () => {
      for (let round = 0; round < RUNS; round += 1) {
        await db.query("truncate checklist_claims");
        const task = (await idsOf(db, GROUP_EVENT)).task("Székek bevitele");
        const answers = await Promise.all(
          [0, 1].map((index) =>
            run(index, PARENT_F1, "checklist_claim($1, $2, null, null)", [
              nextKey(`d${round}`),
              task,
            ]),
          ),
        );
        assert.deepEqual(states(answers), ["conflict", "success"], `round ${round}`);
        assert.equal((await rowsOf(db, "checklist_claims")).length, 1);
      }
    });

    it("a claim racing the done mark of the same task leaves one consistent answer: claimed and then done, or done first and refused", async () => {
      for (let round = 0; round < RUNS; round += 1) {
        await db.query("truncate checklist_claims");
        await db.query("update event_checklist_tasks set done_at = null, done_by_parent_id = null");
        const task = (await idsOf(db, GROUP_EVENT)).task("Nyári virágok");
        const [claimed, marked] = await Promise.all([
          run(0, PARENT_F1, "checklist_claim($1, $2, null, null)", [nextKey(`c${round}`), task]),
          run(1, ADMIN_G1, "checklist_task_mark_done($1, $2, 1)", [nextKey(`m${round}`), task]),
        ]);
        assert.equal(marked.state === "success" || marked.state === "conflict", true);
        const doneRows = await rowsOf(
          db,
          "event_checklist_tasks",
          "id = $1 and done_at is not null",
          [task],
        );
        const claimRows = await rowsOf(db, "checklist_claims");
        if (marked.state === "success") {
          assert.equal(doneRows.length, 1, `round ${round}`);
          assert.equal(claimed.state === "success" || claimed.code === "TASK_DONE", true);
        } else {
          assert.equal(doneRows.length, 0);
          assert.equal(claimed.state, "success");
          assert.equal(claimRows.length, 1);
        }
      }
    });

    it("a claim racing a section removal leaves no orphan claim: it either lands before the removal and goes with it, or is refused", async () => {
      for (let round = 0; round < RUNS; round += 1) {
        await seedEventWorld(db, schema);
        await db.query("delete from checklist_templates");
        await seedSampleChecklist(
          caller(() => db, schema),
          ADMIN_G1,
          GROUP_EVENT,
          true,
          db,
        );
        const all = await idsOf(db, GROUP_EVENT);
        const version = (
          await checklistOf(
            caller(() => db, schema),
            ADMIN_G1,
            GROUP_EVENT,
          )
        ).item.checklist_version;
        const [claimed, removed] = await Promise.all([
          run(0, PARENT_F1, "checklist_claim($1, $2, null, null)", [
            nextKey(`s${round}`),
            all.task("Székek bevitele"),
          ]),
          run(1, ADMIN_G1, "checklist_section_remove($1, $2, $3)", [
            nextKey(`x${round}`),
            all.section("Szülők"),
            version,
          ]),
        ]);
        assert.equal(removed.state, "success", `round ${round}`);
        assert.equal(
          claimed.state === "success" ||
            claimed.state === "conflict" ||
            claimed.state === "validation" ||
            claimed.state === "denied",
          true,
        );
        const orphans = await db.query(
          "select count(*)::int as n from checklist_claims c where not exists (select 1 from event_checklist_tasks t where t.id = c.task_id)",
        );
        assert.equal(orphans.rows[0].n, 0, `round ${round}`);
      }
    });

    it("two team edits at one checklist version leave one winner", async () => {
      for (let round = 0; round < RUNS; round += 1) {
        const all = await idsOf(db, GROUP_EVENT);
        const version = (
          await checklistOf(
            caller(() => db, schema),
            ADMIN_G1,
            GROUP_EVENT,
          )
        ).item.checklist_version;
        const answers = await Promise.all(
          [0, 1].map((index) =>
            run(index, ADMIN_G1, "checklist_task_save($1, $2, $3, $4::jsonb)", [
              nextKey(`e${round}`),
              GROUP_EVENT,
              version,
              JSON.stringify({ section_id: all.section("Szülők"), title: `Új ${round}-${index}` }),
            ]),
          ),
        );
        assert.deepEqual(states(answers), ["conflict", "success"], `round ${round}`);
      }
    });
  });
}
