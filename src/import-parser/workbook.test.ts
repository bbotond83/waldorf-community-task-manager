import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  ALL_SHEETS,
  bigWorkbook,
  buildWorkbook,
  buildZip,
  directoryRow,
  fictitiousRows,
  taskRow,
  zipBomb,
  zipOfSize,
} from "../../tests/support/workbook.ts";
import { IMPORT_LIMITS } from "./limits.ts";
import { DIRECTORY_SHEET, TASK_HEADERS } from "./template.ts";
import { parseWorkbook, type ParseResult } from "./workbook.ts";

const TASK_SHEET = "Kinti - benti takarítás 2025-26";
const ARCHIVE_SHEET = "ÁLLATOK";

const failure = (result: ParseResult) => {
  assert.equal(result.ok, false, "expected the workbook to be refused");
  return (result as Extract<ParseResult, { ok: false }>).code;
};
const success = (result: ParseResult) => {
  assert.equal(result.ok, true, result.ok ? "" : `refused with ${result.code}: ${result.detail}`);
  return result as Extract<ParseResult, { ok: true }>;
};
const withRows = (directory: ReturnType<typeof directoryRow>[]) => ({
  ...fictitiousRows(),
  [DIRECTORY_SHEET]: directory,
});

test("reads the fictitious workbook into the rows import_preview_create expects (BR41.2, BR41.11)", () => {
  const result = success(parseWorkbook(buildWorkbook()));
  const directory = result.rows.filter((row) => row.sheet === DIRECTORY_SHEET);
  assert.deepEqual(
    directory.map((row) => row.row),
    [2, 3, 4],
    "row numbers are the workbook's own",
  );
  assert.deepEqual(directory[0], {
    sheet: DIRECTORY_SHEET,
    row: 2,
    values: {
      Csoport: "Bükköny",
      Család: "Mézes család",
      "Szülő neve": "Mézes Márta",
      "E-mail": "marta@example.test",
      Telefon: "+36 20 333 4444",
      Helység: "Pécs",
      "Opcionális profil": "Szeret főzni.",
      Hozzájárulás: "igen",
    },
  });
  const tasks = result.rows.filter((row) => row.sheet === TASK_SHEET);
  assert.equal(tasks.length, 2);
  assert.equal(tasks[0]!.values!["Létszám"], "2", "a number cell becomes its text");
  assert.equal(tasks[0]!.values!["Kezdés"], "2026-12-10 10:00");
  assert.equal("Család" in tasks[1]!.values!, false, "an empty cell is left out");
  assert.ok(result.rows.every((row) => row.warnings === undefined || row.warnings > 0));
});

test("archive sheets give only their rows' places and never copy content (BR41.10)", () => {
  const result = success(parseWorkbook(buildWorkbook({ archiveRows: 3 })));
  const archive = result.rows.filter((row) => row.sheet === ARCHIVE_SHEET);
  assert.deepEqual(archive, [
    { sheet: ARCHIVE_SHEET, row: 1 },
    { sheet: ARCHIVE_SHEET, row: 2 },
    { sheet: ARCHIVE_SHEET, row: 3 },
  ]);
  assert.equal(
    result.rows.filter((row) => !("values" in row)).length,
    9 * 3,
    "nine archive sheets of three rows",
  );
  assert.equal(JSON.stringify(archive).includes("Jegyzet"), false);
});

test("keeps a phone that starts with a plus, drops an invalid phone and counts it as a warning of its row (BR41.2)", () => {
  const result = success(parseWorkbook(buildWorkbook()));
  const rows = result.rows.filter((row) => row.sheet === DIRECTORY_SHEET);
  assert.equal(rows[0]!.values!["Telefon"], "+36 20 333 4444");
  assert.equal("Telefon" in rows[2]!.values!, false, "'nincs' is not a phone number");
  assert.equal(rows[2]!.warnings, 1);
  assert.equal(result.droppedPhones, 1);
  assert.equal(result.warnings, 1);

  const odd = success(
    parseWorkbook(
      buildWorkbook({
        rows: withRows([
          directoryRow({ Csoport: "A", Család: "Tesztcsalád", Telefon: "=1+1" }),
          directoryRow({ Csoport: "A", Család: "Tesztcsalád 2", Telefon: "12345" }),
          directoryRow({ Csoport: "A", Család: "Tesztcsalád 3", Telefon: "06 30 123-4567" }),
        ]),
      }),
    ),
  );
  const phones = odd.rows
    .filter((row) => row.sheet === DIRECTORY_SHEET)
    .map((row) => row.values!["Telefon"]);
  assert.deepEqual(
    phones,
    [undefined, undefined, "06 30 123-4567"],
    "text that is not a phone is dropped, not unsafe",
  );
  assert.equal(odd.droppedPhones, 2);
});

test("stages the optional profile only with the consent mark igen and counts the dropped ones (BR41.2)", () => {
  const result = success(
    parseWorkbook(
      buildWorkbook({
        rows: withRows([
          directoryRow({
            Csoport: "A",
            Család: "Egy",
            "Opcionális profil": "Titok 1",
            Hozzájárulás: "igen",
          }),
          directoryRow({
            Csoport: "A",
            Család: "Kettő",
            "Opcionális profil": "Titok 2",
            Hozzájárulás: "nem",
          }),
          directoryRow({ Csoport: "A", Család: "Három", "Opcionális profil": "Titok 3" }),
          directoryRow({
            Csoport: "A",
            Család: "Négy",
            "Opcionális profil": "Titok 4",
            Hozzájárulás: "IGEN",
          }),
        ]),
      }),
    ),
  );
  const rows = result.rows.filter((row) => row.sheet === DIRECTORY_SHEET);
  assert.deepEqual(
    rows.map((row) => row.values!["Opcionális profil"]),
    ["Titok 1", undefined, undefined, "Titok 4"],
  );
  assert.deepEqual(
    rows.map((row) => row.warnings),
    [undefined, 1, 1, undefined],
  );
  assert.equal(result.droppedProfiles, 2);
  assert.equal(
    JSON.stringify(result.rows).includes("Titok 2"),
    false,
    "the dropped text is not in the output",
  );
});

test("skips empty rows, trims cells and keeps the workbook's own row numbers (BR41.2)", () => {
  const result = success(
    parseWorkbook(
      buildWorkbook({
        rows: withRows([
          directoryRow({ Csoport: "  Bükköny ", Család: " Egy család  " }),
          [],
          directoryRow({ Csoport: "   ", Család: "" }),
          directoryRow({ Csoport: "Bükköny", Család: "Másik család" }),
        ]),
      }),
    ),
  );
  const rows = result.rows.filter((row) => row.sheet === DIRECTORY_SHEET);
  assert.deepEqual(
    rows.map((row) => [row.row, row.values!["Csoport"], row.values!["Család"]]),
    [
      [2, "Bükköny", "Egy család"],
      [5, "Bükköny", "Másik család"],
    ],
  );
});

test("refuses what is not a readable .xlsx before anything else (IMPORT_MALFORMED)", () => {
  assert.equal(failure(parseWorkbook(new Uint8Array())), "IMPORT_MALFORMED");
  assert.equal(
    failure(parseWorkbook(new TextEncoder().encode("Csoport;Család\nA;B\n"))),
    "IMPORT_MALFORMED",
  );
  assert.equal(
    failure(parseWorkbook(buildZip([{ name: "readme.txt", data: Buffer.from("hello") }]))),
    "IMPORT_MALFORMED",
  );
  const good = buildWorkbook();
  assert.equal(
    failure(parseWorkbook(good.slice(0, good.length - 40))),
    "IMPORT_MALFORMED",
    "a truncated file",
  );
  const flipped = new Uint8Array(good);
  flipped.fill(0, 0, 4);
  assert.equal(failure(parseWorkbook(flipped)), "IMPORT_MALFORMED", "a damaged signature");
  // A file bigger than the limit that is not a workbook is malformed first: the format check comes first.
  assert.equal(
    failure(parseWorkbook(new Uint8Array(IMPORT_LIMITS.maxFileBytes + 10))),
    "IMPORT_MALFORMED",
  );
});

test("accepts a file of exactly 5 MB and refuses 5 MB plus one byte and 6 MB (BR41.2, NFR1.48)", () => {
  const atLimit = zipOfSize(IMPORT_LIMITS.maxFileBytes);
  assert.equal(atLimit.length, 5 * 1024 * 1024);
  assert.notEqual(
    failure(parseWorkbook(atLimit)),
    "IMPORT_OVERSIZED",
    "the size alone does not refuse it",
  );
  assert.equal(
    failure(parseWorkbook(zipOfSize(IMPORT_LIMITS.maxFileBytes + 1))),
    "IMPORT_OVERSIZED",
  );
  assert.equal(failure(parseWorkbook(zipOfSize(IMPORT_LIMITS.maxBodyBytes))), "IMPORT_OVERSIZED");
});

test("refuses a zip bomb from its directory, without expanding it (BR41.2, NFR1.48)", () => {
  const bomb = zipBomb();
  assert.ok(bomb.length < 5000, "the file itself is tiny");
  const started = performance.now();
  assert.equal(failure(parseWorkbook(bomb)), "IMPORT_OVERSIZED");
  assert.ok(performance.now() - started < 1000, "refused at once");
  // The same file just under the limit is not refused for its size.
  assert.notEqual(
    failure(parseWorkbook(zipBomb(IMPORT_LIMITS.maxUncompressedBytes - 5000))),
    "IMPORT_OVERSIZED",
  );
  // A ZIP64 marker is too large for a workbook.
  const marker = zipBomb(0xffffffff);
  assert.equal(failure(parseWorkbook(marker)), "IMPORT_OVERSIZED");
});

test("refuses a sheet that declares more than 20000 rows and a workbook of more than 100000 (BR41.2)", () => {
  const atLimit = success(
    parseWorkbook(buildWorkbook({ cells: { [DIRECTORY_SHEET]: { A20000: "Csoport" } } })),
  );
  assert.ok(atLimit.rows.some((row) => row.row === 20000));
  assert.equal(
    failure(parseWorkbook(buildWorkbook({ cells: { [DIRECTORY_SHEET]: { A20001: "Csoport" } } }))),
    "IMPORT_OVERSIZED",
  );
  const cells = Object.fromEntries(ALL_SHEETS.slice(0, 6).map((sheet) => [sheet, { A20000: "x" }]));
  assert.equal(
    failure(parseWorkbook(buildWorkbook({ cells }))),
    "IMPORT_OVERSIZED",
    "six sheets of 20000 rows",
  );
});

test("refuses a workbook that lacks one of the 17 registered sheets (IMPORT_MISSING_SHEET)", () => {
  for (const missing of [DIRECTORY_SHEET, TASK_SHEET, ARCHIVE_SHEET, "Vízvizsgálat"]) {
    assert.equal(
      failure(parseWorkbook(buildWorkbook({ omitSheets: [missing] }))),
      "IMPORT_MISSING_SHEET",
      missing,
    );
  }
  const detail = parseWorkbook(buildWorkbook({ omitSheets: ["Könyvtár"] }));
  assert.equal(
    detail.ok === false && detail.detail.includes("Könyvtár"),
    true,
    "the message names the sheet",
  );
});

test("refuses a header row that is not exactly the template's (IMPORT_MISSING_HEADER)", () => {
  const renamed = [...TASK_HEADERS];
  renamed[2] = "Munka";
  const swapped = [...TASK_HEADERS];
  [swapped[0], swapped[1]] = [swapped[1]!, swapped[0]!];
  for (const headers of [
    renamed,
    swapped,
    TASK_HEADERS.slice(0, 8),
    [...TASK_HEADERS, "Megjegyzés"],
  ]) {
    assert.equal(
      failure(parseWorkbook(buildWorkbook({ headers: { [TASK_SHEET]: headers } }))),
      "IMPORT_MISSING_HEADER",
      headers.join("|"),
    );
  }
  assert.equal(
    failure(
      parseWorkbook(buildWorkbook({ headers: { [DIRECTORY_SHEET]: ["Csoport", "Család"] } })),
    ),
    "IMPORT_MISSING_HEADER",
  );
});

test("refuses formula cells, cells over 10000 characters and text that starts with = + or @ outside a phone column (IMPORT_UNSAFE_CELL)", () => {
  const unsafe = (value: unknown, column = "Család") =>
    parseWorkbook(
      buildWorkbook({
        rows: withRows([directoryRow({ Csoport: "A", [column]: value as string })]),
      }),
    );
  assert.equal(failure(unsafe({ formula: "1+1" })), "IMPORT_UNSAFE_CELL", "a formula cell");
  assert.equal(
    failure(unsafe({ formula: "1+1" }, "Telefon")),
    "IMPORT_UNSAFE_CELL",
    "even in a phone column",
  );
  assert.equal(failure(unsafe("x".repeat(10001))), "IMPORT_UNSAFE_CELL");
  assert.equal(failure(unsafe("x".repeat(10001), "Telefon")), "IMPORT_UNSAFE_CELL");
  for (const text of ['=HYPERLINK("http://a.test")', "+36 20 1", "@SUM(A1)", "  =1+1"]) {
    assert.equal(failure(unsafe(text)), "IMPORT_UNSAFE_CELL", text);
  }
  assert.equal(
    failure(unsafe("=1+1", "Szülő neve")),
    "IMPORT_UNSAFE_CELL",
    "the name column is not a phone column",
  );
  success(unsafe("x".repeat(10000)));
  success(unsafe("Fenyő - a család; 1+1 = 2"));
  const taskCell = parseWorkbook(
    buildWorkbook({
      rows: {
        ...fictitiousRows(),
        [TASK_SHEET]: [
          taskRow({
            Csoport: "A",
            Feladat: "@parancs",
            Kezdés: "2026-12-10 10:00",
            Befejezés: "2026-12-10 11:00",
            Létszám: 1,
          }),
        ],
      },
    }),
  );
  assert.equal(failure(taskCell), "IMPORT_UNSAFE_CELL", "the task sheets are checked as well");
});

test("runs the checks in the order of the rule and stages nothing when one fails (BR41.2)", () => {
  const badHeader = { [TASK_SHEET]: ["Rossz"] };
  const formula = withRows([directoryRow({ Csoport: "A", Család: { formula: "1+1" } as never })]);
  assert.equal(
    failure(
      parseWorkbook(buildWorkbook({ omitSheets: ["Könyvtár"], headers: badHeader, rows: formula })),
    ),
    "IMPORT_MISSING_SHEET",
    "a missing sheet is reported before a bad header",
  );
  assert.equal(
    failure(parseWorkbook(buildWorkbook({ headers: badHeader, rows: formula }))),
    "IMPORT_MISSING_HEADER",
    "a bad header is reported before an unsafe cell",
  );
  const refused = parseWorkbook(buildWorkbook({ rows: formula }));
  assert.equal("rows" in refused, false, "a refused workbook yields no rows");
});

test("does not judge or copy the content of archive sheets, formulas included (BR41.10)", () => {
  const result = success(
    parseWorkbook(
      buildWorkbook({
        cells: { [ARCHIVE_SHEET]: { B1: { formula: "SUM(A1:A2)" }, A3: "=régi képlet" } },
      }),
    ),
  );
  const archive = result.rows.filter((row) => row.sheet === ARCHIVE_SHEET);
  assert.deepEqual(
    archive.map((row) => row.row),
    [1, 2, 3],
  );
  assert.ok(archive.every((row) => !("values" in row)));
});

test("never evaluates a formula: the cached value does not reach the staged data (BR41.2)", () => {
  const result = parseWorkbook(
    buildWorkbook({
      rows: withRows([directoryRow({ Csoport: "A", Család: { formula: "NOW()" } as never })]),
    }),
  );
  assert.equal(failure(result), "IMPORT_UNSAFE_CELL");
});

test("the parser takes bytes only, imports nothing that reads files, and no code or test reads the owner's real workbook folder (BR41.2, BR41.11)", () => {
  assert.equal(parseWorkbook.length, 1, "one argument: the bytes");
  const parserFiles = readdirSync(new URL(".", import.meta.url)).filter(
    (name) => name.endsWith(".ts") && !name.endsWith(".test.ts"),
  );
  for (const name of parserFiles) {
    const source = readFileSync(new URL(name, import.meta.url), "utf8");
    assert.equal(/from "node:(fs|path)|require\(/.test(source), false, `${name} reads no files`);
    assert.equal(source.includes(["source", "materials"].join("-")), false, name);
  }
  const root = new URL("../../", import.meta.url).pathname;
  const offenders: string[] = [];
  const guardNeedle = ["source", "materials"].join("-");
  const walk = (directory: string) => {
    for (const name of readdirSync(directory)) {
      if (["node_modules", ".next", ".git"].includes(name)) {
        continue;
      }
      const path = join(directory, name);
      if (statSync(path).isDirectory()) {
        walk(path);
      } else if (
        /\.(ts|tsx|mjs|js)$/.test(name) &&
        readFileSync(path, "utf8").includes(guardNeedle)
      ) {
        offenders.push(path.slice(root.length));
      }
    }
  };
  for (const folder of ["src", "app", "tests"]) {
    walk(join(root, folder));
  }
  assert.deepEqual(offenders, [], "no code or test names the owner's real workbook folder");
});

test("only server.ts imports the workbook reader, and only workbook.ts imports the spreadsheet library (NFR2.21)", () => {
  const root = new URL("../../", import.meta.url).pathname;
  const importers = { library: [] as string[], reader: [] as string[] };
  const walk = (directory: string) => {
    for (const name of readdirSync(directory)) {
      if (["node_modules", ".next", ".git"].includes(name)) {
        continue;
      }
      const path = join(directory, name);
      if (statSync(path).isDirectory()) {
        walk(path);
        continue;
      }
      if (!/\.(ts|tsx)$/.test(name) || name.endsWith(".test.ts") || name.endsWith(".test.tsx")) {
        continue;
      }
      const source = readFileSync(path, "utf8");
      if (source.includes('"@e965/xlsx"')) {
        importers.library.push(path.slice(root.length));
      }
      if (/from "[./]+(?:[\w-]+\/)*workbook\.ts"/.test(source) && path.includes("import-parser")) {
        importers.reader.push(path.slice(root.length));
      }
    }
  };
  for (const folder of ["src", "app"]) {
    walk(join(root, folder));
  }
  assert.deepEqual(importers.library, ["src/import-parser/workbook.ts"]);
  assert.deepEqual(importers.reader, ["src/import-parser/server.ts"]);
  assert.match(
    readFileSync(new URL("server.ts", import.meta.url), "utf8"),
    /^import "server-only";/,
  );
});

test("reads the largest workbook, 20000 rows within 5 MB, well inside the 60 second ceiling (NFR1.50, NFR4.16)", () => {
  const bytes = bigWorkbook(IMPORT_LIMITS.maxRowsPerSheet - 1, 100);
  assert.ok(bytes.length <= IMPORT_LIMITS.maxFileBytes, `${bytes.length} bytes is within 5 MB`);
  const started = performance.now();
  const result = success(parseWorkbook(bytes));
  const seconds = (performance.now() - started) / 1000;
  console.log(
    `TIMING parse of ${(bytes.length / 1048576).toFixed(2)} MB, ${result.rows.length} rows: ${seconds.toFixed(2)} s (ceiling 60 s)`,
  );
  assert.ok(seconds < 60, `${seconds} s`);
  assert.equal(
    result.rows.filter((row) => row.sheet === DIRECTORY_SHEET).length,
    IMPORT_LIMITS.maxRowsPerSheet - 1,
  );
});
