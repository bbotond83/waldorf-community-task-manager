import type { DirectoryFamily } from "../application/index.ts";

/** Lower case without accents, so "ő" is found by "o" and a capital by a small letter. */
export function normalizeForSearch(value: string): string {
  return value
    .normalize("NFD")
    .replaceAll(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

/**
 * The families whose name, a parent's name or a shown child's name contains every word of the query (BR30.9). It works
 * on the cards already received, so it cannot show what the viewer was not sent; contact details are not searched.
 */
export function filterFamilies(
  families: readonly DirectoryFamily[],
  query: string,
): readonly DirectoryFamily[] {
  const words = normalizeForSearch(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return families;
  return families.filter((family) => {
    const haystack = normalizeForSearch(
      [
        family.familyName,
        ...family.parents.map((parent) => parent.fullName),
        ...(family.children ?? []),
      ].join(" "),
    );
    return words.every((word) => haystack.includes(word));
  });
}
