import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import {
  AuthorizationContract,
  InMemoryAuthorizationVersions,
  type SessionContext,
} from "../application/index.ts";
import {
  createSyntheticParentFacade,
  inspectSyntheticInvitation,
  PARENT_FAMILY_ID,
  PARENT_FAMILY_SCOPE,
  resetSyntheticParentState,
} from "./index.ts";

const session: SessionContext = Object.freeze({
  subjectId: "parent-local",
  authorizationVersion: 1,
  roles: ["parent"] as const,
  scopes: [PARENT_FAMILY_SCOPE],
  runtimeMode: "synthetic",
  isSynthetic: true,
});

function facade() {
  return createSyntheticParentFacade(
    new AuthorizationContract(
      new InMemoryAuthorizationVersions({ "parent-local": 1, "staff-local": 1 }),
    ),
  );
}

beforeEach(() => resetSyntheticParentState());

describe("synthetic Parent façade", () => {
  it("returns only the linked family's invented duties", async () => {
    const result = await facade().listDuties(session, {
      familyScope: PARENT_FAMILY_SCOPE,
      familyId: PARENT_FAMILY_ID,
    });
    assert.equal(result.state, "success");
    if (result.state === "success") {
      const states = result.data.duties.map((duty) => duty.state);
      assert.ok(states.includes("available"));
      assert.ok(states.includes("full"));
      assert.ok(states.includes("ineligible"));
      assert.ok(states.includes("assigned"));
      assert.doesNotMatch(JSON.stringify(result.data), /email|phone|protected.?reason/i);
    }
  });

  it("generically denies unrelated and unknown duty detail", async () => {
    const app = facade();
    const unrelated = await app.getDuty(session, {
      familyScope: PARENT_FAMILY_SCOPE,
      familyId: "family-unrelated",
      dutyId: "duty-garden",
    });
    const unknown = await app.getDuty(session, {
      familyScope: PARENT_FAMILY_SCOPE,
      familyId: PARENT_FAMILY_ID,
      dutyId: "duty-secret",
    });
    assert.equal(unrelated.state, "denied");
    assert.equal(unknown.state, "denied");
    assert.equal("data" in unrelated, false);
  });

  it("creates exactly one eligible assignment for a repeated idempotency key", async () => {
    const app = facade();
    const input = {
      familyScope: PARENT_FAMILY_SCOPE,
      familyId: PARENT_FAMILY_ID,
      dutyId: "duty-garden",
      expectedVersion: 1,
      idempotencyKey: "signup:duty-garden:v1",
    };
    const first = await app.signUp(session, input);
    const duplicate = await app.signUp(session, input);
    assert.equal(first.state, "success");
    assert.deepEqual(duplicate, first);
  });

  it("keeps full, ineligible, and stale signup state unchanged", async () => {
    const app = facade();
    const shared = { familyScope: PARENT_FAMILY_SCOPE, familyId: PARENT_FAMILY_ID };
    const full = await app.signUp(session, {
      ...shared,
      dutyId: "duty-full",
      expectedVersion: 3,
      idempotencyKey: "signup:duty-full:v3",
    });
    const ineligible = await app.signUp(session, {
      ...shared,
      dutyId: "duty-ineligible",
      expectedVersion: 2,
      idempotencyKey: "signup:duty-ineligible:v2",
    });
    const stale = await app.signUp(session, {
      ...shared,
      dutyId: "duty-garden",
      expectedVersion: 99,
      idempotencyKey: "signup:duty-garden:v99",
    });
    assert.equal(full.state, "conflict");
    assert.equal(ineligible.state, "conflict");
    assert.equal(stale.state, "invalidated");
  });

  it("maps swap success, conflict, and retryable dependency outcomes exactly", async () => {
    const common = {
      familyScope: PARENT_FAMILY_SCOPE,
      familyId: PARENT_FAMILY_ID,
      assignmentId: "assignment-lampas",
      expectedVersion: 4,
    };
    const success = await facade().requestSwap(session, {
      ...common,
      counterpartId: "assignment-counterpart",
      idempotencyKey: "swap:success:0001",
    });
    resetSyntheticParentState();
    const conflict = await facade().requestSwap(session, {
      ...common,
      counterpartId: "conflict",
      idempotencyKey: "swap:conflict:001",
    });
    const retryable = await facade().requestSwap(session, {
      ...common,
      counterpartId: "dependency-retryable",
      idempotencyKey: "swap:retryable:01",
    });
    assert.equal(success.state, "success");
    assert.equal(conflict.state, "conflict");
    assert.equal(retryable.state, "dependency-failure-retryable");
    if (retryable.state === "dependency-failure-retryable") {
      assert.equal(retryable.retry.idempotencyKey, "swap:retryable:01");
    }
  });

  it("maps cancellation validation, terminal dependency, and denial without a reason projection", async () => {
    const app = facade();
    const validation = await app.requestCancellation(session, {
      familyScope: PARENT_FAMILY_SCOPE,
      familyId: PARENT_FAMILY_ID,
      assignmentId: "assignment-lampas",
      expectedVersion: 0,
      idempotencyKey: "bad",
    });
    const terminal = await app.requestCancellation(session, {
      familyScope: PARENT_FAMILY_SCOPE,
      familyId: PARENT_FAMILY_ID,
      assignmentId: "assignment-terminal",
      expectedVersion: 4,
      idempotencyKey: "cancel:terminal:1",
    });
    const denied = await app.requestCancellation(session, {
      familyScope: PARENT_FAMILY_SCOPE,
      familyId: "family-unrelated",
      assignmentId: "assignment-lampas",
      expectedVersion: 4,
      idempotencyKey: "cancel:denied:001",
    });
    assert.equal(validation.state, "validation");
    assert.equal(terminal.state, "dependency-failure-terminal");
    assert.equal(denied.state, "denied");
    assert.doesNotMatch(JSON.stringify([validation, terminal, denied]), /indokl|reason/i);
  });

  it("marks a notification read idempotently and rejects an unknown notification", async () => {
    const app = facade();
    const input = {
      familyScope: PARENT_FAMILY_SCOPE,
      notificationId: "notice-7-day",
      idempotencyKey: "notice:7day:read",
    };
    const first = await app.markNotificationRead(session, input);
    const duplicate = await app.markNotificationRead(session, input);
    const denied = await app.markNotificationRead(session, {
      ...input,
      notificationId: "notice-unrelated",
      idempotencyKey: "notice:unrelated:read",
    });
    assert.equal(first.state, "success");
    assert.deepEqual(duplicate, first);
    assert.equal(denied.state, "denied");
  });

  it("updates only the Parent's own contribution note", async () => {
    const app = facade();
    const allowed = await app.updateOwnContribution(session, {
      familyScope: PARENT_FAMILY_SCOPE,
      eventId: "duty-assigned",
      note: "Saját poharakat viszünk.",
      idempotencyKey: "note:duty-assigned:1",
    });
    const unassigned = await app.updateOwnContribution(session, {
      familyScope: PARENT_FAMILY_SCOPE,
      eventId: "duty-full",
      note: "Tiltott módosítás",
      idempotencyKey: "note:duty-full:0001",
    });
    const staffSession = {
      ...session,
      subjectId: "staff-local",
      roles: ["read_only_staff"] as const,
    };
    const staff = await app.updateOwnContribution(staffSession, {
      familyScope: PARENT_FAMILY_SCOPE,
      eventId: "duty-assigned",
      note: "Tiltott módosítás",
      idempotencyKey: "note:staff:denied",
    });
    assert.equal(allowed.state, "success");
    assert.equal(unassigned.state, "denied");
    assert.equal(staff.state, "denied");
  });
});

describe("synthetic invitation states", () => {
  it("classifies valid, expired, used, and invalid tokens without account data", () => {
    assert.equal(inspectSyntheticInvitation("parent-valid-invitation"), "valid");
    assert.equal(inspectSyntheticInvitation("parent-expired-invitation"), "expired");
    assert.equal(inspectSyntheticInvitation("parent-used-invitation"), "used");
    assert.equal(inspectSyntheticInvitation("anything-else"), "invalid");
  });
});
