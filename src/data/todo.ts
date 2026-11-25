import { TODO_STATUSES } from "../application/contracts.ts";
import type {
  DomainOutcome,
  MyTasksModel,
  MyTasksRow,
  TodoApplicationPort,
  TodoCard,
  TodoChangeModel,
  TodoDetailModel,
  TodoEventLink,
  TodoGroupListModel,
  TodoHistoryEntry,
  TodoListModel,
  TodoOwnerKind,
  TodoPullModel,
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

const OWNER_KINDS = ["working_group", "family"] as const satisfies readonly TodoOwnerKind[];
const LINK_STATES = ["on_list", "done_on_event", "gone"] as const;
const MY_KINDS = ["duty", "recurring", "todo"] as const;

const optionalInteger = (row: Row, key: string): number | undefined =>
  row[key] === null || row[key] === undefined ? undefined : integer(row, key);

/** Fields that are present only when the database sent a value; a missing one is left out, never an empty string. */
const present = <K extends string>(key: K, value: string | number | undefined) =>
  value === undefined ? {} : ({ [key]: value } as Record<K, string | number>);

function toCard(row: Row): TodoCard {
  return Object.freeze({
    id: text(row, "id"),
    topic: text(row, "topic"),
    status: oneOf(row, "status", TODO_STATUSES),
    ownerKind: oneOf(row, "owner_kind", OWNER_KINDS),
    ownerId: text(row, "owner_id"),
    ownerLabel: text(row, "owner_label"),
    claimedByMe: flag(row, "claimed_by_me"),
    isDone: flag(row, "is_done"),
    isNotYet: flag(row, "is_not_yet"),
    isOverdue: flag(row, "is_overdue"),
    needsAttention: flag(row, "needs_attention"),
    canClaim: flag(row, "can_claim"),
    version: integer(row, "version"),
    onEvent: row.on_event === undefined ? false : flag(row, "on_event"),
    doneOnEvent: row.done_on_event === undefined ? false : flag(row, "done_on_event"),
    ...present("priority", optionalInteger(row, "priority")),
    ...present("claimantDisplayName", optionalText(row, "claimant_display_name")),
    ...present("notBefore", optionalText(row, "not_before")),
    ...present("deadline", optionalText(row, "deadline")),
  });
}

function toList(envelope: Envelope): TodoListModel {
  const caller = asRow(envelope.caller);
  return Object.freeze({
    items: Object.freeze(asRows(envelope.items).map(toCard)),
    truncated: flag(envelope, "truncated"),
    caller: Object.freeze({
      canClaimTasks: flag(caller, "can_claim_tasks"),
      canManageCommunity: flag(caller, "can_manage_community"),
    }),
  });
}

function toHistory(row: Row): TodoHistoryEntry {
  const from = optionalText(row, "from_status");
  const to = optionalText(row, "to_status");
  return Object.freeze({
    change: text(row, "change"),
    actor: text(row, "actor"),
    at: text(row, "at"),
    ...(from ? { fromStatus: oneOf(row, "from_status", TODO_STATUSES) } : {}),
    ...(to ? { toStatus: oneOf(row, "to_status", TODO_STATUSES) } : {}),
    ...present("eventId", optionalText(row, "event_id")),
    ...present("eventTitle", optionalText(row, "event_title")),
  });
}

function toLink(row: Row): TodoEventLink {
  return Object.freeze({
    eventId: text(row, "event_id"),
    pulledAt: text(row, "pulled_at"),
    state: oneOf(row, "state", LINK_STATES),
    eventClosed: row.event_closed === null ? false : flag(row, "event_closed"),
    ...present("eventTitle", optionalText(row, "event_title")),
  });
}

function toDetail(envelope: Envelope): TodoDetailModel {
  const item = asRow(envelope.item);
  const can = asRow(item.can);
  const done = item.done === null || item.done === undefined ? undefined : asRow(item.done);
  const doneBy = done ? optionalText(done, "by_display_name") : undefined;
  return Object.freeze({
    item: toCard(item),
    createdAt: text(item, "created_at"),
    history: Object.freeze(asRows(item.history).map(toHistory)),
    eventLinks: Object.freeze(asRows(item.event_links).map(toLink)),
    can: Object.freeze({
      claim: flag(can, "claim"),
      giveBack: flag(can, "give_back"),
      update: flag(can, "update"),
      markDone: flag(can, "mark_done"),
      undoDone: flag(can, "undo_done"),
      freeClaim: flag(can, "free_claim"),
      edit: flag(can, "edit"),
    }),
    ...present("description", optionalText(item, "description")),
    ...present("materials", optionalText(item, "materials")),
    ...present("note", optionalText(item, "note")),
    ...(done
      ? {
          done: Object.freeze({
            at: text(done, "at"),
            isOwn: flag(done, "is_own"),
            ...(doneBy ? { byDisplayName: doneBy } : {}),
          }),
        }
      : {}),
  });
}

function toGroupList(envelope: Envelope): TodoGroupListModel {
  return Object.freeze({
    items: Object.freeze(
      asRows(envelope.items).map((row) =>
        Object.freeze({
          id: text(row, "id"),
          title: text(row, "title"),
          status: oneOf(row, "status", TODO_STATUSES),
          isOverdue: flag(row, "is_overdue"),
          needsAttention: flag(row, "needs_attention"),
          version: integer(row, "version"),
          ...present("priority", optionalInteger(row, "priority")),
          ...present("deadline", optionalText(row, "deadline")),
          ...present("claimantDisplayName", optionalText(row, "claimant_display_name")),
        }),
      ),
    ),
    truncated: flag(envelope, "truncated"),
  });
}

function toMyRow(row: Row): MyTasksRow {
  return Object.freeze({
    kind: oneOf(row, "kind", MY_KINDS),
    id: text(row, "id"),
    refId: text(row, "ref_id"),
    title: text(row, "title"),
    status: text(row, "status"),
    version: integer(row, "version"),
    isOverdue: flag(row, "is_overdue"),
    canMarkDone: flag(row, "can_mark_done"),
    ...present("date", optionalText(row, "date")),
  });
}

const myRows = (value: unknown): readonly MyTasksRow[] => Object.freeze(asRows(value).map(toMyRow));

const toMyTasks = (envelope: Envelope): MyTasksModel =>
  Object.freeze({
    thisWeek: myRows(envelope.this_week),
    later: myRows(envelope.later),
    noDate: myRows(envelope.no_date),
    isEmpty: flag(envelope, "is_empty"),
    weekEnd: text(envelope, "week_end"),
  });

const toChange = (envelope: Envelope): TodoChangeModel =>
  Object.freeze({
    id: typeof envelope.reference === "string" ? envelope.reference : null,
    version:
      typeof envelope.version === "number" && Number.isInteger(envelope.version)
        ? envelope.version
        : null,
  });

const toPull = (envelope: Envelope): TodoPullModel =>
  Object.freeze({
    eventId: typeof envelope.reference === "string" ? envelope.reference : null,
    added: integer(envelope, "added"),
    alreadyOnList: integer(envelope, "already_on_list"),
    claimantsCarried: integer(envelope, "claimants_carried"),
  });

/**
 * The database's to-do reads and commands (U12). Every command is one named function with the idempotency key first and,
 * where a row changes, the version the screen saw. A refusal stays a refusal, never an empty list; an address that is
 * not an identifier names nothing and reads as denied without asking the database. Each page is one function call.
 */
export function createTodoPort(database: DatabaseClient): TodoApplicationPort {
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
  const change = async <T>(
    name: string,
    args: Readonly<Record<string, unknown>>,
    key: string,
    build: (envelope: Envelope) => T,
  ): Promise<DomainOutcome<T>> => toOutcome(await gateway.call(name, args, key), build);
  const onTask = async (
    name: string,
    input: { idempotencyKey: string; taskId: string; expectedVersion: number },
    extra: Readonly<Record<string, unknown>> = {},
  ): Promise<DomainOutcome<TodoChangeModel>> => {
    if (!isUuid(input.taskId)) return DENIED;
    return change(
      name,
      {
        p_idempotency_key: input.idempotencyKey,
        p_task_id: input.taskId,
        ...extra,
        p_expected_version: input.expectedVersion,
      },
      input.idempotencyKey,
      toChange,
    );
  };
  return {
    list: (filters) => {
      if (filters.owner !== undefined && !isUuid(filters.owner)) return Promise.resolve(DENIED);
      return read(
        "todo_list",
        {
          p_show_hidden: filters.showHidden ?? false,
          p_owner: filters.owner ?? null,
          p_status: filters.status ?? null,
          p_priority: filters.priority ?? null,
          p_attention_only: filters.attentionOnly ?? false,
        },
        toList,
      );
    },
    async get(taskId) {
      return readById("todo_get", "p_task_id", taskId, toDetail);
    },
    async groupList(groupId) {
      return readById("todo_list_for_group", "p_group_id", groupId, toGroupList);
    },
    myTasks: () => read("my_tasks_get", {}, toMyTasks),
    save: (input) => {
      const task = {
        id: input.taskId ?? null,
        expected_version: input.expectedVersion ?? null,
        owner_group_id: input.ownerGroupId ?? null,
        owner_family_id: input.ownerFamilyId ?? null,
        topic: input.topic,
        priority: input.priority ?? null,
        description: input.description ?? null,
        materials: input.materials ?? null,
        status: input.status ?? null,
        note: input.note ?? null,
        not_before: input.notBefore ?? null,
        deadline: input.deadline ?? null,
      };
      return change(
        "todo_task_save",
        { p_idempotency_key: input.idempotencyKey, p_task: task },
        input.idempotencyKey,
        toChange,
      );
    },
    claim: (input) => onTask("todo_task_claim", input),
    giveBack: (input) => onTask("todo_task_give_back", input),
    freeClaim: (input) => onTask("todo_task_free_claim", input),
    update: (input) =>
      onTask("todo_task_update", input, {
        p_status: input.status ?? null,
        p_note: input.note ?? null,
      }),
    markDone: (input) => onTask("todo_task_mark_done", input),
    undoDone: (input) => onTask("todo_task_undo_done", input),
    pullToEvent: async (input) => {
      if (!isUuid(input.eventId) || input.tasks.some((task) => !isUuid(task.taskId))) {
        return DENIED;
      }
      return change(
        "todo_pull_to_event",
        {
          p_idempotency_key: input.idempotencyKey,
          p_event_id: input.eventId,
          p_todo_ids: input.tasks.map((task) => task.taskId),
          p_expected_versions: input.tasks.map((task) => task.expectedVersion),
        },
        input.idempotencyKey,
        toPull,
      );
    },
  };
}
