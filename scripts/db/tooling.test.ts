import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  describeFailure,
  formatEnvFile,
  formatSeconds,
  loadToolingSettings,
  parseArguments,
  parseEnvFile,
  PUBLIC_ENV_FILE,
  runAsCommand,
  SERVICE_ENV_FILE,
  timingLine,
  ToolingError,
  type SqlClient,
} from "./common.ts";
import {
  defaultMigrateDeps,
  FRESH_SCHEMA_SETTINGS,
  MIGRATE_HELP,
  main as migrateMain,
  type MigrateDeps,
} from "./migrate.ts";
import { IDENTITY_QUERY, LOCAL_STACK_JWT_HASH } from "./local-guard.ts";
import { connectPostgres } from "./postgres.ts";
import { checksumOf, type MigrationFile } from "./runner.ts";
import {
  API_CONFIRM_TIMEOUT_MS,
  bootstrapSql,
  defaultWorkerDeps,
  main as workerMain,
  resetWorkerData,
  setupWorker,
  validateWorkerName,
  WORKER_HELP,
  workerAccountEmail,
  type WorkerDeps,
} from "./worker.ts";

// Fake values only; none of these is a real credential.
const FAKE_KEY = `eyJ${"a".repeat(14)}.${"b".repeat(14)}.${"c".repeat(14)}`;
// Kept out of address literals so the privacy scan does not read them as email addresses.
const AT = "@";
const FAKE_URL = "postgresql://postgres:fake-db-password@127.0.0.1:54322/postgres";
const FILES: Record<string, string> = {
  [PUBLIC_ENV_FILE]: `SUPABASE_URL=http://127.0.0.1:54321\nSUPABASE_ANON_KEY=${FAKE_KEY}\n`,
  [SERVICE_ENV_FILE]: `DATABASE_URL=${FAKE_URL}\n`,
};
// The worker command now runs the local-only guard, so its tests use the Supabase CLI's default local password
// (a public value, the same one the guard tests use) and a fake database that answers the identity query.
const WORKER_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const WORKER_FILES: Record<string, string> = {
  ...FILES,
  [SERVICE_ENV_FILE]: `DATABASE_URL=${WORKER_URL}\n`,
};
const LOCAL_IDENTITY = {
  database_name: "postgres",
  supabase_role: true,
  managed: true,
  jwt_hash: LOCAL_STACK_JWT_HASH,
};
/** Wraps a fake database's reply so that it also answers the guard's identity query. */
const withIdentity =
  (
    next: (
      sql: string,
      values?: unknown[],
    ) => Error | { rows: Record<string, unknown>[] } | undefined,
    identity: Record<string, unknown> = LOCAL_IDENTITY,
  ) =>
  (sql: string, values?: unknown[]) =>
    sql === IDENTITY_QUERY ? { rows: [identity] } : next(sql, values);
const migration = (name: string, sql: string): MigrationFile => ({
  name,
  sql,
  checksum: checksumOf(sql),
});

function fakeSql(
  reply: (
    sql: string,
    values?: unknown[],
  ) => Error | { rows: Record<string, unknown>[] } | undefined = () => undefined,
) {
  const statements: { sql: string; values?: unknown[] }[] = [];
  const state = { ended: false };
  const client: SqlClient = {
    async query(sql, values) {
      statements.push({ sql, values });
      const answer = reply(sql, values);
      if (answer instanceof Error) throw answer;
      return { rows: answer?.rows ?? [], rowCount: answer?.rows.length ?? 0 };
    },
    async end() {
      state.ended = true;
    },
  };
  return { client, statements, state };
}

const trackingRows = (sql: string) => {
  if (sql.includes("applied_migrations where")) return { rows: [] };
  if (sql.includes("information_schema.tables")) return { rows: [{ count: 0 }] };
  if (sql.includes("pg_tables"))
    return { rows: [{ tablename: "audit_events" }, { tablename: "lifecycle_holds" }] };
  return undefined;
};

function migrateDeps(overrides: Partial<MigrateDeps> = {}) {
  const lines: string[] = [];
  let clock = 0;
  const sql = fakeSql(trackingRows);
  const deps: MigrateDeps = {
    connect: async () => sql.client,
    readFiles: () => [migration("20260101_a.sql", "create table a (id int);")],
    readFile: (path) => FILES[path],
    environment: {},
    log: (line) => lines.push(line),
    now: () => (clock += 10),
    migrationsDirectory: "/repo/supabase/migrations",
    ...overrides,
  };
  return { deps, lines, sql };
}

describe("shared tooling helpers", () => {
  it("parses and formats environment files, ignoring comments and quotes", () => {
    const text = formatEnvFile("header", { A: "1", B: "two" });
    assert.deepEqual(parseEnvFile(`${text}# C=3\nD="quoted value"\n`), {
      A: "1",
      B: "two",
      D: "quoted value",
    });
  });

  it("formats seconds and compares a timing with its target", () => {
    assert.equal(formatSeconds(1500), "1.5 s");
    assert.match(timingLine("x", 1000, 2000), /met/);
    assert.match(timingLine("x", 3000, 2000), /MISSED, reported only/);
    assert.equal(timingLine("x", 1000), "TIMING x 1.0 s");
  });

  it("reads settings from the environment before the local files and names what is missing", () => {
    const settings = loadToolingSettings({
      environment: { DATABASE_URL: "postgresql://postgres@127.0.0.1:54322/override" },
      readFile: (path) => FILES[path],
    });
    assert.equal(settings.databaseUrl, "postgresql://postgres@127.0.0.1:54322/override");
    assert.equal(settings.apiUrl, "http://127.0.0.1:54321");
    assert.throws(
      () => loadToolingSettings({ environment: {}, readFile: () => undefined }),
      /DATABASE_URL, SUPABASE_URL, SUPABASE_ANON_KEY/,
    );
  });

  it("refuses a database or API address that is not on this machine", () => {
    const load = (environment: Record<string, string>) =>
      loadToolingSettings({ environment, readFile: (path) => FILES[path] });
    for (const host of ["127.0.0.1", "localhost", "[::1]", "LOCALHOST"]) {
      assert.doesNotThrow(() =>
        load({ DATABASE_URL: `postgresql://postgres@${host}:54322/postgres` }),
      );
    }
    for (const url of [
      `postgresql://postgres${AT}db.example.co:5432/postgres`,
      `postgresql://postgres${AT}10.0.0.5:5432/postgres`,
      `postgresql://postgres${AT}127.0.0.1.evil.example:5432/postgres`,
    ]) {
      assert.throws(() => load({ DATABASE_URL: url }), /DATABASE_URL must point at this machine/);
    }
    assert.throws(
      () => load({ SUPABASE_URL: "https://project.supabase.co" }),
      /SUPABASE_URL must point at this machine/,
    );
    assert.throws(() => load({ DATABASE_URL: "not a url" }), /DATABASE_URL is not a valid address/);
    for (const url of [
      "postgresql://postgres:p@127.0.0.1:54322/postgres?host=evil.example",
      "postgresql://postgres:p@127.0.0.1:54322/postgres?hostaddr=10.0.0.5",
      "postgresql://postgres@127.0.0.1:54322/postgres?",
      `postgresql://postgres${AT}127.0.0.1,evil.example:54322/postgres`,
    ]) {
      assert.throws(
        () => load({ DATABASE_URL: url }),
        /query parameters or several hosts|not a valid address|must point at this machine/,
      );
    }
  });

  it("describes a failure with its step and redacts secrets, also for unexpected errors", () => {
    const named = describeFailure(new ToolingError("apply", `bad ${FAKE_KEY}`, { file: "x.sql" }), [
      FAKE_URL,
    ]);
    assert.equal(named, "FAILED step=apply file=x.sql: bad [redacted]");
    assert.equal(
      describeFailure(new ToolingError("settings", "no detail")),
      "FAILED step=settings: no detail",
    );
    assert.match(
      describeFailure(new Error(`oops ${FAKE_URL}`)),
      /^FAILED step=unexpected: oops postgresql:\/\/postgres:\[redacted\]@/,
    );
    assert.match(describeFailure("plain text"), /plain text/);
  });

  it("runs a command only when the file is started as one", async () => {
    let calls = 0;
    const run = async () => {
      calls++;
      return 3;
    };
    const original = process.exitCode;
    try {
      await runAsCommand({ main: false }, run);
      await runAsCommand({}, run);
      assert.equal(calls, 0);
      await runAsCommand({ main: true }, run);
      assert.equal(calls, 1);
      assert.equal(process.exitCode, 3);
    } finally {
      process.exitCode = original;
    }
  });

  it("splits flags with values, bare flags and positional values", () => {
    const { flags, positional } = parseArguments(["worker_1", "--reset", "--schema", "worker_2"]);
    assert.deepEqual(positional, ["worker_1"]);
    assert.equal(flags.get("reset"), true);
    assert.equal(flags.get("schema"), "worker_2");
  });
});

describe("postgres connection", () => {
  it("returns the connected client", async () => {
    let configured: { connectionString: string; connectionTimeoutMillis: number } | undefined;
    const client = {
      connect: async () => undefined,
      query: async () => ({ rows: [], rowCount: 0 }),
      end: async () => undefined,
    };
    const result = await connectPostgres("postgresql://example", (config) => {
      configured = config;
      return client;
    });
    assert.equal(result, client);
    assert.equal(configured?.connectionString, "postgresql://example");
    assert.equal(configured?.connectionTimeoutMillis, 5000);
  });

  it("reports a failure that is not an Error object as text", async () => {
    await assert.rejects(
      connectPostgres("postgresql://example", () => ({
        connect: async () => {
          throw "plain failure";
        },
        query: async () => ({ rows: [], rowCount: 0 }),
        end: async () => undefined,
      })),
      /plain failure/,
    );
  });

  it("reports a refused connection as a connect failure without the password", async () => {
    await assert.rejects(
      connectPostgres("postgresql://postgres:fake-db-password@127.0.0.1:1/postgres"),
      (error: Error & { step?: string }) => {
        assert.equal(error.step, "connect");
        assert.equal(error.message.includes("fake-db-password"), false);
        return true;
      },
    );
  });
});

describe("default dependencies", () => {
  it("read local files, report a missing file as undefined and point at the migrations folder", async () => {
    const migrate = defaultMigrateDeps();
    assert.equal(migrate.readFile("definitely/not/here.env"), undefined);
    assert.match(
      migrate.readFile("package.json") ?? "",
      /"name": "waldorf-community-task-manager"/,
    );
    assert.ok(migrate.migrationsDirectory.endsWith("supabase/migrations"));
    assert.equal(typeof migrate.now(), "number");
    assert.ok(migrate.readFiles(migrate.migrationsDirectory).length >= 4);
    const worker = defaultWorkerDeps();
    assert.equal(worker.readFile("definitely/not/here.env"), undefined);
    assert.match(worker.readFile("package.json") ?? "", /waldorf-community-task-manager/);
    assert.ok(worker.migrationsDirectory.endsWith("supabase/migrations"));
    await worker.sleep(1);
    assert.equal(typeof worker.now(), "number");
    await assert.rejects(worker.fetch("http://127.0.0.1:1/", { headers: {} }));
    for (const deps of [migrate, worker]) {
      const original = console.log;
      let printed = "";
      console.log = (line: string) => {
        printed = line;
      };
      try {
        deps.log("progress line");
      } finally {
        console.log = original;
      }
      assert.equal(printed, "progress line");
    }
  });
});

describe("migrate command", () => {
  it("applies the files to the default schema with progress lines and a final timing", async () => {
    const fake = migrateDeps();
    assert.equal(await migrateMain([], fake.deps), 0);
    assert.ok(
      fake.lines.some((line) => line.startsWith("[3/3] applying migrations to schema public")),
    );
    assert.ok(
      fake.lines.some((line) => line.startsWith("TIMING migrate(public)") && line.includes("met")),
    );
    assert.equal(fake.sql.state.ended, true);
  });

  it("passes the fresh-schema baseline setting and a chosen schema", async () => {
    const fake = migrateDeps();
    assert.equal(await migrateMain(["--schema", "worker_3"], fake.deps), 0);
    assert.ok(fake.lines.some((line) => line.includes("worker_3")));
    assert.equal(FRESH_SCHEMA_SETTINGS["waldorf.authoritative_issuer_baseline"], "verified-v1");
  });

  it("fails naming the file and never prints keys or the database address", async () => {
    const sql = fakeSql((statement) =>
      statement.startsWith("bad")
        ? new Error(`failed ${FAKE_KEY} ${FAKE_URL}`)
        : trackingRows(statement),
    );
    const fake = migrateDeps({
      connect: async () => sql.client,
      readFiles: () => [migration("20260101_bad.sql", "bad sql;")],
    });
    assert.equal(await migrateMain([], fake.deps), 1);
    const output = fake.lines.join("\n");
    assert.match(output, /MIGRATION FAILED step=apply file=20260101_bad\.sql schema=public/);
    for (const secret of [FAKE_KEY, "fake-db-password", FAKE_URL])
      assert.equal(output.includes(secret), false);
    assert.equal(sql.state.ended, true);
  });

  it("fails clearly when the stack settings are missing, and prints help", async () => {
    const missing = migrateDeps({ readFile: () => undefined });
    assert.equal(await migrateMain([], missing.deps), 1);
    assert.match(missing.lines.join("\n"), /step=settings/);
    const help = migrateDeps();
    assert.equal(await migrateMain(["--help"], help.deps), 0);
    assert.equal(help.lines[0], MIGRATE_HELP);
  });
});

function workerDeps(overrides: Partial<WorkerDeps> & { statuses?: number[] } = {}) {
  const lines: string[] = [];
  let clock = 0;
  const sql = fakeSql(withIdentity(trackingRows));
  const requests: { url: string; headers: Record<string, string> }[] = [];
  const statuses = overrides.statuses ?? [200];
  const deps: WorkerDeps = {
    connect: async () => sql.client,
    readFiles: () => [migration("20260101_a.sql", "create table a (id int);")],
    readFile: (path) => WORKER_FILES[path],
    environment: {},
    log: (line) => lines.push(line),
    now: () => (clock += 100),
    sleep: async () => {
      clock += 250;
    },
    fetch: async (url, init) => {
      requests.push({ url, headers: init.headers });
      return { status: statuses.shift() ?? 200 };
    },
    migrationsDirectory: "/repo/supabase/migrations",
    ...overrides,
  };
  return { deps, lines, sql, requests };
}

describe("worker schema setup", () => {
  it("accepts the four exposed worker names only", () => {
    for (const name of ["worker_1", "worker_2", "worker_3", "worker_4"])
      assert.equal(validateWorkerName(name), name);
    for (const name of [
      undefined,
      "",
      "Worker_1",
      "worker-1",
      "worker 1",
      "1worker",
      "worker_1; drop",
    ]) {
      assert.throws(() => validateWorkerName(name), /lowercase letters, digits and underscores/);
    }
    assert.throws(
      () => validateWorkerName("worker_5"),
      /Only worker_1, worker_2, worker_3, worker_4/,
    );
  });

  it("builds account emails with the worker prefix and bootstrap SQL with the API-role rights", () => {
    assert.equal(workerAccountEmail("worker_2", "parent"), "worker_2.parent@example.test");
    const statements = bootstrapSql("worker_2");
    assert.equal(statements[0], 'create schema if not exists "worker_2"');
    assert.ok(statements.some((statement) => statement.includes("grant usage on schema")));
    assert.equal(
      statements.filter((statement) => statement.includes("alter default privileges")).length,
      3,
    );
  });

  it("creates, migrates, empties and confirms the schema through the data API", async () => {
    const fake = workerDeps();
    const result = await setupWorker(fake.deps, "worker_1", { reset: false });
    assert.equal(result.schema, "worker_1");
    assert.deepEqual(result.applied, ["20260101_a.sql"]);
    assert.equal(fake.requests[0]?.headers["Accept-Profile"], "worker_1");
    assert.equal(fake.requests[0]?.headers.apikey, FAKE_KEY);
    const run = fake.sql.statements.map((entry) => entry.sql);
    assert.ok(
      run.some((statement) =>
        statement.startsWith(
          'truncate table "worker_1"."audit_events", "worker_1"."lifecycle_holds"',
        ),
      ),
    );
    assert.ok(run.some((statement) => statement.includes("delete from auth.users")));
    assert.ok(run.some((statement) => statement.includes("pg_notify('pgrst', 'reload schema')")));
    assert.equal(fake.sql.state.ended, true);
  });

  it("removes only the accounts of this worker by prefix", async () => {
    const fake = fakeSql(trackingRows);
    await resetWorkerData(fake.client, "worker_2");
    const deleteStatement = fake.statements.find((entry) =>
      entry.sql.includes("delete from auth.users"),
    );
    assert.deepEqual(deleteStatement?.values, ["worker\\_2.%"]);
  });

  it("rebuilds the schema and clears its tracking rows on reset", async () => {
    const sql = fakeSql(
      withIdentity((statement) =>
        statement.includes("to_regclass") ? { rows: [{ relation: "x" }] } : trackingRows(statement),
      ),
    );
    const fake = workerDeps({ connect: async () => sql.client });
    await setupWorker(fake.deps, "worker_3", { reset: true });
    const run = sql.statements.map((entry) => entry.sql);
    assert.ok(run.includes('drop schema if exists "worker_3" cascade'));
    assert.ok(
      run.some(
        (statement) =>
          statement.includes("delete from") && statement.includes("applied_migrations"),
      ),
    );
  });

  it("does not touch tracking when the tracking table does not exist yet", async () => {
    const sql = fakeSql(
      withIdentity((statement) =>
        statement.includes("to_regclass")
          ? { rows: [{ relation: null }] }
          : trackingRows(statement),
      ),
    );
    const fake = workerDeps({ connect: async () => sql.client });
    await setupWorker(fake.deps, "worker_3", { reset: true });
    assert.equal(
      sql.statements.some(
        (entry) => entry.sql.startsWith("delete from") && entry.sql.includes("applied_migrations"),
      ),
      false,
    );
  });

  it("waits for the data API and succeeds once it answers", async () => {
    const fake = workerDeps({ statuses: [503, 406, 200] });
    await setupWorker(fake.deps, "worker_1", { reset: false });
    assert.equal(fake.requests.length, 3);
  });

  it("fails naming worker, schema and step when the data API never serves the schema", async () => {
    const fake = workerDeps({ statuses: Array.from({ length: 200 }, () => 406) });
    await assert.rejects(
      setupWorker(fake.deps, "worker_4", { reset: false }),
      (error: Error & { step?: string; detail?: Record<string, string> }) => {
        assert.equal(error.step, "confirm-api");
        assert.equal(error.detail?.worker, "worker_4");
        assert.equal(error.detail?.schema, "worker_4");
        assert.match(error.message, new RegExp(`${API_CONFIRM_TIMEOUT_MS / 1000} seconds`));
        return true;
      },
    );
  });

  it("reports a request that cannot be sent as the reason", async () => {
    const fake = workerDeps({
      fetch: async () => {
        throw new Error(`connect refused ${FAKE_KEY}`);
      },
    });
    await assert.rejects(setupWorker(fake.deps, "worker_1", { reset: false }), (error: Error) => {
      assert.equal(error.message.includes(FAKE_KEY), false);
      assert.match(error.message, /did not serve the schema/);
      return true;
    });
  });

  it("names the migration step and file when a migration fails", async () => {
    const sql = fakeSql(
      withIdentity((statement) =>
        statement.startsWith("bad") ? new Error("broken") : trackingRows(statement),
      ),
    );
    const fake = workerDeps({
      connect: async () => sql.client,
      readFiles: () => [migration("20260101_bad.sql", "bad sql;")],
    });
    await assert.rejects(
      setupWorker(fake.deps, "worker_2", { reset: false }),
      (error: Error & { step?: string; detail?: Record<string, string> }) => {
        assert.equal(error.step, "migrate");
        assert.equal(error.detail?.worker, "worker_2");
        assert.equal(error.detail?.file, "20260101_bad.sql");
        return true;
      },
    );
    assert.equal(sql.state.ended, true);
  });

  it("names the failing step for an unexpected database error and redacts it", async () => {
    const sql = fakeSql(
      withIdentity((statement) =>
        statement.startsWith("drop schema")
          ? new Error(`denied ${WORKER_URL}`)
          : trackingRows(statement),
      ),
    );
    const fake = workerDeps({ connect: async () => sql.client });
    await assert.rejects(
      setupWorker(fake.deps, "worker_1", { reset: true }),
      (error: Error & { step?: string }) => {
        assert.equal(error.step, "reset-schema");
        assert.equal(error.message.includes(WORKER_URL), false);
        assert.equal(error.message.includes("postgres:postgres@"), false);
        return true;
      },
    );
  });

  it("main prints progress and the final timing, a failure line, and help", async () => {
    const ok = workerDeps();
    assert.equal(await workerMain(["worker_1"], ok.deps), 0);
    assert.ok(
      ok.lines.some((line) => line.startsWith("TIMING worker(worker_1)") && line.includes("met")),
    );
    const reset = workerDeps();
    assert.equal(await workerMain(["worker_2", "--reset"], reset.deps), 0);
    const failing = workerDeps();
    assert.equal(await workerMain(["worker_9"], failing.deps), 1);
    assert.match(failing.lines.join("\n"), /WORKER FAILED step=worker-name worker=worker_9/);
    const help = workerDeps();
    assert.equal(await workerMain(["--help"], help.deps), 0);
    assert.equal(help.lines[0], WORKER_HELP);
  });

  it("main output never contains keys or the database address", async () => {
    const sql = fakeSql(
      withIdentity((statement) =>
        statement.startsWith("bad")
          ? new Error(`x ${FAKE_KEY} ${WORKER_URL}`)
          : trackingRows(statement),
      ),
    );
    const fake = workerDeps({
      connect: async () => sql.client,
      readFiles: () => [migration("20260101_bad.sql", "bad sql;")],
    });
    assert.equal(await workerMain(["worker_1"], fake.deps), 1);
    const output = fake.lines.join("\n");
    for (const secret of [FAKE_KEY, WORKER_URL, "postgres:postgres@"])
      assert.equal(output.includes(secret), false);
  });

  // Finding B5 (U1 review R-09): the worker runs the same local-only guard as the seed and the reset.
  describe("local-only guard", () => {
    const CHANGING = /^(drop|create|truncate|delete|alter|grant|insert)\b/i;

    it("refuses a password that is not the local stack's default before any connection is made", async () => {
      let connected = 0;
      const fake = workerDeps({
        connect: async () => {
          connected++;
          throw new Error("must not connect");
        },
        readFile: (path) =>
          path === SERVICE_ENV_FILE
            ? "DATABASE_URL=postgresql://postgres:a-hosted-project-password@127.0.0.1:54322/postgres\n"
            : WORKER_FILES[path],
      });
      await assert.rejects(
        setupWorker(fake.deps, "worker_2", { reset: true }),
        (error: Error & { step?: string; detail?: Record<string, string> }) => {
          assert.equal(error.step, "guard");
          assert.equal(error.detail?.step, "guard");
          assert.match(error.message, /the test workers/);
          assert.equal(error.detail?.worker, "worker_2");
          assert.equal(error.detail?.schema, "worker_2");
          assert.equal(error.message.includes("a-hosted-project-password"), false);
          return true;
        },
      );
      assert.equal(connected, 0);
    });

    it("refuses a database that does not identify itself as the local stack, closes it and changes nothing", async () => {
      const sql = fakeSql(
        withIdentity(trackingRows, { ...LOCAL_IDENTITY, database_name: "hosted" }),
      );
      const fake = workerDeps({ connect: async () => sql.client });
      await assert.rejects(
        setupWorker(fake.deps, "worker_1", { reset: true }),
        (error: Error & { step?: string; detail?: Record<string, string> }) => {
          assert.equal(error.step, "guard");
          assert.equal(error.detail?.step, "guard");
          assert.equal(error.detail?.worker, "worker_1");
          assert.equal(error.detail?.schema, "worker_1");
          assert.match(error.message, /does not identify itself as the local stack/);
          return true;
        },
      );
      assert.equal(sql.state.ended, true);
      assert.deepEqual(
        sql.statements.map((entry) => entry.sql),
        [IDENTITY_QUERY],
        "only the identity read was asked",
      );
      assert.equal(
        sql.statements.some((entry) => CHANGING.test(entry.sql.trim())),
        false,
      );
    });

    it("still sets up a worker schema on a stack that has never been migrated (no tracking table yet)", async () => {
      const sql = fakeSql(withIdentity(trackingRows, { ...LOCAL_IDENTITY, managed: false }));
      const fake = workerDeps({ connect: async () => sql.client });
      const result = await setupWorker(fake.deps, "worker_3", { reset: false });
      assert.equal(result.schema, "worker_3");
      assert.equal(sql.state.ended, true);
    });
  });
});
