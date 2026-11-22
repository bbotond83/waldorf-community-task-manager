import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type pg from "pg";
import { DATASET, datasetTask, loadDataset } from "./dataset.ts";
import {
  callFunction,
  DIRECTORY_SCHEMAS,
  nextKey,
  openDirectoryDatabase,
  FAMILY_1,
  FAMILY_2,
  ORGANIZATION,
  PARENT_F1,
  PARENT_F2,
  seedDirectoryWorld,
  SUPER_ADMIN,
} from "./directory-support.ts";
import { report } from "./stack-support.ts";

const TYPICAL = { read: 300, action: 500 } as const;
const CEILING_MS = 1500;
const RUNS = 5;
const HISTORY = 200;

/**
 * Timings of the swap reads, one accepted swap and the daily expiry check on the 150-family data set with 200 ended
 * change requests on top (NFR4.3, NFR4.7): the median of five warm runs after one warm-up is reported against the typical
 * target, and any run above the 1500 ms ceiling fails.
 */
for (const schema of DIRECTORY_SCHEMAS) {
  describe(`swap timings in ${schema}`, () => {
    let db: pg.Client;
    let placeOne = "";
    let placeTwo = "";

    before(async () => {
      db = await openDirectoryDatabase(schema);
      await seedDirectoryWorld(db, schema);
      await loadDataset(db);
      // The data set replaces the world's places: the two families sign up for one dataset task each.
      await db.query("delete from assignments where family_id = any($1)", [[FAMILY_1, FAMILY_2]]);
      for (const [account, task, slot] of [
        [PARENT_F1, datasetTask(0), "one"],
        [PARENT_F2, datasetTask(1), "two"],
      ] as const) {
        const taskVersion = (await db.query("select version from tasks where id = $1", [task]))
          .rows[0].version;
        const signed = await callFunction(db, schema, account, "duty_sign_up($1, $2, $3)", [
          nextKey("su"),
          task,
          taskVersion,
        ]);
        assert.equal(signed.state, "success", JSON.stringify(signed));
        if (slot === "one") placeOne = String(signed.reference);
        else placeTwo = String(signed.reference);
      }
      // 200 ended requests in every ended status, each on its own dataset place and task.
      const ended: [string, string][] = [
        ["approved", ""],
        ["rejected", "administrator_rejected"],
        ["withdrawn", "withdrawn_by_requester"],
        ["expired", "duty_started"],
        ["cancelled", "duty_reassigned"],
      ];
      for (let index = 0; index < HISTORY; index += 1) {
        const [status, reason] = ended[index % ended.length]!;
        await db.query(
          `insert into change_requests (organization_id, assignment_id, kind, status, ended_reason, reason, source_task_id, source_assignment_version, decided_at)
           select $1, a.id, 'cancellation', $2, nullif($3, ''), 'Régi kérelem', a.task_id, a.version,
                  case when $2 = 'approved' or $3 = 'administrator_rejected' then now() end
             from (select id, task_id, version from assignments where source = 'admin_assign' order by id offset $4 limit 1) a`,
          [ORGANIZATION, status, reason, index],
        );
      }
      await db.query("analyze");
    });
    after(async () => {
      await db.end();
    });

    const fn = (account: string, sql: string, values: unknown[] = []) =>
      callFunction(db, schema, account, sql, values);

    /** Median of several runs of one call, in milliseconds; the call returns the time it wants measured. */
    async function timed(
      label: string,
      typical: number,
      work: () => Promise<number>,
    ): Promise<void> {
      await work();
      const times: number[] = [];
      for (let run = 0; run < RUNS; run += 1) times.push(await work());
      times.sort((a, b) => a - b);
      const median = times[Math.floor(RUNS / 2)]!;
      report(
        `${label} in ${schema}: median ${median.toFixed(1)} ms, worst ${times[RUNS - 1]!.toFixed(1)} ms (typical target ${typical} ms, fails above ${CEILING_MS} ms)`,
      );
      assert.ok(times[RUNS - 1]! < CEILING_MS, `${label}: ${times[RUNS - 1]!.toFixed(0)} ms`);
    }
    const whole = (work: () => Promise<unknown>) => async () => {
      const started = performance.now();
      await work();
      return performance.now() - started;
    };
    const version = async (id: string) =>
      (await db.query("select version from assignments where id = $1", [id])).rows[0]
        .version as number;

    it("holds the data set and the history of the stated size", async () => {
      assert.equal(DATASET.families, 150);
      const row = (
        await db.query(
          "select count(*)::int as n from change_requests where reason = 'Régi kérelem'",
        )
      ).rows[0];
      assert.equal(row.n, HISTORY);
    });

    it("reads the partner list, the family's requests and the administrators' lists within the read targets", async () => {
      await timed(
        "swap partner list",
        TYPICAL.read,
        whole(() => fn(PARENT_F1, "swap_candidates($1)", [placeOne])),
      );
      await timed(
        "family requests",
        TYPICAL.read,
        whole(() => fn(PARENT_F1, "swap_incoming()")),
      );
      await timed(
        "administrator swap list",
        TYPICAL.read,
        whole(() => fn(SUPER_ADMIN, "swap_list()")),
      );
      await timed(
        "cancellation list",
        TYPICAL.read,
        whole(() => fn(SUPER_ADMIN, "cancellation_list()")),
      );
    });

    it("accepts a swap within the action target and runs the daily check within its ceiling", async () => {
      await timed("swap acceptance", TYPICAL.action, async () => {
        const made = await fn(PARENT_F1, "swap_request($1, $2, $3, $4, $5, 'Idő')", [
          nextKey("sw"),
          placeOne,
          await version(placeOne),
          placeTwo,
          await version(placeTwo),
        ]);
        assert.equal(made.state, "success", JSON.stringify(made));
        const started = performance.now();
        const done = await fn(PARENT_F2, "swap_respond($1, $2, true, 1)", [
          nextKey("rs"),
          made.reference,
        ]);
        const elapsed = performance.now() - started;
        assert.equal(done.state, "success", JSON.stringify(done));
        // Undo with the administrator's reversal so every run starts from the same places.
        const reversed = await fn(SUPER_ADMIN, "swap_reverse($1, $2, $3)", [
          nextKey("rv"),
          made.reference,
          Number(
            (await db.query("select version from change_requests where id = $1", [made.reference]))
              .rows[0].version,
          ),
        ]);
        assert.equal(reversed.state, "success", JSON.stringify(reversed));
        return elapsed;
      });
      await timed(
        "daily swap expiry check",
        TYPICAL.read,
        whole(() => db.query("select dutychanges_swap_expiry_check(now())")),
      );
    });
  });
}
