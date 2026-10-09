import { sessionGrantBindings } from "../access/session-grants.ts";
import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import type { Scope } from "../access/index.ts";
import {
  AuthorizationContract,
  InMemoryAuthorizationVersions,
  type SessionContext,
} from "../application/index.ts";
import { createSyntheticAdminFacade, resetSyntheticAdminFixtures } from "./synthetic-admin.ts";

const groupScope: Scope = { id: "group-boroka", type: "group", organizationId: "org-napsugar" };
const otherGroupScope: Scope = { id: "group-masik", type: "group", organizationId: "org-napsugar" };

function session(scope = groupScope): SessionContext {
  return {
    subjectId: `admin-${scope.id}`,
    authorizationVersion: 1,
    ...sessionGrantBindings(`admin-${scope.id}`, "group_admin", [scope]),
    roles: ["group_admin"],
    scopes: [scope],
    runtimeMode: "synthetic",
    isSynthetic: true,
  };
}

function setup(activeSession = session()) {
  const versions = new InMemoryAuthorizationVersions({ [activeSession.subjectId]: 1 });
  const facade = createSyntheticAdminFacade(new AuthorizationContract(versions));
  return { facade, versions };
}

beforeEach(() => resetSyntheticAdminFixtures());

describe("SyntheticAdminPort scoped records", () => {
  it("returns only invented records in the granted group", async () => {
    const { facade } = setup();
    const result = await facade.listRecords(session(), groupScope);
    assert.equal(result.state, "success");
    if (result.state === "success") {
      assert.ok(result.data.items.some((item) => item.id === "family-feny"));
      assert.ok(result.data.items.every((item) => item.id !== "family-napraforgo"));
    }
  });

  it("generically denies a crafted identifier outside the scope", async () => {
    const { facade } = setup();
    const result = await facade.getRecord(session(), groupScope, "family", "family-napraforgo");
    assert.equal(result.state, "denied");
    assert.equal(JSON.stringify(result).includes("Napraforgó"), false);
  });

  it("returns empty for a filter without matches", async () => {
    const { facade } = setup();
    const result = await facade.listRecords(session(), groupScope, { q: "nem létező" });
    assert.equal(result.state, "empty");
  });

  it("rejects stale versions without changing the record", async () => {
    const { facade } = setup();
    const result = await facade.saveRecord(session(), {
      scope: groupScope,
      id: "family-feny",
      expectedVersion: 99,
      idempotencyKey: "record:stale:0001",
      payload: { title: "Módosított név" },
    });
    assert.equal(result.state, "conflict");
    const current = await facade.getRecord(session(), groupScope, "family", "family-feny");
    assert.equal(current.state === "success" ? current.data.title : "", "Fenyő család");
  });

  it("returns retryable and terminal dependency failures explicitly", async () => {
    const { facade } = setup();
    const retryable = await facade.listRecords(session(), groupScope, { scenario: "retryable" });
    const terminal = await facade.listRecords(session(), groupScope, { scenario: "terminal" });
    assert.equal(retryable.state, "dependency-failure-retryable");
    assert.equal(terminal.state, "dependency-failure-terminal");
  });
});

describe("SyntheticAdminPort assignments and archive", () => {
  it("assigns an eligible task once", async () => {
    const { facade } = setup();
    const result = await facade.assign(session(), {
      scope: groupScope,
      id: "task-kert",
      expectedVersion: 1,
      idempotencyKey: "assignment:eligible:1",
      payload: { scenario: "eligible" },
    });
    assert.equal(result.state, "success");
  });

  it("maps ineligible and full capacity to distinct conflicts", async () => {
    const { facade } = setup();
    const ineligible = await facade.assign(session(), {
      scope: groupScope,
      id: "task-kert",
      expectedVersion: 1,
      idempotencyKey: "assignment:ineligible:1",
      payload: { scenario: "ineligible" },
    });
    const full = await facade.assign(session(), {
      scope: groupScope,
      id: "task-kert",
      expectedVersion: 1,
      idempotencyKey: "assignment:capacity:1",
      payload: { scenario: "full" },
    });
    assert.equal(ineligible.code, "ASSIGNMENT_INELIGIBLE");
    assert.equal(full.code, "ASSIGNMENT_CAPACITY_FULL");
  });

  it("leaves an archived record unchanged on restore conflict", async () => {
    const organizationSession: SessionContext = {
      ...session({ id: "org-napsugar", type: "organization", organizationId: "org-napsugar" }),
      ...sessionGrantBindings("admin-org-napsugar", "super_admin", [
        { id: "org-napsugar", type: "organization", organizationId: "org-napsugar" },
      ]),
      roles: ["super_admin"],
    };
    const { facade } = setup(organizationSession);
    const result = await facade.restoreRecord(organizationSession, {
      scope: organizationSession.scopes[0]!,
      id: "year-2026",
      expectedVersion: 4,
      idempotencyKey: "record:restore:1",
      payload: { scenario: "restore-conflict" },
    });
    assert.equal(result.code, "RESTORE_CONFLICT");
  });
});

describe("SyntheticAdminPort approval exact outcomes", () => {
  async function decide(id: string, decision: "approved" | "rejected", scenario = "") {
    const { facade } = setup();
    return facade.decideApproval(session(), {
      scope: groupScope,
      id,
      expectedVersion: 1,
      idempotencyKey: `approval:${id}:${decision}:${scenario || "normal"}`,
      decision,
      payload: { scenario },
    });
  }

  it("returns approved and rejected outcomes", async () => {
    const approved = await decide("approval-csere", "approved");
    resetSyntheticAdminFixtures();
    const rejected = await decide("approval-lemondas", "rejected");
    assert.equal(approved.state === "success" ? approved.data.outcome : "", "approved");
    assert.equal(rejected.state === "success" ? rejected.data.outcome : "", "rejected");
  });

  it("returns already-decided, invalidated, and denied without retry metadata", async () => {
    const already = await decide("approval-lezart", "approved");
    const invalidated = await decide("approval-csere", "approved", "invalidated");
    const denied = await decide("approval-csere", "approved", "denied");
    assert.equal(already.code, "APPROVAL_ALREADY_DECIDED");
    assert.equal(invalidated.state, "invalidated");
    assert.equal(denied.state, "denied");
    assert.equal("retry" in already || "retry" in invalidated || "retry" in denied, false);
  });

  it("returns retry metadata only for retryable dependency failure", async () => {
    const retryable = await decide("approval-csere", "approved", "retryable");
    const terminal = await decide("approval-csere", "approved", "terminal");
    assert.equal(retryable.state, "dependency-failure-retryable");
    assert.equal(
      retryable.state === "dependency-failure-retryable" ? retryable.retry.idempotencyKey : "",
      "approval:approval-csere:approved:retryable",
    );
    assert.equal(terminal.state, "dependency-failure-terminal");
    assert.equal("retry" in terminal, false);
  });
});

describe("SyntheticAdminPort authorization and redaction", () => {
  it("invalidates the next request after authorization revocation", async () => {
    const { facade, versions } = setup();
    versions.setVersion(session().subjectId, 2);
    const result = await facade.getDashboard(session(), groupScope);
    assert.equal(result.state, "invalidated");
    assert.deepEqual(versions.clearedSubjects, [session().subjectId]);
  });

  it("denies a scope not granted by the session before the adapter runs", async () => {
    const { facade } = setup();
    const result = await facade.listRecords(session(), otherGroupScope);
    assert.equal(result.state, "denied");
  });

  it("never projects prohibited contact or profile fields", async () => {
    const { facade } = setup();
    const result = await facade.listRecords(session(), groupScope);
    const serialized = JSON.stringify(result).toLowerCase();
    for (const field of ["email", "phone", "locality", "optionalprofile", "protectedreason"]) {
      assert.equal(serialized.includes(field), false);
    }
  });
});
