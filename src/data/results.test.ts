import assert from "node:assert/strict";
import test from "node:test";
import { TerminalDataFailure } from "./errors.ts";
import type { Envelope } from "./gateway.ts";
import { BUSINESS_CODE_STATES, refused, toItemsOutcome, toOutcome } from "./results.ts";

const envelope = (
  state: string,
  code: string | null = null,
  extra: Record<string, unknown> = {},
): Envelope => ({ state, reference: null, code, ...extra });

test("a success carries what the reader builds from the envelope", () => {
  const outcome = toOutcome(
    envelope("success", null, { version: 4 }),
    (current) => current.version,
  );
  assert.deepEqual(outcome, { state: "success", data: 4 });
});

test("denied has no code and no data", () => {
  assert.deepEqual(
    toOutcome(envelope("denied", "authorization_denied"), () => 1),
    {
      state: "denied",
    },
  );
});

test("every business code of BR32.8 keeps its state and code", () => {
  for (const [code, state] of Object.entries(BUSINESS_CODE_STATES)) {
    assert.deepEqual(
      toOutcome(envelope(state, code), () => 1),
      { state, code },
      code,
    );
  }
  assert.equal(Object.keys(BUSINESS_CODE_STATES).length, 22, "the table lists every code");
});

test("a conflict or invalidation without a code still maps to its state", () => {
  assert.deepEqual(
    toOutcome(envelope("conflict"), () => 1),
    { state: "conflict" },
  );
  assert.deepEqual(
    toOutcome(envelope("invalidated"), () => 1),
    { state: "invalidated" },
  );
});

test("a refused field names the field in camel case with a code the screen can translate", () => {
  const outcome = toOutcome(
    envelope("validation", "field_invalid", { field: "parents.display_name", reason: "invalid" }),
    () => 1,
  );
  assert.deepEqual(outcome, {
    state: "validation",
    fieldErrors: { "parents.displayName": "VAL-INVALID" },
    code: "field_invalid",
  });
});

test("the reason of a refused field picks its code", () => {
  const code = (field: string, reason: string) => {
    const outcome = toOutcome(envelope("validation", "field_invalid", { field, reason }), () => 1);
    assert.equal(outcome.state, "validation");
    return outcome.state === "validation" ? Object.values(outcome.fieldErrors)[0] : undefined;
  };
  assert.equal(code("name", "taken"), "VAL-TAKEN");
  assert.equal(code("school_year_id", "archived"), "VAL-ARCHIVED");
  assert.equal(code("school_year_id", "locked"), "VAL-LOCKED");
  assert.equal(code("ends_on", "before_start"), "VAL-DATE-RANGE");
  assert.equal(code("group_id", "not_found"), "VAL-NOT-FOUND");
  assert.equal(code("end_group_ids", "membership_not_found"), "VAL-NOT-FOUND");
  assert.equal(code("expected_version", "invalid"), "VAL-EXPECTED-VERSION");
  assert.equal(code("title", "something_new"), "VAL-INVALID");
});

test("a record that is not found reads exactly like a refused access", () => {
  for (const code of [
    "duty_not_found",
    "family_not_found",
    "request_not_found",
    "item_not_found",
  ]) {
    assert.deepEqual(
      toOutcome(envelope("validation", code), () => 1),
      { state: "denied" },
      code,
    );
  }
  assert.deepEqual(
    toOutcome(envelope("validation", "invitation_not_valid"), () => 1),
    {
      state: "denied",
    },
  );
});

test("a missing idempotency key and a bad date range have their own field codes", () => {
  assert.deepEqual(
    toOutcome(envelope("validation", "idempotency_key_invalid"), () => 1),
    {
      state: "validation",
      fieldErrors: { idempotencyKey: "VAL-IDEMPOTENCY-KEY" },
      code: "idempotency_key_invalid",
    },
  );
  assert.deepEqual(
    toOutcome(envelope("validation", "VAL-DATE-RANGE"), () => 1),
    {
      state: "validation",
      fieldErrors: { range: "VAL-DATE-RANGE" },
      code: "VAL-DATE-RANGE",
    },
  );
});

test("any other refusal is a request-level validation", () => {
  assert.deepEqual(
    toOutcome(envelope("validation", "request_invalid"), () => 1),
    {
      state: "validation",
      fieldErrors: { request: "VAL-INVALID" },
      code: "request_invalid",
    },
  );
  assert.deepEqual(
    toOutcome(envelope("validation"), () => 1),
    {
      state: "validation",
      fieldErrors: { request: "VAL-INVALID" },
      code: "request_invalid",
    },
  );
});

test("a state nobody knows is a terminal failure and never a success", () => {
  assert.throws(() => toOutcome(envelope("surprise"), () => 1), TerminalDataFailure);
  assert.throws(() => toOutcome(envelope("terminal", "boom"), () => 1), TerminalDataFailure);
});

test("a list function with no items is the empty state, with items a success", () => {
  const build = (rows: readonly unknown[]) => rows.length;
  assert.deepEqual(toItemsOutcome(envelope("success", null, { items: [] }), build), {
    state: "empty",
  });
  assert.deepEqual(
    toItemsOutcome(envelope("success", null, { items: [{ a: 1 }, { a: 2 }] }), build),
    {
      state: "success",
      data: 2,
    },
  );
});

test("a list function passes its refusals on and rejects a malformed list", () => {
  assert.deepEqual(
    toItemsOutcome(envelope("denied", "no_family"), () => 1),
    { state: "denied" },
  );
  assert.throws(
    () => toItemsOutcome(envelope("success", null, { items: "nope" }), () => 1),
    TerminalDataFailure,
  );
});

test("refused builds a validation outcome for a request-level problem", () => {
  assert.deepEqual(refused({ familyId: "VAL-REQUIRED" }, "field_invalid"), {
    state: "validation",
    fieldErrors: { familyId: "VAL-REQUIRED" },
    code: "field_invalid",
  });
  assert.equal(refused({ a: "b" }).state, "validation");
});
