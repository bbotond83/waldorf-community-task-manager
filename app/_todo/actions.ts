"use server";

import { revalidatePath } from "next/cache";
import type { Scope } from "../../src/access/index.ts";
import type { ApplicationResult, SessionContext } from "../../src/application/index.ts";
import {
  INVALID,
  isRecurringKey,
  NO_ACCESS,
  text,
  uuidField,
  versionField,
} from "../_recurring/recurring-form.ts";
import type { ParentActionState } from "../szulo/_lib/action-state.ts";
import { resolveTodoManager, resolveTodoParent } from "./actor.ts";
import { resolveTodoFacade } from "./facade.ts";
import { readPullTasks, readTodoFields, statusField } from "./todo-form.ts";
import { mapTodoResult } from "./todo-result.ts";

const succeeded = (result: ApplicationResult<unknown>): boolean =>
  result.state === "success" || result.state === "recovery";

/** Refreshes every page that shows to-do tasks, and the group's management page when the form names the group. */
function refresh(groupId?: string): void {
  for (const base of [
    "/szulo/teendok",
    "/teacher/teendok",
    "/admin/teendok",
    "/szulo/feladataim",
  ]) {
    revalidatePath(base);
  }
  if (groupId) {
    revalidatePath(`/szulo/munkacsoportok/${groupId}/kezeles`);
    revalidatePath(`/admin/munkacsoportok/${groupId}/kezeles`);
  }
}

/** The facade and the checked key of one form, or the answer that refuses it before the database. */
async function boundary(formData: FormData) {
  const idempotencyKey = text(formData, "idempotencyKey");
  if (!isRecurringKey(idempotencyKey)) return { ok: false as const, state: INVALID };
  const facade = await resolveTodoFacade();
  if (!facade) return { ok: false as const, state: NO_ACCESS };
  return { ok: true as const, facade, idempotencyKey };
}

/** A coordinator or super admin and the scope of the group the form names (a super admin's is the community's), or the refusal. */
async function manager(
  groupId: string | undefined,
): Promise<{ ok: true; session: SessionContext; scope: Scope } | { ok: false }> {
  const found = await resolveTodoManager();
  const scope = found?.scopeFor(groupId);
  return found && scope ? { ok: true, session: found.session, scope } : { ok: false };
}

/**
 * The person who acts on a task: a parent with a family (scope: the family), otherwise a super admin (scope: the
 * community). The database repeats who may claim, finish or undo, including that a parent of another family may not.
 */
async function taskActor(): Promise<{ session: SessionContext; scope: Scope } | undefined> {
  const parent = await resolveTodoParent();
  if (parent) return { session: parent.session, scope: parent.scope };
  const found = await resolveTodoManager();
  const scope = found?.isSuperAdmin ? found.scopeFor(undefined) : undefined;
  return found && scope ? { session: found.session, scope } : undefined;
}

/** The task id and the version the screen saw, or the refusal. */
function versioned(formData: FormData) {
  const taskId = uuidField(formData, "taskId");
  const expectedVersion = versionField(formData);
  return taskId && expectedVersion !== undefined ? { taskId, expectedVersion } : undefined;
}

/** Adds a task (BR181), or with its id and version changes one (BR182). A group's task is a coordinator's; a family's is a super admin's. */
export async function saveTodoAction(
  _state: ParentActionState,
  formData: FormData,
): Promise<ParentActionState> {
  const ctx = await boundary(formData);
  if (!ctx.ok) return ctx.state;
  const fields = readTodoFields(formData, ctx.idempotencyKey);
  if (!fields.ok) return fields.state;
  const groupId = fields.input.ownerGroupId;
  const who = await manager(groupId);
  if (!who.ok) return NO_ACCESS;
  const result = await ctx.facade.save(who.session, { scope: who.scope, ...fields.input });
  if (succeeded(result)) refresh(groupId);
  return mapTodoResult(result, "A teendő mentve.");
}

/** A parent with a family takes a free task (BR183). */
export async function claimTodoAction(
  _state: ParentActionState,
  formData: FormData,
): Promise<ParentActionState> {
  const ctx = await boundary(formData);
  if (!ctx.ok) return ctx.state;
  const task = versioned(formData);
  if (!task) return INVALID;
  const parent = await taskActor();
  if (!parent) return NO_ACCESS;
  const result = await ctx.facade.claim(parent.session, {
    scope: parent.scope,
    idempotencyKey: ctx.idempotencyKey,
    ...task,
  });
  if (succeeded(result)) refresh();
  return mapTodoResult(result, "Vállaltad a teendőt.");
}

/** The claimant gives the task back (BR183). */
export async function giveBackTodoAction(
  _state: ParentActionState,
  formData: FormData,
): Promise<ParentActionState> {
  const ctx = await boundary(formData);
  if (!ctx.ok) return ctx.state;
  const task = versioned(formData);
  if (!task) return INVALID;
  const parent = await taskActor();
  if (!parent) return NO_ACCESS;
  const result = await ctx.facade.giveBack(parent.session, {
    scope: parent.scope,
    idempotencyKey: ctx.idempotencyKey,
    ...task,
  });
  if (succeeded(result)) refresh();
  return mapTodoResult(result, "Visszaadtad a teendőt.");
}

/** An administrator frees another person's claim (BR184). */
export async function freeTodoClaimAction(
  _state: ParentActionState,
  formData: FormData,
): Promise<ParentActionState> {
  const ctx = await boundary(formData);
  if (!ctx.ok) return ctx.state;
  const task = versioned(formData);
  if (!task) return INVALID;
  const groupId = uuidField(formData, "groupId");
  const who = await manager(groupId);
  if (!who.ok) return NO_ACCESS;
  const result = await ctx.facade.freeClaim(who.session, {
    scope: who.scope,
    idempotencyKey: ctx.idempotencyKey,
    ...task,
  });
  if (succeeded(result)) refresh(groupId);
  return mapTodoResult(result, "A teendő újra szabad.");
}

/** The claimant changes the status or the note (BR183). */
export async function updateTodoAction(
  _state: ParentActionState,
  formData: FormData,
): Promise<ParentActionState> {
  const ctx = await boundary(formData);
  if (!ctx.ok) return ctx.state;
  const task = versioned(formData);
  const status = statusField(formData);
  if (!task || status === "invalid") return INVALID;
  const note = text(formData, "note").trim();
  const parent = await taskActor();
  if (!parent) return NO_ACCESS;
  const result = await ctx.facade.update(parent.session, {
    scope: parent.scope,
    idempotencyKey: ctx.idempotencyKey,
    ...task,
    ...(status !== undefined ? { status } : {}),
    note,
  });
  if (succeeded(result)) refresh();
  return mapTodoResult(result, "Mentve.");
}

/** The claimant marks the task done (BR183). */
export async function markTodoDoneAction(
  _state: ParentActionState,
  formData: FormData,
): Promise<ParentActionState> {
  const ctx = await boundary(formData);
  if (!ctx.ok) return ctx.state;
  const task = versioned(formData);
  if (!task) return INVALID;
  const parent = await taskActor();
  if (!parent) return NO_ACCESS;
  const result = await ctx.facade.markDone(parent.session, {
    scope: parent.scope,
    idempotencyKey: ctx.idempotencyKey,
    ...task,
  });
  if (succeeded(result)) refresh();
  return mapTodoResult(result, "Késznek jelölted.");
}

/** The one who marked it done takes the mark back (BR183). */
export async function undoTodoDoneAction(
  _state: ParentActionState,
  formData: FormData,
): Promise<ParentActionState> {
  const ctx = await boundary(formData);
  if (!ctx.ok) return ctx.state;
  const task = versioned(formData);
  if (!task) return INVALID;
  const parent = await taskActor();
  if (!parent) return NO_ACCESS;
  const result = await ctx.facade.undoDone(parent.session, {
    scope: parent.scope,
    idempotencyKey: ctx.idempotencyKey,
    ...task,
  });
  if (succeeded(result)) refresh();
  return mapTodoResult(result, "A kész jelölés visszavonva.");
}

/** A coordinator or super admin adds the chosen tasks to an event's checklist (BR185). */
export async function pullTodosAction(
  _state: ParentActionState,
  formData: FormData,
): Promise<ParentActionState> {
  const ctx = await boundary(formData);
  if (!ctx.ok) return ctx.state;
  const eventId = uuidField(formData, "eventId");
  if (!eventId) return INVALID;
  const groupId = uuidField(formData, "groupId");
  const who = await manager(groupId);
  if (!who.ok) return NO_ACCESS;
  const result = await ctx.facade.pullToEvent(who.session, {
    scope: who.scope,
    idempotencyKey: ctx.idempotencyKey,
    eventId,
    tasks: readPullTasks(formData),
  });
  if (succeeded(result)) {
    refresh(groupId);
    revalidatePath(`/szulo/esemenyek/${eventId}`);
    revalidatePath(`/admin/esemenyek/${eventId}`);
  }
  if (result.state === "success" || result.state === "recovery") {
    const { added, alreadyOnList } = result.data;
    const parts = [`${added} teendő hozzáadva.`];
    if (alreadyOnList > 0) parts.push(`${alreadyOnList} már a listán volt.`);
    return { state: "success", message: parts.join(" "), code: result.code };
  }
  return mapTodoResult(result, "Hozzáadva.");
}
