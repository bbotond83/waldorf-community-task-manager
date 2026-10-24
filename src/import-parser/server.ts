import "server-only";

/**
 * The server-only door of the workbook parser (BR41.2, NFR2.21). The spreadsheet library is imported by
 * `workbook.ts` alone, and `workbook.ts` is imported by this file alone (a test keeps it so); this file starts
 * with the `server-only` marker, so a client module that imports it fails the build and the library can never
 * reach a browser bundle.
 */
export { parseWorkbook } from "./workbook.ts";
export type { ImportParseCode, ParsedRow, ParseResult, WorkbookParser } from "./types.ts";
