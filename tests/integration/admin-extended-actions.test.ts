import { beforeEach, describe, expect, it, vi } from "vitest";
import { conflict, success } from "../../src/application/index.ts";

const world = vi.hoisted(() => ({
  signedIn: true,
  facade: {
    saveRecord: vi.fn(),
    saveTaskOrEvent: vi.fn(),
    assign: vi.fn(),
  },
  revalidated: [] as string[],
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({
  revalidatePath: (path: string) => world.revalidated.push(path),
}));
vi.mock("../../app/admin/_lib/facade.ts", () => ({
  resolveAdminFacade: async () => (world.signedIn ? world.facade : undefined),
}));
vi.mock("../../app/admin/_lib/session.ts", () => ({
  resolveAdminSession: async () =>
    world.signedIn
      ? {
          state: "success",
          data: {
            applicationSession: { subjectId: "admin" },
            scope: { id: "org", type: "organization", organizationId: "org" },
          },
        }
      : { state: "signed-out" },
}));

import { assignTaskAction, saveRecordAction, saveTaskAction } from "../../app/admin/actions.ts";

const initial = { state: "initial" } as const;
const ID = "11111111-0000-4000-8000-000000000001";

function form(values: Record<string, string | string[]>): FormData {
  const data = new FormData();
  const base = {
    id: ID,
    expectedVersion: "3",
    idempotencyKey: "record:save:0123456789",
    title: "Fenyő család",
  };
  for (const [key, value] of Object.entries({ ...base, ...values })) {
    for (const item of Array.isArray(value) ? value : [value]) data.append(key, item);
  }
  return data;
}

beforeEach(() => {
  world.signedIn = true;
  world.revalidated = [];
  world.facade.saveRecord.mockReset().mockResolvedValue(success({ id: ID }));
  world.facade.saveTaskOrEvent.mockReset().mockResolvedValue(success({ id: ID }));
  world.facade.assign.mockReset().mockResolvedValue(success({ id: ID }));
});

describe("saveRecordAction with the extended record form", () => {
  it("sends a family with its group, parents, contact details and consent", async () => {
    const result = await saveRecordAction(
      initial,
      form({
        id: "new",
        expectedVersion: "1",
        kind: "family",
        extended: "1",
        addGroupId: "g-1",
        "parent-0-name": "Fenyő Anna",
        "parent-0-email": "Anna@Example.test",
        "parent-0-profile": "Kertész vagyok.",
        "parent-0-consent": "on",
        "parent-1-name": "",
      }),
    );
    expect(result.state).toBe("success");
    const input = world.facade.saveRecord.mock.calls[0]![1];
    expect(input.payload).toEqual({
      title: "Fenyő család",
      kind: "family",
      addGroupIds: ["g-1"],
      parents: [
        {
          displayName: "Fenyő Anna",
          email: "anna@example.test",
          optionalProfile: "Kertész vagyok.",
          optionalProfileConsent: true,
        },
      ],
    });
    expect(world.revalidated).toEqual(["/admin/nyilvantartasok"]);
  });

  it("ends a membership of a stored family and refreshes its page", async () => {
    await saveRecordAction(
      initial,
      form({ kind: "family", extended: "1", endGroupIds: ["g-1", "g-2"] }),
    );
    expect(world.facade.saveRecord.mock.calls[0]![1].payload.endGroupIds).toEqual(["g-1", "g-2"]);
    expect(world.revalidated).toEqual(["/admin/nyilvantartasok", `/admin/nyilvantartasok/${ID}`]);
  });

  it("refuses wrong values with a message at the field before anything is sent", async () => {
    const result = await saveRecordAction(
      initial,
      form({
        id: "new",
        expectedVersion: "1",
        kind: "family",
        extended: "1",
        "parent-0-name": "Anna",
        "parent-0-email": "rossz",
      }),
    );
    expect(result).toMatchObject({
      state: "validation",
      fieldErrors: {
        addGroupId: "Válassza ki a csoportot, amelynek a család tagja lesz.",
        "parent-0-email": "Adjon meg érvényes e-mail-címet.",
      },
    });
    expect(world.facade.saveRecord).not.toHaveBeenCalled();
  });

  it("sends a school year with its days and passes a database conflict on in Hungarian", async () => {
    world.facade.saveRecord.mockResolvedValueOnce(conflict("SCHOOL_YEAR_HAS_ACTIVE_GROUPS"));
    const result = await saveRecordAction(
      initial,
      form({
        kind: "school-year",
        extended: "1",
        title: "2026/2027",
        startsOn: "2026-09-01",
        endsOn: "2027-06-30",
      }),
    );
    expect(world.facade.saveRecord.mock.calls[0]![1].payload).toEqual({
      title: "2026/2027",
      kind: "school-year",
      startsOn: "2026-09-01",
      endsOn: "2027-06-30",
    });
    expect(result).toMatchObject({
      state: "conflict",
      code: "SCHOOL_YEAR_HAS_ACTIVE_GROUPS",
      message: expect.stringContaining("aktív csoportjai"),
    });
    expect(world.revalidated).toEqual([]);
  });

  it("sends the old one-field form unchanged", async () => {
    await saveRecordAction(initial, form({ kind: "record" }));
    expect(world.facade.saveRecord.mock.calls[0]![1].payload).toEqual({
      title: "Fenyő család",
      kind: "record",
    });
  });
});

describe("saveTaskAction with the extended task form", () => {
  it("sends a task with its group, event, capacity and times in instants", async () => {
    await saveTaskAction(
      initial,
      form({
        id: "new",
        expectedVersion: "1",
        kind: "task",
        extended: "1",
        title: "Sütés",
        groupId: "g-1",
        eventId: "e-1",
        category: "sütés",
        capacity: "3",
        location: "Konyha",
        startsAt: "2026-11-05T09:00",
        endsAt: "2026-11-05T11:00",
      }),
    );
    expect(world.facade.saveTaskOrEvent.mock.calls[0]![1].payload).toMatchObject({
      title: "Sütés",
      kind: "task",
      groupId: "g-1",
      eventId: "e-1",
      category: "sütés",
      capacity: 3,
      location: "Konyha",
      startsAt: "2026-11-05T08:00:00.000Z",
      endsAt: "2026-11-05T10:00:00.000Z",
    });
    expect(world.revalidated).toEqual(["/admin/feladatok"]);
  });

  it("closes a stored task through its status and refreshes its page", async () => {
    await saveTaskAction(initial, form({ kind: "task", extended: "1", status: "closed" }));
    expect(world.facade.saveTaskOrEvent.mock.calls[0]![1].payload.status).toBe("closed");
    expect(world.revalidated).toContain(`/admin/feladatok/${ID}`);
  });

  it("names each missing field of a new task", async () => {
    const result = await saveTaskAction(
      initial,
      form({
        id: "new",
        expectedVersion: "1",
        kind: "task",
        extended: "1",
        startsAt: "",
        endsAt: "",
      }),
    );
    expect(result.state).toBe("validation");
    expect(Object.keys(result.fieldErrors ?? {}).sort()).toEqual([
      "capacity",
      "endsAt",
      "groupId",
      "location",
      "startsAt",
    ]);
    expect(world.facade.saveTaskOrEvent).not.toHaveBeenCalled();
  });

  it("treats any kind but event as a task, like the old form", async () => {
    await saveTaskAction(initial, form({ kind: "event" }));
    expect(world.facade.saveTaskOrEvent.mock.calls[0]![1].payload.kind).toBe("event");
    await saveTaskAction(initial, form({ kind: "other" }));
    expect(world.facade.saveTaskOrEvent.mock.calls[1]![1].payload.kind).toBe("task");
  });
});

describe("assignTaskAction with the family selector", () => {
  it("sends the chosen family", async () => {
    const result = await assignTaskAction(
      initial,
      form({ familySelector: "1", familyId: "f-2", idempotencyKey: "assignment:0123456789" }),
    );
    expect(result.state).toBe("success");
    expect(world.facade.assign.mock.calls[0]![1].payload).toMatchObject({ familyId: "f-2" });
    expect(world.revalidated).toEqual([`/admin/feladatok/${ID}`]);
  });

  it("asks for a family when the selector is on the form and nothing was chosen", async () => {
    const result = await assignTaskAction(
      initial,
      form({ familySelector: "1", familyId: "", idempotencyKey: "assignment:0123456789" }),
    );
    expect(result).toMatchObject({
      state: "validation",
      fieldErrors: { familyId: "Válassza ki a családot." },
    });
    expect(world.facade.assign).not.toHaveBeenCalled();
  });

  it("shows the Hungarian message of a refused assignment", async () => {
    world.facade.assign.mockResolvedValueOnce(conflict("ASSIGNMENT_CAPACITY_FULL"));
    const result = await assignTaskAction(
      initial,
      form({ familySelector: "1", familyId: "f-2", idempotencyKey: "assignment:0123456789" }),
    );
    expect(result).toMatchObject({
      state: "conflict",
      message: "A feladat vagy esemény elérte a kapacitását.",
    });
  });

  it("assigns without a selector like the old form", async () => {
    await assignTaskAction(initial, form({ idempotencyKey: "assignment:0123456789" }));
    expect(world.facade.assign.mock.calls[0]![1].payload).toEqual({ scenario: "" });
  });
});
