import type { AuthorizationAction, AuthorizationRequest, Role, RoleGrant, Scope } from "./types.ts";

export const CURRENT_ROLES = Object.freeze([
  "parent",
  "group_admin",
  "kindergarten_teacher",
  "super_admin",
] as const);
export function isCurrentRole(value: unknown): value is Role {
  return CURRENT_ROLES.some((role) => role === value);
}
export function isValidScope(scope: Scope): boolean {
  return (
    !!scope &&
    typeof scope.id === "string" &&
    scope.id.length > 0 &&
    typeof scope.organizationId === "string" &&
    scope.organizationId.length > 0 &&
    ["organization", "group", "family"].includes(scope.type) &&
    (scope.type !== "organization" || scope.id === scope.organizationId)
  );
}
export function isRoleScope(role: unknown, scope: Scope): boolean {
  if (!isCurrentRole(role) || !isValidScope(scope)) return false;
  return (
    scope.type ===
    (role === "parent" ? "family" : role === "group_admin" ? "group" : "organization")
  );
}
export function scopeContains(grant: Scope, requested: Scope): boolean {
  return (
    isValidScope(grant) &&
    isValidScope(requested) &&
    grant.organizationId === requested.organizationId &&
    (grant.type === "organization" || (grant.type === requested.type && grant.id === requested.id))
  );
}
export function effectiveGrants(grants: readonly RoleGrant[]): RoleGrant[] {
  const seen = new Set<string>();
  return grants.filter((grant) => {
    if (grant.revokedAt !== undefined || !isRoleScope(grant.role, grant.scope)) return false;
    const key = JSON.stringify([
      grant.subjectId,
      grant.role,
      grant.scope.type,
      grant.scope.id,
      grant.scope.organizationId,
    ]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
// A group administrator manages their working groups' work. Family records are a super admin's (BR3.9).
const CORE_RESOURCES = new Set(["dashboard", "task", "assignment", "approval", "archive"]);
const TRACKING_FIELDS = new Set([
  "display_name",
  "participant_name",
  "owner_display_name",
  "assignee_display_names",
  "current_status",
]);
const ACTIONS: readonly AuthorizationAction[] = Object.freeze([
  "read",
  "create",
  "update",
  "delete",
  "manage",
  "respond",
  "withdraw",
]);
const FAMILY_ONLY_ACTIONS: readonly AuthorizationAction[] = Object.freeze(["respond", "withdraw"]);
export function grantAllows(
  grant: Pick<RoleGrant, "role" | "scope" | "revokedAt">,
  request: AuthorizationRequest,
): boolean {
  if (
    grant.revokedAt !== undefined ||
    !isRoleScope(grant.role, grant.scope) ||
    !scopeContains(grant.scope, request.resource.scope)
  )
    return false;
  if (!ACTIONS.includes(request.action)) return false;
  // Answering and withdrawing a request belong to the parents of the family involved, nobody else.
  if (FAMILY_ONLY_ACTIONS.includes(request.action) && grant.role !== "parent") return false;
  // Every signed-in role reads the working groups (BR2.3).
  if (request.resource.kind === "working_group") return request.action === "read";
  // Every signed-in role reads the published rota (BR24.1).
  if (request.resource.kind === "rota") return request.action === "read";
  switch (grant.role) {
    case "super_admin":
      return true;
    case "group_admin":
      return (
        CORE_RESOURCES.has(request.resource.kind) ||
        (request.action === "read" &&
          ["admin_queue", "school_year"].includes(request.resource.kind))
      );
    case "kindergarten_teacher":
      return (
        request.action === "read" &&
        ((request.resource.kind === "schedule" &&
          (!request.resource.field || TRACKING_FIELDS.has(request.resource.field))) ||
          (request.resource.kind === "coordination" && request.resource.field === "display_name"))
      );
    case "parent":
      return parentCan(request);
    default:
      return false;
  }
}
function parentCan({ action, resource }: AuthorizationRequest): boolean {
  if (resource.field && !TRACKING_FIELDS.has(resource.field)) return false;
  switch (resource.kind) {
    case "family":
      return action === "read";
    // A duty card of the family's own rota duty; the database checks that the family holds it (BR24.2). This also
    // serves a group admin who is a parent: the parent grant carries the read, the group admin grant adds nothing.
    case "rota_duty":
      return action === "read";
    case "assignment":
      return action === "read" || action === "create";
    case "contribution":
    case "notification":
      return action === "read" || action === "update";
    case "swap_request":
      return (
        action === "create" || action === "read" || action === "respond" || action === "withdraw"
      );
    case "cancellation_request":
      return action === "create" || action === "read" || action === "withdraw";
    default:
      return false;
  }
}
export function isAuthorizationVersion(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0 && value <= 2147483647;
}
