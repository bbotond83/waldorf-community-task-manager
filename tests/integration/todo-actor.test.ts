import { describe, expect, it, vi } from "vitest";

const world = vi.hoisted(() => ({ request: undefined as unknown }));

vi.mock("server-only", () => ({}));
vi.mock("../../app/szulo/_lib/session.ts", () => ({
  resolveParentSession: async () => ({ state: "signed-out" }),
}));
vi.mock("../../app/teacher/_lib/session.ts", () => ({
  resolveTeacherSession: async () => ({ state: "signed-out" }),
}));
vi.mock("../../app/admin/_lib/session.ts", () => ({
  resolveAdminSession: async () => ({ state: "signed-out" }),
}));
vi.mock("../../app/_identity/production-request.ts", () => ({
  productionRequest: async () => world.request,
}));

import {
  groupManagePath,
  resolveTodoActor,
  resolveTodoManager,
  resolveTodoParent,
  TODO_BASE_PATH,
} from "../../app/_todo/actor.ts";
import { resolveTodoFacade } from "../../app/_todo/facade.ts";

const GROUP = "33333333-3333-4333-8333-333333333333";

describe("the addresses of the to-do pages", () => {
  it("name the list of each area and a group's management page in the parent and admin areas", () => {
    expect(TODO_BASE_PATH).toEqual({
      szulo: "/szulo/teendok",
      teacher: "/teacher/teendok",
      admin: "/admin/teendok",
    });
    expect(groupManagePath("szulo", GROUP)).toBe(`/szulo/munkacsoportok/${GROUP}/kezeles`);
    expect(groupManagePath("admin", GROUP)).toBe(`/admin/munkacsoportok/${GROUP}/kezeles`);
  });
});

describe("the person of a to-do request", () => {
  it("is nobody when the person is signed out, in every area", async () => {
    for (const area of ["szulo", "teacher", "admin"] as const) {
      expect(await resolveTodoActor(area)).toBeUndefined();
    }
    expect(await resolveTodoParent()).toBeUndefined();
    expect(await resolveTodoManager()).toBeUndefined();
  });
});

describe("the to-do facade of a request", () => {
  it("is the one built for the signed-in person, and none when the request is not ready", async () => {
    world.request = { state: "signed-out" };
    expect(await resolveTodoFacade()).toBeUndefined();
    const todo = { name: "facade" };
    world.request = { state: "ready", accountId: "a", services: { todo } };
    expect(await resolveTodoFacade()).toBe(todo);
  });
});
