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
import { defined, likePattern, payloadNumber, payloadText, type Payload } from "./payload.ts";
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
      ...present(row, "coordinator_name", "coordinatorName"),
      ...present(row, "allergen_note", "allergenNote"),
      ...present(row, "supply_note", "supplyNote"),
      ...present(row, "food_note", "foodNote"),
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
  "id,group_id,title,location,coordinator_name,starts_at,ends_at,allergen_note,supply_note,food_note,status,version";

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
    readTable(gateway, "tasks", TASK_COLUMNS, refine),
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
  return (await readTable(gateway, table, columns, (query) => query.eq("id", id)))[0];
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
      coordinator_name: payloadText(payload, "coordinatorName") ?? fromRow("coordinator_name"),
      starts_at: payloadText(payload, "startsAt") ?? fromRow("starts_at"),
      ends_at: payloadText(payload, "endsAt") ?? fromRow("ends_at"),
      status: payloadText(payload, "status") ?? fromRow("status"),
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

/** notes.save: the three notes of an event (an empty text clears one). `id` is the event. */
export async function saveNotes(
  gateway: DataGateway,
  call: TaskCall,
): Promise<DomainOutcome<AdminItemModel>> {
  const { payload } = call;
  const id = payloadText(payload, "id") ?? "";
  if (!isUuid(id)) return { state: "denied" };
  const key = call.idempotencyKey ?? "";
  const expectedVersion = payloadNumber(payload, "expectedVersion");
  const envelope = await gateway.call(
    "event_save_notes",
    {
      p_idempotency_key: key,
      p_event_id: id,
      p_expected_version: expectedVersion ?? null,
      p_allergen_note: payloadText(payload, "allergenNote") ?? "",
      p_supply_note: payloadText(payload, "supplyNote") ?? "",
      p_food_note: payloadText(payload, "foodNote") ?? "",
    },
    key,
  );
  return toOutcome(envelope, (result) =>
    Object.freeze({
      id,
      title: "",
      state: "notes-saved",
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
  applied: "approved",
  rejected: "rejected",
});

const STATUS_FILTER: Readonly<Record<string, readonly string[]>> = Object.freeze({
  pending: ["open"],
  approved: ["approved", "applied"],
  rejected: ["rejected"],
});

function taskTitleOf(row: Row): string | undefined {
  const assignment = row.assignments;
  const first = Array.isArray(assignment) ? assignment[0] : assignment;
  if (!first || typeof first !== "object") return undefined;
  const task = (first as Row).tasks;
  const one = Array.isArray(task) ? task[0] : task;
  return one && typeof one === "object" ? optionalText(one as Row, "title") : undefined;
}

/** approvals.list: swap and cancellation requests of the admin's reach, newest first, withdrawn ones left out. */
export async function listApprovals(
  gateway: DataGateway,
  payload: Payload,
): Promise<DomainOutcome<AdminListModel>> {
  const state = payloadText(payload, "state");
  const statuses = state ? STATUS_FILTER[state] : undefined;
  const data = await gateway.select("approvals.list", (client) => {
    const query = client
      .from("change_requests")
      .select("id,kind,status,version,assignments!assignment_id(tasks(title))")
      .neq("status", "withdrawn") as unknown as Filterable;
    return (statuses ? query.in("status", statuses) : query)
      .order("created_at", { ascending: false })
      .limit(500);
  });
  const items = asRows(data).map((row) => {
    const kind = text(row, "kind") === "cancellation" ? "cancellation" : "swap";
    const task = taskTitleOf(row);
    return Object.freeze({
      id: text(row, "id"),
      title: task ? `${APPROVAL_KIND_TITLES[kind]} – ${task}` : APPROVAL_KIND_TITLES[kind],
      state: APPROVAL_STATES[text(row, "status")] ?? "pending",
      version: integer(row, "version"),
    });
  });
  return items.length > 0
    ? { state: "success", data: { items: Object.freeze(items) } }
    : { state: "empty" };
}

/** approvals.decide: `id` is the request; a swap and a cancellation have their own decision function. */
export async function decideApproval(
  gateway: DataGateway,
  call: TaskCall,
): Promise<DomainOutcome<Readonly<{ outcome: ApprovalOutcome }>>> {
  const { payload } = call;
  const id = payloadText(payload, "id") ?? "";
  if (!isUuid(id)) return { state: "denied" };
  let kind = payloadText(payload, "kind");
  if (kind !== "swap" && kind !== "cancellation") {
    const rows = asRows(
      await gateway.select("approvals.kind", (client) =>
        (client.from("change_requests").select("kind") as unknown as Filterable)
          .eq("id", id)
          .limit(1),
      ),
    );
    kind = rows[0] ? text(rows[0], "kind") : undefined;
  }
  if (kind !== "swap" && kind !== "cancellation") return { state: "denied" };
  const key = call.idempotencyKey ?? "";
  // Fail closed: an approval is irreversible, so only the two known words decide anything.
  const decision = payloadText(payload, "decision");
  if (decision !== "approved" && decision !== "rejected") {
    return refused({ decision: "VAL-INVALID" }, "field_invalid");
  }
  const approve = decision === "approved";
  const envelope = await gateway.call(
    kind === "swap" ? "swap_decide" : "cancellation_decide",
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
