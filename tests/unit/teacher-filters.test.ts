import { expect, it } from "vitest";
import { sessionGrantBindings } from "../../src/access/session-grants.ts";
import type { SessionContext } from "../../src/application/index.ts";
import { TEACHER_GROUPS } from "../support/port-doubles.ts";
import {
  parseTeacherFilters,
  teacherDetailQuery,
  teacherGroupOptions,
  teacherFilterQuery,
  teacherScheduleHref,
} from "../../app/teacher/_lib/filters.ts";
const session: SessionContext = {
  subjectId: "teacher",
  authorizationVersion: 1,
  ...sessionGrantBindings(
    "teacher",
    "kindergarten_teacher",
    TEACHER_GROUPS.map((group) => group.scope),
  ),
  roles: ["kindergarten_teacher"] as const,
  scopes: TEACHER_GROUPS.map((group) => group.scope),
};
it("Teacher first visit is unfiltered: every granted group and no date limit", () => {
  const filters = parseTeacherFilters({}, session);
  expect(filters.groupId).toBe("");
  expect(filters.from).toBe("");
  expect(filters.to).toBe("");
  expect(filters.groupScopes.map((scope) => scope.id)).toEqual(["group-oak", "group-sunflower"]);
});
it("Teacher empty filter fields mean the same as absent ones", () => {
  const filters = parseTeacherFilters({ groupId: "", from: "", to: "" }, session);
  expect(filters).toMatchObject({ groupId: "", from: "", to: "" });
  expect(filters.groupScopes).toHaveLength(2);
});
it("Teacher a single date is a one-sided limit and a chosen group narrows the read", () => {
  const onlyFrom = parseTeacherFilters({ from: "2026-08-14" }, session);
  expect(onlyFrom).toMatchObject({ from: "2026-08-14", to: "" });
  const onlyTo = parseTeacherFilters({ groupId: "group-sunflower", to: "2026-08-20" }, session);
  expect(onlyTo).toMatchObject({ groupId: "group-sunflower", from: "", to: "2026-08-20" });
  expect(onlyTo.groupScopes.map((scope) => scope.id)).toEqual(["group-sunflower"]);
});
it("Teacher address query holds only filled values", () => {
  expect(teacherFilterQuery(parseTeacherFilters({}, session))).toBe("");
  expect(
    teacherFilterQuery(
      parseTeacherFilters({ groupId: "group-oak", from: "2026-08-13", to: "2026-08-15" }, session),
    ),
  ).toBe("groupId=group-oak&from=2026-08-13&to=2026-08-15");
  expect(teacherScheduleHref("")).toBe("/teacher/schedule");
  expect(teacherScheduleHref("from=2026-08-13")).toBe("/teacher/schedule?from=2026-08-13");
});
it("Teacher detail address names the entry's group and remembers the all-groups list", () => {
  const all = parseTeacherFilters({ from: "2026-08-13" }, session);
  const detailQuery = teacherDetailQuery(all, "group-sunflower");
  expect(detailQuery).toBe("groupId=group-sunflower&from=2026-08-13&allGroups=1");
  const detail = parseTeacherFilters(Object.fromEntries(new URLSearchParams(detailQuery)), session);
  expect(detail.groupId).toBe("group-sunflower");
  expect(teacherFilterQuery(detail)).toBe("from=2026-08-13");
  const single = parseTeacherFilters({ groupId: "group-oak" }, session);
  expect(teacherDetailQuery(single, "group-oak")).toBe("groupId=group-oak");
});
it("Teacher options exclude revoked inactive and other-subject grants", () => {
  expect(teacherGroupOptions({ ...session, isActive: false })).toEqual([]);
  expect(
    teacherGroupOptions({
      ...session,
      grants: session.grants.map((grant) => ({ ...grant, revokedAt: "now" })),
    }),
  ).toEqual([]);
  expect(
    teacherGroupOptions({
      ...session,
      grants: session.grants.map((grant) => ({ ...grant, subjectId: "other" })),
    }),
  ).toEqual([]);
});
it("Teacher supplied wellformed ungranted group never selects a different group", () => {
  const filters = parseTeacherFilters({ groupId: "group-ungranted" }, session);
  expect(filters.groupScope.id).toBe("group-ungranted");
  expect(filters.groupScopes.map((scope) => scope.id)).toEqual(["group-ungranted"]);
  expect(filters.groups.map((group) => group.scope.id)).not.toContain("group-ungranted");
});
it("Teacher all-groups view never reaches a group outside the grants", () => {
  const onlyOak = { ...session, grants: session.grants.filter((g) => g.scope.id === "group-oak") };
  expect(parseTeacherFilters({}, onlyOak).groupScopes.map((scope) => scope.id)).toEqual([
    "group-oak",
  ]);
});
it("Teacher duplicate malformed and impossible filters become safe validation", () => {
  for (const params of [
    { groupId: ["group-oak", "group-sunflower"] },
    { groupId: "<script>" },
    { from: "2026-02-30" },
    { from: ["2026-08-12"] },
    { to: ["", "2026-08-12"] },
  ]) {
    const filters = parseTeacherFilters(params, session);
    expect(filters.from).toBe("invalid");
    expect(filters.to).toBe("invalid");
    expect(JSON.stringify(filters)).not.toContain("script");
  }
});
it("Teacher no-grant context has no global fallback", () => {
  const filters = parseTeacherFilters({}, { ...session, grants: [] });
  expect(filters.groups).toEqual([]);
  expect(filters.groupId).toBe("no-current-group");
});
it("Teacher address carries no test selector: fixture and scenario words change nothing", () => {
  const plain = parseTeacherFilters({}, session);
  for (const params of [
    { fixture: "retryable" },
    { fixture: "unknown" },
    { scenario: "terminal" },
  ]) {
    const filters = parseTeacherFilters(params, session);
    expect("scenario" in filters).toBe(false);
    expect(filters).toEqual(plain);
    expect(teacherFilterQuery(filters)).not.toMatch(/fixture|scenario/);
  }
});
it("Teacher current labels require matching org and deduplicate grants", () => {
  expect(
    teacherGroupOptions({ ...session, grants: [...session.grants, session.grants[0]!] }),
  ).toHaveLength(2);
  expect(
    teacherGroupOptions({
      ...session,
      grants: [
        { ...session.grants[0]!, scope: { ...session.grants[0]!.scope, organizationId: "other" } },
      ],
    })[0]?.label,
  ).toBe("Engedélyezett csoport");
});
