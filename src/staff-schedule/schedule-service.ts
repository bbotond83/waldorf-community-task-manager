import type { AuthorizationDecision, Scope } from "../access/types.ts";
export interface Session { subjectId: string; authorizationVersion: number; }
export interface Authorizer { authorize(session: Session, request: { action: "read"; resource: { kind: "schedule"; scope: Scope } }): AuthorizationDecision; }
export interface ScheduleEntry { id: string; groupId: string; startsAt: string; endsAt: string; title: string; location: string; coordinationDisplayName?: string; }
export interface ScheduleRepository { list(groupId: string, from: string, to: string): ScheduleEntry[]; }
export type ScheduleResult = { state: "ready"; entries: ReadonlyArray<Readonly<ScheduleEntry>> } | { state: "empty" } | { state: "invalid-filter"; message: string } | { state: "denied"; message: "Nincs jogosultság" };
export class StaffScheduleService {
  private readonly repository: ScheduleRepository; private readonly authorizer: Authorizer;
  constructor(repository: ScheduleRepository, authorizer: Authorizer) { this.repository = repository; this.authorizer = authorizer; }
  get(actor: Session, input: { groupScope: Scope; from: string; to: string }): ScheduleResult { if (!isValidRange(input.from, input.to)) return { state: "invalid-filter", message: "Érvénytelen dátumszűrő." }; if (!this.authorizer.authorize(actor, { action: "read", resource: { kind: "schedule", scope: input.groupScope } }).allowed) return { state: "denied", message: "Nincs jogosultság" }; const entries = this.repository.list(input.groupScope.id, input.from, input.to).map(project); return entries.length ? { state: "ready", entries } : { state: "empty" }; }
}
function isValidRange(from: string, to: string): boolean { const start = new Date(from); const end = new Date(to); return !Number.isNaN(start.valueOf()) && !Number.isNaN(end.valueOf()) && start <= end && end.valueOf() - start.valueOf() <= 31 * 24 * 60 * 60 * 1000; }
function project(entry: ScheduleEntry): ScheduleEntry { return { id: entry.id, groupId: entry.groupId, startsAt: entry.startsAt, endsAt: entry.endsAt, title: entry.title, location: entry.location, ...(entry.coordinationDisplayName ? { coordinationDisplayName: entry.coordinationDisplayName } : {}) }; }
