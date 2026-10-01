// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  aggregateEvidence,
  loadJson,
  manifestHash,
  readEvidenceDirectory,
  validateEvidence,
  validateManifests,
  type Evidence,
} from "../../scripts/verification/core.ts";
const seams = vi.hoisted(() => ({ spawn: vi.fn(), exec: vi.fn(), browserPath: "" }));
vi.mock("node:child_process", () => ({ spawnSync: seams.spawn, execFileSync: seams.exec }));
vi.mock("@playwright/test", () => ({ firefox: { executablePath: () => seams.browserPath } }));
const sourceRoot = process.cwd();
const originalArgv = process.argv;
let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "waldorf-coverage-verification-"));
  cpSync(join(sourceRoot, "verification"), join(root, "verification"), { recursive: true });
  mkdirSync(join(root, ".verification", "evidence"), { recursive: true });
  mkdirSync(join(root, ".verification", "logs"), { recursive: true });
  vi.spyOn(process, "cwd").mockReturnValue(root);
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  seams.spawn.mockReset();
  seams.exec.mockReset();
  vi.resetModules();
});
afterEach(() => {
  process.argv = originalArgv;
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  rmSync(root, { recursive: true, force: true });
});
function evidence(index = 0): Evidence {
  const scenario = validateManifests(root)[index]!;
  const now = new Date().toISOString();
  const artifact = ".verification/logs/synthetic.log";
  writeFileSync(join(root, artifact), "Invented bounded evidence");
  return {
    schemaVersion: "waldorf-evidence-v1",
    scenarioId: scenario.id,
    storyIds: scenario.storyIds,
    requirementIds: scenario.requirementIds,
    matrixRows: scenario.matrixRows,
    fixtureVersion: "waldorf-local-v1",
    manifestVersion: "waldorf-scenarios-v1",
    runtimeMode: scenario.target === "local" ? "synthetic" : "linked-target",
    target: scenario.target,
    tool: "synthetic-tests",
    toolVersion: "1",
    result: scenario.target === "local" ? "PASS" : "OUTSTANDING",
    startedAt: now,
    finishedAt: now,
    gitSha: "a".repeat(40),
    artifactPath: artifact,
    exitCode: scenario.target === "local" ? 0 : undefined,
  };
}
it("validates full public manifests and hashes actual content", async () => {
  expect(validateManifests(root).length).toBeGreaterThan(24);
  expect(manifestHash(root)).toMatch(/^[a-f0-9]{64}$/);
  await import("../../scripts/verification/validate-manifests.ts");
  expect(console.log).toHaveBeenCalledWith(expect.stringContaining("VERIFICATION_MANIFESTS_VALID"));
  const file = join(root, "verification", "fixtures.json");
  const value = loadJson<Record<string, unknown>>(file);
  value.version = "wrong";
  writeFileSync(file, JSON.stringify(value));
  expect(() => validateManifests(root)).toThrow("fixture version mismatch");
});
it("rejects invalid evidence schema, timing, provenance and missing artifacts", () => {
  const scenarios = validateManifests(root);
  const valid = evidence();
  expect(validateEvidence(valid, scenarios, root)).toEqual(valid);
  for (const [field, value, message] of [
    ["schemaVersion", "wrong", "schema"],
    ["gitSha", "unknown", "gitSha"],
    ["startedAt", "invalid", "timestamps"],
    ["finishedAt", "2020-01-01T00:00:00Z", "timestamps"],
    ["fixtureVersion", "wrong", "metadata"],
    ["target", "linked-target", "target"],
    ["runtimeMode", "production", "not synthetic"],
    ["exitCode", 1, "exitCode"],
    ["artifactPath", "missing.log", "missing"],
    ["storyIds", [], "trace arrays"],
    ["storyIds", "invalid", "trace arrays"],
    ["requirementIds", null, "trace arrays"],
    ["matrixRows", null, "trace arrays"],
    ["requirementIds", [], "trace arrays"],
    ["matrixRows", [], "trace arrays"],
    ["finishedAt", "invalid", "timestamps"],
    ["tool", "", "required"],
  ] as const)
    expect(() => validateEvidence({ ...valid, [field]: value }, scenarios, root)).toThrow(message);
  expect(() => validateEvidence(null, scenarios, root)).toThrow("object");
  expect(() =>
    validateEvidence({ ...valid, tool: "secret=" + "invented" }, scenarios, root),
  ).toThrow("prohibited");
});
async function runner(failed?: string) {
  seams.exec.mockImplementation((command: string) =>
    command === "git" ? "a".repeat(40) : "11.19.0",
  );
  seams.spawn.mockImplementation((_command: string, args: string[]) => ({
    status: args.includes(failed ?? "never") ? 7 : 0,
    stdout: "SAFE_STEP_OK",
    stderr: "",
  }));
  await import("../../scripts/verification/run-local-verification.ts");
}
it("executes real orchestration ordering with every subprocess safely simulated", async () => {
  await runner();
  const commands = seams.spawn.mock.calls.map((call) => call[1].join(" "));
  expect(commands.slice(0, 3)).toEqual([
    "run check:toolchain",
    "run verify:manifests",
    "run format:check",
  ]);
  expect(commands).toContain("run verify:security");
  expect(commands.at(-1)).toBe("run scan:privacy");
  const records = readEvidenceDirectory(join(root, ".verification/evidence")) as Evidence[];
  expect(records).toHaveLength(validateManifests(root).length);
  expect(
    records.filter((r) => r.target === "linked-target").every((r) => r.result === "OUTSTANDING"),
  ).toBe(true);
  vi.stubEnv("VERIFICATION_EVIDENCE_DIR", join(root, ".verification/evidence"));
  await import("../../scripts/verification/aggregate-evidence.ts");
  const report = loadJson<{ counts: { fail: number; pass: number; outstanding: number } }>(
    join(root, "verification/reports/local-acceptance.json"),
  );
  expect(report.counts.fail).toBe(0);
  expect(report.counts.pass).toBeGreaterThan(0);
  expect(report.counts.outstanding).toBeGreaterThan(0);
});
it("halts at failed lint before security/build and records safe evidence", async () => {
  await expect(runner("lint")).rejects.toThrow("step=lint exit=7");
  expect(seams.spawn.mock.calls.some((call) => call[1].includes("build"))).toBe(false);
  expect(readFileSync(join(root, ".verification/logs/lint.log"), "utf8")).toBe("SAFE_STEP_OK");
});
it("rejects omitted and duplicated aggregate evidence", () => {
  const directory = join(root, ".verification/evidence");
  const input = {
    root,
    evidenceDirectory: directory,
    reportJson: join(root, "verification/reports/a.json"),
    reportMarkdown: join(root, "verification/reports/a.md"),
    outstandingMarkdown: join(root, "verification/reports/out.md"),
  };
  expect(() => aggregateEvidence(input)).toThrow("missing required evidence");
  const row = evidence();
  writeFileSync(join(directory, "one.json"), JSON.stringify(row));
  writeFileSync(join(directory, "two.json"), JSON.stringify(row));
  expect(() => aggregateEvidence(input)).toThrow("duplicate evidence");
});
it.each([
  ["authorization-matrix.json", "version", "matrix version"],
  ["sensitive-fields.json", "version", "field version"],
  ["scenarios.json", "version", "scenario version"],
  ["authorization-matrix.json", "rows", "collections"],
  ["sensitive-fields.json", "fields", "collections"],
  ["fixtures.json", "profiles", "collections"],
  ["scenarios.json", "scenarios", "collections"],
])("rejects malformed manifest %s %s", (file, key, message) => {
  const path = join(root, "verification", file);
  const document = loadJson<Record<string, unknown>>(path);
  document[key] = "invalid";
  writeFileSync(path, JSON.stringify(document));
  expect(() => validateManifests(root)).toThrow(message);
});
it.each([
  ["unknown-field", "unknown field"],
  ["invalid-effect", "invalid effect"],
  ["duplicate-row", "duplicates"],
  ["incomplete", "incomplete"],
  ["unknown-profile", "unknown profile"],
  ["unknown-row", "unknown matrix row"],
  ["local-status", "local expectation"],
  ["linked-status", "linked target"],
  ["missing-story", "missing story"],
  ["missing-nfr", "missing NFR-08"],
  ["missing-browser", "missing browser"],
  ["safari-status", "explicitly OUTSTANDING"],
])("rejects inconsistent manifest %s", (kind, message) => {
  const matrixPath = join(root, "verification/authorization-matrix.json");
  const scenarioPath = join(root, "verification/scenarios.json");
  const matrix = loadJson<{ rows: { id: string; fields?: string[]; effect: string }[] }>(
    matrixPath,
  );
  const manifest = loadJson<{ scenarios: import("../../scripts/verification/core.ts").Scenario[] }>(
    scenarioPath,
  );
  const first = manifest.scenarios[0]!;
  if (kind === "unknown-field") matrix.rows[0]!.fields = ["unknown"];
  if (kind === "invalid-effect") matrix.rows[0]!.effect = "invalid";
  if (kind === "duplicate-row") matrix.rows.push(matrix.rows[0]!);
  if (kind === "incomplete") first.storyIds = [];
  if (kind === "unknown-profile") first.profile = "unknown";
  if (kind === "unknown-row") first.matrixRows = ["unknown"];
  if (kind === "local-status")
    manifest.scenarios.find((s) => s.target === "local")!.expected = "OUTSTANDING";
  if (kind === "linked-status")
    manifest.scenarios.find((s) => s.target === "linked-target")!.expected = "PASS";
  if (kind === "missing-story")
    for (const row of manifest.scenarios)
      row.storyIds = row.storyIds.map((id) => (id === "US-LR-00" ? "unrequired-story" : id));
  if (kind === "missing-nfr")
    manifest.scenarios.find((s) => s.id === "NFR08-IMPORT")!.id = "renamed";
  if (kind === "missing-browser")
    for (const row of manifest.scenarios)
      row.browsers = row.browsers?.filter((b) => b !== "firefox");
  if (kind === "safari-status")
    manifest.scenarios = manifest.scenarios.filter((s) => s.browser !== "safari-desktop");
  writeFileSync(matrixPath, JSON.stringify(matrix));
  writeFileSync(scenarioPath, JSON.stringify(manifest));
  expect(() => validateManifests(root)).toThrow(message);
});
it("rejects stale, future, unknown and improperly promoted evidence", () => {
  const scenarios = validateManifests(root);
  const valid = evidence();
  for (const offset of [-25 * 60 * 60_000, 10 * 60_000]) {
    const timestamp = new Date(Date.now() + offset).toISOString();
    expect(() =>
      validateEvidence({ ...valid, startedAt: timestamp, finishedAt: timestamp }, scenarios, root),
    ).toThrow("stale or future");
  }
  expect(() => validateEvidence({ ...valid, scenarioId: "unknown" }, scenarios, root)).toThrow(
    "unknown evidence",
  );
  expect(() => validateEvidence({ ...valid, result: "OUTSTANDING" }, scenarios, root)).toThrow(
    "cannot be OUTSTANDING",
  );
  const linked = evidence(scenarios.findIndex((s) => s.target === "linked-target"));
  expect(() =>
    validateEvidence({ ...linked, result: "PASS", exitCode: 0 }, scenarios, root),
  ).toThrow("cannot upgrade");
  expect(readEvidenceDirectory(join(root, "absent"))).toEqual([]);
});
it.each([
  ["fixtures.json", "profiles"],
  ["sensitive-fields.json", "fields"],
  ["scenarios.json", "scenarios"],
])("rejects duplicate identifiers in %s", (file, key) => {
  const path = join(root, "verification", file);
  const document = loadJson<Record<string, unknown[]>>(path);
  document[key]!.push(document[key]![0]);
  writeFileSync(path, JSON.stringify(document));
  expect(() => validateManifests(root)).toThrow("duplicates");
});
it.each(["privacy", "secrets", "sast", "no-deploy"])(
  "runs measured %s scanner against only invented owned files",
  async (mode) => {
    process.argv = ["node", "scanner", mode];
    await import("../../scripts/verification/scan-artifacts.ts");
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining(mode.toUpperCase() + "_SCAN_PASS"),
    );
  },
);
it("rejects prohibited privacy artifact while exposing only matched rule/path", async () => {
  writeFileSync(join(root, ".verification/logs/private.log"), "person@" + "invented.invalid");
  process.argv = ["node", "scanner", "privacy"];
  await expect(import("../../scripts/verification/scan-artifacts.ts")).rejects.toThrow(
    "PRIVACY_SCAN_FAILED",
  );
});
it("rejects invalid scanner mode", async () => {
  process.argv = ["node", "scanner", "wrong"];
  await expect(import("../../scripts/verification/scan-artifacts.ts")).rejects.toThrow("usage:");
});
it("rewrites only invented Firefox metadata in owned resources", async () => {
  const resources = join(root, "browser", "Resources");
  mkdirSync(join(resources, "browser"), { recursive: true });
  writeFileSync(join(resources, "application.ini"), "Vendor=Invented\nName=InventedBrowser\n");
  seams.browserPath = join(root, "browser", "MacOS", "firefox");
  const { firefoxLaunchOptions } = await import("../../scripts/verification/firefox-launch.ts");
  const options = firefoxLaunchOptions();
  if (process.platform === "darwin") {
    expect(options.timeout).toBe(30000);
    expect(readFileSync(options.env!.XUL_APP_FILE!, "utf8")).toContain(
      "Name=WaldorfPlaywrightFirefox",
    );
  } else expect(options).toEqual({});
});
