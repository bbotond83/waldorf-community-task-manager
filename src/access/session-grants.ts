import { isRoleScope } from "./role-policy.ts";
import type { Role, RoleGrant, Scope } from "./types.ts";
/** Explicit fixture/session binding. Authority is each complete grant, not lists. */
export function sessionGrantBindings(
  subjectId: string,
  role: Role,
  scopes: readonly Scope[],
): { isActive: true; grants: readonly RoleGrant[] } {
  return {
    isActive: true,
    grants: scopes
      .filter((scope) => isRoleScope(role, scope))
      .map((scope) => ({
        id: `${subjectId}:${role}:${scope.type}:${scope.id}`,
        subjectId,
        role,
        scope,
        grantedAt: "2026-10-06T00:00:00.000Z",
      })),
  };
}
