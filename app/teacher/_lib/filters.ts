import type { Scope } from "../../../src/access/index.ts";
import type { SessionContext } from "../../../src/application/index.ts";
import {
  TEACHER_FIXTURE_SCENARIOS,
  TEACHER_GROUPS,
  type TeacherFixtureScenario,
} from "../../../src/teacher-web/index.ts";
import { safeFilterValues, type SearchParams } from "./compatibility.ts";
export const DEFAULT_TEACHER_FILTERS = Object.freeze({
  from: "2026-08-12",
  to: "2026-08-20",
  scenario: "ready" as TeacherFixtureScenario,
});
export type TeacherSearchParams = SearchParams;
export type TeacherGroupOption = Readonly<{ scope: Scope; label: string }>;
export type TeacherFilters = Readonly<{
  groupId: string;
  groupScope: Scope;
  from: string;
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
  const values = safeFilterValues(params);
  const fallback: Scope = {
    id: "no-current-group",
    type: "group",
    organizationId: "no-current-organization",
  };
  const groupId = values.groupId ?? groups[0]?.scope.id ?? fallback.id;
  const groupScope = groups.find((group) => group.scope.id === groupId)?.scope ?? {
    ...(groups[0]?.scope ?? fallback),
    id: groupId,
  };
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
    from: values.from ?? DEFAULT_TEACHER_FILTERS.from,
    to: values.to ?? DEFAULT_TEACHER_FILTERS.to,
    scenario,
  });
}
export function teacherFilterQuery(filters: TeacherFilters): string {
  return new URLSearchParams({
    groupId: filters.groupId,
    from: filters.from,
    to: filters.to,
  }).toString();
}
