/**
 * Public surface of the workbook parser (BR41.2) that is safe for any module: the limits and the template. The
 * workbook reader itself (`workbook.ts`) is reached only through `server.ts`, which is marked server-only, so
 * the spreadsheet library never enters client code.
 */
export type { ImportParseCode, ParsedRow, ParseResult, WorkbookParser } from "./types.ts";
export { IMPORT_LIMITS, PHONE_PATTERN, UNSAFE_CELL_PREFIXES } from "./limits.ts";
export {
  DIRECTORY_HEADERS,
  DIRECTORY_SHEET,
  REQUIRED_SHEETS,
  SHEET_REGISTRY,
  sheetEntry,
  TASK_HEADERS,
  type SheetEntry,
  type SheetMode,
} from "./template.ts";
