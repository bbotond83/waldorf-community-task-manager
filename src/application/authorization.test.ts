import { sessionGrantBindings } from "../access/session-grants.ts";
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
    ...sessionGrantBindings(`${role}-synthetic`, role, [scope]),
    roles: [role],
    scopes: [scope],
    runtimeMode: "synthetic",
    isSynthetic: true,
  };
}

describe("AuthorizationContract", () => {
  it("exposes a versioned executable matrix", () => {
    assert.equal(AUTHORIZATION_MATRIX_VERSION, "four-role-v1");
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

  it("keeps Kindergarten teacher read-only", async () => {
    const session = makeSession("kindergarten_teacher", groupScope);
    const result = await contractFor(session).authorize(session, {
      matrixRowId: "AUTH-TEACHER-TRACKING",
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

  it("allows Super Administrator import at organization scope", async () => {
    const session = makeSession("super_admin", organizationScope);
    const result = await contractFor(session).authorize(session, {
      matrixRowId: "AUTH-SUPER-ADMIN",
      action: "manage",
      resource: "import",
      scope: organizationScope,
    });
    assert.equal(result.state, "success");
  });

  it("limits governance to Super Administrator", async () => {
    const kindergarten = makeSession("group_admin", groupScope);
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

it("unrelated role and scope lists cannot combine grants", async () => {
  const session = makeSession("kindergarten_teacher", groupScope);
  const mixed = {
    ...session,
    roles: ["super_admin", "kindergarten_teacher"] as const,
    scopes: [organizationScope, groupScope],
    grants: [
      ...session.grants,
      {
        id: "foreign",
        subjectId: session.subjectId,
        role: "super_admin" as const,
        scope: { id: "other", type: "organization" as const, organizationId: "other" },
        grantedAt: "2026",
      },
    ],
  };
  const result = await contractFor(mixed).authorize(mixed, {
    matrixRowId: "AUTH-SUPER-ADMIN",
    action: "manage",
    resource: "import",
    scope: organizationScope,
  });
  assert.equal(result.state, "denied");
  assert.equal("data" in result, false);
});
it("teacher private-field and every mutation denial retain explicit focus and announcement", async () => {
  const session = makeSession("kindergarten_teacher", groupScope);
  for (const action of ["create", "update", "delete", "manage"] as const) {
    const result = await contractFor(session).authorize(session, {
      matrixRowId: "AUTH-TEACHER-TRACKING",
      action,
      resource: "schedule",
      scope: groupScope,
    });
    assert.equal(result.state, "denied");
    assert.equal(result.presentationCode, "APP-DENIED");
    assert.equal(result.announcement, "assertive");
  }
  assert.equal(
    (
      await contractFor(session).authorize(session, {
        matrixRowId: "AUTH-TEACHER-TRACKING",
        action: "read",
        resource: "schedule",
        scope: groupScope,
        fields: ["SF-PHONE"],
      })
    ).state,
    "denied",
  );
});
it("wrong organization group and unknown role deny", async () => {
  const session = makeSession("kindergarten_teacher", groupScope);
  for (const scope of [
    { ...groupScope, id: "other" },
    { ...groupScope, organizationId: "other" },
  ])
    assert.equal(
      (
        await contractFor(session).authorize(session, {
          matrixRowId: "AUTH-TEACHER-TRACKING",
          action: "read",
          resource: "schedule",
          scope,
        })
      ).state,
      "denied",
    );
  const unknown = {
    ...session,
    grants: [{ ...session.grants[0]!, role: "unknown" }],
  } as unknown as SessionContext;
  assert.equal((await contractFor(unknown).navigation(unknown)).state, "denied");
});
it("inactive revoked and invalid-mode sessions have no protected navigation", async () => {
  const session = makeSession("kindergarten_teacher", groupScope);
  for (const candidate of [
    { ...session, isActive: false },
    { ...session, grants: session.grants.map((grant) => ({ ...grant, revokedAt: "2026" })) },
    { ...session, isSynthetic: false },
  ]) {
    const result = await contractFor(candidate).navigation(candidate);
    assert.equal(result.state, "denied");
    assert.equal("data" in result, false);
  }
});
it("missing version invalidates and clears navigation cache", async () => {
  const session = makeSession("kindergarten_teacher", groupScope);
  const versions = new InMemoryAuthorizationVersions();
  const result = await new AuthorizationContract(versions).navigation(session);
  assert.equal(result.state, "invalidated");
  assert.deepEqual(versions.clearedSubjects, [session.subjectId]);
  assert.equal("data" in result, false);
});
