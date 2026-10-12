import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_SCHEMA,
  describeFailure,
  loadToolingSettings,
  parseArguments,
  runAsCommand,
  type Log,
  type SqlClient,
  TARGETS_MS,
  timingLine,
} from "./common.ts";
import { connectPostgres } from "./postgres.ts";
import { applyMigrations, type MigrationFile, readMigrationFiles } from "./runner.ts";

export const MIGRATE_HELP = `Usage: npm run db:migrate [-- --schema <name>]

Applies the files in supabase/migrations/ to one schema of the local stack (default: public),
in file-name order. Files already applied are skipped; a file that changed after it was applied
stops the run. Needs the stack from "npm run db:start".

  --schema <name>   target schema (lowercase letters, digits, underscores)
  --help            show this text`;

/** The offline conversion refuses to run without this baseline; an empty schema has no data to convert. */
export const FRESH_SCHEMA_SETTINGS = { "waldorf.authoritative_issuer_baseline": "verified-v1" };

export interface MigrateDeps {
  connect: (url: string) => Promise<SqlClient>;
  readFiles: (directory: string) => MigrationFile[];
  readFile: (path: string) => string | undefined;
  environment: Readonly<Record<string, string | undefined>>;
  log: Log;
  now: () => number;
  migrationsDirectory: string;
}

export function defaultMigrateDeps(): MigrateDeps {
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
    migrationsDirectory: fileURLToPath(new URL("../../supabase/migrations", import.meta.url)),
  };
}

export async function main(
  argv: readonly string[],
  deps: MigrateDeps = defaultMigrateDeps(),
): Promise<number> {
  const { flags } = parseArguments(argv);
  if (flags.has("help")) {
    deps.log(MIGRATE_HELP);
    return 0;
  }
  const started = deps.now();
  let client: SqlClient | undefined;
  let secrets: string[] = [];
  try {
    const schemaFlag = flags.get("schema");
    const schema = typeof schemaFlag === "string" ? schemaFlag : DEFAULT_SCHEMA;
    deps.log("[1/3] reading settings");
    const settings = loadToolingSettings(deps);
    secrets = [settings.publicKey, settings.databaseUrl];
    deps.log("[2/3] connecting to the local database");
    client = await deps.connect(settings.databaseUrl);
    deps.log(`[3/3] applying migrations to schema ${schema}`);
    const result = await applyMigrations({
      client,
      schema,
      files: deps.readFiles(deps.migrationsDirectory),
      log: deps.log,
      now: deps.now,
      freshSchemaSettings: FRESH_SCHEMA_SETTINGS,
    });
    deps.log(timingLine(`migrate(${schema})`, result.durationMs, TARGETS_MS.migrate));
    return 0;
  } catch (error) {
    deps.log(`MIGRATION ${describeFailure(error, secrets)}`);
    deps.log(timingLine("migrate (failed)", deps.now() - started));
    return 1;
  } finally {
    await client?.end();
  }
}

await runAsCommand(import.meta, () => main(process.argv.slice(2)));
