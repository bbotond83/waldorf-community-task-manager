import type { AccessResource, AuditWriter, AuthorizationDecision, AuthorizationRequest, Role, RoleGrant, RoleGrantInput, RoleGrantRepository, Session, UserRepository } from "./types.ts";

const DENIED_MESSAGE = "Nincs jogosultság" as const;

export class AccessService {
  private readonly users: UserRepository;
  private readonly grants: RoleGrantRepository;
  private readonly audit: AuditWriter;
  private readonly now: () => Date;

  constructor(users: UserRepository, grants: RoleGrantRepository, audit: AuditWriter, now: () => Date = () => new Date()) {
    this.users = users;
    this.grants = grants;
    this.audit = audit;
    this.now = now;
  }

  authorize(session: Session, request: AuthorizationRequest): AuthorizationDecision {
    const user = this.users.findById(session.subjectId);
    if (!user || !user.isActive || user.authorizationVersion !== session.authorizationVersion) return this.deny(session.subjectId, "reauthorization_required");
    const allowed = this.grants.findBySubjectId(user.id).filter((grant) => !grant.revokedAt).some((grant) => grantAllows(grant.role, grant.scope, request));
    return allowed ? { allowed: true, code: "allowed" } : this.deny(user.id, "authorization_denied");
  }

  grantRole(actor: Session, input: RoleGrantInput): RoleGrant | AuthorizationDecision {
    const decision = this.authorize(actor, { action: "manage", resource: { kind: "role_grant", scope: input.scope, field: input.role } });
    if (!decision.allowed) return decision;
    const grant: RoleGrant = { ...input, grantedAt: this.now().toISOString() };
    this.grants.save(grant);
    this.audit.write({ actorId: actor.subjectId, eventType: "role_granted", occurredAt: grant.grantedAt, relatedEntityId: grant.id, summary: "Role grant changed" });
    return grant;
  }

  revokeRole(actor: Session, grantId: string): void | AuthorizationDecision {
    const grant = this.grants.findById(grantId);
    if (!grant) return this.deny(actor.subjectId, "authorization_denied");
    const decision = this.authorize(actor, { action: "manage", resource: { kind: "role_grant", scope: grant.scope, field: grant.role } });
    if (!decision.allowed || grant.revokedAt) return decision.allowed ? undefined : decision;
    const revokedAt = this.now().toISOString();
    this.grants.save({ ...grant, revokedAt });
    const subject = this.users.findById(grant.subjectId);
    if (subject) this.users.save({ ...subject, authorizationVersion: subject.authorizationVersion + 1 });
    this.audit.write({ actorId: actor.subjectId, eventType: "role_revoked", occurredAt: revokedAt, relatedEntityId: grant.id, summary: "Role grant changed" });
  }

  private deny(actorId: string, code: "authorization_denied" | "reauthorization_required"): AuthorizationDecision {
    this.audit.write({ actorId, eventType: "authorization_denied", occurredAt: this.now().toISOString(), summary: "Authorization denied" });
    return { allowed: false, code, message: DENIED_MESSAGE };
  }
}

function grantAllows(role: Role, grantScope: AccessResource["scope"], request: AuthorizationRequest): boolean {
  if (!scopeContains(grantScope, request.resource.scope)) return false;
  if (role === "super_admin") return true;
  if (role === "kindergarten_admin") return !(request.resource.kind === "role_grant" && request.resource.field === "super_admin");
  if (role === "group_admin") return request.resource.kind !== "role_grant";
  if (role === "parent") return parentCan(request);
  return request.action === "read" && (request.resource.kind === "schedule" || (request.resource.kind === "coordination" && request.resource.field === "display_name"));
}

function parentCan(request: AuthorizationRequest): boolean {
  const { action, resource } = request;
  if (resource.kind === "role_grant" || resource.field === "email" || resource.field === "phone" || resource.field === "optional_profile" || resource.field === "locality") return false;
  if (resource.kind === "assignment") return action === "read";
  if (resource.kind === "contribution") return action === "read" || action === "update";
  if (resource.kind === "swap_request" || resource.kind === "cancellation_request") return action === "create" || action === "read";
  if (resource.kind === "notification") return action === "read" || action === "update";
  return resource.kind === "family" && action === "read";
}

function scopeContains(grantScope: AccessResource["scope"], resourceScope: AccessResource["scope"]): boolean {
  return grantScope.organizationId === resourceScope.organizationId && (grantScope.type === "organization" || (grantScope.type === resourceScope.type && grantScope.id === resourceScope.id));
}
