import { isRoleScope } from "../access/role-policy.ts";
import type { AuthorizationDecision, RoleGrant, Scope } from "../access/types.ts";
import type {
  Child,
  DirectoryDependencies,
  DirectorySession,
  DirectoryView,
  Family,
  FamilyInput,
  ParentProfile,
} from "./types.ts";

const DENIED: AuthorizationDecision = {
  allowed: false,
  code: "authorization_denied",
  message: "Nincs jogosultság",
};

export class DirectoryService {
  private readonly now: () => Date;
  private readonly dependencies: DirectoryDependencies;
  constructor(dependencies: DirectoryDependencies) {
    this.dependencies = dependencies;
    this.now = dependencies.now ?? (() => new Date());
  }

  saveFamily(actor: DirectorySession, input: FamilyInput): Family | AuthorizationDecision {
    if (!this.isDirectoryAdmin(actor, input.scope)) return DENIED;
    return this.dependencies.repository.transaction(() => {
      const existing = this.dependencies.repository.findFamily(input.id);
      const family: Family = existing
        ? { ...existing, scope: input.scope }
        : { ...input, parents: [], children: [] };
      this.dependencies.repository.saveFamily(family);
      this.mutate(actor, "family_saved", family.id);
      return family;
    });
  }

  linkParent(
    actor: DirectorySession,
    familyId: string,
    parent: ParentProfile,
  ): Family | AuthorizationDecision {
    return this.updateFamily(actor, familyId, "parent_linked", (family) => {
      if (
        family.parents.some(
          (current) => current.id === parent.id || current.userId === parent.userId,
        )
      )
        throw new DirectoryValidationError("A szülői kapcsolat már létezik.");
      return {
        ...family,
        parents: [
          ...family.parents,
          parent.optionalProfileConsent ? parent : { ...parent, optionalProfile: undefined },
        ],
      };
    });
  }

  linkChild(
    actor: DirectorySession,
    familyId: string,
    child: Child,
  ): Family | AuthorizationDecision {
    return this.updateFamily(actor, familyId, "child_linked", (family) => {
      if (!sameOrganization(family.scope, child.groupScope))
        throw new DirectoryValidationError("A gyermek csoportja más szervezethez tartozik.");
      if (family.children.some((current) => current.id === child.id))
        throw new DirectoryValidationError("A gyermekkapcsolat már létezik.");
      return { ...family, children: [...family.children, child] };
    });
  }

  assignGroup(
    actor: DirectorySession,
    familyId: string,
    childId: string,
    groupScope: Scope,
    schoolYearId: string,
  ): Family | AuthorizationDecision {
    return this.updateFamily(actor, familyId, "group_assigned", (family) => {
      if (!sameOrganization(family.scope, groupScope))
        throw new DirectoryValidationError("A csoport más szervezethez tartozik.");
      const child = family.children.find((current) => current.id === childId);
      if (!child) throw new DirectoryValidationError("A gyermek nem található.");
      return {
        ...family,
        children: family.children.map((current) =>
          current.id === childId ? { ...current, groupScope, schoolYearId } : current,
        ),
      };
    });
  }

  archive(actor: DirectorySession, familyId: string): Family | AuthorizationDecision {
    return this.setArchiveState(actor, familyId, true);
  }
  restore(actor: DirectorySession, familyId: string): Family | AuthorizationDecision {
    return this.setArchiveState(actor, familyId, false);
  }

  getVisible(actor: DirectorySession, familyId: string): DirectoryView | AuthorizationDecision {
    const family = this.dependencies.repository.findFamily(familyId);
    if (!family || family.archivedAt || !this.canAccess(actor, family, "read")) return DENIED;
    const includeSensitiveFields = this.hasAdministrativeGrant(actor, family);
    return {
      id: family.id,
      parents: family.parents.map((parent) =>
        includeSensitiveFields
          ? projectAdminProfile(parent)
          : { id: parent.id, displayName: parent.displayName },
      ),
      children: family.children.map(({ id, displayName, schoolYearId }) => ({
        id,
        displayName,
        schoolYearId,
      })),
    };
  }

  private updateFamily(
    actor: DirectorySession,
    familyId: string,
    eventType: "parent_linked" | "child_linked" | "group_assigned",
    update: (family: Family) => Family,
  ): Family | AuthorizationDecision {
    const family = this.dependencies.repository.findFamily(familyId);
    if (!family || family.archivedAt || !this.isDirectoryAdmin(actor, family.scope, family))
      return DENIED;
    return this.dependencies.repository.transaction(() => {
      const updated = update(family);
      this.dependencies.repository.saveFamily(updated);
      this.dependencies.repository.recalculateVisibility(updated.id);
      this.mutate(actor, eventType, updated.id);
      return updated;
    });
  }

  private setArchiveState(
    actor: DirectorySession,
    familyId: string,
    archived: boolean,
  ): Family | AuthorizationDecision {
    const family = this.dependencies.repository.findFamily(familyId);
    if (!family || !this.isDirectoryAdmin(actor, family.scope, family)) return DENIED;
    return this.dependencies.repository.transaction(() => {
      const updated = { ...family, archivedAt: archived ? this.now().toISOString() : undefined };
      this.dependencies.repository.saveFamily(updated);
      this.dependencies.repository.recalculateVisibility(updated.id);
      this.mutate(actor, archived ? "family_archived" : "family_restored", updated.id);
      return updated;
    });
  }

  private isDirectoryAdmin(actor: DirectorySession, scope: Scope, family?: Family): boolean {
    return (
      this.canAccess(actor, family ?? { id: "", scope, parents: [], children: [] }, "update") &&
      this.hasAdministrativeGrant(actor, family ?? { id: "", scope, parents: [], children: [] })
    );
  }

  private canAccess(actor: DirectorySession, family: Family, action: "read" | "update"): boolean {
    return this.accessScopes(family).some(
      (scope) =>
        this.dependencies.authorizer.authorize(actor, {
          action,
          resource: { kind: "family", scope },
        }).allowed,
    );
  }

  private hasAdministrativeGrant(actor: DirectorySession, family: Family): boolean {
    return this.dependencies.grants
      .findBySubjectId(actor.subjectId)
      .filter((grant) => !grant.revokedAt)
      .some((grant) => isAdminGrantForFamily(grant, family));
  }

  private accessScopes(family: Family): Scope[] {
    return [family.scope, ...family.children.map((child) => child.groupScope)];
  }
  private mutate(
    actor: DirectorySession,
    eventType: Parameters<DirectoryDependencies["audit"]["write"]>[0]["eventType"],
    familyId: string,
  ): void {
    this.dependencies.audit.write({
      actorId: actor.subjectId,
      eventType,
      occurredAt: this.now().toISOString(),
      relatedEntityId: familyId,
      summary: "Directory relationship changed",
    });
  }
}

export class DirectoryValidationError extends Error {}
function sameOrganization(first: Scope, second: Scope): boolean {
  return first.organizationId === second.organizationId;
}
function isAdminGrantForFamily(grant: RoleGrant, family: Family): boolean {
  return (
    isRoleScope(grant.role, grant.scope) &&
    (grant.role === "super_admin" || grant.role === "group_admin") &&
    [family.scope, ...family.children.map((child) => child.groupScope)].some((scope) =>
      scopeContains(grant.scope, scope),
    )
  );
}
function scopeContains(grant: Scope, resource: Scope): boolean {
  return (
    grant.organizationId === resource.organizationId &&
    (grant.type === "organization" || (grant.type === resource.type && grant.id === resource.id))
  );
}
function projectAdminProfile(
  parent: import("./types.ts").ParentProfile,
): import("./types.ts").ParentProfile {
  const { optionalProfile, optionalProfileConsent, ...safe } = parent;
  return optionalProfileConsent && optionalProfile ? { ...safe, optionalProfile } : safe;
}
