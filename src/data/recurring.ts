import type {
  DomainOutcome,
  RecurringApplicationPort,
  RecurringCardModel,
  RecurringChangeModel,
  RecurringGroupListModel,
  RecurringItem,
  RecurringItemsModel,
  RecurringOwnerKind,
  RecurringScheduleItem,
  RecurringScheduleListModel,
  RecurringScheduleModel,
} from "../application/index.ts";
import type { DatabaseClient } from "../runtime/database/client.ts";
import { DataGateway, type Envelope } from "./gateway.ts";
import { toOutcome } from "./results.ts";
import {
  asRow,
  asRows,
  flag,
  integer,
  isUuid,
  oneOf,
  optionalText,
  text,
  type Row,
} from "./values.ts";

const OWNER_KINDS = [
  "group",
  "family",
  "rota_week",
] as const satisfies readonly RecurringOwnerKind[];
const STATUSES = ["open", "done", "skipped"] as const;

const optionalInteger = (row: Row, key: string): number | undefined =>
  row[key] === null || row[key] === undefined ? undefined : integer(row, key);

function toItem(row: Row): RecurringItem {
  const workingGroupId = optionalText(row, "working_group_id");
  const groupName = optionalText(row, "group_name");
  const doneBy = optionalText(row, "done_by_display_name");
  const doneAt = optionalText(row, "done_at");
  const reason = optionalText(row, "skipped_reason");
  const skippedBy = optionalText(row, "skipped_by_display_name");
  return Object.freeze({
    id: text(row, "id"),
    scheduleId: text(row, "schedule_id"),
    title: text(row, "title"),
    category: text(row, "category"),
    ownerKind: oneOf(row, "owner_kind", OWNER_KINDS),
    dueDate: text(row, "due_date"),
    status: oneOf(row, "status", STATUSES),
    isOverdue: flag(row, "is_overdue"),
    version: integer(row, "version"),
    canMarkDone: flag(row, "can_mark_done"),
    canUndo: flag(row, "can_undo"),
    canSkip: flag(row, "can_skip"),
    ...(workingGroupId ? { workingGroupId } : {}),
    ...(groupName ? { groupName } : {}),
    ...(doneBy ? { doneByDisplayName: doneBy } : {}),
    ...(doneAt ? { doneAt } : {}),
    ...(reason ? { skippedReason: reason } : {}),
    ...(skippedBy ? { skippedByDisplayName: skippedBy } : {}),
  });
}

function toSchedule(value: unknown): RecurringScheduleItem {
  const row = asRow(value);
  const workingGroupId = optionalText(row, "working_group_id");
  const familyId = optionalText(row, "family_id");
  const familyName = optionalText(row, "family_display_name");
  const rotaJob = optionalText(row, "rota_job");
  const from = optionalInteger(row, "season_from_month");
  const to = optionalInteger(row, "season_to_month");
  return Object.freeze({
    id: text(row, "id"),
    title: text(row, "title"),
    category: text(row, "category"),
    ownerKind: oneOf(row, "owner_kind", OWNER_KINDS),
    intervalKind: text(row, "interval_kind"),
    intervalCount: integer(row, "interval_count"),
    startDate: text(row, "start_date"),
    isActive: flag(row, "is_active"),
    version: integer(row, "version"),
    ...(workingGroupId ? { workingGroupId } : {}),
    ...(familyId ? { familyId } : {}),
    ...(familyName ? { familyDisplayName: familyName } : {}),
    ...(rotaJob ? { rotaJob } : {}),
    ...(from !== undefined ? { seasonFromMonth: from } : {}),
    ...(to !== undefined ? { seasonToMonth: to } : {}),
  });
}

const items = (value: unknown): readonly RecurringItem[] =>
  Object.freeze(asRows(value).map(toItem));

function toGroupList(envelope: Envelope): RecurringGroupListModel {
  const group = asRow(envelope.group);
  const caller = asRow(envelope.caller);
  return Object.freeze({
    group: Object.freeze({
      id: text(group, "id"),
      name: text(group, "name"),
      status: text(group, "status"),
    }),
    schedules: Object.freeze(asRows(envelope.schedules).map(toSchedule)),
    items: items(envelope.items),
    history: items(envelope.history),
    canManage: flag(caller, "can_manage"),
    canMark: flag(caller, "can_mark"),
  });
}

const toCard = (envelope: Envelope): RecurringCardModel =>
  Object.freeze({ item: toItem(asRow(envelope.item)), schedule: toSchedule(envelope.schedule) });

const toItems = (envelope: Envelope): RecurringItemsModel =>
  Object.freeze({ items: items(envelope.items) });

const toScheduleList = (envelope: Envelope): RecurringScheduleListModel =>
  Object.freeze({ items: Object.freeze(asRows(envelope.items).map(toSchedule)) });

const toScheduleModel = (envelope: Envelope): RecurringScheduleModel =>
  Object.freeze({
    schedule: toSchedule(envelope.schedule),
    canManage: flag(asRow(envelope.caller), "can_manage"),
  });

function toChange(envelope: Envelope): RecurringChangeModel {
  return Object.freeze({
    id: typeof envelope.reference === "string" ? envelope.reference : null,
    version:
      typeof envelope.version === "number" && Number.isInteger(envelope.version)
        ? envelope.version
        : null,
  });
}

/**
 * The database's recurring-duty reads and commands (U9). Every command is one named function with the idempotency
 * key and, where a row is changed, the version the screen saw. A refusal stays a refusal, never an empty list; an
 * address that is not an identifier names nothing and reads as denied without asking the database. Each page is one
 * function call (NFR9.4).
 */
export function createRecurringPort(database: DatabaseClient): RecurringApplicationPort {
  const gateway = new DataGateway(database);
  const DENIED: DomainOutcome<never> = { state: "denied" };
  const read = async <T>(
    name: string,
    args: Readonly<Record<string, unknown>>,
    build: (envelope: Envelope) => T,
  ): Promise<DomainOutcome<T>> => toOutcome(await gateway.call(name, args), build);
  const readById = <T>(
    name: string,
    argument: string,
    id: string,
    build: (envelope: Envelope) => T,
  ): Promise<DomainOutcome<T>> | DomainOutcome<never> =>
    isUuid(id) ? read(name, { [argument]: id }, build) : DENIED;
  const change = async (
    name: string,
    args: Readonly<Record<string, unknown>>,
    key: string,
  ): Promise<DomainOutcome<RecurringChangeModel>> =>
    toOutcome(await gateway.call(name, args, key), toChange);
  return {
    async groupList(groupId) {
      return readById("recurring_list_for_group", "p_group_id", groupId, toGroupList);
    },
    async card(occurrenceId) {
      return readById("recurring_occurrence_get", "p_occurrence_id", occurrenceId, toCard);
    },
    mine: () => read("recurring_my_occurrences", {}, toItems),
    async bottle(dutyId) {
      return readById("recurring_bottle_for_duty", "p_duty_id", dutyId, toItems);
    },
    adminList: () => read("recurring_list_admin", {}, toScheduleList),
    async scheduleGet(scheduleId) {
      return readById("recurring_schedule_get", "p_schedule_id", scheduleId, toScheduleModel);
    },
    saveSchedule: (input) =>
      change(
        "recurring_schedule_save",
        {
          p_idempotency_key: input.idempotencyKey,
          p_schedule_id: input.scheduleId ?? null,
          p_expected_version: input.expectedVersion ?? null,
          p_title: input.title,
          p_category: input.category,
          p_owner_kind: input.ownerKind,
          p_working_group_id: input.workingGroupId ?? null,
          p_family_id: input.familyId ?? null,
          p_rota_job: input.rotaJob ?? null,
          p_interval_count: input.intervalCount,
          p_start_date: input.startDate,
          p_season_from: input.seasonFromMonth ?? null,
          p_season_to: input.seasonToMonth ?? null,
        },
        input.idempotencyKey,
      ),
    setActive: ({ idempotencyKey, scheduleId, expectedVersion, active }) =>
      change(
        "recurring_schedule_set_active",
        {
          p_idempotency_key: idempotencyKey,
          p_schedule_id: scheduleId,
          p_expected_version: expectedVersion,
          p_active: active,
        },
        idempotencyKey,
      ),
    markDone: ({ idempotencyKey, occurrenceId, expectedVersion }) =>
      change(
        "recurring_occurrence_mark_done",
        {
          p_idempotency_key: idempotencyKey,
          p_occurrence_id: occurrenceId,
          p_expected_version: expectedVersion,
        },
        idempotencyKey,
      ),
    undoDone: ({ idempotencyKey, occurrenceId, expectedVersion }) =>
      change(
        "recurring_occurrence_undo_done",
        {
          p_idempotency_key: idempotencyKey,
          p_occurrence_id: occurrenceId,
          p_expected_version: expectedVersion,
        },
        idempotencyKey,
      ),
    skip: ({ idempotencyKey, occurrenceId, expectedVersion, reason }) =>
      change(
        "recurring_occurrence_skip",
        {
          p_idempotency_key: idempotencyKey,
          p_occurrence_id: occurrenceId,
          p_expected_version: expectedVersion,
          p_reason: reason,
        },
        idempotencyKey,
      ),
  };
}
