import type {
  ApplicationResult,
  SessionContext,
  TeacherApplicationFacade,
  TrackingModel,
  WorkingGroupApplicationFacade,
} from "../../../src/application/index.ts";
import type { Scope } from "../../../src/access/index.ts";
import type { TeacherFilters, TeacherGroupOption } from "./filters.ts";

type ScheduleReader = Pick<TeacherApplicationFacade, "getSchedule">;

/** Reads the part of the community's schedule the filter names, in one authorised read. */
export function readTeacherSchedule(
  facade: ScheduleReader,
  session: SessionContext,
  scope: Scope,
  filters: TeacherFilters,
): Promise<ApplicationResult<TrackingModel>> {
  return facade.getSchedule(session, { scope, view: filters.view, ...teacherRange(filters) });
}

/** The range the detail page asks for; an empty limit is left out. */
export function teacherRange(filters: TeacherFilters): { from?: string; to?: string } {
  return {
    ...(filters.from === "" ? {} : { from: filters.from }),
    ...(filters.to === "" ? {} : { to: filters.to }),
  };
}

/** The working groups the filter offers; a list that cannot be read leaves only "Minden" and the community. */
export async function teacherGroupOptions(
  groups: Pick<WorkingGroupApplicationFacade, "list">,
  session: SessionContext,
  scope: Scope,
): Promise<readonly TeacherGroupOption[]> {
  const result = await groups.list(session, scope);
  if (result.state !== "success" && result.state !== "recovery") return [];
  return result.data.items.map((group) => ({ id: group.id, label: group.name }));
}
