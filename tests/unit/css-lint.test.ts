import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const css = readFileSync("app/globals.css", "utf8");
const scripts = (
  JSON.parse(readFileSync("package.json", "utf8")) as {
    scripts: Record<string, string>;
  }
).scripts;

// A scratch folder inside the project so the stylelint config is found by the normal search.
const scratch = mkdtempSync(resolve(".css-lint-"));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

function lint(source: string): { status: number; output: string } {
  const file = join(scratch, "sample.css");
  writeFileSync(file, source);
  try {
    const output = execFileSync(
      "npx",
      ["stylelint", file, "--config", resolve("stylelint.config.mjs")],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    return { status: 0, output };
  } catch (error) {
    const failure = error as { status?: number; stdout?: string; stderr?: string };
    return {
      status: failure.status ?? 1,
      output: `${failure.stdout ?? ""}${failure.stderr ?? ""}`,
    };
  }
}

describe("stylesheet check (FR6.1)", () => {
  it("has a Stylelint config that builds on the standard rules", () => {
    expect(existsSync("stylelint.config.mjs")).toBe(true);
    expect(readFileSync("stylelint.config.mjs", "utf8")).toContain("stylelint-config-standard");
  });

  it("runs lint:css on app/globals.css and wires it into the blocking verification pipeline", () => {
    expect(scripts["lint:css"]).toContain("stylelint app/globals.css");
    const pipeline = readFileSync("scripts/verification/run-local-verification.ts", "utf8");
    expect(pipeline).toMatch(/key: "lint-css", args: \["run", "lint:css"\]/);
    // CI runs the whole pipeline, so the stylesheet check is blocking there too.
    expect(readFileSync(".github/workflows/ci.yml", "utf8")).toContain("npm run verify:local");
  });

  it("rejects an unknown property", () => {
    const result = lint(".a {\n  colour: red;\n}\n");
    expect(result.status).not.toBe(0);
    expect(result.output).toContain("property-no-unknown");
  });

  it("rejects a duplicate property in one rule", () => {
    const result = lint(".a {\n  color: red;\n  color: blue;\n}\n");
    expect(result.status).not.toBe(0);
    expect(result.output).toContain("declaration-block-no-duplicate-properties");
  });

  it("accepts a clean rule", () => {
    expect(lint(".a {\n  color: red;\n}\n").status).toBe(0);
  });
});

describe("dead styles are gone (FR4.1)", () => {
  it.each([".selector-", ".profile-grid", ".profile-card"])("has no %s rule left", (name) => {
    expect(css).not.toContain(name);
  });
});
