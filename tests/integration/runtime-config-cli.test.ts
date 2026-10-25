// @vitest-environment node
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, dirname, join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const root = process.cwd();
const validator = resolve(root, "scripts/validate-runtime-config.ts");
const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const npmCli = process.env.npm_execpath;
const directories: string[] = [];
const secretMarker = "dummy-private-startup-marker";
const synthetic =
  "APP_SESSION_SECRET=a-test-only-secret-with-32-chars-ok\nSUPABASE_URL=http://127.0.0.1:54321\nSUPABASE_ANON_KEY=a-local-anon-key-of-20plus\n";
const invalidFile = "APP_SESSION_SECRET=short\n";
const modes = ["development", "production", "test"] as const;
const prehooks = ["predev", "prebuild", "prestart"] as const;

afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

function fixture(files: Record<string, string> = {}) {
  const directory = mkdtempSync(join(tmpdir(), "waldorf-runtime-config-"));
  directories.push(directory);
  for (const [name, contents] of Object.entries(files)) {
    writeFileSync(join(directory, name), contents);
  }
  const scripts = Object.fromEntries(
    ["check:toolchain", ...prehooks].map((name) => [
      name,
      manifest.scripts[name].replace(
        /scripts\/(validate-(?:toolchain\.mjs|runtime-config\.ts))/g,
        (_match: string, file: string) => JSON.stringify(join(root, "scripts", file)),
      ),
    ]),
  );
  writeFileSync(join(directory, "package.json"), JSON.stringify({ private: true, scripts }));
  return directory;
}

function childEnvironment(overrides: Record<string, string> = {}) {
  // An allowlist excludes contributor credentials, Vitest's NODE_ENV and Next's cache markers.
  const environment: Record<string, string | undefined> = {};
  for (const name of ["HOME", "TMPDIR", "LANG", "LC_ALL", "SystemRoot", "ComSpec", "PATHEXT"]) {
    if (process.env[name] !== undefined) environment[name] = process.env[name];
  }
  environment.PATH = `${dirname(process.execPath)}${delimiter}${process.env.PATH ?? ""}`;
  // Next types NODE_ENV as required, but these fresh children must also test its absence.
  return { ...environment, ...overrides } as NodeJS.ProcessEnv;
}

function run(
  directory: string,
  options: { command?: string; environment?: Record<string, string> } = {},
) {
  const args = options.command?.startsWith("pre")
    ? [npmCli!, "run", options.command]
    : ["--experimental-strip-types", validator, ...(options.command ? [options.command] : [])];
  if (options.command?.startsWith("pre") && !npmCli) throw new Error("TEST_NPM_CLI_UNAVAILABLE");
  const result = spawnSync(process.execPath, args, {
    cwd: directory,
    env: childEnvironment(options.environment),
    encoding: "utf8",
    timeout: 15_000,
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  expect(result.error === undefined).toBe(true);
  expect(output.includes(secretMarker)).toBe(false);
  return { status: result.status, output };
}

function expectSuccess(result: ReturnType<typeof run>) {
  expect(result.status).toBe(0);
  expect(result.output.includes("RUNTIME_CONFIG_VALID")).toBe(true);
}

function expectFailure(result: ReturnType<typeof run>, diagnostic: string) {
  expect(result.status).toBe(1);
  // Boolean assertions avoid exposing captured environment/error contents on failure.
  expect(result.output.includes(diagnostic)).toBe(true);
  expect(result.output.includes("RUNTIME_CONFIG_VALID")).toBe(false);
}

describe("runtime configuration prehooks", () => {
  it.each(prehooks)("%s loads local configuration without any mode export", (command) => {
    expectSuccess(run(fixture({ ".env.local": synthetic }), { command }));
  });

  it.each(prehooks)("%s selects its intended default framework mode", (command) => {
    const intended = command === "predev" ? "development" : "production";
    const other = intended === "development" ? "production" : "development";
    const directory = fixture({
      [`.env.${intended}`]: synthetic,
      [`.env.${other}`]: invalidFile,
    });
    expectSuccess(run(directory, { command }));
  });

  it.each(prehooks)("%s rejects missing configuration", (command) => {
    expectFailure(
      run(fixture(), { command }),
      "CONFIG_PRODUCTION_INVALID: invalid APP_SESSION_SECRET",
    );
  });

  it.each(prehooks)(
    "%s preserves an inherited invalid secret over valid file values",
    (command) => {
      const result = run(fixture({ ".env.local": synthetic }), {
        command,
        environment: { APP_SESSION_SECRET: secretMarker },
      });
      expectFailure(result, "CONFIG_PRODUCTION_INVALID: invalid APP_SESSION_SECRET");
    },
  );
});

describe("Next environment selection and precedence", () => {
  it("defaults standalone validation to production", () => {
    expectSuccess(run(fixture({ ".env.production": synthetic, ".env.development": invalidFile })));
  });

  it.each(modes)("honors explicit NODE_ENV=%s over either command default", (mode) => {
    for (const command of ["development", "production"]) {
      const files = Object.fromEntries(
        modes.map((candidate) => [
          `.env.${candidate}`,
          candidate === mode ? synthetic : invalidFile,
        ]),
      );
      expectSuccess(run(fixture(files), { command, environment: { NODE_ENV: mode } }));
    }
  });

  it.each(["development", "production"])("preserves every file precedence tier in %s", (mode) => {
    const order = [`.env.${mode}.local`, ".env.local", `.env.${mode}`, ".env"];
    for (let tier = 0; tier < order.length; tier++) {
      const files = Object.fromEntries(
        order.slice(tier).map((name, index) => [name, index === 0 ? synthetic : invalidFile]),
      );
      expectSuccess(run(fixture(files), { command: mode }));
    }
  });

  it("preserves a valid inherited value over conflicting files", () => {
    expectSuccess(
      run(fixture({ ".env.local": invalidFile }), {
        environment: {
          APP_SESSION_SECRET: "an-inherited-secret-with-32-chars-ok",
          SUPABASE_URL: "http://127.0.0.1:54321",
          SUPABASE_ANON_KEY: "a-local-anon-key-of-20plus",
        },
      }),
    );
  });

  it("excludes local and non-test mode files in test mode", () => {
    const ignored = {
      ".env.local": invalidFile,
      ".env.development": invalidFile,
      ".env.production": invalidFile,
    };
    for (const name of [".env.test.local", ".env.test", ".env"]) {
      expectSuccess(
        run(fixture({ ...ignored, [name]: synthetic }), { environment: { NODE_ENV: "test" } }),
      );
    }
    expectFailure(
      run(fixture({ ".env.local": synthetic }), { environment: { NODE_ENV: "test" } }),
      "CONFIG_PRODUCTION_INVALID: invalid APP_SESSION_SECRET",
    );
  });

  it("preserves test-local over test and base file precedence", () => {
    expectSuccess(
      run(
        fixture({
          ".env.test.local": synthetic,
          ".env.test": invalidFile,
          ".env": invalidFile,
        }),
        { environment: { NODE_ENV: "test" } },
      ),
    );
  });

  it("expands references through the framework loader", () => {
    expectSuccess(
      run(
        fixture({
          ".env.local":
            "LOCAL_SECRET=a-test-only-secret-with-32-chars-ok\nAPP_SESSION_SECRET=$LOCAL_SECRET\nLOCAL_URL=http://127.0.0.1:54321\nSUPABASE_URL=${LOCAL_URL}\nSUPABASE_ANON_KEY=a-local-anon-key-of-20plus\n",
        }),
      ),
    );
  });
});

describe("redacted fail-closed diagnostics", () => {
  it.each([
    [invalidFile, "CONFIG_PRODUCTION_INVALID: invalid APP_SESSION_SECRET"],
    [
      synthetic.replace("http://127.0.0.1:54321", "http://example.test:54321"),
      "CONFIG_PRODUCTION_INVALID: invalid SUPABASE_URL",
    ],
    [
      synthetic.replace(/SUPABASE_ANON_KEY=.*\n/, "SUPABASE_ANON_KEY=short\n"),
      "CONFIG_PRODUCTION_INVALID: invalid SUPABASE_ANON_KEY",
    ],
  ])("rejects invalid effective fields safely (%s)", (contents, diagnostic) => {
    expectFailure(run(fixture({ ".env.local": contents + `OTHER=${secretMarker}\n` })), diagnostic);
  });

  it("ignores the removed mode settings: they neither enable nor break startup", () => {
    expectSuccess(
      run(fixture({ ".env.local": synthetic }), {
        environment: { APP_RUNTIME_MODE: "synthetic", APP_SYNTHETIC_FIXTURE_VERSION: "x" },
      }),
    );
  });

  it("fails closed with only a safe diagnostic after a loader read failure", () => {
    const directory = fixture({ ".env": synthetic + `APP_SESSION_SECRET=${secretMarker}\n` });
    symlinkSync(".env.local", join(directory, ".env.local"));
    const result = run(directory);
    expectFailure(result, "CONFIG_ENV_LOAD_FAILED: invalid environment file");
    expect(result.output.trim()).toBe("CONFIG_ENV_LOAD_FAILED: invalid environment file");
  });
});
