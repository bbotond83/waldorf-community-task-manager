import {
  AdminApplicationFacade,
  AuthorizationContract,
  DirectoryApplicationFacade,
  ChecklistApplicationFacade,
  EventApplicationFacade,
  LibraryApplicationFacade,
  RecurringApplicationFacade,
  AnimalCareApplicationFacade,
  InformationApplicationFacade,
  FacadePipeline,
  IdempotencyCoordinator,
  InMemoryIdempotencyStore,
  ParentApplicationFacade,
  RotaApplicationFacade,
  TeacherApplicationFacade,
  WorkingGroupApplicationFacade,
  type DomainOutcome,
  type ChecklistApplicationPort,
  type EventApplicationPort,
  type LibraryApplicationPort,
  type RecurringApplicationPort,
  type AnimalCareApplicationPort,
  type InformationApplicationPort,
  type RotaApplicationPort,
  type WorkingGroupApplicationPort,
  type WorkingGroupChangeModel,
  type WorkingGroupDetailModel,
} from "../../src/application/index.ts";
import { createVersionPort } from "../../src/data/index.ts";
import type { RequestServices } from "../../src/runtime/production/services.ts";
import { failure, fakeData, ok, type FakeHandlers, type QueryCall } from "./data-fakes.ts";
import {
  AdminPortDouble,
  classifyDoubleFailure,
  createTeacherRepositoryDouble,
  DirectoryPortDouble,
  PARENT_FAMILY_ID,
  PARENT_ORGANIZATION_ID,
  ParentPortDouble,
  TEACHER_GROUPS,
  TEACHER_ORGANIZATION_ID,
  TeacherPortDouble,
  type TeacherScenario,
} from "./port-doubles.ts";

const deniedOutcome = async <T>(): Promise<DomainOutcome<T>> => ({ state: "denied" });

export const ROTA_CARD_DUTY_ID = "duty-card-1";

export const GROUP_ID = "cccccccc-0000-4000-8000-000000000001";
export const OWN_MEMBERSHIP_ID = "dddddddd-0000-4000-8000-000000000001";
export const OTHER_MEMBERSHIP_ID = "dddddddd-0000-4000-8000-000000000002";

/** An invented group with one coordinator and one plain member; a test replaces `detailOutcome` to change what a page reads. */
export const GROUP_DETAIL: WorkingGroupDetailModel = {
  group: {
    id: GROUP_ID,
    name: "Játszókert",
    description: "A játszókert gondozása.",
    schoolYearId: "year-2026",
    schoolYearName: "2026/2027",
  },
  hasCoordinator: true,
  callerIsParent: true,
  ownMembership: null,
  members: [
    {
      membershipId: OTHER_MEMBERSHIP_ID,
      parentId: "parent-juhar",
      fullName: "Juhar Dóra",
      isCoordinator: true,
      isSelf: false,
    },
  ],
};

/**
 * The working-group port of a request: the list shows the teacher groups, the group page and the four commands answer
 * what a test sets and remember what they were asked, so a test checks both the page and the call.
 */
export class WorkingGroupPortDouble implements WorkingGroupApplicationPort {
  detailOutcome: DomainOutcome<WorkingGroupDetailModel> = { state: "success", data: GROUP_DETAIL };
  commandOutcome: DomainOutcome<WorkingGroupChangeModel> = {
    state: "success",
    data: { membershipId: OWN_MEMBERSHIP_ID, version: 2, alreadyMember: false },
  };
  readonly calls: { name: string; input: unknown }[] = [];

  async list() {
    return {
      state: "success" as const,
      data: {
        items: TEACHER_GROUPS.map((group) => ({
          id: group.scope.id,
          name: group.label,
          description: `${group.label} leírása.`,
          schoolYearId: "year-2026",
          schoolYearName: "2026/2027",
        })),
      },
    };
  }
  async detail(groupId: string) {
    this.calls.push({ name: "detail", input: groupId });
    return this.detailOutcome;
  }
  async join(input: { idempotencyKey: string; groupId: string }) {
    this.calls.push({ name: "join", input });
    return this.commandOutcome;
  }
  async leave(input: { idempotencyKey: string; membershipId: string; expectedVersion: number }) {
    this.calls.push({ name: "leave", input });
    return this.commandOutcome;
  }
  async appoint(input: { idempotencyKey: string; membershipId: string; expectedVersion: number }) {
    this.calls.push({ name: "appoint", input });
    return this.commandOutcome;
  }
  async revoke(input: { idempotencyKey: string; membershipId: string; expectedVersion: number }) {
    this.calls.push({ name: "revoke", input });
    return this.commandOutcome;
  }
}

/** An event port with no events: every read and command is refused, as the screens are not built yet. */
const EVENT_PORT_DOUBLE: EventApplicationPort = {
  list: deniedOutcome,
  listForGroup: deniedOutcome,
  detail: deniedOutcome,
  saveNotices: deniedOutcome,
  saveTale: deniedOutcome,
  saveRole: deniedOutcome,
  removeRole: deniedOutcome,
  clearRoleName: deniedOutcome,
  typedRoles: deniedOutcome,
  addSignup: deniedOutcome,
  changeSignup: deniedOutcome,
  withdrawSignup: deniedOutcome,
  addOffer: deniedOutcome,
  changeOffer: deniedOutcome,
  withdrawOffer: deniedOutcome,
};

/** A checklist port with nothing planned: every read and command is refused, as the screens are not built yet. */
const CHECKLIST_PORT_DOUBLE: ChecklistApplicationPort = {
  checklist: deniedOutcome,
  templates: deniedOutcome,
  templatesForGroup: deniedOutcome,
  template: deniedOutcome,
  templateOptions: deniedOutcome,
  saveTemplate: deniedOutcome,
  setTemplateRemoved: deniedOutcome,
  copyTemplate: deniedOutcome,
  saveSection: deniedOutcome,
  removeSection: deniedOutcome,
  saveTask: deniedOutcome,
  removeTask: deniedOutcome,
  reorder: deniedOutcome,
  claim: deniedOutcome,
  claimTyped: deniedOutcome,
  changeClaim: deniedOutcome,
  withdrawClaim: deniedOutcome,
  markDone: deniedOutcome,
  undoDone: deniedOutcome,
};

/** A library port with no books: every read and command is refused, as the screens are not built yet. */
const LIBRARY_PORT_DOUBLE: LibraryApplicationPort = {
  list: deniedOutcome,
  detail: deniedOutcome,
  addBook: deniedOutcome,
  changeBook: deniedOutcome,
  removeBook: deniedOutcome,
  borrow: deniedOutcome,
  setUntil: deniedOutcome,
  returnBook: deniedOutcome,
  watch: deniedOutcome,
  unwatch: deniedOutcome,
};

/** A recurring-duty port with nothing planned: every read and command is refused, as the screens are not built yet. */
const RECURRING_PORT_DOUBLE: RecurringApplicationPort = {
  groupList: deniedOutcome,
  card: deniedOutcome,
  mine: deniedOutcome,
  bottle: deniedOutcome,
  adminList: deniedOutcome,
  scheduleGet: deniedOutcome,
  saveSchedule: deniedOutcome,
  setActive: deniedOutcome,
  markDone: deniedOutcome,
  undoDone: deniedOutcome,
  skip: deniedOutcome,
};

/** Animal-care and information ports with nothing set up: every read and command is refused, as the screens are not built yet. */
const ANIMAL_PORT_DOUBLE: AnimalCareApplicationPort = {
  slots: deniedOutcome,
  fairShare: deniedOutcome,
  calendar: deniedOutcome,
  saveCalendar: deniedOutcome,
  createSlots: deniedOutcome,
  giveUp: deniedOutcome,
};
const INFORMATION_PORT_DOUBLE: InformationApplicationPort = {
  list: deniedOutcome,
  update: deniedOutcome,
  create: deniedOutcome,
  setHidden: deniedOutcome,
};

/** A rota port with nothing published: the overview is empty, everything else is refused. */
const ROTA_PORT_DOUBLE: RotaApplicationPort = {
  calendar: deniedOutcome,
  addBreakWeek: deniedOutcome,
  removeBreakWeek: deniedOutcome,
  plan: deniedOutcome,
  makeDraft: deniedOutcome,
  setWeek: deniedOutcome,
  discard: deniedOutcome,
  publish: deniedOutcome,
  overview: async () => ({
    state: "success",
    data: { overviewState: "nothing_published", items: [], weekendItems: [] },
  }),
  setStanding: deniedOutcome,
  pickSlot: deniedOutcome,
  assignSlot: deniedOutcome,
  unpickedList: deniedOutcome,
  // One card exists, so a page test sees what the policy lets through; every other id is refused.
  dutyCard: async ({ dutyId }) =>
    dutyId === ROTA_CARD_DUTY_ID
      ? {
          state: "success",
          data: {
            dutyId,
            job: "indoor_cleaning",
            title: "Benti takarítás",
            familyDisplayName: "Minta család 1",
            weekStart: "2026-11-09",
            weekEnd: "2026-11-15",
            noFixedDay: true,
            isBreakWeek: false,
            includesWatering: false,
            bottlesAtWeekEnd: false,
            infoLinks: [],
          },
        }
      : { state: "denied" },
};

/**
 * The signed-in request of the page, action and boundary tests. It stands in for `productionRequest()` of
 * `app/_identity/production-request.ts` (tests mock that module with `requestWorldModule`): the account, its
 * role grants, its authorization version and its parent link are read through the real access code from a fake
 * data API (`data-fakes.ts`), and the facades are the real ones on the port doubles of `port-doubles.ts`.
 */
export type RoleKey = "parent" | "teacher" | "group_admin" | "super_admin";

export const ACCOUNT_IDS: Readonly<Record<RoleKey, string>> = Object.freeze({
  parent: "bbbbbbbb-0000-4000-8000-000000000014",
  teacher: "bbbbbbbb-0000-4000-8000-000000000013",
  group_admin: "bbbbbbbb-0000-4000-8000-000000000011",
  super_admin: "bbbbbbbb-0000-4000-8000-000000000001",
});

type Row = Record<string, unknown>;
type AccessState = { active: boolean; version: number | null; grants: Row[]; parent?: Row };

const grant = (
  role: string,
  scopeType: string,
  scopeId: string,
  organizationId: string,
  id = `${role}-${scopeId}`,
): Row => ({ id, role, scope_type: scopeType, scope_id: scopeId, organization_id: organizationId });

function initialAccess(): Record<RoleKey, AccessState> {
  return {
    parent: {
      active: true,
      version: 1,
      grants: [grant("parent", "family", PARENT_FAMILY_ID, PARENT_ORGANIZATION_ID)],
      parent: {
        id: "parent-boroka",
        family_id: PARENT_FAMILY_ID,
        organization_id: PARENT_ORGANIZATION_ID,
      },
    },
    teacher: {
      active: true,
      version: 1,
      grants: [
        grant(
          "kindergarten_teacher",
          "organization",
          TEACHER_ORGANIZATION_ID,
          TEACHER_ORGANIZATION_ID,
        ),
      ],
    },
    group_admin: {
      active: true,
      version: 1,
      grants: [grant("group_admin", "group", "group-boroka", PARENT_ORGANIZATION_ID)],
      // A group administrator's right counts only while their linked parent is active (BR3.2).
      parent: {
        id: "parent-admin",
        family_id: PARENT_FAMILY_ID,
        organization_id: PARENT_ORGANIZATION_ID,
      },
    },
    super_admin: {
      active: true,
      version: 1,
      grants: [
        grant("super_admin", "organization", PARENT_ORGANIZATION_ID, PARENT_ORGANIZATION_ID),
      ],
    },
  };
}

const roleOfAccount = (accountId: unknown): RoleKey | undefined =>
  (Object.keys(ACCOUNT_IDS) as RoleKey[]).find((role) => ACCOUNT_IDS[role] === accountId);

export type ProductionRequestDouble =
  | { state: "ready"; accountId: string; services: RequestServices }
  | { state: "signed-out" }
  | { state: "unavailable" };

export function createRequestWorld() {
  let access = initialAccess();
  let signedIn: RoleKey | undefined;
  let unavailable = false;
  let accessReadsFail = false;
  let idempotency = new InMemoryIdempotencyStore();
  let teacherScenario: TeacherScenario = "ready";
  const teacherSource = createTeacherRepositoryDouble();
  let parentPort = new ParentPortDouble(ACCOUNT_IDS.parent);
  let adminPort = newAdminPort();
  let directoryPort = new DirectoryPortDouble();
  let workingGroupPort = new WorkingGroupPortDouble();

  function newAdminPort(): AdminPortDouble {
    return new AdminPortDouble({
      revokeGroupAdminAccess: () => {
        const state = access.group_admin;
        state.version = (state.version ?? 1) + 1;
        state.grants = [];
        return state.version;
      },
    });
  }

  const subjectOf = (query: QueryCall): RoleKey | undefined => {
    const step = query.steps.find(
      (entry) => entry[0] === "eq" && (entry[1] === "subject_id" || entry[1] === "account_id"),
    );
    return roleOfAccount(step?.[2]);
  };

  const handlers: FakeHandlers = {
    rpc: () => ok(signedIn ? access[signedIn].active : false),
    table: (query) => {
      if (accessReadsFail) return failure("08006");
      const role = subjectOf(query);
      if (query.table === "app_authorization_versions") {
        const version = role ? access[role].version : null;
        return ok(
          version === null || version === undefined ? [] : [{ authorization_version: version }],
        );
      }
      if (query.table === "app_role_grants") return ok(role ? access[role].grants : []);
      if (query.table === "parents") {
        const link = role ? access[role].parent : undefined;
        return ok(link ? [link] : []);
      }
      if (query.table === "families") return ok([{ id: PARENT_FAMILY_ID }]);
      return ok([]);
    },
  };

  function services(): RequestServices {
    const database = fakeData(handlers).database;
    const authorization = new AuthorizationContract(createVersionPort(database));
    const pipeline = new FacadePipeline(
      authorization,
      classifyDoubleFailure,
      new IdempotencyCoordinator(idempotency),
    );
    return Object.freeze({
      database,
      authorization,
      parent: new ParentApplicationFacade(pipeline, parentPort),
      admin: new AdminApplicationFacade(pipeline, adminPort),
      teacher: new TeacherApplicationFacade(
        pipeline,
        new TeacherPortDouble(teacherSource.repository, teacherScenario),
      ),
      workingGroups: new WorkingGroupApplicationFacade(pipeline, workingGroupPort),
      // The rota screens come after the owner's design approval; until then nothing is planned or published.
      rota: new RotaApplicationFacade(pipeline, ROTA_PORT_DOUBLE),
      directory: new DirectoryApplicationFacade(pipeline, directoryPort),
      // The event screens come after the owner's design approval; until then every event read is empty.
      events: new EventApplicationFacade(pipeline, EVENT_PORT_DOUBLE),
      checklists: new ChecklistApplicationFacade(pipeline, CHECKLIST_PORT_DOUBLE),
      library: new LibraryApplicationFacade(pipeline, LIBRARY_PORT_DOUBLE),
      recurring: new RecurringApplicationFacade(pipeline, RECURRING_PORT_DOUBLE),
      animalCare: new AnimalCareApplicationFacade(pipeline, ANIMAL_PORT_DOUBLE),
      information: new InformationApplicationFacade(pipeline, INFORMATION_PORT_DOUBLE),
    });
  }

  return {
    /** The role the next requests are signed in as; `undefined` is a signed-out visitor. */
    signIn(role: RoleKey | undefined): void {
      signedIn = role;
    },
    /** The runtime or sign-in service cannot answer. */
    setUnavailable(value: boolean): void {
      unavailable = value;
    },
    /** The database cannot answer the access reads (grants, version, parent link). */
    setAccessReadsFail(value: boolean): void {
      accessReadsFail = value;
    },
    setTeacherScenario(scenario: TeacherScenario): void {
      teacherScenario = scenario;
    },
    get access() {
      return access;
    },
    get ports() {
      return {
        parent: parentPort,
        admin: adminPort,
        teacher: teacherSource,
        directory: directoryPort,
        workingGroups: workingGroupPort,
      };
    },
    /** The state of a fresh test: everyone active, nobody signed in, all fixture data as first delivered. */
    reset(): void {
      access = initialAccess();
      signedIn = undefined;
      unavailable = false;
      accessReadsFail = false;
      idempotency = new InMemoryIdempotencyStore();
      teacherScenario = "ready";
      parentPort = new ParentPortDouble(ACCOUNT_IDS.parent);
      adminPort = newAdminPort();
      directoryPort = new DirectoryPortDouble();
      workingGroupPort = new WorkingGroupPortDouble();
    },
    /** What `productionRequest()` answers. */
    async productionRequest(): Promise<ProductionRequestDouble> {
      if (unavailable) return { state: "unavailable" };
      if (!signedIn) return { state: "signed-out" };
      return { state: "ready", accountId: ACCOUNT_IDS[signedIn], services: services() };
    },
  };
}

/** One world per test file (modules are isolated per file); the mock factory of `production-request.ts` uses it. */
export const requestWorld = createRequestWorld();
export const requestWorldModule = () => ({
  productionRequest: () => requestWorld.productionRequest(),
});
