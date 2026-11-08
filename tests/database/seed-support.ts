import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { promisify } from "node:util";
import type pg from "pg";
import { escapeLikePattern } from "../../scripts/db/common.ts";
import { connectPostgres } from "../../scripts/db/postgres.ts";
import { createSeedAccountAdmin } from "../../scripts/db/seed/index.ts";
import type { SeedDeps } from "../../scripts/db/seed.ts";
import { createSignInService } from "../../src/identity/service.ts";
import { root, serviceKey, stackSettings } from "./stack-support.ts";

const run = promisify(execFile);

/** Real dependencies for the seed and reset commands (the real stack), with the output captured. */
export function realSeedDeps(overrides: Partial<SeedDeps> = {}): {
  deps: SeedDeps;
  lines: string[];
} {
  const lines: string[] = [];
  const deps: SeedDeps = {
    connect: connectPostgres,
    createAdmin: createSeedAccountAdmin,
    readFile: (path) => {
      try {
        return readFileSync(`${root}${path}`, "utf8");
      } catch {
        return undefined;
      }
    },
    environment: process.env,
    log: (line) => lines.push(line),
    now: () => Date.now(),
    ...overrides,
  };
  return { deps, lines };
}

/**
 * A stable picture of a schema and its sign-in users: every row of every table (reference data included) without the
 * timestamp columns, which differ from run to run, plus the id and address of the schema's own sign-in users. Two seeds
 * of the same schema must give equal dumps (NFR3.18).
 */
export async function dumpSchema(db: pg.Client, schema: string): Promise<Record<string, unknown>> {
  const tables = (
    await db.query("select tablename from pg_tables where schemaname = $1 order by tablename", [
      schema,
    ])
  ).rows.map((row) => String(row.tablename));
  const dump: Record<string, unknown> = {};
  for (const table of tables) {
    const result = await db.query(
      `select coalesce(jsonb_agg(r order by r::text), '[]'::jsonb) as rows
         from (select coalesce((select jsonb_object_agg(e.key, e.value) from jsonb_each(to_jsonb(t)) e where e.key !~ '_at$'), '{}'::jsonb) as r
                 from "${schema}"."${table}" t) as s`,
    );
    dump[table] = result.rows[0].rows;
  }
  dump["auth.users"] = await schemaUsers(db, schema);
  return dump;
}

/** The sign-in users whose address starts with the schema's prefix. */
export async function schemaUsers(db: pg.Client, schema: string): Promise<unknown[]> {
  return (
    await db.query(
      "select id::text as id, lower(email) as email from auth.users where lower(email) like $1 escape '\\' order by email",
      [`${escapeLikePattern(schema)}.%`],
    )
  ).rows;
}

/** Rows in one table of a schema. */
export async function rowCount(db: pg.Client, schema: string, table: string): Promise<number> {
  return (await db.query(`select count(*)::int as n from "${schema}"."${table}"`)).rows[0].n;
}

/** A real sign-in through the sign-in service, as a person would; returns the access token or undefined. */
export async function signInAs(email: string, password: string) {
  const settings = stackSettings();
  const service = createSignInService({ url: settings.apiUrl, publicKey: settings.publicKey });
  return service.passwordSignIn(email, password);
}

/** Rows of a table as a signed-in person sees them through the data API (their own token and the schema profile). */
export async function readAs(
  token: string,
  schema: string,
  table: string,
): Promise<{ status: number; rows: unknown[] }> {
  const settings = stackSettings();
  const response = await fetch(`${settings.apiUrl.replace(/\/$/, "")}/rest/v1/${table}?select=id`, {
    headers: {
      apikey: settings.publicKey,
      Authorization: `Bearer ${token}`,
      "Accept-Profile": schema,
    },
  });
  const body = (await response.json().catch(() => [])) as unknown;
  return { status: response.status, rows: Array.isArray(body) ? body : [] };
}

/** Runs a script as its own process (the way `npm run` does) and returns its exit code and everything it printed. */
export async function runScript(
  script: string,
  args: readonly string[],
): Promise<{ status: number; output: string }> {
  try {
    const result = await run(process.execPath, ["--experimental-strip-types", script, ...args], {
      cwd: root,
      env: process.env,
      maxBuffer: 16 * 1024 * 1024,
    });
    return { status: 0, output: `${result.stdout}${result.stderr}` };
  } catch (error) {
    const failure = error as { code?: number; stdout?: string; stderr?: string };
    return { status: failure.code ?? 1, output: `${failure.stdout ?? ""}${failure.stderr ?? ""}` };
  }
}

/** Values that must never appear in any command output: passwords, keys, the database password. */
export function forbiddenInOutput(extra: readonly string[] = []): string[] {
  const url = new URL(stackSettings().databaseUrl);
  return [
    serviceKey(),
    stackSettings().publicKey,
    decodeURIComponent(url.password),
    ...extra,
  ].filter((value) => value.length >= 6);
}
