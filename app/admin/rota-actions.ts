"use server";

import { revalidatePath } from "next/cache";
import { resolveRotaFacade } from "../_identity/rota-facade.ts";
import { resolveAdminFacade } from "./_lib/facade.ts";
import { rotaState } from "./_lib/rota-state.ts";
import { resolveAdminSession } from "./_lib/session.ts";
import type { AdminActionState } from "./actions.ts";

/**
 * The calendar and rota commands of a super admin (W1 to W5). Each action reads the form, calls the facade, and
 * answers in Hungarian: a refusal code the database gives gets its own sentence (`rotaRefusalMessage`). The database
 * decides who may change what; a screen that is reached by someone else only gets a refusal back (NFR3.2).
 */

const KEY = /^[A-Za-z0-9][A-Za-z0-9:_-]{7,127}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function text(formData: FormData, field: string): string {
  const value = formData.get(field);
  return typeof value === "string" ? value.trim() : "";
}

function version(formData: FormData): number {
  const value = Number(formData.get("expectedVersion"));
  return Number.isInteger(value) && value >= 1 ? value : 0;
}

function invalid(message: string): AdminActionState {
  return { state: "validation", message };
}

async function boundary() {
  const session = await resolveAdminSession();
  const rota = await resolveRotaFacade();
  if (session.state !== "success" || !rota) return undefined;
  return { session: session.data, rota };
}

const DENIED: AdminActionState = {
  state: "denied",
  message: "Ehhez a művelethez nincs jogosultság.",
};

function refresh() {
  revalidatePath("/admin/tanev");
  revalidatePath("/admin/beosztas");
  revalidatePath("/szulo/beosztas");
  revalidatePath("/teacher/beosztas");
}

export async function saveSchoolYearAction(
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const id = text(formData, "id");
  const key = text(formData, "idempotencyKey");
  const expectedVersion = version(formData);
  if (!UUID.test(id) || !KEY.test(key) || expectedVersion === 0) {
    return invalid("Töltse újra az oldalt, és próbálja újra.");
  }
  const admin = await resolveAdminFacade();
  const context = await boundary();
  if (!admin || !context) return DENIED;
  const result = await admin.saveRecord(context.session.applicationSession, {
    scope: context.session.scope,
    id,
    expectedVersion,
    idempotencyKey: key,
    payload: {
      title: text(formData, "name"),
      kind: "school-year",
      startsOn: text(formData, "startsOn"),
      endsOn: text(formData, "endsOn"),
      changeoverDate: text(formData, "changeoverDate"),
    },
  });
  if (result.state === "success") refresh();
  return rotaState(result, "A tanév adatai mentve.");
}

export async function addBreakWeekAction(
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const schoolYearId = text(formData, "schoolYearId");
  const weekStart = text(formData, "weekStart");
  const label = text(formData, "label");
  const key = text(formData, "idempotencyKey");
  if (!UUID.test(schoolYearId) || !KEY.test(key)) {
    return invalid("Töltse újra az oldalt, és próbálja újra.");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
    return {
      state: "validation",
      message: "Ellenőrizze a megadott adatokat.",
      fieldErrors: { weekStart: "Adja meg a szünet első napját, egy hétfőt." },
    };
  }
  const context = await boundary();
  if (!context) return DENIED;
  const result = await context.rota.addBreakWeek(
    context.session.applicationSession,
    context.session.scope,
    { idempotencyKey: key, schoolYearId, weekStart, ...(label ? { label } : {}) },
  );
  if (result.state === "success") refresh();
  return rotaState(result, "A szünet felvéve.");
}

export async function removeBreakWeekAction(
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const breakWeekId = text(formData, "breakWeekId");
  const key = text(formData, "idempotencyKey");
  const expectedVersion = version(formData);
  if (!UUID.test(breakWeekId) || !KEY.test(key) || expectedVersion === 0) {
    return invalid("Töltse újra az oldalt, és próbálja újra.");
  }
  const context = await boundary();
  if (!context) return DENIED;
  const result = await context.rota.removeBreakWeek(
    context.session.applicationSession,
    context.session.scope,
    { idempotencyKey: key, breakWeekId, expectedVersion },
  );
  if (result.state === "success") refresh();
  return rotaState(result, "A szünet törölve.");
}

export async function makeDraftAction(
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const schoolYearId = text(formData, "schoolYearId");
  const key = text(formData, "idempotencyKey");
  if (!UUID.test(schoolYearId) || !KEY.test(key)) {
    return invalid("Töltse újra az oldalt, és próbálja újra.");
  }
  const context = await boundary();
  if (!context) return DENIED;
  const result = await context.rota.makeDraft(
    context.session.applicationSession,
    context.session.scope,
    { idempotencyKey: key, schoolYearId },
  );
  if (result.state === "success") refresh();
  return rotaState(result, "A tervezet elkészült.");
}

export async function setWeekAction(
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const weekId = text(formData, "weekId");
  const familyId = text(formData, "familyId");
  const key = text(formData, "idempotencyKey");
  const expectedVersion = version(formData);
  if (!UUID.test(weekId) || (familyId !== "" && !UUID.test(familyId)) || !KEY.test(key)) {
    return invalid("Töltse újra az oldalt, és próbálja újra.");
  }
  if (expectedVersion === 0) return invalid("Töltse újra az oldalt, és próbálja újra.");
  const context = await boundary();
  if (!context) return DENIED;
  const result = await context.rota.setWeek(
    context.session.applicationSession,
    context.session.scope,
    { idempotencyKey: key, weekId, familyId: familyId === "" ? null : familyId, expectedVersion },
  );
  if (result.state === "success") refresh();
  return rotaState(result, "A hét mentve.");
}

export async function discardDraftAction(
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const planId = text(formData, "planId");
  const key = text(formData, "idempotencyKey");
  const expectedVersion = version(formData);
  const changedWeeks = Number(formData.get("changedWeeks"));
  if (
    !UUID.test(planId) ||
    !KEY.test(key) ||
    expectedVersion === 0 ||
    !Number.isInteger(changedWeeks) ||
    changedWeeks < 0
  ) {
    return invalid("Töltse újra az oldalt, és próbálja újra.");
  }
  const context = await boundary();
  if (!context) return DENIED;
  const result = await context.rota.discardDraft(
    context.session.applicationSession,
    context.session.scope,
    { idempotencyKey: key, planId, expectedVersion, changedWeeks },
  );
  if (result.state === "success") refresh();
  return rotaState(result, "A tervezet elvetve.");
}

export async function publishAction(
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const planId = text(formData, "planId");
  const key = text(formData, "idempotencyKey");
  const expectedVersion = version(formData);
  if (!UUID.test(planId) || !KEY.test(key) || expectedVersion === 0) {
    return invalid("Töltse újra az oldalt, és próbálja újra.");
  }
  const context = await boundary();
  if (!context) return DENIED;
  const result = await context.rota.publish(
    context.session.applicationSession,
    context.session.scope,
    { idempotencyKey: key, planId, expectedVersion },
  );
  if (result.state === "success") refresh();
  return rotaState(result, "A beosztás közzétéve.");
}
