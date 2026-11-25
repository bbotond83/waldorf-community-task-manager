import { beforeEach, describe, expect, it, vi } from "vitest";

const TASK = "11111111-1111-4111-8111-111111111111";
const GROUP = "33333333-3333-4333-8333-333333333333";
const EVENT = "55555555-5555-4555-8555-555555555555";

const world = vi.hoisted(() => ({
  actor: undefined as unknown,
  areas: [] as string[],
  groups: undefined as unknown,
}));

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("../../app/_todo/actor.ts", () => ({
  resolveTodoActor: async (area: string) => {
    world.areas.push(area);
    return world.actor;
  },
}));
vi.mock("../../app/_todo/TodoScreens.tsx", () => ({
  parseTodoFilters: (search: unknown) => ({ parsed: search }),
  parseManageTab: (value: unknown) => (value === "tagok" ? "members" : "todo"),
  TodoListScreen: (props: unknown) => ({ screen: "list", props }),
  TodoDetailScreen: (props: unknown) => ({ screen: "detail", props }),
  MyTasksScreen: (props: unknown) => ({ screen: "mine", props }),
  TodoManageScreen: (props: unknown) => ({ screen: "manage", props }),
  TodoFormScreen: (props: unknown) => ({ screen: "form", props }),
  TodoPullScreen: (props: unknown) => ({ screen: "pull", props }),
}));
vi.mock("../../app/teacher/_lib/facade.ts", () => ({
  resolveWorkingGroupFacade: async () => world.groups,
}));

import AdminGroupManagePage from "../../app/admin/munkacsoportok/[id]/kezeles/page.tsx";
import AdminGroupNewTodoPage from "../../app/admin/munkacsoportok/[id]/kezeles/teendo/page.tsx";
import AdminGroupEditTodoPage from "../../app/admin/munkacsoportok/[id]/kezeles/teendo/[taskId]/page.tsx";
import AdminEventPullPage from "../../app/admin/esemenyek/[id]/teendok/page.tsx";
import AdminTodoPage from "../../app/admin/teendok/page.tsx";
import AdminTodoDetailPage from "../../app/admin/teendok/[id]/page.tsx";
import AdminEditTodoPage from "../../app/admin/teendok/[id]/szerkesztes/page.tsx";
import AdminNewTodoPage from "../../app/admin/teendok/uj/page.tsx";
import ParentEventPullPage from "../../app/szulo/esemenyek/[id]/teendok/page.tsx";
import MyTasksPage from "../../app/szulo/feladataim/page.tsx";
import ParentGroupManagePage from "../../app/szulo/munkacsoportok/[id]/kezeles/page.tsx";
import ParentGroupNewTodoPage from "../../app/szulo/munkacsoportok/[id]/kezeles/teendo/page.tsx";
import ParentGroupEditTodoPage from "../../app/szulo/munkacsoportok/[id]/kezeles/teendo/[taskId]/page.tsx";
import ParentTodoPage from "../../app/szulo/teendok/page.tsx";
import ParentTodoDetailPage from "../../app/szulo/teendok/[id]/page.tsx";
import TeacherTodoPage from "../../app/teacher/teendok/page.tsx";
import TeacherTodoDetailPage from "../../app/teacher/teendok/[id]/page.tsx";

const params = (id: string) => ({ params: Promise.resolve({ id }) });
const taskParams = (id: string, taskId: string) => ({ params: Promise.resolve({ id, taskId }) });
const search = (values: Record<string, string | undefined> = {}) => ({
  searchParams: Promise.resolve(values),
});

beforeEach(() => {
  world.actor = { area: "szulo" };
  world.areas = [];
  world.groups = undefined;
});

describe("the list and task pages", () => {
  it("open the list in each area with the signed-in person of that area and the checked filters", async () => {
    for (const [page, area] of [
      [ParentTodoPage, "szulo"],
      [TeacherTodoPage, "teacher"],
      [AdminTodoPage, "admin"],
    ] as const) {
      world.areas = [];
      const node = await page(search({ allapot: "open" }));
      expect(world.areas).toEqual([area]);
      expect(node).toMatchObject({
        props: { actor: world.actor, filters: { parsed: { allapot: "open" } } },
      });
    }
  });

  it("open a task page in each area, and refuse an address that is not an identifier", async () => {
    for (const page of [ParentTodoDetailPage, TeacherTodoDetailPage, AdminTodoDetailPage]) {
      expect(await page(params(TASK))).toMatchObject({ props: { taskId: TASK } });
      await expect(page(params("nem-azonosito"))).rejects.toThrow("NOT_FOUND");
    }
    expect(world.areas).toEqual(["szulo", "teacher", "admin"]);
  });

  it("render nothing for a person who is not signed in", async () => {
    world.actor = undefined;
    expect(await ParentTodoPage(search())).toBeNull();
    expect(await TeacherTodoPage(search())).toBeNull();
    expect(await AdminTodoPage(search())).toBeNull();
    expect(await MyTasksPage()).toBeNull();
    expect(await ParentTodoDetailPage(params(TASK))).toBeNull();
    expect(await ParentGroupManagePage({ ...params(GROUP), ...search() })).toBeNull();
    expect(await ParentEventPullPage(params(EVENT))).toBeNull();
    expect(await AdminEventPullPage(params(EVENT))).toBeNull();
  });
});

describe("My tasks, the management page and the pull list", () => {
  it("open My tasks for the parent", async () => {
    expect(await MyTasksPage()).toMatchObject({ props: { actor: world.actor } });
    expect(world.areas).toEqual(["szulo"]);
  });

  it("open the management page of a group in both areas, and refuse a made-up address", async () => {
    for (const page of [ParentGroupManagePage, AdminGroupManagePage]) {
      expect(await page({ ...params(GROUP), ...search() })).toMatchObject({
        props: { groupId: GROUP, tab: "todo" },
      });
      await expect(page({ ...params("x"), ...search() })).rejects.toThrow("NOT_FOUND");
    }
  });

  it("open the tab the address names on the management page", async () => {
    for (const page of [ParentGroupManagePage, AdminGroupManagePage]) {
      expect(await page({ ...params(GROUP), ...search({ ful: "tagok" }) })).toMatchObject({
        props: { groupId: GROUP, tab: "members" },
      });
    }
  });

  it("open the new and change forms of a group's task", async () => {
    for (const page of [ParentGroupNewTodoPage, AdminGroupNewTodoPage]) {
      expect(await page(params(GROUP))).toMatchObject({ props: { groupId: GROUP } });
      await expect(page(params("x"))).rejects.toThrow("NOT_FOUND");
    }
    for (const page of [ParentGroupEditTodoPage, AdminGroupEditTodoPage]) {
      expect(await page(taskParams(GROUP, TASK))).toMatchObject({
        props: { groupId: GROUP, taskId: TASK },
      });
      await expect(page(taskParams(GROUP, "x"))).rejects.toThrow("NOT_FOUND");
      await expect(page(taskParams("x", TASK))).rejects.toThrow("NOT_FOUND");
    }
  });

  it("open the pull list of an event, and refuse an address that is not an event", async () => {
    for (const page of [ParentEventPullPage, AdminEventPullPage]) {
      expect(await page(params(EVENT))).toMatchObject({ props: { eventId: EVENT } });
      await expect(page(params("x"))).rejects.toThrow("NOT_FOUND");
    }
  });
});

describe("the admin forms", () => {
  it("fixes the group named in the address and reads no group list", async () => {
    const list = vi.fn();
    world.groups = { list };
    const node = await AdminNewTodoPage(search({ csoport: GROUP }));
    expect(node).toMatchObject({ props: { groupId: GROUP, groups: [] } });
    expect(list).not.toHaveBeenCalled();
  });

  it("offers the groups to choose from when the address names none or a made-up one", async () => {
    world.groups = {
      list: async () => ({
        state: "success",
        data: { items: [{ id: GROUP, name: "Kert", description: "", schoolYearId: "y" }] },
      }),
    };
    expect(await AdminNewTodoPage(search({ csoport: "nem-azonosito" }))).toMatchObject({
      props: { groupId: undefined, groups: [{ id: GROUP, name: "Kert" }] },
    });
    world.groups = { list: async () => ({ state: "denied" }) };
    expect(await AdminNewTodoPage(search())).toMatchObject({ props: { groups: [] } });
    world.groups = undefined;
    expect(await AdminNewTodoPage(search())).toMatchObject({ props: { groups: [] } });
    world.actor = undefined;
    expect(await AdminNewTodoPage(search())).toBeNull();
  });

  it("open the change form of a task and refuse an address that is not an identifier", async () => {
    expect(await AdminEditTodoPage(params(TASK))).toMatchObject({ props: { taskId: TASK } });
    await expect(AdminEditTodoPage(params("x"))).rejects.toThrow("NOT_FOUND");
    world.actor = undefined;
    expect(await AdminEditTodoPage(params(TASK))).toBeNull();
  });
});
