import type { AuthorizationDecision, AuthorizationRequest, Scope } from "../access/types.ts";
export interface CoordinationAuthorizer { authorize(session: Session, request: AuthorizationRequest): AuthorizationDecision; }
export interface FamilyDirectory { getVisible(session: Session, familyId: string): unknown | AuthorizationDecision; }
export interface Session { subjectId: string; authorizationVersion: number; familyId?: string; }
export interface Task { id: string; scope: Scope; capacity: number; version: number; }
export type AssignmentState = "active" | "swap_pending" | "cancellation_pending" | "removed";
export interface Assignment { id: string; taskId: string; familyId: string; state: AssignmentState; version: number; }
export interface SwapRequest { id: string; sourceAssignmentId: string; targetAssignmentId: string; state: "auto_approved" | "admin_pending"; }
export interface CoordinationEvent { type: "assignment.changed"; assignmentId: string; }
export interface CoordinationAudit { actorId: string; eventType: "assignment_changed" | "swap_auto_approved" | "swap_pending"; relatedEntityId: string; summary: string; }
export interface CoordinationRepository { transaction<T>(operation: () => T): T; findTask(id: string): Task | undefined; findAssignment(id: string): Assignment | undefined; findAssignmentsByTask(taskId: string): Assignment[]; saveAssignment(assignment: Assignment): void; confirmSwap(swapId: string, familyId: string): void; confirmedSwapFamilies(swapId: string): string[]; }
export interface CoordinationEvents { publish(event: CoordinationEvent): void; }
export interface CoordinationAuditWriter { write(event: CoordinationAudit): void; }
export interface Contribution { assignmentId: string; familyId: string; text: string; }
