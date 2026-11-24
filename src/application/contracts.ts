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
  | "AUTH-EVENTS"
  | "AUTH-PARENT-EVENT-SIGNUP"
  | "AUTH-LIBRARY"
  | "AUTH-LIBRARY-COMMANDS"
  | "AUTH-RECURRING"
  | "AUTH-RECURRING-DUTY"
  | "AUTH-RECURRING-MANAGE"
  | "AUTH-ANIMAL"
  | "AUTH-ANIMAL-SLOT"
  | "AUTH-ANIMAL-MANAGE"
  | "AUTH-INFO"
  | "AUTH-INFO-EDIT"
  | "AUTH-ROTA-OVERVIEW"
  | "AUTH-ROTA-DUTY"
  | "AUTH-DIRECTORY"
  | "AUTH-PARENT-ACCOUNT"
  | "AUTH-SUPER-ROTA"
  | "AUTH-PARENT-WEEKEND-PICK"
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
  /** The lines at the top of the duty's event, for the family that holds a place and for a manager (BR103.1). */
  eventNotices?: readonly string[];
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

/** One row of an event list (BR104.2): open events soonest first, or the ended ones newest first. */
export type EventListItem = Readonly<{
  id: string;
  title: string;
  location?: string;
  startsAt: string;
  endsAt: string;
  status: "planned" | "cancelled";
  isFinished: boolean;
  groupId?: string;
  groupName?: string;
  /** How many sign-ups the event has, and whether the calling parent has one (false without a parent record). */
  signupCount: number;
  isSignedUp: boolean;
}>;

export type EventListModel = Readonly<{
  items: readonly EventListItem[];
  /** What the caller may manage: the whole community, or the listed groups' events (a list for one group has `canManage`). */
  canManageCommunity: boolean;
  managedGroupIds: readonly string[];
  canManage?: boolean;
}>;

export type EventRoleModel = Readonly<{
  id: string;
  name: string;
  kind: "parent" | "typed" | "former";
  displayName: string;
  parentId?: string;
  isOrganiser: boolean;
  version: number;
}>;

export type EventSignupModel = Readonly<{
  id: string;
  parentDisplayName: string;
  familyDisplayName: string;
  note?: string;
  chosenAt?: string;
  version: number;
  isOwn: boolean;
}>;

export type FoodOfferModel = Readonly<{
  id: string;
  parentDisplayName: string;
  text: string;
  hasMilk: boolean;
  hasEgg: boolean;
  hasGarlic: boolean;
  version: number;
  isOwn: boolean;
}>;

export const FOOD_CATEGORIES = Object.freeze([
  "spreads",
  "bread",
  "free_from",
  "savoury",
  "sweet",
  "drinks",
  "vegetables_fruit",
  "other",
] as const);
export type FoodCategory = (typeof FOOD_CATEGORIES)[number];

/** One event page in a single document (NFR9.4): the event, its notices, roles, sign-ups and food offers. */
export type EventDetailModel = Readonly<{
  event: Readonly<{
    id: string;
    title: string;
    location?: string;
    startsAt: string;
    endsAt: string;
    status: "planned" | "cancelled";
    isFinished: boolean;
    isOpen: boolean;
    groupId?: string;
    groupName?: string;
    isSummer: boolean;
    signupDeadline?: string;
    noticeLeadDays?: number;
    foodSignupOn: boolean;
    tale?: string;
    version: number;
  }>;
  notices: readonly string[];
  roles: readonly EventRoleModel[];
  signups: readonly EventSignupModel[];
  food: Readonly<{
    on: boolean;
    categories: readonly Readonly<{ category: FoodCategory; offers: readonly FoodOfferModel[] }>[];
  }>;
  caller: Readonly<{ canManage: boolean; canSignUp: boolean }>;
}>;

/** What an event command returns: the row's id and its new version (none for a removal). */
export type EventChangeModel = Readonly<{ id: string | null; version: number | null }>;

/** The kinds of checklist section: for parents, for the organising team, and for the teachers (who only read it). */
export const CHECKLIST_SECTION_KINDS = Object.freeze([
  "parents",
  "organisers",
  "teachers",
] as const);
export type ChecklistSectionKind = (typeof CHECKLIST_SECTION_KINDS)[number];

/** One person's claim on a checklist task: a parent with their family, or a name typed in by the organising team. */
export type ChecklistClaimModel = Readonly<{
  id: string;
  version: number;
  parentDisplayName?: string;
  familyDisplayName?: string;
  typedName?: string;
  note?: string;
  chosenAt?: string;
  outsideEvent: boolean;
  isOwn: boolean;
  canRemove: boolean;
}>;

export type ChecklistTaskModel = Readonly<{
  id: string;
  position: number;
  title: string;
  place?: string;
  props?: string;
  priority?: number;
  materials?: string;
  tip?: string;
  deadline?: string;
  summerOnly: boolean;
  helpersNeeded: number;
  helpersTaken: number;
  timeMatters: boolean;
  sourceRef?: string;
  version: number;
  done?: Readonly<{ at: string; byDisplayName: string; isOwn: boolean }>;
  claims: readonly ChecklistClaimModel[];
  can: Readonly<{ claim: boolean; markDone: boolean; undoDone: boolean }>;
}>;

export type ChecklistSectionModel = Readonly<{
  id: string;
  position: number;
  title: string;
  kind: ChecklistSectionKind;
  version: number;
  tasks: readonly ChecklistTaskModel[];
}>;

/** An event's whole checklist in one document (NFR9.4); `allDone` is shown to the organising team only. */
export type ChecklistModel = Readonly<{
  eventId: string;
  eventTitle: string;
  checklistVersion: number;
  copiedFromTemplateId?: string;
  isEmpty: boolean;
  isOpen: boolean;
  isFinished: boolean;
  isCancelled: boolean;
  isSummer: boolean;
  signupDeadline?: string;
  allDone?: boolean;
  sections: readonly ChecklistSectionModel[];
  caller: Readonly<{ inTeam: boolean; canManage: boolean; canClaimTasks: boolean }>;
}>;

export type TemplateTaskModel = Readonly<{
  id: string;
  position: number;
  title: string;
  place?: string;
  props?: string;
  priority?: number;
  materials?: string;
  tip?: string;
  summerOnly: boolean;
  helpersNeeded: number;
  timeMatters: boolean;
}>;
export type TemplateSectionModel = Readonly<{
  id: string;
  position: number;
  title: string;
  kind: ChecklistSectionKind;
  tasks: readonly TemplateTaskModel[];
}>;
export type TemplateModel = Readonly<{
  id: string;
  workingGroupId?: string;
  workingGroupName?: string;
  name: string;
  description?: string;
  defaultLeadDays?: number;
  isRemoved: boolean;
  version: number;
  sections: readonly TemplateSectionModel[];
}>;
export type TemplateListModel = Readonly<{
  items: readonly Readonly<{
    id: string;
    name: string;
    workingGroupId?: string;
    groupName?: string;
    taskCount: number;
    status: "active" | "removed";
    version: number;
  }>[];
  canManageCommunity: boolean;
  managedGroupIds: readonly string[];
}>;
export type TemplateOptionsModel = Readonly<{
  items: readonly Readonly<{
    id: string;
    name: string;
    defaultLeadDays?: number;
    workingGroupId?: string;
    hasSummerTasks: boolean;
  }>[];
}>;

/** What a checklist or template command returns: the row's id and its new version (none for a removal). */
export type ChecklistChangeModel = EventChangeModel;

/** A typed name on an event role, for the removal screen's super-admin list (BR124.2). */
export type TypedRoleItem = Readonly<{
  roleId: string;
  roleName: string;
  personName: string;
  version: number;
  eventId: string;
  eventTitle: string;
  startsAt: string;
}>;
export type TypedRoleListModel = Readonly<{ items: readonly TypedRoleItem[] }>;

/** Who owns a book: a parent, a name typed in by the one-off load, or nobody any more (BR131.2, BR139.1). */
export type LibraryOwner = Readonly<{
  kind: "parent" | "typed" | "former";
  /** The owner's name, a typed name, or "korábbi tag"; never a contact detail. */
  displayName: string;
}>;

/** One book of the list (BR130.1): where it is now, and whether it is the caller's own or held by the caller. */
export type LibraryBookItem = Readonly<{
  id: string;
  title: string;
  authors: string;
  description?: string;
  version: number;
  owner: LibraryOwner;
  state: "available" | "borrowed";
  holderDisplayName?: string;
  until?: string;
  isOwn: boolean;
  borrowedByMe: boolean;
}>;

export type LibraryListModel = Readonly<{
  items: readonly LibraryBookItem[];
  /** Whether the caller may add a book: a parent or a super admin. */
  canAdd: boolean;
}>;

export type LibraryLoanModel = Readonly<{
  id: string;
  version: number;
  borrowedAt: string;
  until?: string;
  holderDisplayName: string;
  isMine: boolean;
}>;

/** One book page in a single document (NFR9.4): the book, its open loan and what the caller may do. */
export type LibraryBookDetailModel = Readonly<{
  book: Readonly<{
    id: string;
    title: string;
    authors: string;
    description?: string;
    version: number;
    owner: LibraryOwner;
    state: "available" | "borrowed";
  }>;
  loan?: LibraryLoanModel;
  caller: Readonly<{
    canEdit: boolean;
    canRemove: boolean;
    canBorrow: boolean;
    canReturn: boolean;
    canSetUntil: boolean;
    canWatch: boolean;
    isWatching: boolean;
  }>;
}>;

/** What a library command returns: the row's id and its new version (none for a removal or a watch). */
export type LibraryChangeModel = Readonly<{ id: string | null; version: number | null }>;

export type RecurringOwnerKind = "group" | "family" | "rota_week";

/**
 * One occurrence of a recurring duty with what the caller may do (U9). "Overdue" is not stored: it is an open
 * occurrence whose due date has passed. A person appears only as a display name, a removed one as "korábbi tag".
 */
export type RecurringItem = Readonly<{
  id: string;
  scheduleId: string;
  title: string;
  category: string;
  ownerKind: RecurringOwnerKind;
  workingGroupId?: string;
  groupName?: string;
  dueDate: string;
  status: "open" | "done" | "skipped";
  isOverdue: boolean;
  version: number;
  doneByDisplayName?: string;
  doneAt?: string;
  skippedReason?: string;
  skippedByDisplayName?: string;
  canMarkDone: boolean;
  canUndo: boolean;
  canSkip: boolean;
}>;

/** A schedule as the form and the lists need it. The admin list adds the family's display name. */
export type RecurringScheduleItem = Readonly<{
  id: string;
  title: string;
  category: string;
  ownerKind: RecurringOwnerKind;
  workingGroupId?: string;
  familyId?: string;
  familyDisplayName?: string;
  rotaJob?: string;
  intervalKind: string;
  intervalCount: number;
  startDate: string;
  seasonFromMonth?: number;
  seasonToMonth?: number;
  isActive: boolean;
  version: number;
}>;

/** A working group's recurring page in one document (NFR9.4): its schedules, open and recent items, and the history. */
export type RecurringGroupListModel = Readonly<{
  group: Readonly<{ id: string; name: string; status: string }>;
  schedules: readonly RecurringScheduleItem[];
  items: readonly RecurringItem[];
  history: readonly RecurringItem[];
  canManage: boolean;
  canMark: boolean;
}>;

/** One duty card: the occurrence and its schedule. */
export type RecurringCardModel = Readonly<{ item: RecurringItem; schedule: RecurringScheduleItem }>;

/** The items of the caller's family and groups, or of one rota week's duty card (the bottle-cleaning line). */
export type RecurringItemsModel = Readonly<{ items: readonly RecurringItem[] }>;

/** The schedules of families and rota jobs, for a super admin. */
export type RecurringScheduleListModel = Readonly<{ items: readonly RecurringScheduleItem[] }>;

/** One schedule for the form, and whether the caller may change it. */
export type RecurringScheduleModel = Readonly<{
  schedule: RecurringScheduleItem;
  canManage: boolean;
}>;

/** What a recurring command returns: the row's id and its new version. */
export type RecurringChangeModel = Readonly<{ id: string | null; version: number | null }>;

/** One link from a duty to a section of the information page (U8). */
export type InfoLink = Readonly<{ key: string; title: string }>;

/**
 * One morning or afternoon slot of the animal-care sign-up (U8). A taken slot shows the family's display name only.
 * `canGiveUp` is true only for the caller's own slot more than 24 hours ahead and outside an open swap.
 */
export type AnimalSlotItem = Readonly<{
  slotDate: string;
  part: "morning" | "afternoon";
  startTime: string;
  dutyId: string;
  dutyVersion: number;
  placeId?: string;
  placeVersion?: number;
  familyName?: string;
  mine: boolean;
  inSwap: boolean;
  started: boolean;
  cancelled: boolean;
  canGiveUp: boolean;
  mayHold: boolean;
  holdReason?: string;
}>;

/** The slots of a few weeks from a date, with the information links of the two parts. */
export type AnimalSlotsModel = Readonly<{
  schoolYearId: string;
  fromDate: string;
  toDate: string;
  slots: readonly AnimalSlotItem[];
  infoLinksMorning: readonly InfoLink[];
  infoLinksAfternoon: readonly InfoLink[];
}>;

export type AnimalFairShareRow = Readonly<{
  familyName: string;
  count: number;
  share: number;
  activeWeeks: number;
  mine: boolean;
}>;

/** The fair-share panel: the caller's own family, the year's average and every counted family. */
export type AnimalFairShareModel = Readonly<{
  average: number;
  mine?: AnimalFairShareRow;
  families: readonly AnimalFairShareRow[];
}>;

/** The animal-care settings of a school year for a super admin; `exists` is false before the first save. */
export type AnimalCalendarModel = Readonly<{
  schoolYearId: string;
  exists: boolean;
  morningStart: string;
  afternoonStart: string;
  careGroupId?: string;
  generatedAt?: string;
  slotCount: number;
  version: number;
  groups: readonly Readonly<{ id: string; name: string }>[];
}>;

/** What an animal-care command returns: the row's id, its new version and, for slot creation, how many were added. */
export type AnimalChangeModel = Readonly<{
  id: string | null;
  version: number | null;
  added?: number;
}>;

/** One section of the information page with what the caller may do to it. */
export type InfoSectionItem = Readonly<{
  id: string;
  key: string;
  title: string;
  body: string;
  owningGroupName?: string;
  seasonMonths?: readonly number[];
  position: number;
  hidden: boolean;
  version: number;
  canEditText: boolean;
  canEditAll: boolean;
}>;

export type InfoSectionsModel = Readonly<{
  canManage: boolean;
  ownerGroupNames: readonly string[];
  items: readonly InfoSectionItem[];
}>;

export type InfoChangeModel = Readonly<{ id: string | null; version: number | null }>;

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
  /** Every active family with its standing in the year (BR60.4), and the duties flagged by it (BR60.5). */
  standings: readonly FamilyStandingItem[];
  flaggedDuties: readonly FlaggedDutyItem[];
}>;

/** The four rotas of the community (BR61.1). */
export type RotaJob = "indoor_cleaning" | "front_garden" | "water_carrying" | "weekend_animal_care";

/** The five duties of a weekend (BR63.1): the four openings and closings, and the shelter cleaning. */
export type WeekendSlot =
  | "saturday_opening"
  | "saturday_closing"
  | "sunday_opening"
  | "sunday_closing"
  | "shelter_cleaning";

/** The standing of a family in a school year (BR60.1): staying, leaving after the changeover date, or new from it. */
export type FamilyStanding = "staying" | "leaving" | "new";

/** One row of the plan being adjusted: one rota, one week (BR21.2, BR22.1, BR62.1). */
export type RotaPlanWeek = Readonly<{
  id: string;
  job: RotaJob;
  weekStart: string;
  isBreak: boolean;
  familyId?: string;
  familyDisplayName?: string;
  emptyReason?: "no_family" | "cleared" | "cancelled";
  changedByAdmin: boolean;
  version: number;
  /** Of a published week with a family: the duty and the version of its place, for handing the week over (BR74.1). */
  dutyId?: string;
  placeVersion?: number;
}>;

/**
 * A family's weeks in the plan. `counts` holds the weeks of each rota and `aboveLowestJobs` the rotas in which a
 * full-year family is more than one week above the lowest count (BR62.2); `weeks` and `aboveLowest` are the indoor
 * cleaning figures that the planning screen showed before there were four rotas.
 */
export type RotaFamilyCount = Readonly<{
  familyId: string;
  displayName: string;
  fullYear: boolean;
  counts: Readonly<Record<RotaJob, number>>;
  aboveLowestJobs: readonly RotaJob[];
  weeks: number;
  aboveLowest: boolean;
}>;

/** A week row named by its Monday and rota, as the blockers and warnings of the plan list it. */
export type RotaWeekRef = Readonly<{ weekStart: string; job: RotaJob; reason?: string }>;

/** A family that holds a week it may not hold (BR60.5): the rota week and why. */
export type RotaFlaggedWeek = Readonly<{
  weekStart: string;
  job: RotaJob;
  familyId: string;
  familyDisplayName: string;
  reason: "leaving_after_changeover" | "new_before_changeover";
}>;

/** The same family on indoor cleaning and front garden in one week (BR62.6), and on two other rotas (a warning). */
export type RotaClashWeek = Readonly<{
  weekStart: string;
  familyId: string;
  familyDisplayName: string;
  jobs?: readonly RotaJob[];
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
  /**
   * What blocks publishing. The three week lists hold each Monday once (as before four rotas); the `*Rows` lists
   * and the flagged and clash lists say which rota and why (BR62.3).
   */
  blockers: Readonly<{
    emptyWeeks: readonly string[];
    breakWeeks: readonly string[];
    ineligibleWeeks: readonly string[];
    emptyRows: readonly RotaWeekRef[];
    breakRows: readonly RotaWeekRef[];
    ineligibleRows: readonly RotaWeekRef[];
    flaggedWeeks: readonly RotaFlaggedWeek[];
    clashWeeks: readonly RotaClashWeek[];
  }>;
  /** Warnings that do not block: one family on two rotas in one week, other than the clash (BR62.7). */
  warnings: Readonly<{ twoJobs: readonly RotaClashWeek[] }>;
  canPublish: boolean;
}>;

/** One row of the overview: only the family id and name, never a contact detail or a sharing choice (NFR1.2). */
export type RotaOverviewItem = Readonly<{
  job: RotaJob;
  weekStart: string;
  isBreak: boolean;
  familyId?: string;
  familyDisplayName?: string;
  isOwn: boolean;
  dutyId?: string;
}>;

/** One weekend duty of the overview: who holds the opening, closing or shelter cleaning (BR65.1). */
export type WeekendOverviewItem = Readonly<{
  weekStart: string;
  slot: WeekendSlot;
  familyId?: string;
  familyDisplayName?: string;
  isOwn: boolean;
  dutyId?: string;
}>;

export type RotaOverviewModel = Readonly<{
  overviewState: "nothing_published" | "published";
  schoolYear?: Readonly<{ id: string; name: string }>;
  items: readonly RotaOverviewItem[];
  weekendItems: readonly WeekendOverviewItem[];
}>;

/** A free opening or closing of a weekend, with the place version the pick command needs. */
export type WeekendFreeSlot = Readonly<{ slot: WeekendSlot; dutyId: string; placeVersion: number }>;

/** The state of one weekend as a duty card shows it (BR65.3). */
export type WeekendStateModel = Readonly<{
  weekStart: string;
  picksCloseAt: string;
  changeUntil: string;
  weekendFamilyDisplayName?: string;
  slots: readonly Readonly<{
    slot: WeekendSlot;
    dutyId: string;
    placeVersion: number;
    holderFamilyDisplayName?: string;
    heldByWeekendFamily: boolean;
    picked: boolean;
  }>[];
  pickers: readonly Readonly<{
    job: "indoor_cleaning" | "front_garden";
    familyDisplayName?: string;
    state: "not_needed" | "picked" | "missed" | "open";
    slot?: WeekendSlot;
  }>[];
}>;

/** What the picking family itself can do on its duty card (BR63.4). */
export type WeekendOwnPickModel = Readonly<{
  rotaWeekId: string;
  state: "not_needed" | "picked" | "missed" | "open";
  slot?: WeekendSlot;
  canPick: boolean;
  freeSlots: readonly WeekendFreeSlot[];
  picksCloseAt: string;
  changeUntil: string;
}>;

/** The duty card (W7): the week, the family and the fixed text key; a weekly duty has no fixed day (BR24.2). */
export type RotaDutyCardModel = Readonly<{
  dutyId: string;
  job: RotaJob;
  slot?: WeekendSlot;
  title: string;
  familyDisplayName: string;
  weekStart: string;
  weekEnd: string;
  noFixedDay: boolean;
  isBreakWeek: boolean;
  includesWatering: boolean;
  bottlesAtWeekEnd: boolean;
  /** Sections of the information page that explain this duty (U8, BR88); empty when none applies. */
  infoLinks: readonly InfoLink[];
  day?: "saturday" | "sunday" | "weekend";
  partOfDay?: "morning" | "evening" | "all_day";
  weekend?: WeekendStateModel;
  ownPick?: WeekendOwnPickModel;
}>;

/** A family's standing in the year shown, with the version the next change needs (BR60.1). */
export type FamilyStandingItem = Readonly<{
  familyId: string;
  displayName: string;
  standing: FamilyStanding;
  version: number;
}>;

/** A duty held by a family that may not hold it (BR60.5), listed for the administrator. */
export type FlaggedDutyItem = Readonly<{
  source: string;
  familyId: string;
  familyDisplayName: string;
  title: string;
  job?: RotaJob;
  onDate: string;
  reason: "leaving_after_changeover" | "new_before_changeover";
  dutyId?: string;
}>;

/** One owed pick not yet made, with the openings and closings still free (BR63.8). */
export type UnpickedItem = Readonly<{
  rotaWeekId: string;
  job: "indoor_cleaning" | "front_garden";
  weekStart: string;
  familyDisplayName: string;
  weekendFamilyDisplayName: string;
  picksCloseAt?: string;
  changeUntil?: string;
  freeSlots: readonly WeekendFreeSlot[];
}>;

/** The unpicked list of the dashboard: still open, and missed in time (BR63.8, BR65.4). */
export type UnpickedListModel = Readonly<{
  items: readonly UnpickedItem[];
  missed: readonly UnpickedItem[];
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
  /** Open while it waits for an answer; every other value is an ended request, kept for 60 days. */
  status:
    | "open"
    | "applied"
    | "rejected"
    | "withdrawn"
    | "expired"
    | "cancelled"
    | "approved"
    | "reversed";
  /** Why an ended request ended (declined, withdrawn, the duty started, an administrator's decision, ...). */
  endedReason?: string;
  /** The family's own reason; the other family and the administrators see it too. */
  reason?: string;
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
  /** Event: the settings (BR102.1) and the year's tale (BR107.1). */
  isSummer?: boolean;
  signupDeadline?: string;
  noticeLeadDays?: number;
  foodSignupOn?: boolean;
  tale?: string;
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
