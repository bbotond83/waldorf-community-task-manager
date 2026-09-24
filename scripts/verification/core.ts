import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

export const REQUIRED_LOCAL_STORIES = [
  "US-LR-00",
  "US-LR-01",
  "US-LR-02",
  "US-LR-03",
  "US-LR-04a",
  "US-LR-04b",
  "US-LR-04c",
  "US-LR-04d",
  "US-LR-04e",
  "US-LR-04f",
  "US-LR-05",
  "US-LR-06a1",
  "US-LR-06a2",
  "US-LR-06b1",
  "US-LR-06b2",
  "US-LR-06c",
  "US-LR-06d",
  "US-LR-06e",
  "US-LR-06f",
  "US-LR-06g",
  "US-LR-06h",
  "US-LR-07",
  "US-LR-08",
  "US-LR-09",
] as const;

export const REQUIRED_INHERITED_STORIES = Array.from(
  { length: 14 },
  (_, index) => `US-${String(index + 1).padStart(2, "0")}`,
);

export const REQUIRED_NFR08_SCENARIOS = [
  "NFR08-INVITATION-EXPIRY-RESEND",
  "NFR08-UPCOMING-DUTY",
  "NFR08-NOTIFICATION-CENTRE",
  "NFR08-QUEUES-FILTERS",
  "NFR08-SCHOOL-YEAR-ARCHIVE",
  "NFR08-ROLE-RESOURCE-FIELD-PARITY",
  "NFR08-IMPORT",
  "NFR08-REMINDERS",
  "NFR08-LIFECYCLE-RECOVERY",
] as const;

export type Scenario = {
  id: string;
  storyIds: string[];
  requirementIds: string[];
  target: "local" | "linked-target";
  command: string;
  profile: string;
  route: string;
  matrixRows: string[];
  expected: "PASS" | "OUTSTANDING";
  evidence: string;
  browser?: string;
  browsers?: string[];
};

export type Evidence = {
  schemaVersion: "waldorf-evidence-v1";
  scenarioId: string;
  storyIds: string[];
  requirementIds: string[];
  matrixRows: string[];
  fixtureVersion: "waldorf-local-v1";
  manifestVersion: "waldorf-scenarios-v1";
  runtimeMode: "synthetic" | "linked-target";
  target: "local" | "linked-target";
  tool: string;
  toolVersion: string;
  browser?: string;
  viewport?: string;
  result: "PASS" | "FAIL" | "OUTSTANDING";
  startedAt: string;
  finishedAt: string;
  gitSha: string;
  artifactPath: string;
  exitCode?: number;
  durationMs?: number;
};

type JsonObject = Record<string, unknown>;

export function loadJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function asObject(value: unknown, context: string): JsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${context} must be an object`);
  }
  return value as JsonObject;
}

function unique(values: string[], context: string): void {
  if (new Set(values).size !== values.length) throw new Error(`${context} contains duplicates`);
}

export function validateManifests(root = process.cwd()): Scenario[] {
  const matrix = asObject(
    loadJson(resolve(root, "verification/authorization-matrix.json")),
    "matrix",
  );
  const fields = asObject(loadJson(resolve(root, "verification/sensitive-fields.json")), "fields");
  const fixtures = asObject(loadJson(resolve(root, "verification/fixtures.json")), "fixtures");
  const manifest = asObject(loadJson(resolve(root, "verification/scenarios.json")), "scenarios");
  const rows = matrix.rows as JsonObject[];
  const fieldRows = fields.fields as JsonObject[];
  const profiles = fixtures.profiles as JsonObject[];
  const scenarios = manifest.scenarios as Scenario[];
  if (matrix.version !== "waldorf-authz-v1")
    throw new Error("authorization matrix version mismatch");
  if (fields.version !== "waldorf-sensitive-fields-v1")
    throw new Error("sensitive-field version mismatch");
  if (fixtures.version !== "waldorf-local-v1") throw new Error("fixture version mismatch");
  if (manifest.version !== "waldorf-scenarios-v1") throw new Error("scenario version mismatch");
  if (
    !Array.isArray(rows) ||
    !Array.isArray(fieldRows) ||
    !Array.isArray(profiles) ||
    !Array.isArray(scenarios)
  )
    throw new Error("manifest collections must be arrays");
  const rowIds = rows.map((row) => String(row.id));
  const fieldIds = fieldRows.map((field) => String(field.id));
  const profileIds = profiles.map((profile) => String(profile.id));
  unique(rowIds, "authorization row IDs");
  unique(fieldIds, "sensitive field IDs");
  unique(profileIds, "profile IDs");
  unique(
    scenarios.map(({ id }) => id),
    "scenario IDs",
  );
  const knownRows = new Set(rowIds);
  const knownFields = new Set(fieldIds);
  const knownProfiles = new Set(profileIds);
  for (const row of rows) {
    for (const field of (row.fields as string[]) ?? [])
      if (!knownFields.has(field))
        throw new Error(`${String(row.id)} references unknown field ${field}`);
    if (!["allow", "deny"].includes(String(row.effect)))
      throw new Error(`${String(row.id)} has invalid effect`);
  }
  for (const scenario of scenarios) {
    if (
      !scenario.id ||
      scenario.storyIds.length === 0 ||
      scenario.requirementIds.length === 0 ||
      scenario.matrixRows.length === 0
    )
      throw new Error(`${scenario.id || "scenario"} is incomplete`);
    if (!knownProfiles.has(scenario.profile))
      throw new Error(`${scenario.id} references unknown profile ${scenario.profile}`);
    for (const rowId of scenario.matrixRows)
      if (!knownRows.has(rowId))
        throw new Error(`${scenario.id} references unknown matrix row ${rowId}`);
    if (scenario.target === "local" && scenario.expected !== "PASS")
      throw new Error(`${scenario.id} local expectation must be PASS`);
    if (scenario.target === "linked-target" && scenario.expected !== "OUTSTANDING")
      throw new Error(`${scenario.id} linked target must remain OUTSTANDING`);
  }
  const stories = new Set(scenarios.flatMap(({ storyIds }) => storyIds));
  for (const story of [...REQUIRED_LOCAL_STORIES, ...REQUIRED_INHERITED_STORIES])
    if (!stories.has(story)) throw new Error(`missing story coverage: ${story}`);
  const scenarioIds = new Set(scenarios.map(({ id }) => id));
  for (const id of REQUIRED_NFR08_SCENARIOS)
    if (!scenarioIds.has(id)) throw new Error(`missing NFR-08 inventory scenario: ${id}`);
  for (const browser of ["chromium", "firefox", "mobile-chrome"]) {
    if (!scenarios.some(({ browsers }) => browsers?.includes(browser)))
      throw new Error(`missing browser coverage: ${browser}`);
  }
  for (const browser of ["safari-desktop", "mobile-safari"]) {
    const row = scenarios.find((scenario) => scenario.browser === browser);
    if (!row || row.expected !== "OUTSTANDING")
      throw new Error(`${browser} must be explicitly OUTSTANDING`);
  }
  return scenarios;
}

const SHA_PATTERN = /^[0-9a-f]{40}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

export function validateEvidence(
  value: unknown,
  scenarios: Scenario[],
  root = process.cwd(),
): Evidence {
  const record = asObject(value, "evidence") as Evidence;
  const requiredStrings: (keyof Evidence)[] = [
    "scenarioId",
    "fixtureVersion",
    "manifestVersion",
    "runtimeMode",
    "target",
    "tool",
    "toolVersion",
    "result",
    "startedAt",
    "finishedAt",
    "gitSha",
    "artifactPath",
  ];
  if (record.schemaVersion !== "waldorf-evidence-v1")
    throw new Error("evidence schema version mismatch");
  for (const key of requiredStrings)
    if (typeof record[key] !== "string" || String(record[key]).length === 0)
      throw new Error(`evidence ${key} is required`);
  if (
    !Array.isArray(record.storyIds) ||
    !Array.isArray(record.requirementIds) ||
    !Array.isArray(record.matrixRows) ||
    record.storyIds.length === 0 ||
    record.requirementIds.length === 0 ||
    record.matrixRows.length === 0
  )
    throw new Error("evidence trace arrays are required");
  if (!SHA_PATTERN.test(record.gitSha)) throw new Error("evidence gitSha is invalid");
  if (
    !DATE_PATTERN.test(record.startedAt) ||
    !DATE_PATTERN.test(record.finishedAt) ||
    Date.parse(record.finishedAt) < Date.parse(record.startedAt)
  )
    throw new Error("evidence timestamps are invalid");
  const finishedAt = Date.parse(record.finishedAt);
  if (finishedAt > Date.now() + 5 * 60_000 || finishedAt < Date.now() - 24 * 60 * 60_000)
    throw new Error(`${record.scenarioId} evidence is stale or future-dated`);
  const scenario = scenarios.find(({ id }) => id === record.scenarioId);
  if (!scenario) throw new Error(`unknown evidence scenario ${record.scenarioId}`);
  if (
    record.fixtureVersion !== "waldorf-local-v1" ||
    record.manifestVersion !== "waldorf-scenarios-v1"
  )
    throw new Error(`${record.scenarioId} metadata mismatch`);
  if (record.target !== scenario.target) throw new Error(`${record.scenarioId} target mismatch`);
  if (record.target === "local" && record.runtimeMode !== "synthetic")
    throw new Error(`${record.scenarioId} local evidence is not synthetic`);
  if (record.target === "linked-target" && record.result !== "OUTSTANDING")
    throw new Error(`${record.scenarioId} linked-target status cannot upgrade from OUTSTANDING`);
  if (record.target === "local" && record.result === "OUTSTANDING")
    throw new Error(`${record.scenarioId} local evidence cannot be OUTSTANDING`);
  if (record.result === "PASS" && record.exitCode !== 0)
    throw new Error(`${record.scenarioId} PASS requires exitCode 0`);
  const artifact = resolve(root, record.artifactPath);
  if (!existsSync(artifact) || !statSync(artifact).isFile())
    throw new Error(`${record.scenarioId} artifact is missing: ${record.artifactPath}`);
  if (JSON.stringify(record).match(/(?:password|secret|token|api[_-]?key)\s*[=:]\s*[^",}\s]+/i))
    throw new Error(`${record.scenarioId} evidence contains a prohibited value`);
  return record;
}

export function manifestHash(root = process.cwd()): string {
  const files = [
    "authorization-matrix.json",
    "sensitive-fields.json",
    "fixtures.json",
    "scenarios.json",
  ];
  const hash = createHash("sha256");
  for (const file of files) hash.update(readFileSync(resolve(root, "verification", file)));
  return hash.digest("hex");
}

export function readEvidenceDirectory(path: string): unknown[] {
  if (!existsSync(path)) return [];
  return readdirSync(path)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((file) => loadJson(join(path, file)));
}

export function aggregateEvidence(input: {
  root?: string;
  evidenceDirectory: string;
  reportJson: string;
  reportMarkdown: string;
  outstandingMarkdown: string;
}): { pass: number; fail: number; outstanding: number } {
  const root = input.root ?? process.cwd();
  const scenarios = validateManifests(root);
  const records = readEvidenceDirectory(input.evidenceDirectory).map((record) =>
    validateEvidence(record, scenarios, root),
  );
  const byScenario = new Map<string, Evidence>();
  for (const record of records) {
    if (byScenario.has(record.scenarioId))
      throw new Error(`duplicate evidence for ${record.scenarioId}`);
    byScenario.set(record.scenarioId, record);
  }
  for (const scenario of scenarios)
    if (!byScenario.has(scenario.id))
      throw new Error(`missing required evidence for ${scenario.id}`);
  const ordered = scenarios.map(({ id }) => byScenario.get(id)!);
  const counts = {
    pass: ordered.filter(({ result }) => result === "PASS").length,
    fail: ordered.filter(({ result }) => result === "FAIL").length,
    outstanding: ordered.filter(({ result }) => result === "OUTSTANDING").length,
  };
  const gitShas = [...new Set(ordered.map(({ gitSha }) => gitSha))];
  if (gitShas.length !== 1) throw new Error("evidence records are bound to different git SHAs");
  const finishedAt = ordered
    .map(({ finishedAt }) => finishedAt)
    .sort()
    .at(-1)!;
  const report = {
    schemaVersion: "waldorf-acceptance-report-v1",
    gitSha: gitShas[0],
    fixtureVersion: "waldorf-local-v1",
    manifestVersion: "waldorf-scenarios-v1",
    manifestSha256: manifestHash(root),
    generatedAt: finishedAt,
    counts,
    evidence: ordered,
  };
  ensureParent(input.reportJson);
  ensureParent(input.reportMarkdown);
  ensureParent(input.outstandingMarkdown);
  writeFileSync(input.reportJson, `${JSON.stringify(report, null, 2)}\n`);
  const lines = [
    "# Local Acceptance Report",
    "",
    `- Git SHA: \`${report.gitSha}\``,
    `- Fixture: \`${report.fixtureVersion}\``,
    `- Manifest: \`${report.manifestVersion}\` (SHA-256 \`${report.manifestSha256}\`)`,
    `- Generated from evidence completed at: \`${report.generatedAt}\``,
    `- Results: ${counts.pass} PASS, ${counts.fail} FAIL, ${counts.outstanding} OUTSTANDING`,
    "",
    "| Scenario | Target | Result | Tool | Artifact |",
    "|---|---|---|---|---|",
  ];
  for (const row of ordered)
    lines.push(
      `| ${row.scenarioId} | ${row.target} | ${row.result} | \`${row.tool}\` | \`${row.artifactPath}\` |`,
    );
  writeFileSync(input.reportMarkdown, `${lines.join("\n")}\n`);
  const outstanding = ordered.filter(({ result }) => result === "OUTSTANDING");
  const outstandingLines = [
    "# Outstanding Target Evidence",
    "",
    `Bound to local tested Git SHA \`${report.gitSha}\`, fixture \`${report.fixtureVersion}\`, and manifest \`${report.manifestVersion}\`. Synthetic success does not satisfy any row below.`,
    "",
    "| Scenario | Required environment/target | Status |",
    "|---|---|---|",
  ];
  for (const row of outstanding)
    outstandingLines.push(`| ${row.scenarioId} | ${row.tool} | OUTSTANDING |`);
  writeFileSync(input.outstandingMarkdown, `${outstandingLines.join("\n")}\n`);
  if (counts.fail > 0) throw new Error(`${counts.fail} evidence record(s) failed`);
  return counts;
}

function ensureParent(path: string): void {
  const parent = dirname(path);
  if (!existsSync(parent))
    throw new Error(`report directory must exist: ${relative(process.cwd(), parent)}`);
}
