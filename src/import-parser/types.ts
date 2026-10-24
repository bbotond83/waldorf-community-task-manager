/**
 * The result types of the workbook reader. They carry no library and no server-only marker, so the database
 * adapter can describe the parser it is given without importing the reader itself.
 */
export type ImportParseCode =
  | "IMPORT_MALFORMED"
  | "IMPORT_OVERSIZED"
  | "IMPORT_MISSING_SHEET"
  | "IMPORT_MISSING_HEADER"
  | "IMPORT_UNSAFE_CELL";

/** One row for `import_preview_create`: an interactive sheet's row has its values, an archive row only its place. */
export type ParsedRow = Readonly<{
  sheet: string;
  row: number;
  values?: Readonly<Record<string, string>>;
  warnings?: number;
}>;

export type ParseResult =
  | Readonly<{
      ok: true;
      rows: readonly ParsedRow[];
      /** Dropped phone values and profile texts, over the whole workbook. */
      warnings: number;
      droppedPhones: number;
      droppedProfiles: number;
    }>
  | Readonly<{ ok: false; code: ImportParseCode; detail: string }>;

/** The parser the adapter is given: bytes in, the first failed check or the rows out. Never throws for a bad file. */
export type WorkbookParser = (bytes: Uint8Array) => ParseResult;
