import type { DirectoryRepository, Family } from "./types.ts";
export class InMemoryDirectoryRepository implements DirectoryRepository {
  private families = new Map<string, Family>();
  readonly recalculatedFamilyIds: string[] = [];
  transaction<T>(operation: () => T): T { const snapshot = new Map(this.families); const count = this.recalculatedFamilyIds.length; try { return operation(); } catch (error) { this.families = snapshot; this.recalculatedFamilyIds.splice(count); throw error; } }
  findFamily(id: string): Family | undefined { return this.families.get(id); }
  saveFamily(family: Family): void { this.families.set(family.id, family); }
  recalculateVisibility(familyId: string): void { this.recalculatedFamilyIds.push(familyId); }
}
export class InMemoryDirectoryAuditWriter { readonly events: import("./types.ts").DirectoryAuditEvent[] = []; write(event: import("./types.ts").DirectoryAuditEvent): void { this.events.push(event); } }
