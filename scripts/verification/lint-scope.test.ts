import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { describe, it } from "node:test";

const root = new URL("../../", import.meta.url);
const scripts = JSON.parse(readFileSync(new URL("package.json", root), "utf8")).scripts as Record<
  string,
  string
>;

/**
 * Source folders that are deliberately outside the lint and format scope: the demo-era modules that the
 * replacement units remove (BR34.1: U3 deleted src/directory, src/coordination, src/parent-experience
 * and src/privacy-audit, U4 deleted src/notifications and src/import-migration, U5 deleted the five synthetic
 * adapter modules) and two older folders that stay outside the scope. The list only shrinks: a folder in it that no longer exists fails the test, so deleting a
 * module forces the line out of this list, and a new folder that is in neither the scope nor this list
 * fails too, so new code cannot silently skip the blocking checks (NFR2.10, team practice: Prettier and
 * ESLint are blocking checks).
 */
const LEGACY_OUTSIDE_SCOPE = ["src/access"] as const;

const SCOPED_SCRIPTS = ["lint", "format", "format:check"] as const;

/** The paths a script names (the arguments that start with a source folder). */
function pathsOf(script: string): string[] {
  return script
    .split(/\s+/)
    .filter((part) => /^(app|src|tests|scripts|verification)(\/|$)/.test(part));
}

function foldersUnder(parent: string): string[] {
  return readdirSync(new URL(`${parent}/`, root))
    .filter((name) => statSync(new URL(`${parent}/${name}`, root)).isDirectory())
    .map((name) => `${parent}/${name}`);
}

const covered = (folder: string, scope: readonly string[]) =>
  scope.some((entry) => folder === entry || folder.startsWith(`${entry}/`));

describe("lint and format scope guard (NFR2.10)", () => {
  it("covers every folder under src and app in lint, format and format check, or lists it as legacy", () => {
    for (const name of SCOPED_SCRIPTS) {
      const scope = pathsOf(scripts[name]!);
      assert.ok(scope.length > 0, `${name} names no source folder`);
      const outside = [...foldersUnder("src"), ...foldersUnder("app")].filter(
        (folder) =>
          !covered(folder, scope) && !(LEGACY_OUTSIDE_SCOPE as readonly string[]).includes(folder),
      );
      assert.deepEqual(outside, [], `${name}: folders outside the scope and not listed as legacy`);
    }
  });

  it("keeps the legacy list honest: every entry exists and none is inside the scope already", () => {
    for (const folder of LEGACY_OUTSIDE_SCOPE) {
      assert.ok(
        existsSync(new URL(folder, root)),
        `${folder} no longer exists: remove it from the list`,
      );
      for (const name of SCOPED_SCRIPTS) {
        assert.equal(
          covered(folder, pathsOf(scripts[name]!)),
          false,
          `${folder} is in the ${name} scope: remove it from the legacy list`,
        );
      }
    }
  });

  it("uses the same source folders for lint, format and format check", () => {
    const sourceFolders = (name: string) =>
      pathsOf(scripts[name]!).filter(
        (entry) => entry.startsWith("src/") || entry.startsWith("app"),
      );
    assert.deepEqual(sourceFolders("format"), sourceFolders("lint"));
    assert.deepEqual(sourceFolders("format:check"), sourceFolders("lint"));
  });

  it("includes the database adapters folder", () => {
    for (const name of SCOPED_SCRIPTS)
      assert.ok(pathsOf(scripts[name]!).includes("src/data"), name);
    assert.ok(existsSync(new URL("src/data", root)));
  });
});
