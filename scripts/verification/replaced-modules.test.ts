import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));

/**
 * The demo-era modules that were replaced with database functions and adapters: four by U3 (BR34.1, ledger
 * rows D1 to D22, D30, D31) and two by U4 (BR43.1, ledger rows N1 to N27: `notifications` by the notification
 * and reminder functions, `import-migration` by the import functions and the server-only parser). The test
 * keeps them gone: the folders must not come back and nothing may import them again. The running adapters and
 * `src/teacher-tracking` stay until U5 and are not listed.
 */
const REPLACED = [
  "directory",
  "coordination",
  "parent-experience",
  "privacy-audit",
  "notifications",
  "import-migration",
] as const;

const SCANNED_ROOTS = ["app", "src", "tests", "scripts", "proxy.ts"];
const SOURCE = /\.(ts|tsx|mts|mjs|js)$/;

function sourceFiles(path: string): string[] {
  const absolute = join(root, path);
  if (!existsSync(absolute)) return [];
  if (statSync(absolute).isFile()) return SOURCE.test(path) ? [path] : [];
  return readdirSync(absolute).flatMap((name) => {
    if (name === "node_modules" || name === ".next") return [];
    return sourceFiles(relative(root, join(absolute, name)));
  });
}

/** Module specifiers of import, export-from, dynamic import and require calls. */
function specifiers(text: string): string[] {
  const found: string[] = [];
  const pattern = /(?:from\s+|import\s*\(\s*|import\s+|require\s*\(\s*)["']([^"']+)["']/g;
  for (const match of text.matchAll(pattern)) found.push(match[1]!);
  return found;
}

describe("replaced modules stay gone (BR34.1, NFR2.17)", () => {
  it("has no folder left for the four replaced modules", () => {
    for (const name of REPLACED) {
      assert.equal(existsSync(join(root, "src", name)), false, `src/${name} came back`);
    }
  });

  it("is not imported by any application, source, test or script file", () => {
    const files = SCANNED_ROOTS.flatMap(sourceFiles);
    assert.ok(files.length > 300, "the search covers the whole code base");
    const offenders: string[] = [];
    for (const file of files) {
      for (const specifier of specifiers(readFileSync(join(root, file), "utf8"))) {
        if (!specifier.startsWith(".") && !specifier.startsWith("@/")) continue;
        const target = specifier.split("/").filter((part) => part !== "." && part !== "..");
        // A whole folder name as one path part: files such as directory-schema.test.ts do not match.
        if (target.some((part) => (REPLACED as readonly string[]).includes(part))) {
          offenders.push(`${file} imports ${specifier}`);
        }
      }
    }
    assert.deepEqual(offenders, []);
  });

  it("is not named as a source path in the verification configuration", () => {
    const configs = ["package.json", "vitest.config.ts", "tsconfig.json", "eslint.config.mjs"];
    for (const file of configs) {
      if (!existsSync(join(root, file))) continue;
      const text = readFileSync(join(root, file), "utf8");
      for (const name of REPLACED) {
        assert.doesNotMatch(text, new RegExp(`src/${name}\\b`), `${file} names src/${name}`);
      }
    }
  });
});
