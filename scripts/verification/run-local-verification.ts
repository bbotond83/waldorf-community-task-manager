import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync, writeSync } from "node:fs";
import { resolve } from "node:path";
import { validateManifests, type Evidence, type Scenario } from "./core.ts";

const root = process.cwd();
const runtimeDirectory = resolve(root, ".verification");
const evidenceDirectory = resolve(runtimeDirectory, "evidence");
const logDirectory = resolve(runtimeDirectory, "logs");
for (const path of [evidenceDirectory, logDirectory]) {
  rmSync(path, { recursive: true, force: true });
  mkdirSync(path, { recursive: true });
}

const gitSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const nodeVersion = process.version;
const npmVersion = execFileSync("npm", ["--version"], { encoding: "utf8" }).trim();
const scenarios = validateManifests(root);
const commandResults = new Map<
  string,
  { startedAt: string; finishedAt: string; durationMs: number; log: string }
>();

// spawnSync blocks the event loop, so process.stdout.write on a pipe (CI) only queues the text and the
// queue is lost when a failing stage ends the process: the failure showed no output. Write it out
// synchronously instead, waiting when the pipe is full.
function printNow(text: string): void {
  const bytes = Buffer.from(text);
  let offset = 0;
  while (offset < bytes.length) {
    try {
      offset += writeSync(1, bytes, offset);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EAGAIN") throw error;
    }
  }
}

const commands = [
  { key: "toolchain", args: ["run", "check:toolchain"] },
  { key: "manifests", args: ["run", "verify:manifests"] },
  { key: "format", args: ["run", "format:check"] },
  { key: "lint", args: ["run", "lint"] },
  { key: "typecheck", args: ["run", "typecheck"] },
  { key: "tests", args: ["test"] },
  { key: "database-roles", args: ["run", "test:database:roles"] },
  // Database stage (needs the local stack: `npm run db:start`, started by CI before this pipeline).
  // The database tests run in worker schemas and once in the default schema (BR10.4).
  { key: "database-migrate", args: ["run", "db:migrate"] },
  { key: "database-stack", args: ["run", "test:database:stack"] },
  // The identity database stage (U2): policy matrix, catalogue and privilege tests, configuration read-back,
  // the invitation, reset and operator-command tests that read the mail server.
  { key: "database-identity", args: ["run", "test:database:identity"] },
  // The directory and coordination database stage (U3): tables, policies, role matrix and the change
  // functions of people, structure, settings, events, tasks and notes, on the real stack.
  { key: "database-directory", args: ["run", "test:database:directory"] },
  // The notifications and import database stage (U4): notification records, reminder jobs and the
  // notice writes inside U3's use cases, and the import tables and functions, on the real stack.
  { key: "database-notifications-import", args: ["run", "test:database:notifications-import"] },
  // The seed database stage (U5): the audit purge, the seed and reset commands and their timing limits, on the real stack.
  { key: "database-seed", args: ["run", "test:database:seed"] },
  { key: "database-shuffled", args: ["run", "test:database:shuffled"] },
  { key: "coverage", args: ["run", "test:coverage"] },
  { key: "security", args: ["run", "verify:security"] },
  { key: "build", args: ["run", "build"] },
  // The browser output never holds the sign-in service's admin key or the server-only admin modules.
  { key: "bundle", args: ["run", "test:bundle"] },
  { key: "smoke", args: ["run", "smoke:start"] },
  { key: "browser", args: ["run", "test:browser"] },
] as const;

for (const command of commands) {
  const started = Date.now();
  const startedAt = new Date(started).toISOString();
  const result = spawnSync("npm", command.args, {
    cwd: root,
    env: {
      ...process.env,
      APP_HOST: "127.0.0.1",
    },
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  const finished = Date.now();
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  const log = `.verification/logs/${command.key}.log`;
  writeFileSync(resolve(root, log), output);
  printNow(output);
  if (result.status !== 0)
    throw new Error(
      `LOCAL_VERIFICATION_FAILED step=${command.key} exit=${result.status ?? "signal"} log=${log}`,
    );
  commandResults.set(command.key, {
    startedAt,
    finishedAt: new Date(finished).toISOString(),
    durationMs: finished - started,
    log,
  });
}

const summaryLog = ".verification/logs/aggregate.log";
writeFileSync(
  resolve(root, summaryLog),
  `gitSha=${gitSha}\nnode=${nodeVersion}\nnpm=${npmVersion}\ncommands=${commands.map(({ key }) => key).join(",")}\n`,
);
const outstandingLog = ".verification/logs/outstanding.log";
writeFileSync(
  resolve(root, outstandingLog),
  "No linked target or Safari environment was invoked. Status remains OUTSTANDING.\n",
);

function resultFor(scenario: Scenario) {
  if (scenario.target === "linked-target") {
    const now = new Date().toISOString();
    return {
      startedAt: now,
      finishedAt: now,
      durationMs: 0,
      log: outstandingLog,
      key: "outstanding",
    };
  }
  const key =
    scenario.evidence === "manifest"
      ? "manifests"
      : scenario.evidence === "smoke"
        ? "smoke"
        : scenario.evidence === "browser"
          ? "browser"
          : scenario.evidence === "test"
            ? "tests"
            : scenario.evidence === "security"
              ? "security"
              : "aggregate";
  if (key === "aggregate") {
    const times = [...commandResults.values()];
    return {
      startedAt: times[0]!.startedAt,
      finishedAt: times.at(-1)!.finishedAt,
      durationMs: times.reduce((sum, row) => sum + row.durationMs, 0),
      log: summaryLog,
      key,
    };
  }
  const row = commandResults.get(key)!;
  return { ...row, key };
}

for (const scenario of scenarios) {
  const source = resultFor(scenario);
  const record: Evidence = {
    schemaVersion: "waldorf-evidence-v1",
    scenarioId: scenario.id,
    storyIds: scenario.storyIds,
    requirementIds: scenario.requirementIds,
    matrixRows: scenario.matrixRows,
    manifestVersion: "waldorf-scenarios-v1",
    runtimeMode: scenario.target === "local" ? "database" : "linked-target",
    target: scenario.target,
    tool: scenario.command,
    toolVersion: `node=${nodeVersion};npm=${npmVersion}`,
    ...(scenario.browser
      ? { browser: scenario.browser }
      : scenario.browsers
        ? { browser: scenario.browsers.join(",") }
        : {}),
    result: scenario.target === "local" ? "PASS" : "OUTSTANDING",
    startedAt: source.startedAt,
    finishedAt: source.finishedAt,
    gitSha,
    artifactPath: source.log,
    exitCode: scenario.target === "local" ? 0 : undefined,
    durationMs: source.durationMs,
  };
  writeFileSync(
    resolve(evidenceDirectory, `${scenario.id}.json`),
    `${JSON.stringify(record, null, 2)}\n`,
  );
}

const aggregate = spawnSync("npm", ["run", "verify:evidence"], {
  cwd: root,
  env: process.env,
  encoding: "utf8",
  maxBuffer: 16 * 1024 * 1024,
});
process.stdout.write(`${aggregate.stdout ?? ""}${aggregate.stderr ?? ""}`);
if (aggregate.status !== 0)
  throw new Error(`LOCAL_VERIFICATION_FAILED step=evidence exit=${aggregate.status ?? "signal"}`);
const privacy = spawnSync("npm", ["run", "scan:privacy"], {
  cwd: root,
  env: process.env,
  encoding: "utf8",
  maxBuffer: 16 * 1024 * 1024,
});
process.stdout.write(`${privacy.stdout ?? ""}${privacy.stderr ?? ""}`);
if (privacy.status !== 0)
  throw new Error(
    `LOCAL_VERIFICATION_FAILED step=final-privacy exit=${privacy.status ?? "signal"}`,
  );
console.log(`LOCAL_VERIFICATION_PASS sha=${gitSha} manifest=waldorf-scenarios-v1`);
