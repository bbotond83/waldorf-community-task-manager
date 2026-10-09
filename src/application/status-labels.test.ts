import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Scope } from "../access/index.ts";
import { SyntheticAdminPort } from "../admin-core/synthetic-admin.ts";
import {
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
