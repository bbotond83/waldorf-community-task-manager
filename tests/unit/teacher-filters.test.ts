import { expect, it } from "vitest";
import { TEACHER_GROUPS } from "../support/port-doubles.ts";
import {
  COMMUNITY_FILTER,
  parseTeacherFilters,
  teacherFilterQuery,
  teacherGroupLabel,
  teacherScheduleHref,
} from "../../app/teacher/_lib/filters.ts";

const groups = TEACHER_GROUPS.map((group) => ({ id: group.scope.id, label: group.label }));

it("Teacher first visit is unfiltered: the whole community and no date limit (W6)", () => {
  const filters = parseTeacherFilters({}, groups);
  expect(filters.groupId).toBe("");
  expect(filters.from).toBe("");
  expect(filters.to).toBe("");
  expect(filters.view).toEqual({ kind: "all" });
  expect(filters.groups).toEqual(groups);
});
it("Teacher empty filter fields mean the same as absent ones", () => {
  const filters = parseTeacherFilters({ groupId: "", from: "", to: "" }, groups);
  expect(filters).toMatchObject({ groupId: "", from: "", to: "" });
  expect(filters.view).toEqual({ kind: "all" });
});
it("Teacher a single date is a one-sided limit and a chosen group narrows the read", () => {
  const onlyFrom = parseTeacherFilters({ from: "2026-08-14" }, groups);
  expect(onlyFrom).toMatchObject({ from: "2026-08-14", to: "" });
  const onlyTo = parseTeacherFilters({ groupId: "group-sunflower", to: "2026-08-20" }, groups);
  expect(onlyTo).toMatchObject({ groupId: "group-sunflower", from: "", to: "2026-08-20" });
  expect(onlyTo.view).toEqual({ kind: "group", groupId: "group-sunflower" });
});
it("Teacher the community filter reads only the community-wide items (W6)", () => {
  const filters = parseTeacherFilters({ groupId: COMMUNITY_FILTER }, groups);
  expect(filters.groupId).toBe(COMMUNITY_FILTER);
  expect(filters.view).toEqual({ kind: "community" });
});
it("Teacher address query holds only filled values", () => {
  expect(teacherFilterQuery(parseTeacherFilters({}, groups))).toBe("");
  expect(
    teacherFilterQuery(
      parseTeacherFilters({ groupId: "group-oak", from: "2026-08-13", to: "2026-08-15" }, groups),
    ),
  ).toBe("groupId=group-oak&from=2026-08-13&to=2026-08-15");
  expect(teacherScheduleHref("")).toBe("/teacher/schedule");
  expect(teacherScheduleHref("from=2026-08-13")).toBe("/teacher/schedule?from=2026-08-13");
});
it("Teacher entry labels name the entry's working group, or the whole community", () => {
  const filters = parseTeacherFilters({}, groups);
  expect(teacherGroupLabel(filters, "group-oak")).toBe("Tölgyfa csoport");
  expect(teacherGroupLabel(filters, null)).toBe("Egész közösség");
  expect(teacherGroupLabel(filters, "ismeretlen")).toBe("");
});
it("Teacher a well-formed unknown group keeps its own value and never selects another group", () => {
  const filters = parseTeacherFilters({ groupId: "group-unknown" }, groups);
  expect(filters.view).toEqual({ kind: "group", groupId: "group-unknown" });
  expect(filters.groups.map((group) => group.id)).not.toContain("group-unknown");
});
it("Teacher duplicate malformed and impossible filters become safe validation", () => {
  for (const params of [
    { groupId: ["group-oak", "group-sunflower"] },
    { groupId: "<script>" },
    { from: "2026-02-30" },
    { from: ["2026-08-12"] },
    { to: ["", "2026-08-12"] },
  ]) {
    const filters = parseTeacherFilters(params, groups);
    expect(filters.from).toBe("invalid");
    expect(filters.to).toBe("invalid");
    expect(JSON.stringify(filters)).not.toContain("script");
  }
});
it("Teacher address carries no test selector: fixture and scenario words change nothing", () => {
  const plain = parseTeacherFilters({}, groups);
  for (const params of [
    { fixture: "retryable" },
    { fixture: "unknown" },
    { scenario: "terminal" },
  ]) {
    const filters = parseTeacherFilters(params, groups);
    expect("scenario" in filters).toBe(false);
    expect(filters).toEqual(plain);
    expect(teacherFilterQuery(filters)).not.toMatch(/fixture|scenario/);
  }
});
