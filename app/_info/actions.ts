"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ParentActionState } from "../szulo/_lib/action-state.ts";
import { mapAnimalResult } from "../_animal/animal-result.ts";
import { resolveInformationFacade } from "../_animal/facade.ts";
import { resolveInfoActor } from "./actor.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const KEY = /^[A-Za-z0-9][A-Za-z0-9:_-]{7,127}$/;
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

async function boundary(formData: FormData) {
  const idempotencyKey = text(formData, "idempotencyKey");
  if (!KEY.test(idempotencyKey)) return { ok: false as const, state: INVALID };
  const [actor, information] = await Promise.all([resolveInfoActor(), resolveInformationFacade()]);
  if (!actor || !information) return { ok: false as const, state: NO_ACCESS };
  return { ok: true as const, actor, information, idempotencyKey };
}

function versionField(formData: FormData): number | undefined {
  const value = Number(formData.get("expectedVersion"));
  return Number.isInteger(value) && value >= 1 ? value : undefined;
}

/** The season months a form sends, one checkbox per month; anything outside 1 to 12 is left for the database to refuse. */
function monthsField(formData: FormData): number[] {
  return formData
    .getAll("seasonMonth")
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value));
}

/** Saves the text, or the whole section for a super admin, and returns to the page (BR87). A new section has no id. */
export async function saveSectionAction(
  _state: ParentActionState,
  formData: FormData,
): Promise<ParentActionState> {
  const ctx = await boundary(formData);
  if (!ctx.ok) return ctx.state;
  const rawId = text(formData, "sectionId");
  const changing = rawId !== "";
  const sectionId = UUID.test(rawId) ? rawId : undefined;
  const expectedVersion = versionField(formData);
  if (changing && (!sectionId || expectedVersion === undefined)) return INVALID;
  const position = Number(text(formData, "position") || "0");
  if (!Number.isInteger(position)) return INVALID;
  const owningGroupName = text(formData, "owningGroupName").trim();
  const months = monthsField(formData);
  const fields = {
    scope: ctx.actor.scope,
    idempotencyKey: ctx.idempotencyKey,
    title: text(formData, "title").trim(),
    body: text(formData, "body"),
    position,
    ...(owningGroupName ? { owningGroupName } : {}),
    ...(months.length ? { seasonMonths: months } : {}),
  };
  const result =
    changing && sectionId && expectedVersion !== undefined
      ? await ctx.information.update(ctx.actor.session, { ...fields, sectionId, expectedVersion })
      : await ctx.information.create(ctx.actor.session, fields);
  if (result.state !== "success" && result.state !== "recovery") return mapAnimalResult(result, "");
  revalidatePath("/informacio");
  redirect("/informacio");
}

/** Hides or restores a section (a super admin's act). */
export async function setHiddenAction(
  _state: ParentActionState,
  formData: FormData,
): Promise<ParentActionState> {
  const ctx = await boundary(formData);
  if (!ctx.ok) return ctx.state;
  const sectionId = text(formData, "sectionId");
  const expectedVersion = versionField(formData);
  const hidden = text(formData, "hidden") === "true";
  if (!UUID.test(sectionId) || expectedVersion === undefined) return INVALID;
  const result = await ctx.information.setHidden(ctx.actor.session, {
    scope: ctx.actor.scope,
    idempotencyKey: ctx.idempotencyKey,
    sectionId,
    hidden,
    expectedVersion,
  });
  if (result.state === "success" || result.state === "recovery") revalidatePath("/informacio");
  return mapAnimalResult(result, hidden ? "A szakasz el van rejtve." : "A szakasz újra látszik.");
}
