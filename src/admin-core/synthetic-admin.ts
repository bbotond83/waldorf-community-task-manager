import type { Scope } from "../access/index.ts";
import {
  AdminApplicationFacade,
  FacadePipeline,
  IdempotencyCoordinator,
  InMemoryIdempotencyStore,
  type AdminApplicationPort,
  type AdminItemModel,
  type AdminListModel,
  type AdminOperation,
  type ApprovalOutcome,
  type AuthorizationContract,
  type DashboardModel,
  type DomainOutcome,
} from "../application/index.ts";

type SyntheticAdminItem = {
  id: string;
  title: string;
  state: string;
  version?: number;
  scopeId: string;
  kind: string;
};

export class RetryableAdminDependencyError extends Error {}
export class TerminalAdminDependencyError extends Error {}

const INITIAL_RECORDS: readonly SyntheticAdminItem[] = [
  {
    id: "family-feny",
    title: "Fenyő család",
    state: "active",
    version: 1,
    scopeId: "group-boroka",
    kind: "family",
  },
  {
    id: "child-patak",
    title: "Patak gyermek",
    state: "active",
    version: 2,
    scopeId: "group-boroka",
    kind: "child",
  },
  {
    id: "group-boroka",
    title: "Boróka csoport",
    state: "active",
    version: 3,
    scopeId: "group-boroka",
    kind: "group",
  },
  {
    id: "family-napraforgo",
    title: "Napraforgó család",
    state: "active",
    version: 1,
    scopeId: "group-napraforgo",
    kind: "family",
  },
  {
    id: "year-2026",
    title: "2026/2027-es nevelési év",
    state: "archived",
    version: 4,
    scopeId: "org-napsugar",
    kind: "school-year",
  },
];

const INITIAL_TASKS: readonly SyntheticAdminItem[] = [
  {
    id: "task-kert",
    title: "Kerti előkészületek",
    state: "open",
    version: 1,
    scopeId: "group-boroka",
    kind: "task",
  },
  {
    id: "event-lampa",
    title: "Lámpás ünnep",
    state: "scheduled",
    version: 2,
    scopeId: "group-boroka",
    kind: "event",
  },
  {
    id: "task-muhely",
    title: "Műhely rendezése",
    state: "open",
    version: 1,
    scopeId: "group-napraforgo",
    kind: "task",
  },
];

const INITIAL_APPROVALS: readonly SyntheticAdminItem[] = [
  {
    id: "approval-csere",
    title: "Feladatcsere-kérelem",
    state: "pending",
    version: 1,
    scopeId: "group-boroka",
    kind: "swap",
  },
  {
    id: "approval-lemondas",
    title: "Lemondási kérelem",
    state: "pending",
    version: 1,
    scopeId: "group-boroka",
    kind: "cancellation",
  },
  {
    id: "approval-lezart",
    title: "Korábban elbírált kérelem",
    state: "approved",
    version: 2,
    scopeId: "group-boroka",
    kind: "swap",
  },
  {
    id: "approval-mobile",
    title: "Mobil felületen elbírálandó kérelem",
    state: "pending",
    version: 1,
    scopeId: "group-boroka",
    kind: "swap",
  },
];

export class SyntheticAdminPort implements AdminApplicationPort {
  private records = cloneItems(INITIAL_RECORDS);
  private tasks = cloneItems(INITIAL_TASKS);
  private approvals = cloneItems(INITIAL_APPROVALS);

  async execute<T>(input: {
    actorId: string;
    operation: AdminOperation;
    scope: Scope;
    payload: Readonly<Record<string, unknown>>;
  }): Promise<DomainOutcome<T>> {
    applyFailureScenario(input.payload);
    const outcome = this.executeOperation(input);
    return outcome as DomainOutcome<T>;
  }

  reset(): void {
    this.records = cloneItems(INITIAL_RECORDS);
    this.tasks = cloneItems(INITIAL_TASKS);
    this.approvals = cloneItems(INITIAL_APPROVALS);
  }

  private executeOperation(input: {
    operation: AdminOperation;
    scope: Scope;
    payload: Readonly<Record<string, unknown>>;
  }): DomainOutcome<unknown> {
    switch (input.operation) {
      case "dashboard.get":
        return this.dashboard(input.scope);
      case "records.list":
        return this.list(this.records, input.scope, input.payload);
      case "records.get":
        return this.get(this.records, input.scope, input.payload);
      case "records.save":
        return this.saveRecord(input.scope, input.payload);
      case "records.archive":
        return this.changeRecordState(input.scope, input.payload, "archived");
      case "records.restore":
        return this.restoreRecord(input.scope, input.payload);
      case "tasks.list":
        return this.list(this.tasks, input.scope, input.payload);
      case "tasks.save":
        return this.saveTask(input.scope, input.payload);
      case "assignments.assign":
        return this.assign(input.scope, input.payload);
      case "approvals.list":
        return this.list(this.approvals, input.scope, input.payload);
      case "approvals.decide":
        return this.decideApproval(input.scope, input.payload);
      case "notes.save":
        return this.saveNotes(input.scope, input.payload);
      default:
        return { state: "denied" };
    }
  }

  private dashboard(scope: Scope): DomainOutcome<DashboardModel> {
    return {
      state: "success",
      data: {
        scopeId: scope.id,
        openApprovals: this.visible(this.approvals, scope).filter(
          (item) => item.state === "pending",
        ).length,
        openImportConflicts: 0,
      },
    };
  }

  private list(
    items: readonly SyntheticAdminItem[],
    scope: Scope,
    query: Readonly<Record<string, unknown>>,
  ): DomainOutcome<AdminListModel> {
    const search = typeof query.q === "string" ? query.q.trim().toLocaleLowerCase("hu") : "";
    const state = typeof query.state === "string" ? query.state : undefined;
    const visible = this.visible(items, scope).filter(
      (item) =>
        (!search || item.title.toLocaleLowerCase("hu").includes(search)) &&
        (!state || item.state === state),
    );
    return visible.length === 0
      ? { state: "empty" }
      : { state: "success", data: { items: visible.map(toAdminItem) } };
  }

  private get(
    items: readonly SyntheticAdminItem[],
    scope: Scope,
    payload: Readonly<Record<string, unknown>>,
  ): DomainOutcome<AdminItemModel> {
    const item = items.find((candidate) => candidate.id === payload.id);
    if (!item || !isInScope(item, scope)) return { state: "denied" };
    return { state: "success", data: toAdminItem(item) };
  }

  private saveRecord(
    scope: Scope,
    payload: Readonly<Record<string, unknown>>,
  ): DomainOutcome<AdminItemModel> {
    const id = String(payload.id ?? "");
    if (id === "new") {
      const title = String(payload.title ?? "").trim();
      const created: SyntheticAdminItem = {
        id: `record-${this.records.length + 1}`,
        title,
        state: "active",
        version: 1,
        scopeId: scope.id,
        kind: String(payload.kind ?? "family"),
      };
      this.records.push(created);
      return { state: "success", data: toAdminItem(created) };
    }
    return this.updateItem(this.records, scope, payload, (item) => ({
      ...item,
      title: String(payload.title ?? item.title).trim(),
    }));
  }

  private changeRecordState(
    scope: Scope,
    payload: Readonly<Record<string, unknown>>,
    state: string,
  ): DomainOutcome<Readonly<{ completed: true }>> {
    const result = this.updateItem(this.records, scope, payload, (item) => ({ ...item, state }));
    switch (result.state) {
      case "success":
        return { state: "success", data: { completed: true } };
      case "empty":
      case "denied":
      case "validation":
      case "conflict":
      case "invalidated":
        return result;
      case "recovery":
        return { state: "recovery", data: { completed: true } };
    }
  }

  private restoreRecord(
    scope: Scope,
    payload: Readonly<Record<string, unknown>>,
  ): DomainOutcome<Readonly<{ completed: true }>> {
    if (payload.scenario === "restore-conflict")
      return { state: "conflict", code: "RESTORE_CONFLICT" };
    return this.changeRecordState(scope, payload, "active");
  }

  private saveTask(
    scope: Scope,
    payload: Readonly<Record<string, unknown>>,
  ): DomainOutcome<AdminItemModel> {
    const id = String(payload.id ?? "");
    if (id === "new") {
      const created: SyntheticAdminItem = {
        id: `task-${this.tasks.length + 1}`,
        title: String(payload.title ?? "").trim(),
        state: payload.kind === "event" ? "scheduled" : "open",
        version: 1,
        scopeId: scope.id,
        kind: String(payload.kind ?? "task"),
      };
      this.tasks.push(created);
      return { state: "success", data: toAdminItem(created) };
    }
    return this.updateItem(this.tasks, scope, payload, (item) => ({
      ...item,
      title: String(payload.title ?? item.title).trim(),
    }));
  }

  private assign(
    scope: Scope,
    payload: Readonly<Record<string, unknown>>,
  ): DomainOutcome<AdminItemModel> {
    const scenario = payload.scenario;
    if (scenario === "ineligible") return { state: "conflict", code: "ASSIGNMENT_INELIGIBLE" };
    if (scenario === "full") return { state: "conflict", code: "ASSIGNMENT_CAPACITY_FULL" };
    const task = this.tasks.find((candidate) => candidate.id === payload.id);
    if (!task || !isInScope(task, scope)) return { state: "denied" };
    if (task.version !== payload.expectedVersion)
      return { state: "conflict", code: "VERSION_CONFLICT" };
    return {
      state: "success",
      data: { id: task.id, title: task.title, state: "assigned", version: (task.version ?? 1) + 1 },
    };
  }

  private decideApproval(
    scope: Scope,
    payload: Readonly<Record<string, unknown>>,
  ): DomainOutcome<Readonly<{ outcome: ApprovalOutcome }>> {
    if (payload.scenario === "invalidated")
      return { state: "invalidated", code: "APPROVAL_INVALIDATED" };
    if (payload.scenario === "denied") return { state: "denied" };
    const approval = this.approvals.find((candidate) => candidate.id === payload.id);
    if (!approval || !isInScope(approval, scope)) return { state: "denied" };
    if (approval.state !== "pending")
      return { state: "conflict", code: "APPROVAL_ALREADY_DECIDED" };
    if (approval.version !== payload.expectedVersion)
      return { state: "invalidated", code: "APPROVAL_INVALIDATED" };
    const decision = payload.decision === "rejected" ? "rejected" : "approved";
    approval.state = decision;
    approval.version = (approval.version ?? 1) + 1;
    return { state: "success", data: { outcome: decision } };
  }

  private saveNotes(
    scope: Scope,
    payload: Readonly<Record<string, unknown>>,
  ): DomainOutcome<AdminItemModel> {
    const task = this.tasks.find((candidate) => candidate.id === payload.id);
    if (!task || task.kind !== "event" || !isInScope(task, scope)) return { state: "denied" };
    if (task.version !== payload.expectedVersion)
      return { state: "conflict", code: "VERSION_CONFLICT" };
    task.version = (task.version ?? 1) + 1;
    return {
      state: "success",
      data: { id: task.id, title: task.title, state: "notes-saved", version: task.version },
    };
  }

  private updateItem(
    items: SyntheticAdminItem[],
    scope: Scope,
    payload: Readonly<Record<string, unknown>>,
    update: (item: SyntheticAdminItem) => SyntheticAdminItem,
  ): DomainOutcome<AdminItemModel> {
    const index = items.findIndex((candidate) => candidate.id === payload.id);
    const item = items[index];
    if (!item || !isInScope(item, scope)) return { state: "denied" };
    if (item.version !== payload.expectedVersion)
      return { state: "conflict", code: "VERSION_CONFLICT" };
    const updated = { ...update(item), version: (item.version ?? 1) + 1 };
    items[index] = updated;
    return { state: "success", data: toAdminItem(updated) };
  }

  private visible(items: readonly SyntheticAdminItem[], scope: Scope): SyntheticAdminItem[] {
    return items.filter((item) => isInScope(item, scope));
  }
}

const GLOBAL_STORE_KEY = Symbol.for("waldorf.admin-core.synthetic-store");
type SyntheticAdminContainer = {
  port: SyntheticAdminPort;
  idempotency: InMemoryIdempotencyStore;
};
type AdminGlobal = typeof globalThis & { [GLOBAL_STORE_KEY]?: SyntheticAdminContainer };

function getSyntheticAdminContainer(): SyntheticAdminContainer {
  const adminGlobal = globalThis as AdminGlobal;
  adminGlobal[GLOBAL_STORE_KEY] ??= {
    port: new SyntheticAdminPort(),
    idempotency: new InMemoryIdempotencyStore(),
  };
  return adminGlobal[GLOBAL_STORE_KEY];
}

export function getSyntheticAdminPort(): SyntheticAdminPort {
  return getSyntheticAdminContainer().port;
}

export function resetSyntheticAdminFixtures(): void {
  const adminGlobal = globalThis as AdminGlobal;
  adminGlobal[GLOBAL_STORE_KEY] = {
    port: new SyntheticAdminPort(),
    idempotency: new InMemoryIdempotencyStore(),
  };
}

export function createSyntheticAdminFacade(
  authorization: AuthorizationContract,
): AdminApplicationFacade {
  const pipeline = new FacadePipeline(
    authorization,
    (error) => (error instanceof RetryableAdminDependencyError ? "retryable" : "terminal"),
    new IdempotencyCoordinator(getSyntheticAdminContainer().idempotency),
  );
  return new AdminApplicationFacade(pipeline, getSyntheticAdminPort());
}

function applyFailureScenario(payload: Readonly<Record<string, unknown>>): void {
  if (payload.scenario === "retryable") throw new RetryableAdminDependencyError("synthetic retry");
  if (payload.scenario === "terminal") throw new TerminalAdminDependencyError("synthetic terminal");
}

function isInScope(item: SyntheticAdminItem, scope: Scope): boolean {
  return scope.type === "organization" || item.scopeId === scope.id;
}

function toAdminItem(item: SyntheticAdminItem): AdminItemModel {
  return { id: item.id, title: item.title, state: item.state, version: item.version };
}

function cloneItems(items: readonly SyntheticAdminItem[]): SyntheticAdminItem[] {
  return items.map((item) => ({ ...item }));
}
