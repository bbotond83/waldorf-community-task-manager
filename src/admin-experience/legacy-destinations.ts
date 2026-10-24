/**
 * The old 17-sheet destination table, moved here unchanged from the removed demo-era `src/import-migration`
 * (U4 step 26, ledger row N18). It only serves the synthetic archive presentation of `admin-service.ts`, which
 * stays until U5; the real import reads its sheet list from `src/import-parser/template.ts` and the
 * `sheet_registry` table, and a test keeps those two in step.
 */
export const REQUIRED_SHEETS = ["Szülők elérhetősége","Kinti - benti takarítás 2025-26","Állatos hétvégi beosztás 2025-2","Vízhordás 2025-26","ÁLLATOK","Gödöllői Bazár 2025","Állatok etetése info","Nagytakarítás","Nagytakarítás szervezés","Állatos beosztás 2025 Nyári szü","Hajó javítás","Munkacsoportok","Nyárünnep 2026","Kertfejlesztés","Kert- és bazárpénzek","Könyvtár","Vízvizsgálat"] as const;
export type LegacyDestination = { mode: "interactive" | "read_only_archive" | "external_process"; owner: string; destination: string };
export const LEGACY_DESTINATIONS: Record<(typeof REQUIRED_SHEETS)[number], LegacyDestination> = {
  "Szülők elérhetősége": { mode: "interactive", owner: "family-directory", destination: "Parent and family directory" },
  "Kinti - benti takarítás 2025-26": { mode: "interactive", owner: "coordination-core", destination: "Cleaning assignments" },
  "Állatos hétvégi beosztás 2025-2": { mode: "interactive", owner: "coordination-core", destination: "Weekend animal assignments" },
  "Vízhordás 2025-26": { mode: "interactive", owner: "coordination-core", destination: "Water-carrying assignments" },
  "ÁLLATOK": { mode: "read_only_archive", owner: "super-admin", destination: "Animal procedure archive" },
  "Gödöllői Bazár 2025": { mode: "interactive", owner: "coordination-core", destination: "Bazaar event tasks" },
  "Állatok etetése info": { mode: "read_only_archive", owner: "super-admin", destination: "Feeding information archive" },
  "Nagytakarítás": { mode: "interactive", owner: "coordination-core", destination: "Large-cleaning assignments" },
  "Nagytakarítás szervezés": { mode: "read_only_archive", owner: "super-admin", destination: "Cleaning organization archive" },
  "Állatos beosztás 2025 Nyári szü": { mode: "interactive", owner: "coordination-core", destination: "Summer animal assignments" },
  "Hajó javítás": { mode: "read_only_archive", owner: "super-admin", destination: "Maintenance archive" },
  "Munkacsoportok": { mode: "read_only_archive", owner: "workgroup-organizer", destination: "Workgroup membership archive" },
  "Nyárünnep 2026": { mode: "interactive", owner: "coordination-core", destination: "Summer festival event tasks" },
  "Kertfejlesztés": { mode: "read_only_archive", owner: "super-admin", destination: "Garden development archive" },
  "Kert- és bazárpénzek": { mode: "read_only_archive", owner: "kindergarten-finance-owner", destination: "Historic finance archive; reconciliation uses the named finance process" },
  "Könyvtár": { mode: "read_only_archive", owner: "kindergarten-library-owner", destination: "Library archive; lending uses the named library process" },
  "Vízvizsgálat": { mode: "read_only_archive", owner: "water-test-organizer", destination: "Family cost-share archive; payment uses the named water-test process" },
};
