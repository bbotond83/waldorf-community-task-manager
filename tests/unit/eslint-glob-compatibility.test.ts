import { createRequire } from "node:module";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { ESLint } from "eslint";
import { afterEach, describe, expect, it } from "vitest";

const pluginRequire = createRequire(import.meta.resolve("@next/eslint-plugin-next"));
const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

describe("Next ESLint glob dependency compatibility", () => {
  it("resolves the scoped override without the vulnerable braces dependency", () => {
    expect(pluginRequire("fast-glob/package.json").name).toBe("tinyglobby");
    expect(pluginRequire("fast-glob/package.json").version).toBe("0.2.17");
  });

  it("retains directory glob matching and the internal-link lint rule", async () => {
    const root = mkdtempSync(join(tmpdir(), "waldorf-eslint-glob-"));
    directories.push(root);
    const app = join(root, "packages", "site");
    mkdirSync(join(app, "pages"), { recursive: true });
    writeFileSync(join(app, "pages", "index.tsx"), "export default function Home() {}");
    writeFileSync(join(root, "packages", "file.txt"), "not a directory");
    const glob = join(root, "packages", "*");
    const matches: string[] = pluginRequire("fast-glob").globSync(glob, {
      onlyDirectories: true,
    });
    expect(matches.map((match) => resolve(match))).toEqual([app]);
    const eslint = new ESLint({
      overrideConfigFile: true,
      overrideConfig: [
        {
          files: ["**/*.tsx"],
          languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
          plugins: { "@next/next": pluginRequire("@next/eslint-plugin-next") },
          settings: { next: { rootDir: glob } },
          rules: { "@next/next/no-html-link-for-pages": "error" },
        },
      ],
    });
    const results = await eslint.lintText(
      'export default function Sample() { return <a href="/">Home</a>; }',
      {
        filePath: "app/glob-compatibility.tsx",
      },
    );
    expect(results[0].messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ruleId: "@next/next/no-html-link-for-pages", severity: 2 }),
      ]),
    );
  });
});
