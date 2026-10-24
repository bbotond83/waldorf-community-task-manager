import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import {
  CO_PARENT_F1,
  callFunction,
  DIRECTORY_SCHEMAS,
  FAMILY_1,
  GROUP_1,
  nextKey,
  openDirectoryDatabase,
  ORGANIZATION,
  PARENT_F1,
  seedCoordinationWorld,
  TASK_2,
  uuid,
} from "./directory-support.ts";
import { count } from "./identity-support.ts";
import { ensureAccount, openDatabase, report } from "./stack-support.ts";

const CONTENDERS = 20;
const PLACES = 5;
const RACE_TASK = uuid(8100);

/**
 * Concurrent sign-ups on the real stack, each on its own connection: 20 parallel sign-ups for 5 places end
 * with exactly 5 places and no family twice, and a double click takes one place (NFR3.7, BR31.3).
 */
for (const schema of DIRECTORY_SCHEMAS) {
  describe(`sign-up race in ${schema}`, () => {
    let db: pg.Client;
    const connections: pg.Client[] = [];
    const accounts: string[] = [];

    before(async () => {
      db = await openDirectoryDatabase(schema);
      for (let index = 0; index < CONTENDERS; index += 1) connections.push(await openDatabase());
    });
    after(async () => {
      await Promise.all(connections.map((connection) => connection.end()));
      await db.end();
    });
    beforeEach(async () => {
      await seedCoordinationWorld(db, schema);
      accounts.length = 0;
      await db.query(
        `insert into tasks (id, organization_id, group_id, title, capacity, starts_at, ends_at, location)
         values ($1, $2, $3, 'Versenyfeladat', $4, now() + interval '5 days', now() + interval '5 days 2 hours', 'Terem')`,
        [RACE_TASK, ORGANIZATION, GROUP_1, PLACES],
      );
      for (let index = 0; index < CONTENDERS; index += 1) {
        const account = `bbbbbbbb-0000-4000-8000-0000000002${String(index).padStart(2, "0")}`;
        const family = uuid(8200 + index);
        accounts.push(account);
        await ensureAccount(db, { id: account, organization: ORGANIZATION });
        await db.query(
          "insert into families (id, organization_id, display_name) values ($1, $2, $3)",
          [family, ORGANIZATION, `Verseny család ${index}`],
        );
        await db.query(
          "insert into group_memberships (organization_id, family_id, group_id) values ($1, $2, $3)",
          [ORGANIZATION, family, GROUP_1],
        );
        await db.query(
          "insert into parents (id, organization_id, family_id, display_name, account_id) values ($1, $2, $3, $4, $5)",
          [uuid(8300 + index), ORGANIZATION, family, `Verseny szülő ${index}`, account],
        );
      }
    });

    const callOn = (client: pg.Client, account: string, sql: string, values: unknown[]) =>
      callFunction(client, schema, account, sql, values);

    /** One parent as a person would act: read the page, sign up with the version shown, reload on a stale answer. */
    async function contend(client: pg.Client, account: string) {
      const outcomes: string[] = [];
      for (let attempt = 0; attempt < 60; attempt += 1) {
        const page = await callOn(client, account, "duty_get($1)", [RACE_TASK]);
        const version = (page.item as { version: number }).version;
        const result = await callOn(client, account, "duty_sign_up($1, $2, $3)", [
          nextKey("race"),
          RACE_TASK,
          version,
        ]);
        outcomes.push(result.code ?? result.state);
        if (result.state === "success" || result.state === "conflict") return outcomes;
      }
      throw new Error("no final answer after 60 attempts");
    }

    it(`takes exactly ${PLACES} places for ${CONTENDERS} parallel sign-ups and gives no family two`, async () => {
      const started = performance.now();
      const results = await Promise.all(
        accounts.map((account, index) => contend(connections[index]!, account)),
      );
      const finals = results.map((outcomes) => outcomes[outcomes.length - 1]);
      assert.equal(finals.filter((state) => state === "success").length, PLACES);
      assert.equal(finals.filter((state) => state === "DUTY_FULL").length, CONTENDERS - PLACES);
      assert.equal(
        await count(db, "assignments", `task_id = '${RACE_TASK}' and status <> 'removed'`),
        PLACES,
      );
      const duplicates = await db.query(
        "select family_id from assignments where task_id = $1 and status <> 'removed' group by family_id having count(*) > 1",
        [RACE_TASK],
      );
      assert.equal(duplicates.rowCount, 0, "no family holds two places");
      const task = await db.query("select version, capacity from tasks where id = $1", [RACE_TASK]);
      assert.equal(task.rows[0].version, 1 + PLACES, "each place raised the task version once");
      report(
        `race in ${schema}: ${CONTENDERS} parallel sign-ups for ${PLACES} places settled in ${(performance.now() - started).toFixed(0)} ms, ${results.reduce((sum, outcomes) => sum + outcomes.length - 1, 0)} stale answers retried`,
      );
    });

    it("answers the second of two sign-ups on the same version with a stale version, never a second place", async () => {
      const version = (await callOn(connections[0]!, accounts[0]!, "duty_get($1)", [RACE_TASK]))
        .item as {
        version: number;
      };
      const answers = await Promise.all(
        [0, 1, 2, 3, 4, 5].map((index) =>
          callOn(connections[index]!, accounts[index]!, "duty_sign_up($1, $2, $3)", [
            nextKey("same-version"),
            RACE_TASK,
            version.version,
          ]),
        ),
      );
      assert.equal(answers.filter((answer) => answer.state === "success").length, 1);
      assert.ok(
        answers
          .filter((answer) => answer.state !== "success")
          .every(
            (answer) => answer.state === "invalidated" && answer.code === "DUTY_VERSION_STALE",
          ),
      );
      assert.equal(await count(db, "assignments", `task_id = '${RACE_TASK}'`), 1);
    });

    it("takes one place for a double click, with the same key or with two keys", async () => {
      const key = nextKey("double");
      const same = await Promise.all(
        [0, 1].map((index) =>
          callOn(connections[index]!, accounts[0]!, "duty_sign_up($1, $2, $3)", [
            key,
            RACE_TASK,
            1,
          ]),
        ),
      );
      assert.deepEqual(
        same.map((answer) => answer.state),
        ["success", "success"],
      );
      assert.equal(same.filter((answer) => answer.code === "replayed").length, 1);
      assert.equal(await count(db, "assignments", `task_id = '${RACE_TASK}'`), 1);

      // Two parents of one family, two keys, the same version: one place for the family.
      const family = uuid(8200 + 1);
      await db.query("update parents set family_id = $1 where id = $2", [family, uuid(8300 + 2)]);
      await db.query("delete from assignments where task_id = $1", [RACE_TASK]);
      const version = (await db.query("select version from tasks where id = $1", [RACE_TASK]))
        .rows[0].version as number;
      const both = await Promise.all(
        [1, 2].map((index) =>
          callOn(connections[index]!, accounts[index]!, "duty_sign_up($1, $2, $3)", [
            nextKey("two-keys"),
            RACE_TASK,
            version,
          ]),
        ),
      );
      assert.equal(both.filter((answer) => answer.state === "success").length, 1);
      assert.ok(
        both
          .filter((answer) => answer.state !== "success")
          .every((answer) =>
            ["DUTY_VERSION_STALE", "DUTY_ALREADY_ASSIGNED"].includes(answer.code ?? ""),
          ),
      );
      assert.equal(
        await count(db, "assignments", `family_id = '${family}' and task_id = '${RACE_TASK}'`),
        1,
      );
    });

    it("lets a family with two parents who sign up on a fresh version take one place only", async () => {
      assert.ok(PARENT_F1 && CO_PARENT_F1 && FAMILY_1 && TASK_2);
      const results = await Promise.all(
        [PARENT_F1, CO_PARENT_F1].map(async (account, index) =>
          callOn(connections[index]!, account, "duty_sign_up($1, $2, $3)", [
            nextKey("co"),
            TASK_2,
            1,
          ]),
        ),
      );
      assert.equal(results.filter((answer) => answer.state === "success").length, 1);
      assert.equal(
        await count(db, "assignments", `family_id = '${FAMILY_1}' and task_id = '${TASK_2}'`),
        1,
      );
    });
  });
}
