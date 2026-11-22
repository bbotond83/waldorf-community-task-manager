import type { Scope } from "../access/index.ts";
import type {
  AdminItemModel,
  AdminListModel,
  ApprovalOutcome,
  DashboardModel,
  DomainOutcome,
} from "../application/index.ts";
import { COMMUNITY_GROUP } from "../application/admin-payloads.ts";
import { APPROVAL_KIND_TITLES } from "./copy.ts";
import type { DataGateway } from "./gateway.ts";
import {
  defined,
  likePattern,
  payloadFlag,
  payloadNumber,
  payloadText,
  type Payload,
} from "./payload.ts";
import { refused, toOutcome } from "./results.ts";
import { asRow, asRows, integer, isUuid, optionalText, text, type Row } from "./values.ts";

/**
 * The admin operations on events, tasks, places, approvals and the dashboard (W5 to W12, BR32.5). Reads are
 * policy-filtered table reads; changes call the named functions. As with records, a change that names only
 * a title keeps working: every other field is filled from the stored row.
 */
export type TaskCall = Readonly<{ payload: Payload; idempotencyKey?: string }>;

type Filterable = {
  eq(column: string, value: string): Filterable;
  neq(column: string, value: string): Filterable;
  in(column: string, values: readonly string[]): Filterable;
  ilike(column: string, pattern: string): Filterable;
  order(column: string, options?: { ascending: boolean }): Filterable;
  limit(count: number): Filterable;
};

/** The word a screen shows for a stored task or event status (the labels exist in `status-labels.ts`). */
const TASK_STATES: Readonly<Record<string, string>> = Object.freeze({
  open: "open",
  closed: "closed",
  cancelled: "cancelled",
});

const EVENT_STATES: Readonly<Record<string, string>> = Object.freeze({
  planned: "scheduled",
  cancelled: "cancelled",
});

/** A stored text column that may be empty, as a detail field that is simply absent when empty. */
function present(row: Row, column: string, name: string): Record<string, string> {
  const value = optionalText(row, column);
  return value === undefined ? {} : { [name]: value };
}

function taskItem(row: Row): AdminItemModel {
  return Object.freeze({
    id: text(row, "id"),
    title: text(row, "title"),
    state: TASK_STATES[text(row, "status")] ?? "blocked",
    version: integer(row, "version"),
    kind: "task" as const,
    details: Object.freeze({
      ...present(row, "group_id", "groupId"),
      ...present(row, "event_id", "eventId"),
      category: text(row, "category"),
      capacity: integer(row, "capacity"),
      startsAt: text(row, "starts_at"),
      endsAt: text(row, "ends_at"),
      location: text(row, "location"),
    }),
  });
}

function eventItem(row: Row): AdminItemModel {
  return Object.freeze({
    id: text(row, "id"),
    title: text(row, "title"),
    state: EVENT_STATES[text(row, "status")] ?? "cancelled",
    version: integer(row, "version"),
    kind: "event" as const,
    details: Object.freeze({
      ...present(row, "group_id", "groupId"),
      startsAt: text(row, "starts_at"),
      endsAt: text(row, "ends_at"),
      ...present(row, "location", "location"),
      isSummer: row.is_summer === true,
      foodSignupOn: row.food_signup_on === true,
      ...present(row, "signup_deadline", "signupDeadline"),
      ...(typeof row.notice_lead_days === "number" ? { noticeLeadDays: row.notice_lead_days } : {}),
      ...present(row, "tale", "tale"),
    }),
  });
}

async function readTable(
  gateway: DataGateway,
  table: string,
  columns: string,
  refine: (query: Filterable) => Filterable,
): Promise<readonly Row[]> {
  const data = await gateway.select(`tasks.${table}`, (client) =>
    refine(client.from(table).select(columns) as unknown as Filterable).limit(1000),
  );
  return asRows(data);
}

/** The group a save stores: the one the form chose, none for "whole community", or the stored one. */
function groupOf(payload: Payload, stored: string | undefined): string | undefined {
  const chosen = payloadText(payload, "groupId") ?? stored;
  return chosen === COMMUNITY_GROUP ? undefined : chosen;
}

const TASK_COLUMNS =
  "id,group_id,event_id,title,category,capacity,starts_at,ends_at,location,status,version";
const EVENT_COLUMNS =
  "id,group_id,title,location,starts_at,ends_at,is_summer,signup_deadline,notice_lead_days,food_signup_on,tale,status,version";

/** tasks.list: events and tasks of the admin's reach, soonest first, with the screens' status words. */
export async function listTasks(
  gateway: DataGateway,
  payload: Payload,
): Promise<DomainOutcome<AdminListModel>> {
  const search = payloadText(payload, "q")?.trim();
  const state = payloadText(payload, "state");
  const refine = (query: Filterable) => {
    const filtered = search ? query.ilike("title", likePattern(search)) : query;
    return filtered.order("starts_at");
  };
  const [events, tasks] = await Promise.all([
    readTable(gateway, "events", EVENT_COLUMNS, refine),
    // A rota duty is found through the rota screens, never in the task list or its form (BR24.4).
    readTable(gateway, "tasks", TASK_COLUMNS, (query) => refine(query).eq("origin_kind", "manual")),
  ]);
  const items = [
    ...events.map((row) => ({ at: text(row, "starts_at"), item: eventItem(row) })),
    ...tasks.map((row) => ({ at: text(row, "starts_at"), item: taskItem(row) })),
  ]
    .toSorted((a, b) => a.at.localeCompare(b.at) || a.item.id.localeCompare(b.item.id))
    .map((entry) => entry.item)
    .filter((item) => !state || item.state === state);
  return items.length > 0
    ? { state: "success", data: { items: Object.freeze(items) } }
    : { state: "empty" };
}

async function findRow(
  gateway: DataGateway,
  table: "events" | "tasks",
  id: string,
): Promise<Row | undefined> {
  if (!isUuid(id)) return undefined;
  const columns = table === "events" ? EVENT_COLUMNS : TASK_COLUMNS;
  return (
    await readTable(gateway, table, columns, (query) =>
      table === "tasks" ? query.eq("id", id).eq("origin_kind", "manual") : query.eq("id", id),
    )
  )[0];
}

/** tasks.save: a task or an event; `kind` is needed to create, an existing id is looked up. */
export async function saveTask(
  gateway: DataGateway,
  call: TaskCall,
): Promise<DomainOutcome<AdminItemModel>> {
  const { payload } = call;
  const id = payloadText(payload, "id") ?? "new";
  const creating = id === "new";
  const key = call.idempotencyKey ?? "";
  const expectedVersion = payloadNumber(payload, "expectedVersion");
  let kind = payloadText(payload, "kind");
  let current: Row | undefined;
  if (!creating) {
    const event = await findRow(gateway, "events", id);
    const task = event ? undefined : await findRow(gateway, "tasks", id);
    current = event ?? task;
    if (!current) return { state: "denied" };
    kind = event ? "event" : "task";
  }
  if (kind !== "event" && kind !== "task")
    return refused({ kind: "VAL-REQUIRED" }, "field_invalid");
  const fromRow = (column: string) => (current ? optionalText(current, column) : undefined);

  if (kind === "event") {
    const body = defined({
      id: creating ? null : id,
      expected_version: creating ? undefined : expectedVersion,
      group_id: groupOf(payload, fromRow("group_id")),
      title: payloadText(payload, "title")?.trim() ?? fromRow("title"),
      location: payloadText(payload, "location") ?? fromRow("location"),
      starts_at: payloadText(payload, "startsAt") ?? fromRow("starts_at"),
      ends_at: payloadText(payload, "endsAt") ?? fromRow("ends_at"),
      status: payloadText(payload, "status") ?? fromRow("status"),
      // A key left out keeps the stored setting; the database does the same (BR102.1).
      is_summer: payloadFlag(payload, "isSummer"),
      food_signup_on: payloadFlag(payload, "foodSignupOn"),
      signup_deadline: payloadText(payload, "signupDeadline"),
      // An empty lead clears the stored one; a key left out keeps it.
      notice_lead_days:
        payload.noticeLeadDays === "" ? "" : payloadNumber(payload, "noticeLeadDays"),
    });
    const envelope = await gateway.call(
      "event_save",
      { p_idempotency_key: key, p_event: body },
      key,
    );
    return toOutcome(envelope, (result) =>
      Object.freeze({
        id: result.reference ?? id,
        title: String(body.title ?? ""),
        state: EVENT_STATES[String(body.status ?? "planned")] ?? "scheduled",
        version: typeof result.version === "number" ? result.version : (expectedVersion ?? 0) + 1,
      }),
    );
  }

  const body = defined({
    id: creating ? null : id,
    expected_version: creating ? undefined : expectedVersion,
    group_id: groupOf(payload, fromRow("group_id")),
    event_id: payloadText(payload, "eventId") ?? fromRow("event_id"),
    title: payloadText(payload, "title")?.trim() ?? fromRow("title"),
    category: payloadText(payload, "category") ?? fromRow("category"),
    capacity:
      payloadNumber(payload, "capacity") ?? (current ? integer(current, "capacity") : undefined),
    starts_at: payloadText(payload, "startsAt") ?? fromRow("starts_at"),
    ends_at: payloadText(payload, "endsAt") ?? fromRow("ends_at"),
    location: payloadText(payload, "location") ?? fromRow("location"),
    status: payloadText(payload, "status") ?? fromRow("status"),
  });
  const envelope = await gateway.call("task_save", { p_idempotency_key: key, p_task: body }, key);
  return toOutcome(envelope, (result) =>
    Object.freeze({
      id: result.reference ?? id,
      title: String(body.title ?? ""),
      state: TASK_STATES[String(body.status ?? "open")] ?? "open",
      version: typeof result.version === "number" ? result.version : (expectedVersion ?? 0) + 1,
    }),
  );
}

/** assignments.assign: `id` is the task, `expectedVersion` the task's version, `familyId` the chosen family. */
export async function assignFamily(
  gateway: DataGateway,
  call: TaskCall,
): Promise<DomainOutcome<AdminItemModel>> {
  const { payload } = call;
  const taskId = payloadText(payload, "id") ?? "";
  const familyId = payloadText(payload, "familyId");
  if (!familyId) return refused({ familyId: "VAL-REQUIRED" }, "field_invalid");
  if (!isUuid(taskId) || !isUuid(familyId)) return { state: "denied" };
  const key = call.idempotencyKey ?? "";
  const expectedVersion = payloadNumber(payload, "expectedVersion");
  const envelope = await gateway.call(
    "assignment_assign",
    {
      p_idempotency_key: key,
      p_task_id: taskId,
      p_family_id: familyId,
      p_expected_version: expectedVersion ?? null,
    },
    key,
  );
  return toOutcome(envelope, (result) =>
    Object.freeze({
      id: taskId,
      title: "",
      state: "assigned",
      version:
        typeof result.task_version === "number" ? result.task_version : (expectedVersion ?? 0) + 1,
    }),
  );
}

/** assignments.remove: `id` is the assignment and `expectedVersion` its version. */
export async function removeAssignment(
  gateway: DataGateway,
  call: TaskCall,
): Promise<DomainOutcome<AdminItemModel>> {
  const { payload } = call;
  const id = payloadText(payload, "id") ?? "";
  if (!isUuid(id)) return { state: "denied" };
  const key = call.idempotencyKey ?? "";
  const expectedVersion = payloadNumber(payload, "expectedVersion");
  const envelope = await gateway.call(
    "assignment_remove",
    { p_idempotency_key: key, p_assignment_id: id, p_expected_version: expectedVersion ?? null },
    key,
  );
  return toOutcome(envelope, (result) =>
    Object.freeze({
      id,
      title: "",
      state: "cancelled",
      version: typeof result.version === "number" ? result.version : (expectedVersion ?? 0) + 1,
    }),
  );
}

const APPROVAL_STATES: Readonly<Record<string, string>> = Object.freeze({
  open: "pending",
  approved: "approved",
  rejected: "rejected",
});

/**
 * approvals.list: the cancellation requests the admin may decide, newest first (a swap needs no approval any more, so
 * the list holds cancellations only). The function does the reach filtering; requests that expired or ended without a
 * decision need no action and are left out.
 */
export async function listApprovals(
  gateway: DataGateway,
  payload: Payload,
): Promise<DomainOutcome<AdminListModel>> {
  const state = payloadText(payload, "state");
  const envelope = await gateway.call("cancellation_list", {});
  const outcome = toOutcome(envelope, (current) => asRows(current.items));
  if (outcome.state !== "success") return outcome as DomainOutcome<AdminListModel>;
  const items = outcome.data
    .filter((row) => text(row, "status") in APPROVAL_STATES)
    .map((row) => {
      const task = optionalText(row, "task_title");
      return Object.freeze({
        id: text(row, "request_id"),
        title: task
          ? `${APPROVAL_KIND_TITLES.cancellation} – ${task}`
          : APPROVAL_KIND_TITLES.cancellation,
        state: APPROVAL_STATES[text(row, "status")] ?? "pending",
        version: integer(row, "version"),
      });
    })
    .filter((item) => !state || item.state === state);
  return items.length > 0
    ? { state: "success", data: { items: Object.freeze(items) } }
    : { state: "empty" };
}

/** approvals.decide: `id` is the cancellation request; a swap is decided by the families, not here. */
export async function decideApproval(
  gateway: DataGateway,
  call: TaskCall,
): Promise<DomainOutcome<Readonly<{ outcome: ApprovalOutcome }>>> {
  const { payload } = call;
  const id = payloadText(payload, "id") ?? "";
  if (!isUuid(id)) return { state: "denied" };
  if (payloadText(payload, "kind") === "swap") return { state: "denied" };
  const key = call.idempotencyKey ?? "";
  // Fail closed: an approval is irreversible, so only the two known words decide anything.
  const decision = payloadText(payload, "decision");
  if (decision !== "approved" && decision !== "rejected") {
    return refused({ decision: "VAL-INVALID" }, "field_invalid");
  }
  const approve = decision === "approved";
  const envelope = await gateway.call(
    "cancellation_decide",
    {
      p_idempotency_key: key,
      p_request_id: id,
      p_approve: approve,
      p_expected_version: payloadNumber(payload, "expectedVersion") ?? null,
    },
    key,
  );
  return toOutcome(envelope, (result) => {
    // A repeated key answers with the stored reference only: the decision the admin sent says what happened.
    const outcome: ApprovalOutcome =
      result.outcome === "approved" || result.outcome === "rejected"
        ? result.outcome
        : approve
          ? "approved"
          : "rejected";
    return Object.freeze({ outcome });
  });
}

const SWAP_STATES: Readonly<Record<string, string>> = Object.freeze({
  open: "pending",
  applied: "applied",
  reversed: "reversed",
  rejected: "rejected",
  withdrawn: "withdrawn",
  expired: "expired",
  cancelled: "cancelled",
});

/**
 * swaps.list: the swaps the admin may see (BR75.1), pending and ended, newest first. The title names both duties and
 * both families; `state` is `applied` while the admin can still reverse it and `applied-final` once it can not.
 */
export async function listSwaps(
  gateway: DataGateway,
  payload: Payload,
): Promise<DomainOutcome<AdminListModel>> {
  const year = payloadText(payload, "schoolYearId");
  const envelope = await gateway.call("swap_list", { p_school_year_id: year ?? null });
  const outcome = toOutcome(envelope, (current) => asRows(current.items));
  if (outcome.state !== "success") return outcome as DomainOutcome<AdminListModel>;
  const items = outcome.data.map((row) => {
    const status = text(row, "status");
    const reversible = status === "applied" && row.can_reverse === true;
    return Object.freeze({
      id: text(row, "request_id"),
      title: `${text(row, "source_family_name")}: ${text(row, "source_task_title")} ↔ ${text(row, "target_family_name")}: ${text(row, "target_task_title")}`,
      state:
        status === "applied" && !reversible ? "applied-final" : (SWAP_STATES[status] ?? status),
      version: integer(row, "version"),
    });
  });
  return items.length > 0
    ? { state: "success", data: { items: Object.freeze(items) } }
    : { state: "empty" };
}

/** swaps.reverse: `id` is the swap request and `expectedVersion` its version. */
export async function reverseSwap(
  gateway: DataGateway,
  call: TaskCall,
): Promise<DomainOutcome<AdminItemModel>> {
  const { payload } = call;
  const id = payloadText(payload, "id") ?? "";
  if (!isUuid(id)) return { state: "denied" };
  const key = call.idempotencyKey ?? "";
  const expectedVersion = payloadNumber(payload, "expectedVersion");
  const envelope = await gateway.call(
    "swap_reverse",
    { p_idempotency_key: key, p_request_id: id, p_expected_version: expectedVersion ?? null },
    key,
  );
  return toOutcome(envelope, () =>
    Object.freeze({ id, title: "", state: "reversed", version: (expectedVersion ?? 0) + 1 }),
  );
}

/** duties.reassign: `id` is the duty, `expectedVersion` the version of its place, `familyId` the new family (BR74.1). */
export async function reassignDuty(
  gateway: DataGateway,
  call: TaskCall,
): Promise<DomainOutcome<AdminItemModel>> {
  const { payload } = call;
  const dutyId = payloadText(payload, "id") ?? "";
  const familyId = payloadText(payload, "familyId");
  if (!familyId) return refused({ familyId: "VAL-REQUIRED" }, "field_invalid");
  if (!isUuid(dutyId) || !isUuid(familyId)) return { state: "denied" };
  const key = call.idempotencyKey ?? "";
  const expectedVersion = payloadNumber(payload, "expectedVersion");
  const envelope = await gateway.call(
    "duty_reassign",
    {
      p_idempotency_key: key,
      p_duty_id: dutyId,
      p_expected_version: expectedVersion ?? null,
      p_family_id: familyId,
    },
    key,
  );
  return toOutcome(envelope, (result) =>
    Object.freeze({
      id: dutyId,
      title: "",
      state: "assigned",
      version:
        typeof result.assignment_version === "number"
          ? result.assignment_version
          : (expectedVersion ?? 0) + 1,
    }),
  );
}

/** dashboard.get: the counts for the admin's reach (BR32.5). */
export async function getDashboard(
  gateway: DataGateway,
  scope: Scope,
): Promise<DomainOutcome<DashboardModel>> {
  const envelope = await gateway.call("dashboard_get", {});
  return toOutcome(envelope, (result) =>
    Object.freeze({
      scopeId: scope.id,
      openApprovals: integer(asRow(result), "open_approvals"),
    }),
  );
}
