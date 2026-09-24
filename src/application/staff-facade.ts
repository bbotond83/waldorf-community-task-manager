import type { Scope } from "../access/index.ts";
import type {
  ApplicationResult,
  ScheduleEntryModel,
  ScheduleModel,
  SessionContext,
} from "./contracts.ts";
import type { DomainOutcome, FacadePipeline } from "./facade-pipeline.ts";
import { validateDateRange } from "./validation.ts";

export interface StaffApplicationPort {
  getSchedule(input: {
    actorId: string;
    groupScope: Scope;
    from: string;
    to: string;
  }): Promise<DomainOutcome<ScheduleModel>>;
}

export class StaffApplicationFacade {
  private readonly pipeline: FacadePipeline;
  private readonly domain: StaffApplicationPort;

  constructor(pipeline: FacadePipeline, domain: StaffApplicationPort) {
    this.pipeline = pipeline;
    this.domain = domain;
  }

  getSchedule(
    session: SessionContext,
    input: { groupScope: Scope; from: string; to: string },
  ): Promise<ApplicationResult<ScheduleModel>> {
    const range = validateDateRange(input.from, input.to);
    if (range.state !== "success") return Promise.resolve(range);
    return this.pipeline.invoke({
      session,
      matrixRowId: "AUTH-STAFF-SCHEDULE",
      action: "read",
      resource: "schedule",
      scope: input.groupScope,
      fields: ["SF-PARTICIPANT-NAME"],
      invoke: () => this.domain.getSchedule({ actorId: session.subjectId, ...input }),
      project: (model) =>
        Object.freeze({ entries: Object.freeze(model.entries.map(projectEntry)) }),
    });
  }

  async getScheduleEntry(
    session: SessionContext,
    input: { groupScope: Scope; entryId: string; from: string; to: string },
  ): Promise<ApplicationResult<ScheduleEntryModel>> {
    const schedule = await this.getSchedule(session, input);
    if (schedule.state === "recovery") {
      return {
        state: "dependency-failure-terminal",
        code: "SCHEDULE_RECOVERY_UNAVAILABLE",
        presentationCode: "APP-DEPENDENCY-TERMINAL",
        focusTarget: "#fo-tartalom",
        announcement: "assertive",
      };
    }
    if (schedule.state !== "success") return withoutData(schedule);
    const entry = schedule.data.entries.find((candidate) => candidate.id === input.entryId);
    if (!entry) {
      return {
        state: "denied",
        code: "AUTHORIZATION_DENIED",
        presentationCode: "APP-DENIED",
        focusTarget: "#hozzaferes-megtagadva",
        announcement: "assertive",
      };
    }
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

function withoutData<T>(
  result: Exclude<ApplicationResult<unknown>, { state: "success" | "recovery" }>,
): ApplicationResult<T> {
  return result;
}

function projectEntry(entry: ScheduleEntryModel): ScheduleEntryModel {
  return Object.freeze({
    id: entry.id,
    startsAt: entry.startsAt,
    endsAt: entry.endsAt,
    title: entry.title,
    location: entry.location,
    ...(entry.coordinationDisplayName
      ? { coordinationDisplayName: entry.coordinationDisplayName }
      : {}),
  });
}
