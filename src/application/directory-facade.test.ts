import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Role, Scope } from "../access/index.ts";
import { sessionGrantBindings } from "../access/session-grants.ts";
import {
  AuthorizationContract,
  DirectoryApplicationFacade,
  FacadePipeline,
  InMemoryAuthorizationVersions,
  type DirectoryApplicationPort,
  type SessionContext,
} from "./index.ts";

const organization: Scope = { id: "org-1", type: "organization", organizationId: "org-1" };
const family: Scope = { id: "family-1", type: "family", organizationId: "org-1" };
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

function setup(role: Role) {
  const calls: string[] = [];
  const port: DirectoryApplicationPort = {
    list: async () => {
      calls.push("list");
      return { state: "success", data: { families: [] } };
    },
    ownProfile: async (parentId) => {
      calls.push("ownProfile");
      return { parentId, version: 1, sharingConsent: false };
    },
    setSharing: async () => {
      calls.push("setSharing");
      return { state: "success", data: { id: null, version: 2 } };
    },
    updateOwnProfile: async () => {
      calls.push("updateOwnProfile");
      return { state: "success", data: { id: null, version: 2 } };
    },
    removeParent: async ({ parentId }) => {
      calls.push("removeParent");
      return { state: "success", data: { parentId, accountId: "account-1" } };
    },
  };
  const versions = new InMemoryAuthorizationVersions({ [`${role}-synthetic`]: 1 });
  const facade = new DirectoryApplicationFacade(
    new FacadePipeline(new AuthorizationContract(versions)),
    port,
  );
  return { facade, calls };
}

describe("the directory facade", () => {
  it("lets every signed-in role read the directory", async () => {
    for (const [role, scope] of [
      ["parent", family],
      ["kindergarten_teacher", organization],
      ["group_admin", { id: "group-1", type: "group", organizationId: "org-1" } as Scope],
      ["super_admin", organization],
    ] as const) {
      const { facade, calls } = setup(role);
      const result = await facade.list(session(role, scope), scope);
      assert.equal(result.state, "success", role);
      assert.deepEqual(calls, ["list"]);
    }
  });

  it("lets only the parent read and change their own profile", async () => {
    const parent = setup("parent");
    assert.equal(
      (await parent.facade.ownProfile(session("parent", family), family, "parent-1")).state,
      "success",
    );
    const shared = await parent.facade.setSharing(session("parent", family), {
      scope: family,
      parentId: "parent-1",
      expectedVersion: 1,
      idempotencyKey: KEY,
      sharing: true,
    });
    assert.equal(shared.state, "success");

    const admin = setup("super_admin");
    const refused = await admin.facade.ownProfile(
      session("super_admin", organization),
      organization,
      "parent-1",
    );
    assert.equal(refused.state, "denied");
    const refusedChange = await admin.facade.updateOwnProfile(
      session("super_admin", organization),
      {
        scope: organization,
        parentId: "parent-1",
        expectedVersion: 1,
        idempotencyKey: KEY,
        fields: { phone: "+36 30 000 0000" },
      },
    );
    assert.equal(refusedChange.state, "denied");
    assert.deepEqual(admin.calls, []);
  });

  it("refuses a change without a valid key or version before the database is asked", async () => {
    const { facade, calls } = setup("parent");
    const result = await facade.setSharing(session("parent", family), {
      scope: family,
      parentId: "parent-1",
      expectedVersion: 0,
      idempotencyKey: "x",
      sharing: true,
    });
    assert.equal(result.state, "validation");
    assert.deepEqual(calls, []);
  });

  it("lets only a super admin remove a parent, and hands back the account to end", async () => {
    const allowed = setup("super_admin");
    const result = await allowed.facade.removeParent(session("super_admin", organization), {
      scope: organization,
      parentId: "parent-1",
      expectedVersion: 3,
      idempotencyKey: KEY,
    });
    assert.equal(result.state, "success");
    assert.deepEqual(result.state === "success" && result.data, {
      parentId: "parent-1",
      accountId: "account-1",
    });
    for (const [role, scope] of [
      ["parent", family],
      ["kindergarten_teacher", organization],
    ] as const) {
      const other = setup(role);
      const refused = await other.facade.removeParent(session(role, scope), {
        scope,
        parentId: "parent-1",
        expectedVersion: 3,
        idempotencyKey: KEY,
      });
      assert.equal(refused.state, "denied", role);
      assert.deepEqual(other.calls, []);
    }
  });

  it("shows a missing profile as denied, never as an empty page", async () => {
    const versions = new InMemoryAuthorizationVersions({ "parent-synthetic": 1 });
    const facade = new DirectoryApplicationFacade(
      new FacadePipeline(new AuthorizationContract(versions)),
      {
        list: async () => ({ state: "empty" }),
        ownProfile: async () => undefined,
        setSharing: async () => ({ state: "denied" }),
        updateOwnProfile: async () => ({ state: "denied" }),
        removeParent: async () => ({ state: "denied" }),
      },
    );
    assert.equal(
      (await facade.ownProfile(session("parent", family), family, "parent-1")).state,
      "denied",
    );
    assert.equal((await facade.list(session("parent", family), family)).state, "empty");
  });
});
