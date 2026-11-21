import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Role, Scope } from "../access/index.ts";
import { sessionGrantBindings } from "../access/session-grants.ts";
import {
  AuthorizationContract,
  EventApplicationFacade,
  FacadePipeline,
  InMemoryAuthorizationVersions,
  type DomainOutcome,
  type EventApplicationPort,
  type SessionContext,
} from "./index.ts";
import type { EventChangeModel, EventDetailModel, EventListModel } from "./contracts.ts";

const organization: Scope = { id: "org-1", type: "organization", organizationId: "org-1" };
const family: Scope = { id: "family-1", type: "family", organizationId: "org-1" };
const group: Scope = { id: "group-1", type: "group", organizationId: "org-1" };
const KEY = "key-0001-abcdefgh";
const CHANGE: EventChangeModel = { id: "x-1", version: 2 };
const LIST: EventListModel = {
  items: [
    {
      id: "e-1",
      title: "Őszi vásár",
      startsAt: "2026-11-02T14:00:00Z",
      endsAt: "2026-11-02T18:00:00Z",
      status: "planned",
      isFinished: false,
      signupCount: 4,
      isSignedUp: true,
    },
  ],
  canManageCommunity: false,
  managedGroupIds: [],
};
const DETAIL: EventDetailModel = {
  event: {
    id: "event-1",
    title: "Őszi vásár",
    startsAt: "2026-11-02T14:00:00+00:00",
    endsAt: "2026-11-02T18:00:00+00:00",
    status: "planned",
    isFinished: false,
    isOpen: true,
    isSummer: false,
    foodSignupOn: true,
    version: 1,
  },
  notices: ["mogyoró"],
  roles: [],
  signups: [],
  food: { on: true, categories: [] },
  caller: { canManage: false, canSignUp: true },
};

function session(role: Role, scope: Scope): SessionContext {
  return {
    subjectId: `${role}-synthetic`,
    authorizationVersion: 1,
    ...sessionGrantBindings(`${role}-synthetic`, role, [scope]),
    roles: [role],
    scopes: [scope],
  };
}

function setup(role: Role, answer?: DomainOutcome<EventChangeModel>) {
  const calls: Record<string, unknown>[] = [];
  const reply = answer ?? { state: "success" as const, data: CHANGE };
  const record =
    (name: string) =>
    async (input: unknown): Promise<DomainOutcome<EventChangeModel>> => {
      calls.push({ [name]: input });
      return reply;
    };
  const port: EventApplicationPort = {
    list: async (input) => {
      calls.push({ list: input });
      return { state: "success", data: LIST };
    },
    listForGroup: async (input) => {
      calls.push({ listForGroup: input });
      return { state: "success", data: LIST };
    },
    detail: async (eventId) => {
      calls.push({ detail: eventId });
      return { state: "success", data: DETAIL };
    },
    typedRoles: async (input) => {
      calls.push({ typedRoles: input });
      return { state: "success", data: { items: [] } };
    },
    saveNotices: record("saveNotices"),
    saveTale: record("saveTale"),
    saveRole: record("saveRole"),
    removeRole: record("removeRole"),
    clearRoleName: record("clearRoleName"),
    addSignup: record("addSignup"),
    changeSignup: record("changeSignup"),
    withdrawSignup: record("withdrawSignup"),
    addOffer: record("addOffer"),
    changeOffer: record("changeOffer"),
    withdrawOffer: record("withdrawOffer"),
  };
  const versions = new InMemoryAuthorizationVersions({ [`${role}-synthetic`]: 1 });
  const facade = new EventApplicationFacade(
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
const OFFER = { category: "bread", text: "Kenyér", hasMilk: false, hasEgg: true, hasGarlic: false };

describe("the event facade", () => {
  it("lets every signed-in role read the lists and the event page, past or not", async () => {
    for (const [role, scope] of ROLES) {
      const { facade, calls } = setup(role);
      const listed = await facade.list(session(role, scope), scope);
      assert.equal(listed.state, "success", role);
      assert.ok(listed.state === "success" && listed.data.items[0]?.signupCount === 4, role);
      assert.ok(listed.state === "success" && listed.data.items[0]?.isSignedUp === true, role);
      assert.equal(
        (await facade.list(session(role, scope), scope, { past: true })).state,
        "success",
      );
      assert.equal(
        (await facade.listForGroup(session(role, scope), scope, "group-1")).state,
        "success",
      );
      const detail = await facade.detail(session(role, scope), scope, "event-1");
      assert.equal(detail.state, "success", role);
      if (detail.state === "success") assert.equal(Object.isFrozen(detail.data), true);
      assert.deepEqual(calls, [
        { list: { past: false } },
        { list: { past: true } },
        { listForGroup: { groupId: "group-1", past: false } },
        { detail: "event-1" },
      ]);
    }
  });

  it("lets only a parent sign up and offer food, and passes the key and version on without the scope", async () => {
    const { facade, calls } = setup("parent");
    const s = session("parent", family);
    const results = await Promise.all([
      facade.addSignup(s, { scope: family, idempotencyKey: KEY, eventId: "event-1", note: "n" }),
      facade.changeSignup(s, {
        scope: family,
        idempotencyKey: KEY,
        signupId: "s-1",
        expectedVersion: 2,
        chosenAt: "2026-11-02T15:00:00+00:00",
      }),
      facade.withdrawSignup(s, {
        scope: family,
        idempotencyKey: KEY,
        signupId: "s-1",
        expectedVersion: 2,
      }),
      facade.addOffer(s, { scope: family, idempotencyKey: KEY, eventId: "event-1", ...OFFER }),
      facade.changeOffer(s, {
        scope: family,
        idempotencyKey: KEY,
        offerId: "o-1",
        expectedVersion: 3,
        ...OFFER,
      }),
      facade.withdrawOffer(s, {
        scope: family,
        idempotencyKey: KEY,
        offerId: "o-1",
        expectedVersion: 3,
      }),
    ]);
    assert.ok(results.every((result) => result.state === "success"));
    assert.deepEqual(calls[0], {
      addSignup: { idempotencyKey: KEY, eventId: "event-1", note: "n" },
    });
    assert.deepEqual(calls[2], {
      withdrawSignup: { idempotencyKey: KEY, signupId: "s-1", expectedVersion: 2 },
    });
    assert.ok(calls.every((call) => !JSON.stringify(call).includes("scope")));

    for (const [role, scope] of ROLES.filter(([role]) => role !== "parent")) {
      const other = setup(role);
      const refused = await other.facade.addSignup(session(role, scope), {
        scope,
        idempotencyKey: KEY,
        eventId: "event-1",
      });
      const offered = await other.facade.addOffer(session(role, scope), {
        scope,
        idempotencyKey: KEY,
        eventId: "event-1",
        ...OFFER,
      });
      assert.equal(refused.state, "denied", `${role} sign-up`);
      assert.equal(offered.state, "denied", `${role} offer`);
      assert.deepEqual(other.calls, [], `${role} reached nothing`);
    }
  });

  it("checks the key and the version before the database", async () => {
    const { facade, calls } = setup("parent");
    const s = session("parent", family);
    const badKey = await facade.addSignup(s, {
      scope: family,
      idempotencyKey: "x",
      eventId: "event-1",
    });
    const badVersion = await facade.changeSignup(s, {
      scope: family,
      idempotencyKey: KEY,
      signupId: "s-1",
      expectedVersion: 0,
    });
    assert.equal(badKey.state, "validation");
    assert.equal(badVersion.state, "validation");
    assert.deepEqual(calls, []);
  });

  it("lets a manager withdraw anyone's sign-up and offer, and a parent only their own through the parent right", async () => {
    for (const [role, scope] of [
      ["group_admin", group],
      ["super_admin", organization],
    ] as const) {
      const { facade, calls } = setup(role);
      const s = session(role, scope);
      const signup = await facade.withdrawSignup(s, {
        scope,
        idempotencyKey: KEY,
        signupId: "s-1",
        expectedVersion: 1,
        asManager: true,
      });
      const offer = await facade.withdrawOffer(s, {
        scope,
        idempotencyKey: KEY,
        offerId: "o-1",
        expectedVersion: 1,
        asManager: true,
      });
      assert.equal(signup.state, "success", role);
      assert.equal(offer.state, "success", role);
      // Without the manager flag the same caller is acting as a parent, which they are not.
      const asParent = await facade.withdrawSignup(s, {
        scope,
        idempotencyKey: KEY,
        signupId: "s-1",
        expectedVersion: 1,
      });
      assert.equal(asParent.state, "denied", role);
      assert.equal(calls.length, 2);
    }
    for (const [role, scope] of [
      ["parent", family],
      ["kindergarten_teacher", organization],
    ] as const) {
      const { facade, calls } = setup(role);
      const refused = await facade.withdrawOffer(session(role, scope), {
        scope,
        idempotencyKey: KEY,
        offerId: "o-1",
        expectedVersion: 1,
        asManager: true,
      });
      assert.equal(refused.state, "denied", role);
      assert.deepEqual(calls, []);
    }
  });

  it("lets a group admin and a super admin manage notices, tale and roles, and nobody else", async () => {
    for (const [role, scope] of [
      ["group_admin", group],
      ["super_admin", organization],
    ] as const) {
      const { facade, calls } = setup(role);
      const s = session(role, scope);
      const base = { scope, idempotencyKey: KEY };
      const results = await Promise.all([
        facade.saveNotices(s, { ...base, eventId: "e", expectedVersion: 1, notices: ["a"] }),
        facade.saveTale(s, { ...base, eventId: "e", expectedVersion: 1, tale: "t" }),
        facade.saveRole(s, { ...base, eventId: "e", name: "Szervező", isOrganiser: false }),
        facade.removeRole(s, { ...base, roleId: "r", expectedVersion: 1 }),
      ]);
      assert.ok(
        results.every((result) => result.state === "success"),
        role,
      );
      assert.deepEqual(
        calls.map((call) => Object.keys(call)[0]),
        ["saveNotices", "saveTale", "saveRole", "removeRole"],
      );
      const refused = await facade.saveRole(s, {
        ...base,
        eventId: "e",
        name: "x",
        expectedVersion: 0,
        roleId: "r",
        isOrganiser: false,
      });
      assert.equal(refused.state, "validation", `${role} bad version`);
    }
    for (const [role, scope] of [
      ["parent", family],
      ["kindergarten_teacher", organization],
    ] as const) {
      const { facade, calls } = setup(role);
      const s = session(role, scope);
      const refused = await Promise.all([
        facade.saveNotices(s, {
          scope,
          idempotencyKey: KEY,
          eventId: "e",
          expectedVersion: 1,
          notices: [],
        }),
        facade.saveRole(s, {
          scope,
          idempotencyKey: KEY,
          eventId: "e",
          name: "x",
          isOrganiser: false,
        }),
      ]);
      assert.ok(
        refused.every((result) => result.state === "denied"),
        role,
      );
      assert.deepEqual(calls, []);
    }
  });

  it("lets only a super admin clear a typed name and read the typed names of a person", async () => {
    const admin = setup("super_admin");
    const s = session("super_admin", organization);
    const cleared = await admin.facade.clearRoleName(s, {
      scope: organization,
      idempotencyKey: KEY,
      roleId: "r",
      expectedVersion: 2,
    });
    const typed = await admin.facade.typedRoles(s, organization, {
      subjectKind: "parent",
      subjectId: "p-1",
    });
    assert.equal(cleared.state, "success");
    assert.equal(typed.state, "success");
    assert.deepEqual(admin.calls, [
      { clearRoleName: { idempotencyKey: KEY, roleId: "r", expectedVersion: 2 } },
      { typedRoles: { subjectKind: "parent", subjectId: "p-1" } },
    ]);
    const stale = await admin.facade.clearRoleName(s, {
      scope: organization,
      idempotencyKey: KEY,
      roleId: "r",
      expectedVersion: 0,
    });
    assert.equal(stale.state, "validation");

    for (const [role, scope] of ROLES.filter(([role]) => role !== "super_admin")) {
      const other = setup(role);
      const os = session(role, scope);
      const refusedClear = await other.facade.clearRoleName(os, {
        scope,
        idempotencyKey: KEY,
        roleId: "r",
        expectedVersion: 1,
      });
      const refusedRead = await other.facade.typedRoles(os, scope, {
        subjectKind: "family",
        subjectId: "f-1",
      });
      assert.equal(refusedClear.state, "denied", `${role} clear`);
      assert.equal(refusedRead.state, "denied", `${role} read`);
      assert.deepEqual(other.calls, [], `${role} reached nothing`);
    }
  });

  it("passes a refusal of the database on as it is", async () => {
    const { facade } = setup("parent", { state: "conflict", code: "EVENT_CLOSED" });
    const result = await facade.addSignup(session("parent", family), {
      scope: family,
      idempotencyKey: KEY,
      eventId: "event-1",
    });
    assert.equal(result.state, "conflict");
    assert.equal(result.code, "EVENT_CLOSED");
  });
});
