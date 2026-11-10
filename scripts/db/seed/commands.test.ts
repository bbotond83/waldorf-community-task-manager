import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { type QueryResult, type SqlClient } from "../common.ts";
import { IDENTITY_QUERY, LOCAL_STACK_JWT_HASH } from "../local-guard.ts";
import { main as resetMain, RESET_HELP, resetSchema } from "../reset.ts";
import { loadServiceKey, knownSecrets, failureLine, SEED_TARGETS_MS } from "../seed-support.ts";
import { main as seedMain, SEED_HELP, seedSchema, type SeedDeps } from "../seed.ts";
import { buildSeedPlan, SEED_PASSWORDS, seedId, type SeedAccountAdmin } from "./index.ts";

const DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const SERVICE_KEY = "service-key-for-tests-0123456789";
const GOOD_IDENTITY = {
  database_name: "postgres",
  supabase_role: true,
  managed: true,
  jwt_hash: LOCAL_STACK_JWT_HASH,
};

type World = {
  identity?: Record<string, unknown>;
  users?: { id: string; email: string }[];
  organizations?: string[];
  failInsert?: Error;
  failTruncate?: boolean;
  functionState?: string;
};

/** A scripted database: it answers by the shape of the statement and records every statement in order. */
function database(world: World = {}) {
  const log: { sql: string; values: unknown[] | undefined }[] = [];
  let ended = 0;
  const client: SqlClient = {
    async query(sql, values): Promise<QueryResult> {
      log.push({ sql, values });
      const rows = (() => {
        if (sql === IDENTITY_QUERY) return [world.identity ?? GOOD_IDENTITY];
        if (sql.startsWith("select id::text as id, lower(email)")) {
          const wanted = new Set((values?.[0] as string[]) ?? []);
          return (world.users ?? []).filter((user) => wanted.has(user.email.toLowerCase()));
        }
        if (sql.startsWith("select id::text as id from organizations")) {
          return (world.organizations ?? []).map((id) => ({ id }));
        }
        if (/^select reminder_run_due_system\(/.test(sql)) {
          return [{ result: { state: world.functionState ?? "success" } }];
        }
        if (sql.startsWith("select tablename from pg_tables")) {
          return [{ tablename: "families" }, { tablename: "parents" }];
        }
        return [];
      })();
      if (sql.startsWith("insert into") && world.failInsert) throw world.failInsert;
      if (sql.startsWith("truncate") && world.failTruncate) throw new Error("truncate failed");
      return { rows: rows as Record<string, unknown>[], rowCount: rows.length };
    },
    async end() {
      ended++;
    },
  };
  return { client, log, ended: () => ended };
}

function fakeAdmin() {
  const created: { id: string; email: string; password: string }[] = [];
  const removed: string[] = [];
  const admin: SeedAccountAdmin = {
    async createUser(input) {
      created.push(input);
      return { ok: true };
    },
    async deleteUser(id) {
      removed.push(id);
      return true;
    },
  };
  return { admin, created, removed };
}

function setup(world: World = {}, environment: Record<string, string | undefined> = {}) {
  const db = database(world);
  const admin = fakeAdmin();
  const lines: string[] = [];
  let connections = 0;
  let clock = 0;
  const deps: SeedDeps = {
    connect: async () => {
      connections++;
      return db.client;
    },
    createAdmin: () => admin.admin,
    readFile: () => undefined,
    environment: {
      DATABASE_URL,
      SUPABASE_URL: "http://127.0.0.1:54321",
      SUPABASE_ANON_KEY: "anon-key-for-tests",
      SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
      ...environment,
    },
    log: (line) => lines.push(line),
    now: () => (clock += 1000),
  };
  return { deps, db, admin, lines, connections: () => connections };
}

const everything = (lines: string[]) => lines.join("\n");
const sqlOf = (log: { sql: string }[]) => log.map((entry) => entry.sql);

describe("db:seed command", () => {
  it("prints its help and touches nothing", async () => {
    const run = setup();
    assert.equal(await seedMain(["--help"], run.deps), 0);
    assert.equal(run.lines[0], SEED_HELP);
    assert.equal(run.connections(), 0);
  });

  it("seeds the small set into the default schema and prints one result line and a timing", async () => {
    const run = setup();
    assert.equal(await seedMain([], run.deps), 0);
    assert.match(
      run.lines[0]!,
      /^SEED ok schema=public set=small groups=6 families=6 parents=12 children=8 accounts=10 events=3 tasks=8 assignments=8 accounts_created=10$/,
    );
    assert.match(run.lines[1]!, /^TIMING seed\(public, small\) \d+\.\d s \(target 60\.0 s: met\)$/);
    assert.equal(run.lines.length, 2);
    assert.equal(run.admin.created.length, 10);
    const statements = sqlOf(run.db.log);
    assert.ok(statements.includes("commit"));
    assert.equal(run.db.ended(), 1);
  });

  it("seeds the 30-family set with --large and compares it with the larger limit", async () => {
    const run = setup();
    assert.equal(await seedMain(["--large"], run.deps), 0);
    assert.match(
      run.lines[0]!,
      /set=large groups=6 families=30 .* accounts=34 .* accounts_created=34$/,
    );
    assert.match(run.lines[1]!, /target 120\.0 s/);
    assert.equal(run.admin.created.length, 34);
  });

  it("seeds the chosen schema: its account addresses and ids carry the schema name", async () => {
    const run = setup();
    assert.equal(await seedMain(["--schema", "worker_2"], run.deps), 0);
    assert.match(run.lines[0]!, /schema=worker_2/);
    for (const account of run.admin.created)
      assert.ok(account.email.startsWith("worker_2."), account.email);
    const plan = buildSeedPlan("worker_2", "small");
    assert.deepEqual(
      run.admin.created.map((account) => account.id).sort(),
      plan.accounts.map((account) => account.id).sort(),
    );
    const organization = run.db.log.find((entry) =>
      entry.sql.startsWith('insert into "organizations"'),
    )!;
    assert.equal(organization.values![0], seedId("worker_2", "organization"));
    assert.ok(sqlOf(run.db.log).includes('set local search_path to "worker_2", pg_catalog'));
  });

  it("creates the accounts before it writes the records, and writes them in one transaction", async () => {
    const run = setup();
    await seedMain([], run.deps);
    const statements = sqlOf(run.db.log);
    assert.ok(
      statements.indexOf("begin") >
        statements.findIndex((sql) => sql.startsWith("select id::text")),
    );
    assert.equal(statements.filter((sql) => sql === "begin").length, 1);
  });

  it("creates nothing again when every account already exists (a second seed)", async () => {
    const plan = buildSeedPlan("public", "small");
    const run = setup({
      users: plan.accounts.map((account) => ({ id: account.id, email: account.email })),
    });
    assert.equal(await seedMain([], run.deps), 0);
    assert.match(run.lines[0]!, /accounts_created=0$/);
    assert.equal(run.admin.created.length, 0);
  });

  it("refuses a bad schema name before it connects", async () => {
    for (const argv of [["--schema", "worker_9"], ["--schema"], ["--schema", "public;drop"]]) {
      const run = setup();
      assert.equal(await seedMain(argv, run.deps), 1);
      assert.match(run.lines[0]!, /^SEED FAILED step=schema /);
      assert.match(run.lines[0]!, /event=seed_failed$/);
      assert.equal(run.connections(), 0);
    }
  });

  it("refuses a hosted-looking database address and a missing setting, and connects to nothing", async () => {
    const hosted = setup(
      {},
      { DATABASE_URL: "postgresql://postgres:pw-for-tests@example.test:5432/postgres" },
    );
    assert.equal(await seedMain([], hosted.deps), 1);
    assert.match(hosted.lines[0]!, /FAILED step=settings/);
    assert.equal(hosted.connections(), 0);
    assert.equal(hosted.admin.created.length, 0);

    const missing = setup({}, { DATABASE_URL: "" });
    assert.equal(await seedMain([], missing.deps), 1);
    assert.match(missing.lines[0]!, /Missing DATABASE_URL/);
    assert.equal(missing.connections(), 0);

    const noKey = setup({}, { SUPABASE_SERVICE_ROLE_KEY: "" });
    assert.equal(await seedMain([], noKey.deps), 1);
    assert.match(noKey.lines[0]!, /Missing SUPABASE_SERVICE_ROLE_KEY/);
    assert.equal(noKey.connections(), 0);
  });

  it("refuses a database that does not identify itself as the local stack, writes nothing and creates no account", async () => {
    const run = setup({ identity: { ...GOOD_IDENTITY, database_name: "production" } });
    assert.equal(await seedMain([], run.deps), 1);
    assert.match(run.lines[0]!, /FAILED step=guard/);
    assert.deepEqual(sqlOf(run.db.log), [IDENTITY_QUERY]);
    assert.equal(run.admin.created.length, 0);
    assert.equal(run.db.ended(), 1);
  });

  it("removes the accounts it created when the records fail, rolls back, and says the step", async () => {
    const run = setup({ failInsert: new Error("duplicate key value violates unique constraint") });
    assert.equal(await seedMain([], run.deps), 1);
    assert.match(run.lines[0]!, /^SEED FAILED step=records schema=public: duplicate key/);
    assert.equal(run.admin.created.length, 10);
    assert.deepEqual(
      [...run.admin.removed].sort(),
      run.admin.created.map((account) => account.id).sort(),
    );
    const statements = sqlOf(run.db.log);
    assert.ok(statements.includes("rollback"));
    assert.ok(!statements.includes("commit"));
  });

  it("reports a user that could not be removed again", async () => {
    const run = setup({ failInsert: new Error("boom") });
    run.deps.createAdmin = () => ({
      async createUser() {
        return { ok: true };
      },
      async deleteUser() {
        return false;
      },
    });
    assert.equal(await seedMain([], run.deps), 1);
    assert.match(run.lines[0]!, /10 new sign-in users could not be removed again/);
  });

  it("never prints a password, the service key or the database password, even when an error carries them", async () => {
    const leak = new Error(
      `failed with ${SEED_PASSWORDS.parent} and ${SERVICE_KEY} at ${DATABASE_URL} and ${SEED_PASSWORDS.super_admin}`,
    );
    const run = setup({ failInsert: leak });
    assert.equal(await seedMain([], run.deps), 1);
    const text = everything(run.lines);
    for (const secret of [...Object.values(SEED_PASSWORDS), SERVICE_KEY, DATABASE_URL]) {
      assert.ok(!text.includes(secret), `output holds a secret: ${secret.slice(0, 4)}...`);
    }
    assert.match(text, /\[redacted\]/);

    const good = setup();
    await seedMain([], good.deps);
    const goodText = everything(good.lines);
    for (const account of buildSeedPlan("public", "small").accounts) {
      assert.ok(!goodText.includes(account.email));
    }
    for (const family of buildSeedPlan("public", "small").families) {
      assert.ok(!goodText.includes(family.name));
    }
  });

  it("reports an unexpected error once, with an event code", async () => {
    const run = setup();
    run.deps.createAdmin = () => {
      throw new Error("something nobody planned for");
    };
    assert.equal(await seedMain([], run.deps), 1);
    assert.equal(run.lines.filter((line) => line.startsWith("SEED ")).length, 1);
    assert.match(
      run.lines[0]!,
      /FAILED step=unexpected: something nobody planned for event=seed_failed$/,
    );
    assert.match(run.lines[1]!, /^TIMING seed \(failed\)/);
  });

  it("returns the counts and the number of accounts created", async () => {
    const run = setup();
    const result = await seedSchema(run.deps, { size: "small" });
    assert.equal(result.schema, "public");
    assert.equal(result.accountsCreated, 10);
    assert.equal(result.counts.families, 6);
    assert.ok(result.durationMs > 0);
  });
});

describe("db:reset command", () => {
  it("prints its help and touches nothing", async () => {
    const run = setup();
    assert.equal(await resetMain(["--help"], run.deps), 0);
    assert.equal(run.lines[0], RESET_HELP);
    assert.equal(run.connections(), 0);
  });

  it("runs the tick function for every organization first, then empties the schema in one transaction", async () => {
    const orgs = ["aaaaaaaa-0000-4000-8000-000000000001", "aaaaaaaa-0000-4000-8000-000000000002"];
    const run = setup({ organizations: orgs });
    assert.equal(await resetMain(["--schema", "worker_1"], run.deps), 0);
    const statements = sqlOf(run.db.log);
    const calls = statements.filter((sql) => /^select reminder_run_due_system\(/.test(sql));
    assert.deepEqual(calls, [
      "select reminder_run_due_system($1::uuid) as result",
      "select reminder_run_due_system($1::uuid) as result",
    ]);
    const functionValues = run.db.log
      .filter((entry) => entry.sql.includes("_system("))
      .map((entry) => entry.values![0]);
    assert.deepEqual(functionValues, [orgs[0], orgs[1]]);
    const begin = statements.indexOf("begin");
    assert.ok(
      begin > statements.lastIndexOf(calls.at(-1)!),
      "functions run before the emptying starts",
    );
    assert.equal(statements.at(-1), "commit");
    assert.match(run.lines[0]!, /^RESET ok schema=worker_1 organizations_processed=2$/);
    assert.match(run.lines[1]!, /^TIMING reset\(worker_1\) \d+\.\d s \(target 30\.0 s: met\)$/);
  });

  it("empties every table, and removes only the schema's own accounts", async () => {
    const run = setup();
    assert.equal(await resetMain(["--schema", "worker_3"], run.deps), 0);
    const truncate = run.db.log.find((entry) => entry.sql.startsWith("truncate"))!;
    assert.match(truncate.sql, /"worker_3"\."families"/);
    assert.match(truncate.sql, /"worker_3"\."parents"/);
    const removal = run.db.log.find((entry) => entry.sql.startsWith("delete from auth.users"))!;
    assert.deepEqual(removal.values, ["worker\\_3.%"]);
    assert.match(removal.sql, /escape/);
  });

  it("asks for --yes before it empties the public schema, and connects to nothing without it", async () => {
    for (const argv of [[], ["--schema", "public"]]) {
      const run = setup();
      assert.equal(await resetMain(argv, run.deps), 1);
      assert.match(run.lines[0]!, /^RESET FAILED step=confirm: This empties the public schema/);
      assert.match(run.lines[0]!, /--yes/);
      assert.equal(run.connections(), 0);
    }
    const confirmed = setup();
    assert.equal(await resetMain(["--schema", "public", "--yes"], confirmed.deps), 0);
    assert.match(confirmed.lines[0]!, /^RESET ok schema=public/);
    // A bad schema is still reported as a bad schema, and the test schemas need no confirmation.
    const bad = setup();
    assert.equal(await resetMain(["--schema", "auth"], bad.deps), 1);
    assert.match(bad.lines[0]!, /FAILED step=schema/);
    const worker = setup();
    assert.equal(await resetMain(["--schema", "worker_2"], worker.deps), 0);
    assert.match(RESET_HELP, /--yes/);
  });

  it("refuses a loopback database with another password for the seed and the reset, changing nothing", async () => {
    const env = { DATABASE_URL: "postgresql://postgres:tunnel-password@127.0.0.1:54322/postgres" };
    const seed = setup({}, env);
    assert.equal(await seedMain([], seed.deps), 1);
    assert.match(seed.lines[0]!, /FAILED step=guard/);
    assert.equal(seed.connections(), 0);
    assert.equal(seed.admin.created.length, 0);
    for (const argv of [["--yes"], ["--schema", "worker_1"]]) {
      const reset = setup({}, env);
      assert.equal(await resetMain(argv, reset.deps), 1);
      assert.match(reset.lines[0]!, /FAILED step=guard/);
      assert.equal(reset.connections(), 0);
      assert.ok(!everything(reset.lines).includes("tunnel-password"));
    }
  });

  it("defaults to the public schema and needs no organization to run", async () => {
    const run = setup();
    assert.equal(await resetMain(["--yes"], run.deps), 0);
    assert.match(run.lines[0]!, /^RESET ok schema=public organizations_processed=0$/);
    assert.equal(sqlOf(run.db.log).filter((sql) => sql.includes("_system(")).length, 0);
    assert.ok(sqlOf(run.db.log).includes('set search_path to "public", pg_catalog'));
  });

  it("stops before it empties anything when a system function does not succeed", async () => {
    const run = setup({
      organizations: ["aaaaaaaa-0000-4000-8000-000000000001"],
      functionState: "denied",
    });
    assert.equal(await resetMain(["--yes"], run.deps), 1);
    assert.match(
      run.lines[0]!,
      /^RESET FAILED step=system-functions: reminder_run_due_system did not succeed \(denied\); nothing was emptied\. event=reset_failed$/,
    );
    assert.ok(!sqlOf(run.db.log).includes("begin"));
    assert.ok(!sqlOf(run.db.log).some((sql) => sql.startsWith("truncate")));
  });

  it("rolls back and never commits when the emptying fails, and names the step", async () => {
    const run = setup({ failTruncate: true });
    assert.equal(await resetMain(["--schema", "worker_4"], run.deps), 1);
    assert.match(
      run.lines[0]!,
      /^RESET FAILED step=empty schema=worker_4: truncate failed event=reset_failed$/,
    );
    const statements = sqlOf(run.db.log);
    assert.ok(statements.includes("rollback"));
    assert.ok(!statements.includes("commit"));
    assert.equal(run.db.ended(), 1);
  });

  it("refuses a database that is not the local stack and a bad schema, changing nothing", async () => {
    const hosted = setup({ identity: { ...GOOD_IDENTITY, supabase_role: false } });
    assert.equal(await resetMain(["--yes"], hosted.deps), 1);
    assert.match(hosted.lines[0]!, /FAILED step=guard/);
    assert.deepEqual(sqlOf(hosted.db.log), [IDENTITY_QUERY]);

    const other = setup();
    assert.equal(await resetMain(["--schema", "auth"], other.deps), 1);
    assert.match(other.lines[0]!, /FAILED step=schema/);
    assert.equal(other.connections(), 0);

    const remote = setup(
      {},
      { DATABASE_URL: "postgresql://postgres:pw-for-tests@10.1.2.3:5432/postgres" },
    );
    assert.equal(await resetMain(["--yes"], remote.deps), 1);
    assert.equal(remote.connections(), 0);
  });

  it("never prints the database password or a seeded password", async () => {
    const run = setup({ failTruncate: true });
    run.db.client.query = async (sql) => {
      if (sql === IDENTITY_QUERY) return { rows: [GOOD_IDENTITY], rowCount: 1 };
      throw new Error(`broken at ${DATABASE_URL} with ${SEED_PASSWORDS.parent}`);
    };
    assert.equal(await resetMain(["--yes"], run.deps), 1);
    const text = everything(run.lines);
    assert.ok(!text.includes(DATABASE_URL));
    assert.ok(!text.includes(SEED_PASSWORDS.parent));
  });

  it("returns the number of organizations processed", async () => {
    const run = setup({ organizations: ["aaaaaaaa-0000-4000-8000-000000000001"] });
    const result = await resetSchema(run.deps, { schema: "worker_2" });
    assert.deepEqual([result.schema, result.organizations], ["worker_2", 1]);
  });
});

describe("seed support", () => {
  it("reads the service key from the environment first and then from the ignored local file", () => {
    assert.equal(
      loadServiceKey({
        environment: { SUPABASE_SERVICE_ROLE_KEY: "from-env" },
        readFile: () => undefined,
      }),
      "from-env",
    );
    assert.equal(
      loadServiceKey({
        environment: {},
        readFile: (path) =>
          path === ".env.service.local" ? "SUPABASE_SERVICE_ROLE_KEY=from-file\n" : undefined,
      }),
      "from-file",
    );
    assert.throws(
      () => loadServiceKey({ environment: {}, readFile: () => undefined }),
      /Missing SUPABASE_SERVICE_ROLE_KEY/,
    );
  });

  it("lists the seeded passwords among the secrets and keeps the limits of the plan", () => {
    assert.ok(knownSecrets(["x"]).includes(SEED_PASSWORDS.parent));
    assert.ok(knownSecrets(["extra-secret"]).includes("extra-secret"));
    assert.deepEqual(SEED_TARGETS_MS, {
      seed: 60_000,
      seedLarge: 120_000,
      reset: 30_000,
      signIn: 5_000,
    });
  });

  it("formats a failure with the command, the step and an event code", () => {
    assert.equal(
      failureLine("RESET", new Error("plain failure"), "empty", []),
      "RESET FAILED step=empty: plain failure event=reset_failed",
    );
  });
});
