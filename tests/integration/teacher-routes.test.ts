import { expect, it } from "vitest";
import { GET as listRedirect } from "../../app/munkatars/beosztas/route.ts";
import { GET as detailRedirect } from "../../app/munkatars/beosztas/[id]/route.ts";
import { compatibilityLocation } from "../../app/teacher/_lib/compatibility.ts";
import { parseTeacherFilters } from "../../app/teacher/_lib/filters.ts";
import { sessionGrantBindings } from "../../src/access/session-grants.ts";
import {
  AuthorizationContract,
  InMemoryAuthorizationVersions,
  type SessionContext,
} from "../../src/application/index.ts";
import { createSyntheticTeacherFacade, TEACHER_GROUPS } from "../../src/teacher-web/index.ts";
const session: SessionContext = {
  subjectId: "teacher",
  authorizationVersion: 1,
  ...sessionGrantBindings("teacher", "kindergarten_teacher", [TEACHER_GROUPS[0]!.scope]),
  roles: ["kindergarten_teacher"] as const,
  scopes: TEACHER_GROUPS.map((group) => group.scope),
  runtimeMode: "synthetic",
  isSynthetic: true,
};
it("Teacher compatibility GET responds307 no data or cookie", async () => {
  const response = listRedirect(
    new Request(
      "https://evil.invalid/munkatars/beosztas?csoport=group-oak&kezdet=2026-08-14&veg=2026-08-14",
    ),
  );
  expect(response.status).toBe(307);
  expect(response.headers.get("location")).toBe(
    "/teacher/schedule?groupId=group-oak&from=2026-08-14&to=2026-08-14",
  );
  expect(response.headers.get("set-cookie")).toBeNull();
  expect(await response.text()).toBe("");
});
it("Teacher compatibility unknown destinations and fixture switches drop", () =>
  expect(
    compatibilityLocation({
      host: "evil",
      returnTo: "https://evil",
      scenario: "terminal",
      fixture: "denied",
    }),
  ).toBe("/teacher/schedule"));
it("Teacher compatibility ambiguous duplicate empty malformed values never widen", () => {
  for (const params of [
    { csoport: ["group-oak", "group-sunflower"] },
    { groupId: "group-oak", csoport: "group-oak" },
    { from: "" },
    { kezdet: "<script>" },
    { veg: "2026-02-30" },
  ]) {
    const url = compatibilityLocation(params);
    expect(url).toContain("from=invalid&to=invalid");
    expect(url).not.toContain("script");
  }
});
it("Teacher compatibility valid canonical context preserves ungranted group", () =>
  expect(compatibilityLocation({ groupId: "group-ungranted", from: "bad", to: "bad" })).toBe(
    "/teacher/schedule?groupId=group-ungranted&from=invalid&to=invalid",
  ));
it("Teacher compatibility detail ids are one fixed encoded segment", async () => {
  const response = await detailRedirect(new Request("http://local/munkatars/beosztas/id"), {
    params: Promise.resolve({ id: "https://evil/a?b#c" }),
  });
  expect(response.headers.get("location")).toBe("/teacher/schedule/https%3A%2F%2Fevil%2Fa%3Fb%23c");
  expect(compatibilityLocation({}, "..")).toBe("/teacher/schedule/invalid-entry");
  expect(compatibilityLocation({}, "\n")).toBe("/teacher/schedule/invalid-entry");
});
it("Teacher destination authorizes before invalid sentinel and does no source calls", async () => {
  let reads = 0;
  const facade = createSyntheticTeacherFacade(
    new AuthorizationContract(new InMemoryAuthorizationVersions({ teacher: 1 })),
    "ready",
    {
      readCurrent: () => {
        reads++;
        return [];
      },
    },
  );
  const granted = parseTeacherFilters({ from: "invalid", to: "invalid" }, session);
  expect((await facade.getSchedule(session, granted)).state).toBe("validation");
  const ungranted = parseTeacherFilters(
    { groupId: "group-ungranted", from: "invalid", to: "invalid" },
    session,
  );
  expect((await facade.getSchedule(session, ungranted)).state).toBe("denied");
  expect(reads).toBe(0);
});
it("Teacher malformed group gets grantderived validation only, no protected read", async () => {
  let reads = 0;
  const facade = createSyntheticTeacherFacade(
    new AuthorizationContract(new InMemoryAuthorizationVersions({ teacher: 1 })),
    "ready",
    {
      readCurrent: () => {
        reads++;
        return [];
      },
    },
  );
  const destination = new URL(compatibilityLocation({ csoport: "<bad>" }), "http://local");
  const filters = parseTeacherFilters(Object.fromEntries(destination.searchParams), session);
  expect(filters.groupId).toBe("group-oak");
  expect((await facade.getSchedule(session, filters)).state).toBe("validation");
  expect(reads).toBe(0);
});
it("Teacher retry drops fixture without widening valid business context", () => {
  const filters = parseTeacherFilters(
    { groupId: "group-oak", from: "2026-08-14", to: "2026-08-14", fixture: "retryable" },
    session,
  );
  expect(filters.scenario).toBe("retryable");
  expect(
    compatibilityLocation({ groupId: filters.groupId, from: filters.from, to: filters.to }),
  ).toBe("/teacher/schedule?groupId=group-oak&from=2026-08-14&to=2026-08-14");
});
