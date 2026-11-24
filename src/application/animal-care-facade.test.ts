import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Role, Scope } from "../access/index.ts";
import { sessionGrantBindings } from "../access/session-grants.ts";
import {
  AnimalCareApplicationFacade,
  AuthorizationContract,
  FacadePipeline,
  InMemoryAuthorizationVersions,
  type AnimalCareApplicationPort,
  type DomainOutcome,
  type SessionContext,
} from "./index.ts";
import type {
  AnimalCalendarModel,
  AnimalChangeModel,
  AnimalFairShareModel,
  AnimalSlotsModel,
} from "./contracts.ts";

const organization: Scope = { id: "org-1", type: "organization", organizationId: "org-1" };
const family: Scope = { id: "family-1", type: "family", organizationId: "org-1" };
const group: Scope = { id: "group-1", type: "group", organizationId: "org-1" };
const KEY = "key-0001-abcdefgh";
const YEAR = "year-1";
const CHANGE: AnimalChangeModel = { id: "x-1", version: 2 };
const SLOTS: AnimalSlotsModel = {
  schoolYearId: YEAR,
  fromDate: "2026-11-23",
  toDate: "2026-12-20",
  slots: [],
  infoLinksMorning: [],
  infoLinksAfternoon: [],
};
const SHARE: AnimalFairShareModel = { average: 2, families: [] };
const CALENDAR: AnimalCalendarModel = {
  schoolYearId: YEAR,
  exists: false,
  morningStart: "07:30",
  afternoonStart: "16:00",
  slotCount: 0,
  version: 0,
  groups: [],
};
const SETTINGS = {
  schoolYearId: YEAR,
  morningStart: "07:30",
  afternoonStart: "16:00",
  expectedVersion: 0,
} as const;

function session(role: Role, scope: Scope): SessionContext {
  return {
    subjectId: `${role}-synthetic`,
    authorizationVersion: 1,
    ...sessionGrantBindings(`${role}-synthetic`, role, [scope]),
    roles: [role],
    scopes: [scope],
  };
}

function setup(role: Role, answer?: DomainOutcome<AnimalChangeModel>) {
  const calls: Record<string, unknown>[] = [];
  const reply = answer ?? { state: "success" as const, data: CHANGE };
  const record =
    (name: string) =>
    async (input: unknown): Promise<DomainOutcome<AnimalChangeModel>> => {
      calls.push({ [name]: input });
      return reply;
    };
  const read =
    <T>(name: string, data: T) =>
    async (input?: unknown): Promise<DomainOutcome<T>> => {
      calls.push({ [name]: input });
      return { state: "success", data };
    };
  const port: AnimalCareApplicationPort = {
    slots: read("slots", SLOTS),
    fairShare: read("fairShare", SHARE),
    calendar: read("calendar", CALENDAR),
    saveCalendar: record("saveCalendar"),
    createSlots: record("createSlots"),
    giveUp: record("giveUp"),
  };
  const versions = new InMemoryAuthorizationVersions({ [`${role}-synthetic`]: 1 });
  const facade = new AnimalCareApplicationFacade(
    new FacadePipeline(new AuthorizationContract(versions)),
    port,
  );
  return { facade, calls };
}

const ROLES = [
  ["parent", family],
  ["kindergarten_teacher", organization],
  ["group_admin", group],
  ["super_admin", organization],
] as const;

describe("the animal-care facade reads", () => {
  it("lets every signed-in role read the slots and the fair share, each as one port call", async () => {
    for (const [role, scope] of ROLES) {
      const { facade, calls } = setup(role);
      const s = session(role, scope);
      const results = await Promise.all([
        facade.slots(s, scope, { schoolYearId: YEAR, weeks: 4 }),
        facade.fairShare(s, scope, YEAR),
      ]);
      assert.ok(
        results.every((r) => r.state === "success" && Object.isFrozen(r.data)),
        role,
      );
      assert.deepEqual(calls, [{ slots: { schoolYearId: YEAR, weeks: 4 } }, { fairShare: YEAR }]);
    }
  });

  it("gives the settings to a super admin only, and refuses everyone else before the port", async () => {
    for (const [role, scope, expected] of [
      ["super_admin", organization, "success"],
      ["group_admin", group, "denied"],
      ["parent", family, "denied"],
      ["kindergarten_teacher", organization, "denied"],
    ] as const) {
      const { facade, calls } = setup(role);
      const result = await facade.calendar(session(role, scope), scope, YEAR);
      assert.equal(result.state, expected, role);
      assert.equal(calls.length, expected === "success" ? 1 : 0, role);
    }
  });
});

describe("the animal-care facade commands", () => {
  it("passes a super admin's commands on with key and version and without the scope", async () => {
    const { facade, calls } = setup("super_admin");
    const s = session("super_admin", organization);
    const base = { scope: organization, idempotencyKey: KEY };
    const results = await Promise.all([
      facade.saveCalendar(s, { ...base, ...SETTINGS }),
      facade.saveCalendar(s, { ...base, ...SETTINGS, expectedVersion: 3, careGroupId: "group-1" }),
      facade.createSlots(s, { ...base, schoolYearId: YEAR }),
    ]);
    assert.ok(results.every((r) => r.state === "success"));
    assert.deepEqual(calls[0], { saveCalendar: { idempotencyKey: KEY, ...SETTINGS } });
    assert.deepEqual(calls[2], { createSlots: { idempotencyKey: KEY, schoolYearId: YEAR } });
    assert.ok(calls.every((c) => !JSON.stringify(c).includes("scope")));
  });

  it("lets a parent give up a slot and refuses a parent the settings and slot creation", async () => {
    const { facade, calls } = setup("parent");
    const s = session("parent", family);
    const base = { scope: family, idempotencyKey: KEY };
    assert.equal(
      (await facade.giveUp(s, { ...base, placeId: "p-1", expectedVersion: 1 })).state,
      "success",
    );
    const refused = await Promise.all([
      facade.saveCalendar(s, { ...base, ...SETTINGS }),
      facade.createSlots(s, { ...base, schoolYearId: YEAR }),
    ]);
    assert.ok(refused.every((r) => r.state === "denied"));
    assert.equal(calls.length, 1);
  });

  it("refuses a teacher every command before the port", async () => {
    const { facade, calls } = setup("kindergarten_teacher");
    const s = session("kindergarten_teacher", organization);
    const base = { scope: organization, idempotencyKey: KEY };
    const refused = await Promise.all([
      facade.giveUp(s, { ...base, placeId: "p-1", expectedVersion: 1 }),
      facade.saveCalendar(s, { ...base, ...SETTINGS }),
      facade.createSlots(s, { ...base, schoolYearId: YEAR }),
    ]);
    assert.ok(refused.every((r) => r.state === "denied"));
    assert.deepEqual(calls, []);
  });

  it("refuses a malformed key, a missing version or a negative first-save version before the port", async () => {
    const { facade, calls } = setup("super_admin");
    const s = session("super_admin", organization);
    const checks = await Promise.all([
      facade.saveCalendar(s, { scope: organization, idempotencyKey: "x", ...SETTINGS }),
      facade.saveCalendar(s, {
        scope: organization,
        idempotencyKey: KEY,
        ...SETTINGS,
        expectedVersion: -1,
      }),
      facade.createSlots(s, { scope: organization, idempotencyKey: "x", schoolYearId: YEAR }),
      facade.giveUp(s, {
        scope: organization,
        idempotencyKey: KEY,
        placeId: "p-1",
        expectedVersion: 0,
      }),
    ]);
    assert.ok(checks.every((r) => r.state === "validation"));
    assert.deepEqual(calls, []);
  });

  it("returns a refusal of the database as the application result, never as success", async () => {
    for (const code of ["VERSION_CONFLICT", "SLOT_GIVE_UP_TOO_LATE", "REQUEST_CONFLICT"]) {
      const { facade } = setup("parent", { state: "conflict", code });
      const result = await facade.giveUp(session("parent", family), {
        scope: family,
        idempotencyKey: KEY,
        placeId: "p-1",
        expectedVersion: 1,
      });
      assert.deepEqual([result.state, result.code], ["conflict", code]);
    }
  });
});
