import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Role, Scope } from "../access/index.ts";
import { sessionGrantBindings } from "../access/session-grants.ts";
import {
  AuthorizationContract,
  FacadePipeline,
  InMemoryAuthorizationVersions,
  RotaApplicationFacade,
  type DomainOutcome,
  type RotaApplicationPort,
  type SessionContext,
} from "./index.ts";

const organization: Scope = { id: "org-1", type: "organization", organizationId: "org-1" };
const family: Scope = { id: "family-1", type: "family", organizationId: "org-1" };
const group: Scope = { id: "group-1", type: "group", organizationId: "org-1" };
const KEY = "key-0001-abcdefgh";

function session(role: Role, scope: Scope): SessionContext {
  return {
    subjectId: `${role}-synthetic`,
    authorizationVersion: 1,
    ...sessionGrantBindings(`${role}-synthetic`, role, [scope]),
    roles: [role],
    scopes: [scope],
  };
}

/** A port that records its calls and answers a success with the shape asked for. */
function port() {
  const calls: string[] = [];
  const done = <T>(name: string, data: T): Promise<DomainOutcome<T>> => {
    calls.push(name);
    return Promise.resolve({ state: "success", data });
  };
  const adapter: RotaApplicationPort = {
    calendar: () =>
      done("calendar", {
        schoolYears: [],
        weeks: [],
        warnings: [],
        hasPlan: false,
        standings: [],
        flaggedDuties: [],
      }),
    addBreakWeek: () => done("addBreakWeek", { id: "w" }),
    removeBreakWeek: () => done("removeBreakWeek", { id: "w" }),
    plan: () =>
      done("plan", {
        weeks: [],
        families: [],
        changedWeeks: 0,
        blockers: {
          emptyWeeks: [],
          breakWeeks: [],
          ineligibleWeeks: [],
          emptyRows: [],
          breakRows: [],
          ineligibleRows: [],
          flaggedWeeks: [],
          clashWeeks: [],
        },
        warnings: { twoJobs: [] },
        canPublish: false,
      }),
    makeDraft: () => done("makeDraft", { id: "p" }),
    setWeek: () => done("setWeek", { id: "w", version: 2 }),
    discard: () => done("discard", { id: "p" }),
    publish: () => done("publish", { id: "p", version: 2 }),
    overview: () =>
      done("overview", {
        overviewState: "nothing_published" as const,
        items: [],
        weekendItems: [],
      }),
    dutyCard: () =>
      done("dutyCard", {
        dutyId: "d",
        job: "indoor_cleaning" as const,
        title: "Belső takarítás",
        familyDisplayName: "Minta család",
        weekStart: "2026-08-31",
        weekEnd: "2026-09-06",
        noFixedDay: true,
        isBreakWeek: false,
        includesWatering: false,
        bottlesAtWeekEnd: false,
      }),
    setStanding: () => done("setStanding", { id: "s", version: 1 }),
    pickSlot: () => done("pickSlot", { id: "k", version: 2 }),
    assignSlot: () => done("assignSlot", { id: "k", version: 2 }),
    unpickedList: () => done("unpickedList", { items: [], missed: [] }),
  };
  const facade = (role: Role) => {
    const versions = new InMemoryAuthorizationVersions({ [`${role}-synthetic`]: 1 });
    return new RotaApplicationFacade(
      new FacadePipeline(new AuthorizationContract(versions)),
      adapter,
    );
  };
  return { calls, facade, adapter };
}

describe("RotaApplicationFacade", () => {
  it("lets a super admin run every calendar and plan command through the port", async () => {
    const { calls, facade } = port();
    const admin = session("super_admin", organization);
    const rota = facade("super_admin");
    const results = [
      await rota.getCalendar(admin, organization, "year-1"),
      await rota.addBreakWeek(admin, organization, {
        idempotencyKey: KEY,
        schoolYearId: "y",
        weekStart: "2026-12-21",
      }),
      await rota.removeBreakWeek(admin, organization, {
        idempotencyKey: KEY,
        breakWeekId: "w",
        expectedVersion: 1,
      }),
      await rota.getPlan(admin, organization),
      await rota.makeDraft(admin, organization, { idempotencyKey: KEY, schoolYearId: "y" }),
      await rota.setWeek(admin, organization, {
        idempotencyKey: KEY,
        weekId: "w",
        familyId: null,
        expectedVersion: 2,
      }),
      await rota.discardDraft(admin, organization, {
        idempotencyKey: KEY,
        planId: "p",
        expectedVersion: 2,
        changedWeeks: 1,
      }),
      await rota.publish(admin, organization, {
        idempotencyKey: KEY,
        planId: "p",
        expectedVersion: 2,
      }),
      await rota.getOverview(admin, organization),
      await rota.getDutyCard(admin, organization, "d"),
    ];
    assert.deepEqual(
      results.map((result) => result.state),
      Array(10).fill("success"),
    );
    assert.deepEqual(calls, [
      "calendar",
      "addBreakWeek",
      "removeBreakWeek",
      "plan",
      "makeDraft",
      "setWeek",
      "discard",
      "publish",
      "overview",
      "dutyCard",
    ]);
  });

  it("refuses a parent, a teacher and a group admin every command and the plan read, before the port is called", async () => {
    for (const [role, scope] of [
      ["parent", family],
      ["kindergarten_teacher", organization],
      ["group_admin", group],
    ] as const) {
      const { calls, facade } = port();
      const rota = facade(role);
      const who = session(role, scope);
      const results = [
        await rota.getCalendar(who, scope),
        await rota.getPlan(who, scope),
        await rota.makeDraft(who, scope, { idempotencyKey: KEY, schoolYearId: "y" }),
        await rota.setWeek(who, scope, {
          idempotencyKey: KEY,
          weekId: "w",
          familyId: "f",
          expectedVersion: 1,
        }),
        await rota.discardDraft(who, scope, {
          idempotencyKey: KEY,
          planId: "p",
          expectedVersion: 1,
          changedWeeks: 0,
        }),
        await rota.publish(who, scope, { idempotencyKey: KEY, planId: "p", expectedVersion: 1 }),
        await rota.addBreakWeek(who, scope, {
          idempotencyKey: KEY,
          schoolYearId: "y",
          weekStart: "2026-12-21",
        }),
        await rota.removeBreakWeek(who, scope, {
          idempotencyKey: KEY,
          breakWeekId: "w",
          expectedVersion: 1,
        }),
      ];
      assert.deepEqual(
        results.map((result) => result.state),
        Array(8).fill("denied"),
        role,
      );
      assert.deepEqual(calls, [], role);
    }
  });

  it("lets every role read the overview, and a parent and a super admin open a duty card", async () => {
    for (const [role, scope] of [
      ["parent", family],
      ["kindergarten_teacher", organization],
      ["group_admin", group],
      ["super_admin", organization],
    ] as const) {
      const { facade } = port();
      const rota = facade(role);
      const who = session(role, scope);
      assert.equal((await rota.getOverview(who, scope)).state, "success", role);
      assert.equal(
        (await rota.getDutyCard(who, scope, "d")).state,
        role === "parent" || role === "super_admin" ? "success" : "denied",
        role,
      );
    }
  });

  it("refuses a command with no usable key or version before the port is called", async () => {
    const { calls, facade } = port();
    const admin = session("super_admin", organization);
    const rota = facade("super_admin");
    const badKey = await rota.makeDraft(admin, organization, {
      idempotencyKey: "x",
      schoolYearId: "y",
    });
    assert.equal(badKey.state, "validation");
    assert.equal(
      badKey.state === "validation" && badKey.fieldErrors.idempotencyKey,
      "VAL-IDEMPOTENCY-KEY",
    );
    const badBreakKey = await rota.addBreakWeek(admin, organization, {
      idempotencyKey: "",
      schoolYearId: "y",
      weekStart: "2026-12-21",
    });
    assert.equal(badBreakKey.state, "validation");
    const badVersion = await rota.publish(admin, organization, {
      idempotencyKey: KEY,
      planId: "p",
      expectedVersion: 0,
    });
    assert.equal(
      badVersion.state === "validation" && badVersion.fieldErrors.expectedVersion,
      "VAL-EXPECTED-VERSION",
    );
    const badSet = await rota.setWeek(admin, organization, {
      idempotencyKey: KEY,
      weekId: "w",
      familyId: null,
      expectedVersion: 1.5,
    });
    assert.equal(badSet.state, "validation");
    assert.deepEqual(calls, []);
  });

  it("lets a super admin set a standing, assign a pick and read the unpicked list, and a standing with no row yet has version 0 (U6)", async () => {
    const { calls, facade } = port();
    const admin = session("super_admin", organization);
    const rota = facade("super_admin");
    const standing = {
      idempotencyKey: KEY,
      familyId: "f",
      schoolYearId: "y",
      standing: "new" as const,
    };
    assert.equal(
      (await rota.setStanding(admin, organization, { ...standing, expectedVersion: 0 })).state,
      "success",
    );
    assert.equal(
      (await rota.setStanding(admin, organization, { ...standing, expectedVersion: 3 })).state,
      "success",
    );
    assert.equal(
      (
        await rota.assignSlot(admin, organization, {
          idempotencyKey: KEY,
          rotaWeekId: "w",
          slot: "saturday_opening",
          expectedVersion: 1,
        })
      ).state,
      "success",
    );
    assert.equal((await rota.getUnpickedList(admin, organization)).state, "success");
    assert.deepEqual(calls, ["setStanding", "setStanding", "assignSlot", "unpickedList"]);
  });

  it("refuses a standing, an assignment and the unpicked list to every role but a super admin (U6)", async () => {
    for (const [role, scope] of [
      ["parent", family],
      ["kindergarten_teacher", organization],
      ["group_admin", group],
    ] as const) {
      const { calls, facade } = port();
      const rota = facade(role);
      const who = session(role, scope);
      const results = [
        await rota.setStanding(who, scope, {
          idempotencyKey: KEY,
          familyId: "f",
          schoolYearId: "y",
          standing: "leaving",
          expectedVersion: 1,
        }),
        await rota.assignSlot(who, scope, {
          idempotencyKey: KEY,
          rotaWeekId: "w",
          slot: "sunday_closing",
          expectedVersion: 1,
        }),
        await rota.getUnpickedList(who, scope),
      ];
      assert.deepEqual(
        results.map((result) => result.state),
        ["denied", "denied", "denied"],
        role,
      );
      assert.deepEqual(calls, [], role);
    }
  });

  it("lets a parent, and nobody else, pick a slot for the family (BR63.4)", async () => {
    for (const [role, scope] of [
      ["parent", family],
      ["kindergarten_teacher", organization],
      ["group_admin", group],
      ["super_admin", organization],
    ] as const) {
      const { calls, facade } = port();
      const result = await facade(role).pickSlot(session(role, scope), scope, {
        idempotencyKey: KEY,
        rotaWeekId: "w",
        slot: "saturday_opening",
        expectedVersion: 1,
      });
      assert.equal(result.state, role === "parent" ? "success" : "denied", role);
      assert.deepEqual(calls, role === "parent" ? ["pickSlot"] : [], role);
    }
  });

  it("refuses a pick or an assignment with no usable key or version before the port is called (U6)", async () => {
    const { calls, facade } = port();
    const admin = session("super_admin", organization);
    const rota = facade("super_admin");
    const pick = { rotaWeekId: "w", slot: "saturday_opening" as const };
    assert.equal(
      (
        await rota.assignSlot(admin, organization, {
          ...pick,
          idempotencyKey: "x",
          expectedVersion: 1,
        })
      ).state,
      "validation",
    );
    assert.equal(
      (
        await rota.assignSlot(admin, organization, {
          ...pick,
          idempotencyKey: KEY,
          expectedVersion: 0,
        })
      ).state,
      "validation",
    );
    assert.equal(
      (
        await rota.setStanding(admin, organization, {
          idempotencyKey: "x",
          familyId: "f",
          schoolYearId: "y",
          standing: "staying",
          expectedVersion: 0,
        })
      ).state,
      "validation",
    );
    assert.equal(
      (
        await rota.setStanding(admin, organization, {
          idempotencyKey: KEY,
          familyId: "f",
          schoolYearId: "y",
          standing: "staying",
          expectedVersion: -1,
        })
      ).state,
      "validation",
    );
    assert.deepEqual(calls, []);
  });

  it("passes a refusal of the database on with its code", async () => {
    const rota = new RotaApplicationFacade(
      new FacadePipeline(
        new AuthorizationContract(
          new InMemoryAuthorizationVersions({ "super_admin-synthetic": 1 }),
        ),
      ),
      {
        ...port().adapter,
        publish: async () => ({ state: "conflict", code: "ROTA_PLAN_PUBLISHED" }),
      },
    );
    const result = await rota.publish(session("super_admin", organization), organization, {
      idempotencyKey: KEY,
      planId: "p",
      expectedVersion: 2,
    });
    assert.equal(result.state, "conflict");
    assert.equal(result.code, "ROTA_PLAN_PUBLISHED");
  });
});
