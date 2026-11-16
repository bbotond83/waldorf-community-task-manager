import type { Role, RoleGrant, Scope } from "../access/index.ts";

export type ApplicationState =
  | "initial"
  | "loading"
  | "empty"
  | "validation"
  | "pending"
  | "success"
  | "denied"
  | "conflict"
  | "invalidated"
  | "dependency-failure-retryable"
  | "dependency-failure-terminal"
  | "recovery";

export type AnnouncementMode = "none" | "polite" | "assertive";

export type PresentationCode =
  | "APP-READY"
  | "APP-EMPTY"
  | "APP-VALIDATION"
  | "APP-PENDING"
  | "APP-SUCCESS"
  | "APP-DENIED"
  | "APP-CONFLICT"
  | "APP-INVALIDATED"
  | "APP-DEPENDENCY-RETRYABLE"
  | "APP-DEPENDENCY-TERMINAL"
  | "APP-RECOVERY";

export type RetryMetadata = Readonly<{
  idempotencyKey: string;
  action: string;
}>;

type ApplicationResultBase = Readonly<{
  code: string;
  presentationCode: PresentationCode;
  focusTarget: string;
  announcement: AnnouncementMode;
  evidenceId?: string;
}>;

export type ApplicationResult<T> =
  | (ApplicationResultBase & { state: "initial" | "loading" | "pending" })
  | (ApplicationResultBase & { state: "empty" })
  | (ApplicationResultBase & {
      state: "validation";
      fieldErrors: Readonly<Record<string, string>>;
    })
  | (ApplicationResultBase & { state: "success"; data: T })
  | (ApplicationResultBase & { state: "recovery"; data: T })
  | (ApplicationResultBase & { state: "denied" })
  | (ApplicationResultBase & { state: "conflict" })
  | (ApplicationResultBase & { state: "invalidated" })
  | (ApplicationResultBase & {
      state: "dependency-failure-retryable";
      retry: RetryMetadata;
    })
  | (ApplicationResultBase & { state: "dependency-failure-terminal" });

export type SessionContext = Readonly<{
  subjectId: string;
  authorizationVersion: number;
  isActive: boolean;
  grants: readonly RoleGrant[];
  roles: readonly Role[];
  scopes: readonly Scope[];
}>;

export type AuthorizedContext = Readonly<{
  session: SessionContext;
  matrixRowId: AuthorizationMatrixRowId;
  scope: Scope;
  fields: readonly SensitiveFieldId[];
}>;

export type AuthorizationMatrixRowId =
  | "AUTH-PARENT-DUTIES"
  | "AUTH-PARENT-NOTIFICATIONS"
  | "AUTH-TEACHER-TRACKING"
  | "AUTH-GROUP-ADMIN-CORE"
  | "AUTH-WORKING-GROUPS"
  | "AUTH-PARENT-GROUP-MEMBERSHIP"
  | "AUTH-ROTA-OVERVIEW"
  | "AUTH-ROTA-DUTY"
  | "AUTH-DIRECTORY"
  | "AUTH-PARENT-ACCOUNT"
  | "AUTH-SUPER-ROTA"
  | "AUTH-SUPER-ADMIN"
  | "AUTH-SUPER-GOVERNANCE";

export type SensitiveFieldId =
  | "SF-DISPLAY-NAME"
  | "SF-PARTICIPANT-NAME"
  | "SF-EMAIL"
  | "SF-PHONE"
  | "SF-LOCALITY"
  | "SF-OPTIONAL-PROFILE"
  | "SF-PROTECTED-REASON"
  | "SF-UNRELATED-FAMILY";

export const PROHIBITED_FIELD_IDS = Object.freeze([
  "SF-EMAIL",
  "SF-PHONE",
  "SF-LOCALITY",
  "SF-OPTIONAL-PROFILE",
  "SF-PROTECTED-REASON",
  "SF-UNRELATED-FAMILY",
] satisfies readonly SensitiveFieldId[]);

export type NavigationItem = Readonly<{
  id: string;
  label: string;
  href: string;
}>;

export type NavigationModel = Readonly<{
  homePath: string;
  items: readonly NavigationItem[];
}>;

export type DutyListItemModel = Readonly<{
  id: string;
  title: string;
  dueAt: string;
  state: "available" | "full" | "ineligible" | "assigned" | "swap-pending" | "cancellation-pending";
  version?: number;
}>;

export type DutyListModel = Readonly<{ duties: readonly DutyListItemModel[] }>;

export type DutyDetailModel = Readonly<{
  id: string;
  title: string;
  dueAt: string;
  location: string;
  state: DutyListItemModel["state"];
  version: number;
  assignmentId?: string;
  allergenNote?: string;
  ownContributionNote?: string;
}>;

export type NotificationModel = Readonly<{
  id: string;
  title: string;
  /** A line under the title where the title alone is not enough: the weeks of a published rota (BR23.4). */
  text?: string;
  link: string;
  isRead: boolean;
  timing: "7-day" | "24-hour" | "within-threshold" | "stale" | "cancelled";
}>;

export type NotificationListModel = Readonly<{ notifications: readonly NotificationModel[] }>;

export type { TrackingEntry } from "./tracking-model.ts";
import type { TrackingEntry } from "./tracking-model.ts";
export type TrackingModel = Readonly<{ entries: readonly TrackingEntry[] }>;

export type DashboardModel = Readonly<{
  scopeId: string;
  openApprovals: number;
}>;

/** One active working group of the community, as a card shows it (BR2.3). */
export type WorkingGroupItem = Readonly<{
  id: string;
  name: string;
  description: string;
  schoolYearId: string;
  schoolYearName: string;
}>;
export type WorkingGroupListModel = Readonly<{ items: readonly WorkingGroupItem[] }>;

/**
 * One member row of a group page (BR42.2). The database decides who sees a phone or an e-mail address: a field it
 * withheld is absent here, so no screen can show it. `version` comes back to a super admin only, who needs it to
 * appoint or revoke.
 */
export type WorkingGroupMember = Readonly<{
  membershipId: string;
  parentId: string;
  fullName: string;
  isCoordinator: boolean;
  isSelf: boolean;
  email?: string;
  phone?: string;
  version?: number;
}>;

/** The group page (BR42): the group, whether anyone coordinates it, the caller's own membership and the members. */
export type WorkingGroupDetailModel = Readonly<{
  group: WorkingGroupItem;
  hasCoordinator: boolean;
  callerIsParent: boolean;
  ownMembership: Readonly<{ id: string; version: number }> | null;
  members: readonly WorkingGroupMember[];
}>;

/** What a membership command returns: the membership and its new version; `alreadyMember` for a repeated join. */
export type WorkingGroupChangeModel = Readonly<{
  membershipId: string | null;
  version: number | null;
  alreadyMember: boolean;
}>;

/** The school year a calendar or plan screen is showing. */
export type RotaSchoolYear = Readonly<{
  id: string;
  name: string;
  startsOn?: string;
  endsOn?: string;
  changeoverDate?: string;
  version?: number;
}>;

/** One school week of the calendar (BR20.4); a break week carries the id and version needed to remove it. */
export type SchoolWeekItem = Readonly<{
  weekStart: string;
  isBreak: boolean;
  breakWeekId?: string;
  label?: string;
  version?: number;
}>;

/** The calendar screen (W1): the year, its weeks, and the filled rota weeks that are now break weeks (BR20.5). */
export type SchoolCalendarModel = Readonly<{
  schoolYear?: RotaSchoolYear;
  schoolYears: readonly Readonly<{ id: string; name: string }>[];
  weeks: readonly SchoolWeekItem[];
  warnings: readonly Readonly<{ weekStart: string; familyDisplayName: string }>[];
  hasPlan: boolean;
}>;

/** One week of the plan being adjusted (BR21.2, BR22.1). */
export type RotaPlanWeek = Readonly<{
  id: string;
  weekStart: string;
  isBreak: boolean;
  familyId?: string;
  familyDisplayName?: string;
  emptyReason?: "no_family" | "cleared";
  changedByAdmin: boolean;
  version: number;
}>;

export type RotaFamilyCount = Readonly<{
  familyId: string;
  displayName: string;
  weeks: number;
  aboveLowest: boolean;
}>;

/** The planning screen (W2 to W5): the draft or published plan, family counts, and what blocks publishing. */
export type RotaPlanModel = Readonly<{
  schoolYear?: RotaSchoolYear;
  plan?: Readonly<{
    id: string;
    status: "draft" | "published";
    version: number;
    publishedAt?: string;
  }>;
  weekCount?: number;
  weeks: readonly RotaPlanWeek[];
  families: readonly RotaFamilyCount[];
  changedWeeks: number;
  blockers: Readonly<{
    emptyWeeks: readonly string[];
    breakWeeks: readonly string[];
    ineligibleWeeks: readonly string[];
  }>;
  canPublish: boolean;
}>;

/** One week of the overview: only the family id and name, never a contact detail or a sharing choice (NFR1.2). */
export type RotaOverviewItem = Readonly<{
  job: "indoor_cleaning";
  weekStart: string;
  isBreak: boolean;
  familyId?: string;
  familyDisplayName?: string;
  isOwn: boolean;
  dutyId?: string;
}>;

export type RotaOverviewModel = Readonly<{
  overviewState: "nothing_published" | "published";
  schoolYear?: Readonly<{ id: string; name: string }>;
  items: readonly RotaOverviewItem[];
}>;

/** The duty card (W7): the week, the family and the fixed text key; there is no fixed day (BR24.2). */
export type RotaDutyCardModel = Readonly<{
  dutyId: string;
  job: "indoor_cleaning";
  title: string;
  familyDisplayName: string;
  weekStart: string;
  weekEnd: string;
  noFixedDay: true;
  isBreakWeek: boolean;
}>;

/** The result of a command: the changed record's id and its new version. */
export type RotaChangeModel = Readonly<{ id: string; version?: number }>;

/** What the task form offers: active families by name only (BR3.10). */
export type FamilyNameListModel = Readonly<{
  items: readonly Readonly<{ id: string; displayName: string }>[];
}>;

export type ApprovalOutcome = "approved" | "rejected";

export type AssignmentModel = Readonly<{
  id: string;
  state: "assigned" | "swap-pending" | "cancellation-pending";
  version: number;
}>;

export type RequestModel = Readonly<{
  id: string;
  state: "pending" | "approved";
}>;

export type EventNoteModel = Readonly<{
  eventId: string;
  note: string;
}>;

/** One partner a parent may choose for a swap: another family's task, shown by title, date and name only. */
export type SwapCandidateModel = Readonly<{
  assignmentId: string;
  assignmentVersion: number;
  taskId: string;
  title: string;
  startsAt: string;
  familyDisplayName: string;
}>;

export type SwapCandidateListModel = Readonly<{ candidates: readonly SwapCandidateModel[] }>;

/** An open request of the signed-in parent's family: addressed to it (incoming) or made by it (outgoing). */
export type SwapRequestItemModel = Readonly<{
  id: string;
  kind: "swap" | "cancellation";
  direction: "incoming" | "outgoing";
  version: number;
  ownTaskTitle: string;
  ownTaskStartsAt: string;
  partnerTaskTitle?: string;
  partnerTaskStartsAt?: string;
  partnerFamilyName?: string;
}>;

export type SwapRequestListModel = Readonly<{ requests: readonly SwapRequestItemModel[] }>;

/** The answer to a swap request: the exchange ran (applied) or the other family declined. */
export type SwapResponseModel = Readonly<{ id: string; outcome: "applied" | "declined" }>;

export type WithdrawnRequestModel = Readonly<{ id: string; state: "withdrawn" }>;

/** A parent of a family as an admin edits it; contact details are there only for an admin in reach (BR30.5). */
export type AdminParentDetail = Readonly<{
  id: string;
  version: number;
  displayName: string;
  email?: string;
  phone?: string;
  /** True once the parent accepted an invitation and has an account. */
  linked: boolean;
  /**
   * The state of the parent's latest invitation while there is no account: none sent, waiting for an answer, or
   * past its 7 days. Only a super admin reads invitations, so for anyone else this stays "none".
   */
  invitation: "none" | "pending" | "expired";
}>;

/**
 * What an admin form needs to show a stored item for editing, beyond its title: the fields of the record
 * type. The database adapter fills it for the real data; a port that leaves it out gives the one-field form
 * (BR32.7).
 */
export type AdminItemDetails = Readonly<{
  /** Group: the school year it belongs to. */
  schoolYearId?: string;
  /** School year: first and last day (YYYY-MM-DD). */
  startsOn?: string;
  endsOn?: string;
  /** Child: its family. */
  familyId?: string;
  /** Family: parents and children. */
  parents?: readonly AdminParentDetail[];
  children?: readonly Readonly<{ id: string; version: number; displayName: string }>[];
  /** Working group: its description. */
  description?: string;
  /** Task or event; absent on a community-wide item. */
  groupId?: string;
  eventId?: string;
  category?: string;
  capacity?: number;
  startsAt?: string;
  endsAt?: string;
  location?: string;
  coordinatorName?: string;
  /** Event: the three notes admins write. */
  allergenNote?: string;
  supplyNote?: string;
  foodNote?: string;
}>;

export type AdminItemKind = "family" | "child" | "group" | "school-year" | "event" | "task";

export type AdminItemModel = Readonly<{
  id: string;
  title: string;
  state: string;
  version?: number;
  /** The record type, when the data source knows it (the database adapter does). */
  kind?: AdminItemKind;
  details?: AdminItemDetails;
}>;

export type AdminListModel = Readonly<{ items: readonly AdminItemModel[] }>;

/**
 * One group of emails that could not be sent: the same kind of notice about the same item (BR53.1). It carries
 * the kind, the item and counts, never an address or a name; `deliveries` is the list a retry sends back, each
 * entry the delivery id and the number of tries it had when the screen was drawn.
 */
export type DeliveryProblemModel = Readonly<{
  kind: string;
  kindLabel: string;
  targetType: string;
  targetId: string;
  title: string;
  latestTryAt: string;
  failedCount: number;
  /** The reason class of the latest failed try (never the mail server's own text). */
  reason?: string;
  deliveries: readonly Readonly<{ id: string; tryCount: number }>[];
}>;

/** A timed check that failed or was missing on a recent run (BR52.7). */
export type TimedCheckProblemModel = Readonly<{
  checkName: string;
  runKind: string;
  startedAt: string;
  outcome: "failed" | "missing";
  created: number;
  skipped: number;
  errorCode?: string;
}>;

export type DeliveryProblemsModel = Readonly<{
  groups: readonly DeliveryProblemModel[];
  checks: readonly TimedCheckProblemModel[];
}>;

export type DeliveryRetryOutcome = Readonly<{ targetId: string; restarted: number }>;

export type GrantOutcome = Readonly<{
  grantId: string;
  authorizationVersion: number;
  invalidatedSubjectId: string;
}>;

export type GrantModel = Readonly<{
  id: string;
  subjectLabel: string;
  role: Role;
  scopeLabel: string;
  version: number;
  isSelf: boolean;
}>;

export type GrantListModel = Readonly<{
  grants: readonly GrantModel[];
  lastOutcome?: GrantOutcome;
}>;

export type LifecycleCandidateModel = Readonly<{
  id: string;
  label: string;
  eligibility: "eligible-delete" | "eligible-anonymize" | "blocked";
  blockerSummary?: string;
  version: number;
}>;

export type LifecycleListModel = Readonly<{ candidates: readonly LifecycleCandidateModel[] }>;

export type LifecycleOutcomeModel = Readonly<{
  familyId: string;
  state: "deleted" | "anonymized" | "deferred" | "recovered";
  auditEvidenceId: string;
}>;

export type RecipientOptionModel = Readonly<{
  id: string;
  label: string;
  summary: string;
}>;

export type AdvancedSettingsModel = Readonly<{
  recipients: readonly RecipientOptionModel[];
  selectedRecipientId: string;
  remindersEnabled: boolean;
  version: number;
}>;

export type AdvancedSettingsOutcome = Readonly<{
  selectedRecipientId: string;
  remindersEnabled: boolean;
  version: number;
}>;

export type EvidenceStatus = "PASS" | "FAIL" | "OUTSTANDING";

export type EvidenceReference = Readonly<{
  id: string;
  scenarioId: string;
  storyId: string;
  requirementId: string;
  matrixRowId: AuthorizationMatrixRowId;
  executionTarget: "database" | "linked-target";
  status: EvidenceStatus;
  recordedAt: string;
  location: string;
}>;

export type ApplicationEvent = Readonly<{
  id: string;
  type:
    | "assignment.changed"
    | "import.recovery-requested"
    | "lifecycle.requested"
    | "authorization.revoked";
  aggregateId: string;
  aggregateVersion: number;
  occurredAt: string;
  idempotencyKey: string;
  summary: "changed" | "recovery-requested" | "revoked";
}>;

export interface Clock {
  now(): Date;
}

export interface IdGenerator {
  nextId(): string;
}

export function assertNever(value: never): never {
  throw new Error(`Unhandled application state: ${String(value)}`);
}

/* The parent directory, a parent's own profile and the directory commands (U3). */
export type DirectoryParent = Readonly<{
  id: string;
  fullName: string;
  email?: string;
  phone?: string;
  residence?: string;
  occupation?: string;
  hobby?: string;
  howISupport?: string;
  /** Only the parent themself and a super admin get the sharing choice. */
  sharingConsent?: boolean;
  isSelf: boolean;
  /** Only the super admin gets this. */
  hasAccount?: boolean;
}>;

export type DirectoryFamily = Readonly<{
  familyId: string;
  familyName: string;
  isOwnFamily: boolean;
  parents: readonly DirectoryParent[];
  /** Present only when the viewer may see the children and the family has any. */
  children?: readonly string[];
}>;

export type DirectoryModel = Readonly<{ families: readonly DirectoryFamily[] }>;

export type OwnProfileModel = Readonly<{
  parentId: string;
  version: number;
  email?: string;
  phone?: string;
  residence?: string;
  occupation?: string;
  hobby?: string;
  howISupport?: string;
  sharingConsent: boolean;
}>;

export type ProfileFields = Readonly<
  Partial<Record<"phone" | "residence" | "occupation" | "hobby" | "how_i_support", string | null>>
>;

export type ParentInput = Readonly<{
  displayName: string;
  email: string;
  phone?: string | null;
}>;

export type VersionModel = Readonly<{ id: string | null; version: number | null }>;
export type RemovedParentModel = Readonly<{ parentId: string; accountId: string | null }>;
