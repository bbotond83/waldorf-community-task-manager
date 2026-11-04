import { existsSync, readFileSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";

const layout = readFileSync("app/layout.tsx", "utf8");
const css = readFileSync("app/globals.css", "utf8");
const proxy = readFileSync("proxy.ts", "utf8");

const FAMILIES = ["vollkorn", "karla"] as const;
const SUBSETS = ["latin", "latin-ext"] as const;

describe("self-hosted fonts (FR1.1 to FR1.4)", () => {
  it.each(FAMILIES.flatMap((family) => SUBSETS.map((subset) => [family, subset] as const)))(
    "ships %s %s as a non-empty WOFF2 file that the layout loads",
    (family, subset) => {
      const file = `app/fonts/${family}-${subset}-wght-normal.woff2`;
      expect(existsSync(file), file).toBe(true);
      expect(statSync(file).size).toBeGreaterThan(1000);
      // WOFF2 files start with the magic bytes "wOF2".
      expect(readFileSync(file).subarray(0, 4).toString("latin1")).toBe("wOF2");
      expect(layout).toContain(`./fonts/${family}-${subset}-wght-normal.woff2`);
    },
  );

  it.each(FAMILIES)("keeps the licence text of %s beside its files", (family) => {
    const licence = readFileSync(`app/fonts/${family}-OFL.txt`, "utf8");
    expect(licence).toContain("SIL OPEN FONT LICENSE");
  });

  it("covers the Hungarian letters ő and ű with the latin-ext files and swaps while loading", () => {
    // U+0151 (ő) and U+0171 (ű) sit inside U+0100-02BA, which only the latin-ext files declare.
    expect(layout).toContain("U+0100-02BA");
    expect(layout).not.toMatch(/U\+0000-00FF[^"]*U\+0100-02BA/);
    expect(layout.match(/display: "swap"/g)).toHaveLength(4);
    expect(layout).toContain('<html lang="hu"');
  });

  it("keeps system stand-in fonts out of the font families, so ő and ű are drawn by the latin-ext files", () => {
    // Regression: next/font adds a stand-in (local Arial) and any `fallback` to each family name. The stylesheet lists the
    // latin family before the latin-ext one, so a stand-in inside the first family would draw ő and ű before the real file.
    expect(layout).not.toMatch(/^\s*fallback:/m);
    expect(layout.match(/adjustFontFallback: false/g)).toHaveLength(4);
  });

  it("exposes the loaded fonts to the stylesheet as the heading and body families", () => {
    for (const variable of [
      "--font-vollkorn-latin",
      "--font-vollkorn-latin-ext",
      "--font-karla-latin",
      "--font-karla-latin-ext",
    ]) {
      expect(layout).toContain(`variable: "${variable}"`);
      expect(css).toContain(`var(${variable})`);
    }
    expect(css).toMatch(/h1,\s*h2,\s*h3\s*{\s*font-family:\s*var\(--font-heading\)/);
    expect(css).toMatch(/body\s*{[^}]*font-family:\s*var\(--font-body\)/);
  });

  it("keeps font-src 'self' and loads no font from another host", () => {
    expect(proxy).toContain("font-src 'self'");
    for (const source of [layout, css, proxy]) {
      expect(source).not.toMatch(/fonts\.(googleapis|gstatic)\.com/);
    }
    expect(css).not.toMatch(/@import\s+url\(/);
  });
});
