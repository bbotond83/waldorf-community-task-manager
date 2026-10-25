import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BROWSER_PROJECTS, schemaForProject } from "../browser/support/projects.ts";

/**
 * The guards of the browser phase (NFR3.20, NFR2.33): every spec file goes through the one seeded-schema helper, the
 * three browser projects own three different schemas and ports, and no fixed schema or demo-mode setting is left in
 * the browser tests or their configuration.
 */
const BROWSER_DIRECTORY = join(process.cwd(), "tests", "browser");
const specs = readdirSync(BROWSER_DIRECTORY).filter((name) => name.endsWith(".spec.ts"));
const read = (path: string) => readFileSync(path, "utf8");

describe("the browser specs and their schemas", () => {
  it("finds the specs it is guarding", () => {
    expect(specs.length).toBeGreaterThanOrEqual(13);
  });

  it.each(specs)("%s empties and seeds its project's schema through the helper", (name) => {
    const source = read(join(BROWSER_DIRECTORY, name));
    expect(source, name).toMatch(/from "\.\/support\/seeded-schema\.ts"/);
    expect(source, name).toMatch(/bindSeededSchema\(/);
  });

  it("maps each browser project to its own worker schema and its own port", () => {
    expect(BROWSER_PROJECTS.map((project) => project.name)).toEqual([
      "chromium",
      "firefox",
      "mobile-chrome",
    ]);
    expect(BROWSER_PROJECTS.map((project) => project.schema)).toEqual([
      "worker_1",
      "worker_2",
      "worker_3",
    ]);
    expect(new Set(BROWSER_PROJECTS.map((project) => project.portOffset)).size).toBe(3);
    expect(schemaForProject("firefox")).toBe("worker_2");
    expect(() => schemaForProject("webkit")).toThrow("BROWSER_PROJECT_UNKNOWN");
  });

  it("starts one server per project with the project's schema and no demo-mode setting", () => {
    const config = read(join(process.cwd(), "playwright.config.ts"));
    expect(config).toContain("BROWSER_PROJECTS.map(");
    expect(config).toContain("DATABASE_SCHEMA: schema");
    expect(config).not.toMatch(
      /APP_RUNTIME_MODE|APP_SYNTHETIC_FIXTURE_VERSION|SYNTHETIC_TEST_COPIES/,
    );
    expect(config).not.toMatch(/IDENTITY_BROWSER_SCHEMA|worker_4/);
  });

  it.each(specs)("%s names no fixed schema, profile picker or demo route", (name) => {
    const source = read(join(BROWSER_DIRECTORY, name));
    expect(source, name).not.toMatch(/IDENTITY_BROWSER_SCHEMA|worker_4/);
    // Asking that the old controls are gone is fine; choosing a profile or calling a demo route is not.
    expect(source, name).not.toMatch(
      /profile-selector-[a-z-]*button|\/api\/synthetic|APP_RUNTIME_MODE/,
    );
    expect(source, name).not.toMatch(/-local-button|waldorf_local_session|scenario=/);
  });
});
