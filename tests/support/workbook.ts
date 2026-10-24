/**
 * A generator for the fictitious 17-sheet workbook of the import tests (BR41.11). Every name, e-mail address and
 * phone number here is invented; nothing is read from the owner's real-data folder, and the real workbook is
 * never opened by any test. The generator writes real .xlsx bytes with the same pinned library the parser reads
 * with, and a small ZIP writer builds the hostile files (a zip bomb whose directory declares more than the
 * limit, a file that is not a workbook) without a real expansion.
 */
import { crc32, deflateRawSync } from "node:zlib";
import * as XLSX from "@e965/xlsx";
import {
  DIRECTORY_HEADERS,
  DIRECTORY_SHEET,
  REQUIRED_SHEETS,
  SHEET_REGISTRY,
  TASK_HEADERS,
} from "../../src/import-parser/template.ts";

/** A cell of the generator: text, a number, a formula (stored with its cached result) or nothing. */
export type CellSpec = string | number | { formula: string } | undefined;
export type RowSpec = readonly CellSpec[];

export type WorkbookSpec = {
  /** Data rows by sheet name (row 1, the header row, is written by the generator). */
  rows?: Readonly<Record<string, readonly RowSpec[]>>;
  /** Sheets left out of the file. */
  omitSheets?: readonly string[];
  /** A replacement header row by sheet name. */
  headers?: Readonly<Record<string, readonly string[]>>;
  /** Extra data rows for archive sheets: how many non-empty rows each archive sheet holds (default 2). */
  archiveRows?: number;
  /** Cells written after the rows, by sheet and address. */
  cells?: Readonly<Record<string, Readonly<Record<string, CellSpec>>>>;
};

const START = "2026-12-10 10:00";
const END = "2026-12-10 12:00";

/** The directory row of a parent: [Csoport, Család, Szülő neve, E-mail, Telefon, Helység, Gyermek neve, profil, hozzájárulás]. */
export const directoryRow = (
  values: Partial<Record<(typeof DIRECTORY_HEADERS)[number], CellSpec>>,
) => DIRECTORY_HEADERS.map((header) => values[header]);

/** The row of a task sheet: [Csoport, Esemény, Feladat, Kategória, Kezdés, Befejezés, Helyszín, Létszám, Család]. */
export const taskRow = (values: Partial<Record<(typeof TASK_HEADERS)[number], CellSpec>>) =>
  TASK_HEADERS.map((header) => values[header]);

/** The default fictitious content: two families in one group, one task sheet with two tasks, archive sheets with notes. */
export function fictitiousRows(): Record<string, RowSpec[]> {
  return {
    [DIRECTORY_SHEET]: [
      directoryRow({
        Csoport: "Bükköny",
        Család: "Mézes család",
        "Szülő neve": "Mézes Márta",
        "E-mail": "marta@example.test",
        Telefon: "+36 20 333 4444",
        Helység: "Pécs",
        "Opcionális profil": "Szeret főzni.",
        Hozzájárulás: "igen",
      }),
      directoryRow({ Csoport: "Bükköny", Család: "Mézes család", "Gyermek neve": "Mézes Máté" }),
      directoryRow({
        Csoport: "Bükköny",
        Család: "Fenyő család",
        "Szülő neve": "Fenyő Anna",
        "E-mail": "anna@example.test",
        Telefon: "nincs",
      }),
    ],
    "Kinti - benti takarítás 2025-26": [
      taskRow({
        Csoport: "Bükköny",
        Esemény: "Tavaszi nagytakarítás",
        Feladat: "Havi takarítás",
        Kategória: "takarítás",
        Kezdés: START,
        Befejezés: END,
        Helyszín: "Tornaterem",
        Létszám: 2,
        Család: "Mézes család",
      }),
      taskRow({
        Csoport: "Bükköny",
        Feladat: "Kerti munka",
        Kezdés: "2026-12-11 09:00",
        Befejezés: "2026-12-11 11:00",
        Létszám: 3,
      }),
    ],
  };
}

const address = (row: number, column: number) => XLSX.utils.encode_cell({ r: row, c: column });

function toCell(value: CellSpec): XLSX.CellObject | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value === "number") {
    return { t: "n", v: value };
  }
  if (typeof value === "string") {
    return { t: "s", v: value };
  }
  return { t: "n", v: 2, f: value.formula };
}

/** The bytes of a 17-sheet workbook as `spec` says (the default is the fictitious workbook). */
export function buildWorkbook(spec: WorkbookSpec = {}): Uint8Array {
  const rowsBySheet = spec.rows ?? fictitiousRows();
  const book = XLSX.utils.book_new();
  for (const entry of SHEET_REGISTRY) {
    if (spec.omitSheets?.includes(entry.sheet)) {
      continue;
    }
    const sheet: XLSX.WorkSheet = {};
    let lastRow = 0;
    let lastColumn = 0;
    const put = (row: number, column: number, value: CellSpec) => {
      const cell = toCell(value);
      if (cell) {
        sheet[address(row, column)] = cell;
        lastRow = Math.max(lastRow, row);
        lastColumn = Math.max(lastColumn, column);
      }
    };
    if (entry.mode === "interactive") {
      const headers = spec.headers?.[entry.sheet] ?? entry.headers;
      headers.forEach((header, column) => put(0, column, header));
      (rowsBySheet[entry.sheet] ?? []).forEach((row, index) =>
        row.forEach((value, column) => put(index + 1, column, value)),
      );
    } else {
      const count = rowsBySheet[entry.sheet]?.length ?? spec.archiveRows ?? 2;
      for (let index = 0; index < count; index += 1) {
        put(index, 0, rowsBySheet[entry.sheet]?.[index]?.[0] ?? `Jegyzet ${index + 1}`);
      }
    }
    for (const [at, value] of Object.entries(spec.cells?.[entry.sheet] ?? {})) {
      const { r, c } = XLSX.utils.decode_cell(at);
      put(r, c, value);
    }
    sheet["!ref"] = XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: lastRow, c: lastColumn },
    });
    XLSX.utils.book_append_sheet(book, sheet, entry.sheet);
  }
  const bytes = XLSX.write(book, {
    type: "array",
    bookType: "xlsx",
    compression: true,
  }) as ArrayBuffer;
  return new Uint8Array(bytes);
}

/** A workbook whose directory sheet holds `count` rows of distinct, hard-to-compress fictitious data. */
export function bigWorkbook(count: number, textLength = 0): Uint8Array {
  let seed = 12345;
  const noise = (length: number) => {
    let text = "";
    while (text.length < length) {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      text += seed.toString(36);
    }
    return text.slice(0, length);
  };
  const rows: RowSpec[] = [];
  for (let index = 0; index < count; index += 1) {
    rows.push(
      directoryRow({
        Csoport: `Csoport ${index % 7}`,
        Család: `Család ${index}`,
        "Szülő neve": `Szülő ${noise(10)}`,
        "E-mail": `szulo${index}@example.test`,
        Telefon: "+36 30 555 1212",
        Helység: noise(12),
        "Opcionális profil": textLength > 0 ? noise(textLength) : undefined,
        Hozzájárulás: "igen",
      }),
    );
  }
  return buildWorkbook({ rows: { [DIRECTORY_SHEET]: rows } });
}

type ZipPart = { name: string; data: Uint8Array; declaredBytes?: number; stored?: boolean };

/**
 * Writes a ZIP file. `declaredBytes` lets a part declare a different uncompressed size than it has (a
 * zip bomb's directory); `stored` keeps the data uncompressed (to reach an exact file size).
 */
export function buildZip(parts: readonly ZipPart[]): Uint8Array {
  const chunks: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const part of parts) {
    const name = Buffer.from(part.name, "utf8");
    const raw = Buffer.from(part.data);
    const body = part.stored ? raw : deflateRawSync(raw);
    const checksum = crc32(raw);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(part.stored ? 0 : 8, 8);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(name.length, 26);
    chunks.push(local, name, body);
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(20, 4);
    entry.writeUInt16LE(20, 6);
    entry.writeUInt16LE(part.stored ? 0 : 8, 10);
    entry.writeUInt32LE(checksum, 16);
    entry.writeUInt32LE(body.length, 20);
    entry.writeUInt32LE(part.declaredBytes ?? raw.length, 24);
    entry.writeUInt16LE(name.length, 28);
    entry.writeUInt32LE(offset, 42);
    central.push(entry, name);
    offset += local.length + name.length + body.length;
  }
  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(parts.length, 8);
  end.writeUInt16LE(parts.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...chunks, directory, end]));
}

const MINIMAL_PARTS: ZipPart[] = [
  { name: "[Content_Types].xml", data: Buffer.from("<Types/>") },
  { name: "xl/workbook.xml", data: Buffer.from("<workbook/>") },
];

/** A ZIP with the two workbook parts and a stored padding part, so that the file has exactly `size` bytes. */
export function zipOfSize(size: number): Uint8Array {
  const base = buildZip([
    ...MINIMAL_PARTS,
    { name: "padding.bin", data: Buffer.alloc(0), stored: true },
  ]);
  const padding = Buffer.alloc(size - base.length);
  return buildZip([...MINIMAL_PARTS, { name: "padding.bin", data: padding, stored: true }]);
}

/** A zip bomb: a small file whose directory declares a part of 60 MB (the data itself is tiny). */
export function zipBomb(declaredBytes = 60 * 1024 * 1024): Uint8Array {
  return buildZip([
    ...MINIMAL_PARTS,
    { name: "xl/worksheets/sheet1.xml", data: Buffer.alloc(1024), declaredBytes },
  ]);
}

/** The names of all 17 sheets, for tests that remove or rename one. */
export const ALL_SHEETS: readonly string[] = REQUIRED_SHEETS;
