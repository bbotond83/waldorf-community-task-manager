import type { RecurringOwnerKind, RecurringScheduleInput } from "../../src/application/index.ts";
import { recurringMessage } from "../../src/data/copy.ts";
import type { ParentActionState } from "../szulo/_lib/action-state.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const KEY = /^[A-Za-z0-9][A-Za-z0-9:_-]{7,127}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const ROTA_JOBS = ["indoor_cleaning", "front_garden", "water_carrying", "weekend_animal_care"];

export const INVALID: ParentActionState = {
  state: "validation",
  message: "A kérés érvénytelen. Frissítsd az oldalt, és próbáld újra.",
  code: "VAL-INVALID",
};

export const NO_ACCESS: ParentActionState = {
  state: "denied",
  message: "Ezt a műveletet nem végezheted el.",
};

export const text = (formData: FormData, field: string): string => {
  const value = formData.get(field);
  return typeof value === "string" ? value : "";
};

/** An address part counts only when it is a UUID; anything else is never sent to the database. */
export const isRecurringId = (value: string | undefined): value is string =>
  value !== undefined && UUID.test(value);

export const isRecurringKey = (value: string): boolean => KEY.test(value);

export const uuidField = (formData: FormData, field: string): string | undefined => {
  const value = text(formData, field);
  return UUID.test(value) ? value : undefined;
};

export function versionField(formData: FormData): number | undefined {
  const value = Number(formData.get("expectedVersion"));
  return Number.isInteger(value) && value >= 1 ? value : undefined;
}

const refusedField = (field: string): ParentActionState => ({
  state: "validation",
  message: "Ellenőrizd a megadott adatokat.",
  code: "VAL-INVALID",
  fieldErrors: {
    [field]: recurringMessage({ state: "validation", fieldErrors: { [field]: "VAL-INVALID" } }),
  },
});

/** A whole number in a text field; empty means none. Anything else is refused. */
function wholeNumber(raw: string): number | undefined | "invalid" {
  const trimmed = raw.trim();
  if (trimmed === "") return undefined;
  return /^\d{1,4}$/.test(trimmed) ? Number(trimmed) : "invalid";
}

/**
 * The fields of the schedule form. Only the shape is checked here (a number is a number, a date is a calendar date,
 * an id is an identifier); the limits, the owner rules and every right are the database's. A new schedule carries no
 * id or version; a change carries both or is refused.
 */
export function readScheduleFields(
  formData: FormData,
  idempotencyKey: string,
): { ok: true; input: RecurringScheduleInput } | { ok: false; state: ParentActionState } {
  const ownerKind = text(formData, "ownerKind");
  if (!["group", "family", "rota_week"].includes(ownerKind)) return { ok: false, state: INVALID };
  const interval = wholeNumber(text(formData, "intervalCount"));
  if (interval === undefined || interval === "invalid")
    return { ok: false, state: refusedField("interval") };
  const startDate = text(formData, "startDate").trim();
  if (!DATE.test(startDate)) return { ok: false, state: refusedField("startDate") };
  const from = wholeNumber(text(formData, "seasonFromMonth"));
  const to = wholeNumber(text(formData, "seasonToMonth"));
  if (from === "invalid" || to === "invalid") return { ok: false, state: refusedField("season") };
  const changing = text(formData, "scheduleId") !== "";
  const scheduleId = uuidField(formData, "scheduleId");
  const expectedVersion = versionField(formData);
  if (changing && (!scheduleId || expectedVersion === undefined))
    return { ok: false, state: INVALID };
  const workingGroupId = uuidField(formData, "workingGroupId");
  const familyId = uuidField(formData, "familyId");
  const rotaJob = text(formData, "rotaJob");
  return {
    ok: true,
    input: {
      idempotencyKey,
      title: text(formData, "title").trim(),
      category: text(formData, "category").trim(),
      ownerKind: ownerKind as RecurringOwnerKind,
      intervalCount: interval,
      startDate,
      ...(changing && scheduleId && expectedVersion !== undefined
        ? { scheduleId, expectedVersion }
        : {}),
      ...(workingGroupId ? { workingGroupId } : {}),
      ...(familyId ? { familyId } : {}),
      ...(ROTA_JOBS.includes(rotaJob) ? { rotaJob } : {}),
      ...(from !== undefined ? { seasonFromMonth: from } : {}),
      ...(to !== undefined ? { seasonToMonth: to } : {}),
    },
  };
}
