import type { Scope } from "../access/index.ts";
import type {
  AdminItemModel,
  AdminListModel,
  ApplicationResult,
  ApprovalOutcome,
  DashboardModel,
  GrantOutcome,
  GrantListModel,
  ImportOutcome,
  ImportPreviewModel,
  LifecycleOutcomeModel,
  LifecycleListModel,
  ReminderListModel,
  ReminderOutcome,
  AdvancedSettingsModel,
  AdvancedSettingsOutcome,
  SessionContext,
} from "./contracts.ts";
import type { DomainOutcome, FacadePipeline } from "./facade-pipeline.ts";
import { validateMutationContext } from "./validation.ts";

export type AdminOperation =
  | "dashboard.get"
  | "records.list"
  | "records.get"
  | "records.save"
  | "records.archive"
  | "records.restore"
  | "tasks.list"
  | "tasks.save"
  | "assignments.assign"
  | "approvals.list"
  | "approvals.decide"
  | "notes.save"
  | "import.preview"
  | "import.status"
  | "import.resolve"
  | "import.commit"
  | "import.recover"
  | "reminders.list"
  | "reminders.retry"
  | "governance.update"
  | "governance.list"
  | "lifecycle.list"
  | "lifecycle.run"
  | "settings.get"
  | "settings.save";

export interface AdminApplicationPort {
  execute<T>(input: {
    actorId: string;
    operation: AdminOperation;
    scope: Scope;
    payload: Readonly<Record<string, unknown>>;
  }): Promise<DomainOutcome<T>>;
}

type AdminCommandInput = Readonly<{
  scope: Scope;
  id: string;
  expectedVersion: number;
  idempotencyKey: string;
  payload?: Readonly<Record<string, unknown>>;
}>;

export class AdminApplicationFacade {
  readonly import: AdminImportApplication;
  readonly reminders: AdminReminderApplication;
  readonly governance: AdminGovernanceApplication;
  readonly lifecycle: AdminLifecycleApplication;
  readonly settings: AdminSettingsApplication;
  private readonly pipeline: FacadePipeline;
  private readonly domain: AdminApplicationPort;

  constructor(pipeline: FacadePipeline, domain: AdminApplicationPort) {
    this.pipeline = pipeline;
    this.domain = domain;
    this.import = new AdminImportApplication(pipeline, domain);
    this.reminders = new AdminReminderApplication(pipeline, domain);
    this.governance = new AdminGovernanceApplication(pipeline, domain);
    this.lifecycle = new AdminLifecycleApplication(pipeline, domain);
    this.settings = new AdminSettingsApplication(pipeline, domain);
  }

  getDashboard(session: SessionContext, scope: Scope): Promise<ApplicationResult<DashboardModel>> {
    return this.query(session, scope, "dashboard", "dashboard.get", {});
  }

  listRecords(
    session: SessionContext,
    scope: Scope,
    query: Readonly<Record<string, unknown>> = {},
  ): Promise<ApplicationResult<AdminListModel>> {
    return this.query(session, scope, "record", "records.list", query);
  }

  getRecord(
    session: SessionContext,
    scope: Scope,
    type: string,
    id: string,
  ): Promise<ApplicationResult<AdminItemModel>> {
    return this.query(session, scope, "record", "records.get", { type, id });
  }

  saveRecord(
    session: SessionContext,
    input: AdminCommandInput,
  ): Promise<ApplicationResult<AdminItemModel>> {
    return this.command(session, "record", "records.save", input);
  }

  archiveRecord(
    session: SessionContext,
    input: AdminCommandInput,
  ): Promise<ApplicationResult<Readonly<{ completed: true }>>> {
    return this.command(session, "archive", "records.archive", input);
  }

  restoreRecord(
    session: SessionContext,
    input: AdminCommandInput,
  ): Promise<ApplicationResult<Readonly<{ completed: true }>>> {
    return this.command(session, "archive", "records.restore", input);
  }

  listTasks(
    session: SessionContext,
    scope: Scope,
    query: Readonly<Record<string, unknown>> = {},
  ): Promise<ApplicationResult<AdminListModel>> {
    return this.query(session, scope, "task", "tasks.list", query);
  }

  saveTaskOrEvent(
    session: SessionContext,
    input: AdminCommandInput,
  ): Promise<ApplicationResult<AdminItemModel>> {
    return this.command(session, "task", "tasks.save", input);
  }

  assign(
    session: SessionContext,
    input: AdminCommandInput,
  ): Promise<ApplicationResult<AdminItemModel>> {
    return this.command(session, "assignment", "assignments.assign", input);
  }

  listApprovals(
    session: SessionContext,
    scope: Scope,
    query: Readonly<Record<string, unknown>> = {},
  ): Promise<ApplicationResult<AdminListModel>> {
    return this.query(session, scope, "approval", "approvals.list", query);
  }

  decideApproval(
    session: SessionContext,
    input: AdminCommandInput & { decision: ApprovalOutcome },
  ): Promise<ApplicationResult<Readonly<{ outcome: ApprovalOutcome }>>> {
    return this.command(session, "approval", "approvals.decide", {
      ...input,
      payload: { ...input.payload, decision: input.decision },
    });
  }

  saveEventNotes(
    session: SessionContext,
    input: AdminCommandInput,
  ): Promise<ApplicationResult<AdminItemModel>> {
    return this.command(session, "task", "notes.save", input);
  }

  private query<T>(
    session: SessionContext,
    scope: Scope,
    resource: string,
    operation: AdminOperation,
    payload: Readonly<Record<string, unknown>>,
  ): Promise<ApplicationResult<T>> {
    return invokeAdmin<T>(this.pipeline, this.domain, session, {
      scope,
      resource,
      action: "read",
      operation,
      payload,
    });
  }

  private command<T>(
    session: SessionContext,
    resource: string,
    operation: AdminOperation,
    input: AdminCommandInput,
  ): Promise<ApplicationResult<T>> {
    return invokeAdminCommand<T>(this.pipeline, this.domain, session, resource, operation, input);
  }
}

export class AdminImportApplication {
  private readonly pipeline: FacadePipeline;
  private readonly domain: AdminApplicationPort;

  constructor(pipeline: FacadePipeline, domain: AdminApplicationPort) {
    this.pipeline = pipeline;
    this.domain = domain;
  }

  status(session: SessionContext, scope: Scope): Promise<ApplicationResult<ImportPreviewModel>> {
    return invokeAdmin(this.pipeline, this.domain, session, {
      scope,
      resource: "import",
      action: "read",
      operation: "import.status",
      payload: {},
    });
  }

  createPreview(
    session: SessionContext,
    input: AdminCommandInput,
  ): Promise<ApplicationResult<ImportPreviewModel>> {
    return invokeAdminCommand(
      this.pipeline,
      this.domain,
      session,
      "import",
      "import.preview",
      input,
    );
  }

  resolveConflict(
    session: SessionContext,
    input: AdminCommandInput,
  ): Promise<ApplicationResult<ImportPreviewModel>> {
    return invokeAdminCommand(
      this.pipeline,
      this.domain,
      session,
      "import",
      "import.resolve",
      input,
    );
  }

  commit(
    session: SessionContext,
    input: AdminCommandInput,
  ): Promise<ApplicationResult<ImportOutcome>> {
    return invokeAdminCommand(
      this.pipeline,
      this.domain,
      session,
      "import",
      "import.commit",
      input,
    );
  }

  recover(
    session: SessionContext,
    input: AdminCommandInput,
  ): Promise<ApplicationResult<ImportOutcome>> {
    return invokeAdminCommand(
      this.pipeline,
      this.domain,
      session,
      "import",
      "import.recover",
      input,
    );
  }
}

export class AdminReminderApplication {
  private readonly pipeline: FacadePipeline;
  private readonly domain: AdminApplicationPort;

  constructor(pipeline: FacadePipeline, domain: AdminApplicationPort) {
    this.pipeline = pipeline;
    this.domain = domain;
  }

  list(
    session: SessionContext,
    scope: Scope,
    query: Readonly<Record<string, unknown>> = {},
  ): Promise<ApplicationResult<ReminderListModel>> {
    return invokeAdmin(this.pipeline, this.domain, session, {
      scope,
      resource: "reminder",
      action: "read",
      operation: "reminders.list",
      payload: query,
    });
  }

  retry(
    session: SessionContext,
    input: AdminCommandInput,
  ): Promise<ApplicationResult<ReminderOutcome>> {
    return invokeAdminCommand(
      this.pipeline,
      this.domain,
      session,
      "reminder",
      "reminders.retry",
      input,
    );
  }
}

export class AdminGovernanceApplication {
  private readonly pipeline: FacadePipeline;
  private readonly domain: AdminApplicationPort;

  constructor(pipeline: FacadePipeline, domain: AdminApplicationPort) {
    this.pipeline = pipeline;
    this.domain = domain;
  }

  list(session: SessionContext, scope: Scope): Promise<ApplicationResult<GrantListModel>> {
    return invokeAdmin(this.pipeline, this.domain, session, {
      scope,
      resource: "governance",
      action: "read",
      operation: "governance.list",
      payload: {},
      matrixRowId: "AUTH-SUPER-GOVERNANCE",
    });
  }

  updateGrant(
    session: SessionContext,
    input: AdminCommandInput,
  ): Promise<ApplicationResult<GrantOutcome>> {
    return invokeAdminCommand(
      this.pipeline,
      this.domain,
      session,
      "governance",
      "governance.update",
      input,
      "AUTH-SUPER-GOVERNANCE",
    );
  }
}

export class AdminLifecycleApplication {
  private readonly pipeline: FacadePipeline;
  private readonly domain: AdminApplicationPort;

  constructor(pipeline: FacadePipeline, domain: AdminApplicationPort) {
    this.pipeline = pipeline;
    this.domain = domain;
  }

  list(
    session: SessionContext,
    scope: Scope,
    query: Readonly<Record<string, unknown>> = {},
  ): Promise<ApplicationResult<LifecycleListModel>> {
    return invokeAdmin(this.pipeline, this.domain, session, {
      scope,
      resource: "lifecycle",
      action: "read",
      operation: "lifecycle.list",
      payload: query,
    });
  }

  run(
    session: SessionContext,
    input: AdminCommandInput,
  ): Promise<ApplicationResult<LifecycleOutcomeModel>> {
    return invokeAdminCommand(
      this.pipeline,
      this.domain,
      session,
      "lifecycle",
      "lifecycle.run",
      input,
    );
  }
}

export class AdminSettingsApplication {
  private readonly pipeline: FacadePipeline;
  private readonly domain: AdminApplicationPort;

  constructor(pipeline: FacadePipeline, domain: AdminApplicationPort) {
    this.pipeline = pipeline;
    this.domain = domain;
  }

  get(session: SessionContext, scope: Scope): Promise<ApplicationResult<AdvancedSettingsModel>> {
    return invokeAdmin(this.pipeline, this.domain, session, {
      scope,
      resource: "settings",
      action: "read",
      operation: "settings.get",
      payload: {},
    });
  }

  save(
    session: SessionContext,
    input: AdminCommandInput,
  ): Promise<ApplicationResult<AdvancedSettingsOutcome>> {
    return invokeAdminCommand(
      this.pipeline,
      this.domain,
      session,
      "settings",
      "settings.save",
      input,
    );
  }
}

function invokeAdmin<T>(
  pipeline: FacadePipeline,
  domain: AdminApplicationPort,
  session: SessionContext,
  input: {
    scope: Scope;
    resource: string;
    action: "read" | "manage";
    operation: AdminOperation;
    payload: Readonly<Record<string, unknown>>;
    idempotencyKey?: string;
    idempotency?: Readonly<{ operation: string; fingerprint: string }>;
    matrixRowId?: "AUTH-SUPER-GOVERNANCE";
  },
): Promise<ApplicationResult<T>> {
  return pipeline.invoke({
    session,
    matrixRowId: input.matrixRowId ?? matrixRowFor(session, input.resource),
    action: input.action,
    resource: input.resource,
    scope: input.scope,
    idempotencyKey: input.idempotencyKey,
    idempotency: input.idempotency,
    invoke: () =>
      domain.execute<T>({
        actorId: session.subjectId,
        operation: input.operation,
        scope: input.scope,
        payload: input.payload,
      }),
    project: freezeModel,
  });
}

function invokeAdminCommand<T>(
  pipeline: FacadePipeline,
  domain: AdminApplicationPort,
  session: SessionContext,
  resource: string,
  operation: AdminOperation,
  input: AdminCommandInput,
  matrixRowId?: "AUTH-SUPER-GOVERNANCE",
): Promise<ApplicationResult<T>> {
  const validation = validateMutationContext(input);
  if (validation.state !== "success") return Promise.resolve(validation);
  return invokeAdmin(pipeline, domain, session, {
    scope: input.scope,
    resource,
    action: "manage",
    operation,
    payload: { id: input.id, expectedVersion: input.expectedVersion, ...input.payload },
    idempotencyKey: input.idempotencyKey,
    idempotency: {
      operation,
      fingerprint: `${input.id}:${input.expectedVersion}:${stableStringify(input.payload ?? {})}`,
    },
    matrixRowId,
  });
}

function matrixRowFor(
  session: SessionContext,
  resource: string,
):
  | "AUTH-GROUP-ADMIN-CORE"
  | "AUTH-GRP-IMPORT-DENY"
  | "AUTH-KINDERGARTEN-ADMIN"
  | "AUTH-SUPER-ADMIN" {
  if (session.roles.includes("super_admin")) return "AUTH-SUPER-ADMIN";
  if (session.roles.includes("kindergarten_admin")) return "AUTH-KINDERGARTEN-ADMIN";
  return resource === "import" ? "AUTH-GRP-IMPORT-DENY" : "AUTH-GROUP-ADMIN-CORE";
}

function freezeModel<T>(model: T): Readonly<T> {
  if (model && typeof model === "object") return Object.freeze(model);
  return model;
}

function stableStringify(value: Readonly<Record<string, unknown>>): string {
  return JSON.stringify(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)));
}
