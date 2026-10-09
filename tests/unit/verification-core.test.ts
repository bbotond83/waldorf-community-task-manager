import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  validateEvidence,
  validateManifests,
  type Evidence,
} from "../../scripts/verification/core.ts";

const scenarios = validateManifests();
const scenario = scenarios.find(({ id }) => id === "LOCAL-FRESH-START")!;

function validEvidence(root: string): Evidence {
  const artifactPath = "artifact.log";
  writeFileSync(join(root, artifactPath), "privacy-safe evidence\n");
  const now = new Date().toISOString();
  return {
    schemaVersion: "waldorf-evidence-v1",
    scenarioId: scenario.id,
    storyIds: scenario.storyIds,
    requirementIds: scenario.requirementIds,
    matrixRows: scenario.matrixRows,
    fixtureVersion: "waldorf-local-v1",
    manifestVersion: "waldorf-scenarios-v1",
    runtimeMode: "synthetic",
    target: "local",
    tool: scenario.command,
    toolVersion: "test",
    result: "PASS",
    startedAt: now,
    finishedAt: now,
    gitSha: "a".repeat(40),
    artifactPath,
    exitCode: 0,
    durationMs: 1,
  };
}

describe("verification manifests", () => {
  it("cover every active, inherited, NFR-08, authorization, and browser requirement", () => {
    expect(scenarios.length).toBeGreaterThanOrEqual(35);
  });

  it("accepts current complete local evidence", () => {
    const root = mkdtempSync(join(tmpdir(), "waldorf-evidence-"));
    expect(validateEvidence(validEvidence(root), scenarios, root).result).toBe("PASS");
  });

  it("rejects missing artifacts", () => {
    const root = mkdtempSync(join(tmpdir(), "waldorf-evidence-"));
    const record = validEvidence(root);
    record.artifactPath = "missing.log";
    expect(() => validateEvidence(record, scenarios, root)).toThrow(/artifact is missing/);
  });

  it("rejects stale evidence", () => {
    const root = mkdtempSync(join(tmpdir(), "waldorf-evidence-"));
    const record = validEvidence(root);
    record.startedAt = "2026-01-01T00:00:00.000Z";
    record.finishedAt = "2026-01-01T00:00:01.000Z";
    expect(() => validateEvidence(record, scenarios, root)).toThrow(/stale/);
  });

  it("rejects metadata mismatch", () => {
    const root = mkdtempSync(join(tmpdir(), "waldorf-evidence-"));
    const record = validEvidence(root);
    record.fixtureVersion = "other" as Evidence["fixtureVersion"];
    expect(() => validateEvidence(record, scenarios, root)).toThrow(/metadata mismatch/);
  });

  it("rejects PASS when a tool failed", () => {
    const root = mkdtempSync(join(tmpdir(), "waldorf-evidence-"));
    const record = validEvidence(root);
    record.exitCode = 1;
    expect(() => validateEvidence(record, scenarios, root)).toThrow(/exitCode 0/);
  });

  it("never upgrades linked-target evidence from OUTSTANDING", () => {
    const root = mkdtempSync(join(tmpdir(), "waldorf-evidence-"));
    const linked = scenarios.find(({ target }) => target === "linked-target")!;
    const record = validEvidence(root);
    Object.assign(record, {
      scenarioId: linked.id,
      storyIds: linked.storyIds,
      requirementIds: linked.requirementIds,
      matrixRows: linked.matrixRows,
      runtimeMode: "linked-target",
      target: "linked-target",
      result: "PASS",
    });
    expect(() => validateEvidence(record, scenarios, root)).toThrow(/cannot upgrade/);
  });
});

describe("current four-role manifest contract", () => {
  it("uses current teacher and Super rows instead of obsolete allowed roles", () => {
    const current = validateManifests();
    expect(current.every((s) => !/staff-local|kindergarten-admin-local/.test(s.profile))).toBe(
      true,
    );
    expect(current.some((s) => s.matrixRows.includes("AUTH-SUPER-GOVERNANCE-ALLOW"))).toBe(true);
    expect(current.some((s) => s.matrixRows.includes("AUTH-NON-SUPER-ADVANCED-DENY"))).toBe(true);
  });
});
