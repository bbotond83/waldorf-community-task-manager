import { CHECKLIST_SECTION_KINDS } from "../application/contracts.ts";
import type {
  ChecklistApplicationPort,
  ChecklistChangeModel,
  ChecklistClaimModel,
  ChecklistModel,
  ChecklistSectionModel,
  ChecklistTaskModel,
  DomainOutcome,
  TemplateListModel,
  TemplateModel,
  TemplateOptionsModel,
  TemplateSectionModel,
  TemplateTaskModel,
} from "../application/index.ts";
import type { ChecklistSectionKind } from "../application/contracts.ts";
import type { DatabaseClient } from "../runtime/database/client.ts";
import { DataGateway, type Envelope } from "./gateway.ts";
import { toOutcome } from "./results.ts";
import { asRow, asRows, flag, integer, isUuid, optionalText, text, type Row } from "./values.ts";

const kindOf = (row: Row): ChecklistSectionKind =>
  (CHECKLIST_SECTION_KINDS as readonly string[]).includes(String(row.kind))
    ? (row.kind as ChecklistSectionKind)
    : "parents";
const optionalInt = (row: Row, key: string): number | undefined =>
  typeof row[key] === "number" && Number.isInteger(row[key]) ? (row[key] as number) : undefined;
const some = <K extends string, V>(key: K, value: V | undefined): { [P in K]?: V } =>
  (value === undefined ? {} : { [key]: value }) as { [P in K]?: V };

function toClaim(row: Row): ChecklistClaimModel {
  return Object.freeze({
    id: text(row, "id"),
    version: integer(row, "version"),
    outsideEvent: flag(row, "outside_event"),
    isOwn: flag(row, "is_own"),
    canRemove: flag(row, "can_remove"),
    ...some("parentDisplayName", optionalText(row, "parent_display_name")),
    ...some("familyDisplayName", optionalText(row, "family_display_name")),
    ...some("typedName", optionalText(row, "typed_name")),
    ...some("note", optionalText(row, "note")),
    ...some("chosenAt", optionalText(row, "chosen_at")),
  });
}

function toTask(row: Row): ChecklistTaskModel {
  const done = row.done === null || row.done === undefined ? undefined : asRow(row.done);
  const can = asRow(row.can);
  return Object.freeze({
    id: text(row, "id"),
    position: integer(row, "position"),
    title: text(row, "title"),
    summerOnly: flag(row, "summer_only"),
    helpersNeeded: integer(row, "helpers_needed"),
    helpersTaken: integer(row, "helpers_taken"),
    timeMatters: flag(row, "time_matters"),
    version: integer(row, "version"),
    claims: Object.freeze(asRows(row.claims).map(toClaim)),
    can: Object.freeze({
      claim: flag(can, "claim"),
      markDone: flag(can, "mark_done"),
      undoDone: flag(can, "undo_done"),
    }),
    ...some("place", optionalText(row, "place")),
    ...some("props", optionalText(row, "props")),
    ...some("priority", optionalInt(row, "priority")),
    ...some("materials", optionalText(row, "materials")),
    ...some("tip", optionalText(row, "tip")),
    ...some("deadline", optionalText(row, "deadline")),
    ...some("sourceRef", optionalText(row, "source_ref")),
    ...(done
      ? {
          done: Object.freeze({
            at: text(done, "at"),
            byDisplayName: text(done, "by_display_name"),
            isOwn: flag(done, "is_own"),
          }),
        }
      : {}),
  });
}

function toSection(row: Row): ChecklistSectionModel {
  return Object.freeze({
    id: text(row, "id"),
    position: integer(row, "position"),
    title: text(row, "title"),
    kind: kindOf(row),
    version: integer(row, "version"),
    tasks: Object.freeze(asRows(row.tasks).map(toTask)),
  });
}

function toChecklist(envelope: Envelope): ChecklistModel {
  const item = asRow(envelope.item);
  const caller = asRow(item.caller);
  return Object.freeze({
    eventId: text(item, "event_id"),
    eventTitle: text(item, "event_title"),
    checklistVersion: integer(item, "checklist_version"),
    isEmpty: flag(item, "is_empty"),
    isOpen: flag(item, "is_open"),
    isFinished: flag(item, "is_finished"),
    isCancelled: flag(item, "is_cancelled"),
    isSummer: flag(item, "is_summer"),
    sections: Object.freeze(asRows(item.sections).map(toSection)),
    caller: Object.freeze({
      inTeam: flag(caller, "in_team"),
      canManage: flag(caller, "can_manage"),
      canClaimTasks: flag(caller, "can_claim_tasks"),
    }),
    ...some("copiedFromTemplateId", optionalText(item, "copied_from_template_id")),
    ...some("signupDeadline", optionalText(item, "signup_deadline")),
    ...(typeof item.all_done === "boolean" ? { allDone: item.all_done } : {}),
  });
}

function toTemplateTask(row: Row): TemplateTaskModel {
  return Object.freeze({
    id: text(row, "id"),
    position: integer(row, "position"),
    title: text(row, "title"),
    summerOnly: flag(row, "summer_only"),
    helpersNeeded: integer(row, "helpers_needed"),
    timeMatters: flag(row, "time_matters"),
    ...some("place", optionalText(row, "place")),
    ...some("props", optionalText(row, "props")),
    ...some("priority", optionalInt(row, "priority")),
    ...some("materials", optionalText(row, "materials")),
    ...some("tip", optionalText(row, "tip")),
  });
}

function toTemplateSection(row: Row): TemplateSectionModel {
  return Object.freeze({
    id: text(row, "id"),
    position: integer(row, "position"),
    title: text(row, "title"),
    kind: kindOf(row),
    tasks: Object.freeze(asRows(row.tasks).map(toTemplateTask)),
  });
}

function toTemplate(envelope: Envelope): TemplateModel {
  const item = asRow(envelope.item);
  return Object.freeze({
    id: text(item, "id"),
    name: text(item, "name"),
    isRemoved: flag(item, "is_removed"),
    version: integer(item, "version"),
    sections: Object.freeze(asRows(item.sections).map(toTemplateSection)),
    ...some("workingGroupId", optionalText(item, "working_group_id")),
    ...some("workingGroupName", optionalText(item, "working_group_name")),
    ...some("description", optionalText(item, "description")),
    ...some("defaultLeadDays", optionalInt(item, "default_lead_days")),
  });
}

function toTemplateList(envelope: Envelope): TemplateListModel {
  const caller = asRow(envelope.caller ?? {});
  const managed = Array.isArray(caller.managed_group_ids)
    ? caller.managed_group_ids.filter((id): id is string => typeof id === "string")
    : [];
  return Object.freeze({
    items: Object.freeze(
      asRows(envelope.items).map((row) =>
        Object.freeze({
          id: text(row, "id"),
          name: text(row, "name"),
          taskCount: integer(row, "task_count"),
          status: row.status === "removed" ? ("removed" as const) : ("active" as const),
          version: integer(row, "version"),
          ...some("workingGroupId", optionalText(row, "working_group_id")),
          ...some("groupName", optionalText(row, "group_name")),
        }),
      ),
    ),
    canManageCommunity: caller.can_manage_community === true,
    managedGroupIds: Object.freeze(managed),
  });
}

function toOptions(envelope: Envelope): TemplateOptionsModel {
  return Object.freeze({
    items: Object.freeze(
      asRows(envelope.items).map((row) =>
        Object.freeze({
          id: text(row, "id"),
          name: text(row, "name"),
          hasSummerTasks: flag(row, "has_summer_tasks"),
          ...some("defaultLeadDays", optionalInt(row, "default_lead_days")),
          ...some("workingGroupId", optionalText(row, "working_group_id")),
        }),
      ),
    ),
  });
}

function toChange(envelope: Envelope): ChecklistChangeModel {
  return Object.freeze({
    id: typeof envelope.reference === "string" ? envelope.reference : null,
    version:
      typeof envelope.version === "number" && Number.isInteger(envelope.version)
        ? envelope.version
        : null,
  });
}

/**
 * The database's checklist and template reads and commands (U11). Every command is one named function with the
 * idempotency key and, where a row is changed, the version the screen saw. An address that is not an identifier names
 * nothing and reads as denied without asking the database.
 */
export function createChecklistPort(database: DatabaseClient): ChecklistApplicationPort {
  const gateway = new DataGateway(database);
  const change = async (
    name: string,
    args: Readonly<Record<string, unknown>>,
    key: string,
  ): Promise<DomainOutcome<ChecklistChangeModel>> =>
    toOutcome(await gateway.call(name, args, key), toChange);
  const unknown = (...ids: readonly (string | undefined)[]): boolean =>
    ids.some((id) => id !== undefined && !isUuid(id));
  const DENIED: DomainOutcome<never> = { state: "denied" };
  return {
    async checklist(eventId) {
      if (unknown(eventId)) return DENIED;
      return toOutcome(await gateway.call("checklist_get", { p_event_id: eventId }), toChecklist);
    },
    async templates() {
      return toOutcome(await gateway.call("template_list_admin", {}), toTemplateList);
    },
    async templatesForGroup(groupId) {
      if (unknown(groupId)) return DENIED;
      return toOutcome(
        await gateway.call("template_list", { p_group_id: groupId }),
        toTemplateList,
      );
    },
    async template(templateId) {
      if (unknown(templateId)) return DENIED;
      return toOutcome(
        await gateway.call("template_get", { p_template_id: templateId }),
        toTemplate,
      );
    },
    async templateOptions(groupId) {
      if (unknown(groupId)) return DENIED;
      return toOutcome(
        await gateway.call("template_options", { p_group_id: groupId ?? null }),
        toOptions,
      );
    },
    saveTemplate: ({ idempotencyKey, template }) =>
      change(
        "template_save",
        { p_idempotency_key: idempotencyKey, p_template: template },
        idempotencyKey,
      ),
    setTemplateRemoved: ({ idempotencyKey, templateId, removed, expectedVersion }) =>
      change(
        "template_set_removed",
        {
          p_idempotency_key: idempotencyKey,
          p_template_id: templateId,
          p_removed: removed,
          p_expected_version: expectedVersion,
        },
        idempotencyKey,
      ),
    copyTemplate: ({ idempotencyKey, eventId, templateId }) =>
      change(
        "checklist_copy_template",
        { p_idempotency_key: idempotencyKey, p_event_id: eventId, p_template_id: templateId },
        idempotencyKey,
      ),
    saveSection: ({ idempotencyKey, eventId, expectedChecklistVersion, section }) =>
      change(
        "checklist_section_save",
        {
          p_idempotency_key: idempotencyKey,
          p_event_id: eventId,
          p_expected_checklist_version: expectedChecklistVersion,
          p_section: section,
        },
        idempotencyKey,
      ),
    removeSection: ({ idempotencyKey, sectionId, expectedChecklistVersion }) =>
      change(
        "checklist_section_remove",
        {
          p_idempotency_key: idempotencyKey,
          p_section_id: sectionId,
          p_expected_checklist_version: expectedChecklistVersion,
        },
        idempotencyKey,
      ),
    saveTask: ({ idempotencyKey, eventId, expectedChecklistVersion, task }) =>
      change(
        "checklist_task_save",
        {
          p_idempotency_key: idempotencyKey,
          p_event_id: eventId,
          p_expected_checklist_version: expectedChecklistVersion,
          p_task: task,
        },
        idempotencyKey,
      ),
    removeTask: ({ idempotencyKey, taskId, expectedChecklistVersion }) =>
      change(
        "checklist_task_remove",
        {
          p_idempotency_key: idempotencyKey,
          p_task_id: taskId,
          p_expected_checklist_version: expectedChecklistVersion,
        },
        idempotencyKey,
      ),
    reorder: ({ idempotencyKey, eventId, expectedChecklistVersion, order }) =>
      change(
        "checklist_reorder",
        {
          p_idempotency_key: idempotencyKey,
          p_event_id: eventId,
          p_expected_checklist_version: expectedChecklistVersion,
          p_order: order,
        },
        idempotencyKey,
      ),
    claim: ({ idempotencyKey, taskId, note, chosenAt }) =>
      change(
        "checklist_claim",
        {
          p_idempotency_key: idempotencyKey,
          p_task_id: taskId,
          p_note: note ?? null,
          p_chosen_at: chosenAt ?? null,
        },
        idempotencyKey,
      ),
    claimTyped: ({ idempotencyKey, taskId, name, note, chosenAt }) =>
      change(
        "checklist_claim_typed",
        {
          p_idempotency_key: idempotencyKey,
          p_task_id: taskId,
          p_name: name,
          p_note: note ?? null,
          p_chosen_at: chosenAt ?? null,
        },
        idempotencyKey,
      ),
    changeClaim: ({ idempotencyKey, claimId, expectedVersion, note, chosenAt }) =>
      change(
        "checklist_claim_change",
        {
          p_idempotency_key: idempotencyKey,
          p_claim_id: claimId,
          p_expected_version: expectedVersion,
          p_note: note ?? null,
          p_chosen_at: chosenAt ?? null,
        },
        idempotencyKey,
      ),
    withdrawClaim: ({ idempotencyKey, claimId, expectedVersion }) =>
      change(
        "checklist_claim_withdraw",
        {
          p_idempotency_key: idempotencyKey,
          p_claim_id: claimId,
          p_expected_version: expectedVersion,
        },
        idempotencyKey,
      ),
    markDone: ({ idempotencyKey, taskId, expectedVersion }) =>
      change(
        "checklist_task_mark_done",
        {
          p_idempotency_key: idempotencyKey,
          p_task_id: taskId,
          p_expected_version: expectedVersion,
        },
        idempotencyKey,
      ),
    undoDone: ({ idempotencyKey, taskId, expectedVersion }) =>
      change(
        "checklist_task_undo_done",
        {
          p_idempotency_key: idempotencyKey,
          p_task_id: taskId,
          p_expected_version: expectedVersion,
        },
        idempotencyKey,
      ),
  };
}
