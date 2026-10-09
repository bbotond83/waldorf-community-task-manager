import { expect, it } from "vitest";
import { sessionGrantBindings } from "../../src/access/session-grants.ts";
import type { SessionContext } from "../../src/application/index.ts";
import { TEACHER_GROUPS } from "../../src/teacher-web/index.ts";
import {
  parseTeacherFilters,
  teacherGroupOptions,
  teacherFilterQuery,
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
  runtimeMode: "synthetic",
  isSynthetic: true,
};
it("Teacher default uses a current granted group and retained date window", () => {
  const filters = parseTeacherFilters({}, session);
  expect(filters.groupId).toBe("group-oak");
  expect(filters.from).toBe("2026-08-12");
  expect(filters.to).toBe("2026-08-20");
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
  expect(filters.groups.map((group) => group.scope.id)).not.toContain("group-ungranted");
});
it("Teacher duplicate malformed and impossible filters become safe validation", () => {
  for (const params of [
    { groupId: ["group-oak", "group-sunflower"] },
    { groupId: "<script>" },
    { from: "2026-02-30" },
    { from: ["2026-08-12"] },
    { to: "" },
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
it("Teacher fixture selector is synthetic-only bounded and not business context", () => {
  expect(parseTeacherFilters({ fixture: "retryable" }, session).scenario).toBe("retryable");
  expect(parseTeacherFilters({ fixture: "unknown" }, session).scenario).toBe("ready");
  expect(parseTeacherFilters({ scenario: "terminal" }, session).scenario).toBe("ready");
  expect(
    parseTeacherFilters(
      { fixture: "terminal" },
      { ...session, isSynthetic: false, runtimeMode: "production" },
    ).scenario,
  ).toBe("ready");
  expect(teacherFilterQuery(parseTeacherFilters({ fixture: "terminal" }, session))).not.toMatch(
    /fixture|scenario/,
  );
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
