import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("app/globals.css", "utf8");
const root = /:root\s*{([^}]*)}/.exec(css)?.[1] ?? "";

function token(name: string): string {
  const match = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`).exec(root);
  if (!match) throw new Error(`Missing colour token --${name}`);
  return match[1]!;
}

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((index) => {
    const value = parseInt(hex.slice(index, index + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

export function contrast(first: string, second: string): number {
  const [light, dark] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (light! + 0.05) / (dark! + 0.05);
}

describe("design tokens", () => {
  it("keeps body text readable on every surface (WCAG AA 4.5:1)", () => {
    for (const text of ["color-text", "color-muted", "color-primary-dark"]) {
      for (const surface of [
        "color-background",
        "color-surface",
        "color-info-bg",
        "color-danger-bg",
        "color-success-bg",
      ]) {
        expect(
          contrast(token(text), token(surface)),
          `${text} on ${surface}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("keeps the greyed read-notification card readable (4.5:1) and its card edge visible", () => {
    for (const text of ["color-read-text", "color-primary-dark", "color-text"]) {
      expect(
        contrast(token(text), token("color-read-bg")),
        `${text} on color-read-bg`,
      ).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast(token("color-focus"), token("color-read-bg"))).toBeGreaterThanOrEqual(3);
    expect(contrast(token("color-border-strong"), token("color-read-bg"))).toBeGreaterThanOrEqual(
      3,
    );
    expect(token("color-read-bg")).not.toBe(token("color-surface"));
  });

  it("keeps button text readable on the primary colours", () => {
    expect(contrast("#ffffff", token("color-primary"))).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#ffffff", token("color-primary-dark"))).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#ffffff", token("color-success"))).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps focus ring, control borders and accents visible (3:1)", () => {
    for (const surface of ["color-background", "color-surface"]) {
      expect(contrast(token("color-focus"), token(surface))).toBeGreaterThanOrEqual(3);
      expect(contrast(token("color-border-strong"), token(surface))).toBeGreaterThanOrEqual(3);
      expect(contrast(token("color-accent-ochre"), token(surface))).toBeGreaterThanOrEqual(3);
    }
  });

  it("keeps the menu button states readable (text 4.5:1, borders 3:1)", () => {
    // default: dark text and strong border on the surface; hover: info background;
    // pressed: danger background; current page: white text on the primary colour.
    for (const background of ["color-surface", "color-info-bg", "color-danger-bg"]) {
      expect(
        contrast(token("color-primary-dark"), token(background)),
        `menu text on ${background}`,
      ).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast(token("color-border-strong"), token("color-surface"))).toBeGreaterThanOrEqual(
      3,
    );
    expect(contrast(token("color-primary"), token("color-info-bg"))).toBeGreaterThanOrEqual(3);
    expect(contrast(token("color-primary-dark"), token("color-background"))).toBeGreaterThanOrEqual(
      3,
    );
    expect(contrast("#ffffff", token("color-primary"))).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#ffffff", token("color-primary-dark"))).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps the status symbols visible next to their words (3:1) on every card surface", () => {
    // The symbol colours (done, failed, waiting) come from existing tokens, no new hex colour.
    const tones = css.match(
      /\.status-badge-icon-(positive|negative|pending)\s*{\s*color:\s*var\(--([a-z-]+)\)/g,
    );
    expect(tones).toHaveLength(3);
    for (const name of ["color-success", "color-primary", "color-accent-ochre"]) {
      for (const surface of ["color-background", "color-surface", "color-info-bg"]) {
        expect(
          contrast(token(name), token(surface)),
          `${name} on ${surface}`,
        ).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it("keeps the link-button states readable: white on primary, dark text on its hover tint", () => {
    expect(css).toMatch(/\.button-link\s*{[^}]*background:\s*var\(--color-primary\)/);
    expect(css).toMatch(
      /\.button-link:hover,\s*\.button-link:active\s*{[^}]*var\(--color-primary-dark\)/,
    );
    expect(contrast("#ffffff", token("color-primary"))).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#ffffff", token("color-primary-dark"))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token("color-primary-dark"), token("color-info-bg"))).toBeGreaterThanOrEqual(
      4.5,
    );
    expect(contrast(token("color-primary"), token("color-surface"))).toBeGreaterThanOrEqual(3);
  });

  it("stacks every filter label above its control", () => {
    expect(css).toMatch(/\.filter-field\s*{[^}]*flex-direction:\s*column/);
    expect(css).toMatch(
      /\.admin-filter,\s*\.teacher-filter fieldset,\s*\.parent-filter,\s*\.advanced-filter\s*{[^}]*grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(min\(100%,\s*12rem\)/,
    );
  });

  it("removes the heading focus box but keeps the ring on controls", () => {
    expect(css).toMatch(/\[tabindex="-1"\]:focus-visible\s*{\s*outline:\s*none/);
    expect(css).toMatch(/:focus-visible\s*{\s*outline:\s*3px solid var\(--color-focus\)/);
  });

  it("defines every hex colour only as a token in :root", () => {
    const outsideRoot = css.replace(/:root\s*{[^}]*}/, "");
    expect(outsideRoot.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).toEqual([]);
  });

  it("uses language-aware hyphenation instead of breaking anywhere in headings", () => {
    const heading = /h1,\s*h2,\s*p\s*{([^}]*)}/.exec(css)?.[1] ?? "";
    expect(heading).toContain("hyphens: auto");
    expect(heading).toContain("overflow-wrap: break-word");
    expect(heading).not.toContain("anywhere");
  });
});
