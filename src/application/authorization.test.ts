import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AUTHORIZATION_MATRIX_VERSION,
  AuthorizationContract,
  InMemoryAuthorizationVersions,
} from "./index.ts";
import type { Role, Scope } from "../access/index.ts";
import type { SessionContext } from "./index.ts";

const organizationScope: Scope = { id: "org-1", type: "organization", organizationId: "org-1" };
const groupScope: Scope = { id: "group-1", type: "group", organizationId: "org-1" };
const familyScope: Scope = { id: "family-1", type: "family", organizationId: "org-1" };

function makeSession(role: Role, scope: Scope): SessionContext {
  return {
    subjectId: `${role}-synthetic`,
    authorizationVersion: 1,
    roles: [role],
    scopes: [scope],
    runtimeMode: "synthetic",
    isSynthetic: true,
  };
}

describe("AuthorizationContract", () => {
  it("exposes a versioned executable matrix", () => {
    assert.match(AUTHORIZATION_MATRIX_VERSION, /^\d{4}-\d{2}-\d{2}\.\d+$/);
  });

  it("allows a parent to read its linked family duties", async () => {
    const session = makeSession("parent", familyScope);
    const contract = contractFor(session);
    const result = await contract.authorize(session, {
      matrixRowId: "AUTH-PARENT-DUTIES",
      action: "read",
      resource: "assignment",
      scope: familyScope,
    });
    assert.equal(result.state, "success");
  });

  it("denies a parent requesting contact fields", async () => {
    const session = makeSession("parent", familyScope);
    const result = await contractFor(session).authorize(session, {
      matrixRowId: "AUTH-PARENT-DUTIES",
      action: "read",
      resource: "family",
      scope: familyScope,
      fields: ["SF-EMAIL"],
    });
    assert.equal(result.state, "denied");
    assert.equal("data" in result, false);
  });

  it("keeps Staff read-only", async () => {
    const session = makeSession("read_only_staff", groupScope);
    const result = await contractFor(session).authorize(session, {
      matrixRowId: "AUTH-STAFF-SCHEDULE",
      action: "update",
      resource: "schedule",
      scope: groupScope,
    });
    assert.equal(result.state, "denied");
  });

  it("denies Group Administrator import explicitly", async () => {
    const session = makeSession("group_admin", groupScope);
    const result = await contractFor(session).authorize(session, {
      matrixRowId: "AUTH-GRP-IMPORT-DENY",
      action: "manage",
      resource: "import",
      scope: groupScope,
    });
    assert.equal(result.state, "denied");
  });

  it("allows Kindergarten Administrator import at organization scope", async () => {
    const session = makeSession("kindergarten_admin", organizationScope);
    const result = await contractFor(session).authorize(session, {
      matrixRowId: "AUTH-KINDERGARTEN-ADMIN",
      action: "manage",
      resource: "import",
      scope: organizationScope,
    });
    assert.equal(result.state, "success");
  });

  it("limits governance to Super Administrator", async () => {
    const kindergarten = makeSession("kindergarten_admin", organizationScope);
    const denied = await contractFor(kindergarten).authorize(kindergarten, {
      matrixRowId: "AUTH-SUPER-GOVERNANCE",
      action: "manage",
      resource: "governance",
      scope: organizationScope,
    });
    const superAdmin = makeSession("super_admin", organizationScope);
    const allowed = await contractFor(superAdmin).authorize(superAdmin, {
      matrixRowId: "AUTH-SUPER-GOVERNANCE",
      action: "manage",
      resource: "governance",
      scope: organizationScope,
    });
    assert.equal(denied.state, "denied");
    assert.equal(allowed.state, "success");
  });

  it("invalidates the next request and clears protected cache after revocation", async () => {
    const session = makeSession("parent", familyScope);
    const versions = new InMemoryAuthorizationVersions({ [session.subjectId]: 2 });
    const result = await new AuthorizationContract(versions).authorize(session, {
      matrixRowId: "AUTH-PARENT-DUTIES",
      action: "read",
      resource: "assignment",
      scope: familyScope,
    });
    assert.equal(result.state, "invalidated");
    assert.deepEqual(versions.clearedSubjects, [session.subjectId]);
  });

  it("builds role navigation without the Group Administrator import route", async () => {
    const session = makeSession("group_admin", groupScope);
    const result = await contractFor(session).navigation(session);
    assert.equal(result.state, "success");
    if (result.state === "success") {
      assert.equal(
        result.data.items.some((item) => item.href === "/admin/import"),
        false,
      );
    }
  });
});

function contractFor(session: SessionContext): AuthorizationContract {
  return new AuthorizationContract(
    new InMemoryAuthorizationVersions({ [session.subjectId]: session.authorizationVersion }),
  );
}
