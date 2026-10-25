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
}>;
