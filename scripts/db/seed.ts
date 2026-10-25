import {
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
  loadServiceKey,
  SEED_TARGETS_MS,
} from "./seed-support.ts";
import {
  buildSeedPlan,
  createSeedAccountAdmin,
  describePlan,
  provisionAccounts,
  removeAccounts,
  type SeedAccountAdmin,
  type SeedSize,
  writeSeedPlan,
} from "./seed/index.ts";

export const SEED_HELP = `Usage: npm run db:seed [-- --schema <name>]
       npm run db:seed:large [-- --schema <name>]

Fills one schema of the local stack with fictitious test data: the small set (2 groups, 6 families with parents and
children, a super admin, two group admins, a teacher, and a few events and tasks) or, with db:seed:large, the 30-family set
made by the same rules. The sign-in accounts are created in the sign-in service with the fictitious passwords kept in
scripts/db/seed/data.ts; their addresses are <schema>.<tag>@example.test.

The records go in one transaction: either all of them are written or none. Running it again changes nothing. It refuses
any database that is not the local stack.

  --schema <name>  public (default), worker_1, worker_2, worker_3 or worker_4
  --large          the 30-family set (what db:seed:large passes)
  --help           show this text`;

export interface SeedDeps extends CommandDeps {
  createAdmin: (options: { url: string; serviceKey: string }) => SeedAccountAdmin;
}

export function defaultSeedDeps(): SeedDeps {
  return { ...defaultCommandDeps(), createAdmin: createSeedAccountAdmin };
}

export interface SeedResult {
  schema: string;
  size: SeedSize;
  accountsCreated: number;
  counts: Record<string, number>;
  durationMs: number;
}

/**
 * Seeds one schema: guard first (nothing is written for a refused target), then the sign-in users, then every record in
 * one transaction. If the records cannot be written, the users this run created are removed again, so a failed seed
 * leaves the schema and the sign-in service as they were (NFR3.19).
 */
export async function seedSchema(
  deps: SeedDeps,
  options: { schema?: string | true; size: SeedSize },
): Promise<SeedResult> {
  const started = deps.now();
  const schema = resolveSeedSchema(options.schema);
  const settings = loadToolingSettings(deps);
  const serviceKey = loadServiceKey(deps);
  const client: SqlClient = await connectLocalStack(settings, deps.connect);
  try {
    const plan = buildSeedPlan(schema, options.size);
    const admin = deps.createAdmin({ url: settings.apiUrl, serviceKey });
    const provisioned = await provisionAccounts({ client, admin, accounts: plan.accounts });
    try {
      await writeSeedPlan(client, plan);
    } catch (error) {
      const left = await removeAccounts(admin, provisioned.created);
      throw new ToolingError(
        "records",
        `${error instanceof Error ? error.message : String(error)}${left > 0 ? ` (${left} new sign-in users could not be removed again)` : ""}`,
        { schema },
      );
    }
    return {
      schema,
      size: options.size,
      accountsCreated: provisioned.created.length,
      counts: describePlan(plan),
      durationMs: deps.now() - started,
    };
  } finally {
    await client.end().catch(() => undefined);
  }
}

export async function main(
  argv: readonly string[],
  deps: SeedDeps = defaultSeedDeps(),
): Promise<number> {
  const { flags } = parseArguments(argv);
  if (flags.has("help")) {
    deps.log(SEED_HELP);
    return 0;
  }
  const started = deps.now();
  const size: SeedSize = flags.has("large") ? "large" : "small";
  const secrets = collectSecrets(deps);
  try {
    const result = await seedSchema(deps, { schema: flags.get("schema"), size });
    const counts = Object.entries(result.counts)
      .map(([name, value]) => `${name}=${value}`)
      .join(" ");
    deps.log(
      `SEED ok schema=${result.schema} set=${result.size} ${counts} accounts_created=${result.accountsCreated}`,
    );
    deps.log(
      timingLine(
        `seed(${result.schema}, ${result.size})`,
        result.durationMs,
        size === "large" ? SEED_TARGETS_MS.seedLarge : SEED_TARGETS_MS.seed,
      ),
    );
    return 0;
  } catch (error) {
    deps.log(failureLine("SEED", error, "unexpected", secrets));
    deps.log(timingLine("seed (failed)", deps.now() - started));
    return 1;
  }
}

await runAsCommand(import.meta, () => main(process.argv.slice(2)));
