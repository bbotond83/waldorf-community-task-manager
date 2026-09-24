export interface ImportRow { sourceKey: string; payload: Record<string, string>; changed: boolean; containsOptionalProfile: boolean; consentGranted: boolean; }
export interface ImportPreview { id: string; fingerprint: string; rows: ReadonlyArray<ImportRow>; changedRows: string[]; state: "preview" | "committed" | "rolled_back"; }
export interface ImportResult { previewId: string; importedRows: number; changedRows: string[]; }
export interface ImportConflict { id: string; previewId: string; sourceKey: string; state: "open" | "resolved"; }
export const REQUIRED_SHEETS = ["Szülők elérhetősége","Kinti - benti takarítás 2025-26","Állatos hétvégi beosztás 2025-2","Vízhordás 2025-26","ÁLLATOK","Gödöllői Bazár 2025","Állatok etetése info","Nagytakarítás","Nagytakarítás szervezés","Állatos beosztás 2025 Nyári szü","Hajó javítás","Munkacsoportok","Nyárünnep 2026","Kertfejlesztés","Kert- és bazárpénzek","Könyvtár","Vízvizsgálat"] as const;
export type LegacyDestination = { mode: "interactive" | "read_only_archive" | "external_process"; owner: string; destination: string };
export const LEGACY_DESTINATIONS: Record<(typeof REQUIRED_SHEETS)[number], LegacyDestination> = {
  "Szülők elérhetősége": { mode: "interactive", owner: "family-directory", destination: "Parent and family directory" },
  "Kinti - benti takarítás 2025-26": { mode: "interactive", owner: "coordination-core", destination: "Cleaning assignments" },
  "Állatos hétvégi beosztás 2025-2": { mode: "interactive", owner: "coordination-core", destination: "Weekend animal assignments" },
  "Vízhordás 2025-26": { mode: "interactive", owner: "coordination-core", destination: "Water-carrying assignments" },
  "ÁLLATOK": { mode: "read_only_archive", owner: "kindergarten-admin", destination: "Animal procedure archive" },
  "Gödöllői Bazár 2025": { mode: "interactive", owner: "coordination-core", destination: "Bazaar event tasks" },
  "Állatok etetése info": { mode: "read_only_archive", owner: "kindergarten-admin", destination: "Feeding information archive" },
  "Nagytakarítás": { mode: "interactive", owner: "coordination-core", destination: "Large-cleaning assignments" },
  "Nagytakarítás szervezés": { mode: "read_only_archive", owner: "kindergarten-admin", destination: "Cleaning organization archive" },
  "Állatos beosztás 2025 Nyári szü": { mode: "interactive", owner: "coordination-core", destination: "Summer animal assignments" },
  "Hajó javítás": { mode: "read_only_archive", owner: "kindergarten-admin", destination: "Maintenance archive" },
  "Munkacsoportok": { mode: "read_only_archive", owner: "workgroup-organizer", destination: "Workgroup membership archive" },
  "Nyárünnep 2026": { mode: "interactive", owner: "coordination-core", destination: "Summer festival event tasks" },
  "Kertfejlesztés": { mode: "read_only_archive", owner: "kindergarten-admin", destination: "Garden development archive" },
  "Kert- és bazárpénzek": { mode: "read_only_archive", owner: "kindergarten-finance-owner", destination: "Historic finance archive; reconciliation uses the named finance process" },
  "Könyvtár": { mode: "read_only_archive", owner: "kindergarten-library-owner", destination: "Library archive; lending uses the named library process" },
  "Vízvizsgálat": { mode: "read_only_archive", owner: "water-test-organizer", destination: "Family cost-share archive; payment uses the named water-test process" },
};
export interface ImportRepository { transaction<T>(operation: () => T): T; findPreview(id: string): ImportPreview | undefined; savePreview(preview: ImportPreview): void; saveSheetRegistry(previewId: string, sheetIds: readonly string[], destinations: Record<string, LegacyDestination>): void; saveConflicts(conflicts: readonly ImportConflict[]): void; listConflicts(previewId: string): ImportConflict[]; resolveConflict(id: string): void; stage(rows: ReadonlyArray<ImportRow>): void; publish(previewId: string): void; reconcile(previewId: string): void; }
export class ImportValidationError extends Error {}
export class ImportConflictError extends Error {}
export class ImportService {
  private readonly repository: ImportRepository;
  constructor(repository: ImportRepository) { this.repository = repository; }
  createPreview(input: { id: string; sheetIds: string[]; rows: ImportRow[]; conflicts?: Array<Omit<ImportConflict, "previewId" | "state">> }): ImportPreview { validateSheetRegistry(input.sheetIds); validateRows(input.rows); const preview: ImportPreview = { id: input.id, fingerprint: fingerprint(input.rows), rows: input.rows.map((row) => ({ ...row, payload: { ...row.payload } })), changedRows: input.rows.filter((row) => row.changed).map((row) => row.sourceKey), state: "preview" }; this.repository.transaction(() => { this.repository.savePreview(preview); this.repository.saveSheetRegistry(preview.id, input.sheetIds, LEGACY_DESTINATIONS); this.repository.saveConflicts((input.conflicts ?? []).map((conflict) => ({ ...conflict, previewId: preview.id, state: "open" }))); }); return preview; }
  resolveConflict(input: { conflictId: string; previewId: string; authorized: boolean }): void { const conflict = this.repository.listConflicts(input.previewId).find((item) => item.id === input.conflictId); if (!conflict || !canResolveConflict(input.authorized, conflict)) throw new ImportConflictError("Az importütközés nem oldható fel."); this.repository.resolveConflict(conflict.id); }
  commit(input: { previewId: string; fingerprint: string }): ImportResult { const preview = this.repository.findPreview(input.previewId); if (!preview || preview.state !== "preview" || preview.fingerprint !== input.fingerprint) throw new ImportConflictError("Az import előnézet már nem érvényes."); if (this.repository.listConflicts(preview.id).some((conflict) => conflict.state === "open")) throw new ImportConflictError("Az import előnézet nyitott ütközéseket tartalmaz."); return this.repository.transaction(() => { this.repository.stage(preview.rows); this.repository.publish(preview.id); this.repository.savePreview({ ...preview, state: "committed" }); return { previewId: preview.id, importedRows: preview.rows.length, changedRows: preview.changedRows }; }); }
  rollback(previewId: string): void { const preview = this.repository.findPreview(previewId); if (!preview || preview.state !== "committed") throw new ImportConflictError("Az import nem állítható vissza."); this.repository.transaction(() => { this.repository.reconcile(previewId); this.repository.savePreview({ ...preview, state: "rolled_back" }); }); }
}
export function validateSheetRegistry(sheetIds: string[]): void { if (sheetIds.length !== REQUIRED_SHEETS.length || REQUIRED_SHEETS.some((sheet) => !sheetIds.includes(sheet))) throw new ImportValidationError("A 17 lapos leképezési nyilvántartás hiányos."); }
export function canResolveConflict(authorized: boolean, conflict: ImportConflict): boolean { return authorized && conflict.state === "open"; }
function validateRows(rows: ImportRow[]): void { if (rows.length > 100000) throw new ImportValidationError("A fájl túl nagy."); for (const row of rows) { if (!row.sourceKey || row.sourceKey.length > 256) throw new ImportValidationError("Hiányzó stabil forrásazonosító."); if (row.containsOptionalProfile && !row.consentGranted) throw new ImportValidationError("Az opcionális profil importjához hozzájárulás szükséges."); for (const value of Object.values(row.payload)) if (value.length > 10000 || /^[=+@]/.test(value)) throw new ImportValidationError("Nem biztonságos cellatartalom."); } }
function fingerprint(rows: ImportRow[]): string { return JSON.stringify(rows.map((row) => [row.sourceKey, Object.fromEntries(Object.entries(row.payload).sort(([a], [b]) => a.localeCompare(b))), row.changed, row.containsOptionalProfile, row.consentGranted]).sort(([a], [b]) => String(a).localeCompare(String(b)))); }
