import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Role, Scope } from "../access/index.ts";
import { sessionGrantBindings } from "../access/session-grants.ts";
import {
  AuthorizationContract,
  FacadePipeline,
  InMemoryAuthorizationVersions,
  WorkingGroupApplicationFacade,
  type DomainOutcome,
  type SessionContext,
  type WorkingGroupApplicationPort,
  type WorkingGroupChangeModel,
  type WorkingGroupDetailModel,
} from "./index.ts";

const organization: Scope = { id: "org-1", type: "organization", organizationId: "org-1" };
const family: Scope = { id: "family-1", type: "family", organizationId: "org-1" };
const group: Scope = { id: "group-1", type: "group", organizationId: "org-1" };
const KEY = "key-0001-abcdefgh";
const CHANGE: WorkingGroupChangeModel = { membershipId: "m-1", version: 2, alreadyMember: false };
const DETAIL: WorkingGroupDetailModel = {
  group: {
    id: "group-1",
    name: "Kerti munkacsoport",
    description: "A kert gondozása.",
    schoolYearId: "year-1",
    schoolYearName: "2026-2027",
  },
  hasCoordinator: false,
  callerIsParent: true,
  ownMembership: null,
  members: [
    {
      membershipId: "m-1",
      parentId: "p-1",
      fullName: "Fenyő Anna",
      isCoordinator: false,
      isSelf: true,
    },
  ],
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

function setup(role: Role, answer?: DomainOutcome<WorkingGroupChangeModel>) {
  const calls: Record<string, unknown>[] = [];
  const reply = answer ?? { state: "success" as const, data: CHANGE };
  const port: WorkingGroupApplicationPort = {
    list: async () => ({ state: "empty" }),
    detail: async (groupId) => {
      calls.push({ detail: groupId });
      return { state: "success", data: DETAIL };
    },
    join: async (input) => {
      calls.push({ join: input });
      return reply;
    },
    leave: async (input) => {
      calls.push({ leave: input });
      return reply;
    },
    appoint: async (input) => {
      calls.push({ appoint: input });
      return reply;
    },
    revoke: async (input) => {
      calls.push({ revoke: input });
      return reply;
    },
  };
  const versions = new InMemoryAuthorizationVersions({ [`${role}-synthetic`]: 1 });
  const facade = new WorkingGroupApplicationFacade(
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

describe("the working-group facade", () => {
  it("lets every signed-in role read the group page and passes the group id on", async () => {
    for (const [role, scope] of ROLES) {
      const { facade, calls } = setup(role);
      const result = await facade.detail(session(role, scope), scope, "group-1");
      assert.equal(result.state, "success", role);
      if (result.state === "success") {
        assert.equal(result.data.group.name, "Kerti munkacsoport");
        assert.equal(Object.isFrozen(result.data.members[0]), true);
      }
      assert.deepEqual(calls, [{ detail: "group-1" }]);
    }
  });

  it("lets only a parent join and leave, and checks the key and the version before the database", async () => {
    const parent = setup("parent");
    const joined = await parent.facade.join(session("parent", family), {
      scope: family,
      idempotencyKey: KEY,
      groupId: "group-1",
    });
    assert.equal(joined.state, "success");
    const left = await parent.facade.leave(session("parent", family), {
      scope: family,
      idempotencyKey: KEY,
      membershipId: "m-1",
      expectedVersion: 2,
    });
    assert.equal(left.state, "success");
    assert.deepEqual(parent.calls, [
      { join: { idempotencyKey: KEY, groupId: "group-1" } },
      { leave: { idempotencyKey: KEY, membershipId: "m-1", expectedVersion: 2 } },
    ]);

    const badKey = await parent.facade.join(session("parent", family), {
      scope: family,
      idempotencyKey: "x",
      groupId: "group-1",
    });
    assert.equal(badKey.state, "validation");
    const badVersion = await parent.facade.leave(session("parent", family), {
      scope: family,
      idempotencyKey: KEY,
      membershipId: "m-1",
      expectedVersion: 0,
    });
    assert.equal(badVersion.state, "validation");
    assert.equal(parent.calls.length, 2, "neither refused request reached the database");

    for (const [role, scope] of ROLES.filter(([role]) => role !== "parent")) {
      const other = setup(role);
      const joinResult = await other.facade.join(session(role, scope), {
        scope,
        idempotencyKey: KEY,
        groupId: "group-1",
      });
      const leaveResult = await other.facade.leave(session(role, scope), {
        scope,
        idempotencyKey: KEY,
        membershipId: "m-1",
        expectedVersion: 1,
      });
      assert.equal(joinResult.state, "denied", `${role} join`);
      assert.equal(leaveResult.state, "denied", `${role} leave`);
      assert.deepEqual(other.calls, [], `${role} reached nothing`);
    }
  });

  it("lets only a super admin appoint and revoke a coordinator", async () => {
    const admin = setup("super_admin");
    const input = {
      scope: organization,
      idempotencyKey: KEY,
      membershipId: "m-1",
      expectedVersion: 3,
    };
    assert.equal(
      (await admin.facade.appoint(session("super_admin", organization), input)).state,
      "success",
    );
    assert.equal(
      (await admin.facade.revoke(session("super_admin", organization), input)).state,
      "success",
    );
    assert.deepEqual(admin.calls, [
      { appoint: { idempotencyKey: KEY, membershipId: "m-1", expectedVersion: 3 } },
      { revoke: { idempotencyKey: KEY, membershipId: "m-1", expectedVersion: 3 } },
    ]);
    const stale = await admin.facade.appoint(session("super_admin", organization), {
      ...input,
      expectedVersion: 0,
    });
    assert.equal(stale.state, "validation");
    assert.equal(admin.calls.length, 2);

    for (const [role, scope] of ROLES.filter(([role]) => role !== "super_admin")) {
      const other = setup(role);
      const request = { ...input, scope };
      const appointed = await other.facade.appoint(session(role, scope), request);
      const revoked = await other.facade.revoke(session(role, scope), request);
      assert.equal(appointed.state, "denied", `${role} appoint`);
      assert.equal(revoked.state, "denied", `${role} revoke`);
      assert.deepEqual(other.calls, [], `${role} reached nothing`);
    }
  });

  it("carries a refusal code of the database through as a conflict the screen can word", async () => {
    const { facade } = setup("super_admin", { state: "conflict", code: "ALREADY_COORDINATOR" });
    const result = await facade.appoint(session("super_admin", organization), {
      scope: organization,
      idempotencyKey: KEY,
      membershipId: "m-1",
      expectedVersion: 1,
    });
    assert.equal(result.state, "conflict");
    if (result.state === "conflict") assert.equal(result.code, "ALREADY_COORDINATOR");
  });
});
