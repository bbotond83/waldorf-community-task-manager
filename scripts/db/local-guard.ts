import { createHash } from "node:crypto";
import {
  assertLocalAddress,
  DEFAULT_SCHEMA,
  type SqlClient,
  ToolingError,
  WORKER_SCHEMAS,
} from "./common.ts";
import { TRACKING_SCHEMA } from "./runner.ts";

/**
 * The local-only guard of the seed and reset commands (NFR1.63, NFR2.32). Both commands truncate or fill a whole
 * schema, so they run only against the Supabase CLI's local stack of this project:
 *
 * 1. the database address (and the sign-in service address) is a plain loopback address, checked before any connection;
 * 2. the connection password is the Supabase CLI's documented default for its local database (compared by hash
 *    only, before any connection is made): a hosted database reached through a loopback tunnel has its own password,
 *    so a database whose identity settings are unset still cannot pass;
 * 3. the database identifies itself as the local stack: it is the CLI's `postgres` database, it has the CLI image's
 *    `supabase_admin` role, this repository's migration tooling manages it, and its JWT secret (when it holds one) is the
 *    CLI's documented default, never a project secret of a hosted database.
 *
 * Every refusal is a plain message and changes nothing: the checks only read.
 */

/** The schemas the seed and reset may touch: the default schema and the four test worker schemas. */
export const SEED_SCHEMAS: readonly string[] = [DEFAULT_SCHEMA, ...WORKER_SCHEMAS];

/**
 * SHA-256 of the Supabase CLI's documented default JWT secret. Only the hash is kept here: the database computes the
 * hash of its own setting, so the secret itself never appears in this repository or in any output.
 */
export const LOCAL_STACK_JWT_HASH =
  "a064b502e61d27e94b8717290e5e1b32e36720e9fbdf952ec81a84c07128cb37";

/**
 * SHA-256 of the password the Supabase CLI gives its local database (the value `npm run db:start` writes into the
 * connection address of the ignored `.env.service.local`). Only the hash is kept here, as with the default keys of the
 * privacy allowlist; a project or hosted database does not use this password.
 */
export const LOCAL_STACK_DB_PASSWORD_HASH =
  "a942b37ccfaf5a813b1432caa209a43b9d144e47ad0de1549c289c253e556cd5";

/** Refuses a connection address whose password is not the local stack's default; reads only, prints nothing of it. */
export function assertLocalStackPassword(databaseUrl: string): void {
  let password = "";
  try {
    password = decodeURIComponent(new URL(databaseUrl).password);
  } catch {
    password = "";
  }
  const hash = createHash("sha256").update(password).digest("hex");
  if (hash !== LOCAL_STACK_DB_PASSWORD_HASH) {
    throw new ToolingError(
      "guard",
      "The database connection does not use the local stack's default password, so it is not the local stack; nothing was changed. The database tools that change data (the seed, the reset and the test workers) work only with the Supabase CLI's default local database password: restart the stack with the default password to use them.",
    );
  }
}

/** The one query of the identity check; it reads only. */
export const IDENTITY_QUERY = `select current_database() as database_name,
       exists (select 1 from pg_roles where rolname = 'supabase_admin') as supabase_role,
       to_regclass('${TRACKING_SCHEMA}.applied_migrations') is not null as managed,
       case when current_setting('app.settings.jwt_secret', true) is null then null
            else encode(sha256(convert_to(current_setting('app.settings.jwt_secret', true), 'UTF8')), 'hex')
       end as jwt_hash`;

/**
 * Returns the schema chosen with `--schema` (the default schema when the flag is missing), or refuses naming the
 * allowed values. A flag without a value, an empty value and any other name are refused.
 */
export function resolveSeedSchema(flag: string | true | undefined): string {
  if (flag === undefined) return DEFAULT_SCHEMA;
  if (typeof flag !== "string" || !SEED_SCHEMAS.includes(flag)) {
    throw new ToolingError(
      "schema",
      `--schema must be one of ${SEED_SCHEMAS.join(", ")}; nothing was changed.`,
      { schema: typeof flag === "string" ? flag : "" },
    );
  }
  return flag;
}

/** Refuses an address that is not a plain loopback address; nothing is connected. */
export function assertLocalSettings(settings: { databaseUrl: string; apiUrl: string }): void {
  assertLocalAddress("DATABASE_URL", settings.databaseUrl);
  assertLocalAddress("SUPABASE_URL", settings.apiUrl);
  assertLocalStackPassword(settings.databaseUrl);
}

/**
 * Options of the identity check. `requireManaged` (default `true`) also demands that this repository's migration
 * tooling has set the database up; the worker command turns it off because it is one of the tools that creates the
 * tracking table, so it must work on a stack that has never been migrated.
 */
export interface LocalStackOptions {
  requireManaged?: boolean;
}

/** Refuses a database that does not identify itself as the local stack; reads only. */
export async function assertLocalStack(
  client: SqlClient,
  options: LocalStackOptions = {},
): Promise<void> {
  let row: Record<string, unknown> | undefined;
  try {
    row = (await client.query(IDENTITY_QUERY)).rows[0];
  } catch {
    row = undefined;
  }
  if (!row) {
    throw new ToolingError(
      "guard",
      "The database did not identify itself as the local stack; nothing was changed.",
    );
  }
  const hash = row.jwt_hash;
  const reasons: string[] = [];
  if (row.database_name !== "postgres") reasons.push("it is not the CLI's postgres database");
  if (row.supabase_role !== true) reasons.push("it has no supabase_admin role");
  if (options.requireManaged !== false && row.managed !== true)
    reasons.push('the migration tooling has not set it up ("npm run db:migrate")');
  if (typeof hash === "string" && hash !== LOCAL_STACK_JWT_HASH) {
    reasons.push("it holds a project secret instead of the local stack's default");
  }
  if (reasons.length > 0) {
    throw new ToolingError(
      "guard",
      `The database does not identify itself as the local stack (${reasons.join("; ")}); nothing was changed.`,
    );
  }
}

/**
 * Opens the one owner connection a seed or reset uses, after the address check, and runs the identity check on it.
 * A refused connection is closed again before the error is thrown.
 */
export async function connectLocalStack(
  settings: { databaseUrl: string; apiUrl: string },
  connect: (url: string) => Promise<SqlClient>,
  options: LocalStackOptions = {},
): Promise<SqlClient> {
  assertLocalSettings(settings);
  const client = await connect(settings.databaseUrl);
  try {
    await assertLocalStack(client, options);
  } catch (error) {
    await client.end().catch(() => undefined);
    throw error;
  }
  return client;
}
