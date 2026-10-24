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

  it("runs the identity database stage and the bundle check, and gives both jobs the identity setting names (U2)", () => {
    const pipeline = read("scripts/verification/run-local-verification.ts");
    assert.match(pipeline, /key: "database-identity", args: \["run", "test:database:identity"\]/);
    assert.match(pipeline, /key: "bundle", args: \["run", "test:bundle"\]/);
    assert.ok(pipeline.indexOf("database-stack") < pipeline.indexOf("database-identity"));
    assert.ok(pipeline.indexOf('key: "build"') < pipeline.indexOf('key: "bundle"'));
    const scripts = JSON.parse(read("package.json")).scripts as Record<string, string>;
    for (const file of [
      "schema",
      "session",
      "lockout",
      "invitation",
      "grants",
      "probe",
      "housekeeping",
      "catalogue",
      "hook",
      "operator",
      "server",
      "config",
    ]) {
      assert.ok(
        scripts["test:database:identity"]!.includes(`tests/database/identity-${file}.test.ts`),
        file,
      );
    }
    assert.ok(scripts["db:first-super-admin"]);
    for (const name of ["APP_PUBLIC_URL", "SMTP_HOST", "SMTP_PORT", "SMTP_FROM"]) {
      assert.equal([...workflow.matchAll(new RegExp(`^      ${name}:`, "gm"))].length, 2, name);
    }
    // The session secret is generated per run, masked, and never a literal.
    assert.equal([...workflow.matchAll(/openssl rand -hex 32/g)].length, 2);
    assert.equal([...workflow.matchAll(/::add-mask::/g)].length, 3);
    assert.equal(/APP_SESSION_SECRET:\s*\S/.test(workflow), false);
    // Only the validate job has a stack, so only it exposes the admin key (masked) to the environment.
    assert.equal([...workflow.matchAll(/SUPABASE_SERVICE_ROLE_KEY=\$key/g)].length, 1);
  });

  it("runs the directory and coordination database stage after the identity stage and keeps its files in the shuffled run (U3)", () => {
    const pipeline = read("scripts/verification/run-local-verification.ts");
    assert.match(pipeline, /key: "database-directory", args: \["run", "test:database:directory"\]/);
    assert.ok(pipeline.indexOf("database-identity") < pipeline.indexOf("database-directory"));
    assert.ok(pipeline.indexOf("database-directory") < pipeline.indexOf('key: "coverage"'));
    const scripts = JSON.parse(read("package.json")).scripts as Record<string, string>;
    const shuffled = read("scripts/db/shuffled-tests.ts");
    for (const file of [
      "directory-schema",
      "directory-functions",
      "coordination-schema",
      "coordination-functions",
      "kernel-signup",
      "kernel-race",
      "kernel-swaps",
      "kernel-family",
      "directory-link",
      "schedule",
      "lifecycle",
      "placeholder-drop",
      "directory-timing",
      "data-adapters",
    ]) {
      assert.ok(
        scripts["test:database:directory"]!.includes(`tests/database/${file}.test.ts`),
        file,
      );
      assert.ok(shuffled.includes(`tests/database/${file}.test.ts`), `${file} in the shuffled run`);
    }
    // The adapters folder is inside the lint and format scope (NFR2.10).
    for (const name of ["lint", "format", "format:check"]) {
      assert.ok(scripts[name]!.split(" ").includes("src/data"), name);
    }
  });

  it("runs the notifications and import database stage after the directory stage and keeps its files in the shuffled run (U4)", () => {
    const pipeline = read("scripts/verification/run-local-verification.ts");
    assert.match(
      pipeline,
      /key: "database-notifications-import", args: \["run", "test:database:notifications-import"\]/,
    );
    assert.ok(
      pipeline.indexOf("database-directory") < pipeline.indexOf("database-notifications-import"),
    );
    assert.ok(
      pipeline.indexOf("database-notifications-import") < pipeline.indexOf("database-shuffled"),
    );
    assert.ok(
      pipeline.indexOf("database-notifications-import") < pipeline.indexOf('key: "coverage"'),
    );
    const scripts = JSON.parse(read("package.json")).scripts as Record<string, string>;
    const shuffled = read("scripts/db/shuffled-tests.ts");
    const files = scripts["test:database:notifications-import"]!.split(" ").filter((part) =>
      part.startsWith("tests/database/"),
    );
    assert.ok(files.length >= 3, "the script names the notification test files");
    for (const file of files) {
      assert.ok(shuffled.includes(`"${file}"`), `${file} in the shuffled run`);
    }
    for (const file of [
      "notifications-schema",
      "notifications-functions",
      "notifications-handoff",
    ]) {
      assert.ok(files.includes(`tests/database/${file}.test.ts`), file);
    }
    // The server-only parser folder is inside the lint and format scope (NFR2.27).
    for (const name of ["lint", "format", "format:check"]) {
      assert.ok(scripts[name]!.split(" ").includes("src/import-parser"), name);
    }
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
