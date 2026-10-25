import type { Scope } from "../../src/access/index.ts";
import {
  AdminApplicationFacade,
  FacadePipeline,
  IdempotencyCoordinator,
  InMemoryIdempotencyStore,
  ParentApplicationFacade,
  TeacherApplicationFacade,
  type AuthorizationContract,
  type AdminApplicationPort,
  type AdminItemModel,
  type AdminListModel,
  type AdminOperation,
  type AdvancedSettingsModel,
  type AdvancedSettingsOutcome,
  type ApprovalOutcome,
  type AssignmentModel,
  type DashboardModel,
  type DomainOutcome,
  type DutyDetailModel,
  type DutyListModel,
  type EventNoteModel,
  type GrantListModel,
  type GrantOutcome,
  type ImportOutcome,
  type ImportPreviewModel,
  type LifecycleListModel,
  type LifecycleOutcomeModel,
  type NotificationListModel,
  type NotificationModel,
  type ParentApplicationPort,
  type ReminderListModel,
  type ReminderOutcome,
  type RequestModel,
  type SwapCandidateListModel,
  type SwapRequestListModel,
  type TeacherApplicationPort,
} from "../../src/application/index.ts";
import {
  isOptionalTrackingRange,
  isTrackingSource,
  matchesTrackingScope,
  type TrackingSourceRecord,
} from "../../src/application/tracking-model.ts";

/**
 * In-memory doubles of the three application ports, for the page, action and facade tests that need a whole
 * screen's worth of data. They stand where the database adapters (`src/data`) stand in production: the facades,
 * the authorization and the pipeline above them are the real ones. They live in tests only; the adapters
 * themselves are proven against the database in `tests/database/` and by `src/data/*.test.ts`.
 *
 * Failures can be forced by a `scenario` word in a payload (admin), in the swap partner id or the assignment
 * id (parent), or by the constructor (teacher), so one test can reach the retryable, terminal and conflict
 * answers without a database.
 */
export class RetryableDoubleFailure extends Error {}
export class TerminalDoubleFailure extends Error {}

/** Classifies a thrown double failure the way the data adapter's classifier classifies real ones. */
export const classifyDoubleFailure = (error: unknown): "retryable" | "terminal" =>
  error instanceof RetryableDoubleFailure ? "retryable" : "terminal";

// ---------------------------------------------------------------------------------------------------
// Parent
// ---------------------------------------------------------------------------------------------------
export const PARENT_FAMILY_ID = "family-boroka";
export const PARENT_ORGANIZATION_ID = "org-napsugar";
export const PARENT_FAMILY_SCOPE: Scope = Object.freeze({
  id: PARENT_FAMILY_ID,
  type: "family",
  organizationId: PARENT_ORGANIZATION_ID,
});

const DUTY_FIXTURES: readonly DutyDetailModel[] = Object.freeze([
  Object.freeze({
    id: "duty-garden",
    title: "Kerti előkészítés",
    dueAt: "2026-09-05T08:00:00+02:00",
    location: "Napsugár Waldorf Óvoda kertje",
    state: "available",
    version: 1,
    allergenNote: "Dióféléktől mentes közös étkezés.",
    ownContributionNote: "Gyümölcsöt viszünk.",
  }),
  Object.freeze({
    id: "duty-full",
    title: "Őszi vásár előkészítése",
    dueAt: "2026-09-12T09:00:00+02:00",
    location: "Közösségi terem",
    state: "full",
    version: 3,
  }),
  Object.freeze({
    id: "duty-ineligible",
    title: "Hétköznapi udvarrendezés",
    dueAt: "2026-09-16T14:00:00+02:00",
    location: "Óvodaudvar",
    state: "ineligible",
    version: 2,
  }),
  Object.freeze({
    id: "duty-assigned",
    title: "Lámpás ünnep előkészítése",
    dueAt: "2026-11-08T16:30:00+01:00",
    location: "Közösségi terem",
    state: "assigned",
    version: 4,
    assignmentId: "assignment-lampas",
    allergenNote: "A sütemények összetevőit külön jelöljük.",
    ownContributionNote: "Almalevet viszünk.",
  }),
]);

const NOTIFICATION_FIXTURES: readonly NotificationModel[] = Object.freeze([
  Object.freeze({
    id: "notice-7-day",
    title: "Egy hét múlva: Lámpás ünnep előkészítése",
    link: "/szulo/feladatok/duty-assigned",
    isRead: false,
    timing: "7-day" as const,
    providerStatus: "simulated-sent" as const,
  }),
  Object.freeze({
    id: "notice-24-hour",
    title: "Holnap: Kerti előkészítés",
    link: "/szulo/feladatok/duty-garden",
    isRead: false,
    timing: "24-hour" as const,
    providerStatus: "simulated-retry" as const,
  }),
  Object.freeze({
    id: "notice-stale",
    title: "Korábbi, már nem aktuális emlékeztető",
    link: "/szulo/ertesitesek",
    isRead: true,
    timing: "stale" as const,
    providerStatus: "simulated-cancelled" as const,
  }),
]);

export class ParentPortDouble implements ParentApplicationPort {
  readonly duties = new Map<string, DutyDetailModel>(DUTY_FIXTURES.map((duty) => [duty.id, duty]));
  readonly notifications = new Map<string, NotificationModel>(
    NOTIFICATION_FIXTURES.map((notice) => [notice.id, notice]),
  );
  readonly contributionNotes = new Map<string, string>(
    DUTY_FIXTURES.flatMap((duty) =>
      duty.ownContributionNote ? [[duty.id, duty.ownContributionNote] as const] : [],
    ),
  );
  readonly requests = new Map<string, RequestModel>();
  private readonly actorId: string;

  constructor(actorId: string) {
    this.actorId = actorId;
  }

  private owns(input: { actorId: string; familyId: string }): boolean {
    return input.actorId === this.actorId && input.familyId === PARENT_FAMILY_ID;
  }

  async listDuties(input: {
    actorId: string;
    familyId: string;
  }): Promise<DomainOutcome<DutyListModel>> {
    if (!this.owns(input)) return { state: "denied" };
    const duties = [...this.duties.values()].map(toListItem);
    return duties.length ? { state: "success", data: { duties } } : { state: "empty" };
  }

  async getDuty(input: {
    actorId: string;
    familyId: string;
    dutyId: string;
  }): Promise<DomainOutcome<DutyDetailModel>> {
    if (!this.owns(input)) return { state: "denied" };
    const duty = this.duties.get(input.dutyId);
    if (!duty) return { state: "denied" };
    return {
      state: "success",
      data: Object.freeze({ ...duty, ownContributionNote: this.contributionNotes.get(duty.id) }),
    };
  }

  async signUp(input: {
    actorId: string;
    familyId: string;
    dutyId: string;
    expectedVersion: number;
  }): Promise<DomainOutcome<AssignmentModel>> {
    if (!this.owns(input)) return { state: "denied" };
    if (input.dutyId === "duty-retry") throw new RetryableDoubleFailure();
    if (input.dutyId === "duty-terminal") throw new TerminalDoubleFailure();
    const duty = this.duties.get(input.dutyId);
    if (!duty) return { state: "denied" };
    if (duty.version !== input.expectedVersion) {
      return { state: "invalidated", code: "DUTY_VERSION_STALE" };
    }
    if (duty.state === "full") return { state: "conflict", code: "DUTY_FULL" };
    if (duty.state === "ineligible") return { state: "conflict", code: "DUTY_INELIGIBLE" };
    if (duty.state !== "available") return { state: "conflict", code: "DUTY_ALREADY_ASSIGNED" };
    const assignment: AssignmentModel = Object.freeze({
      id: `assignment-${duty.id}`,
      state: "assigned",
      version: duty.version + 1,
    });
    this.duties.set(
      duty.id,
      Object.freeze({
        ...duty,
        state: "assigned",
        assignmentId: assignment.id,
        version: assignment.version,
      }),
    );
    return { state: "success", data: assignment };
  }

  async requestSwap(input: {
    actorId: string;
    familyId: string;
    assignmentId: string;
    counterpartId: string;
    expectedVersion: number;
  }): Promise<DomainOutcome<RequestModel>> {
    if (!this.owns(input)) return { state: "denied" };
    return this.createRequest(
      "swap",
      input.assignmentId,
      input.counterpartId,
      input.expectedVersion,
    );
  }

  async requestCancellation(input: {
    actorId: string;
    familyId: string;
    assignmentId: string;
    expectedVersion: number;
  }): Promise<DomainOutcome<RequestModel>> {
    if (!this.owns(input)) return { state: "denied" };
    return this.createRequest(
      "cancellation",
      input.assignmentId,
      input.assignmentId.replace("assignment-", ""),
      input.expectedVersion,
    );
  }

  /** What the partner list answers: one other family's place, nothing, or a failure. */
  swapCandidates: "available" | "empty" | "failing" = "available";

  async listSwapCandidates(input: {
    actorId: string;
    familyId: string;
    assignmentId: string;
  }): Promise<DomainOutcome<SwapCandidateListModel>> {
    if (!this.owns(input)) return { state: "denied" };
    if (this.swapCandidates === "failing") throw new TerminalDoubleFailure();
    if (this.swapCandidates === "empty") return { state: "empty" };
    return {
      state: "success",
      data: {
        candidates: [
          {
            assignmentId: "assignment-counterpart",
            assignmentVersion: 1,
            taskId: "task-other",
            title: "Közös kerti nap",
            startsAt: "2026-09-20T08:00:00+02:00",
            familyDisplayName: "Fenyő család",
          },
        ],
      },
    };
  }

  /** The demo family has no other family to swap with, so the page for incoming requests is empty. */
  async listSwapRequests(input: {
    actorId: string;
    familyId: string;
  }): Promise<DomainOutcome<SwapRequestListModel>> {
    if (!this.owns(input)) return { state: "denied" };
    return { state: "empty" };
  }

  async listNotifications(input: {
    actorId: string;
  }): Promise<DomainOutcome<NotificationListModel>> {
    if (input.actorId !== this.actorId) return { state: "denied" };
    return { state: "success", data: { notifications: [...this.notifications.values()] } };
  }

  async markNotificationRead(input: {
    actorId: string;
    notificationId: string;
  }): Promise<DomainOutcome<Readonly<{ link: string }>>> {
    if (input.actorId !== this.actorId) return { state: "denied" };
    const notification = this.notifications.get(input.notificationId);
    if (!notification) return { state: "denied" };
    this.notifications.set(input.notificationId, Object.freeze({ ...notification, isRead: true }));
    return { state: "success", data: Object.freeze({ link: notification.link }) };
  }

  async updateOwnContribution(input: {
    actorId: string;
    eventId: string;
    note: string;
  }): Promise<DomainOutcome<EventNoteModel>> {
    if (input.actorId !== this.actorId) return { state: "denied" };
    const duty = this.duties.get(input.eventId);
    if (!duty?.assignmentId) return { state: "denied" };
    this.contributionNotes.set(input.eventId, input.note);
    return { state: "success", data: Object.freeze({ eventId: input.eventId, note: input.note }) };
  }

  private createRequest(
    kind: "swap" | "cancellation",
    assignmentId: string,
    scenario: string,
    expectedVersion: number,
  ): DomainOutcome<RequestModel> {
    if (scenario.includes("retryable")) throw new RetryableDoubleFailure();
    if (scenario.includes("terminal")) throw new TerminalDoubleFailure();
    if (scenario === "conflict") return { state: "conflict", code: "REQUEST_CONFLICT" };
    if (scenario === "invalidated") return { state: "invalidated", code: "REQUEST_INVALIDATED" };
    const normalizedAssignmentId = assignmentId.split("--scenario-")[0]!;
    const assignedDuty = [...this.duties.values()].find(
      (duty) => duty.assignmentId === normalizedAssignmentId,
    );
    if (!assignedDuty) return { state: "denied" };
    if (assignedDuty.version !== expectedVersion) {
      return { state: "invalidated", code: "REQUEST_VERSION_STALE" };
    }
    const requestId = `${kind}-request-${assignedDuty.id}`;
    if (this.requests.get(requestId)) return { state: "conflict", code: "REQUEST_DUPLICATE" };
    const request = Object.freeze({ id: requestId, state: "pending" as const });
    this.requests.set(requestId, request);
    this.duties.set(
      assignedDuty.id,
      Object.freeze({
        ...assignedDuty,
        state: kind === "swap" ? "swap-pending" : "cancellation-pending",
        version: assignedDuty.version + 1,
      }),
    );
    return { state: "success", data: request };
  }
}

function toListItem(duty: DutyDetailModel) {
  return Object.freeze({
    id: duty.id,
    title: duty.title,
    dueAt: duty.dueAt,
    state: duty.state,
    version: duty.version,
  });
}

// ---------------------------------------------------------------------------------------------------
// Admin: records, tasks and approvals, plus the advanced workflows (import, reminders, governance,
// lifecycle, settings)
// ---------------------------------------------------------------------------------------------------
type AdminItem = {
  id: string;
  title: string;
  state: string;
  version?: number;
  scopeId: string;
  kind: string;
};

const INITIAL_RECORDS: readonly AdminItem[] = [
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
const INITIAL_TASKS: readonly AdminItem[] = [
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
const INITIAL_APPROVALS: readonly AdminItem[] = [
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

const FINGERPRINT = "sha256:waldorf-advanced-v1:8b12";

type MutablePreview = {
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
  totalRows: number;
  state: ImportPreviewModel["state"];
};

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

export type AdminDoubleHooks = {
  /** Revokes the access of the account behind a grant (the world raises its authorization version). */
  revokeGroupAdminAccess?: () => number | undefined;
};

export class AdminPortDouble implements AdminApplicationPort {
  private records = INITIAL_RECORDS.map((item) => ({ ...item }));
  private tasks = INITIAL_TASKS.map((item) => ({ ...item }));
  private approvals = INITIAL_APPROVALS.map((item) => ({ ...item }));
  private preview?: MutablePreview;
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
  private readonly hooks: AdminDoubleHooks;
  /** Forces this scenario word on every payload that carries none (for tests that reach the page or action). */
  forcedScenario: string | undefined;

  constructor(hooks: AdminDoubleHooks = {}) {
    this.hooks = hooks;
  }

  async execute<T>(input: {
    actorId: string;
    operation: AdminOperation;
    scope: Scope;
    payload: Readonly<Record<string, unknown>>;
  }): Promise<DomainOutcome<T>> {
    const payload =
      input.payload.scenario === undefined && this.forcedScenario
        ? { ...input.payload, scenario: this.forcedScenario }
        : input.payload;
    if (payload.scenario === "retryable") throw new RetryableDoubleFailure("retryable");
    if (payload.scenario === "terminal") throw new TerminalDoubleFailure("terminal");
    return this.dispatch({ ...input, payload }) as DomainOutcome<T>;
  }

  private dispatch(input: {
    actorId: string;
    operation: AdminOperation;
    scope: Scope;
    payload: Readonly<Record<string, unknown>>;
  }): DomainOutcome<unknown> {
    const { scope, payload } = input;
    switch (input.operation) {
      case "dashboard.get":
        return {
          state: "success",
          data: {
            scopeId: scope.id,
            openApprovals: this.visible(this.approvals, scope).filter(
              (item) => item.state === "pending",
            ).length,
            openImportConflicts: 0,
          } satisfies DashboardModel,
        };
      case "records.list":
        return this.list(this.records, scope, payload);
      case "records.get":
        return this.get(this.records, scope, payload);
      case "records.save":
        return this.saveRecord(scope, payload);
      case "records.archive":
        return this.changeRecordState(scope, payload, "archived");
      case "records.restore":
        return payload.scenario === "restore-conflict"
          ? { state: "conflict", code: "RESTORE_CONFLICT" }
          : this.changeRecordState(scope, payload, "active");
      case "tasks.list":
        return this.list(this.tasks, scope, payload);
      case "tasks.save":
        return this.saveTask(scope, payload);
      case "assignments.assign":
        return this.assign(scope, payload);
      case "approvals.list":
        return this.list(this.approvals, scope, payload);
      case "approvals.decide":
        return this.decideApproval(scope, payload);
      case "notes.save":
        return this.saveNotes(scope, payload);
      case "import.status":
        return this.preview
          ? { state: "success", data: freezePreview(this.preview) }
          : { state: "empty" };
      case "import.preview":
        return this.createPreview(payload);
      case "import.resolve":
        return this.resolveConflict(payload);
      case "import.commit":
        return this.commitImport(payload);
      case "import.recover":
        return this.recoverImport(payload);
      case "reminders.list":
        return this.listReminders(payload);
      case "reminders.retry":
        return this.retryReminder(payload);
      case "governance.list":
        return {
          state: "success",
          data: {
            grants: this.grants.map((grant) => ({ ...grant })),
            lastOutcome: this.lastGrantOutcome,
          },
        };
      case "governance.update":
        return this.updateGrant(input.actorId, payload);
      case "lifecycle.list":
        return this.listLifecycle(payload);
      case "lifecycle.run":
        return this.runLifecycle(payload);
      case "settings.get":
        return {
          state: "success",
          data: { ...this.settings, recipients: [...this.settings.recipients] },
        };
      case "settings.save":
        return this.saveSettings(payload);
      default:
        return { state: "denied" };
    }
  }

  private visible(items: readonly AdminItem[], scope: Scope): AdminItem[] {
    return items.filter((item) => isInScope(item, scope));
  }

  private list(
    items: readonly AdminItem[],
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
    items: readonly AdminItem[],
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
    if (String(payload.id ?? "") === "new") {
      const created: AdminItem = {
        id: `record-${this.records.length + 1}`,
        title: String(payload.title ?? "").trim(),
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
      case "recovery":
        return { state: "recovery", data: { completed: true } };
      default:
        return result as DomainOutcome<Readonly<{ completed: true }>>;
    }
  }

  private saveTask(
    scope: Scope,
    payload: Readonly<Record<string, unknown>>,
  ): DomainOutcome<AdminItemModel> {
    if (String(payload.id ?? "") === "new") {
      const created: AdminItem = {
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
    if (payload.scenario === "ineligible")
      return { state: "conflict", code: "ASSIGNMENT_INELIGIBLE" };
    if (payload.scenario === "full") return { state: "conflict", code: "ASSIGNMENT_CAPACITY_FULL" };
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
    items: AdminItem[],
    scope: Scope,
    payload: Readonly<Record<string, unknown>>,
    update: (item: AdminItem) => AdminItem,
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

  private createPreview(
    payload: Readonly<Record<string, unknown>>,
  ): DomainOutcome<ImportPreviewModel> {
    const scenario = String(payload.scenario ?? "valid");
    if (["malformed", "oversized", "missing-sheet", "missing-header"].includes(scenario)) {
      return { state: "conflict", code: `IMPORT_${scenario.toUpperCase().replaceAll("-", "_")}` };
    }
    this.preview = {
      id: "preview-waldorf-v1",
      fingerprint: FINGERPRINT,
      changedRows: ["Boróka csoport: 2 módosítás", "Napraforgó csoport: 1 új elem"],
      conflicts: [
        {
          id: "conflict-family-1",
          rowLabel: "Családok · 12. sor",
          message: "Az elem már létezik.",
        },
      ],
      step: 4,
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
    const subjectId =
      grant.id === "grant-group-target" ? "group-admin-account" : "super-admin-backup";
    const authorizationVersion =
      subjectId === "group-admin-account"
        ? this.hooks.revokeGroupAdminAccess?.()
        : grant.version + 1;
    if (authorizationVersion === undefined) return { state: "invalidated", code: "GRANT_STALE" };
    this.grants = this.grants.filter((candidate) => candidate.id !== grant.id);
    void actorId;
    this.lastGrantOutcome = {
      grantId: grant.id,
      authorizationVersion,
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

function isInScope(item: AdminItem, scope: Scope): boolean {
  return scope.type === "organization" || item.scopeId === scope.id;
}

function toAdminItem(item: AdminItem): AdminItemModel {
  return { id: item.id, title: item.title, state: item.state, version: item.version };
}

function freezePreview(preview: MutablePreview): ImportPreviewModel {
  return Object.freeze({
    ...preview,
    changedRows: [...preview.changedRows],
    conflicts: preview.conflicts.map((item) => ({ ...item })),
  });
}

// ---------------------------------------------------------------------------------------------------
// Teacher
// ---------------------------------------------------------------------------------------------------
export const TEACHER_ORGANIZATION_ID = "org-waldorf-local";
export const TEACHER_GROUPS = Object.freeze([
  Object.freeze({
    scope: Object.freeze({
      id: "group-oak",
      type: "group",
      organizationId: TEACHER_ORGANIZATION_ID,
    } satisfies Scope),
    label: "Tölgyfa csoport",
  }),
  Object.freeze({
    scope: Object.freeze({
      id: "group-sunflower",
      type: "group",
      organizationId: TEACHER_ORGANIZATION_ID,
    } satisfies Scope),
    label: "Napraforgó csoport",
  }),
]);

export const UNGRANTED_TEACHER_GROUP: Scope = Object.freeze({
  id: "group-ungranted",
  type: "group",
  organizationId: TEACHER_ORGANIZATION_ID,
});

export type TeacherScenario = "ready" | "empty" | "denied" | "retryable" | "terminal";

export const TEACHER_SCHEDULE: readonly TrackingSourceRecord[] = Object.freeze([
  Object.freeze({
    id: "schedule-garden",
    sourceRecordId: "schedule-garden",
    organizationId: TEACHER_ORGANIZATION_ID,
    ownerDisplayName: "Kitalált Dóra",
    assigneeDisplayNames: Object.freeze(["Kitalált Eszter"]),
    currentStatusLabel: "Ütemezett",
    groupId: "group-oak",
    startsAt: "2026-08-13T06:30:00.000Z",
    endsAt: "2026-08-13T07:30:00.000Z",
    title: "Reggeli udvari felügyelet",
    location: "Keleti udvar",
    coordinationDisplayName: "Kitalált Ágnes",
  }),
  Object.freeze({
    id: "schedule-crafts",
    sourceRecordId: "schedule-crafts",
    organizationId: TEACHER_ORGANIZATION_ID,
    ownerDisplayName: "Kitalált Fanni",
    assigneeDisplayNames: Object.freeze(["Kitalált Géza", "Kitalált Hanna"]),
    currentStatusLabel: "Nyitott",
    groupId: "group-oak",
    startsAt: "2026-08-14T12:00:00.000Z",
    endsAt: "2026-08-14T14:00:00.000Z",
    title: "Kézműves előkészítés",
    location: "Műhely",
    coordinationDisplayName: "Kitalált Bence",
  }),
  Object.freeze({
    id: "schedule-coverage",
    sourceRecordId: "schedule-coverage",
    organizationId: TEACHER_ORGANIZATION_ID,
    ownerDisplayName: null,
    assigneeDisplayNames: Object.freeze([]),
    currentStatusLabel: null,
    groupId: "group-sunflower",
    startsAt: "2026-08-18T08:00:00.000Z",
    endsAt: "2026-08-18T10:00:00.000Z",
    title: "Csoportkísérés",
    location: "Tornatermi lefedettség",
  }),
]);

const snapshot = (row: TrackingSourceRecord): TrackingSourceRecord =>
  Object.freeze({ ...row, assigneeDisplayNames: Object.freeze([...row.assigneeDisplayNames]) });

/** A schedule source: reads the rows of a group within an optional date range; the operator edits the rows. */
export function createTeacherRepositoryDouble(
  records: readonly TrackingSourceRecord[] = TEACHER_SCHEDULE,
) {
  if (!records.every(isTrackingSource)) throw new Error("Invalid tracking records");
  let current = records.map(snapshot);
  const repository = Object.freeze({
    readCurrent(query: { groupScope: Scope; from?: string; to?: string }) {
      if (!isOptionalTrackingRange(query.from, query.to)) throw new Error("Invalid tracking range");
      const from = query.from === undefined ? -Infinity : Date.parse(`${query.from}T00:00:00.000Z`);
      const to = query.to === undefined ? Infinity : Date.parse(`${query.to}T23:59:59.999Z`);
      return Object.freeze(
        current
          .filter(
            (row) =>
              row.groupId === query.groupScope.id &&
              row.organizationId === query.groupScope.organizationId &&
              Date.parse(row.startsAt) >= from &&
              Date.parse(row.startsAt) <= to,
          )
          .map(snapshot),
      );
    },
  });
  const operator = Object.freeze({
    replaceTrackingFields(
      id: string,
      fields: Pick<
        TrackingSourceRecord,
        "ownerDisplayName" | "assigneeDisplayNames" | "currentStatusLabel"
      >,
    ) {
      const index = current.findIndex((row) => row.id === id);
      if (index < 0) throw new Error("Unknown tracking record");
      const next = { ...current[index]!, ...fields };
      if (!isTrackingSource(next)) throw new Error("Invalid tracking fields");
      current = current.map((row, position) => (position === index ? snapshot(next) : row));
    },
    snapshot() {
      return Object.freeze(current.map(snapshot));
    },
  });
  return Object.freeze({ repository, operator });
}

export class TeacherPortDouble implements TeacherApplicationPort {
  private readonly repository: ReturnType<typeof createTeacherRepositoryDouble>["repository"];
  private readonly scenario: TeacherScenario;

  constructor(
    repository: ReturnType<
      typeof createTeacherRepositoryDouble
    >["repository"] = createTeacherRepositoryDouble().repository,
    scenario: TeacherScenario = "ready",
  ) {
    this.repository = repository;
    this.scenario = scenario;
  }

  async getSchedule(input: {
    actorId: string;
    groupScope: Scope;
    from?: string;
    to?: string;
  }): Promise<DomainOutcome<{ entries: readonly TrackingSourceRecord[] }>> {
    if (this.scenario === "retryable") throw new RetryableDoubleFailure();
    if (this.scenario === "terminal") throw new TerminalDoubleFailure();
    if (this.scenario === "denied") return { state: "denied" };
    if (this.scenario === "empty") return { state: "empty" };
    const entries = await this.repository.readCurrent(input);
    if (!Array.isArray(entries) || !entries.every(isTrackingSource))
      throw new Error("Invalid source");
    if (!entries.every((row) => matchesTrackingScope(row, input.groupScope)))
      return { state: "denied" };
    if (new Set(entries.map((row) => row.id)).size !== entries.length)
      throw new Error("Duplicate identity");
    return entries.length
      ? { state: "success", data: Object.freeze({ entries: Object.freeze([...entries]) }) }
      : { state: "empty" };
  }
}

/** The real parent facade on a fresh parent port double (the port belongs to one account id). */
export function createParentFacadeDouble(
  authorization: AuthorizationContract,
  actorId: string,
): ParentApplicationFacade {
  return new ParentApplicationFacade(
    new FacadePipeline(
      authorization,
      classifyDoubleFailure,
      new IdempotencyCoordinator(new InMemoryIdempotencyStore()),
    ),
    new ParentPortDouble(actorId),
  );
}

/** The real admin facade on a fresh admin port double. */
export function createAdminFacadeDouble(
  authorization: AuthorizationContract,
): AdminApplicationFacade {
  return new AdminApplicationFacade(
    new FacadePipeline(
      authorization,
      classifyDoubleFailure,
      new IdempotencyCoordinator(new InMemoryIdempotencyStore()),
    ),
    new AdminPortDouble(),
  );
}

/** The real teacher facade and pipeline on the teacher port double (the scenario and the source can be replaced). */
export function createTeacherFacadeDouble(
  authorization: AuthorizationContract,
  scenario: TeacherScenario = "ready",
  repository: ConstructorParameters<typeof TeacherPortDouble>[0] = createTeacherRepositoryDouble()
    .repository,
): TeacherApplicationFacade {
  return new TeacherApplicationFacade(
    new FacadePipeline(authorization, classifyDoubleFailure),
    new TeacherPortDouble(repository, scenario),
  );
}
