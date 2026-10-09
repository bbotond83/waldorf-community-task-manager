import type { Scope } from "../../../src/access/index.ts";
import type { SessionContext } from "../../../src/application/index.ts";
import {
  TEACHER_FIXTURE_SCENARIOS,
  TEACHER_GROUPS,
  type TeacherFixtureScenario,
} from "../../../src/teacher-web/index.ts";
import { safeFilterValues, type SearchParams } from "./compatibility.ts";
/**
 * The schedule starts unfiltered: no group chosen means every group the teacher is granted, and
 * empty dates mean no date limit.
 */
export const DEFAULT_TEACHER_FILTERS = Object.freeze({
  groupId: "",
  from: "",
  to: "",
  scenario: "ready" as TeacherFixtureScenario,
});
export type TeacherSearchParams = SearchParams;
export type TeacherGroupOption = Readonly<{ scope: Scope; label: string }>;
export type TeacherFilters = Readonly<{
  /** Empty means every granted group. */
  groupId: string;
  /** The scope a single-group read uses (a representative scope when `groupId` is empty). */
  groupScope: Scope;
  /** The scopes the schedule is read for: every granted group, or the one chosen group. */
  groupScopes: readonly Scope[];
  /** True on a detail address that was opened from the all-groups list. */
  returnToAllGroups: boolean;
  /** Empty means no limit. */
  from: string;
  /** Empty means no limit. */
  to: string;
  scenario: TeacherFixtureScenario;
  groups: readonly TeacherGroupOption[];
}>;
export function teacherGroupOptions(session: SessionContext): readonly TeacherGroupOption[] {
  if (!session.isActive) return [];
  const seen = new Set<string>();
  return Object.freeze(
    session.grants
      .filter(
        (grant) =>
          grant.subjectId === session.subjectId &&
          grant.role === "kindergarten_teacher" &&
          grant.revokedAt === undefined &&
          grant.scope.type === "group",
      )
      .flatMap((grant) => {
        const key = `${grant.scope.organizationId}:${grant.scope.id}`;
        if (seen.has(key)) return [];
        seen.add(key);
        const label =
          TEACHER_GROUPS.find(
            (group) =>
              group.scope.id === grant.scope.id &&
              group.scope.organizationId === grant.scope.organizationId,
          )?.label ?? "Engedélyezett csoport";
        return [Object.freeze({ scope: grant.scope, label })];
      }),
  );
}
export function parseTeacherFilters(
  params: TeacherSearchParams,
  session: SessionContext,
): TeacherFilters {
  const groups = teacherGroupOptions(session);
  // A filter field left empty (the "all" choice, an empty date) is the same as no value at all.
  const values = safeFilterValues(
    Object.fromEntries(Object.entries(params).filter(([, value]) => value !== "")),
  );
  const fallback: Scope = {
    id: "no-current-group",
    type: "group",
    organizationId: "no-current-organization",
  };
  // No chosen group means every granted group; with no grant at all the read is made for a
  // group nobody holds, so it is denied exactly as before.
  const groupId = values.groupId ?? (groups.length ? "" : fallback.id);
  const groupScope = groups.find((group) => group.scope.id === groupId)?.scope ?? {
    ...(groups[0]?.scope ?? fallback),
    id: groupId === "" ? (groups[0]?.scope.id ?? fallback.id) : groupId,
  };
  const groupScopes: readonly Scope[] =
    groupId === ""
      ? Object.freeze(groups.map((group) => group.scope))
      : Object.freeze([groupScope]);
  const returnToAllGroups = groupId !== "" && params.allGroups === "1";
  const fixture = params.fixture;
  const scenario =
    session.runtimeMode === "synthetic" &&
    session.isSynthetic &&
    typeof fixture === "string" &&
    TEACHER_FIXTURE_SCENARIOS.includes(fixture as TeacherFixtureScenario)
      ? (fixture as TeacherFixtureScenario)
      : "ready";
  return Object.freeze({
    groups,
    groupId,
    groupScope,
    groupScopes,
    returnToAllGroups,
    from: values.from ?? DEFAULT_TEACHER_FILTERS.from,
    to: values.to ?? DEFAULT_TEACHER_FILTERS.to,
    scenario,
  });
}
/** The address query of the schedule list: only filled values, so a cleared filter stays bare. */
export function teacherFilterQuery(filters: TeacherFilters): string {
  const query = new URLSearchParams();
  if (filters.groupId !== "" && !filters.returnToAllGroups) query.set("groupId", filters.groupId);
  if (filters.from !== "") query.set("from", filters.from);
  if (filters.to !== "") query.set("to", filters.to);
  return query.toString();
}
/** The address query of one entry's detail page; it always names the entry's own group. */
export function teacherDetailQuery(filters: TeacherFilters, entryGroupId: string): string {
  const query = new URLSearchParams({ groupId: entryGroupId });
  if (filters.from !== "") query.set("from", filters.from);
  if (filters.to !== "") query.set("to", filters.to);
  if (filters.groupId === "" || filters.returnToAllGroups) query.set("allGroups", "1");
  return query.toString();
}
/** The schedule address for a query, without a dangling question mark. */
export function teacherScheduleHref(query: string): string {
  return query ? `/teacher/schedule?${query}` : "/teacher/schedule";
}
