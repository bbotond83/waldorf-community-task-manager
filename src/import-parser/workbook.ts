/**
 * The workbook reader (BR41.2). It turns the bytes of an uploaded .xlsx into the rows `import_preview_create`
 * expects, or into the first failed check. The spreadsheet library (`@e965/xlsx`, pinned) is used as a reader
 * of cell data only: formulas are never evaluated and macros never run, a formula cell is refused, and the
 * function takes bytes, never a path. Only server code imports this file (through `server.ts`).
 *
 * The checks run in the order of the rule, and nothing is staged when one of the first five fails:
 *   1. the file is a readable ZIP with the workbook parts (IMPORT_MALFORMED);
 *   2. the file, the declared uncompressed size and the declared rows are within the limits, read from the
 *      ZIP's own directory before anything is expanded (IMPORT_OVERSIZED);
 *   3. all 17 registered sheets exist (IMPORT_MISSING_SHEET);
 *   4. each interactive sheet's first row holds exactly the template's headers (IMPORT_MISSING_HEADER);
 *   5. no formula cell, no cell over 10000 characters and no text cell starting with =, + or @ outside a
 *      phone column on the interactive sheets (IMPORT_UNSAFE_CELL). The nine archive sheets are only counted:
 *      their content is never read into the staged data, so it is not judged either.
 * An invalid phone value is dropped and counted as a warning of its row, and the optional profile is kept only
 * when the consent column says `igen`; a dropped profile is counted as a warning too.
 */
import * as XLSX from "@e965/xlsx";
import { IMPORT_LIMITS, PHONE_PATTERN, UNSAFE_CELL_PREFIXES } from "./limits.ts";
import { DIRECTORY_SHEET, REQUIRED_SHEETS, SHEET_REGISTRY } from "./template.ts";
import type { ImportParseCode, ParsedRow, ParseResult } from "./types.ts";
import { readZipDirectory } from "./zip.ts";

export type { ImportParseCode, ParsedRow, ParseResult } from "./types.ts";

const PHONE_COLUMN = "Telefon";
const PROFILE_COLUMN = "Opcionális profil";
const CONSENT_COLUMN = "Hozzájárulás";
const CONSENT_MARK = "igen";
const REQUIRED_PARTS = ["xl/workbook.xml", "[Content_Types].xml"] as const;

const refuse = (code: ImportParseCode, detail: string): ParseResult => ({
  ok: false,
  code,
  detail,
});

type Cell = { t?: string; v?: unknown; w?: string; f?: unknown };

/** The text of a cell as a person sees it. */
function cellText(cell: Cell): string {
  if (cell.w !== undefined && cell.w !== null) {
    return String(cell.w);
  }
  return cell.v === undefined || cell.v === null ? "" : String(cell.v);
}

/** Reads the uploaded workbook bytes. Never throws for a bad file: the first failed check is returned. */
export function parseWorkbook(bytes: Uint8Array): ParseResult {
  // 1. Format: a ZIP with the workbook parts.
  const directory = readZipDirectory(bytes);
  if (!directory.ok && directory.reason === "not_a_zip") {
    return refuse("IMPORT_MALFORMED", "The file is not a readable .xlsx workbook.");
  }
  // 2. Limits, from the directory, before anything is expanded.
  if (bytes.length > IMPORT_LIMITS.maxFileBytes) {
    return refuse("IMPORT_OVERSIZED", "The file is larger than 5 MB.");
  }
  if (!directory.ok || directory.uncompressedBytes > IMPORT_LIMITS.maxUncompressedBytes) {
    return refuse("IMPORT_OVERSIZED", "The workbook expands to more than 50 MB.");
  }
  const names = new Set(directory.entries.map((entry) => entry.name));
  if (!REQUIRED_PARTS.every((part) => names.has(part))) {
    return refuse("IMPORT_MALFORMED", "The file is not a readable .xlsx workbook.");
  }

  let book: XLSX.WorkBook;
  try {
    book = XLSX.read(bytes, {
      type: "array",
      cellFormula: true,
      cellHTML: false,
      cellStyles: false,
      cellDates: false,
      cellNF: false,
      sheetStubs: false,
      bookVBA: false,
      // One row more than the limit is enough to see that a sheet is over it, and stops the reader there.
      sheetRows: IMPORT_LIMITS.maxRowsPerSheet + 1,
    });
  } catch {
    return refuse("IMPORT_MALFORMED", "The file is not a readable .xlsx workbook.");
  }

  const sheetOf = (name: string): XLSX.WorkSheet | undefined =>
    book.SheetNames.includes(name) ? book.Sheets[name] : undefined;

  // The declared rows (the dimension of each registered sheet) are still part of the size checks.
  let declaredTotal = 0;
  for (const name of REQUIRED_SHEETS) {
    const sheet = sheetOf(name);
    const reference = sheet?.["!fullref"] ?? sheet?.["!ref"];
    if (reference) {
      const rows = XLSX.utils.decode_range(reference).e.r + 1;
      if (rows > IMPORT_LIMITS.maxRowsPerSheet) {
        return refuse("IMPORT_OVERSIZED", "A sheet has more than 20000 rows.");
      }
      declaredTotal += rows;
    }
  }
  if (declaredTotal > IMPORT_LIMITS.maxRowsTotal) {
    return refuse("IMPORT_OVERSIZED", "The workbook has more than 100000 rows.");
  }

  // 3. All 17 registered sheets.
  const missing = REQUIRED_SHEETS.filter((name) => sheetOf(name) === undefined);
  if (missing.length > 0) {
    return refuse("IMPORT_MISSING_SHEET", `The workbook has no sheet named ${missing[0]}.`);
  }

  // 4. The header row of every interactive sheet.
  for (const entry of SHEET_REGISTRY) {
    if (entry.mode !== "interactive") {
      continue;
    }
    const sheet = sheetOf(entry.sheet)!;
    const found = entry.headers.map((_, column) => {
      const cell = sheet[XLSX.utils.encode_cell({ r: 0, c: column })] as Cell | undefined;
      return cell ? cellText(cell).trim() : "";
    });
    const extra = sheet[XLSX.utils.encode_cell({ r: 0, c: entry.headers.length })] as
      Cell | undefined;
    if (extra !== undefined || found.some((header, column) => header !== entry.headers[column])) {
      return refuse(
        "IMPORT_MISSING_HEADER",
        `The header row of ${entry.sheet} is not the template's.`,
      );
    }
  }

  // 5. Cell safety on the interactive sheets, and the rows of every sheet.
  const rows: ParsedRow[] = [];
  let droppedPhones = 0;
  let droppedProfiles = 0;
  for (const entry of SHEET_REGISTRY) {
    const sheet = sheetOf(entry.sheet)!;
    const byRow = new Map<number, Map<number, Cell>>();
    for (const key of Object.keys(sheet)) {
      if (key.startsWith("!")) {
        continue;
      }
      const cell = sheet[key] as Cell | undefined;
      if (cell === undefined || cell === null) {
        continue;
      }
      const at = XLSX.utils.decode_cell(key);
      let row = byRow.get(at.r);
      if (row === undefined) {
        row = new Map();
        byRow.set(at.r, row);
      }
      row.set(at.c, cell);
    }
    const rowIndexes = [...byRow.keys()].sort((a, b) => a - b);

    if (entry.mode === "read_only_archive") {
      for (const index of rowIndexes) {
        const hasContent = [...byRow.get(index)!.values()].some(
          (cell) => cell.f !== undefined || cellText(cell).trim() !== "",
        );
        if (hasContent) {
          rows.push({ sheet: entry.sheet, row: index + 1 });
        }
      }
      continue;
    }

    for (const index of rowIndexes) {
      if (index === 0) {
        // The header row was checked above; a formula or long text in it is unsafe like any other cell.
        for (const cell of byRow.get(0)!.values()) {
          if (cell.f !== undefined || cellText(cell).length > IMPORT_LIMITS.maxCellCharacters) {
            return refuse("IMPORT_UNSAFE_CELL", `A cell of ${entry.sheet} is not safe to import.`);
          }
        }
        continue;
      }
      const values: Record<string, string> = {};
      let warnings = 0;
      for (const [column, cell] of byRow.get(index)!) {
        const header = entry.headers[column];
        if (header === undefined) {
          continue;
        }
        const text = cellText(cell);
        if (cell.f !== undefined || text.length > IMPORT_LIMITS.maxCellCharacters) {
          return refuse("IMPORT_UNSAFE_CELL", `A cell of ${entry.sheet} is not safe to import.`);
        }
        const trimmed = text.trim();
        if (trimmed === "") {
          continue;
        }
        const isPhone = entry.sheet === DIRECTORY_SHEET && header === PHONE_COLUMN;
        if (isPhone) {
          if (PHONE_PATTERN.test(trimmed)) {
            values[header] = trimmed;
          } else {
            warnings += 1;
            droppedPhones += 1;
          }
          continue;
        }
        if (cell.t === "s" && UNSAFE_CELL_PREFIXES.some((prefix) => trimmed.startsWith(prefix))) {
          return refuse("IMPORT_UNSAFE_CELL", `A cell of ${entry.sheet} is not safe to import.`);
        }
        values[header] = trimmed;
      }
      if (Object.keys(values).length === 0 && warnings === 0) {
        continue;
      }
      if (
        entry.sheet === DIRECTORY_SHEET &&
        values[PROFILE_COLUMN] !== undefined &&
        (values[CONSENT_COLUMN] ?? "").toLowerCase() !== CONSENT_MARK
      ) {
        delete values[PROFILE_COLUMN];
        warnings += 1;
        droppedProfiles += 1;
      }
      rows.push(
        warnings > 0
          ? { sheet: entry.sheet, row: index + 1, values, warnings }
          : { sheet: entry.sheet, row: index + 1, values },
      );
    }
  }

  return {
    ok: true,
    rows,
    warnings: droppedPhones + droppedProfiles,
    droppedPhones,
    droppedProfiles,
  };
}
