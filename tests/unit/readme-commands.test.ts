import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The README keeps in step with the commands (NFR2.38, FR1.5): every database, test and verification command of
 * `package.json` is named in it, every `npm run` it names exists, and it states the prerequisites and the schema
 * selector. The Hungarian guide is checked for the real sign-in flows it must describe (FR12.1).
 */
const readme = readFileSync("README.md", "utf8");
const guide = readFileSync("HASZNALATI_UTMUTATO_HU.md", "utf8");
const scripts = Object.keys(
  (JSON.parse(readFileSync("package.json", "utf8")) as { scripts: Record<string, string> }).scripts,
);

const DOCUMENTED = scripts.filter((name) =>
  /^(db:|test:|verify:|smoke:|check:|build$|dev$|start$|lint$|typecheck$|format)/.test(name),
);

describe("README", () => {
  it("finds the scripts it must list", () => {
    expect(DOCUMENTED.length).toBeGreaterThan(25);
  });

  it.each(DOCUMENTED)("names the command %s", (name) => {
    // `npm run <name>` or the bare name written in a table or sentence.
    expect(readme.includes(name), name).toBe(true);
  });

  it("names only npm scripts that exist", () => {
    const named = [...readme.matchAll(/npm run ([a-z][a-z0-9:-]*)/g)].map((match) => match[1]!);
    expect(named.length).toBeGreaterThan(20);
    for (const name of named) expect(scripts, `npm run ${name}`).toContain(name);
  });

  it("states the prerequisites, the stack commands and the schema selector", () => {
    for (const text of [
      "Docker Desktop",
      "licence",
      "Node.js 24",
      "npm 11",
      "npm run db:start",
      "npm run db:stop",
      "npm run db:seed",
      "npm run db:seed:large",
      "npm run db:reset",
      "npm run db:reset -- --yes",
      "--schema",
      "worker_1",
      "public",
    ]) {
      expect(readme, text).toContain(text);
    }
  });

  it("holds no demo mode, profile picker or removed setting", () => {
    expect(readme).not.toMatch(
      /APP_RUNTIME_MODE|APP_SYNTHETIC_FIXTURE_VERSION|SYNTHETIC_TEST_COPIES/,
    );
    expect(readme).not.toMatch(/Tesztprofil|tesztprofil|synthetic mode|Privacy-safe synthetic/);
  });
});

describe("the Hungarian testing guide", () => {
  it("describes real sign-in, password reset, invitations and testing with several people at once", () => {
    for (const text of [
      "Bejelentkezés",
      "Elfelejtett jelszó",
      "Meghívó",
      "egyszerre",
      "npm run db:seed",
      "npm run db:reset",
      "Fiókok",
    ]) {
      expect(guide, text).toContain(text);
    }
  });

  it("holds no removed demo element and no password", () => {
    expect(guide).not.toMatch(
      /Tesztprofil váltása|profil kiválasztása|\/api\/synthetic|scenario|forgatókönyv/i,
    );
    expect(guide).not.toMatch(/Teszt-(Szuperadmin|Csoportadmin|Ovono|Szulo)-\d+/);
  });
});

describe("the report on the workbook and the known limits", () => {
  const report = readFileSync("verification/reports/u5-workbook-and-known-limits.md", "utf8");

  it("states that the real workbook is not in this repository's git history and the archive stays private (NFR1.69)", () => {
    expect(report).toContain("not in the history of this repository");
    expect(report).toContain("rewritten history");
    expect(report).toMatch(/owner/);
    expect(report).toMatch(/never make that archive public/);
  });

  it("lists each known limit (NFR6.30)", () => {
    for (const text of [
      "not re-planned when a family changes group",
      "expires only when somebody signs in",
      "scheduler",
      "Hosted-target checks stay outstanding evidence",
      "Hungarian notice titles",
    ]) {
      expect(report, text).toContain(text);
    }
  });
});
