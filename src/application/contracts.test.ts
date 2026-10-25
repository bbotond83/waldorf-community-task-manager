import { sessionGrantBindings } from "../access/session-grants.ts";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  EvidenceRecorder,
  EventCoordinator,
  InMemoryApplicationJournal,
  UnsafeProjectionError,
  assertNoForbiddenProperties,
  mapUnexpectedFailure,
  normalizeRequiredText,
  projectAllowlisted,
  retryableFailure,
  validateDateRange,
  validateMutationContext,
} from "./index.ts";
import type { AuthorizedContext, Clock, IdGenerator, SessionContext } from "./index.ts";

const session: SessionContext = {
  subjectId: "parent-synthetic-1",
  authorizationVersion: 1,
  ...sessionGrantBindings("parent-synthetic-1", "parent", [
    { id: "family-1", type: "family", organizationId: "org-1" },
  ]),
  roles: ["parent"],
  scopes: [{ id: "family-1", type: "family", organizationId: "org-1" }],
};

const authorized: AuthorizedContext = {
  session,
  matrixRowId: "AUTH-PARENT-DUTIES",
  scope: session.scopes[0]!,
  fields: ["SF-DISPLAY-NAME"],
};

describe("application contracts", () => {
  it("normalizes equivalent whitespace", () => {
    const result = normalizeRequiredText("  Kerti   munka ", "title");
    assert.equal(result.state, "success");
    if (result.state === "success") assert.equal(result.data, "Kerti munka");
  });

  it("returns a stable required-field error", () => {
    assert.deepEqual(normalizeRequiredText(" ", "title"), {
      state: "validation",
      code: "VALIDATION_FAILED",
      presentationCode: "APP-VALIDATION",
      focusTarget: "#hibajelzes",
      announcement: "assertive",
      fieldErrors: { title: "VAL-REQUIRED" },
    });
  });

  it("rejects invalid mutation metadata", () => {
    const result = validateMutationContext({ idempotencyKey: "short", expectedVersion: 0 });
    assert.equal(result.state, "validation");
    if (result.state === "validation") {
      assert.equal(result.fieldErrors.idempotencyKey, "VAL-IDEMPOTENCY-KEY");
      assert.equal(result.fieldErrors.expectedVersion, "VAL-EXPECTED-VERSION");
    }
  });

  it("rejects schedule ranges beyond 31 days", () => {
    assert.equal(validateDateRange("2026-01-01", "2026-02-02").state, "validation");
  });

  it("constructs retry metadata only for retryable failures", () => {
    const result = retryableFailure({ idempotencyKey: "signup:key-1", action: "signup" });
    assert.equal(result.state, "dependency-failure-retryable");
    assert.equal(result.retry.idempotencyKey, "signup:key-1");
  });

  it("maps unknown failures to terminal by default", () => {
    const result = mapUnexpectedFailure(new Error("provider secret"), {
      idempotencyKey: "signup:key-1",
      action: "signup",
    });
    assert.equal(result.state, "dependency-failure-terminal");
    assert.equal(JSON.stringify(result).includes("provider secret"), false);
  });

  it("creates an immutable allowlisted projection", () => {
    const projection = projectAllowlisted(
      authorized,
      { id: "duty-1", title: "Kerti munka", internalStatus: "secret-ish" },
      ["id", "title"],
    );
    assert.deepEqual(projection, { id: "duty-1", title: "Kerti munka" });
    assert.equal(Object.isFrozen(projection), true);
    assert.equal("internalStatus" in projection, false);
  });

  it("rejects prohibited properties recursively", () => {
    assert.throws(
      () => assertNoForbiddenProperties({ family: { email: "synthetic@example.invalid" } }),
      UnsafeProjectionError,
    );
  });

  it("records database PASS but keeps linked targets OUTSTANDING", async () => {
    const journal = new InMemoryApplicationJournal();
    const clock: Clock = { now: () => new Date("2026-08-12T10:00:00.000Z") };
    let sequence = 0;
    const ids: IdGenerator = { nextId: () => `evidence-${++sequence}` };
    const recorder = new EvidenceRecorder(journal, clock, ids);
    const base = {
      scenarioId: "SCN-AUTH-PARENT",
      storyId: "US-LR-00",
      requirementId: "NFR-LR-05",
      matrixRowId: "AUTH-PARENT-DUTIES" as const,
      location: "local-contract-suite",
      outcome: "passed" as const,
    };

    assert.equal((await recorder.record({ ...base, executionTarget: "database" })).status, "PASS");
    assert.equal(
      (await recorder.record({ ...base, executionTarget: "linked-target" })).status,
      "OUTSTANDING",
    );
  });

  it("publishes a privacy-minimized application event", async () => {
    const journal = new InMemoryApplicationJournal();
    const coordinator = new EventCoordinator(
      journal,
      { now: () => new Date("2026-08-12T10:00:00.000Z") },
      { nextId: () => "event-1" },
    );
    const event = await coordinator.publish({
      type: "assignment.changed",
      aggregateId: "assignment-1",
      aggregateVersion: 2,
      idempotencyKey: "assignment:key-1",
      summary: "changed",
    });
    assert.equal(event.id, "event-1");
    assert.deepEqual(journal.events, [event]);
  });
});
