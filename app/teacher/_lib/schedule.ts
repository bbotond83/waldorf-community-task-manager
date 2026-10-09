import type {
  ApplicationResult,
  SessionContext,
  TeacherApplicationFacade,
  TrackingModel,
} from "../../../src/application/index.ts";
import type { TeacherFilters } from "./filters.ts";

type ScheduleReader = Pick<TeacherApplicationFacade, "getSchedule">;

/**
 * Reads the schedule for every group the filter covers. Each group is its own authorised read, so
 * the all-groups view never reaches a group the teacher is not granted. Entries of all groups come
 * back in one list ordered by start time. A group that is denied or fails makes the whole result
 * that outcome; an empty group simply adds nothing.
 */
export async function readTeacherSchedule(
  facade: ScheduleReader,
  session: SessionContext,
  filters: TeacherFilters,
): Promise<ApplicationResult<TrackingModel>> {
  const range = teacherRange(filters);
  const scopes = filters.groupScopes.length ? filters.groupScopes : [filters.groupScope];
  const results: ApplicationResult<TrackingModel>[] = [];
  for (const groupScope of scopes) {
    const result = await facade.getSchedule(session, { groupScope, ...range });
    if (result.state !== "success" && result.state !== "empty") return result;
    results.push(result);
  }
  const first = results.find((result) => result.state === "success");
  if (!first || first.state !== "success") return results[0]!;
  const entries = results
    .flatMap((result) => (result.state === "success" ? result.data.entries : []))
    .toSorted((a, b) => a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id));
  return { ...first, data: Object.freeze({ entries: Object.freeze(entries) }) };
}

/** The range the detail page asks for; an empty limit is left out. */
export function teacherRange(filters: TeacherFilters): { from?: string; to?: string } {
  return {
    ...(filters.from === "" ? {} : { from: filters.from }),
    ...(filters.to === "" ? {} : { to: filters.to }),
  };
}
