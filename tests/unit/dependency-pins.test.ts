import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

type Manifest = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};
type Lock = { packages: Record<string, { version?: string }> };

const manifest = JSON.parse(readFileSync("package.json", "utf8")) as Manifest;
const lock = JSON.parse(readFileSync("package-lock.json", "utf8")) as Lock;
const declared = { ...manifest.dependencies, ...manifest.devDependencies };

// These five used to float on "latest", so a new release could change check results without a code change.
const PINNED = ["react", "react-dom", "zod", "@axe-core/playwright", "@playwright/test"] as const;

describe("pinned dependency versions (FR6.2)", () => {
  it.each(PINNED)("pins %s to one exact version, not latest or a range", (name) => {
    const wanted = declared[name];
    expect(wanted, `${name} is declared`).toBeDefined();
    expect(wanted).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it.each(PINNED)("keeps %s in package.json equal to the version in package-lock.json", (name) => {
    expect(lock.packages[`node_modules/${name}`]?.version).toBe(declared[name]);
  });

  it("pins the CSS check packages to exact versions too", () => {
    for (const name of ["stylelint", "stylelint-config-standard"]) {
      expect(declared[name], name).toMatch(/^\d+\.\d+\.\d+$/);
    }
  });
});
