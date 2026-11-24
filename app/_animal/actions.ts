"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { resolveParentFacade } from "../szulo/_lib/facade.ts";
import { resolveParentSession } from "../szulo/_lib/session.ts";
import { resolveAdminSession } from "../admin/_lib/session.ts";
import type { ParentActionState } from "../szulo/_lib/action-state.ts";
import { mapAnimalResult } from "./animal-result.ts";
import { resolveAnimalCareFacade } from "./facade.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const KEY = /^[A-Za-z0-9][A-Za-z0-9:_-]{7,127}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const NO_ACCESS: ParentActionState = {
  state: "denied",
  message: "Ezt a műveletet nem végezheted el.",
};
const INVALID: ParentActionState = {
  state: "validation",
  message: "A kérés érvénytelen. Frissítsd az oldalt, és próbáld újra.",
  code: "VAL-INVALID",
};

const text = (formData: FormData, field: string): string => {
  const value = formData.get(field);
  return typeof value === "string" ? value : "";
};

function version(formData: FormData, min: number): number | undefined {
  const value = Number(formData.get("expectedVersion"));
  return Number.isInteger(value) && value >= min ? value : undefined;
}

/** Where a parent lands after a slot change: the sign-up page at the row, with a line for the status region. */
function slotPage(message: "jelentkezes" | "lemondas", anchor: string): string {
  const safe = /^[a-z0-9-]{1,40}$/.test(anchor) ? `#${anchor}` : "";
  return `/szulo/allatok?uzenet=${message}${safe}`;
}

/** Signs the parent's family up for a slot: the existing duty sign-up, then back to the row (BR81). */
export async function animalSignUpAction(
  _state: ParentActionState,
  formData: FormData,
): Promise<ParentActionState> {
  const dutyId = text(formData, "id");
  const expectedVersion = version(formData, 1);
  const idempotencyKey = text(formData, "idempotencyKey");
  if (!UUID.test(dutyId) || expectedVersion === undefined || !KEY.test(idempotencyKey)) {
    return INVALID;
  }
  const [session, facade] = await Promise.all([resolveParentSession(), resolveParentFacade()]);
  if (session.state !== "success" || !facade) return NO_ACCESS;
  const result = await facade.signUp(session.data.applicationSession, {
    familyScope: session.data.familyScope,
    familyId: session.data.familyId,
    dutyId,
    expectedVersion,
    idempotencyKey,
  });
  if (result.state !== "success" && result.state !== "recovery") {
    return mapAnimalResult(result, "");
  }
  revalidatePath("/szulo/allatok");
  redirect(slotPage("jelentkezes", text(formData, "anchor")));
}

/** Gives the family's own slot up (BR82); the database repeats the 24-hour and open-swap checks. */
export async function giveUpAction(
  _state: ParentActionState,
  formData: FormData,
): Promise<ParentActionState> {
  const placeId = text(formData, "placeId");
  const expectedVersion = version(formData, 1);
  const idempotencyKey = text(formData, "idempotencyKey");
  if (!UUID.test(placeId) || expectedVersion === undefined || !KEY.test(idempotencyKey)) {
    return INVALID;
  }
  const [session, animal] = await Promise.all([resolveParentSession(), resolveAnimalCareFacade()]);
  if (session.state !== "success" || !animal) return NO_ACCESS;
  const result = await animal.giveUp(session.data.applicationSession, {
    scope: session.data.familyScope,
    idempotencyKey,
    placeId,
    expectedVersion,
  });
  if (result.state !== "success" && result.state !== "recovery") {
    return mapAnimalResult(result, "");
  }
  revalidatePath("/szulo/allatok");
  redirect(slotPage("lemondas", text(formData, "anchor")));
}

async function adminBoundary(formData: FormData) {
  const idempotencyKey = text(formData, "idempotencyKey");
  const schoolYearId = text(formData, "schoolYearId");
  if (!KEY.test(idempotencyKey) || !UUID.test(schoolYearId)) {
    return { ok: false as const, state: INVALID };
  }
  const [session, animal] = await Promise.all([resolveAdminSession(), resolveAnimalCareFacade()]);
  if (session.state !== "success" || !animal) return { ok: false as const, state: NO_ACCESS };
  return { ok: true as const, session, animal, idempotencyKey, schoolYearId };
}

/** Saves the year's two start times and the alert group (BR80.1); version 0 means the year has no settings yet. */
export async function saveCalendarAction(
  _state: ParentActionState,
  formData: FormData,
): Promise<ParentActionState> {
  const ctx = await adminBoundary(formData);
  if (!ctx.ok) return ctx.state;
  const morningStart = text(formData, "morningStart");
  const afternoonStart = text(formData, "afternoonStart");
  const expectedVersion = version(formData, 0);
  if (expectedVersion === undefined) return INVALID;
  if (!TIME.test(morningStart) || !TIME.test(afternoonStart)) {
    return {
      state: "validation",
      message: "Add meg mindkét kezdési időt óra:perc alakban.",
      code: "VAL-INVALID",
    };
  }
  const careGroupId = text(formData, "careGroupId");
  const result = await ctx.animal.saveCalendar(ctx.session.data.applicationSession, {
    scope: ctx.session.data.scope,
    idempotencyKey: ctx.idempotencyKey,
    schoolYearId: ctx.schoolYearId,
    morningStart,
    afternoonStart,
    ...(UUID.test(careGroupId) ? { careGroupId } : {}),
    expectedVersion,
  });
  if (result.state === "success" || result.state === "recovery") {
    revalidatePath("/admin/allatgondozas");
  }
  return mapAnimalResult(result, "A beállítások mentve.");
}

/** Creates the year's slots; the result says how many were added (BR80.3). */
export async function createSlotsAction(
  _state: ParentActionState,
  formData: FormData,
): Promise<ParentActionState> {
  const ctx = await adminBoundary(formData);
  if (!ctx.ok) return ctx.state;
  const result = await ctx.animal.createSlots(ctx.session.data.applicationSession, {
    scope: ctx.session.data.scope,
    idempotencyKey: ctx.idempotencyKey,
    schoolYearId: ctx.schoolYearId,
  });
  if (result.state === "success" || result.state === "recovery") {
    revalidatePath("/admin/allatgondozas");
    revalidatePath("/szulo/allatok");
    const added = result.state === "success" ? (result.data.added ?? 0) : 0;
    return {
      state: "success",
      message: added > 0 ? `${added} időpont létrejött.` : "Nem jött létre új időpont.",
      code: result.code,
    };
  }
  return mapAnimalResult(result, "");
}
