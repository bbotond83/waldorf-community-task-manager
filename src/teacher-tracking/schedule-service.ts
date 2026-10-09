import type { AuthorizationDecision, Scope } from "../access/types.ts";
import {
  isTrackingRange,
  isTrackingSource,
  matchesTrackingScope,
  projectTrackingEntry,
  type TrackingEntry,
  type TrackingSourceRecord,
} from "./tracking-model.ts";
export interface Session {
  subjectId: string;
  authorizationVersion: number;
}
export interface Authorizer {
  authorize(
    session: Session,
    request: { action: "read"; resource: { kind: "schedule"; scope: Scope } },
  ): AuthorizationDecision;
}
export interface ScheduleRepository {
  list(groupId: string, from: string, to: string): readonly TrackingSourceRecord[];
}
export type ScheduleResult =
  | { state: "ready"; entries: readonly TrackingEntry[] }
  | { state: "empty" }
  | { state: "invalid-filter"; message: string }
  | { state: "denied"; message: "Nincs jogosultság" }
  | { state: "dependency-failure-terminal" };
export class TeacherScheduleService {
  private readonly repository: ScheduleRepository;
  private readonly authorizer: Authorizer;
  constructor(repository: ScheduleRepository, authorizer: Authorizer) {
    this.repository = repository;
    this.authorizer = authorizer;
  }
  get(actor: Session, input: { groupScope: Scope; from: string; to: string }): ScheduleResult {
    if (
      !this.authorizer.authorize(actor, {
        action: "read",
        resource: { kind: "schedule", scope: input.groupScope },
      }).allowed
    )
      return { state: "denied", message: "Nincs jogosultság" };
    if (!isTrackingRange(input.from, input.to))
      return { state: "invalid-filter", message: "Érvénytelen dátumszűrő." };
    try {
      const rows = this.repository.list(input.groupScope.id, input.from, input.to);
      if (!Array.isArray(rows) || !rows.every(isTrackingSource))
        return { state: "dependency-failure-terminal" };
      if (!rows.every((row) => matchesTrackingScope(row, input.groupScope)))
        return { state: "denied", message: "Nincs jogosultság" };
      if (new Set(rows.map((row) => row.id)).size !== rows.length)
        throw new Error("Duplicate tracking identity");
      const entries = Object.freeze(rows.map(projectTrackingEntry));
      return entries.length ? { state: "ready", entries } : { state: "empty" };
    } catch {
      return { state: "dependency-failure-terminal" };
    }
  }
}
