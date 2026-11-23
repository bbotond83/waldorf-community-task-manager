import { beforeEach, describe, expect, it, vi } from "vitest";

const GROUP = "33333333-3333-4333-8333-333333333333";
const SCHED = "22222222-2222-4222-8222-222222222222";

const world = vi.hoisted(() => ({
  actor: undefined as unknown,
  areas: [] as string[],
}));

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("../../app/_recurring/actor.ts", () => ({
  resolveRecurringActor: async (area: string) => {
    world.areas.push(area);
    return world.actor;
  },
}));
vi.mock("../../app/_recurring/RecurringScreens.tsx", () => ({
  RecurringGroupScreen: (props: unknown) => ({ screen: "group", props }),
  RecurringMineScreen: (props: unknown) => ({ screen: "mine", props }),
  RecurringFormScreen: (props: unknown) => ({ screen: "form", props }),
}));

import AdminGroupPage from "../../app/admin/munkacsoportok/[id]/ismetlodo/page.tsx";
import AdminEditPage from "../../app/admin/ismetlodo/[id]/szerkesztes/page.tsx";
import AdminNewPage from "../../app/admin/ismetlodo/uj/page.tsx";
import ParentGroupPage from "../../app/szulo/munkacsoportok/[id]/ismetlodo/page.tsx";
import ParentMinePage from "../../app/szulo/ismetlodo/page.tsx";
import ParentEditPage from "../../app/szulo/ismetlodo/[id]/szerkesztes/page.tsx";
import ParentNewPage from "../../app/szulo/ismetlodo/uj/page.tsx";
import TeacherGroupPage from "../../app/teacher/munkacsoportok/[id]/ismetlodo/page.tsx";

const params = (id: string) => ({ params: Promise.resolve({ id }) });
const search = (csoport?: string) => ({ searchParams: Promise.resolve({ csoport }) });

beforeEach(() => {
  world.actor = { area: "szulo" };
  world.areas = [];
});

describe("the pages of recurring duties", () => {
  it("open the group page in each area with the signed-in person of that area", async () => {
    for (const [page, area] of [
      [ParentGroupPage, "szulo"],
      [TeacherGroupPage, "teacher"],
      [AdminGroupPage, "admin"],
    ] as const) {
      world.areas = [];
      const node = await page(params(GROUP));
      expect(world.areas).toEqual([area]);
      expect(node).toMatchObject({ type: expect.any(Function), props: { groupId: GROUP } });
    }
  });

  it("open my duties and the change forms with the person of their area", async () => {
    expect(await ParentMinePage()).toMatchObject({ props: { actor: world.actor } });
    expect(await ParentEditPage(params(SCHED))).toMatchObject({ props: { scheduleId: SCHED } });
    expect(await AdminEditPage(params(SCHED))).toMatchObject({ props: { scheduleId: SCHED } });
    expect(world.areas).toEqual(["szulo", "szulo", "admin"]);
  });

  it("open the new form for the group named in the address, or for none when it is not an id", async () => {
    for (const page of [ParentNewPage, AdminNewPage]) {
      expect(
        (await page(search(GROUP))) as unknown as { props: { groupId?: string } },
      ).toMatchObject({
        props: { groupId: GROUP },
      });
      const node = (await page(search("nem-azonosito"))) as unknown as {
        props: { groupId?: string };
      };
      expect(node.props.groupId).toBeUndefined();
    }
  });

  it("show nothing to a person who is not signed in", async () => {
    world.actor = undefined;
    expect(await ParentGroupPage(params(GROUP))).toBeNull();
    expect(await TeacherGroupPage(params(GROUP))).toBeNull();
    expect(await AdminGroupPage(params(GROUP))).toBeNull();
    expect(await ParentMinePage()).toBeNull();
    expect(await ParentEditPage(params(SCHED))).toBeNull();
    expect(await AdminEditPage(params(SCHED))).toBeNull();
    expect(await ParentNewPage(search())).toBeNull();
    expect(await AdminNewPage(search())).toBeNull();
  });

  it("answer not found for an address that is not an id, before reading anything", async () => {
    for (const page of [
      ParentGroupPage,
      TeacherGroupPage,
      AdminGroupPage,
      ParentEditPage,
      AdminEditPage,
    ]) {
      await expect(page(params("1; drop"))).rejects.toThrow("NOT_FOUND");
    }
    expect(world.areas).toEqual([]);
  });
});
