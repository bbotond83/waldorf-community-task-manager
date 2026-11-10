import type { NavigationItem } from "../application/index.ts";

/**
 * What the page shell shows about the signed-in person: a label, a one-line scope summary, the home path and
 * the menu, read from the real person's session (BR32.7).
 */
export type ShellProfile = Readonly<{
  label: string;
  scopeSummary: string;
  homePath: string;
  navigation: readonly NavigationItem[];
  /** For someone who is both a parent and an administrator: the way to the other menu (BR8.1). */
  switchLink?: Readonly<{ label: string; href: string }>;
}>;
