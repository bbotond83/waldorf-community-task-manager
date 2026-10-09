import { grantAllows, isAuthorizationVersion, isRoleScope } from "./role-policy.ts";
import type {
  AccessTransaction,
  AuditWriter,
  AuthorizationDecision,
  AuthorizationRequest,
  RoleGrant,
  RoleGrantInput,
  RoleGrantRepository,
  Session,
  UserRepository,
} from "./types.ts";
const DENIED_MESSAGE = "Nincs jogosultság" as const;
export class AccessService {
  private readonly users: UserRepository;
  private readonly grants: RoleGrantRepository;
  private readonly audit: AuditWriter;
  private readonly now: () => Date;
  private readonly transaction?: AccessTransaction;
  constructor(
    users: UserRepository,
    grants: RoleGrantRepository,
    audit: AuditWriter,
    now: () => Date = () => new Date(),
    transaction?: AccessTransaction,
  ) {
    this.users = users;
    this.grants = grants;
    this.audit = audit;
    this.now = now;
    this.transaction = transaction;
  }
  authorize(session: Session, request: AuthorizationRequest): AuthorizationDecision {
    const user = this.users.findById(session.subjectId);
    if (
      !user ||
      user.isActive !== true ||
      !isAuthorizationVersion(user.authorizationVersion) ||
      user.authorizationVersion !== session.authorizationVersion
    )
      return this.deny(session.subjectId, "reauthorization_required");
    const grants = this.grants.findBySubjectId(user.id);
    if (grants.some((grant) => !isRoleScope(grant.role, grant.scope)))
      return this.deny(user.id, "authorization_denied");
    return grants.some((grant) => grantAllows(grant, request))
      ? { allowed: true, code: "allowed" }
      : this.deny(user.id, "authorization_denied");
  }
  grantRole(actor: Session, input: RoleGrantInput): RoleGrant | AuthorizationDecision {
    return this.mutate(() => {
      if (!isRoleScope(input.role, input.scope))
        return this.deny(actor.subjectId, "authorization_denied");
      const decision = this.authorize(actor, {
        action: "manage",
        resource: { kind: "role_grant", scope: input.scope, field: input.role },
      });
      if (!decision.allowed) return decision;
      const existing = this.grants.findById(input.id);
      // Grant identity/subject/scope cannot be moved through an overwrite.
      if (
        existing &&
        (existing.subjectId !== input.subjectId ||
          existing.scope.id !== input.scope.id ||
          existing.scope.type !== input.scope.type ||
          existing.scope.organizationId !== input.scope.organizationId ||
          existing.revokedAt !== undefined)
      )
        return this.deny(actor.subjectId, "authorization_denied");
      if (existing && existing.role === input.role) return existing;
      const subject = this.users.findById(input.subjectId);
      if (
        !subject ||
        !isAuthorizationVersion(subject.authorizationVersion) ||
        subject.authorizationVersion === 2147483647
      )
        return this.deny(actor.subjectId, "reauthorization_required");
      const grant: RoleGrant = {
        ...input,
        grantedAt: existing?.grantedAt ?? this.now().toISOString(),
      };
      if (existing && !this.preservesAdministrator(existing, grant))
        return this.deny(actor.subjectId, "authorization_denied");
      this.grants.save(grant);
      this.users.save({ ...subject, authorizationVersion: subject.authorizationVersion + 1 });
      this.audit.write({
        actorId: actor.subjectId,
        eventType: "role_granted",
        occurredAt: this.now().toISOString(),
        relatedEntityId: grant.id,
        summary: "Role grant changed",
      });
      return grant;
    });
  }
  revokeRole(actor: Session, grantId: string): void | AuthorizationDecision {
    return this.mutate(() => {
      const grant = this.grants.findById(grantId);
      if (!grant) return this.deny(actor.subjectId, "authorization_denied");
      const decision = this.authorize(actor, {
        action: "manage",
        resource: { kind: "role_grant", scope: grant.scope, field: grant.role },
      });
      if (!decision.allowed) return decision;
      if (grant.revokedAt !== undefined) return;
      if (!this.preservesAdministrator(grant))
        return this.deny(actor.subjectId, "authorization_denied");
      const subject = this.users.findById(grant.subjectId);
      if (
        !subject ||
        !isAuthorizationVersion(subject.authorizationVersion) ||
        subject.authorizationVersion === 2147483647
      )
        return this.deny(actor.subjectId, "reauthorization_required");
      const revokedAt = this.now().toISOString();
      this.grants.save({ ...grant, revokedAt });
      this.users.save({ ...subject, authorizationVersion: subject.authorizationVersion + 1 });
      this.audit.write({
        actorId: actor.subjectId,
        eventType: "role_revoked",
        occurredAt: revokedAt,
        relatedEntityId: grant.id,
        summary: "Role grant changed",
      });
    });
  }
  private preservesAdministrator(removed: RoleGrant, replacement?: RoleGrant): boolean {
    if (
      removed.role !== "super_admin" ||
      removed.revokedAt !== undefined ||
      this.users.findById(removed.subjectId)?.isActive !== true
    )
      return true;
    if (!this.grants.list) return false;
    const survivors = this.grants.list().filter((grant) => grant.id !== removed.id);
    if (replacement) survivors.push(replacement);
    const subjects = new Set(
      survivors
        .filter(
          (grant) =>
            grant.role === "super_admin" &&
            grant.revokedAt === undefined &&
            isRoleScope(grant.role, grant.scope) &&
            grant.scope.organizationId === removed.scope.organizationId &&
            this.users.findById(grant.subjectId)?.isActive === true,
        )
        .map((grant) => grant.subjectId),
    );
    return subjects.size > 0;
  }
  private mutate<T>(operation: () => T): T | AuthorizationDecision {
    if (!this.transaction)
      return { allowed: false, code: "transaction_failed", message: DENIED_MESSAGE };
    try {
      return this.transaction.run(operation);
    } catch {
      return { allowed: false, code: "transaction_failed", message: DENIED_MESSAGE };
    }
  }
  private deny(
    actorId: string,
    code: "authorization_denied" | "reauthorization_required",
  ): AuthorizationDecision {
    this.audit.write({
      actorId,
      eventType: "authorization_denied",
      occurredAt: this.now().toISOString(),
      summary: "Authorization denied",
    });
    return { allowed: false, code, message: DENIED_MESSAGE };
  }
}
