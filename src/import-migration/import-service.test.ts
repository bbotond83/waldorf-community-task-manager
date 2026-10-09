import assert from "node:assert/strict";
import test from "node:test";
import { InMemoryImportRepository } from "./in-memory-import-repository.ts";
import { LEGACY_DESTINATIONS, canResolveConflict, ImportConflictError, ImportService, ImportValidationError, REQUIRED_SHEETS, validateSheetRegistry } from "./import-service.ts";
const sheetIds = [...REQUIRED_SHEETS];
const row = (overrides = {}) => ({ sourceKey: "sheet:1", payload: { name: "Family" }, changed: false, containsOptionalProfile: false, consentGranted: false, ...overrides });
test("binds commit to an immutable preview fingerprint and reports changed rows", () => { const repository = new InMemoryImportRepository(); const service = new ImportService(repository); const preview = service.createPreview({ id: "p", sheetIds, rows: [row(), row({ sourceKey: "sheet:2", changed: true })] }); assert.deepEqual(service.commit({ previewId: "p", fingerprint: preview.fingerprint }), { previewId: "p", importedRows: 2, changedRows: ["sheet:2"] }); assert.deepEqual(repository.published, ["p"]); });
test("rejects stale preview bindings without publishing", () => { const repository = new InMemoryImportRepository(); const service = new ImportService(repository); service.createPreview({ id: "p", sheetIds, rows: [row()] }); assert.throws(() => service.commit({ previewId: "p", fingerprint: "stale" }), ImportConflictError); assert.deepEqual(repository.published, []); });
test("requires consent for optional profile imports", () => { const service = new ImportService(new InMemoryImportRepository()); assert.throws(() => service.createPreview({ id: "p", sheetIds, rows: [row({ containsOptionalProfile: true })] }), ImportValidationError); });
test("stages and publishes together with no duplicate preview commit", () => { const repository = new InMemoryImportRepository(); const service = new ImportService(repository); const preview = service.createPreview({ id: "p", sheetIds, rows: [row()] }); service.commit({ previewId: "p", fingerprint: preview.fingerprint }); assert.throws(() => service.commit({ previewId: "p", fingerprint: preview.fingerprint }), ImportConflictError); assert.equal(repository.staged.length, 1); });
test("reconciles staged visibility after a committed import rollback", () => { const repository = new InMemoryImportRepository(); const service = new ImportService(repository); const preview = service.createPreview({ id: "p", sheetIds, rows: [row()] }); service.commit({ previewId: "p", fingerprint: preview.fingerprint }); service.rollback("p"); assert.deepEqual(repository.reconciled, ["p"]); assert.equal(repository.findPreview("p")?.state, "rolled_back"); });
test("requires all 17 mapped sheets and blocks hostile cell values", () => { assert.throws(() => validateSheetRegistry(["Szülők elérhetősége"]), ImportValidationError); validateSheetRegistry(sheetIds); assert.throws(() => new ImportService(new InMemoryImportRepository()).createPreview({ id: "bad", sheetIds, rows: [row({ payload: { name: "=DANGEROUS" } })] }), ImportValidationError); });
test("persists sheet destinations and authorized conflict resolution", () => { const repository = new InMemoryImportRepository(); const service = new ImportService(repository); service.createPreview({ id: "p", sheetIds, rows: [row()], conflicts: [{ id: "c", sourceKey: "sheet:1" }] }); assert.equal(repository.sheetRegistries.get("p")?.destinations["Könyvtár"]?.owner, "kindergarten-library-owner"); assert.equal(repository.listConflicts("p")[0]?.state, "open"); assert.throws(() => service.commit({ previewId: "p", fingerprint: repository.findPreview("p")!.fingerprint }), ImportConflictError); service.resolveConflict({ conflictId: "c", previewId: "p", authorized: true }); assert.equal(repository.listConflicts("p")[0]?.state, "resolved"); });
test("only permits authorized open conflict resolution", () => { assert.equal(canResolveConflict(true, { id: "c", previewId: "p", sourceKey: "row", state: "open" }), true); assert.equal(canResolveConflict(false, { id: "c", previewId: "p", sourceKey: "row", state: "open" }), false); });

test("current archive owners preserve all seventeen destinations and business rows", () => {
 const expected = {
  "Szülők elérhetősége": {
    "mode": "interactive",
    "owner": "family-directory",
    "destination": "Parent and family directory"
  },
  "Kinti - benti takarítás 2025-26": {
    "mode": "interactive",
    "owner": "coordination-core",
    "destination": "Cleaning assignments"
  },
  "Állatos hétvégi beosztás 2025-2": {
    "mode": "interactive",
    "owner": "coordination-core",
    "destination": "Weekend animal assignments"
  },
  "Vízhordás 2025-26": {
    "mode": "interactive",
    "owner": "coordination-core",
    "destination": "Water-carrying assignments"
  },
  "ÁLLATOK": {
    "mode": "read_only_archive",
    "owner": "super-admin",
    "destination": "Animal procedure archive"
  },
  "Gödöllői Bazár 2025": {
    "mode": "interactive",
    "owner": "coordination-core",
    "destination": "Bazaar event tasks"
  },
  "Állatok etetése info": {
    "mode": "read_only_archive",
    "owner": "super-admin",
    "destination": "Feeding information archive"
  },
  "Nagytakarítás": {
    "mode": "interactive",
    "owner": "coordination-core",
    "destination": "Large-cleaning assignments"
  },
  "Nagytakarítás szervezés": {
    "mode": "read_only_archive",
    "owner": "super-admin",
    "destination": "Cleaning organization archive"
  },
  "Állatos beosztás 2025 Nyári szü": {
    "mode": "interactive",
    "owner": "coordination-core",
    "destination": "Summer animal assignments"
  },
  "Hajó javítás": {
    "mode": "read_only_archive",
    "owner": "super-admin",
    "destination": "Maintenance archive"
  },
  "Munkacsoportok": {
    "mode": "read_only_archive",
    "owner": "workgroup-organizer",
    "destination": "Workgroup membership archive"
  },
  "Nyárünnep 2026": {
    "mode": "interactive",
    "owner": "coordination-core",
    "destination": "Summer festival event tasks"
  },
  "Kertfejlesztés": {
    "mode": "read_only_archive",
    "owner": "super-admin",
    "destination": "Garden development archive"
  },
  "Kert- és bazárpénzek": {
    "mode": "read_only_archive",
    "owner": "kindergarten-finance-owner",
    "destination": "Historic finance archive; reconciliation uses the named finance process"
  },
  "Könyvtár": {
    "mode": "read_only_archive",
    "owner": "kindergarten-library-owner",
    "destination": "Library archive; lending uses the named library process"
  },
  "Vízvizsgálat": {
    "mode": "read_only_archive",
    "owner": "water-test-organizer",
    "destination": "Family cost-share archive; payment uses the named water-test process"
  }
};
 assert.deepEqual(LEGACY_DESTINATIONS, expected);
 assert.deepEqual(Object.keys(expected), [...REQUIRED_SHEETS]);
 const repository = new InMemoryImportRepository(); const service = new ImportService(repository);
 const business = [row({ payload: { groupId: "group-actual", familyId: "family-actual", taskId: "task-actual", assignmentId: "assignment-actual", ownerId: "owner-actual" } })]; const before = structuredClone(business);
 const preview = service.createPreview({ id: "preserve", sheetIds, rows: business });
 assert.throws(() => service.commit({ previewId: preview.id, fingerprint: "wrong" }), ImportConflictError);
 assert.deepEqual(business, before); assert.deepEqual(repository.findPreview(preview.id)?.rows, before); assert.deepEqual(repository.published, []);
 assert.deepEqual(repository.sheetRegistries.get(preview.id)?.destinations, expected);
});
