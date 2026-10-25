import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { QueryResult, SqlClient } from "../common.ts";
import { buildSeedPlan, describePlan, SEED_PASSWORDS } from "./data.ts";
import { insertRows, writeSeedPlan } from "./write.ts";

/** A recording fake database client: it notes every statement with its values, and can fail the nth insert. */
function recorder(failOnInsert?: number) {
  const calls: { sql: string; values: unknown[] }[] = [];
  let inserts = 0;
  const client: SqlClient = {
    async query(sql, values = []): Promise<QueryResult> {
      calls.push({ sql, values });
      if (/^insert into/.test(sql)) {
        inserts++;
        if (failOnInsert === inserts) throw new Error("injected failure");
      }
      return { rows: [], rowCount: 0 };
    },
    async end() {},
  };
  return { client, calls };
}

const tables = (calls: { sql: string }[]) =>
  calls
    .map((call) => /^insert into "([a-z_]+)"/.exec(call.sql)?.[1])
    .filter((name): name is string => name !== undefined);

describe("seed writer", () => {
  const plan = buildSeedPlan("worker_2", "small");

  it("writes inside one transaction, bound to the schema, and commits at the end", async () => {
    const { client, calls } = recorder();
    await writeSeedPlan(client, plan);
    assert.equal(calls[0]!.sql, "begin");
    assert.equal(calls[1]!.sql, 'set local search_path to "worker_2", pg_catalog');
    assert.equal(calls.at(-1)!.sql, "commit");
    assert.equal(calls.filter((call) => call.sql === "commit").length, 1);
    assert.equal(calls.filter((call) => call.sql === "rollback").length, 0);
  });

  it("writes the tables in the order their foreign keys need", async () => {
    const { client, calls } = recorder();
    await writeSeedPlan(client, plan);
    assert.deepEqual(tables(calls), [
      "organizations",
      "school_years",
      "groups",
      "families",
      "group_memberships",
      "accounts",
      "parents",
      "parent_contacts",
      "children",
      "app_role_grants",
      "app_authorization_versions",
      "events",
      "tasks",
      "assignments",
    ]);
  });

  it("skips rows that already exist, so a second seed changes nothing", async () => {
    const { client, calls } = recorder();
    await writeSeedPlan(client, plan);
    for (const call of calls.filter((entry) => /^insert into/.test(entry.sql))) {
      assert.match(call.sql, / on conflict do nothing$/);
    }
  });

  it("sends every value as a parameter: no name, address or password appears in a statement", async () => {
    const { client, calls } = recorder();
    await writeSeedPlan(client, plan);
    const text = calls.map((call) => call.sql).join("\n");
    for (const family of plan.families) assert.ok(!text.includes(family.name));
    for (const account of plan.accounts) assert.ok(!text.includes(account.email));
    for (const password of Object.values(SEED_PASSWORDS)) assert.ok(!text.includes(password));
    for (const call of calls.filter((entry) => /^insert into/.test(entry.sql))) {
      const placeholders = new Set(call.sql.match(/\$\d+/g));
      assert.equal(placeholders.size, call.values.length, call.sql.slice(0, 40));
    }
  });

  it("writes every row of the plan with the plan's ids and counts", async () => {
    const { client, calls } = recorder();
    await writeSeedPlan(client, plan);
    const rowsOf = (table: string) =>
      calls
        .filter((call) => call.sql.startsWith(`insert into "${table}"`))
        .reduce((sum, call) => sum + (call.sql.match(/\), \(/g)?.length ?? 0) + 1, 0);
    const counts = describePlan(plan);
    assert.equal(rowsOf("groups"), counts.groups);
    assert.equal(rowsOf("families"), counts.families);
    assert.equal(rowsOf("parents"), counts.parents);
    assert.equal(rowsOf("parent_contacts"), counts.parents);
    assert.equal(rowsOf("children"), counts.children);
    assert.equal(rowsOf("accounts"), counts.accounts);
    assert.equal(rowsOf("app_role_grants"), counts.accounts);
    assert.equal(rowsOf("events"), counts.events);
    assert.equal(rowsOf("tasks"), counts.tasks);
    assert.equal(rowsOf("assignments"), counts.assignments);
    const familyInsert = calls.find((call) => call.sql.startsWith('insert into "families"'))!;
    assert.ok(familyInsert.values.includes(plan.families[0]!.id));
  });

  it("turns hours into timestamps in the database's own clock", async () => {
    const { client, calls } = recorder();
    await writeSeedPlan(client, plan);
    const tasks = calls.find((call) => call.sql.startsWith('insert into "tasks"'))!;
    assert.match(
      tasks.sql,
      /date_trunc\('day', now\(\)\) \+ make_interval\(hours => \$\d+::integer\)/,
    );
    assert.ok(tasks.values.includes(plan.tasks[0]!.startsAtHours));
  });

  it("rolls back and rethrows when an insert fails midway, and never commits", async () => {
    for (const failAt of [1, 5, 14]) {
      const { client, calls } = recorder(failAt);
      await assert.rejects(() => writeSeedPlan(client, plan), /injected failure/);
      assert.equal(calls.at(-1)!.sql, "rollback", `failure at insert ${failAt}`);
      assert.equal(calls.filter((call) => call.sql === "commit").length, 0);
    }
  });

  it("still reports the original failure when the rollback itself fails", async () => {
    const client: SqlClient = {
      async query(sql) {
        if (sql.startsWith("insert into")) throw new Error("original failure");
        if (sql === "rollback") throw new Error("rollback failure");
        return { rows: [], rowCount: 0 };
      },
      async end() {},
    };
    await assert.rejects(() => writeSeedPlan(client, plan), /original failure/);
  });

  it("writes the 30-family set with the same statements, only with more rows", async () => {
    const small = recorder();
    const large = recorder();
    await writeSeedPlan(small.client, plan);
    await writeSeedPlan(large.client, buildSeedPlan("worker_2", "large"));
    assert.deepEqual(tables(small.calls), tables(large.calls));
    const familyRows = (calls: { sql: string }[]) =>
      calls.find((call) => call.sql.startsWith('insert into "families"'))!.sql.match(/\(\$/g)!
        .length;
    assert.equal(familyRows(small.calls), 6);
    assert.equal(familyRows(large.calls), 30);
  });
});

describe("insertRows", () => {
  it("splits a long list into chunks of 200 rows and numbers the placeholders per statement", async () => {
    const { client, calls } = recorder();
    const rows = Array.from({ length: 450 }, (_, n) => [`id-${n}`, n]);
    await insertRows(client, "things", ["id", "n"], rows);
    assert.equal(calls.length, 3);
    assert.deepEqual(
      calls.map((call) => call.values.length),
      [400, 400, 100],
    );
    assert.match(
      calls[0]!.sql,
      /^insert into "things" \("id", "n"\) values \(\$1, \$2\), \(\$3, \$4\)/,
    );
    assert.match(calls[2]!.sql, /\(\$99, \$100\) on conflict do nothing$/);
  });

  it("sends a missing value as null, applies a column's expression and quotes names", async () => {
    const { client, calls } = recorder();
    await insertRows(
      client,
      'odd"table',
      ["a", { name: "b", sql: (placeholder) => `upper(${placeholder})` }],
      [["x"]],
    );
    assert.equal(
      calls[0]!.sql,
      'insert into "odd""table" ("a", "b") values ($1, upper($2)) on conflict do nothing',
    );
    assert.deepEqual(calls[0]!.values, ["x", null]);
  });

  it("sends nothing for no rows", async () => {
    const { client, calls } = recorder();
    await insertRows(client, "things", ["id"], []);
    assert.equal(calls.length, 0);
  });
});
