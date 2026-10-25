import { isRoleScope, type Role, type RoleGrant, type Scope } from "../access/index.ts";
import type { AuthorizationVersionPort, SessionContext } from "../application/index.ts";
import type { DatabaseClient } from "../runtime/database/client.ts";
import { DataGateway } from "./gateway.ts";
import { asRows, isUuid, text, type Row } from "./values.ts";

/**
 * What a signed-in request is, read from the database as the person themselves (BR32.2, FR2.8): the
 * authorization version, the role grants and, for a parent, the family. Nothing here is a constant: a
 * fixed family, parent or login would be a defect, and a test searches the production path for them.
 */
export type ParentLink = Readonly<{ parentId: string; familyId: string; organizationId: string }>;

export type AccessContext = Readonly<{
  authorizationVersion: number;
  grants: readonly RoleGrant[];
  /** Set only for an account with a linked, active parent in an active family. */
  parent?: ParentLink;
}>;

const ROLES: readonly Role[] = ["parent", "group_admin", "kindergarten_teacher", "super_admin"];

function toGrant(subjectId: string, row: Row, grantedAt: string): RoleGrant | undefined {
  const role = ROLES.find((candidate) => candidate === row.role);
  const type = row.scope_type;
  if (!role || (type !== "organization" && type !== "group" && type !== "family")) return undefined;
  if (typeof row.scope_id !== "string" || typeof row.organization_id !== "string") return undefined;
  const scope: Scope = { id: row.scope_id, type, organizationId: row.organization_id };
  if (!isRoleScope(role, scope)) return undefined;
  return { id: text(row, "id"), subjectId, role, scope, grantedAt };
}

/** The authorization version of the signed-in account (U2), or undefined when the session is not active. */
export async function readAuthorizationVersion(
  gateway: DataGateway,
  accountId: string,
): Promise<number | undefined> {
  if (!isUuid(accountId)) return undefined;
  // Read as a table row, not through the scalar function: a session that is not active has no row to read,
  // and the data API's answer for a scalar function with no result (null) is not told apart from a failure.
  const rows = asRows(
    await gateway.select("session.version", (client) =>
      client
        .from("app_authorization_versions")
        .select("authorization_version")
        .eq("subject_id", accountId)
        .limit(1),
    ),
  );
  const version = rows[0]?.authorization_version;
  return typeof version === "number" && Number.isInteger(version) && version > 0
    ? version
    : undefined;
}

/**
 * Reads the grants, the version and the parent link of the signed-in account. Returns undefined when the
 * session is not active (callers treat that as signed out). An active session whose account has no version
 * row yet reads as version 0, which no authorization accepts: such an account holds no role.
 */
export async function readAccessContext(
  database: DatabaseClient,
  accountId: string,
  now: () => Date = () => new Date(),
): Promise<AccessContext | undefined> {
  const gateway = new DataGateway(database);
  const [active, version, grantRows, parentRows] = await Promise.all([
    gateway.select("session.active", (client) => client.rpc("current_session_is_active")),
    readAuthorizationVersion(gateway, accountId),
    gateway.select("session.grants", (client) =>
      client
        .from("app_role_grants")
        .select("id,role,scope_type,scope_id,organization_id")
        .eq("subject_id", accountId)
        .is("revoked_at", null),
    ),
    gateway.select("session.parent", (client) =>
      client
        .from("parents")
        .select("id,family_id,organization_id")
        .eq("account_id", accountId)
        .eq("status", "active")
        .limit(1),
    ),
  ]);
  if (active !== true) return undefined;
  const grantedAt = now().toISOString();
  const grants = asRows(grantRows).flatMap((row) => toGrant(accountId, row, grantedAt) ?? []);
  const parentRow = asRows(parentRows)[0];
  const parent = parentRow ? await activeParent(gateway, parentRow) : undefined;
  return { authorizationVersion: version ?? 0, grants, ...(parent ? { parent } : {}) };
}

async function activeParent(gateway: DataGateway, row: Row): Promise<ParentLink | undefined> {
  const familyId = text(row, "family_id");
  const families = asRows(
    await gateway.select("session.family", (client) =>
      client.from("families").select("id").eq("id", familyId).eq("status", "active").limit(1),
    ),
  );
  if (families.length === 0) return undefined;
  return {
    parentId: text(row, "id"),
    familyId,
    organizationId: text(row, "organization_id"),
  };
}

/** The application session of a signed-in account with the grants it holds now. */
export function toSessionContext(accountId: string, context: AccessContext): SessionContext {
  const grants = Object.freeze([...context.grants]);
  return Object.freeze({
    subjectId: accountId,
    authorizationVersion: context.authorizationVersion,
    isActive: true,
    grants,
    roles: Object.freeze([...new Set(grants.map((grant) => grant.role))]),
    scopes: Object.freeze(grants.map((grant) => grant.scope)),
  });
}

/**
 * The authorization-version check of every facade call, answered by the database as the signed-in account:
 * a role change takes effect on the next request (U2 BR2.7), and a session that is no longer active reads
 * no version at all.
 */
export function createVersionPort(database: DatabaseClient): AuthorizationVersionPort {
  const gateway = new DataGateway(database);
  return {
    getCurrentVersion: (subjectId) => readAuthorizationVersion(gateway, subjectId),
    clearProtectedCache: () => undefined,
  };
}
