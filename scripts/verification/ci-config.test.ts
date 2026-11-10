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
    // Masked: the two session secrets, the admin key and (U5) the stack's public key.
    assert.equal([...workflow.matchAll(/::add-mask::/g)].length, 4);
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

  it("runs the notifications database stage after the directory stage and keeps its files in the shuffled run (U4)", () => {
    const pipeline = read("scripts/verification/run-local-verification.ts");
    assert.match(
      pipeline,
      /key: "database-notifications", args: \["run", "test:database:notifications"\]/,
    );
    assert.ok(pipeline.indexOf("database-directory") < pipeline.indexOf("database-notifications"));
    assert.ok(pipeline.indexOf("database-notifications") < pipeline.indexOf("database-shuffled"));
    assert.ok(pipeline.indexOf("database-notifications") < pipeline.indexOf('key: "coverage"'));
    const scripts = JSON.parse(read("package.json")).scripts as Record<string, string>;
    const shuffled = read("scripts/db/shuffled-tests.ts");
    const files = scripts["test:database:notifications"]!.split(" ").filter((part) =>
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
  });

  it("runs the seed database stage after the notifications stage and before the shuffled run (U5)", () => {
    const pipeline = read("scripts/verification/run-local-verification.ts");
    assert.match(pipeline, /key: "database-seed", args: \["run", "test:database:seed"\]/);
    assert.ok(pipeline.indexOf("database-notifications") < pipeline.indexOf("database-seed"));
    assert.ok(pipeline.indexOf("database-seed") < pipeline.indexOf("database-shuffled"));
    assert.ok(pipeline.indexOf("database-seed") < pipeline.indexOf('key: "coverage"'));
    const scripts = JSON.parse(read("package.json")).scripts as Record<string, string>;
    for (const name of ["db:seed", "db:seed:large", "db:reset", "test:database:seed"]) {
      assert.ok(scripts[name], name);
    }
    assert.match(scripts["db:seed:large"]!, /scripts\/db\/seed\.ts --large$/);
    const shuffled = read("scripts/db/shuffled-tests.ts");
    const files = scripts["test:database:seed"]!.split(" ").filter((part) =>
      part.startsWith("tests/database/"),
    );
    for (const file of ["audit-purge", "seed", "reset", "seed-timing"]) {
      assert.ok(files.includes(`tests/database/${file}.test.ts`), file);
    }
    for (const file of files)
      assert.ok(shuffled.includes(`"${file}"`), `${file} in the shuffled run`);
    // The seed module and the commands are inside the lint and format scope (scripts/ is listed).
    for (const name of ["lint", "format", "format:check"]) {
      assert.ok(scripts[name]!.split(" ").includes("scripts"), name);
    }
  });

  it("holds no database secret, runs with read-only permissions and has no synthetic setting in either job (U5)", () => {
    assert.equal(/\$\{\{\s*secrets\./.test(workflow), false);
    assert.equal(/pull_request_target/.test(workflow), false);
    assert.match(workflow, /^permissions:\n  contents: read$/m);
    assert.equal([...workflow.matchAll(/^    permissions:\n      contents: read$/gm)].length, 2);
    assert.equal(/APP_RUNTIME_MODE|APP_SYNTHETIC_FIXTURE_VERSION|synthetic/i.test(workflow), false);
    assert.equal(/runtimeMode|fixtureVersion/.test(workflow), false);
  });

  it("gives the validate job 90 minutes and the stack's address and public key for build, smoke and browser (U5)", () => {
    const validate = workflow.slice(
      workflow.indexOf("  validate:"),
      workflow.indexOf("  build_evidence:"),
    );
    assert.match(validate, /timeout-minutes: 90/);
    assert.equal(/timeout-minutes: 45/.test(workflow), false);
    assert.match(validate, /echo "SUPABASE_URL=\$url" >> "\$GITHUB_ENV"/);
    assert.match(validate, /echo "SUPABASE_ANON_KEY=\$anon" >> "\$GITHUB_ENV"/);
    assert.match(validate, /echo "SUPABASE_SERVICE_ROLE_KEY=\$key" >> "\$GITHUB_ENV"/);
    // The settings are exposed before the pipeline that builds, starts and browses the application.
    assert.ok(validate.indexOf("SUPABASE_URL=") < validate.indexOf("npm run verify:local"));
  });

  it("gives the build evidence job build-only placeholders and no mode or fixture field in its metadata (U5)", () => {
    const evidence = workflow.slice(workflow.indexOf("  build_evidence:"));
    assert.match(evidence, /SUPABASE_URL: https:\/\/app\.example\.invalid/);
    assert.match(evidence, /SUPABASE_ANON_KEY: build-only-placeholder-public-key/);
    assert.equal(/SERVICE_ROLE/.test(evidence), false);
    assert.equal(/runtimeMode|fixtureVersion/.test(evidence), false);
  });

  it("keeps the browser phase last, after every database key (U5)", () => {
    const pipeline = read("scripts/verification/run-local-verification.ts");
    const commandList = pipeline.slice(
      pipeline.indexOf("const commands = ["),
      pipeline.indexOf("] as const;"),
    );
    const keys = [...commandList.matchAll(/key: "([a-z-]+)"/g)].map((match) => match[1]!);
    assert.equal(keys.at(-1), "browser");
    for (const key of keys.filter((name) => name.startsWith("database-")))
      assert.ok(keys.indexOf(key) < keys.indexOf("browser"), key);
    assert.deepEqual(
      keys.slice(
        keys.indexOf("database-notifications"),
        keys.indexOf("database-notifications") + 3,
      ),
      ["database-notifications", "database-seed", "database-shuffled"],
    );
    assert.equal(/APP_RUNTIME_MODE|APP_SYNTHETIC_FIXTURE_VERSION/.test(pipeline), false);
  });

  it("validates pull requests, the weekly and the manual runs with every browser, and records evidence on main", () => {
    const triggers = workflow.slice(
      workflow.indexOf("\non:\n"),
      workflow.indexOf("\npermissions:"),
    );
    assert.match(triggers, /types: \[opened, synchronize, reopened, ready_for_review\]/);
    assert.match(triggers, /schedule:\n {4}- cron: "0 3 \* \* 1"/);
    assert.match(triggers, /workflow_dispatch:/);
    // Only the AI-DLC records, which no check reads, are skipped; docs/ stays covered by the privacy scan.
    assert.equal([...triggers.matchAll(/paths-ignore:\n {6}- "aidlc\/\*\*"\n/g)].length, 2);
    assert.match(
      workflow,
      /group: ci-\$\{\{ github\.workflow \}\}-\$\{\{ github\.event_name \}\}-/,
    );
    const validate = workflow.slice(
      workflow.indexOf("  validate:"),
      workflow.indexOf("  build_evidence:"),
    );
    assert.match(
      validate,
      /if: github\.event_name != 'push' && !github\.event\.pull_request\.draft/,
    );
    // No run narrows the browser phase: the repository is public, so every run uses every browser.
    assert.equal(/VERIFY_BROWSER_PROJECTS/.test(workflow), false);
    const evidence = workflow.slice(workflow.indexOf("  build_evidence:"));
    assert.match(evidence, /if: github\.event_name == 'push'/);
    assert.equal(/needs:/.test(evidence), false);
    // The evidence names only the browsers that ran.
    const pipeline = read("scripts/verification/run-local-verification.ts");
    assert.match(pipeline, /selectedBrowserProjects\(process\.env\.VERIFY_BROWSER_PROJECTS\)/);
  });

  it("keeps the build evidence for 14 days and the existing PostgreSQL role-migration step", () => {
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
