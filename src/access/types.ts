export type Role = "parent" | "group_admin" | "kindergarten_teacher" | "super_admin";
export type ScopeType = "organization" | "group" | "family";
export interface Scope {
  id: string;
  type: ScopeType;
  organizationId: string;
}
export interface User {
  id: string;
  isActive: boolean;
  authorizationVersion: number;
}
export interface Session {
  subjectId: string;
  authorizationVersion: number;
}
export interface RoleGrant {
  id: string;
  subjectId: string;
  role: Role;
  scope: Scope;
  grantedAt: string;
  revokedAt?: string;
}
export interface AccessResource {
  kind: string;
  scope: Scope;
  field?: string;
}
export interface AuthorizationRequest {
  action: "read" | "create" | "update" | "delete" | "manage";
  resource: AccessResource;
}
export type AuthorizationCode =
  "allowed" | "authorization_denied" | "reauthorization_required" | "transaction_failed";
export interface AuthorizationDecision {
  allowed: boolean;
  code: AuthorizationCode;
  message?: "Nincs jogosultság";
}
export interface RedactedAuditEvent {
  actorId: string;
  eventType: "authorization_denied" | "role_granted" | "role_revoked";
  occurredAt: string;
  relatedEntityId?: string;
  summary: string;
}
export interface RoleGrantInput {
  id: string;
  subjectId: string;
  role: Role;
  scope: Scope;
}
export interface UserRepository {
  findById(userId: string): User | undefined;
  save(user: User): void;
  list?(): User[];
}
export interface RoleGrantRepository {
  findById(grantId: string): RoleGrant | undefined;
  findBySubjectId(subjectId: string): RoleGrant[];
  save(grant: RoleGrant): void;
  list?(): RoleGrant[];
}
export interface AuditWriter {
  write(event: RedactedAuditEvent): void;
}

/** Accepted only at explicit conversion boundaries, never normal assignment. */
export type SupportedLegacyRole = "read_only_staff" | "kindergarten_admin";
export type LegacyConversionGrant = Omit<RoleGrant, "role"> & { role: Role | SupportedLegacyRole };
export interface ConversionEvidence {
  operationId: string;
  grantId: string;
  subjectId: string;
  organizationId: string;
  originalRole: SupportedLegacyRole;
  currentRole: Role;
  outcome: "converted";
}
export interface AccessTransaction {
  run<T>(operation: () => T): T;
}
export interface ConversionStore extends AccessTransaction {
  listGrants(): LegacyConversionGrant[];
  listUsers(): User[];
  saveConvertedGrant(grant: RoleGrant): void;
  saveUser(user: User): void;
  appendConversionEvidence(evidence: ConversionEvidence): void;
  enforceCurrentRoles(): void;
}
