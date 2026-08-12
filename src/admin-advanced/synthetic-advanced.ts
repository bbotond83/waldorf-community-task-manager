import type { Scope } from "../access/index.ts";
import {
  AdminApplicationFacade,
  FacadePipeline,
  IdempotencyCoordinator,
  InMemoryIdempotencyStore,
  type AdminApplicationPort,
  type AdminOperation,
  type AdvancedSettingsModel,
  type AdvancedSettingsOutcome,
  type AuthorizationContract,
  type DomainOutcome,
  type GrantListModel,
  type GrantOutcome,
  type ImportOutcome,
  type ImportPreviewModel,
  type LifecycleListModel,
  type LifecycleOutcomeModel,
  type ReminderListModel,
  type ReminderOutcome,
} from "../application/index.ts";

export class RetryableAdvancedDependencyError extends Error {}
export class TerminalAdvancedDependencyError extends Error {}

type MutableImportPreview = {
  id: string;
  fingerprint: string;
  changedRows: string[];
  conflicts: Array<{
    id: string;
    rowLabel: string;
    message: string;
    resolution?: "keep-existing" | "use-import";
  }>;
  step: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  fixtureId: string;
  totalRows: number;
  state: ImportPreviewModel["state"];
};

const FIXTURE_FINGERPRINT = "sha256:waldorf-advanced-v1:8b12";

const INITIAL_REMINDERS: ReminderListModel["jobs"] = [
  {
    id: "job-lampas",
    title: "Lámpás ünnep — 24 órás emlékeztető",
    status: "retryable",
    attempt: 1,
    correlationId: "corr-lampas-01",
    recipientSummary: "3 kijelölt család",
    providerLabel: "Szimulált kézbesítés",
    version: 1,
  },
  {
    id: "job-kert",
    title: "Kerti előkészületek — 7 napos emlékeztető",
    status: "sent",
    attempt: 1,
    correlationId: "corr-kert-01",
    recipientSummary: "2 kijelölt család",
    providerLabel: "Szimulált kézbesítés",
    version: 1,
  },
  {
    id: "job-regi",
    title: "Lezárt feladat emlékeztetője",
    status: "stale",
    attempt: 2,
    correlationId: "corr-regi-01",
    recipientSummary: "Nincs aktív címzett",
    providerLabel: "Szimulált kézbesítés",
    version: 2,
  },
];

const INITIAL_GRANTS: GrantListModel["grants"] = [
  {
    id: "grant-super-current",
    subjectLabel: "Aktív szuperadminisztrátor",
    role: "super_admin",
    scopeLabel: "Teljes szervezet",
    version: 1,
    isSelf: true,
  },
  {
    id: "grant-super-backup",
    subjectLabel: "Tartalék szuperadminisztrátor",
    role: "super_admin",
    scopeLabel: "Teljes szervezet",
    version: 1,
    isSelf: false,
  },
  {
    id: "grant-group-target",
    subjectLabel: "Kijelölt csoportadminisztrátor",
    role: "group_admin",
    scopeLabel: "Boróka csoport",
    version: 1,
    isSelf: false,
  },
];

const INITIAL_LIFECYCLE: LifecycleListModel["candidates"] = [
  {
    id: "family-departed",
    label: "Távozott család A",
    eligibility: "eligible-anonymize",
    version: 1,
  },
  {
    id: "family-retained",
    label: "Távozott család B",
    eligibility: "blocked",
    blockerSummary: "Aktív megőrzési kötelezettség",
    version: 2,
  },
  { id: "family-delete", label: "Távozott család C", eligibility: "eligible-delete", version: 1 },
];

class AdvancedWorkflowStore implements AdminApplicationPort {
  private preview?: MutableImportPreview;
  private importOutcome?: ImportOutcome;
  private reminders = INITIAL_REMINDERS.map((job) => ({ ...job }));
  private grants = INITIAL_GRANTS.map((grant) => ({ ...grant }));
  private lastGrantOutcome?: GrantOutcome;
  private lifecycle = INITIAL_LIFECYCLE.map((candidate) => ({ ...candidate }));
  private settings: AdvancedSettingsModel = {
    recipients: [
      {
        id: "recipient-duty",
        label: "Aktív feladatok érintettjei",
        summary: "Csak a kijelölt feladatok családjai",
      },
      { id: "recipient-group", label: "Boróka csoport", summary: "A csoport aktív családjai" },
    ],
    selectedRecipientId: "recipient-duty",
    remindersEnabled: true,
    version: 1,
  };
  private revokedSubjects = new Set<string>();

  async execute<T>(input: {
    actorId: string;
    operation: AdminOperation;
    scope: Scope;
    payload: Readonly<Record<string, unknown>>;
  }): Promise<DomainOutcome<T>> {
    applyFailure(input.payload);
    return this.dispatch(input) as DomainOutcome<T>;
  }

  isRevoked(subjectId: string): boolean {
    return this.revokedSubjects.has(subjectId);
  }

  private dispatch(input: {
    actorId: string;
    operation: AdminOperation;
    payload: Readonly<Record<string, unknown>>;
  }): DomainOutcome<unknown> {
    switch (input.operation) {
      case "import.status":
        return this.preview
          ? { state: "success", data: freezePreview(this.preview) }
          : { state: "empty" };
      case "import.preview":
        return this.createPreview(input.payload);
      case "import.resolve":
        return this.resolveConflict(input.payload);
      case "import.commit":
        return this.commitImport(input.payload);
      case "import.recover":
        return this.recoverImport(input.payload);
      case "reminders.list":
        return this.listReminders(input.payload);
      case "reminders.retry":
        return this.retryReminder(input.payload);
      case "governance.list":
        return {
          state: "success",
          data: {
            grants: this.grants.map((grant) => ({ ...grant })),
            lastOutcome: this.lastGrantOutcome,
          },
        };
      case "governance.update":
        return this.updateGrant(input.actorId, input.payload);
      case "lifecycle.list":
        return this.listLifecycle(input.payload);
      case "lifecycle.run":
        return this.runLifecycle(input.payload);
      case "settings.get":
        return {
          state: "success",
          data: { ...this.settings, recipients: [...this.settings.recipients] },
        };
      case "settings.save":
        return this.saveSettings(input.payload);
      default:
        return { state: "denied" };
    }
  }

  private createPreview(
    payload: Readonly<Record<string, unknown>>,
  ): DomainOutcome<ImportPreviewModel> {
    const scenario = String(payload.scenario ?? "valid");
    if (["malformed", "oversized", "missing-sheet", "missing-header"].includes(scenario)) {
      return { state: "conflict", code: `IMPORT_${scenario.toUpperCase().replaceAll("-", "_")}` };
    }
    this.preview = {
      id: "preview-waldorf-v1",
      fingerprint: FIXTURE_FINGERPRINT,
      changedRows: ["Boróka csoport: 2 módosítás", "Napraforgó csoport: 1 új rekord"],
      conflicts: [
        {
          id: "conflict-family-1",
          rowLabel: "Családok · 12. sor",
          message: "A rekord már létezik.",
        },
      ],
      step: 4,
      fixtureId: "workbook-waldorf-v1",
      totalRows: 30,
      state: "conflicts",
    };
    this.importOutcome = undefined;
    return { state: "success", data: freezePreview(this.preview) };
  }

  private resolveConflict(
    payload: Readonly<Record<string, unknown>>,
  ): DomainOutcome<ImportPreviewModel> {
    if (!this.preview) return { state: "invalidated", code: "IMPORT_PREVIEW_STALE" };
    if (payload.expectedVersion !== 1)
      return { state: "invalidated", code: "IMPORT_PREVIEW_STALE" };
    const conflict = this.preview.conflicts.find((item) => item.id === payload.conflictId);
    const resolution = payload.resolution;
    if (!conflict || (resolution !== "keep-existing" && resolution !== "use-import")) {
      return { state: "conflict", code: "IMPORT_CONFLICT_UNRESOLVED" };
    }
    conflict.resolution = resolution;
    this.preview.step = 5;
    this.preview.state = "confirmed";
    return { state: "success", data: freezePreview(this.preview) };
  }

  private commitImport(payload: Readonly<Record<string, unknown>>): DomainOutcome<ImportOutcome> {
    if (!this.preview) return { state: "invalidated", code: "IMPORT_PREVIEW_STALE" };
    if (payload.fingerprint !== this.preview.fingerprint)
      return { state: "conflict", code: "IMPORT_FINGERPRINT_CHANGED" };
    if (this.preview.conflicts.some((conflict) => !conflict.resolution))
      return { state: "conflict", code: "IMPORT_CONFLICT_UNRESOLVED" };
    if (payload.confirmed !== "yes")
      return { state: "conflict", code: "IMPORT_CONFIRMATION_REQUIRED" };
    if (payload.scenario === "interrupted") {
      this.importOutcome = {
        runId: "run-waldorf-v1",
        importedRows: 0,
        skippedRows: 0,
        fingerprint: this.preview.fingerprint,
        state: "interrupted",
      };
      this.preview.step = 6;
      return { state: "recovery", data: this.importOutcome };
    }
    this.preview.step = 7;
    this.preview.state = "committed";
    this.importOutcome = {
      runId: "run-waldorf-v1",
      importedRows: 3,
      skippedRows: 1,
      fingerprint: this.preview.fingerprint,
      state: "committed",
    };
    return { state: "success", data: this.importOutcome };
  }

  private recoverImport(payload: Readonly<Record<string, unknown>>): DomainOutcome<ImportOutcome> {
    if (!this.importOutcome || this.importOutcome.state !== "interrupted")
      return { state: "conflict", code: "IMPORT_RECOVERY_NOT_AVAILABLE" };
    if (payload.action !== "resume")
      return { state: "conflict", code: "IMPORT_RECOVERY_ACTION_INVALID" };
    this.importOutcome = {
      ...this.importOutcome,
      importedRows: 3,
      skippedRows: 1,
      state: "recovered",
    };
    if (this.preview) {
      this.preview.step = 7;
      this.preview.state = "committed";
    }
    return { state: "success", data: this.importOutcome };
  }

  private listReminders(
    payload: Readonly<Record<string, unknown>>,
  ): DomainOutcome<ReminderListModel> {
    const status = String(payload.status ?? "");
    const jobs = this.reminders.filter((job) => !status || job.status === status);
    return jobs.length
      ? { state: "success", data: { jobs: jobs.map((job) => ({ ...job })) } }
      : { state: "empty" };
  }

  private retryReminder(
    payload: Readonly<Record<string, unknown>>,
  ): DomainOutcome<ReminderOutcome> {
    const job = this.reminders.find((candidate) => candidate.id === payload.id);
    if (!job) return { state: "denied" };
    if (job.status !== "retryable") return { state: "conflict", code: "REMINDER_NOT_RETRYABLE" };
    if (job.version !== payload.expectedVersion)
      return { state: "invalidated", code: "REMINDER_STALE" };
    job.status = "retrying";
    job.attempt += 1;
    job.version += 1;
    return { state: "success", data: { jobId: job.id, status: "retry-scheduled" } };
  }

  private updateGrant(
    actorId: string,
    payload: Readonly<Record<string, unknown>>,
  ): DomainOutcome<GrantOutcome> {
    const grant = this.grants.find((candidate) => candidate.id === payload.id);
    if (!grant) return { state: "denied" };
    if (grant.version !== payload.expectedVersion)
      return { state: "invalidated", code: "GRANT_STALE" };
    if (payload.scenario === "last-admin")
      return { state: "conflict", code: "GRANT_LAST_SUPER_ADMIN" };
    if (grant.isSelf || payload.scenario === "self-lockout")
      return { state: "conflict", code: "GRANT_SELF_LOCKOUT" };
    const superCount = this.grants.filter((candidate) => candidate.role === "super_admin").length;
    if (grant.role === "super_admin" && superCount <= 1)
      return { state: "conflict", code: "GRANT_LAST_SUPER_ADMIN" };
    this.grants = this.grants.filter((candidate) => candidate.id !== grant.id);
    const subjectId =
      grant.id === "grant-group-target" ? "group-admin-local" : "super-admin-backup-local";
    if (subjectId !== actorId) this.revokedSubjects.add(subjectId);
    this.lastGrantOutcome = {
      grantId: grant.id,
      authorizationVersion: grant.version + 1,
      invalidatedSubjectId: subjectId,
    };
    return { state: "success", data: this.lastGrantOutcome };
  }

  private listLifecycle(
    payload: Readonly<Record<string, unknown>>,
  ): DomainOutcome<LifecycleListModel> {
    const eligibility = String(payload.eligibility ?? "");
    const candidates = this.lifecycle.filter(
      (candidate) => !eligibility || candidate.eligibility === eligibility,
    );
    return candidates.length
      ? {
          state: "success",
          data: { candidates: candidates.map((candidate) => ({ ...candidate })) },
        }
      : { state: "empty" };
  }

  private runLifecycle(
    payload: Readonly<Record<string, unknown>>,
  ): DomainOutcome<LifecycleOutcomeModel> {
    const candidate = this.lifecycle.find((item) => item.id === payload.id);
    if (!candidate) return { state: "denied" };
    if (candidate.version !== payload.expectedVersion)
      return { state: "invalidated", code: "LIFECYCLE_STALE" };
    if (candidate.eligibility === "blocked")
      return { state: "conflict", code: "LIFECYCLE_BLOCKED" };
    if (payload.confirmed !== "yes")
      return { state: "conflict", code: "LIFECYCLE_CONFIRMATION_REQUIRED" };
    this.lifecycle = this.lifecycle.filter((item) => item.id !== candidate.id);
    return {
      state: "success",
      data: {
        familyId: candidate.id,
        state: candidate.eligibility === "eligible-delete" ? "deleted" : "anonymized",
        auditEvidenceId: `audit-lifecycle-${candidate.id}`,
      },
    };
  }

  private saveSettings(
    payload: Readonly<Record<string, unknown>>,
  ): DomainOutcome<AdvancedSettingsOutcome> {
    if (this.settings.version !== payload.expectedVersion)
      return { state: "invalidated", code: "SETTINGS_STALE" };
    const selectedRecipientId = String(payload.recipientId ?? "");
    if (!this.settings.recipients.some((recipient) => recipient.id === selectedRecipientId))
      return { state: "conflict", code: "SETTINGS_RECIPIENT_INVALID" };
    this.settings = {
      ...this.settings,
      selectedRecipientId,
      remindersEnabled: payload.remindersEnabled === "yes",
      version: this.settings.version + 1,
    };
    return {
      state: "success",
      data: {
        selectedRecipientId,
        remindersEnabled: this.settings.remindersEnabled,
        version: this.settings.version,
      },
    };
  }
}

class CompositeAdminPort implements AdminApplicationPort {
  private readonly core: AdminApplicationPort;
  private readonly advanced: AdvancedWorkflowStore;

  constructor(core: AdminApplicationPort, advanced: AdvancedWorkflowStore) {
    this.core = core;
    this.advanced = advanced;
  }
  execute<T>(input: Parameters<AdminApplicationPort["execute"]>[0]): Promise<DomainOutcome<T>> {
    return ADVANCED_OPERATIONS.has(input.operation)
      ? this.advanced.execute<T>(input)
      : this.core.execute<T>(input);
  }
}

const ADVANCED_OPERATIONS = new Set<AdminOperation>([
  "import.status",
  "import.preview",
  "import.resolve",
  "import.commit",
  "import.recover",
  "reminders.list",
  "reminders.retry",
  "governance.list",
  "governance.update",
  "lifecycle.list",
  "lifecycle.run",
  "settings.get",
  "settings.save",
]);

const GLOBAL_KEY = Symbol.for("waldorf.admin-advanced.synthetic-store");
type Container = { store: AdvancedWorkflowStore; idempotency: InMemoryIdempotencyStore };
type AdvancedGlobal = typeof globalThis & { [GLOBAL_KEY]?: Container };

function container(): Container {
  const global = globalThis as AdvancedGlobal;
  global[GLOBAL_KEY] ??= {
    store: new AdvancedWorkflowStore(),
    idempotency: new InMemoryIdempotencyStore(),
  };
  return global[GLOBAL_KEY];
}

export function resetSyntheticAdvancedFixtures(): void {
  (globalThis as AdvancedGlobal)[GLOBAL_KEY] = {
    store: new AdvancedWorkflowStore(),
    idempotency: new InMemoryIdempotencyStore(),
  };
}

export function isSyntheticAdvancedSubjectRevoked(subjectId: string): boolean {
  return container().store.isRevoked(subjectId);
}

export function createSyntheticAdvancedAdminFacade(
  authorization: AuthorizationContract,
  core: AdminApplicationPort,
): AdminApplicationFacade {
  const state = container();
  return new AdminApplicationFacade(
    new FacadePipeline(
      authorization,
      (error) => (error instanceof RetryableAdvancedDependencyError ? "retryable" : "terminal"),
      new IdempotencyCoordinator(state.idempotency),
    ),
    new CompositeAdminPort(core, state.store),
  );
}

function freezePreview(preview: MutableImportPreview): ImportPreviewModel {
  return Object.freeze({
    ...preview,
    changedRows: [...preview.changedRows],
    conflicts: preview.conflicts.map((item) => ({ ...item })),
  });
}

function applyFailure(payload: Readonly<Record<string, unknown>>): void {
  if (payload.scenario === "retryable")
    throw new RetryableAdvancedDependencyError("synthetic retryable failure");
  if (payload.scenario === "terminal")
    throw new TerminalAdvancedDependencyError("synthetic terminal failure");
}
