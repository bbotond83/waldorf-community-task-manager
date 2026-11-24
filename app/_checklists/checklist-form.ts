import type { ParentActionState } from "../szulo/_lib/action-state.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const KEY = /^[A-Za-z0-9][A-Za-z0-9:_-]{7,127}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

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
  return typeof value === "string" ? value.trim() : "";
};

/** An address part counts only when it is a UUID; anything else is never sent to the database. */
export const isChecklistId = (value: string | undefined): value is string =>
  value !== undefined && UUID.test(value);

export const isChecklistKey = (value: string): boolean => KEY.test(value);

export const uuidField = (formData: FormData, field: string): string | undefined => {
  const value = text(formData, field);
  return UUID.test(value) ? value : undefined;
};

/** A whole number of at least one in a hidden version field; anything else is no version. */
export function versionField(formData: FormData, field = "expectedVersion"): number | undefined {
  const value = Number(formData.get(field));
  return Number.isInteger(value) && value >= 1 ? value : undefined;
}

const SECTION_KINDS = ["parents", "organisers", "teachers"];

/** The text of a field, or null so the stored value is cleared; the database checks the length. */
const optional = (formData: FormData, field: string): string | null =>
  text(formData, field) || null;

/**
 * The fields of the task form, in the database's own words. Only the shape is checked here (a number is a number, a
 * date is a calendar date); the limits and the rights are the database's.
 */
export function readTaskFields(
  formData: FormData,
): { ok: true; task: Record<string, unknown> } | { ok: false } {
  const priority = text(formData, "priority");
  const helpers = Number(text(formData, "helpersNeeded") || "1");
  const deadline = text(formData, "deadline");
  if (priority !== "" && !["1", "2", "3"].includes(priority)) return { ok: false };
  if (!Number.isInteger(helpers)) return { ok: false };
  if (deadline !== "" && !DAY.test(deadline)) return { ok: false };
  const id = uuidField(formData, "taskId");
  const sectionId = uuidField(formData, "sectionId");
  if (!sectionId) return { ok: false };
  const changing = text(formData, "taskId") !== "";
  const version = versionField(formData);
  if (changing && (!id || version === undefined)) return { ok: false };
  return {
    ok: true,
    task: {
      ...(changing ? { id, expected_version: version } : {}),
      section_id: sectionId,
      title: text(formData, "title"),
      place: optional(formData, "place"),
      props: optional(formData, "props"),
      materials: optional(formData, "materials"),
      tip: optional(formData, "tip"),
      priority: priority === "" ? null : Number(priority),
      deadline: deadline === "" ? null : deadline,
      helpers_needed: helpers,
      summer_only: formData.get("summerOnly") === "on",
      time_matters: formData.get("timeMatters") === "on",
    },
  };
}

export function readSectionFields(
  formData: FormData,
): { ok: true; section: Record<string, unknown> } | { ok: false } {
  const kind = text(formData, "kind") || "parents";
  if (!SECTION_KINDS.includes(kind)) return { ok: false };
  const changing = text(formData, "sectionId") !== "";
  const id = uuidField(formData, "sectionId");
  const version = versionField(formData);
  if (changing && (!id || version === undefined)) return { ok: false };
  return {
    ok: true,
    section: {
      ...(changing ? { id, expected_version: version } : {}),
      title: text(formData, "title"),
      kind,
    },
  };
}

type TemplateTaskDraft = Record<string, unknown>;

/**
 * The template editor sends the whole template as one JSON field. Only its shape is read here: sections and tasks are
 * lists of records; the database checks every field, the counts and the rights.
 */
export function readTemplatePayload(
  formData: FormData,
  groupId: string | undefined,
): { ok: true; template: Record<string, unknown> } | { ok: false } {
  let raw: unknown;
  try {
    raw = JSON.parse(text(formData, "template"));
  } catch {
    return { ok: false };
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return { ok: false };
  const draft = raw as Record<string, unknown>;
  if (!Array.isArray(draft.sections)) return { ok: false };
  const sections: unknown[] = [];
  for (const section of draft.sections) {
    if (
      typeof section !== "object" ||
      section === null ||
      !Array.isArray((section as { tasks?: unknown }).tasks)
    )
      return { ok: false };
    const s = section as { title?: unknown; kind?: unknown; tasks: TemplateTaskDraft[] };
    sections.push({
      title: typeof s.title === "string" ? s.title.trim() : "",
      kind: typeof s.kind === "string" ? s.kind : "parents",
      tasks: s.tasks.map((task) => ({
        title: typeof task.title === "string" ? task.title.trim() : "",
        place: nullableText(task.place),
        props: nullableText(task.props),
        materials: nullableText(task.materials),
        tip: nullableText(task.tip),
        priority: task.priority === null || task.priority === "" ? null : Number(task.priority),
        helpers_needed: Number(task.helpersNeeded ?? 1),
        summer_only: task.summerOnly === true,
        time_matters: task.timeMatters === true,
      })),
    });
  }
  const lead = typeof draft.defaultLeadDays === "string" ? draft.defaultLeadDays.trim() : "";
  const id = uuidField(formData, "templateId");
  const changing = text(formData, "templateId") !== "";
  const version = versionField(formData);
  if (changing && (!id || version === undefined)) return { ok: false };
  return {
    ok: true,
    template: {
      ...(changing ? { id, expected_version: version } : {}),
      ...(!changing && groupId ? { working_group_id: groupId } : {}),
      name: typeof draft.name === "string" ? draft.name.trim() : "",
      description: nullableText(draft.description),
      default_lead_days: lead === "" ? null : Number(lead),
      sections,
    },
  };
}

function nullableText(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}
