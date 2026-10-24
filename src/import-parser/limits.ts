/**
 * The limits of an uploaded workbook (BR41.2). They are checked from the file's own ZIP directory before
 * anything is expanded, so a hostile file is refused cheaply. The numbers are the design's: a school's
 * workbook is far below them, so they only ever stop a wrong or hostile file.
 */
export const IMPORT_LIMITS = Object.freeze({
  /** The largest accepted upload, in bytes (5 MB). */
  maxFileBytes: 5 * 1024 * 1024,
  /** The server-action body limit of the application: the file limit plus room for the form fields (6 MB). */
  maxBodyBytes: 6 * 1024 * 1024,
  /** The largest uncompressed size the ZIP directory may declare, in bytes (50 MB). */
  maxUncompressedBytes: 50 * 1024 * 1024,
  /** The most rows one sheet may declare. */
  maxRowsPerSheet: 20000,
  /** The most rows the whole workbook may declare. */
  maxRowsTotal: 100000,
  /** The longest text a cell may hold, in characters. */
  maxCellCharacters: 10000,
});

/** The first characters that make a text cell unsafe outside a phone column (spreadsheet formula injection). */
export const UNSAFE_CELL_PREFIXES: readonly string[] = Object.freeze(["=", "+", "@"]);

/**
 * The phone rule of the directory (U3, the `parent_contacts` check): digits, spaces, a plus sign and dashes,
 * 6 to 20 characters. A phone cell may start with a plus sign; a value that fails the rule is dropped and
 * counted, and the row still imports.
 */
export const PHONE_PATTERN = /^[0-9 +-]{6,20}$/;
