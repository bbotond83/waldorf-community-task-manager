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
const CORE_RESOURCES = new Set([
  "dashboard",
  "task",
  "assignment",
  "approval",
  "archive",
  "event_manage",
]);
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
// A parent's own details, sharing choice, password and sign-in email belong to the parent themself: no other role
// holds them, a super admin included (BR31.2, BR32.1, NFR3.4).
// Joining and leaving a working group is the parent's own act too (BR40): the database acts for the caller's own
// current parent, so a super admin has no right to it.
const PARENT_ONLY_RESOURCES = new Set([
  "own_profile",
  "own_account",
  "working_group_membership",
  // Signing up for an event and offering food: the database acts for the caller's own parent (BR108.1, BR113.1).
  "event_signup",
  "food_offer",
]);
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
  // Every signed-in role reads the event pages (BR104.1).
  if (request.resource.kind === "event") return request.action === "read";
  // Every signed-in role reads the published rota (BR24.1).
  if (request.resource.kind === "rota") return request.action === "read";
  // Every signed-in role opens the parent directory; which fields come back is decided in the database (BR30).
  if (request.resource.kind === "directory") return request.action === "read";
  if (PARENT_ONLY_RESOURCES.has(request.resource.kind) && grant.role !== "parent") return false;
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
    // The parent's own details, sharing choice and sign-in settings (BR31 to BR34).
    case "own_profile":
    case "own_account":
      return action === "read" || action === "update";
    // Joining a working group and leaving it (BR40).
    case "working_group_membership":
      return action === "create" || action === "update";
    // Signing up for an event and offering food, changing and withdrawing them (BR108.1, BR113.1).
    case "event_signup":
    case "food_offer":
      return action === "create" || action === "update" || action === "delete";
    // A duty card of the family's own rota duty; the database checks that the family holds it (BR24.2). This also
    // serves a group admin who is a parent: the parent grant carries the read, the group admin grant adds nothing.
    case "rota_duty":
      return action === "read";
    // Choosing the weekend opening or closing for the family's own picking week (BR63.4). The database acts for the
    // caller's own family and refuses a week that is not that family's. A group admin who is a parent picks through
    // the parent grant. Assigning a pick for a family is a super admin's alone and needs the manage action.
    case "weekend_pick":
      return action === "update";
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
