import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Scope } from "../access/index.ts";
import { SyntheticAdminPort } from "../admin-core/synthetic-admin.ts";
import {
  ADMIN_LIST_STATUS_OPTIONS,
  DUTY_STATE_LABELS,
  dutyStateLabel,
  type AdminListKind,
  STATUS_LABELS,
  statusLabel,
  UNKNOWN_STATUS_LABEL,
  type KnownStatus,
} from "./status-labels.ts";

const organizationScope: Scope = {
  id: "org-napsugar",
  type: "organization",
  organizationId: "org-napsugar",
};

// Values spelled out in the application's status types (src/application/contracts.ts).
const TYPE_STATUS_VALUES: readonly string[] = [
  "pending",
  "approved",
  "rejected",
  "assigned",
  "notes-saved",
  "queued",
  "sent",
  "retryable",
  "retrying",
  "retry-scheduled",
  "stale",
  "cancelled",
  "terminal",
  "eligible-delete",
  "eligible-anonymize",
  "blocked",
  "selected",
  "validated",
  "preview",
  "conflicts",
  "confirmed",
  "committed",
  "rolled-back",
  "interrupted",
  "recovered",
  "available",
  "full",
  "ineligible",
  "swap-pending",
  "cancellation-pending",
];

const FORBIDDEN_ENGLISH_WORDS = [
  /\bpending\b/i,
  /\bapproved\b/i,
  /\brejected\b/i,
  /\bactive\b/i,
  /\barchived\b/i,
  /\bopen\b/i,
  /\bscheduled\b/i,
  /\bsent\b/i,
  /\bblocked\b/i,
  /\bstale\b/i,
  /\bfull\b/i,
  /\bretry\b/i,
];

async function syntheticAdminStates(): Promise<string[]> {
  const port = new SyntheticAdminPort();
  const states = new Set<string>();
  for (const operation of ["records.list", "tasks.list", "approvals.list"] as const) {
    const outcome = await port.execute({
      actorId: "label-test",
      operation,
      scope: organizationScope,
      payload: {},
    });
    assert.equal(outcome.state, "success");
    if (outcome.state === "success") {
      for (const item of (outcome.data as { items: readonly { state: string }[] }).items) {
        states.add(item.state);
      }
    }
  }
  return [...states];
}

describe("statusLabel", () => {
  it("labels every status value the synthetic admin data can produce", async () => {
    const states = await syntheticAdminStates();
    assert.ok(states.length >= 6, "the synthetic data exposes the six list states");
    for (const state of states) {
      assert.notEqual(statusLabel(state), UNKNOWN_STATUS_LABEL, `no label for ${state}`);
    }
  });

  it("labels every value of the application status types", () => {
    for (const value of [...TYPE_STATUS_VALUES, "active", "archived", "open", "scheduled"]) {
      assert.ok(Object.hasOwn(STATUS_LABELS, value), `no label for ${value}`);
      assert.notEqual(statusLabel(value), UNKNOWN_STATUS_LABEL);
    }
  });

  it("uses the agreed words for the common list states", () => {
    assert.equal(statusLabel("pending"), "Függőben");
    assert.equal(statusLabel("approved"), "Jóváhagyva");
    assert.equal(statusLabel("active"), "Aktív");
    assert.equal(statusLabel("archived"), "Archivált");
    assert.equal(statusLabel("open"), "Nyitott");
    assert.equal(statusLabel("scheduled"), "Ütemezve");
  });

  it("never returns a raw English value or an English word", () => {
    for (const key of Object.keys(STATUS_LABELS) as KnownStatus[]) {
      const label = statusLabel(key);
      assert.notEqual(label, key);
      for (const word of FORBIDDEN_ENGLISH_WORDS) {
        assert.doesNotMatch(label, word, `${key} label contains an English word`);
      }
    }
  });

  it("falls back to the unknown label for unlisted and inherited keys", () => {
    assert.equal(statusLabel("something-new"), "Ismeretlen állapot");
    assert.equal(statusLabel(""), "Ismeretlen állapot");
    assert.equal(statusLabel("toString"), "Ismeretlen állapot");
    assert.equal(statusLabel("__proto__"), "Ismeretlen állapot");
  });
});

describe("dutyStateLabel", () => {
  it("labels every parent duty state with the request words of the pending notices", () => {
    for (const state of [
      "available",
      "full",
      "ineligible",
      "assigned",
      "swap-pending",
      "cancellation-pending",
    ]) {
      assert.ok(Object.hasOwn(DUTY_STATE_LABELS, state), `no duty label for ${state}`);
      assert.notEqual(dutyStateLabel(state), UNKNOWN_STATUS_LABEL);
    }
    assert.equal(dutyStateLabel("swap-pending"), "Cserekérelem folyamatban");
    assert.equal(dutyStateLabel("cancellation-pending"), "Lemondási kérelem folyamatban");
  });

  it("falls back to the unknown label for unlisted and inherited keys", () => {
    assert.equal(dutyStateLabel("something-new"), UNKNOWN_STATUS_LABEL);
    assert.equal(dutyStateLabel("toString"), UNKNOWN_STATUS_LABEL);
  });
});

describe("ADMIN_LIST_STATUS_OPTIONS", () => {
  const operations = {
    records: "records.list",
    tasks: "tasks.list",
    approvals: "approvals.list",
  } as const;

  it("offers only labelled statuses, each once, and every status the demo data holds", async () => {
    const port = new SyntheticAdminPort();
    for (const kind of Object.keys(ADMIN_LIST_STATUS_OPTIONS) as AdminListKind[]) {
      const offered: readonly string[] = ADMIN_LIST_STATUS_OPTIONS[kind];
      assert.equal(new Set(offered).size, offered.length, `${kind} repeats a status`);
      for (const value of offered) {
        assert.ok(Object.hasOwn(STATUS_LABELS, value), `${kind} offers unknown status ${value}`);
      }
      const outcome = await port.execute({
        actorId: "label-test",
        operation: operations[kind],
        scope: organizationScope,
        payload: {},
      });
      assert.equal(outcome.state, "success");
      if (outcome.state === "success") {
        const items = (outcome.data as { items: readonly { state: string }[] }).items;
        assert.ok(items.length > 0, `${kind} demo list is empty`);
        for (const item of items) {
          assert.ok(offered.includes(item.state), `${kind} demo status ${item.state} not offered`);
        }
      }
    }
  });

  it("returns a result for every offered value that the demo data holds", async () => {
    const port = new SyntheticAdminPort();
    for (const kind of ["records", "tasks"] as const) {
      for (const value of ADMIN_LIST_STATUS_OPTIONS[kind]) {
        const outcome = await port.execute({
          actorId: "label-test",
          operation: operations[kind],
          scope: organizationScope,
          payload: { state: value },
        });
        assert.equal(outcome.state, "success", `${kind} ${value} filter has no result`);
      }
    }
  });
});
