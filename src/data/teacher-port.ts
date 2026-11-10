import type { Scope } from "../access/index.ts";
import type { DomainOutcome, TeacherApplicationPort } from "../application/index.ts";
import type { DatabaseClient } from "../runtime/database/client.ts";
import type { TrackingSourceRecord, TrackingView } from "../application/tracking-model.ts";
import { DataGateway } from "./gateway.ts";
import { toItemsOutcome } from "./results.ts";
import { toScheduleEntry } from "./schedule.ts";
import { isUuid } from "./values.ts";

/**
 * Database adapter for the teacher application port (BR3.7, BR33.1): the schedule read through the schedule
 * function, with the date filter rule of BR33.2 kept in the teacher facade (the function repeats it). A group
 * id that names no group, or a group of another community, is `denied`.
 */
export class DatabaseTeacherPort implements TeacherApplicationPort {
  private readonly gateway: DataGateway;

  constructor(database: DatabaseClient) {
    this.gateway = new DataGateway(database);
  }

  async getSchedule(input: {
    scope: Scope;
    view: TrackingView;
    from?: string;
    to?: string;
  }): Promise<DomainOutcome<{ entries: readonly TrackingSourceRecord[] }>> {
    if (input.view.kind === "group" && !isUuid(input.view.groupId)) return { state: "denied" };
    const envelope = await this.gateway.call("schedule_get", {
      p_scope: input.view.kind,
      p_group_id: input.view.kind === "group" ? input.view.groupId : null,
      p_from: input.from ?? null,
      p_to: input.to ?? null,
    });
    return toItemsOutcome(envelope, (rows) => ({
      entries: Object.freeze(rows.map((row) => toScheduleEntry(row, input.scope.organizationId))),
    }));
  }
}

export function createTeacherPort(database: DatabaseClient): TeacherApplicationPort {
  return new DatabaseTeacherPort(database);
}
