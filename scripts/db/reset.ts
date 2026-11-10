import {
  DEFAULT_SCHEMA,
  loadToolingSettings,
  parseArguments,
  runAsCommand,
  type SqlClient,
  timingLine,
  ToolingError,
} from "./common.ts";
import { connectLocalStack, resolveSeedSchema } from "./local-guard.ts";
import {
  type CommandDeps,
  defaultCommandDeps,
  failureLine,
  collectSecrets,
  SEED_TARGETS_MS,
} from "./seed-support.ts";
import { resetWorkerData } from "./worker.ts";

export const RESET_HELP = `Usage: npm run db:reset [-- --schema <name>] [--yes]

Empties one schema of the local stack: every table, including the audit log, and removes the sign-in users whose address
starts with "<schema>." (the same prefix "db:worker <schema> --reset" removes; no other schema's accounts are touched).
Before emptying, it runs the reminder-tick system function for every organization still in the schema. The stack keeps
running. It refuses any database that is not the local stack.

  --schema <name>  public (default), worker_1, worker_2, worker_3 or worker_4
  --yes            required when the schema is public (the default), because that is the data a developer works with
                   and the reset empties its audit log too; the worker schemas of the tests need no confirmation
  --help           show this text`;

export interface ResetResult {
  schema: string;
  /** How many organizations the tick function was run for (before the tables were emptied). */
  organizations: number;
  durationMs: number;
}

const quote = (identifier: string) => `"${identifier.replace(/"/g, '""')}"`;

/** One system function answers a jsonb envelope; anything but a success stops the reset before anything is emptied. */
async function runSystemFunction(
  client: SqlClient,
  name: string,
  organization: string,
): Promise<void> {
  const result = await client.query(`select ${name}($1::uuid) as result`, [organization]);
  const state = (result.rows[0]?.result as { state?: string } | undefined)?.state;
  if (state !== "success") {
    throw new ToolingError(
      "system-functions",
      `${name} did not succeed (${state ?? "no answer"}); nothing was emptied.`,
    );
  }
}

/**
 * Resets one schema (NFR6.28). The reminder-tick system function runs first, for every organization present, because
 * after the tables are empty there is none left to run it for; then the tables and the schema's sign-in users are emptied
 * in one transaction, so a failure leaves the schema as it was.
 */
export async function resetSchema(
  deps: CommandDeps,
  options: { schema?: string | true },
): Promise<ResetResult> {
  const started = deps.now();
  const schema = resolveSeedSchema(options.schema);
  const settings = loadToolingSettings(deps);
  const client = await connectLocalStack(settings, deps.connect);
  try {
    await client.query(`set search_path to ${quote(schema)}, pg_catalog`);
    const organizations = (
      await client.query("select id::text as id from organizations order by id")
    ).rows.map((row) => String(row.id));
    for (const organization of organizations) {
      await runSystemFunction(client, "reminder_run_due_system", organization);
    }
    await client.query("begin");
    try {
      await resetWorkerData(client, schema);
      await client.query("commit");
    } catch (error) {
      await client.query("rollback").catch(() => undefined);
      throw new ToolingError("empty", error instanceof Error ? error.message : String(error), {
        schema,
      });
    }
    return { schema, organizations: organizations.length, durationMs: deps.now() - started };
  } finally {
    await client.end().catch(() => undefined);
  }
}

export async function main(
  argv: readonly string[],
  deps: CommandDeps = defaultCommandDeps(),
): Promise<number> {
  const { flags } = parseArguments(argv);
  if (flags.has("help")) {
    deps.log(RESET_HELP);
    return 0;
  }
  const started = deps.now();
  const secrets = collectSecrets(deps);
  try {
    // The default schema holds what a developer works with: emptying it needs an explicit confirmation. Nothing is
    // connected before this check. The test schemas stay as they are, and so does `resetSchema` for programs.
    if (resolveSeedSchema(flags.get("schema")) === DEFAULT_SCHEMA && !flags.has("yes")) {
      throw new ToolingError(
        "confirm",
        "This empties the public schema, the audit log included. Run it again with --yes to confirm (npm run db:reset -- --yes); nothing was changed.",
      );
    }
    const result = await resetSchema(deps, { schema: flags.get("schema") });
    deps.log(`RESET ok schema=${result.schema} organizations_processed=${result.organizations}`);
    deps.log(timingLine(`reset(${result.schema})`, result.durationMs, SEED_TARGETS_MS.reset));
    return 0;
  } catch (error) {
    deps.log(failureLine("RESET", error, "unexpected", secrets));
    deps.log(timingLine("reset (failed)", deps.now() - started));
    return 1;
  }
}

await runAsCommand(import.meta, () => main(process.argv.slice(2)));
