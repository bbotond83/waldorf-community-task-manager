import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { scanNoDeploy } from "./scan-core.ts";

const root = new URL("../../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");
const workflow = read(".github/workflows/ci.yml");
const lines = workflow.split("\n");
const lineOf = (needle: string) => lines.findIndex((line) => line.includes(needle));

describe("CI workflow configuration (BR10.2, FR10.3)", () => {
  it("has no deployment job, environment, publish or promotion step", () => {
    const jobSection = workflow.slice(workflow.indexOf("\njobs:\n"));
    const jobs = [...jobSection.matchAll(/^  ([a-z_]+):\s*$/gm)].map((match) => match[1]);
    assert.deepEqual(jobs, ["validate", "build_evidence"]);
    assert.equal(/^\s+environment:/m.test(workflow), false);
    // Built from parts so this file does not trip the no-deployment scan it relies on.
    const forbidden = [
      "vercel",
      ["npm", "publish"].join(" "),
      ["supabase", "db", "push"].join(" "),
      "promote",
    ];
    for (const word of forbidden) assert.equal(workflow.toLowerCase().includes(word), false, word);
    assert.deepEqual(scanNoDeploy(new URL(".", root).pathname).findings, []);
  });

  it("pins every action to a full commit revision", () => {
    const uses = [...workflow.matchAll(/^\s+uses:\s*(\S+)/gm)].map((match) => match[1]!);
    assert.ok(uses.length >= 4);
    for (const reference of uses) assert.match(reference, /^[\w./-]+@[0-9a-f]{40}$/, reference);
  });

  it("starts the stack with the project command before the verification pipeline and stops it afterwards, always", () => {
    const start = lineOf("run: npm run db:start");
    const verify = lineOf("run: npm run verify:local");
    const stop = lineOf("run: npm run db:stop");
    assert.ok(start > 0 && verify > start && stop > verify, "start, verify, stop in this order");
    assert.match(lines[stop - 1]!, /if: always\(\)/);
    const startBlock = lines.slice(start - 6, start).join("\n");
    assert.match(startBlock, /timeout-minutes: 10/);
    assert.match(startBlock, /DB_ALLOW_ALL_INTERFACES: "1"/);
  });

  it("runs the database stage in the verification pipeline, with the default-schema run included", () => {
    const pipeline = read("scripts/verification/run-local-verification.ts");
    assert.match(pipeline, /key: "database-migrate", args: \["run", "db:migrate"\]/);
    assert.match(pipeline, /key: "database-stack", args: \["run", "test:database:stack"\]/);
    assert.match(pipeline, /key: "database-shuffled", args: \["run", "test:database:shuffled"\]/);
    assert.ok(pipeline.indexOf("database-migrate") < pipeline.indexOf('key: "coverage"'));
    const scripts = JSON.parse(read("package.json")).scripts as Record<string, string>;
    for (const name of ["db:start", "db:stop", "db:migrate", "db:worker", "test:database:stack"]) {
      assert.ok(scripts[name], name);
    }
    for (const file of ["migrations", "audit", "idempotency", "holds", "worker"]) {
      assert.ok(scripts["test:database:stack"]!.includes(`tests/database/${file}.test.ts`), file);
    }
    assert.match(read("tests/database/audit.test.ts"), /\["worker_1", "public"\]/);
    assert.match(read("tests/database/idempotency.test.ts"), /\["worker_2", "public"\]/);
  });

  it("holds no database secret, runs with read-only permissions and keeps the synthetic values until U5", () => {
    assert.equal(/\$\{\{\s*secrets\./.test(workflow), false);
    assert.equal(/pull_request_target/.test(workflow), false);
    assert.match(workflow, /^permissions:\n  contents: read$/m);
    assert.equal([...workflow.matchAll(/^    permissions:\n      contents: read$/gm)].length, 2);
    assert.match(workflow, /APP_RUNTIME_MODE: synthetic/);
    assert.match(workflow, /APP_SYNTHETIC_FIXTURE_VERSION: waldorf-local-v1/);
  });

  it("keeps the private build evidence for 14 days and the existing PostgreSQL role-migration step", () => {
    assert.match(workflow, /retention-days: 14/);
    assert.match(workflow, /postgresql-18/);
  });

  it("keeps the generated environment files out of the repository", () => {
    const ignore = read(".gitignore");
    assert.match(ignore, /^\.env\.\*$/m);
    assert.match(ignore, /^source-materials\/waldorf-community-app\/Ovis tábla v2\.xlsx$/m);
    const example = read(".env.example");
    for (const name of [
      "SUPABASE_URL",
      "SUPABASE_ANON_KEY",
      "DATABASE_SCHEMA",
      "APP_SESSION_SECRET",
    ]) {
      assert.match(example, new RegExp(`^# ${name}=`, "m"), name);
    }
    assert.equal(/SERVICE_ROLE_KEY\s*=\s*\S/.test(example), false);
  });
});
