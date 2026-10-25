import { beforeEach, expect, it, vi } from "vitest";
import { requestWorld } from "../support/request-world.ts";

vi.mock("server-only", () => ({}));
vi.mock("../../app/_identity/production-request.ts", async () =>
  (await import("../support/request-world.ts")).requestWorldModule(),
);
import { resolveAdminSession } from "../../app/admin/_lib/session.ts";
import { resolveParentSession } from "../../app/szulo/_lib/session.ts";
import { resolveTeacherSession } from "../../app/teacher/_lib/session.ts";
import { resolveAdminFacade } from "../../app/admin/_lib/facade.ts";
import { resolveParentFacade } from "../../app/szulo/_lib/facade.ts";
import { resolveTeacherFacade } from "../../app/teacher/_lib/facade.ts";
import { resolveAdminLookups } from "../../app/admin/_lib/request-lookups.ts";
import { mapApplicationResult } from "../../app/admin/_lib/action-state.ts";
import { mapParentResult } from "../../app/szulo/_lib/action-state.ts";
import * as result from "../../src/application/results.ts";

beforeEach(() => requestWorld.reset());

it("resolves signed-out, granted and forbidden sessions from the real access rules", async () => {
  for (const resolver of [resolveAdminSession, resolveParentSession, resolveTeacherSession])
    expect((await resolver()).state).toBe("signed-out");
  for (const [role, resolver] of [
    ["group_admin", resolveAdminSession],
    ["super_admin", resolveAdminSession],
    ["parent", resolveParentSession],
    ["teacher", resolveTeacherSession],
  ] as const) {
    requestWorld.signIn(role);
    expect((await resolver()).state, role).toBe("success");
  }
  requestWorld.signIn("parent");
  expect(await resolveAdminSession()).toEqual({ state: "denied", homePath: "/szulo/ertesitesek" });
  expect(await resolveTeacherSession()).toEqual({ state: "denied" });
  requestWorld.signIn("teacher");
  expect(await resolveParentSession()).toEqual({ state: "denied", homePath: "/teacher/schedule" });
});

it("takes the reach of an admin and the family of a parent from the database, not from constants", async () => {
  requestWorld.signIn("group_admin");
  const group = await resolveAdminSession();
  expect(group.state === "success" && group.data.scope).toEqual({
    id: "group-boroka",
    type: "group",
    organizationId: "org-napsugar",
  });
  requestWorld.signIn("super_admin");
  const organization = await resolveAdminSession();
  expect(organization.state === "success" && organization.data.scope.type).toBe("organization");
  requestWorld.signIn("parent");
  const parent = await resolveParentSession();
  expect(parent.state === "success" && parent.data.familyId).toBe("family-boroka");
  requestWorld.access.parent.grants = [];
  expect((await resolveParentSession()).state).toBe("denied");
});

it("reports a runtime or sign-in service that cannot answer as a configuration error with no facade", async () => {
  requestWorld.signIn("super_admin");
  requestWorld.setUnavailable(true);
  expect(await resolveAdminSession()).toEqual({
    state: "configuration-error",
    message: "A kapcsolat most nem érhető el.",
  });
  expect((await resolveParentSession()).state).toBe("configuration-error");
  expect((await resolveTeacherSession()).state).toBe("configuration-error");
  for (const resolver of [resolveAdminFacade, resolveParentFacade, resolveTeacherFacade])
    expect(await resolver()).toBeUndefined();
  expect(await resolveAdminLookups()).toMatchObject({ groups: [] });
});

it("returns the facades of the signed-in request, and none without a sign-in", async () => {
  for (const resolver of [resolveAdminFacade, resolveParentFacade, resolveTeacherFacade])
    expect(await resolver()).toBeUndefined();
  requestWorld.signIn("super_admin");
  expect(await resolveAdminFacade()).toBeDefined();
  expect(await resolveParentFacade()).toBeDefined();
  expect(await resolveTeacherFacade()).toBeDefined();
});

it("reports a database that cannot answer an access read as a configuration error", async () => {
  requestWorld.setAccessReadsFail(true);
  for (const [role, resolver] of [
    ["parent", resolveParentSession],
    ["teacher", resolveTeacherSession],
    ["group_admin", resolveAdminSession],
  ] as const) {
    requestWorld.signIn(role);
    expect((await resolver()).state, role).toBe("configuration-error");
  }
});

it("maps explicit application states to safe actionable presentation", () => {
  const outcomes = [
    result.success({ id: "invented" }),
    result.validation({ title: "required" }),
    result.denied(),
    result.conflict("VERSION_CONFLICT"),
    result.invalidated(),
    result.retryableFailure({ idempotencyKey: "safe-key", action: "save" }),
    result.terminalFailure(),
  ];
  const expected = [
    "success",
    "validation",
    "denied",
    "conflict",
    "invalidated",
    "retryable",
    "terminal",
  ];
  outcomes.forEach((outcome, index) => {
    expect(mapApplicationResult(outcome).state).toBe(expected[index]);
    expect(mapParentResult(outcome, "done").state).toBe(expected[index]);
  });
});
