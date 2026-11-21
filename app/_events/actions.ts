"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Scope } from "../../src/access/index.ts";
import { budapestLocalToIso } from "../../src/application/budapest-time.ts";
import { FOOD_CATEGORIES, type FoodCategory } from "../../src/application/contracts.ts";
import { manageScopeFor, noticeLines } from "../../src/application/event-format.ts";
import { normalizeRequiredText, validation } from "../../src/application/index.ts";
import { resolveAdminFacade } from "../admin/_lib/facade.ts";
import type { ParentActionState } from "../szulo/_lib/action-state.ts";
import { isEventArea, resolveEventActor, type EventActor } from "./actor.ts";
import { parseEventForm } from "./event-payload.ts";
import { mapEventResult } from "./event-result.ts";
import { resolveEventFacade } from "./facade.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const KEY = /^[A-Za-z0-9][A-Za-z0-9:_-]{7,127}$/;
const NO_ACCESS: ParentActionState = { state: "denied", message: "Ez az esemény nem érhető el." };
const INVALID: ParentActionState = {
  state: "validation",
  message: "A kérés érvénytelen. Frissítsd az oldalt, és próbáld újra.",
  code: "VAL-INVALID",
};

const text = (formData: FormData, field: string): string => {
  const value = formData.get(field);
  return typeof value === "string" ? value : "";
};

/** The person, the facade and the checked key of one event form; the person comes from the database, never the form. */
async function boundary(formData: FormData) {
  const area = text(formData, "area");
  const idempotencyKey = text(formData, "idempotencyKey");
  if (!isEventArea(area) || !KEY.test(idempotencyKey))
    return { ok: false as const, state: INVALID };
  const [actor, events] = await Promise.all([resolveEventActor(area), resolveEventFacade()]);
  if (!actor || !events) return { ok: false as const, state: NO_ACCESS };
  return { ok: true as const, actor, events, idempotencyKey };
}

function uuidField(formData: FormData, field: string): string | undefined {
  const value = text(formData, field);
  return UUID.test(value) ? value : undefined;
}

function versionField(formData: FormData): number | undefined {
  const value = Number(formData.get("expectedVersion"));
  return Number.isInteger(value) && value >= 1 ? value : undefined;
}

/** Refreshes the event pages of every area, and the group page; an identifier that is not a UUID is never put in a path. */
function refresh(eventId: string | undefined, groupId?: string): void {
  for (const area of ["szulo", "teacher", "admin"]) {
    revalidatePath(`/${area}/esemenyek`);
    if (eventId && UUID.test(eventId)) revalidatePath(`/${area}/esemenyek/${eventId}`);
    if (groupId && UUID.test(groupId)) revalidatePath(`/${area}/munkacsoportok/${groupId}`);
  }
}

/** The family scope of a parent's own act (the area is the parent's; anyone else is refused by the facade). */
function ownScope(actor: EventActor): Scope {
  return actor.scope;
}

/** A parent signs up for an event, with a note and an optional time inside the event (BR108). */
export async function addSignupAction(
  _state: ParentActionState,
  formData: FormData,
): Promise<ParentActionState> {
  const ctx = await boundary(formData);
  if (!ctx.ok) return ctx.state;
  const eventId = uuidField(formData, "eventId");
  const chosen = readChosenAt(formData);
  if (!eventId) return INVALID;
  if (chosen.error) return chosen.error;
  const result = await ctx.events.addSignup(ctx.actor.session, {
    scope: ownScope(ctx.actor),
    idempotencyKey: ctx.idempotencyKey,
    eventId,
    ...noteOf(formData),
    ...(chosen.value ? { chosenAt: chosen.value } : {}),
  });
  if (result.state === "success") refresh(eventId);
  return mapEventResult(result, "Jelentkezésedet rögzítettük.");
}

export async function changeSignupAction(
  _state: ParentActionState,
  formData: FormData,
): Promise<ParentActionState> {
  const ctx = await boundary(formData);
  if (!ctx.ok) return ctx.state;
  const signupId = uuidField(formData, "signupId");
  const expectedVersion = versionField(formData);
  const chosen = readChosenAt(formData);
  if (!signupId || expectedVersion === undefined) return INVALID;
  if (chosen.error) return chosen.error;
  const result = await ctx.events.changeSignup(ctx.actor.session, {
    scope: ownScope(ctx.actor),
    idempotencyKey: ctx.idempotencyKey,
    signupId,
    expectedVersion,
    ...noteOf(formData),
    ...(chosen.value ? { chosenAt: chosen.value } : {}),
  });
  if (result.state === "success") refresh(uuidField(formData, "eventId"));
  return mapEventResult(result, "A jelentkezést módosítottuk.");
}

/** Withdrawing is allowed on a finished or cancelled event too; a manager may withdraw anyone's (BR110.1). */
export async function withdrawSignupAction(
  _state: ParentActionState,
  formData: FormData,
): Promise<ParentActionState> {
  const ctx = await boundary(formData);
  if (!ctx.ok) return ctx.state;
  const signupId = uuidField(formData, "signupId");
  const expectedVersion = versionField(formData);
  if (!signupId || expectedVersion === undefined) return INVALID;
  const asManager = text(formData, "asManager") === "1";
  const result = await ctx.events.withdrawSignup(ctx.actor.session, {
    scope: asManager
      ? manageScopeFor(ctx.actor.session, ctx.actor.scope, uuidField(formData, "groupId"))
      : ownScope(ctx.actor),
    idempotencyKey: ctx.idempotencyKey,
    signupId,
    expectedVersion,
    asManager,
  });
  if (result.state === "success") refresh(uuidField(formData, "eventId"));
  return mapEventResult(result, "A jelentkezést visszavontuk.");
}

const isCategory = (value: string): value is FoodCategory =>
  (FOOD_CATEGORIES as readonly string[]).includes(value);

/** A parent offers a dish: one of eight categories, a short text and three ingredient ticks (BR113). */
export async function addOfferAction(
  _state: ParentActionState,
  formData: FormData,
): Promise<ParentActionState> {
  const ctx = await boundary(formData);
  if (!ctx.ok) return ctx.state;
  const eventId = uuidField(formData, "eventId");
  const category = text(formData, "category");
  if (!eventId) return INVALID;
  const dish = normalizeRequiredText(formData.get("text"), "text", 200);
  if (dish.state === "validation") {
    return mapEventResult(
      validation({ text: "Add meg, mit szeretnél hozni (legfeljebb 200 karakter)." }),
      "",
    );
  }
  if (!isCategory(category)) {
    return mapEventResult(validation({ category: "Válassz kategóriát." }), "");
  }
  const result = await ctx.events.addOffer(ctx.actor.session, {
    scope: ownScope(ctx.actor),
    idempotencyKey: ctx.idempotencyKey,
    eventId,
    category,
    text: dish.data,
    hasMilk: formData.get("hasMilk") === "on",
    hasEgg: formData.get("hasEgg") === "on",
    hasGarlic: formData.get("hasGarlic") === "on",
  });
  if (result.state === "success") refresh(eventId);
  return mapEventResult(result, "Az ételfelajánlásodat rögzítettük.");
}

/** A parent changes their own offer: category, text and ticks, with the version the screen showed (BR113, BR116.1). */
export async function changeOfferAction(
  _state: ParentActionState,
  formData: FormData,
): Promise<ParentActionState> {
  const ctx = await boundary(formData);
  if (!ctx.ok) return ctx.state;
  const offerId = uuidField(formData, "offerId");
  const expectedVersion = versionField(formData);
  const category = text(formData, "category");
  if (!offerId || expectedVersion === undefined) return INVALID;
  const dish = normalizeRequiredText(formData.get("text"), "text", 200);
  if (dish.state === "validation") {
    return mapEventResult(
      validation({ text: "Add meg, mit szeretnél hozni (legfeljebb 200 karakter)." }),
      "",
    );
  }
  if (!isCategory(category)) {
    return mapEventResult(validation({ category: "Válassz kategóriát." }), "");
  }
  const result = await ctx.events.changeOffer(ctx.actor.session, {
    scope: ownScope(ctx.actor),
    idempotencyKey: ctx.idempotencyKey,
    offerId,
    expectedVersion,
    category,
    text: dish.data,
    hasMilk: formData.get("hasMilk") === "on",
    hasEgg: formData.get("hasEgg") === "on",
    hasGarlic: formData.get("hasGarlic") === "on",
  });
  if (result.state === "success") refresh(uuidField(formData, "eventId"));
  return mapEventResult(result, "Az ételfelajánlást módosítottuk.");
}

export async function withdrawOfferAction(
  _state: ParentActionState,
  formData: FormData,
): Promise<ParentActionState> {
  const ctx = await boundary(formData);
  if (!ctx.ok) return ctx.state;
  const offerId = uuidField(formData, "offerId");
  const expectedVersion = versionField(formData);
  if (!offerId || expectedVersion === undefined) return INVALID;
  const asManager = text(formData, "asManager") === "1";
  const result = await ctx.events.withdrawOffer(ctx.actor.session, {
    scope: asManager
      ? manageScopeFor(ctx.actor.session, ctx.actor.scope, uuidField(formData, "groupId"))
      : ownScope(ctx.actor),
    idempotencyKey: ctx.idempotencyKey,
    offerId,
    expectedVersion,
    asManager,
  });
  if (result.state === "success") refresh(uuidField(formData, "eventId"));
  return mapEventResult(result, "Az ételfelajánlást visszavontuk.");
}

/** Creates or changes an event's own fields through the same save the admin form uses (BR100, BR102). */
export async function saveEventAction(
  _state: ParentActionState,
  formData: FormData,
): Promise<ParentActionState> {
  const ctx = await boundary(formData);
  if (!ctx.ok) return ctx.state;
  const rawId = text(formData, "id");
  const creating = rawId === "new";
  const eventId = creating ? undefined : uuidField(formData, "id");
  const expectedVersion = creating ? 1 : versionField(formData);
  if ((!creating && !eventId) || expectedVersion === undefined) return INVALID;
  const title = normalizeRequiredText(formData.get("title"), "title", 120);
  if (title.state === "validation") {
    return mapEventResult(
      validation({
        title:
          title.fieldErrors?.title === "VAL-TOO-LONG"
            ? "A megnevezés legfeljebb 120 karakter hosszú lehet."
            : "A megnevezés megadása kötelező.",
      }),
      "",
    );
  }
  const form = parseEventForm(formData, creating);
  if (Object.keys(form.errors).length > 0) return mapEventResult(validation(form.errors), "");
  const admin = await resolveAdminFacade();
  if (!admin) return NO_ACCESS;
  const groupChoice = form.payload.groupId;
  const result = await admin.saveTaskOrEvent(ctx.actor.session, {
    scope: manageScopeFor(
      ctx.actor.session,
      ctx.actor.scope,
      groupChoice && UUID.test(groupChoice) ? groupChoice : uuidField(formData, "currentGroupId"),
    ),
    id: creating ? "new" : eventId!,
    expectedVersion,
    idempotencyKey: ctx.idempotencyKey,
    payload: { ...form.payload, title: title.data, kind: "event" },
  });
  if (result.state === "success") {
    refresh(result.data.id, groupChoice);
    redirect(`${ctx.actor.basePath}/${result.data.id}/szerkesztes?mentve=${creating ? "uj" : "1"}`);
  }
  return mapEventResult(result, "Az esemény mentése sikerült.");
}

/** Cancels an event: the status changes to cancelled, which tells the families and closes its open tasks (BR118). */
export async function cancelEventAction(
  _state: ParentActionState,
  formData: FormData,
): Promise<ParentActionState> {
  const ctx = await boundary(formData);
  if (!ctx.ok) return ctx.state;
  const eventId = uuidField(formData, "eventId");
  const expectedVersion = versionField(formData);
  const admin = await resolveAdminFacade();
  if (!eventId || expectedVersion === undefined) return INVALID;
  if (!admin) return NO_ACCESS;
  const groupId = uuidField(formData, "groupId");
  const result = await admin.saveTaskOrEvent(ctx.actor.session, {
    scope: manageScopeFor(ctx.actor.session, ctx.actor.scope, groupId),
    id: eventId,
    expectedVersion,
    idempotencyKey: ctx.idempotencyKey,
    payload: { kind: "event", status: "cancelled" },
  });
  if (result.state === "success") refresh(eventId, groupId);
  return mapEventResult(result, "Az eseményt lemondtuk.");
}

/** Replaces the notices at the top of an event: one per line, up to ten (BR103). */
export async function saveNoticesAction(
  _state: ParentActionState,
  formData: FormData,
): Promise<ParentActionState> {
  const ctx = await boundary(formData);
  if (!ctx.ok) return ctx.state;
  const eventId = uuidField(formData, "eventId");
  const expectedVersion = versionField(formData);
  if (!eventId || expectedVersion === undefined) return INVALID;
  const notices = noticeLines(text(formData, "notices"));
  if (notices.length > 10) {
    return mapEventResult(validation({ notices: "VAL-TOO-MANY" }), "");
  }
  if (notices.some((line) => line.length > 300)) {
    return mapEventResult(
      validation({ notices: "Egy tudnivaló legfeljebb 300 karakter hosszú lehet." }),
      "",
    );
  }
  const result = await ctx.events.saveNotices(ctx.actor.session, {
    scope: manageScopeFor(ctx.actor.session, ctx.actor.scope, uuidField(formData, "groupId")),
    idempotencyKey: ctx.idempotencyKey,
    eventId,
    expectedVersion,
    notices,
  });
  if (result.state === "success") refresh(eventId);
  return mapEventResult(result, "A tudnivalókat mentettük.");
}

export async function saveTaleAction(
  _state: ParentActionState,
  formData: FormData,
): Promise<ParentActionState> {
  const ctx = await boundary(formData);
  if (!ctx.ok) return ctx.state;
  const eventId = uuidField(formData, "eventId");
  const expectedVersion = versionField(formData);
  if (!eventId || expectedVersion === undefined) return INVALID;
  const result = await ctx.events.saveTale(ctx.actor.session, {
    scope: manageScopeFor(ctx.actor.session, ctx.actor.scope, uuidField(formData, "groupId")),
    idempotencyKey: ctx.idempotencyKey,
    eventId,
    expectedVersion,
    tale: text(formData, "tale").trim(),
  });
  if (result.state === "success") refresh(eventId);
  return mapEventResult(result, "Az év meséjét mentettük.");
}

/** Adds a role (no role id) or changes one; a role holds exactly one of a parent and a typed name (BR105.1). */
export async function saveRoleAction(
  _state: ParentActionState,
  formData: FormData,
): Promise<ParentActionState> {
  const ctx = await boundary(formData);
  if (!ctx.ok) return ctx.state;
  const eventId = uuidField(formData, "eventId");
  if (!eventId) return INVALID;
  const roleId = uuidField(formData, "roleId");
  const expectedVersion = versionField(formData);
  if (text(formData, "roleId") !== "" && (!roleId || expectedVersion === undefined)) return INVALID;
  const name = normalizeRequiredText(formData.get("name"), "name", 100);
  if (name.state === "validation") {
    return mapEventResult(validation({ name: "A szerep megnevezése kötelező." }), "");
  }
  const parentId = uuidField(formData, "parentId");
  const personName = text(formData, "personName").trim();
  if (personName.length > 200) {
    return mapEventResult(
      validation({ personName: "A név legfeljebb 200 karakter hosszú lehet." }),
      "",
    );
  }
  const result = await ctx.events.saveRole(ctx.actor.session, {
    scope: manageScopeFor(ctx.actor.session, ctx.actor.scope, uuidField(formData, "groupId")),
    idempotencyKey: ctx.idempotencyKey,
    eventId,
    name: name.data,
    isOrganiser: formData.get("isOrganiser") === "on",
    ...(roleId && expectedVersion !== undefined ? { roleId, expectedVersion } : {}),
    ...(parentId ? { parentId } : {}),
    ...(personName ? { personName } : {}),
  });
  if (result.state === "success") refresh(eventId);
  return mapEventResult(result, "A szerepet mentettük.");
}

export async function removeRoleAction(
  _state: ParentActionState,
  formData: FormData,
): Promise<ParentActionState> {
  const ctx = await boundary(formData);
  if (!ctx.ok) return ctx.state;
  const roleId = uuidField(formData, "roleId");
  const expectedVersion = versionField(formData);
  if (!roleId || expectedVersion === undefined) return INVALID;
  const result = await ctx.events.removeRole(ctx.actor.session, {
    scope: manageScopeFor(ctx.actor.session, ctx.actor.scope, uuidField(formData, "groupId")),
    idempotencyKey: ctx.idempotencyKey,
    roleId,
    expectedVersion,
  });
  if (result.state === "success") refresh(uuidField(formData, "eventId"));
  return mapEventResult(result, "A szerepet töröltük.");
}

function noteOf(formData: FormData): { note?: string } {
  const note = text(formData, "note").trim();
  return note === "" ? {} : { note: note.slice(0, 500) };
}

function readChosenAt(formData: FormData): { value?: string; error?: ParentActionState } {
  const raw = text(formData, "chosenAt").trim();
  if (raw === "") return {};
  const iso = budapestLocalToIso(raw);
  return iso
    ? { value: iso }
    : {
        error: mapEventResult(validation({ chosenAt: "Adj meg érvényes dátumot és időt." }), ""),
      };
}
