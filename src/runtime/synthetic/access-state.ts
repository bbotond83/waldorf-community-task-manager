import { effectiveGrants, isAuthorizationVersion, isRoleScope } from "../../access/role-policy.ts";
import { sessionGrantBindings } from "../../access/session-grants.ts";
import type { Role, RoleGrant, Scope } from "../../access/types.ts";
import type { SessionContext } from "../../application/contracts.ts";
import { getSyntheticProfile, SYNTHETIC_PROFILES } from "./profiles.ts";
export type SyntheticAccessState = {
  isActive: boolean;
  authorizationVersion: number | undefined;
  grants: RoleGrant[];
};
const states = new Map<string, SyntheticAccessState>();
const ROLE_BY_PROFILE = {
  parent: "parent",
  "kindergarten-teacher": "kindergarten_teacher",
  "group-admin": "group_admin",
  "super-admin": "super_admin",
} as const satisfies Record<string, Role>;
function scopesFor(role: Role): Scope[] {
  if (role === "parent")
    return [{ id: "family-boroka", type: "family", organizationId: "org-napsugar" }];
  if (role === "kindergarten_teacher")
    return ["group-oak", "group-sunflower"].map((id) => ({
      id,
      type: "group",
      organizationId: "org-waldorf-local",
    }));
  if (role === "group_admin")
    return [{ id: "group-boroka", type: "group", organizationId: "org-napsugar" }];
  return [{ id: "org-napsugar", type: "organization", organizationId: "org-napsugar" }];
}
export function resetSyntheticAccessState(): void {
  states.clear();
  for (const profile of SYNTHETIC_PROFILES) {
    const bindings = sessionGrantBindings(
      profile.id,
      ROLE_BY_PROFILE[profile.role],
      scopesFor(ROLE_BY_PROFILE[profile.role]),
    );
    states.set(profile.id, {
      isActive: true,
      authorizationVersion: profile.authorizationVersion,
      grants: structuredClone([...bindings.grants]),
    });
  }
}
resetSyntheticAccessState();
export function getSyntheticAccessState(subjectId: string): SyntheticAccessState | undefined {
  const state = states.get(subjectId);
  return state && structuredClone(state);
}
/** Fixture mutation seam. Never exported to a browser or production composition. */
export function setSyntheticAccessState(
  subjectId: string,
  state: SyntheticAccessState | undefined,
): void {
  if (state) states.set(subjectId, structuredClone(state));
  else states.delete(subjectId);
}
export function currentSyntheticActor(profileId: string): SessionContext | undefined {
  const profile = getSyntheticProfile(profileId),
    state = getSyntheticAccessState(profileId);
  if (
    !profile ||
    state?.isActive !== true ||
    !isAuthorizationVersion(state.authorizationVersion) ||
    state.grants.some(
      (grant) => grant.subjectId !== profileId || !isRoleScope(grant.role, grant.scope),
    )
  )
    return undefined;
  const grants = effectiveGrants(state.grants);
  if (!grants.length) return undefined;
  return {
    subjectId: profileId,
    isActive: true,
    authorizationVersion: state.authorizationVersion,
    grants,
    roles: [...new Set(grants.map((grant) => grant.role))],
    scopes: grants.map((grant) => grant.scope),
    runtimeMode: "synthetic",
    isSynthetic: true,
  };
}

/** Existing synthetic governance target: revoke current grants and invalidate once. */
export function revokeSyntheticSubjectAccess(subjectId: string): number | undefined {
  const actor = currentSyntheticActor(subjectId);
  const state = getSyntheticAccessState(subjectId);
  if (!actor || !state || actor.authorizationVersion === 2147483647) return undefined;
  const version = actor.authorizationVersion + 1;
  setSyntheticAccessState(subjectId, {
    ...state,
    authorizationVersion: version,
    grants: state.grants.map((grant) =>
      grant.revokedAt === undefined ? { ...grant, revokedAt: "2026-10-06T00:00:00.000Z" } : grant,
    ),
  });
  return version;
}
