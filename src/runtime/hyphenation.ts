const SOFT_HYPHEN = "­";

// Hungarian syllable boundaries for the fixed role names that are too long for narrow screens.
const SYLLABLES: Readonly<Record<string, readonly string[]>> = {
  Csoportadminisztrátor: ["Cso", "port", "ad", "mi", "niszt", "rá", "tor"],
  Szuperadminisztrátor: ["Szu", "per", "ad", "mi", "niszt", "rá", "tor"],
};

/** Inserts soft hyphens at Hungarian syllable boundaries of known role names; other text is unchanged. */
export function withSyllableBreaks(text: string): string {
  const syllables = SYLLABLES[text];
  return syllables ? syllables.join(SOFT_HYPHEN) : text;
}

/** Removes soft hyphens so text can be compared with plain labels. */
export function withoutSyllableBreaks(text: string): string {
  return text.replaceAll(SOFT_HYPHEN, "");
}
