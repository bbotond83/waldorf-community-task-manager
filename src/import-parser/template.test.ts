import assert from "node:assert/strict";
import test from "node:test";
import {
  DIRECTORY_HEADERS,
  DIRECTORY_SHEET,
  IMPORT_LIMITS,
  PHONE_PATTERN,
  REQUIRED_SHEETS,
  SHEET_REGISTRY,
  sheetEntry,
  TASK_HEADERS,
  UNSAFE_CELL_PREFIXES,
} from "./index.ts";

/** The names the old 17-sheet registry carried (ledger N18), written out so a rename cannot pass silently. */
const EXPECTED_SHEETS = [
  "Szülők elérhetősége",
  "Kinti - benti takarítás 2025-26",
  "Állatos hétvégi beosztás 2025-2",
  "Vízhordás 2025-26",
  "ÁLLATOK",
  "Gödöllői Bazár 2025",
  "Állatok etetése info",
  "Nagytakarítás",
  "Nagytakarítás szervezés",
  "Állatos beosztás 2025 Nyári szü",
  "Hajó javítás",
  "Munkacsoportok",
  "Nyárünnep 2026",
  "Kertfejlesztés",
  "Kert- és bazárpénzek",
  "Könyvtár",
  "Vízvizsgálat",
];

test("the registry holds exactly the 17 sheets of the workbook, eight interactive and nine archive", () => {
  assert.deepEqual([...REQUIRED_SHEETS], EXPECTED_SHEETS);
  assert.equal(new Set(REQUIRED_SHEETS).size, 17);
  assert.equal(SHEET_REGISTRY.filter((sheet) => sheet.mode === "interactive").length, 8);
  assert.equal(SHEET_REGISTRY.filter((sheet) => sheet.mode === "read_only_archive").length, 9);
});

test("every sheet names a destination and an owner process, and only interactive sheets have headers", () => {
  for (const sheet of SHEET_REGISTRY) {
    assert.ok(sheet.destination.length > 0, sheet.sheet);
    assert.ok(sheet.ownerLabel.length > 0, sheet.sheet);
    assert.equal(sheet.headers.length > 0, sheet.mode === "interactive", sheet.sheet);
  }
});

test("the directory sheet has the directory headers and the seven task sheets the task headers", () => {
  assert.deepEqual([...sheetEntry(DIRECTORY_SHEET)!.headers], [...DIRECTORY_HEADERS]);
  assert.equal(sheetEntry(DIRECTORY_SHEET)!.ownerLabel, "family-directory");
  const taskSheets = SHEET_REGISTRY.filter(
    (sheet) => sheet.mode === "interactive" && sheet.sheet !== DIRECTORY_SHEET,
  );
  assert.equal(taskSheets.length, 7);
  for (const sheet of taskSheets) {
    assert.deepEqual([...sheet.headers], [...TASK_HEADERS], sheet.sheet);
    assert.equal(sheet.ownerLabel, "coordination-core");
  }
  assert.equal(DIRECTORY_HEADERS.length, 9);
  assert.equal(TASK_HEADERS.length, 9);
});

test("the old owner processes of the finance, library and water-test sheets are kept", () => {
  assert.equal(sheetEntry("Kert- és bazárpénzek")!.ownerLabel, "kindergarten-finance-owner");
  assert.equal(sheetEntry("Könyvtár")!.ownerLabel, "kindergarten-library-owner");
  assert.equal(sheetEntry("Vízvizsgálat")!.ownerLabel, "water-test-organizer");
  assert.equal(sheetEntry("Munkacsoportok")!.ownerLabel, "workgroup-organizer");
  assert.equal(sheetEntry("Nincs ilyen lap"), undefined);
});

test("the registry and its entries cannot be changed by a caller", () => {
  assert.ok(Object.isFrozen(SHEET_REGISTRY));
  assert.ok(Object.isFrozen(SHEET_REGISTRY[0]));
  assert.ok(Object.isFrozen(REQUIRED_SHEETS));
});

test("the limits are the design's: 5 MB file, 6 MB body, 50 MB expanded, 20000 and 100000 rows, 10000 characters", () => {
  assert.equal(IMPORT_LIMITS.maxFileBytes, 5_242_880);
  assert.equal(IMPORT_LIMITS.maxBodyBytes, 6_291_456);
  assert.ok(IMPORT_LIMITS.maxBodyBytes > IMPORT_LIMITS.maxFileBytes);
  assert.equal(IMPORT_LIMITS.maxUncompressedBytes, 52_428_800);
  assert.equal(IMPORT_LIMITS.maxRowsPerSheet, 20000);
  assert.equal(IMPORT_LIMITS.maxRowsTotal, 100000);
  assert.equal(IMPORT_LIMITS.maxCellCharacters, 10000);
  assert.ok(Object.isFrozen(IMPORT_LIMITS));
});

test("a text cell starting with =, + or @ is unsafe, and the phone rule accepts a plus at the start", () => {
  assert.deepEqual([...UNSAFE_CELL_PREFIXES], ["=", "+", "@"]);
  assert.ok(PHONE_PATTERN.test("+36 30 123 4567"));
  assert.ok(PHONE_PATTERN.test("06-30-123-4567"));
  assert.equal(PHONE_PATTERN.test("12345"), false, "too short");
  assert.equal(PHONE_PATTERN.test("+36 30 123 4567 8901 2345"), false, "too long");
  assert.equal(PHONE_PATTERN.test("=1+1+1+1+1"), false, "a formula is not a phone number");
  assert.equal(PHONE_PATTERN.test("+36 (30) 123"), false, "brackets are not allowed");
});
