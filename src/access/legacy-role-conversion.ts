import { isAuthorizationVersion, isCurrentRole, isRoleScope } from "./role-policy.ts";
import type { ConversionStore, LegacyConversionGrant, Role, SupportedLegacyRole } from "./types.ts";
export type ConversionResult =
  | {
      state: "converted";
      changedGrantIds: readonly string[];
      invalidatedSubjectIds: readonly string[];
      evidence: "redacted";
    }
  | { state: "unchanged"; changedGrantIds: readonly [] }
  | { state: "blocked"; code: "UNSUPPORTED_ROLE_OR_SCOPE" | "INCOMPATIBLE_SCHEMA" }
  | { state: "failed"; code: "TRANSACTION_FAILED" };
export interface ConversionPreconditions {
  supportedSchema: boolean;
  authoritativeIssuerBaseline: "verified-v1" | "unknown";
}
function currentRole(grant: LegacyConversionGrant): Role | undefined {
  if (isCurrentRole(grant.role)) return grant.role;
  if (grant.role === "read_only_staff") return "kindergarten_teacher";
  if (grant.role === "kindergarten_admin") return "super_admin";
  return undefined;
}
/** Explicit migration operation. No caller-supplied token initializes a generation. */
export function convertLegacyRoles(
  store: ConversionStore,
  preconditions: ConversionPreconditions,
  operationId: string,
): ConversionResult {
  if (
    preconditions.supportedSchema !== true ||
    preconditions.authoritativeIssuerBaseline !== "verified-v1" ||
    typeof operationId !== "string" ||
    !operationId.trim()
  )
    return { state: "blocked", code: "INCOMPATIBLE_SCHEMA" };
  try {
    return store.run((): ConversionResult => {
      const grants = store.listGrants(),
        users = store.listUsers();
      if (
        grants.some((grant) => !currentRole(grant) || !isRoleScope(currentRole(grant), grant.scope))
      )
        return { state: "blocked", code: "UNSUPPORTED_ROLE_OR_SCOPE" };
      const changed = grants.filter((grant) => !isCurrentRole(grant.role));
      const subjects = [...new Set(changed.map((grant) => grant.subjectId))];
      if (
        users.some(
          (user) =>
            user.authorizationVersion !== undefined &&
            !isAuthorizationVersion(user.authorizationVersion),
        ) ||
        subjects.some((id) => {
          const user = users.find((candidate) => candidate.id === id);
          return !user || user.authorizationVersion === 2147483647;
        })
      )
        return { state: "blocked", code: "INCOMPATIBLE_SCHEMA" };
      for (const grant of changed)
        store.saveConvertedGrant({ ...grant, role: currentRole(grant)! });
      for (const id of subjects) {
        const user = users.find((candidate) => candidate.id === id)!;
        store.saveUser({
          ...user,
          authorizationVersion:
            user.authorizationVersion === undefined ? 2 : user.authorizationVersion + 1,
        });
      }
      for (const grant of changed)
        store.appendConversionEvidence({
          operationId,
          grantId: grant.id,
          subjectId: grant.subjectId,
          organizationId: grant.scope.organizationId,
          originalRole: grant.role as SupportedLegacyRole,
          currentRole: currentRole(grant)!,
          outcome: "converted",
        });
      store.enforceCurrentRoles();
      return changed.length
        ? {
            state: "converted",
            changedGrantIds: changed.map((grant) => grant.id),
            invalidatedSubjectIds: subjects,
            evidence: "redacted",
          }
        : { state: "unchanged", changedGrantIds: [] };
    });
  } catch {
    return { state: "failed", code: "TRANSACTION_FAILED" };
  }
}
