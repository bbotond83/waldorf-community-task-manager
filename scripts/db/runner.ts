import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { redactSecrets } from "../../src/runtime/database/redact.ts";
import { type Log, SCHEMA_NAME, type SqlClient, ToolingError } from "./common.ts";

/**
 * Applies the plain SQL files in `supabase/migrations/` to one schema (BR1.2, BR1.5).
 *
 * The same files serve the default schema and every worker schema: the runner sets the session
 * search path to the target schema plus the system catalogue, so unqualified names land in the
 * target schema and `set search_path from current` pins each function to exactly that schema. A file
 * that hard-codes a schema name is refused before anything is applied.
 */
export interface MigrationFile {
  name: string;
  sql: string;
  checksum: string;
}

export const TRACKING_SCHEMA = "migration_runner";

export function checksumOf(sql: string): string {
  return createHash("sha256").update(sql).digest("hex");
}

export function readMigrationFiles(directory: string): MigrationFile[] {
  return readdirSync(directory)
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((name) => {
      const sql = readFileSync(join(directory, name), "utf8");
      return { name, sql, checksum: checksumOf(sql) };
    });
}

function stripSqlComments(sql: string): string {
  return sql.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/--[^\n]*/g, " ");
}

const HARD_CODED_SCHEMA: readonly [RegExp, string][] = [
  [/\b(?:public|worker_\d+)\s*\.\s*[a-z_"]/i, "a qualified name in a fixed schema"],
  [/search_path\s*(?:=|\bto\b)\s*(?!\s*(?:from\s+current|default)\b)/i, "a fixed search path"],
  [/\b(?:schemaname|table_schema|nspname)\s*=\s*'[^']*'/i, "a fixed schema name in a lookup"],
  [/\bcreate\s+schema\b/i, "a schema creation"],
];

/** The first hard-coded schema reference in a file, or undefined when it is schema-neutral. */
export function findHardCodedSchema(sql: string): string | undefined {
  const text = stripSqlComments(sql);
  for (const [pattern, description] of HARD_CODED_SCHEMA) {
    if (pattern.test(text)) return description;
  }
  return undefined;
}

export function assertValidSchemaName(schema: string): void {
  if (!SCHEMA_NAME.test(schema)) {
    throw new ToolingError(
      "schema-name",
      "Schema names are lowercase letters, digits and underscores.",
      {
        schema,
      },
    );
  }
}

const quote = (identifier: string) => `"${identifier.replace(/"/g, '""')}"`;

export interface ApplyOptions {
  client: SqlClient;
  schema: string;
  files: readonly MigrationFile[];
  log: Log;
  now: () => number;
  /**
   * Session settings applied only to a schema that has no applied migration and no table yet.
   * Used for the offline conversion's issuer-baseline guard: on an empty schema there is no data
   * to convert, so there is no baseline to verify.
   */
  freshSchemaSettings?: Readonly<Record<string, string>>;
}

export interface ApplyResult {
  applied: string[];
  upToDate: string[];
  durationMs: number;
}

const TRACKING_LOCK = "select pg_advisory_lock(hashtext('waldorf-migration-runner-tracking'))";
const TRACKING_UNLOCK = "select pg_advisory_unlock(hashtext('waldorf-migration-runner-tracking'))";
// Migrations that change privileges or functions across the whole database must not run while another
// worker's migrations run, or the catalogue can change under them ("cache lookup failed for function").
const APPLY_LOCK = "select pg_advisory_lock(hashtext('waldorf-migration-runner-apply'))";
const APPLY_UNLOCK = "select pg_advisory_unlock(hashtext('waldorf-migration-runner-apply'))";

/** Several workers may start at once; the lock keeps them from creating the tracking table together. */
async function ensureTracking(client: SqlClient): Promise<void> {
  await client.query(TRACKING_LOCK);
  try {
    await client.query(`create schema if not exists ${quote(TRACKING_SCHEMA)}`);
    await client.query(
      `create table if not exists ${quote(TRACKING_SCHEMA)}.applied_migrations (
         schema_name text not null,
         filename text not null,
         checksum text not null,
         applied_at timestamptz not null default now(),
         primary key (schema_name, filename)
       )`,
    );
  } finally {
    await client.query(TRACKING_UNLOCK);
  }
}

export async function applyMigrations(options: ApplyOptions): Promise<ApplyResult> {
  const { client, schema, files, log, now } = options;
  const started = now();
  assertValidSchemaName(schema);
  for (const file of files) {
    const problem = findHardCodedSchema(file.sql);
    if (problem) {
      throw new ToolingError(
        "check-files",
        `The file contains ${problem}; migrations must be schema-neutral.`,
        {
          file: file.name,
          schema,
        },
      );
    }
  }

  await client.query(`create schema if not exists ${quote(schema)}`);
  await ensureTracking(client);
  const tracked = await client.query(
    `select filename, checksum from ${quote(TRACKING_SCHEMA)}.applied_migrations where schema_name = $1`,
    [schema],
  );
  const appliedBefore = new Map(
    tracked.rows.map((row) => [String(row.filename), String(row.checksum)]),
  );
  for (const file of files) {
    const known = appliedBefore.get(file.name);
    if (known !== undefined && known !== file.checksum) {
      throw new ToolingError(
        "check-files",
        "The file changed after it was applied; migrations are forward-only. Reset the schema or add a new file.",
        { file: file.name, schema },
      );
    }
  }

  const result: ApplyResult = { applied: [], upToDate: [], durationMs: 0 };
  const pending = files.filter((file) => !appliedBefore.has(file.name));
  result.upToDate = files.filter((file) => appliedBefore.has(file.name)).map((file) => file.name);

  if (pending.length > 0) {
    const tables = await client.query(
      "select count(*)::int as count from information_schema.tables where table_schema = $1",
      [schema],
    );
    const fresh = appliedBefore.size === 0 && Number(tables.rows[0]?.count ?? 0) === 0;
    await client.query(APPLY_LOCK);
    try {
      await client.query(`select set_config('search_path', $1, false)`, [
        `${quote(schema)}, pg_catalog`,
      ]);
      if (fresh && options.freshSchemaSettings) {
        for (const [name, value] of Object.entries(options.freshSchemaSettings)) {
          await client.query("select set_config($1, $2, false)", [name, value]);
        }
        log(`schema ${schema} is empty: offline-conversion baseline setting applied for this run`);
      }
      for (const file of pending) {
        const fileStarted = now();
        try {
          await client.query(file.sql);
          await client.query(
            `insert into ${quote(TRACKING_SCHEMA)}.applied_migrations (schema_name, filename, checksum) values ($1, $2, $3)`,
            [schema, file.name, file.checksum],
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          throw new ToolingError("apply", redactSecrets(message), { file: file.name, schema });
        }
        result.applied.push(file.name);
        log(`applied ${file.name} to ${schema} (${now() - fileStarted} ms)`);
      }
    } finally {
      // Best effort: a dead connection must not hide the error that is already being thrown.
      try {
        await client.query(APPLY_UNLOCK);
        await client.query("reset search_path");
        if (fresh && options.freshSchemaSettings) {
          for (const name of Object.keys(options.freshSchemaSettings)) {
            await client.query("select set_config($1, '', false)", [name]);
          }
        }
      } catch {
        /* the connection is closed by the caller */
      }
    }
  }
  result.durationMs = now() - started;
  log(
    `migrations for ${schema}: ${result.applied.length} applied, ${result.upToDate.length} already up to date`,
  );
  return result;
}
