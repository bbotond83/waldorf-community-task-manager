export type Role = "super_admin" | "kindergarten_admin" | "group_admin" | "parent" | "read_only_staff";
export type ScopeType = "organization" | "group" | "family";
export interface Scope { id: string; type: ScopeType; organizationId: string; }
export interface User { id: string; isActive: boolean; authorizationVersion: number; }
export interface Session { subjectId: string; authorizationVersion: number; }
export interface RoleGrant { id: string; subjectId: string; role: Role; scope: Scope; grantedAt: string; revokedAt?: string; }
export interface AccessResource { kind: string; scope: Scope; field?: string; }
export interface AuthorizationRequest { action: "read" | "create" | "update" | "delete" | "manage"; resource: AccessResource; }
export type AuthorizationCode = "allowed" | "authorization_denied" | "reauthorization_required";
export interface AuthorizationDecision { allowed: boolean; code: AuthorizationCode; message?: "Nincs jogosultság"; }
export interface RedactedAuditEvent { actorId: string; eventType: "authorization_denied" | "role_granted" | "role_revoked"; occurredAt: string; relatedEntityId?: string; summary: string; }
export interface RoleGrantInput { id: string; subjectId: string; role: Role; scope: Scope; }
export interface UserRepository { findById(userId: string): User | undefined; save(user: User): void; }
export interface RoleGrantRepository { findById(grantId: string): RoleGrant | undefined; findBySubjectId(subjectId: string): RoleGrant[]; save(grant: RoleGrant): void; }
export interface AuditWriter { write(event: RedactedAuditEvent): void; }
