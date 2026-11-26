import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import {
  combineParts,
  mergeBrowserRuns,
  partId,
  planPart,
  verifyMode,
  type Command,
  type PartName,
  type PartResult,
} from "./parts.ts";
import { BROWSER_PROJECTS, schemaForProject } from "../../tests/browser/support/projects.ts";

/** The real step list, read from the pipeline so a step added there is covered here too. */
const pipeline = readFileSync(new URL("./run-local-verification.ts", import.meta.url), "utf8");
const commands: Command[] = [
  ...pipeline
    .slice(pipeline.indexOf("const commands = ["), pipeline.indexOf("] as const;"))
    .matchAll(/key: "([a-z-]+)"/g),
].map((match) => ({ key: match[1]!, args: ["run", match[1]!] }));
const browsers = BROWSER_PROJECTS.map(({ name }) => name as string);
const jobs: [PartName, string[]][] = [
  ["checks", []],
  ["database-shuffled", []],
  ...browsers.map((name): [PartName, string[]] => ["browser", [name]]),
];
const sha = "a".repeat(40);

function results(): PartResult[] {
  return jobs.map(([part, projects], index) => ({
    id: partId(part, projects),
    gitSha: sha,
    browserProjects: part === "browser" ? projects : browsers,
    steps: Object.fromEntries(
      planPart(commands, part, projects, schemaForProject).map(({ key }) => [
        key,
        {
          startedAt: `2026-01-01T00:0${index}:00.000Z`,
          finishedAt: `2026-01-01T00:0${index}:30.000Z`,
          durationMs: 30_000,
          log: `${partId(part, projects)}.${key}.log`,
        },
      ]),
    ),
  }));
}
const combine = (parts: PartResult[]) =>
  combineParts({
    results: parts,
    commands,
    gitSha: sha,
    allBrowserProjects: browsers,
    schemaFor: schemaForProject,
  });

describe("verification parts", () => {
  it("accepts only a known mode, and runs everything when none is set", () => {
    assert.equal(verifyMode(undefined), "all");
    assert.equal(verifyMode(""), "all");
    for (const name of ["checks", "database-shuffled", "browser", "combine"])
      assert.equal(verifyMode(name), name);
    assert.throws(() => verifyMode("quick"), /VERIFY_PART_UNKNOWN/);
  });

  it("leaves no pipeline step out of the parts", () => {
    assert.ok(commands.length > 15);
    const planned = new Set(
      jobs.flatMap(([part, projects]) =>
        planPart(commands, part, projects, schemaForProject).map(({ key }) => key),
      ),
    );
    for (const { key } of commands) assert.ok(planned.has(key), key);
    const added = planPart(
      [...commands, { key: "new-step", args: [] }],
      "checks",
      [],
      schemaForProject,
    );
    assert.ok(added.some(({ key }) => key === "new-step"));
  });

  it("prepares a browser part's own schema and build before its one browser", () => {
    const steps = planPart(commands, "browser", ["firefox"], schemaForProject);
    assert.deepEqual(
      steps.map(({ key }) => key),
      ["toolchain", "database-migrate", "database-migrate-worker", "build", "browser"],
    );
    assert.deepEqual(steps[2]!.args, ["run", "db:migrate", "--", "--schema", "worker_2"]);
    for (const projects of [[], browsers])
      assert.throws(
        () => planPart(commands, "browser", projects, schemaForProject),
        /VERIFY_PART_BROWSER/,
      );
    assert.throws(
      () => planPart([], "database-shuffled", [], schemaForProject),
      /VERIFY_PART_STEP_MISSING/,
    );
  });

  it("joins a complete set of parts", () => {
    const { steps, browserRuns } = combine(results());
    assert.equal(browserRuns.length, browsers.length);
    assert.equal(steps.get("build")!.log, "checks.build.log");
    for (const { key } of commands) if (key !== "browser") assert.ok(steps.has(key), key);
    assert.deepEqual(mergeBrowserRuns([...browserRuns].reverse(), "browser.log"), {
      startedAt: browserRuns[0]!.startedAt,
      finishedAt: browserRuns.at(-1)!.finishedAt,
      durationMs: 90_000,
      log: "browser.log",
    });
  });

  it("refuses a missing, repeated, foreign or incomplete part", () => {
    for (let index = 0; index < jobs.length; index++)
      assert.throws(
        () => combine(results().filter((_, at) => at !== index)),
        /VERIFY_PARTS_INCOMPLETE/,
      );
    assert.throws(() => combine([]), /found none/);
    assert.throws(() => combine([...results(), results()[0]!]), /VERIFY_PARTS_INCOMPLETE/);
    const otherCommit = results();
    otherCommit[1]!.gitSha = "b".repeat(40);
    assert.throws(() => combine(otherCommit), /VERIFY_PART_SHA/);
    const wrongBrowser = results();
    wrongBrowser[2]!.browserProjects = ["firefox"];
    assert.throws(() => combine(wrongBrowser), /VERIFY_PART_BROWSER/);
    const missingStep = results();
    delete missingStep[0]!.steps.security;
    assert.throws(() => combine(missingStep), /checks has no result for security/);
  });
});
