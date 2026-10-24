"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { WorkbookUpload, type ApplicationResult } from "../../src/application/index.ts";
import { IMPORT_LIMITS } from "../../src/import-parser/index.ts";
import type { AdminActionState } from "./actions.ts";
import { mapApplicationResult } from "./_lib/action-state.ts";
import { resolveAdminFacade } from "./_lib/facade.ts";
import { IMPORT_MESSAGES } from "./_lib/import-messages.ts";
import { resolveAdminSession } from "./_lib/session.ts";

export async function createImportPreviewAction(
  _: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const fixtureId = text(formData, "fixtureId");
  if (!fixtureId) return fieldError("fixtureId", "Válasszon ellenőrizhető munkafüzetet.");
  const boundary = await resolveBoundary();
  if (!boundary.ok) return boundary.state;
  const result = await boundary.facade.import.createPreview(boundary.session.applicationSession, {
    scope: boundary.session.scope,
    id: fixtureId,
    expectedVersion: 1,
    idempotencyKey: text(formData, "idempotencyKey"),
    payload: { scenario: text(formData, "scenario") },
  });
  revalidatePath("/admin/import");
  return mapAdvancedResult(result, "A munkafüzet ellenőrzése és előnézete elkészült.");
}

/**
 * The upload of the real import (production mode): reads the chosen .xlsx file as bytes (never a path),
 * refuses an empty or oversized file with a Hungarian message before anything is read further, and hands the
 * bytes to the facade, which parses them on the server and stages them. Each attempt makes its own
 * idempotency key, so uploading another file after a refused one never reuses a key (BR41.2, BR42.1).
 */
export async function uploadImportWorkbookAction(
  _: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const boundary = await resolveBoundary();
  if (!boundary.ok) return boundary.state;
  const file = formData.get("workbook");
  if (!(file instanceof File) || file.size === 0) {
    return fieldError("workbook", "Válasszon ki egy .xlsx munkafüzetet.");
  }
  if (file.size > IMPORT_LIMITS.maxFileBytes) {
    return fieldError("workbook", "A munkafüzet legfeljebb 5 MB lehet.");
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const result = await boundary.facade.import.createPreview(boundary.session.applicationSession, {
    scope: boundary.session.scope,
    id: file.name || "munkafuzet.xlsx",
    expectedVersion: 1,
    idempotencyKey: freshAttemptKey("import-upload"),
    payload: { workbook: new WorkbookUpload(file.name, bytes) },
  });
  revalidatePath("/admin/import");
  return mapAdvancedResult(result, "A munkafüzet ellenőrzése és előnézete elkészült.");
}

/** A key for one attempt, from random bytes (it works on every address the application is opened from). */
function freshAttemptKey(prefix: string): string {
  return `${prefix}:${randomBytes(16).toString("hex")}`;
}

export async function resolveImportConflictAction(
  _: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const resolution = text(formData, "resolution");
  if (!resolution) return fieldError("resolution", "Válasszon feloldási módot.");
  const boundary = await resolveBoundary();
  if (!boundary.ok) return boundary.state;
  const result = await boundary.facade.import.resolveConflict(boundary.session.applicationSession, {
    scope: boundary.session.scope,
    id: text(formData, "previewId"),
    expectedVersion: number(formData, "expectedVersion"),
    idempotencyKey: text(formData, "idempotencyKey"),
    payload: { conflictId: text(formData, "conflictId"), resolution },
  });
  revalidatePath("/admin/import");
  return mapAdvancedResult(result, "Az ütközés feloldása rögzítve.");
}

export async function commitImportAction(
  _: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const boundary = await resolveBoundary();
  if (!boundary.ok) return boundary.state;
  const result = await boundary.facade.import.commit(boundary.session.applicationSession, {
    scope: boundary.session.scope,
    id: text(formData, "previewId"),
    expectedVersion: number(formData, "expectedVersion"),
    idempotencyKey: text(formData, "idempotencyKey"),
    payload: {
      fingerprint: text(formData, "fingerprint"),
      confirmed: text(formData, "confirmed"),
      scenario: text(formData, "scenario"),
    },
  });
  revalidatePath("/admin/import");
  return mapAdvancedResult(result, "Az import egyszer, atomikusan lezárult.");
}

export async function recoverImportAction(
  _: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const boundary = await resolveBoundary();
  if (!boundary.ok) return boundary.state;
  const result = await boundary.facade.import.recover(boundary.session.applicationSession, {
    scope: boundary.session.scope,
    id: text(formData, "runId"),
    expectedVersion: 1,
    idempotencyKey: text(formData, "idempotencyKey"),
    payload: { action: "resume", scenario: text(formData, "scenario") },
  });
  revalidatePath("/admin/import");
  return mapAdvancedResult(result, "A megszakított import helyreállt.");
}

/**
 * Ends the open import run (production mode): its staged rows are deleted and the upload form shows again.
 * The screen offers it while a run is open, so a wrong file never has to wait for the seven-day expiry.
 */
export async function cancelImportAction(
  _: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const boundary = await resolveBoundary();
  if (!boundary.ok) return boundary.state;
  const result = await boundary.facade.import.cancel(boundary.session.applicationSession, {
    scope: boundary.session.scope,
    id: text(formData, "runId"),
    expectedVersion: number(formData, "expectedVersion"),
    idempotencyKey: text(formData, "idempotencyKey"),
    payload: {},
  });
  revalidatePath("/admin/import");
  return mapAdvancedResult(result, "Az import megszakítva; új munkafüzetet tölthet fel.");
}

export async function retryReminderAction(
  _: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const boundary = await resolveBoundary();
  if (!boundary.ok) return boundary.state;
  const result = await boundary.facade.reminders.retry(boundary.session.applicationSession, {
    scope: boundary.session.scope,
    id: text(formData, "jobId"),
    expectedVersion: number(formData, "expectedVersion"),
    idempotencyKey: text(formData, "correlationId"),
    payload: { scenario: text(formData, "scenario") },
  });
  revalidatePath("/admin/emlekeztetok");
  return mapAdvancedResult(result, "Az újrapróbálás az eredeti korrelációs azonosítóval ütemezve.");
}

export async function updateGrantAction(
  _: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const boundary = await resolveBoundary();
  if (!boundary.ok) return boundary.state;
  const result = await boundary.facade.governance.updateGrant(boundary.session.applicationSession, {
    scope: boundary.session.scope,
    id: text(formData, "grantId"),
    expectedVersion: number(formData, "expectedVersion"),
    idempotencyKey: text(formData, "idempotencyKey"),
    payload: { scenario: text(formData, "scenario") },
  });
  return mapAdvancedResult(
    result,
    "A jogosultság visszavonva; a következő kérés már újraellenőriz.",
  );
}

export async function runLifecycleAction(
  _: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const boundary = await resolveBoundary();
  if (!boundary.ok) return boundary.state;
  const result = await boundary.facade.lifecycle.run(boundary.session.applicationSession, {
    scope: boundary.session.scope,
    id: text(formData, "familyId"),
    expectedVersion: number(formData, "expectedVersion"),
    idempotencyKey: text(formData, "idempotencyKey"),
    payload: { confirmed: text(formData, "confirmed"), scenario: text(formData, "scenario") },
  });
  revalidatePath("/admin/adatvedelem");
  return mapAdvancedResult(result, "Az adat-életciklus művelet atomikusan lezárult.");
}

export async function saveAdvancedSettingsAction(
  _: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const recipientId = text(formData, "recipientId");
  if (!recipientId) return fieldError("recipientId", "Válasszon engedélyezett címzetti kört.");
  const boundary = await resolveBoundary();
  if (!boundary.ok) return boundary.state;
  const result = await boundary.facade.settings.save(boundary.session.applicationSession, {
    scope: boundary.session.scope,
    id: "advanced-settings",
    expectedVersion: number(formData, "expectedVersion"),
    idempotencyKey: text(formData, "idempotencyKey"),
    payload: { recipientId, remindersEnabled: text(formData, "remindersEnabled") },
  });
  revalidatePath("/admin/beallitasok");
  return mapAdvancedResult(result, "A megengedett beállítások mentése sikerült.");
}

function mapAdvancedResult<T>(
  result: ApplicationResult<T>,
  successMessage: string,
): AdminActionState {
  const mapped = mapApplicationResult(result, successMessage);
  const messages: Record<string, string> = {
    ...IMPORT_MESSAGES,
    REMINDER_NOT_RETRYABLE: "Ez az emlékeztető nem próbálható újra.",
    REMINDER_STALE: "A feladat állapota megváltozott.",
    GRANT_SELF_LOCKOUT: "Saját hozzáférését ebben a műveletben nem vonhatja vissza.",
    GRANT_LAST_SUPER_ADMIN: "Az utolsó szuperadminisztrátor nem távolítható el.",
    GRANT_STALE: "A jogosultság verziója megváltozott.",
    LIFECYCLE_BLOCKED: "A jelöltet megőrzési szabály blokkolja.",
    LIFECYCLE_STALE: "A jelölt állapota megváltozott.",
    SETTINGS_RECIPIENT_INVALID: "A címzetti kör nem engedélyezett.",
    SETTINGS_STALE: "A beállítások időközben megváltoztak.",
  };
  const own = Object.hasOwn(messages, result.code) ? messages[result.code] : undefined;
  return { ...mapped, message: own ?? mapped.message };
}

async function resolveBoundary() {
  const [session, facade] = await Promise.all([resolveAdminSession(), resolveAdminFacade()]);
  if (session.state !== "success" || !facade)
    return {
      ok: false as const,
      state: { state: "denied", message: "Nincs jogosultság" } as AdminActionState,
    };
  return { ok: true as const, session: session.data, facade };
}

function fieldError(field: string, message: string): AdminActionState {
  return {
    state: "validation",
    message: "Ellenőrizze a megadott adatokat.",
    fieldErrors: { [field]: message },
  };
}
function text(formData: FormData, field: string): string {
  const value = formData.get(field);
  return typeof value === "string" ? value : "";
}
function number(formData: FormData, field: string): number {
  return Number(formData.get(field));
}
