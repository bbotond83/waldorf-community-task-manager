"use server";

import { revalidatePath } from "next/cache";
import type { ApplicationResult, SessionContext } from "../../src/application/index.ts";
import type { Scope } from "../../src/access/index.ts";
import type { ParentActionState } from "../szulo/_lib/action-state.ts";
import {
  RECURRING_BASE_PATH,
  resolveRecurringManager,
  resolveRecurringParent,
  type RecurringManager,
} from "./actor.ts";
import { resolveRecurringFacade } from "./facade.ts";
import {
  INVALID,
  isRecurringKey,
  NO_ACCESS,
  readScheduleFields,
  text,
  uuidField,
  versionField,
} from "./recurring-form.ts";
import { mapRecurringResult } from "./recurring-result.ts";

const succeeded = (result: ApplicationResult<unknown>): boolean =>
  result.state === "success" || result.state === "recovery";

/** Refreshes the recurring pages and, for a group that is an identifier, its page in every area. */
function refresh(groupId?: string): void {
  for (const base of Object.values(RECURRING_BASE_PATH)) revalidatePath(base);
  if (groupId) {
    for (const area of ["szulo", "teacher", "admin"]) {
      revalidatePath(`/${area}/munkacsoportok/${groupId}`);
      revalidatePath(`/${area}/munkacsoportok/${groupId}/ismetlodo`);
    }
  }
}

/** The facade and the checked key of one form, or the answer that refuses it before the database. */
async function boundary(formData: FormData) {
  const idempotencyKey = text(formData, "idempotencyKey");
  if (!isRecurringKey(idempotencyKey)) return { ok: false as const, state: INVALID };
  const facade = await resolveRecurringFacade();
  if (!facade) return { ok: false as const, state: NO_ACCESS };
  return { ok: true as const, facade, idempotencyKey };
}

/** A coordinator or super admin and the scope of the group the form names, or the refusal. */
async function manager(
  groupId: string | undefined,
): Promise<{ ok: true; session: SessionContext; scope: Scope } | { ok: false }> {
  const found: RecurringManager | undefined = await resolveRecurringManager();
  const scope = found?.scopeFor(groupId);
  return found && scope ? { ok: true, session: found.session, scope } : { ok: false };
}

/** Adds a schedule (BR142) or, with its id and version, changes one. A group's schedule is a coordinator's; every other owner is a super admin's. */
export async function saveScheduleAction(
  _state: ParentActionState,
  formData: FormData,
): Promise<ParentActionState> {
  const ctx = await boundary(formData);
  if (!ctx.ok) return ctx.state;
  const fields = readScheduleFields(formData, ctx.idempotencyKey);
  if (!fields.ok) return fields.state;
  const groupId = fields.input.ownerKind === "group" ? fields.input.workingGroupId : undefined;
  const who = await manager(groupId);
  if (!who.ok) return NO_ACCESS;
  const result = await ctx.facade.saveSchedule(who.session, { scope: who.scope, ...fields.input });
  if (succeeded(result)) refresh(groupId);
  // The bottle-cleaning interval of the school calendar page is the one rota-week schedule a form changes.
  return mapRecurringResult(
    result,
    fields.input.ownerKind === "rota_week"
      ? "Elmentve. A beállítás a jövőbeli vízhordó hetekre érvényes."
      : "A feladat mentve.",
  );
}

/** Switches a schedule on or off (BR143). Switching on creates nothing at once; the daily run does. */
export async function setScheduleActiveAction(
  _state: ParentActionState,
  formData: FormData,
): Promise<ParentActionState> {
  const ctx = await boundary(formData);
  if (!ctx.ok) return ctx.state;
  const scheduleId = uuidField(formData, "scheduleId");
  const expectedVersion = versionField(formData);
  const active = text(formData, "active");
  if (!scheduleId || expectedVersion === undefined || !["true", "false"].includes(active)) {
    return INVALID;
  }
  const groupId = uuidField(formData, "groupId");
  const who = await manager(groupId);
  if (!who.ok) return NO_ACCESS;
  const result = await ctx.facade.setActive(who.session, {
    scope: who.scope,
    idempotencyKey: ctx.idempotencyKey,
    scheduleId,
    expectedVersion,
    active: active === "true",
  });
  if (succeeded(result)) refresh(groupId);
  return mapRecurringResult(
    result,
    active === "true" ? "A feladat be van kapcsolva." : "A feladat ki van kapcsolva.",
  );
}

/** A parent of the owning family or group marks an occurrence done (BR144). A super admin cannot (D-SEC-1). */
export async function markDoneAction(
  _state: ParentActionState,
  formData: FormData,
): Promise<ParentActionState> {
  const ctx = await boundary(formData);
  if (!ctx.ok) return ctx.state;
  const occurrenceId = uuidField(formData, "occurrenceId");
  const expectedVersion = versionField(formData);
  if (!occurrenceId || expectedVersion === undefined) return INVALID;
  const parent = await resolveRecurringParent();
  if (!parent) return NO_ACCESS;
  const result = await ctx.facade.markDone(parent.session, {
    scope: parent.scope,
    idempotencyKey: ctx.idempotencyKey,
    occurrenceId,
    expectedVersion,
  });
  if (succeeded(result)) refresh(uuidField(formData, "groupId"));
  return mapRecurringResult(result, "Késznek jelölted.");
}

/**
 * Takes a done mark back (BR145): a coordinator or super admin at any time within the 24 hours, the parent who marked
 * it while they still belong to the owner. A named group of the coordinator's decides which of the two acts.
 */
export async function undoDoneAction(
  _state: ParentActionState,
  formData: FormData,
): Promise<ParentActionState> {
  const ctx = await boundary(formData);
  if (!ctx.ok) return ctx.state;
  const occurrenceId = uuidField(formData, "occurrenceId");
  const expectedVersion = versionField(formData);
  if (!occurrenceId || expectedVersion === undefined) return INVALID;
  const groupId = uuidField(formData, "groupId");
  const who = await manager(groupId);
  const parent = who.ok ? undefined : await resolveRecurringParent();
  const actor = who.ok
    ? who
    : parent
      ? { session: parent.session, scope: parent.scope }
      : undefined;
  if (!actor) return NO_ACCESS;
  const result = await ctx.facade.undoDone(actor.session, {
    scope: actor.scope,
    idempotencyKey: ctx.idempotencyKey,
    occurrenceId,
    expectedVersion,
  });
  if (succeeded(result)) refresh(groupId);
  return mapRecurringResult(result, "A kész jelölés visszavonva.");
}

/** A coordinator or super admin skips an occurrence with a reason (BR146). */
export async function skipOccurrenceAction(
  _state: ParentActionState,
  formData: FormData,
): Promise<ParentActionState> {
  const ctx = await boundary(formData);
  if (!ctx.ok) return ctx.state;
  const occurrenceId = uuidField(formData, "occurrenceId");
  const expectedVersion = versionField(formData);
  if (!occurrenceId || expectedVersion === undefined) return INVALID;
  const groupId = uuidField(formData, "groupId");
  const who = await manager(groupId);
  if (!who.ok) return NO_ACCESS;
  const result = await ctx.facade.skip(who.session, {
    scope: who.scope,
    idempotencyKey: ctx.idempotencyKey,
    occurrenceId,
    expectedVersion,
    reason: text(formData, "reason").trim(),
  });
  if (succeeded(result)) refresh(groupId);
  return mapRecurringResult(result, "Kihagytad.");
}
