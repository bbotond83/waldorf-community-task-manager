import type { Scope } from "../access/index.ts";
import type {
  ApplicationResult,
  TrackingEntry,
  TrackingModel,
  SessionContext,
} from "./contracts.ts";
import type { DomainOutcome, FacadePipeline } from "./facade-pipeline.ts";
import { denied, terminalFailure, validation } from "./results.ts";
import {
  isOptionalTrackingRange,
  isTrackingSource,
  matchesTrackingScope,
  projectTrackingEntry,
  type TrackingSourceRecord,
  type TrackingView,
} from "./tracking-model.ts";
export interface TeacherApplicationPort {
  getSchedule(input: {
    actorId: string;
    scope: Scope;
    view: TrackingView;
    from?: string;
    to?: string;
  }): Promise<DomainOutcome<{ entries: readonly TrackingSourceRecord[] }>>;
}
export class TeacherApplicationFacade {
  private readonly pipeline: FacadePipeline;
  private readonly domain: TeacherApplicationPort;
  constructor(pipeline: FacadePipeline, domain: TeacherApplicationPort) {
    this.pipeline = pipeline;
    this.domain = domain;
  }
  async getSchedule(
    session: SessionContext,
    input: { scope: Scope; view: TrackingView; from?: string; to?: string },
  ): Promise<ApplicationResult<TrackingModel>> {
    return this.pipeline.invoke<TrackingModel>({
      session,
      matrixRowId: "AUTH-TEACHER-TRACKING",
      action: "read",
      resource: "schedule",
      scope: input.scope,
      fields: ["SF-PARTICIPANT-NAME"],
      validate: () =>
        isOptionalTrackingRange(input.from, input.to)
          ? undefined
          : validation({ range: "VAL-DATE-RANGE" }),
      invoke: async () => {
        const outcome = await this.domain.getSchedule({ actorId: session.subjectId, ...input });
        if (!outcome || typeof outcome !== "object") throw new Error("Invalid tracking outcome");
        if (outcome.state !== "success" && outcome.state !== "recovery") {
          if (
            outcome.state === "empty" ||
            outcome.state === "denied" ||
            outcome.state === "invalidated" ||
            outcome.state === "validation"
          )
            return outcome;
          throw new Error("Unsupported tracking outcome");
        }
        const rows = outcome.data?.entries;
        if (!Array.isArray(rows) || !rows.every(isTrackingSource))
          throw new Error("Invalid tracking source");
        if (!rows.every((row) => matchesTrackingScope(row, input.scope)))
          return { state: "denied" };
        if (new Set(rows.map((row) => row.id)).size !== rows.length)
          throw new Error("Duplicate tracking identity");
        return rows.length ? { state: outcome.state, data: { entries: rows } } : { state: "empty" };
      },
      project: (model) =>
        Object.freeze({
          entries: Object.freeze(
            model.entries.map((row) => projectTrackingEntry(row as TrackingSourceRecord)),
          ),
        }),
    });
  }
  async getScheduleEntry(
    session: SessionContext,
    input: { scope: Scope; entryId: string; from?: string; to?: string },
  ): Promise<ApplicationResult<TrackingEntry>> {
    const schedule = await this.getSchedule(session, { ...input, view: { kind: "all" } });
    if (schedule.state === "recovery") return terminalFailure("SCHEDULE_RECOVERY_UNAVAILABLE");
    if (schedule.state === "empty") return denied();
    if (schedule.state !== "success") return schedule;
    const entry = schedule.data.entries.find((candidate) => candidate.id === input.entryId);
    if (!entry) return denied();
    return {
      state: "success",
      code: "SCHEDULE_ENTRY_READY",
      presentationCode: "APP-SUCCESS",
      focusTarget: "#fo-tartalom",
      announcement: "polite",
      data: entry,
    };
  }
}
