import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { redactSecrets } from "../../src/runtime/database/redact.ts";
import {
  describeFailure,
  escapeLikePattern,
  loadToolingSettings,
  type Log,
  parseArguments,
  runAsCommand,
  type SqlClient,
  TARGETS_MS,
  timingLine,
  ToolingError,
  type ToolingSettings,
  WORKER_SCHEMAS,
} from "./common.ts";
import { connectLocalStack } from "./local-guard.ts";
import { FRESH_SCHEMA_SETTINGS } from "./migrate.ts";
import { connectPostgres } from "./postgres.ts";
import {
  applyMigrations,
  type MigrationFile,
  readMigrationFiles,
  TRACKING_SCHEMA,
} from "./runner.ts";

/**
 * Per-worker schemas for parallel test runs (BR10.1, BR10.3, FR10.2).
 *
 * Each worker owns one schema (`worker_1` to `worker_4`, all named in `[api] schemas` of
 * supabase/config.toml, so the data API serves them without a runtime change). Setup creates or
 * resets the schema, applies every migration, removes the worker's accounts by name prefix and
 * confirms through the data API that the schema is served.
 */
export const WORKER_HELP = `Usage: npm run db:worker -- <worker_1|worker_2|worker_3|worker_4> [--reset]

Prepares one test worker's schema on the local stack: creates it when missing, applies all
migrations, empties its tables, removes the worker's accounts (emails starting "<worker>.") and
confirms the data API serves the schema within 10 seconds.

  --reset   drop the schema first and rebuild it from the migrations
  --help    show this text`;

export const API_CONFIRM_TIMEOUT_MS = TARGETS_MS.worker;

const WORKER_NAME = /^[a-z][a-z0-9_]*$/;

/** Returns the schema for a worker name, or stops naming the rule that was broken. */
export function validateWorkerName(name: string | undefined): string {
  if (!name || !WORKER_NAME.test(name)) {
    throw new ToolingError(
      "worker-name",
      "Worker names use lowercase letters, digits and underscores only.",
      { worker: name ?? "" },
    );
  }
  if (!(WORKER_SCHEMAS as readonly string[]).includes(name)) {
    throw new ToolingError(
      "worker-name",
      `Only ${WORKER_SCHEMAS.join(", ")} are served by the data API (see supabase/config.toml); at most four workers run at once.`,
      { worker: name },
    );
  }
  return name;
}

/** Email of an account that belongs to a worker; the reset removes every account with this prefix. */
export function workerAccountEmail(worker: string, tag: string): string {
  return `${worker}.${tag}@example.test`;
}

const quote = (identifier: string) => `"${identifier.replace(/"/g, '""')}"`;

/** The same rights `public` has for the API roles, set through default privileges (see roles.sql). */
export function bootstrapSql(schema: string): string[] {
  const id = quote(schema);
  return [
    `create schema if not exists ${id}`,
    `grant usage on schema ${id} to anon, authenticated, service_role`,
    `alter default privileges for role postgres in schema ${id} grant all on tables to anon, authenticated, service_role`,
    `alter default privileges for role postgres in schema ${id} grant all on sequences to anon, authenticated, service_role`,
    `alter default privileges for role postgres in schema ${id} grant execute on functions to anon, authenticated, service_role`,
  ];
}

export interface WorkerDeps {
  connect: (url: string) => Promise<SqlClient>;
  readFiles: (directory: string) => MigrationFile[];
  readFile: (path: string) => string | undefined;
  environment: Readonly<Record<string, string | undefined>>;
  log: Log;
  now: () => number;
  sleep: (milliseconds: number) => Promise<void>;
  fetch: (url: string, init: { headers: Record<string, string> }) => Promise<{ status: number }>;
  migrationsDirectory: string;
}

export function defaultWorkerDeps(): WorkerDeps {
  return {
    connect: connectPostgres,
    readFiles: readMigrationFiles,
    readFile: (path) => {
      try {
        return readFileSync(path, "utf8");
      } catch {
        return undefined;
      }
    },
    environment: process.env,
    log: (line) => console.log(line),
    now: () => Date.now(),
    sleep: (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
    fetch: (url, init) => fetch(url, init),
    migrationsDirectory: fileURLToPath(new URL("../../supabase/migrations", import.meta.url)),
  };
}

export interface WorkerSetupResult {
  schema: string;
  applied: string[];
  durationMs: number;
}

/** Empties every table of the worker schema and removes the worker's accounts. */
export async function resetWorkerData(client: SqlClient, worker: string): Promise<void> {
  const tables = await client.query(
    "select tablename from pg_tables where schemaname = $1 order by tablename",
    [worker],
  );
  if (tables.rows.length > 0) {
    const list = tables.rows
      .map((row) => `${quote(worker)}.${quote(String(row.tablename))}`)
      .join(", ");
    await client.query(`truncate table ${list} restart identity cascade`);
  }
  await client.query("delete from auth.users where email like $1 escape '\\'", [
    `${escapeLikePattern(worker)}.%`,
  ]);
}

async function confirmDataApi(
  deps: WorkerDeps,
  settings: ToolingSettings,
  schema: string,
): Promise<void> {
  const started = deps.now();
  const url = `${settings.apiUrl.replace(/\/$/, "")}/rest/v1/app_role_grants?select=id&limit=1`;
  const headers = { apikey: settings.publicKey, "Accept-Profile": schema };
  let lastStatus = "no response";
  while (deps.now() - started <= API_CONFIRM_TIMEOUT_MS) {
    try {
      const response = await deps.fetch(url, { headers });
      if (response.status === 200) return;
      lastStatus = `status ${response.status}`;
    } catch (error) {
      lastStatus = error instanceof Error ? redactSecrets(error.message) : "request failed";
    }
    await deps.sleep(250);
  }
  throw new ToolingError(
    "confirm-api",
    `The data API did not serve the schema within ${API_CONFIRM_TIMEOUT_MS / 1000} seconds (${lastStatus}).`,
    { schema },
  );
}

/** Creates or resets a worker schema and confirms the data API serves it. */
export async function setupWorker(
  deps: WorkerDeps,
  name: string | undefined,
  options: { reset: boolean },
): Promise<WorkerSetupResult> {
  const started = deps.now();
  const schema = validateWorkerName(name);
  const settings = loadToolingSettings(deps);
  let client: SqlClient | undefined;
  let step = "connect";
  const wrap = (error: unknown): ToolingError => {
    if (error instanceof ToolingError) {
      // While connecting, the error knows best which step failed (the guard or the connection itself).
      const reported = step === "connect" ? error.step : step;
      return new ToolingError(reported, error.message, {
        ...error.detail,
        worker: schema,
        schema,
        step: reported,
      });
    }
    const message = error instanceof Error ? error.message : String(error);
    return new ToolingError(step, redactSecrets(message, [settings.databaseUrl]), {
      worker: schema,
      schema,
      step,
    });
  };
  try {
    deps.log(`[1/5] connecting (worker ${schema})`);
    // The same local-only guard as the seed and the reset: a loopback address, the CLI's default local password,
    // and a database that identifies itself as the local stack, so a hosted database reached through a tunnel is
    // never touched. The tracking table is not required: the worker is one of the tools that creates it.
    client = await connectLocalStack(settings, deps.connect, { requireManaged: false });

    step = options.reset ? "reset-schema" : "create-schema";
    deps.log(`[2/5] ${options.reset ? "rebuilding" : "creating if missing"} schema ${schema}`);
    if (options.reset) {
      await client.query(`drop schema if exists ${quote(schema)} cascade`);
      await client.query(`create schema if not exists ${quote(TRACKING_SCHEMA)}`);
      const tracking = await client.query("select to_regclass($1) as relation", [
        `${TRACKING_SCHEMA}.applied_migrations`,
      ]);
      if (tracking.rows[0]?.relation) {
        await client.query(
          `delete from ${quote(TRACKING_SCHEMA)}.applied_migrations where schema_name = $1`,
          [schema],
        );
      }
    }
    for (const statement of bootstrapSql(schema)) await client.query(statement);

    step = "migrate";
    deps.log("[3/5] applying migrations");
    const applied = await applyMigrations({
      client,
      schema,
      files: deps.readFiles(deps.migrationsDirectory),
      log: deps.log,
      now: deps.now,
      freshSchemaSettings: FRESH_SCHEMA_SETTINGS,
    });

    step = "reset-data";
    deps.log("[4/5] emptying the schema and removing the worker's accounts");
    await resetWorkerData(client, schema);

    step = "confirm-api";
    deps.log("[5/5] confirming the data API serves the schema");
    await client.query("select pg_notify('pgrst', 'reload schema')");
    await confirmDataApi(deps, settings, schema);

    return { schema, applied: applied.applied, durationMs: deps.now() - started };
  } catch (error) {
    throw wrap(error);
  } finally {
    await client?.end();
  }
}

export async function main(
  argv: readonly string[],
  deps: WorkerDeps = defaultWorkerDeps(),
): Promise<number> {
  const { flags, positional } = parseArguments(argv);
  if (flags.has("help")) {
    deps.log(WORKER_HELP);
    return 0;
  }
  const started = deps.now();
  try {
    const result = await setupWorker(deps, positional[0], { reset: flags.has("reset") });
    deps.log(timingLine(`worker(${result.schema})`, result.durationMs, TARGETS_MS.worker));
    return 0;
  } catch (error) {
    deps.log(`WORKER ${describeFailure(error)}`);
    deps.log(timingLine("worker (failed)", deps.now() - started));
    return 1;
  }
}

await runAsCommand(import.meta, () => main(process.argv.slice(2)));
