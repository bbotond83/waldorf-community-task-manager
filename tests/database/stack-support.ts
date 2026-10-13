import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import pg from "pg";
import {
  loadToolingSettings,
  parseEnvFile,
  SERVICE_ENV_FILE,
  type ToolingSettings,
} from "../../scripts/db/common.ts";
import { defaultWorkerDeps, resetWorkerData, setupWorker } from "../../scripts/db/worker.ts";

/** Helpers for the database-backed tests. They run against the real local stack, never a mock. */
export const root = fileURLToPath(new URL("../../", import.meta.url));

const readLocal = (path: string): string | undefined => {
  try {
    return readFileSync(`${root}${path}`, "utf8");
  } catch {
    return undefined;
  }
};

export function stackSettings(): ToolingSettings {
  return loadToolingSettings({ environment: process.env, readFile: readLocal });
}

/** The service credential of the local stack; used only by the tests that create accounts. */
export function serviceKey(): string {
  const value = parseEnvFile(readLocal(SERVICE_ENV_FILE) ?? "").SUPABASE_SERVICE_ROLE_KEY;
  if (!value) throw new Error(`Run "npm run db:start" first: ${SERVICE_ENV_FILE} is missing.`);
  return value;
}

export async function openDatabase(): Promise<pg.Client> {
  const client = new pg.Client({ connectionString: stackSettings().databaseUrl });
  await client.connect();
  return client;
}

/**
 * Serializes test files that share a schema. Every database test file runs in its own process, so
 * two files that use the same schema (for example `public`) would otherwise wipe each other's data.
 * Locks are taken in sorted order and held by the connection until `release` is called.
 */
export async function lockSchemas(client: pg.Client, schemas: readonly string[]): Promise<void> {
  for (const schema of [...schemas].sort()) {
    await client.query("select pg_advisory_lock(hashtext($1))", [`waldorf-test-schema:${schema}`]);
  }
}

/** Makes a schema ready for a test file: migrated, emptied, accounts of the worker removed. */
export async function prepareSchema(client: pg.Client, schema: string): Promise<void> {
  if (schema === "public") {
    const { applyMigrations, readMigrationFiles } = await import("../../scripts/db/runner.ts");
    const { FRESH_SCHEMA_SETTINGS } = await import("../../scripts/db/migrate.ts");
    await applyMigrations({
      client,
      schema,
      files: readMigrationFiles(`${root}supabase/migrations`),
      log: () => {},
      now: () => Date.now(),
      freshSchemaSettings: FRESH_SCHEMA_SETTINGS,
    });
    await resetWorkerData(client, schema);
    return;
  }
  const deps = {
    ...defaultWorkerDeps(),
    log: () => {},
    migrationsDirectory: `${root}supabase/migrations`,
  };
  await setupWorker(deps, schema, { reset: false });
}

export const ORGANIZATION = "aaaaaaaa-0000-4000-8000-000000000001";
export const OTHER_ORGANIZATION = "aaaaaaaa-0000-4000-8000-000000000002";
export const SUPER_ADMIN = "bbbbbbbb-0000-4000-8000-000000000001";
export const PARENT = "bbbbbbbb-0000-4000-8000-000000000002";
export const OUTSIDER = "bbbbbbbb-0000-4000-8000-000000000003";
export const OTHER_ADMIN = "bbbbbbbb-0000-4000-8000-000000000004";
export const SYSTEM_ACCOUNT = "00000000-0000-0000-0000-000000000000";

export const uuid = (n: number) => `cccccccc-0000-4000-8000-${String(n).padStart(12, "0")}`;

/** The session id of an account's test session (see `ensureAccount`); derived, so every file agrees. */
// Every test process (one per file) gets its own sessions for the shared test identities, so a test that ends
// or ages a session never disturbs another file running at the same time.
const SESSION_NAMESPACE = randomBytes(4).toString("hex");
export const sessionIdFor = (account: string): string => `${SESSION_NAMESPACE}${account.slice(8)}`;

export type AccountSpec = {
  id: string;
  organization: string;
  email?: string;
  status?: "active" | "deactivated";
  /** Skip the session row: the account exists but is signed out. */
  withoutSession?: boolean;
};

/**
 * Creates a sign-in user, the app's Account and an active sign-in session for it, as the schema owner.
 * The sign-in user and session are real rows of the sign-in service's tables (the same ones the
 * database checks), created directly so database tests stay fast; the tests of the real sign-in flow
 * use the sign-in service itself. The shared test identities use an address prefix that no worker reset
 * removes, so files running in different schemas never delete each other's users.
 */
export async function ensureAccount(client: pg.Client, spec: AccountSpec): Promise<string> {
  const email = spec.email ?? `identity.${spec.id}@example.test`;
  await client.query(
    `insert into auth.users (id, aud, role, email, created_at, updated_at)
     values ($1, 'authenticated', 'authenticated', $2, now(), now()) on conflict (id) do nothing`,
    [spec.id, email],
  );
  await client.query(
    `insert into accounts (id, email, organization_id, status) values ($1, $2, $3, $4)
     on conflict (id) do update set status = excluded.status`,
    [spec.id, email.toLowerCase(), spec.organization, spec.status ?? "active"],
  );
  const session = sessionIdFor(spec.id);
  // Sessions left by earlier runs of the shared test identities are old: remove them here.
  await client.query(
    "delete from auth.sessions where user_id = $1 and created_at < now() - interval '2 hours'",
    [spec.id],
  );
  if (spec.withoutSession) {
    await client.query("delete from auth.sessions where id = $1", [session]);
  } else {
    await client.query(
      `insert into auth.sessions (id, user_id, created_at, updated_at, refreshed_at)
       values ($1, $2, now(), now(), now() at time zone 'utc')
       on conflict (id) do update set refreshed_at = now() at time zone 'utc', not_after = null`,
      [session, spec.id],
    );
  }
  return session;
}

/** Grants used by the tests. Rows are written as the schema owner (row rules do not apply). */
export async function seedGrants(client: pg.Client): Promise<void> {
  const grant = (
    subject: string,
    role: string,
    scopeType: string,
    scope: string,
    organization: string,
  ) =>
    client.query(
      "insert into app_role_grants (id, subject_id, role, scope_type, scope_id, organization_id) values (gen_random_uuid(), $1, $2, $3, $4, $5)",
      [subject, role, scopeType, scope, organization],
    );
  await ensureAccount(client, { id: SUPER_ADMIN, organization: ORGANIZATION });
  await ensureAccount(client, { id: OTHER_ADMIN, organization: OTHER_ORGANIZATION });
  await ensureAccount(client, { id: PARENT, organization: ORGANIZATION });
  await ensureAccount(client, { id: OUTSIDER, organization: ORGANIZATION });
  await grant(SUPER_ADMIN, "super_admin", "organization", ORGANIZATION, ORGANIZATION);
  await grant(OTHER_ADMIN, "super_admin", "organization", OTHER_ORGANIZATION, OTHER_ORGANIZATION);
  await grant(PARENT, "parent", "family", uuid(900), ORGANIZATION);
}

export type Actor = {
  role: "anon" | "authenticated" | "service_role";
  account?: string;
  /** The token's session id: omitted means the account's test session, null means none. */
  session?: string | null;
};

/**
 * Runs `work` inside one transaction as a database role, the way the data API runs a request: the
 * role is switched with `set local role` and the signed-in account and its session are the token
 * claims. Commits.
 */
export async function asActor<T>(
  client: pg.Client,
  schema: string,
  actor: Actor,
  work: () => Promise<T>,
): Promise<T> {
  await client.query("begin");
  try {
    await client.query(`set local search_path to "${schema}", pg_catalog`);
    await client.query(`set local role ${actor.role}`);
    if (actor.account) {
      const session = actor.session === undefined ? sessionIdFor(actor.account) : actor.session;
      const claims = JSON.stringify({
        sub: actor.account,
        role: actor.role,
        ...(session ? { session_id: session } : {}),
      });
      await client.query("select set_config('request.jwt.claims', $1, true)", [claims]);
      await client.query("select set_config('request.jwt.claim.sub', $1, true)", [actor.account]);
    }
    const result = await work();
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

/** Like `asActor` but returns the error instead of throwing it (the transaction is rolled back). */
export async function failureOf(
  work: () => Promise<unknown>,
): Promise<(Error & { code?: string }) | undefined> {
  try {
    await work();
    return undefined;
  } catch (error) {
    return error as Error & { code?: string };
  }
}

export type Envelope = { state: string; reference: string | null; code: string | null };

export async function placeHold(
  client: pg.Client,
  args: {
    key: string;
    targetType?: string;
    targetId: string;
    organization?: string;
    reason?: string;
  },
): Promise<Envelope> {
  const result = await client.query("select lifecycle_hold_place($1, $2, $3, $4, $5) as result", [
    args.key,
    args.targetType ?? "child",
    args.targetId,
    args.organization ?? ORGANIZATION,
    args.reason ?? "legal_hold:case_1",
  ]);
  return result.rows[0].result as Envelope;
}

/** A client whose session search path is the schema under test (as the migration runner sets it). */
export async function useSchema(client: pg.Client, schema: string): Promise<void> {
  await client.query(`set search_path to "${schema}", pg_catalog`);
}

/** The same function under a name the React hooks lint rule does not mistake for a hook. */
export const bindSchema = useSchema;

/** Reported figures (timings against the NFR4 targets) appear as TAP comments in the run output. */
export function report(line: string): void {
  console.log(`# ${line}`);
}
