import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Deletion proofs of the removed demo mode (NFR1.67, NFR2.29): a removed name, route, cookie or setting must not
 * exist in production source. The scan covers app/, src/, the root files and the scripts, test files excluded.
 */
const FORBIDDEN: readonly [string, RegExp][] = [
  ["profile picker", /profile[ -]picker|profile-selector|ProfileSelector/i],
  [
    "parent-local profile",
    /parent-local|kindergarten-teacher-local|group-admin-local|super-admin-local/,
  ],
  ["synthetic route", /\/api\/synthetic/],
  ["APP_RUNTIME_MODE", /APP_RUNTIME_MODE/],
  ["APP_SYNTHETIC_FIXTURE_VERSION", /APP_SYNTHETIC_FIXTURE_VERSION/],
  ["SYNTHETIC_TEST_COPIES", /SYNTHETIC_TEST_COPIES/],
  ["scenario", /\bscenario\b/],
  [
    "synthetic session",
    /selectSynthetic|switchSynthetic|isSynthetic|runtimeMode|waldorf_local_session/,
  ],
];

/**
 * Files that may still name a removed thing until the step that owns them: each entry says why, and a second test
 * fails when an entry no longer contains a forbidden name, so the list can only shrink.
 *  - scripts/start-smoke.mjs asks the removed routes on purpose and expects "not found" (a request test).
 *  - The verification scripts use the word "scenario" for their own evidence scenarios (the rows of
 *    verification/scenarios.json: a different meaning from the removed demo scenario switch), and their evidence
 *    record keeps a field named `runtimeMode` whose value is now `database` or `linked-target` (U5 step 22); the name
 *    matches the old session-field pattern but no session carries it. Their fixture-version and synthetic values are gone.
 */
const ALLOWED: Readonly<Record<string, readonly string[]>> = {
  "scripts/start-smoke.mjs": ["synthetic route"],
  "scripts/verification/core.ts": ["scenario", "synthetic session"],
  "scripts/verification/run-local-verification.ts": ["scenario", "synthetic session"],
};

function walk(directory: string, found: string[] = []): string[] {
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) walk(path, found);
    else if (/\.(ts|tsx|mjs|js|css|json)$/.test(name) && !/\.test\.tsx?$/.test(name))
      found.push(path);
  }
  return found;
}

const productionFiles = [
  ...walk("app"),
  ...walk("src"),
  ...walk("scripts"),
  "proxy.ts",
  "next.config.ts",
  ".env.example",
  "package.json",
].filter((path) => existsSync(path));

const namesIn = (path: string): string[] => {
  const text = readFileSync(path, "utf8");
  return FORBIDDEN.filter(([, pattern]) => pattern.test(text)).map(([name]) => name);
};

describe("the removed demo mode is gone from production source", () => {
  it("scans a believable number of files", () => {
    expect(productionFiles.length).toBeGreaterThan(200);
    expect(productionFiles).toContain("app/page.tsx");
    expect(productionFiles).toContain("src/runtime/config.ts");
  });

  it("holds no profile picker, test profile, demo route, demo setting or scenario hook", () => {
    const offenders = productionFiles.flatMap((path) =>
      namesIn(path)
        .filter((name) => !(ALLOWED[path] ?? []).includes(name))
        .map((name) => `${path}: ${name}`),
    );
    expect(offenders).toEqual([]);
  });

  it("keeps the allowance list honest: every entry still names what it is allowed to name", () => {
    for (const [path, names] of Object.entries(ALLOWED)) {
      expect(existsSync(path), `${path} exists`).toBe(true);
      const present = namesIn(path);
      for (const name of names) expect(present, `${path} still names ${name}`).toContain(name);
    }
  });

  it("has no folder, route or module of the demo mode", () => {
    for (const path of [
      "src/parent-web",
      "src/admin-core",
      "src/admin-advanced",
      "src/teacher-web",
      "src/teacher-tracking",
      "src/runtime/synthetic",
      "src/runtime/session",
      "src/runtime/ProfileSelector.tsx",
      "src/runtime/security",
      "app/belepes",
      "app/api/synthetic",
      "playwright.login-existing.config.ts",
      "playwright.login-performance.config.ts",
      "tests/browser/support/profile-login-measurement.ts",
    ]) {
      expect(existsSync(path), `${path} must not exist`).toBe(false);
    }
  });

  it("answers no route of the old mode: no page or route file exists under its addresses", () => {
    const routeFiles = walk("app").filter((path) => /(page|route)\.tsx?$/.test(path));
    for (const path of routeFiles) {
      expect(path).not.toMatch(/^app\/(belepes|api\/synthetic)\//);
    }
    // A request test of the running server (the removed addresses answer 404) is part of scripts/start-smoke.mjs.
    const smoke = readFileSync("scripts/start-smoke.mjs", "utf8");
    for (const route of ["/api/synthetic/session", "/api/synthetic/reset", "/belepes"]) {
      expect(smoke).toContain(route);
    }
    expect(smoke).toContain("SMOKE_REMOVED_ROUTE_PRESENT");
  });

  it("starts without the removed settings: the example environment file and the scripts never name them", () => {
    const example = readFileSync(".env.example", "utf8");
    for (const name of [
      "APP_RUNTIME_MODE",
      "APP_SYNTHETIC_FIXTURE_VERSION",
      "SYNTHETIC_TEST_COPIES",
    ]) {
      expect(example).not.toContain(name);
    }
    const scripts = JSON.parse(readFileSync("package.json", "utf8")).scripts as Record<
      string,
      string
    >;
    expect(Object.values(scripts).join("\n")).not.toMatch(
      /login-performance|login-existing|synthetic/i,
    );
  });

  it("uses the neutral delivery-note class for the simulated delivery label", () => {
    const css = readFileSync("app/globals.css", "utf8");
    expect(css).toContain(".delivery-note");
    expect(css).not.toContain("synthetic-label");
  });
});
