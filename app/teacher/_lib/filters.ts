import type { TrackingView } from "../../../src/application/tracking-model.ts";
import { safeFilterValues, type SearchParams } from "./compatibility.ts";

/** The filter value of "Egész közösség". An empty value is "Minden". */
export const COMMUNITY_FILTER = "community";

/** The schedule starts unfiltered: the whole community, with no date limit (W6). */
export const DEFAULT_TEACHER_FILTERS = Object.freeze({
  groupId: "",
  from: "",
  to: "",
});
export type TeacherSearchParams = SearchParams;
export type TeacherGroupOption = Readonly<{ id: string; label: string }>;
export type TeacherFilters = Readonly<{
  /** Empty means everything; `COMMUNITY_FILTER` the community-wide items; otherwise one working group. */
  groupId: string;
  view: TrackingView;
  /** Empty means no limit. */
  from: string;
  /** Empty means no limit. */
  to: string;
  groups: readonly TeacherGroupOption[];
}>;

function viewOf(groupId: string): TrackingView {
  if (groupId === "") return { kind: "all" };
  if (groupId === COMMUNITY_FILTER) return { kind: "community" };
  return { kind: "group", groupId };
}

export function parseTeacherFilters(
  params: TeacherSearchParams,
  groups: readonly TeacherGroupOption[],
): TeacherFilters {
  // A filter field left empty (the "all" choice, an empty date) is the same as no value at all.
  const values = safeFilterValues(
    Object.fromEntries(Object.entries(params).filter(([, value]) => value !== "")),
  );
  const groupId = values.groupId ?? DEFAULT_TEACHER_FILTERS.groupId;
  return Object.freeze({
    groups,
    groupId,
    view: viewOf(groupId),
    from: values.from ?? DEFAULT_TEACHER_FILTERS.from,
    to: values.to ?? DEFAULT_TEACHER_FILTERS.to,
  });
}
/** The address query of the schedule list: only filled values, so a cleared filter stays bare. */
export function teacherFilterQuery(filters: TeacherFilters): string {
  const query = new URLSearchParams();
  if (filters.groupId !== "") query.set("groupId", filters.groupId);
  if (filters.from !== "") query.set("from", filters.from);
  if (filters.to !== "") query.set("to", filters.to);
  return query.toString();
}
/** The schedule address for a query, without a dangling question mark. */
export function teacherScheduleHref(query: string): string {
  return query ? `/teacher/schedule?${query}` : "/teacher/schedule";
}
/** The name shown for an entry: its working group's, or the whole community's. */
export function teacherGroupLabel(filters: TeacherFilters, groupId: string | null): string {
  if (groupId === null) return "Egész közösség";
  return filters.groups.find((group) => group.id === groupId)?.label ?? "";
}
