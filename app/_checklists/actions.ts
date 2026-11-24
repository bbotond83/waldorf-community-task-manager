"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ApplicationResult } from "../../src/application/index.ts";
import { manageScopeFor } from "../../src/application/event-format.ts";
import { isEventArea, resolveEventActor } from "../_events/actor.ts";
import type { ParentActionState } from "../szulo/_lib/action-state.ts";
import {
  INVALID,
  isChecklistKey,
  NO_ACCESS,
  readSectionFields,
  readTaskFields,
  readTemplatePayload,
  text,
  uuidField,
  versionField,
} from "./checklist-form.ts";
import { mapChecklistResult } from "./checklist-result.ts";
import { resolveChecklistFacade } from "./facade.ts";

const succeeded = (result: ApplicationResult<unknown>): boolean =>
  result.state === "success" || result.state === "recovery";

/** Refreshes the pages that show an event's checklist or a template list, in every area. */
function refresh(eventId?: string, groupId?: string): void {
  for (const area of ["szulo", "teacher", "admin"]) {
    if (eventId) {
      revalidatePath(`/${area}/esemenyek/${eventId}`);
      revalidatePath(`/${area}/esemenyek/${eventId}/feladatlista`);
    }
    if (groupId) revalidatePath(`/${area}/munkacsoportok/${groupId}/sablonok`);
  }
  revalidatePath("/admin/sablonok");
}

/** The person, the facade and the checked key of one checklist form; the person comes from the database, never the form. */
async function boundary(formData: FormData) {
  const area = text(formData, "area");
  const idempotencyKey = text(formData, "idempotencyKey");
  if (!isEventArea(area) || !isChecklistKey(idempotencyKey)) {
    return { ok: false as const, state: INVALID };
  }
  const [actor, checklists] = await Promise.all([
    resolveEventActor(area),
    resolveChecklistFacade(),
  ]);
  if (!actor || !checklists) return { ok: false as const, state: NO_ACCESS };
  return { ok: true as const, actor, checklists, idempotencyKey };
}

type Boundary = Extract<Awaited<ReturnType<typeof boundary>>, { ok: true }>;

/** The scope of a team or template command: a super admin's own, or the group grant of the group the form names. */
const managerScope = (ctx: Boundary, formData: FormData) =>
  manageScopeFor(ctx.actor.session, ctx.actor.scope, uuidField(formData, "groupId"));

/** A parent claims a task as their own act. */
export async function claimTaskAction(
  _state: ParentActionState,
  formData: FormData,
): Promise<ParentActionState> {
  const ctx = await boundary(formData);
  if (!ctx.ok) return ctx.state;
  const taskId = uuidField(formData, "taskId");
  if (!taskId) return INVALID;
  const result = await ctx.checklists.claim(ctx.actor.session, {
    scope: ctx.actor.scope,
    idempotencyKey: ctx.idempotencyKey,
    taskId,
  });
  if (succeeded(result)) refresh(uuidField(formData, "eventId"));
  return mapChecklistResult(result, "Elvállaltad a feladatot.");
}

/** The owner gives their claim up; the organising team removes another's with `asManager`. */
export async function withdrawClaimAction(
  _state: ParentActionState,
  formData: FormData,
): Promise<ParentActionState> {
  const ctx = await boundary(formData);
  if (!ctx.ok) return ctx.state;
  const claimId = uuidField(formData, "claimId");
  const expectedVersion = versionField(formData);
  if (!claimId || expectedVersion === undefined) return INVALID;
  const asManager = text(formData, "asManager") === "1";
  const result = await ctx.checklists.withdrawClaim(ctx.actor.session, {
    scope: asManager ? managerScope(ctx, formData) : ctx.actor.scope,
    idempotencyKey: ctx.idempotencyKey,
    claimId,
    expectedVersion,
    asManager,
  });
  if (succeeded(result)) refresh(uuidField(formData, "eventId"));
  return mapChecklistResult(result, "A vállalás visszavonva.");
}

async function doneChange(formData: FormData, kind: "mark" | "undo"): Promise<ParentActionState> {
  const ctx = await boundary(formData);
  if (!ctx.ok) return ctx.state;
  const taskId = uuidField(formData, "taskId");
  const expectedVersion = versionField(formData);
  if (!taskId || expectedVersion === undefined) return INVALID;
  const input = {
    scope: ctx.actor.scope,
    idempotencyKey: ctx.idempotencyKey,
    taskId,
    expectedVersion,
  };
  const result =
    kind === "mark"
      ? await ctx.checklists.markDone(ctx.actor.session, input)
      : await ctx.checklists.undoDone(ctx.actor.session, input);
  if (succeeded(result)) refresh(uuidField(formData, "eventId"));
  return mapChecklistResult(
    result,
    kind === "mark" ? "Késznek jelölted." : "A kész jelölés visszavonva.",
  );
}

export async function markTaskDoneAction(
  _state: ParentActionState,
  formData: FormData,
): Promise<ParentActionState> {
  return doneChange(formData, "mark");
}

export async function undoTaskDoneAction(
  _state: ParentActionState,
  formData: FormData,
): Promise<ParentActionState> {
  return doneChange(formData, "undo");
}

/** Adds a section to an event's list, or changes one. */
export async function saveSectionAction(
  _state: ParentActionState,
  formData: FormData,
): Promise<ParentActionState> {
  const ctx = await boundary(formData);
  if (!ctx.ok) return ctx.state;
  const eventId = uuidField(formData, "eventId");
  const checklistVersion = versionField(formData, "checklistVersion");
  const fields = readSectionFields(formData);
  if (!eventId || checklistVersion === undefined || !fields.ok) return INVALID;
  const result = await ctx.checklists.saveSection(ctx.actor.session, {
    scope: managerScope(ctx, formData),
    idempotencyKey: ctx.idempotencyKey,
    eventId,
    expectedChecklistVersion: checklistVersion,
    section: fields.section,
  });
  if (succeeded(result)) refresh(eventId);
  return mapChecklistResult(result, "A rész mentve.");
}

export async function removeSectionAction(
  _state: ParentActionState,
  formData: FormData,
): Promise<ParentActionState> {
  const ctx = await boundary(formData);
  if (!ctx.ok) return ctx.state;
  const sectionId = uuidField(formData, "sectionId");
  const checklistVersion = versionField(formData, "checklistVersion");
  if (!sectionId || checklistVersion === undefined) return INVALID;
  const result = await ctx.checklists.removeSection(ctx.actor.session, {
    scope: managerScope(ctx, formData),
    idempotencyKey: ctx.idempotencyKey,
    sectionId,
    expectedChecklistVersion: checklistVersion,
  });
  if (succeeded(result)) refresh(uuidField(formData, "eventId"));
  return mapChecklistResult(result, "A rész törölve.");
}

/** Adds a task to a section of an event's list, or changes one. */
export async function saveTaskAction(
  _state: ParentActionState,
  formData: FormData,
): Promise<ParentActionState> {
  const ctx = await boundary(formData);
  if (!ctx.ok) return ctx.state;
  const eventId = uuidField(formData, "eventId");
  const checklistVersion = versionField(formData, "checklistVersion");
  const fields = readTaskFields(formData);
  if (!eventId || checklistVersion === undefined || !fields.ok) return INVALID;
  const result = await ctx.checklists.saveTask(ctx.actor.session, {
    scope: managerScope(ctx, formData),
    idempotencyKey: ctx.idempotencyKey,
    eventId,
    expectedChecklistVersion: checklistVersion,
    task: fields.task,
  });
  if (succeeded(result)) refresh(eventId);
  return mapChecklistResult(result, "A feladat mentve.");
}

export async function removeTaskAction(
  _state: ParentActionState,
  formData: FormData,
): Promise<ParentActionState> {
  const ctx = await boundary(formData);
  if (!ctx.ok) return ctx.state;
  const taskId = uuidField(formData, "taskId");
  const checklistVersion = versionField(formData, "checklistVersion");
  if (!taskId || checklistVersion === undefined) return INVALID;
  const result = await ctx.checklists.removeTask(ctx.actor.session, {
    scope: managerScope(ctx, formData),
    idempotencyKey: ctx.idempotencyKey,
    taskId,
    expectedChecklistVersion: checklistVersion,
  });
  if (succeeded(result)) refresh(uuidField(formData, "eventId"));
  return mapChecklistResult(result, "A feladat törölve.");
}

/**
 * Moves a task or a section one place up or down. The page sends the full order it was drawn with (`order`, a JSON list
 * of sections with their task ids); the database refuses an order that no longer matches the list.
 */
export async function reorderAction(
  _state: ParentActionState,
  formData: FormData,
): Promise<ParentActionState> {
  const ctx = await boundary(formData);
  if (!ctx.ok) return ctx.state;
  const eventId = uuidField(formData, "eventId");
  const checklistVersion = versionField(formData, "checklistVersion");
  let order: unknown;
  try {
    order = JSON.parse(text(formData, "order"));
  } catch {
    return INVALID;
  }
  if (!eventId || checklistVersion === undefined || !Array.isArray(order)) return INVALID;
  const result = await ctx.checklists.reorder(ctx.actor.session, {
    scope: managerScope(ctx, formData),
    idempotencyKey: ctx.idempotencyKey,
    eventId,
    expectedChecklistVersion: checklistVersion,
    order: order as never,
  });
  if (succeeded(result)) refresh(eventId);
  return mapChecklistResult(result, "A sorrend mentve.");
}

/** Copies a template into an event's empty list. */
export async function copyTemplateAction(
  _state: ParentActionState,
  formData: FormData,
): Promise<ParentActionState> {
  const ctx = await boundary(formData);
  if (!ctx.ok) return ctx.state;
  const eventId = uuidField(formData, "eventId");
  const templateId = uuidField(formData, "templateId");
  if (!eventId || !templateId) return INVALID;
  const result = await ctx.checklists.copyTemplate(ctx.actor.session, {
    scope: managerScope(ctx, formData),
    idempotencyKey: ctx.idempotencyKey,
    eventId,
    templateId,
  });
  if (succeeded(result)) refresh(eventId);
  return mapChecklistResult(result, "A sablon feladatai bemásolva.");
}

/** Saves a whole template (the editor sends it as one document), or adds one. A new template goes back to the list. */
export async function saveTemplateAction(
  _state: ParentActionState,
  formData: FormData,
): Promise<ParentActionState> {
  const ctx = await boundary(formData);
  if (!ctx.ok) return ctx.state;
  const groupId = uuidField(formData, "groupId");
  const fields = readTemplatePayload(formData, groupId);
  if (!fields.ok) return INVALID;
  const creating = text(formData, "templateId") === "";
  const result = await ctx.checklists.saveTemplate(ctx.actor.session, {
    scope: managerScope(ctx, formData),
    idempotencyKey: ctx.idempotencyKey,
    template: fields.template,
  });
  if (succeeded(result)) {
    refresh(undefined, groupId);
    const back = text(formData, "backHref");
    if (creating && back.startsWith("/")) redirect(`${back}?mentve=1`);
  }
  return mapChecklistResult(result, "A sablon mentve.");
}

/** Removes a template from the choice for new events, or brings it back. Events that used it keep their lists. */
export async function setTemplateRemovedAction(
  _state: ParentActionState,
  formData: FormData,
): Promise<ParentActionState> {
  const ctx = await boundary(formData);
  if (!ctx.ok) return ctx.state;
  const templateId = uuidField(formData, "templateId");
  const expectedVersion = versionField(formData);
  const removed = text(formData, "removed");
  if (!templateId || expectedVersion === undefined || !["true", "false"].includes(removed)) {
    return INVALID;
  }
  const result = await ctx.checklists.setTemplateRemoved(ctx.actor.session, {
    scope: managerScope(ctx, formData),
    idempotencyKey: ctx.idempotencyKey,
    templateId,
    expectedVersion,
    removed: removed === "true",
  });
  if (succeeded(result)) refresh(undefined, uuidField(formData, "groupId"));
  return mapChecklistResult(
    result,
    removed === "true" ? "A sablon törölve." : "A sablon visszaállítva.",
  );
}
