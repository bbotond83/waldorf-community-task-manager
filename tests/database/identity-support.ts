import { createHash } from "node:crypto";
import type pg from "pg";
import { resetWorkerData } from "../../scripts/db/worker.ts";
import {
  type Actor,
  asActor,
  ensureAccount,
  type Envelope,
  failureOf,
  lockSchemas,
  openDatabase,
  ORGANIZATION,
  OTHER_ADMIN,
  OTHER_ORGANIZATION,
  OUTSIDER,
  prepareSchema,
  seedGrants,
  sessionIdFor,
  SUPER_ADMIN,
  bindSchema,
  uuid,
} from "./stack-support.ts";

export {
  asActor,
  failureOf,
  ORGANIZATION,
  OTHER_ADMIN,
  OTHER_ORGANIZATION,
  OUTSIDER,
  SUPER_ADMIN,
  uuid,
};
export type { Envelope };

/** The two schemas every identity test file runs in: a worker schema and the default one (BR2.15). */
export const IDENTITY_SCHEMAS = ["worker_3", "public"] as const;

export const GROUP_1 = uuid(101);
export const GROUP_2 = uuid(102);
export const FAMILY_1 = uuid(201);
export const FAMILY_2 = uuid(202);
export const ASSIGNMENT_1 = uuid(301);
export const IMPORT_RUN_1 = uuid(401);

export const ADMIN_G1 = "bbbbbbbb-0000-4000-8000-000000000011";
export const ADMIN_G2 = "bbbbbbbb-0000-4000-8000-000000000012";
export const TEACHER_G1 = "bbbbbbbb-0000-4000-8000-000000000013";
export const PARENT_F1 = "bbbbbbbb-0000-4000-8000-000000000014";
export const PARENT_F2 = "bbbbbbbb-0000-4000-8000-000000000015";
export const DEACTIVATED = "bbbbbbbb-0000-4000-8000-000000000016";
export const SIGNED_OUT = "bbbbbbbb-0000-4000-8000-000000000017";

export const sha256Hex = (text: string): string => createHash("sha256").update(text).digest("hex");
export const tokenHashFor = (label: string): string => sha256Hex(`token:${label}`);
export const emailHashFor = (label: string): string => sha256Hex(`email:${label}`);

export type IdentityContext = {
  db: pg.Client;
  schema: string;
};

/** Opens a connection bound to a schema, migrated and emptied, with the identity world seeded. */
export async function openIdentityDatabase(schema: string): Promise<pg.Client> {
  const db = await openDatabase();
  await lockSchemas(db, [schema]);
  await prepareSchema(db, schema);
  return db;
}

/**
 * Empties the schema and seeds the same small world for every identity test: two groups with a family
 * each, a super admin, one group admin per group, a teacher, two parents, an account without a grant,
 * a deactivated account, an account without a session and a super admin of another organization.
 */
export async function seedIdentityWorld(db: pg.Client, schema: string): Promise<void> {
  await bindSchema(db, schema);
  await resetWorkerData(db, schema);
  await seedGrants(db);
  await ensureAccount(db, { id: ADMIN_G1, organization: ORGANIZATION });
  await ensureAccount(db, { id: ADMIN_G2, organization: ORGANIZATION });
  await ensureAccount(db, { id: TEACHER_G1, organization: ORGANIZATION });
  await ensureAccount(db, { id: PARENT_F1, organization: ORGANIZATION });
  await ensureAccount(db, { id: PARENT_F2, organization: ORGANIZATION });
  await ensureAccount(db, { id: DEACTIVATED, organization: ORGANIZATION, status: "deactivated" });
  await ensureAccount(db, { id: SIGNED_OUT, organization: ORGANIZATION, withoutSession: true });
  await db.query(
    "insert into app_families (id, organization_id, scope_id) values ($1, $3, $4), ($2, $3, $5)",
    [FAMILY_1, FAMILY_2, ORGANIZATION, GROUP_1, GROUP_2],
  );
  await db.query(
    "insert into app_assignments (id, organization_id, scope_id) values ($1, $2, $3)",
    [ASSIGNMENT_1, ORGANIZATION, GROUP_1],
  );
  await db.query(
    "insert into app_import_runs (id, organization_id, scope_id) values ($1, $2, $2)",
    [IMPORT_RUN_1, ORGANIZATION],
  );
  const grant = (subject: string, role: string, scopeType: string, scope: string) =>
    db.query(
      "insert into app_role_grants (subject_id, role, scope_type, scope_id, organization_id) values ($1, $2, $3, $4, $5)",
      [subject, role, scopeType, scope, ORGANIZATION],
    );
  await grant(ADMIN_G1, "group_admin", "group", GROUP_1);
  await grant(ADMIN_G2, "group_admin", "group", GROUP_2);
  await grant(TEACHER_G1, "kindergarten_teacher", "group", GROUP_1);
  await grant(PARENT_F1, "parent", "family", FAMILY_1);
  await grant(PARENT_F2, "parent", "family", FAMILY_2);
  await grant(DEACTIVATED, "parent", "family", FAMILY_1);
  await grant(SIGNED_OUT, "parent", "family", FAMILY_1);
  await db.query(
    "insert into app_authorization_versions (subject_id, authorization_version) select subject_id, 1 from app_role_grants on conflict do nothing",
  );
}

export const authenticated = (account: string, session?: string | null): Actor => ({
  role: "authenticated",
  account,
  session,
});

/** Calls a function that returns an operation envelope, as an actor, and returns the envelope. */
export async function callAs(
  db: pg.Client,
  schema: string,
  actor: Actor,
  sql: string,
  values: readonly unknown[] = [],
): Promise<Envelope & Record<string, unknown>> {
  return asActor(db, schema, actor, async () => {
    const result = await db.query(`select (${sql}) as result`, [...values]);
    return result.rows[0].result as Envelope & Record<string, unknown>;
  });
}

export const asServiceRole: Actor = { role: "service_role" };

/** Reads the audit events as the schema owner, oldest first. */
export async function auditEvents(db: pg.Client) {
  return (
    await db.query(
      "select actor_account_id, actor_role, action, target_type, target_id, organization_id, group_id, outcome, details from audit_events order by occurred_at, id",
    )
  ).rows as {
    actor_account_id: string;
    actor_role: string;
    action: string;
    target_type: string;
    target_id: string;
    organization_id: string;
    group_id: string | null;
    outcome: string;
    details: string | null;
  }[];
}

export async function count(db: pg.Client, table: string, where = "true"): Promise<number> {
  return (await db.query(`select count(*)::int as n from ${table} where ${where}`)).rows[0].n;
}

export { sessionIdFor };
