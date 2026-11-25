import { TODO_STATUSES } from "../../src/application/contracts.ts";
import type { TodoSaveInput, TodoStatus } from "../../src/application/index.ts";
import { todoMessage } from "../../src/data/copy.ts";
import type { ParentActionState } from "../szulo/_lib/action-state.ts";
import {
  INVALID,
  isRecurringId,
  text,
  uuidField,
  versionField,
} from "../_recurring/recurring-form.ts";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

const refusedField = (field: string): ParentActionState => ({
  state: "validation",
  message: "Ellenőrizd a megadott adatokat.",
  code: "VAL-INVALID",
  fieldErrors: {
    [field]: todoMessage({ state: "validation", fieldErrors: { [field]: "VAL-INVALID" } }),
  },
});

/** An optional text: trimmed, and absent when empty (the database holds the length limits). */
function optionalText(formData: FormData, field: string): string | undefined {
  const value = text(formData, field).trim();
  return value === "" ? undefined : value;
}

/** A status from the form, or `undefined` when none was sent; anything else is not a status. */
export function statusField(formData: FormData): TodoStatus | undefined | "invalid" {
  const value = text(formData, "status");
  if (value === "") return undefined;
  return (TODO_STATUSES as readonly string[]).includes(value) ? (value as TodoStatus) : "invalid";
}

/**
 * The fields of the task form. Only the shape is checked here (a number is a number, a date is a calendar date, an id
 * is an identifier); the limits, the owner rule and every right are the database's. A new task carries no id or
 * version; a change carries both or is refused. The owner is the group the form names, or a family a super admin names.
 */
export function readTodoFields(
  formData: FormData,
  idempotencyKey: string,
): { ok: true; input: TodoSaveInput } | { ok: false; state: ParentActionState } {
  const priorityRaw = text(formData, "priority").trim();
  if (priorityRaw !== "" && !/^\d{1,2}$/.test(priorityRaw)) {
    return { ok: false, state: refusedField("priority") };
  }
  const notBefore = text(formData, "notBefore").trim();
  const deadline = text(formData, "deadline").trim();
  if (notBefore !== "" && !DATE.test(notBefore)) {
    return { ok: false, state: refusedField("notBefore") };
  }
  if (deadline !== "" && !DATE.test(deadline)) {
    return { ok: false, state: refusedField("deadline") };
  }
  const status = statusField(formData);
  if (status === "invalid") return { ok: false, state: refusedField("status") };
  const changing = text(formData, "taskId") !== "";
  const taskId = uuidField(formData, "taskId");
  const expectedVersion = versionField(formData);
  if (changing && (!taskId || expectedVersion === undefined)) return { ok: false, state: INVALID };
  // A hand-over to another family (a super admin's change of owner) replaces the owner the form carried: the new
  // family alone names the owner, so the database never sees two owners.
  const handover = uuidField(formData, "newOwnerFamilyId");
  const ownerGroupId = handover ? undefined : uuidField(formData, "ownerGroupId");
  const ownerFamilyId = handover ?? uuidField(formData, "ownerFamilyId");
  const description = optionalText(formData, "description");
  const materials = optionalText(formData, "materials");
  const note = optionalText(formData, "note");
  return {
    ok: true,
    input: {
      idempotencyKey,
      topic: text(formData, "topic").trim(),
      ...(changing && taskId && expectedVersion !== undefined ? { taskId, expectedVersion } : {}),
      ...(ownerGroupId ? { ownerGroupId } : {}),
      ...(ownerFamilyId ? { ownerFamilyId } : {}),
      ...(priorityRaw !== "" ? { priority: Number(priorityRaw) } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(materials !== undefined ? { materials } : {}),
      ...(status !== undefined ? { status } : {}),
      ...(note !== undefined ? { note } : {}),
      ...(notBefore !== "" ? { notBefore } : {}),
      ...(deadline !== "" ? { deadline } : {}),
    },
  };
}

/** The tasks of a pull: every `task` field is `<id>:<version>`; anything else is dropped before the facade sees it. */
export function readPullTasks(
  formData: FormData,
): readonly { taskId: string; expectedVersion: number }[] {
  const tasks: { taskId: string; expectedVersion: number }[] = [];
  for (const value of formData.getAll("task")) {
    if (typeof value !== "string") continue;
    const [id, version] = value.split(":");
    const expectedVersion = Number(version);
    if (isRecurringId(id) && Number.isInteger(expectedVersion) && expectedVersion >= 1) {
      tasks.push({ taskId: id, expectedVersion });
    }
  }
  return tasks;
}
