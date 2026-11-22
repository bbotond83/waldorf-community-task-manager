"use server";

import { revalidatePath } from "next/cache";
import { normalizeRequiredText, validation } from "../../src/application/index.ts";
import { WEEKEND_PICKER_TEXT } from "../../src/application/rota-format.ts";
import { resolveRotaFacade } from "../_identity/rota-facade.ts";
import { mapParentResult, type ParentActionState } from "./_lib/action-state.ts";
import { resolveParentFacade } from "./_lib/facade.ts";
import { resolveParentSession } from "./_lib/session.ts";

export async function signUpAction(
  _state: ParentActionState,
  formData: FormData,
): Promise<ParentActionState> {
  const context = parseMutationContext(formData);
  if (!context.ok) return context.state;
  const boundary = await resolveBoundary();
  if (!boundary.ok) return boundary.state;
  const result = await boundary.facade.signUp(boundary.session.applicationSession, {
    familyScope: boundary.session.familyScope,
    familyId: boundary.session.familyId,
    dutyId: context.value.id,
    expectedVersion: context.value.expectedVersion,
    idempotencyKey: context.value.idempotencyKey,
  });
  return mapParentResult(result, "A jelentkezés sikerült.");
}

export async function requestSwapAction(
  _state: ParentActionState,
  formData: FormData,
): Promise<ParentActionState> {
  const context = parseMutationContext(formData);
  if (!context.ok) return context.state;
  const reason = validateProtectedReason(formData);
  if (reason) return reason;
  const counterpart = parseCounterpart(formData);
  if (!counterpart.ok) return counterpart.state;
  const boundary = await resolveBoundary();
  if (!boundary.ok) return boundary.state;
  const result = await boundary.facade.requestSwap(boundary.session.applicationSession, {
    familyScope: boundary.session.familyScope,
    familyId: boundary.session.familyId,
    assignmentId: stringValue(formData, "assignmentId"),
    counterpartId: counterpart.value.id,
    counterpartVersion: counterpart.value.version,
    reason: stringValue(formData, "reason").trim(),
    expectedVersion: context.value.expectedVersion,
    idempotencyKey: context.value.idempotencyKey,
  });
  if (result.state === "success") {
    revalidateParentDuty(context.value.id);
    revalidatePath("/szulo/cserek");
  }
  return mapParentResult(result, "A cserekérelem függő állapotba került.");
}

/**
 * The partner a parent chose for a swap. The partner list sends one radio value, `<assignment>:<version>`
 * (the version of the partner's place that was on screen). No choice is a field error on the list, so
 * the message is linked to it; an unselected radio sends nothing at all.
 */
function parseCounterpart(
  formData: FormData,
): { ok: true; value: { id: string; version: number } } | { ok: false; state: ParentActionState } {
  const chosen = stringValue(formData, "counterpart");
  if (chosen === "") {
    return { ok: false, state: validationState({ counterpart: "Válasszon egy cseretársat." }) };
  }
  const [id = "", versionText = ""] = chosen.split(":");
  const version = Number(versionText);
  if (!isIdentifier(id) || !Number.isInteger(version) || version < 1) {
    return { ok: false, state: validationState({ counterpart: "Érvénytelen cseretárs." }) };
  }
  return { ok: true, value: { id, version } };
}

/** The other family answers a swap request addressed to it: `decision` is `accept` or `decline`. */
export async function respondToSwapAction(
  _state: ParentActionState,
  formData: FormData,
): Promise<ParentActionState> {
  const context = parseMutationContext(formData);
  if (!context.ok) return context.state;
  const decision = stringValue(formData, "decision");
  if (decision !== "accept" && decision !== "decline") {
    return validationState({ decision: "Válasszon: megerősítés vagy elutasítás." });
  }
  const boundary = await resolveBoundary();
  if (!boundary.ok) return boundary.state;
  const result = await boundary.facade.respondToSwap(boundary.session.applicationSession, {
    familyScope: boundary.session.familyScope,
    familyId: boundary.session.familyId,
    requestId: context.value.id,
    accept: decision === "accept",
    expectedVersion: context.value.expectedVersion,
    idempotencyKey: context.value.idempotencyKey,
  });
  if (result.state === "success") revalidateSwapPages();
  return mapParentResult(
    result,
    result.state === "success" && result.data.outcome === "declined"
      ? "A cserekérelmet elutasította."
      : "A csere megtörtént: a két család feladata felcserélődött.",
  );
}

/** The requesting family takes back its own open swap or cancellation request. */
export async function withdrawRequestAction(
  _state: ParentActionState,
  formData: FormData,
): Promise<ParentActionState> {
  const context = parseMutationContext(formData);
  if (!context.ok) return context.state;
  const boundary = await resolveBoundary();
  if (!boundary.ok) return boundary.state;
  const result = await boundary.facade.withdrawRequest(boundary.session.applicationSession, {
    familyScope: boundary.session.familyScope,
    familyId: boundary.session.familyId,
    requestId: context.value.id,
    kind: stringValue(formData, "kind") === "cancellation" ? "cancellation" : "swap",
    idempotencyKey: context.value.idempotencyKey,
  });
  if (result.state === "success") revalidateSwapPages();
  return mapParentResult(result, "A kérelmet visszavonta.");
}

function revalidateSwapPages(): void {
  revalidatePath("/szulo/cserek");
  revalidatePath("/szulo/feladatok");
}

export async function requestCancellationAction(
  _state: ParentActionState,
  formData: FormData,
): Promise<ParentActionState> {
  const context = parseMutationContext(formData);
  if (!context.ok) return context.state;
  const reason = validateProtectedReason(formData);
  if (reason) return reason;
  const boundary = await resolveBoundary();
  if (!boundary.ok) return boundary.state;
  const result = await boundary.facade.requestCancellation(boundary.session.applicationSession, {
    familyScope: boundary.session.familyScope,
    familyId: boundary.session.familyId,
    assignmentId: stringValue(formData, "assignmentId"),
    reason: stringValue(formData, "reason").trim(),
    expectedVersion: context.value.expectedVersion,
    idempotencyKey: context.value.idempotencyKey,
  });
  if (result.state === "success") revalidateParentDuty(context.value.id);
  return mapParentResult(result, "A lemondási kérelem függő állapotba került.");
}

export async function markNotificationReadAction(
  _state: ParentActionState,
  formData: FormData,
): Promise<ParentActionState> {
  const id = stringValue(formData, "id");
  const idempotencyKey = stringValue(formData, "idempotencyKey");
  if (!isIdentifier(id) || !isIdempotencyKey(idempotencyKey)) {
    return validationState({ id: "Érvénytelen értesítés." });
  }
  const boundary = await resolveBoundary();
  if (!boundary.ok) return boundary.state;
  const result = await boundary.facade.markNotificationRead(boundary.session.applicationSession, {
    familyScope: boundary.session.familyScope,
    notificationId: id,
    idempotencyKey,
  });
  if (result.state === "success") {
    // Marking read is idempotent; the list is refreshed so returning to it shows the read state.
    revalidatePath("/szulo/ertesitesek");
    return {
      ...mapParentResult(result, "Az értesítés olvasottként megjelölve."),
      link: result.data.link,
    };
  }
  return mapParentResult(result, "");
}

export async function updateContributionAction(
  _state: ParentActionState,
  formData: FormData,
): Promise<ParentActionState> {
  const id = stringValue(formData, "id");
  const idempotencyKey = stringValue(formData, "idempotencyKey");
  const note = normalizeRequiredText(formData.get("note"), "note", 300);
  if (note.state === "validation") return mapParentResult(note, "");
  if (!isIdentifier(id) || !isIdempotencyKey(idempotencyKey)) {
    return validationState({ note: "A művelet adatai érvénytelenek." });
  }
  const boundary = await resolveBoundary();
  if (!boundary.ok) return boundary.state;
  const result = await boundary.facade.updateOwnContribution(boundary.session.applicationSession, {
    familyScope: boundary.session.familyScope,
    eventId: id,
    note: note.data,
    idempotencyKey,
  });
  if (result.state === "success") revalidatePath(`/szulo/feladatok/${id}`);
  return mapParentResult(result, "A saját hozzájárulási megjegyzés mentve.");
}

const PICKABLE_SLOTS = [
  "saturday_opening",
  "saturday_closing",
  "sunday_opening",
  "sunday_closing",
] as const;

/**
 * A family chooses the weekend opening or closing for its own picking week (BR63.4). The list sends one radio value
 * per free slot, `<slot>:<version of its place>`, the version that was on screen. The database checks that the week
 * is the caller's family's and answers the closed, taken and not-needed cases with their own codes.
 */
export async function pickSlotAction(
  _state: ParentActionState,
  formData: FormData,
): Promise<ParentActionState> {
  const rotaWeekId = stringValue(formData, "rotaWeekId");
  const [slot = "", versionText = ""] = stringValue(formData, "slot").split(":");
  const idempotencyKey = stringValue(formData, "idempotencyKey");
  const expectedVersion = Number(versionText);
  const chosen = PICKABLE_SLOTS.find((value) => value === slot);
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rotaWeekId) ||
    !isIdempotencyKey(idempotencyKey)
  ) {
    return validationState({ rotaWeekId: "Érvénytelen azonosító." });
  }
  if (!chosen || !Number.isInteger(expectedVersion) || expectedVersion < 1) {
    return validationState({ slot: "Válasszon egy szabad nyitást vagy zárást." });
  }
  const session = await resolveParentSession();
  const rota = await resolveRotaFacade();
  if (session.state !== "success" || !rota)
    return { state: "denied", message: "Nincs jogosultság." };
  const result = await rota.pickSlot(session.data.applicationSession, session.data.familyScope, {
    idempotencyKey,
    rotaWeekId,
    slot: chosen,
    expectedVersion,
  });
  if (result.state === "success") {
    revalidatePath("/szulo/beosztas");
    revalidatePath("/szulo/feladatok");
    revalidatePath("/admin");
  }
  return mapParentResult(result, WEEKEND_PICKER_TEXT.saved);
}

function parseMutationContext(
  formData: FormData,
):
  | { ok: true; value: { id: string; expectedVersion: number; idempotencyKey: string } }
  | { ok: false; state: ParentActionState } {
  const id = stringValue(formData, "id");
  const expectedVersion = Number(formData.get("expectedVersion"));
  const idempotencyKey = stringValue(formData, "idempotencyKey");
  const fieldErrors: Record<string, string> = {};
  if (!isIdentifier(id)) fieldErrors.id = "Érvénytelen azonosító.";
  if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
    fieldErrors.expectedVersion = "Érvénytelen verzió.";
  }
  if (!isIdempotencyKey(idempotencyKey)) {
    fieldErrors.idempotencyKey = "Érvénytelen műveleti kulcs.";
  }
  if (Object.keys(fieldErrors).length) {
    return { ok: false, state: validationState(fieldErrors) };
  }
  return { ok: true, value: { id, expectedVersion, idempotencyKey } };
}

function validateProtectedReason(formData: FormData): ParentActionState | undefined {
  const reason = normalizeRequiredText(formData.get("reason"), "reason", 500);
  return reason.state === "validation" ? mapParentResult(reason, "") : undefined;
}

async function resolveBoundary() {
  const session = await resolveParentSession();
  const facade = await resolveParentFacade();
  if (session.state !== "success" || !facade) {
    return {
      ok: false as const,
      state: { state: "denied", message: "Nincs jogosultság." } as ParentActionState,
    };
  }
  return { ok: true as const, session: session.data, facade };
}

function revalidateParentDuty(id: string): void {
  revalidatePath("/szulo/feladatok");
  revalidatePath(`/szulo/feladatok/${id}`);
}

function validationState(fieldErrors: Readonly<Record<string, string>>): ParentActionState {
  return mapParentResult(validation(fieldErrors), "");
}

function isIdentifier(value: string): boolean {
  return /^[a-z0-9][a-z0-9-]{1,79}$/.test(value);
}

function isIdempotencyKey(value: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9:_-]{7,127}$/.test(value);
}

function stringValue(formData: FormData, field: string): string {
  const value = formData.get(field);
  return typeof value === "string" ? value : "";
}
