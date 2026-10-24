/**
 * The workbook template and the sheet registry (BR41.2, BR41.10, answer Q5). The workbook structure is
 * defined by the application: the owner converts the old workbook into this template once, by hand, and
 * the fictitious test workbook is generated from it. Row 1 of each interactive sheet holds exactly the
 * header texts below, in this order; the nine archive sheets only have to exist. Dates and times are
 * written `YYYY-MM-DD HH:mm` in Budapest time; the consent column holds `igen` or `nem`.
 *
 * The registry (names, mode, destination and owner process) is the old 17-sheet registry carried over; the
 * database table `sheet_registry` is seeded from the same list, and a test keeps the two in step.
 */

/** The header row of the parent directory sheet (one row per parent or child; rows of one family share Csoport and Család). */
export const DIRECTORY_HEADERS: readonly string[] = Object.freeze([
  "Csoport",
  "Család",
  "Szülő neve",
  "E-mail",
  "Telefon",
  "Helység",
  "Gyermek neve",
  "Opcionális profil",
  "Hozzájárulás",
]);

/** The header row of the seven task sheets (one row per task and assigned family). */
export const TASK_HEADERS: readonly string[] = Object.freeze([
  "Csoport",
  "Esemény",
  "Feladat",
  "Kategória",
  "Kezdés",
  "Befejezés",
  "Helyszín",
  "Létszám",
  "Család",
]);

export type SheetMode = "interactive" | "read_only_archive";

export type SheetEntry = Readonly<{
  /** The sheet name exactly as it appears in the workbook. */
  sheet: string;
  mode: SheetMode;
  /** Where the sheet's rows go (a short English description, as in the old registry). */
  destination: string;
  /** The named owner process of the sheet's subject. */
  ownerLabel: string;
  /** The header row of an interactive sheet; empty for an archive sheet. */
  headers: readonly string[];
}>;

const entry = (
  sheet: string,
  mode: SheetMode,
  ownerLabel: string,
  destination: string,
  headers: readonly string[],
): SheetEntry => Object.freeze({ sheet, mode, ownerLabel, destination, headers });

/** The parent directory sheet, the only interactive sheet with the directory headers. */
export const DIRECTORY_SHEET = "Szülők elérhetősége";

const taskSheet = (sheet: string, destination: string) =>
  entry(sheet, "interactive", "coordination-core", destination, TASK_HEADERS);
const archive = (sheet: string, ownerLabel: string, destination: string) =>
  entry(sheet, "read_only_archive", ownerLabel, destination, []);

/** The 17 sheets of the workbook: 8 interactive and 9 read-only archive, in the order of the old registry. */
export const SHEET_REGISTRY: readonly SheetEntry[] = Object.freeze([
  entry(
    DIRECTORY_SHEET,
    "interactive",
    "family-directory",
    "Parent and family directory",
    DIRECTORY_HEADERS,
  ),
  taskSheet("Kinti - benti takarítás 2025-26", "Cleaning assignments"),
  taskSheet("Állatos hétvégi beosztás 2025-2", "Weekend animal assignments"),
  taskSheet("Vízhordás 2025-26", "Water-carrying assignments"),
  archive("ÁLLATOK", "super-admin", "Animal procedure archive"),
  taskSheet("Gödöllői Bazár 2025", "Bazaar event tasks"),
  archive("Állatok etetése info", "super-admin", "Feeding information archive"),
  taskSheet("Nagytakarítás", "Large-cleaning assignments"),
  archive("Nagytakarítás szervezés", "super-admin", "Cleaning organization archive"),
  taskSheet("Állatos beosztás 2025 Nyári szü", "Summer animal assignments"),
  archive("Hajó javítás", "super-admin", "Maintenance archive"),
  archive("Munkacsoportok", "workgroup-organizer", "Workgroup membership archive"),
  taskSheet("Nyárünnep 2026", "Summer festival event tasks"),
  archive("Kertfejlesztés", "super-admin", "Garden development archive"),
  archive(
    "Kert- és bazárpénzek",
    "kindergarten-finance-owner",
    "Historic finance archive; reconciliation uses the named finance process",
  ),
  archive(
    "Könyvtár",
    "kindergarten-library-owner",
    "Library archive; lending uses the named library process",
  ),
  archive(
    "Vízvizsgálat",
    "water-test-organizer",
    "Family cost-share archive; payment uses the named water-test process",
  ),
]);

/** The sheet names, in registry order. */
export const REQUIRED_SHEETS: readonly string[] = Object.freeze(
  SHEET_REGISTRY.map((sheet) => sheet.sheet),
);

/** The registry entry of a sheet name, or undefined. */
export function sheetEntry(name: string): SheetEntry | undefined {
  return SHEET_REGISTRY.find((candidate) => candidate.sheet === name);
}
