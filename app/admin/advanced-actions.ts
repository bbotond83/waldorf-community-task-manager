"use server";

import { revalidatePath } from "next/cache";
import type { ApplicationResult } from "../../src/application/index.ts";
import type { AdminActionState } from "./actions.ts";
import { mapApplicationResult } from "./_lib/action-state.ts";
import { resolveAdminFacade } from "./_lib/facade.ts";
import { resolveAdminSession } from "./_lib/session.ts";

export async function retryReminderAction(
  _: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const boundary = await resolveBoundary();
  if (!boundary.ok) return boundary.state;
  const result = await boundary.facade.reminders.retry(boundary.session.applicationSession, {
    scope: boundary.session.scope,
    id: text(formData, "targetId"),
    expectedVersion: number(formData, "expectedVersion"),
    idempotencyKey: text(formData, "idempotencyKey"),
    payload: {
      kind: text(formData, "kind"),
      targetType: text(formData, "targetType"),
      expected: expectedDeliveries(text(formData, "expected")),
    },
  });
  // No revalidation here: the page would redraw without the restarted group and the success message would go with it.
  // The list is up to date on the next visit.
  return mapAdvancedResult(result, "Az újrapróbálás elindult.");
}

/** The (delivery id, try count) list the screen showed, read back from its hidden field; anything else reads as none. */
function expectedDeliveries(raw: string): { id: string; tryCount: number }[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((entry: unknown) => {
      if (!entry || typeof entry !== "object") return [];
      const { id, tryCount } = entry as { id?: unknown; tryCount?: unknown };
      return typeof id === "string" && typeof tryCount === "number" ? [{ id, tryCount }] : [];
    });
  } catch {
    return [];
  }
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
    payload: {},
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
    payload: { confirmed: text(formData, "confirmed") },
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
    REMINDER_NOT_RETRYABLE: "Ehhez nincs már sikertelen e-mail.",
    REMINDER_TOO_LARGE:
      "Ebben a csoportban túl sok a sikertelen e-mail az egyszeri újrapróbáláshoz (legfeljebb 5000).",
    REMINDER_STALE: "A lista időközben megváltozott; töltse be újra az oldalt.",
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
