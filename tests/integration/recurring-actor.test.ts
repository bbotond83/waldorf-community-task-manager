import { beforeEach, describe, expect, it, vi } from "vitest";

const world = vi.hoisted(() => ({
  parent: undefined as unknown,
  admin: undefined as unknown,
  teacher: undefined as unknown,
  request: undefined as unknown,
}));

vi.mock("server-only", () => ({}));
vi.mock("../../app/szulo/_lib/session.ts", () => ({
  resolveParentSession: async () => world.parent,
}));
vi.mock("../../app/teacher/_lib/session.ts", () => ({
  resolveTeacherSession: async () => world.teacher,
}));
vi.mock("../../app/admin/_lib/session.ts", () => ({
  resolveAdminSession: async () => world.admin,
}));
vi.mock("../../app/_identity/production-request.ts", () => ({
  productionRequest: async () => world.request,
}));

import {
  groupRecurringPath,
  RECURRING_BASE_PATH,
  resolveRecurringActor,
  resolveRecurringManager,
  resolveRecurringParent,
} from "../../app/_recurring/actor.ts";
import { resolveRecurringFacade } from "../../app/_recurring/facade.ts";

const GROUP_A = "33333333-3333-4333-8333-333333333333";
const GROUP_B = "44444444-4444-4444-8444-444444444444";
const orgScope = { id: "org", type: "organization", organizationId: "org" };
const session = { subjectId: "s" };

beforeEach(() => {
  world.parent = { state: "signed-out" };
  world.admin = { state: "signed-out" };
  world.teacher = { state: "signed-out" };
  world.request = { state: "unavailable" };
});

describe("the recurring person", () => {
  it("has the base paths of the two areas that keep recurring pages", () => {
    expect(RECURRING_BASE_PATH).toEqual({ szulo: "/szulo/ismetlodo", admin: "/admin/ismetlodo" });
  });

  it("is the signed-in parent with the family scope from the database, or nobody", async () => {
    expect(await resolveRecurringParent()).toBeUndefined();
    world.parent = { state: "denied" };
    expect(await resolveRecurringParent()).toBeUndefined();
    const familyScope = { id: "f", type: "family", organizationId: "org" };
    world.parent = { state: "success", data: { applicationSession: session, familyScope } };
    expect(await resolveRecurringParent()).toEqual({ session, scope: familyScope });
  });

  it("is a super admin with the community scope for any group, or nobody when the admin session is missing", async () => {
    expect(await resolveRecurringManager()).toBeUndefined();
    world.admin = {
      state: "success",
      data: { applicationSession: session, scope: orgScope, groupIds: [] },
    };
    const manager = await resolveRecurringManager();
    expect(manager?.isSuperAdmin).toBe(true);
    expect(manager?.scopeFor()).toEqual(orgScope);
    expect(manager?.scopeFor(GROUP_A)).toEqual(orgScope);
  });

  it("is a coordinator with the scope of each of their own groups only", async () => {
    world.admin = {
      state: "success",
      data: {
        applicationSession: session,
        scope: { id: GROUP_A, type: "group", organizationId: "org" },
        groupIds: [GROUP_A],
      },
    };
    const manager = await resolveRecurringManager();
    expect(manager?.isSuperAdmin).toBe(false);
    expect(manager?.scopeFor(GROUP_A)).toEqual({
      id: GROUP_A,
      type: "group",
      organizationId: "org",
    });
    expect(manager?.scopeFor(GROUP_B)).toBeUndefined();
    expect(manager?.scopeFor()).toBeUndefined();
  });
});

describe("the person of a recurring page in each area", () => {
  it("builds the group page address of each area", () => {
    for (const area of ["szulo", "teacher", "admin"] as const) {
      expect(groupRecurringPath(area, GROUP_A)).toBe(
        `/${area}/munkacsoportok/${GROUP_A}/ismetlodo`,
      );
    }
  });

  it("takes the family scope for a parent and the scope of the session for teacher and admin", async () => {
    const familyScope = { id: "f", type: "family", organizationId: "org" };
    world.parent = { state: "success", data: { applicationSession: session, familyScope } };
    expect(await resolveRecurringActor("szulo")).toEqual({
      area: "szulo",
      session,
      scope: familyScope,
    });
    world.teacher = { state: "success", data: { applicationSession: session, scope: orgScope } };
    expect(await resolveRecurringActor("teacher")).toEqual({
      area: "teacher",
      session,
      scope: orgScope,
    });
    world.admin = { state: "success", data: { applicationSession: session, scope: orgScope } };
    expect(await resolveRecurringActor("admin")).toEqual({
      area: "admin",
      session,
      scope: orgScope,
    });
  });

  it("is nobody when the area's session is not signed in", async () => {
    for (const area of ["szulo", "teacher", "admin"] as const) {
      expect(await resolveRecurringActor(area)).toBeUndefined();
    }
  });
});

describe("the recurring facade of a request", () => {
  it("is the one built for the signed-in person, and none when the request is not ready", async () => {
    expect(await resolveRecurringFacade()).toBeUndefined();
    world.request = { state: "signed-out" };
    expect(await resolveRecurringFacade()).toBeUndefined();
    const recurring = { name: "facade" };
    world.request = { state: "ready", accountId: "a", services: { recurring } };
    expect(await resolveRecurringFacade()).toBe(recurring);
  });
});
