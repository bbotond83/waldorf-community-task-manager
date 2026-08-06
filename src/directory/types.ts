import type { AuthorizationDecision, AuthorizationRequest, RoleGrant, RoleGrantRepository, Scope } from "../access/types.ts";

export type { RoleGrantRepository, Scope };
export interface DirectoryAuthorizer { authorize(session: DirectorySession, request: AuthorizationRequest): AuthorizationDecision; }
export interface DirectorySession { subjectId: string; authorizationVersion: number; }
export interface ParentProfile { id: string; userId: string; displayName: string; email?: string; phone?: string; locality?: string; optionalProfile?: string; optionalProfileConsent?: boolean; }
export interface Child { id: string; displayName: string; groupScope: Scope; schoolYearId: string; }
export interface Family { id: string; scope: Scope; parents: ParentProfile[]; children: Child[]; archivedAt?: string; }
export interface FamilyInput { id: string; scope: Scope; }
export interface DirectoryView { id: string; parents: Array<Pick<ParentProfile, "id" | "displayName"> & Partial<Pick<ParentProfile, "email" | "phone" | "locality" | "optionalProfile">>>; children: Array<Pick<Child, "id" | "displayName" | "schoolYearId">>; }
export interface DirectoryAuditEvent { actorId: string; eventType: "family_saved" | "parent_linked" | "child_linked" | "group_assigned" | "family_archived" | "family_restored"; occurredAt: string; relatedEntityId: string; summary: string; }
export interface DirectoryAuditWriter { write(event: DirectoryAuditEvent): void; }
export interface DirectoryRepository { transaction<T>(operation: () => T): T; findFamily(id: string): Family | undefined; saveFamily(family: Family): void; recalculateVisibility(familyId: string): void; }
export interface DirectoryDependencies { repository: DirectoryRepository; authorizer: DirectoryAuthorizer; grants: RoleGrantRepository; audit: DirectoryAuditWriter; now?: () => Date; }
export type { RoleGrant };
