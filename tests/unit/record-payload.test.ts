import { describe, expect, it } from "vitest";
import {
  MAX_PARENTS,
  parentField,
  parseParents,
  parseRecordExtras,
  parseTaskExtras,
} from "../../app/admin/_lib/record-payload.ts";

function form(values: Record<string, string | string[]>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) {
    for (const item of Array.isArray(value) ? value : [value]) data.append(key, item);
  }
  return data;
}

const parent = (index: number, values: Record<string, string>) =>
  Object.fromEntries(
    Object.entries(values).map(([field, value]) => [parentField(index, field), value]),
  );

describe("parseParents", () => {
  it("skips empty blocks and sends a new parent with only what was filled in", () => {
    const { parents, errors } = parseParents(
      form({
        ...parent(0, {
          name: " Fenyő Anna ",
          email: "ANNA@Example.test",
          phone: "+36 30 111 2222",
        }),
        ...parent(1, { name: "" }),
      }),
    );
    expect(errors).toEqual({});
    expect(parents).toEqual([
      {
        displayName: "Fenyő Anna",
        email: "anna@example.test",
        phone: "+36 30 111 2222",
      },
    ]);
  });

  it("sends the phone of a stored parent even when cleared, so a cleared phone is cleared", () => {
    const { parents } = parseParents(
      form(
        parent(0, {
          id: "p-1",
          version: "4",
          name: "Fenyő Anna",
          email: "anna@example.test",
          phone: "",
        }),
      ),
    );
    expect(parents).toEqual([
      {
        id: "p-1",
        expectedVersion: 4,
        displayName: "Fenyő Anna",
        email: "anna@example.test",
        phone: "",
      },
    ]);
  });

  it("requires the email on record of every parent, new or stored (BR35.2)", () => {
    const { errors } = parseParents(
      form({
        ...parent(0, { id: "p-1", version: "1", name: "Fenyő Anna", email: "" }),
        ...parent(1, { name: "Fenyő Béla" }),
      }),
    );
    expect(errors).toEqual({
      [parentField(0, "email")]: "Adjon meg érvényes e-mail-címet.",
      [parentField(1, "email")]: "Adjon meg érvényes e-mail-címet.",
    });
  });

  it("ignores the old profile and consent fields: they belong to the parent now (BR31.1)", () => {
    const { parents } = parseParents(
      form({
        ...parent(0, { name: "Anna", email: "anna@example.test", profile: "Kertész vagyok." }),
        [parentField(0, "consent")]: "on",
      }),
    );
    expect(parents[0]).toEqual({ displayName: "Anna", email: "anna@example.test" });
  });

  it("names the field of every wrong value", () => {
    const { errors } = parseParents(
      form({
        ...parent(0, { name: "", email: "nem-cim", phone: "abc" }),
        ...parent(1, { name: "y".repeat(201), email: "y@example.test" }),
      }),
    );
    expect(errors).toEqual({
      [parentField(0, "name")]: "A szülő nevének megadása kötelező.",
      [parentField(0, "email")]: "Adjon meg érvényes e-mail-címet.",
      [parentField(0, "phone")]:
        "A telefonszám 6–20 karakter lehet, és csak számjegyet, szóközt, + és - jelet tartalmazhat.",
      [parentField(1, "name")]: "A szülő neve legfeljebb 200 karakter lehet.",
    });
  });

  it("requires a name for a stored parent and stops at the first missing block", () => {
    expect(
      parseParents(form(parent(0, { id: "p-1", version: "1", name: "", email: "a@example.test" })))
        .errors,
    ).toEqual({
      [parentField(0, "name")]: "A szülő nevének megadása kötelező.",
    });
    const gap = parseParents(
      form({ ...parent(0, { name: "Anna" }), ...parent(2, { name: "Béla" }) }),
    );
    expect(gap.parents).toHaveLength(1);
  });

  it("reads at most the number of blocks the database accepts", () => {
    const many: Record<string, string> = {};
    for (let index = 0; index < MAX_PARENTS + 3; index += 1) {
      many[parentField(index, "name")] = `Szülő ${index}`;
    }
    expect(parseParents(form(many)).parents).toHaveLength(MAX_PARENTS);
  });

  it("sends a version of zero for a stored parent whose version is not a number", () => {
    const { parents } = parseParents(form(parent(0, { id: "p-1", version: "x", name: "Anna" })));
    expect(parents[0]).toMatchObject({ expectedVersion: 0 });
  });
});

describe("parseRecordExtras", () => {
  it("adds nothing to the one-field forms of the synthetic mode", () => {
    expect(parseRecordExtras("group", form({ title: "Boróka" }), true)).toEqual({
      payload: {},
      errors: {},
    });
  });

  it("requires the school year of a new group and a description of every group (BR2.2)", () => {
    expect(parseRecordExtras("group", form({ extended: "1" }), true).errors).toEqual({
      schoolYearId: "Válassza ki a nevelési évet.",
      description: "A leírás megadása kötelező.",
    });
    expect(
      parseRecordExtras(
        "group",
        form({ extended: "1", schoolYearId: "y-1", description: "  Kert gondozása.  " }),
        true,
      ).payload,
    ).toEqual({ schoolYearId: "y-1", description: "Kert gondozása." });
    expect(
      parseRecordExtras("group", form({ extended: "1", description: "x".repeat(1001) }), false)
        .errors,
    ).toEqual({ description: "A leírás legfeljebb 1000 karakter lehet." });
    expect(
      parseRecordExtras("group", form({ extended: "1", description: "Rendben." }), false),
    ).toEqual({
      payload: { description: "Rendben." },
      errors: {},
    });
  });

  it("checks the days of a school year", () => {
    const check = (startsOn: string, endsOn: string) =>
      parseRecordExtras("school-year", form({ extended: "1", startsOn, endsOn }), true);
    expect(check("2026-09-01", "2027-06-30")).toEqual({
      payload: { startsOn: "2026-09-01", endsOn: "2027-06-30" },
      errors: {},
    });
    expect(check("", "").errors).toEqual({
      startsOn: "A kezdő dátum megadása kötelező.",
      endsOn: "A záró dátum megadása kötelező.",
    });
    expect(check("szeptember", "június").errors).toEqual({
      startsOn: "Adjon meg érvényes kezdő dátumot.",
      endsOn: "Adjon meg érvényes záró dátumot.",
    });
    expect(check("2027-06-30", "2026-09-01").errors).toEqual({
      endsOn: "A záró dátum nem lehet korábbi a kezdő dátumnál.",
    });
  });

  it("requires the family of a new child", () => {
    expect(parseRecordExtras("child", form({ extended: "1" }), true).errors).toEqual({
      familyId: "Válassza ki a családot.",
    });
    expect(
      parseRecordExtras("child", form({ extended: "1", familyId: "f-1" }), true).payload,
    ).toEqual({ familyId: "f-1" });
  });

  it("reads a family with its parents and no working group (BR1.5)", () => {
    const created = parseRecordExtras(
      "family",
      form({
        extended: "1",
        addGroupId: "g-1",
        endGroupIds: ["g-2"],
        ...parent(0, { name: "Anna", email: "anna@example.test" }),
      }),
      true,
    );
    expect(created.errors).toEqual({});
    expect(created.payload.parents).toHaveLength(1);
    expect(created.payload).not.toHaveProperty("addGroupIds");
    expect(created.payload).not.toHaveProperty("endGroupIds");
  });

  it("passes parent errors on", () => {
    const { errors } = parseRecordExtras(
      "family",
      form({ extended: "1", ...parent(0, { name: "", email: "x" }) }),
      true,
    );
    expect(errors.addGroupId).toBeUndefined();
    expect(errors[parentField(0, "name")]).toBeDefined();
  });
});

describe("parseTaskExtras", () => {
  const complete = {
    extended: "1",
    id: "new",
    groupId: "g-1",
    startsAt: "2026-11-05T09:00",
    endsAt: "2026-11-05T11:00",
    location: "Konyha",
    category: "sütés",
    capacity: "3",
    eventId: "e-1",
  };

  it("adds nothing to the one-field forms of the synthetic mode", () => {
    expect(parseTaskExtras("task", form({ title: "x" }), true)).toEqual({
      payload: {},
      errors: {},
    });
  });

  it("reads a task and writes the times as instants of Budapest time", () => {
    const { payload, errors } = parseTaskExtras("task", form(complete), true);
    expect(errors).toEqual({});
    expect(payload).toEqual({
      groupId: "g-1",
      startsAt: "2026-11-05T08:00:00.000Z",
      endsAt: "2026-11-05T10:00:00.000Z",
      location: "Konyha",
      eventId: "e-1",
      category: "sütés",
      capacity: 3,
    });
  });

  it("reads an event with a status and no coordinator", () => {
    const { payload, errors } = parseTaskExtras(
      "event",
      form({ ...complete, coordinatorName: "Kovács Mária", status: "cancelled", location: "" }),
      true,
    );
    expect(errors).toEqual({});
    expect(payload).toMatchObject({ status: "cancelled", location: "" });
    expect(payload).not.toHaveProperty("coordinatorName");
    expect(payload).not.toHaveProperty("capacity");
    expect(payload).not.toHaveProperty("category");
  });

  it("names the field of every missing or wrong value on a new task", () => {
    const { errors } = parseTaskExtras(
      "task",
      form({ extended: "1", id: "new", startsAt: "", endsAt: "" }),
      true,
    );
    expect(errors).toEqual({
      groupId: "Válassza ki a munkacsoportot.",
      startsAt: "A kezdési időpont megadása kötelező.",
      endsAt: "A befejezési időpont megadása kötelező.",
      location: "A helyszín megadása kötelező.",
      capacity: "A férőhelyek számának megadása kötelező.",
    });
  });

  it("refuses impossible times, an end before the start and a time that does not exist", () => {
    const wrong = parseTaskExtras(
      "task",
      form({ ...complete, startsAt: "holnap", endsAt: "2026-11-05T11:00" }),
      true,
    );
    expect(wrong.errors.startsAt).toBe("Adjon meg érvényes dátumot és időt (kezdési időpont).");
    const order = parseTaskExtras(
      "task",
      form({ ...complete, startsAt: "2026-11-05T12:00", endsAt: "2026-11-05T11:00" }),
      true,
    );
    expect(order.errors.endsAt).toBe("A befejezés nem lehet korábbi a kezdésnél.");
    const missing = parseTaskExtras(
      "task",
      form({ ...complete, startsAt: "2027-03-28T02:30" }),
      true,
    );
    expect(missing.errors.startsAt).toMatch(/érvényes dátumot/);
  });

  it("keeps the stored values when an edit leaves a field empty", () => {
    const { payload, errors } = parseTaskExtras(
      "task",
      form({ extended: "1", id: "t-1", startsAt: "", endsAt: "", location: "", capacity: "" }),
      false,
    );
    expect(errors).toEqual({});
    expect(payload).toEqual({});
  });

  it("limits capacity, category, location, coordinator and status", () => {
    const { errors } = parseTaskExtras(
      "task",
      form({
        ...complete,
        capacity: "51",
        category: "k".repeat(101),
        location: "l".repeat(201),
        status: "planned",
      }),
      true,
    );
    expect(errors).toEqual({
      capacity: "A férőhelyek száma 1 és 50 közötti egész szám lehet.",
      category: "A kategória legfeljebb 100 karakter lehet.",
      location: "A helyszín legfeljebb 200 karakter lehet.",
      status: "Érvénytelen állapot.",
    });
    expect(
      parseTaskExtras("task", form({ ...complete, capacity: "2.5" }), true).errors.capacity,
    ).toBe("A férőhelyek száma 1 és 50 közötti egész szám lehet.");
    expect(
      parseTaskExtras("task", form({ ...complete, status: "closed" }), false).payload.status,
    ).toBe("closed");
  });
});
