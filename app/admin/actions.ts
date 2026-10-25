"use server";

import { revalidatePath } from "next/cache";
import { normalizeRequiredText, validation } from "../../src/application/index.ts";
import { mapApplicationResult } from "./_lib/action-state.ts";
import { parseRecordExtras, parseTaskExtras } from "./_lib/record-payload.ts";
import { resolveAdminFacade } from "./_lib/facade.ts";
import { resolveAdminSession } from "./_lib/session.ts";

export type AdminActionState = Readonly<{
  state:
    | "initial"
    | "validation"
    | "success"
    | "denied"
    | "conflict"
    | "invalidated"
    | "retryable"
    | "terminal";
  message?: string;
  code?: string;
  fieldErrors?: Readonly<Record<string, string>>;
  retry?: Readonly<{ idempotencyKey: string; action: string }>;
  outcome?: string;
}>;

export type AdminAction = (
  state: AdminActionState,
  formData: FormData,
) => Promise<AdminActionState>;

const TITLE_MAX_LENGTH = 120;

/** Hungarian field message for an empty or too long title, naming the limit. */
function titleValidationState(code: string | undefined): AdminActionState {
  return mapApplicationResult(
    validation({
      title:
        code === "VAL-TOO-LONG"
          ? `A megnevezés legfeljebb ${TITLE_MAX_LENGTH} karakter hosszú lehet.`
          : "A megnevezés megadása kötelező.",
    }),
  );
}

export async function saveRecordAction(
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const title = normalizeRequiredText(formData.get("title"), "title", TITLE_MAX_LENGTH);
  if (title.state === "validation") return titleValidationState(title.fieldErrors?.title);
  const context = parseMutationContext(formData);
  if (!context.ok) return context.state;
  const kind = stringValue(formData, "kind");
  const extras = parseRecordExtras(kind, formData, context.value.id === "new");
  if (Object.keys(extras.errors).length > 0) return mapApplicationResult(validation(extras.errors));
  const boundary = await resolveBoundary();
  if (!boundary.ok) return boundary.state;
  const result = await boundary.facade.saveRecord(boundary.session.applicationSession, {
    scope: boundary.session.scope,
    ...context.value,
    payload: { title: title.data, kind, ...extras.payload },
  });
  if (result.state === "success") {
    revalidatePath("/admin/nyilvantartasok");
    if (context.value.id !== "new") revalidatePath(`/admin/nyilvantartasok/${context.value.id}`);
  }
  return mapApplicationResult(result, "A nyilvántartás mentése sikerült.");
}

export async function archiveRecordAction(
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  return runRecordStateAction(formData, "archive");
}

export async function restoreRecordAction(
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  return runRecordStateAction(formData, "restore");
}

export async function saveTaskAction(
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const title = normalizeRequiredText(formData.get("title"), "title", TITLE_MAX_LENGTH);
  if (title.state === "validation") return titleValidationState(title.fieldErrors?.title);
  const context = parseMutationContext(formData);
  if (!context.ok) return context.state;
  const kind = stringValue(formData, "kind") === "event" ? "event" : "task";
  const extras = parseTaskExtras(kind, formData, context.value.id === "new");
  if (Object.keys(extras.errors).length > 0) return mapApplicationResult(validation(extras.errors));
  const boundary = await resolveBoundary();
  if (!boundary.ok) return boundary.state;
  const result = await boundary.facade.saveTaskOrEvent(boundary.session.applicationSession, {
    scope: boundary.session.scope,
    ...context.value,
    payload: {
      title: title.data,
      kind,
      ...extras.payload,
    },
  });
  if (result.state === "success") {
    revalidatePath("/admin/feladatok");
    if (context.value.id !== "new") revalidatePath(`/admin/feladatok/${context.value.id}`);
  }
  return mapApplicationResult(result, "A feladat vagy esemény mentése sikerült.");
}

export async function assignTaskAction(
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const context = parseMutationContext(formData);
  if (!context.ok) return context.state;
  // The family selector sends `familySelector`; choosing no family is a field error.
  const familyId = stringValue(formData, "familyId");
  if (formData.has("familySelector") && familyId === "") {
    return mapApplicationResult(validation({ familyId: "Válassza ki a családot." }));
  }
  const boundary = await resolveBoundary();
  if (!boundary.ok) return boundary.state;
  const result = await boundary.facade.assign(boundary.session.applicationSession, {
    scope: boundary.session.scope,
    ...context.value,
    payload: familyId ? { familyId } : {},
  });
  if (result.state === "success") revalidatePath(`/admin/feladatok/${context.value.id}`);
  return mapApplicationResult(result, "A hozzárendelés sikerült.");
}

export async function decideApprovalAction(
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const context = parseMutationContext(formData);
  if (!context.ok) return context.state;
  // An approval cannot be undone: only the two known words count, anything else (a missing field, a typo)
  // is refused before anything is sent.
  const decision = stringValue(formData, "decision");
  if (decision !== "approved" && decision !== "rejected") {
    return mapApplicationResult(validation({ decision: "Válasszon: jóváhagyás vagy elutasítás." }));
  }
  const boundary = await resolveBoundary();
  if (!boundary.ok) return boundary.state;
  const result = await boundary.facade.decideApproval(boundary.session.applicationSession, {
    scope: boundary.session.scope,
    ...context.value,
    decision,
    payload: {},
  });
  if (result.state === "success") {
    revalidatePath("/admin/jovahagyasok");
    return {
      state: "success",
      message:
        result.data.outcome === "approved" ? "A kérelem jóváhagyva." : "A kérelem elutasítva.",
      code: result.code,
      outcome: result.data.outcome,
    };
  }
  const mapped = mapApplicationResult(result);
  if (result.state === "conflict" && result.code === "APPROVAL_ALREADY_DECIDED") {
    return { ...mapped, message: "A kérelmet már elbírálták.", outcome: "already-decided" };
  }
  if (result.state === "invalidated") return { ...mapped, outcome: "invalidated" };
  if (result.state === "denied") return { ...mapped, outcome: "denied" };
  if (result.state === "dependency-failure-retryable") return { ...mapped, outcome: "retryable" };
  if (result.state === "dependency-failure-terminal") return { ...mapped, outcome: "terminal" };
  return mapped;
}

export async function saveEventNotesAction(
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const context = parseMutationContext(formData);
  if (!context.ok) return context.state;
  const fields = ["allergenNote", "supplyNote", "foodNote"] as const;
  const payload: Record<string, string> = {};
  const fieldErrors: Record<string, string> = {};
  for (const field of fields) {
    const value = stringValue(formData, field).trim().replaceAll(/\s+/g, " ");
    if (value.length > 300) fieldErrors[field] = "A megjegyzés legfeljebb 300 karakter lehet.";
    payload[field] = value;
  }
  if (Object.keys(fieldErrors).length > 0) return mapApplicationResult(validation(fieldErrors));
  const boundary = await resolveBoundary();
  if (!boundary.ok) return boundary.state;
  const result = await boundary.facade.saveEventNotes(boundary.session.applicationSession, {
    scope: boundary.session.scope,
    ...context.value,
    payload,
  });
  if (result.state === "success") revalidatePath(`/admin/feladatok/${context.value.id}`);
  return mapApplicationResult(result, "Az esemény engedélyezett megjegyzései mentve.");
}

async function runRecordStateAction(
  formData: FormData,
  operation: "archive" | "restore",
): Promise<AdminActionState> {
  const context = parseMutationContext(formData);
  if (!context.ok) return context.state;
  const boundary = await resolveBoundary();
  if (!boundary.ok) return boundary.state;
  const input = {
    scope: boundary.session.scope,
    ...context.value,
    payload: {},
  };
  const result =
    operation === "archive"
      ? await boundary.facade.archiveRecord(boundary.session.applicationSession, input)
      : await boundary.facade.restoreRecord(boundary.session.applicationSession, input);
  if (result.state === "success") {
    revalidatePath("/admin/nyilvantartasok");
    revalidatePath("/admin/archivum");
  }
  return mapApplicationResult(
    result,
    operation === "archive" ? "Az elem archiválva." : "Az elem visszaállítva.",
  );
}

function parseMutationContext(
  formData: FormData,
):
  | { ok: true; value: { id: string; expectedVersion: number; idempotencyKey: string } }
  | { ok: false; state: AdminActionState } {
  const id = stringValue(formData, "id");
  const expectedVersion = Number(formData.get("expectedVersion"));
  const idempotencyKey = stringValue(formData, "idempotencyKey");
  const fieldErrors: Record<string, string> = {};
  if (!/^[a-z0-9][a-z0-9-]{1,79}$/.test(id)) fieldErrors.id = "Érvénytelen azonosító.";
  if (!Number.isInteger(expectedVersion) || expectedVersion < 1)
    fieldErrors.expectedVersion = "Érvénytelen verzió.";
  if (!/^[A-Za-z0-9][A-Za-z0-9:_-]{7,127}$/.test(idempotencyKey))
    fieldErrors.idempotencyKey = "Érvénytelen műveleti kulcs.";
  if (Object.keys(fieldErrors).length > 0)
    return { ok: false, state: mapApplicationResult(validation(fieldErrors)) };
  return { ok: true, value: { id, expectedVersion, idempotencyKey } };
}

async function resolveBoundary() {
  const session = await resolveAdminSession();
  const facade = await resolveAdminFacade();
  if (session.state !== "success" || !facade) {
    return {
      ok: false as const,
      state: { state: "denied", message: "Nincs jogosultság" } as AdminActionState,
    };
  }
  return { ok: true as const, session: session.data, facade };
}

function stringValue(formData: FormData, field: string): string {
  const value = formData.get(field);
  return typeof value === "string" ? value : "";
}
