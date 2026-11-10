import {
  AdminApplicationFacade,
  AuthorizationContract,
  FacadePipeline,
  IdempotencyCoordinator,
  InMemoryIdempotencyStore,
  ParentApplicationFacade,
  RotaApplicationFacade,
  TeacherApplicationFacade,
  WorkingGroupApplicationFacade,
  type DomainOutcome,
  type RotaApplicationPort,
} from "../../src/application/index.ts";
import { createVersionPort } from "../../src/data/index.ts";
import type { RequestServices } from "../../src/runtime/production/services.ts";
import { failure, fakeData, ok, type FakeHandlers, type QueryCall } from "./data-fakes.ts";
import {
  AdminPortDouble,
  classifyDoubleFailure,
  createTeacherRepositoryDouble,
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
    data: { overviewState: "nothing_published", items: [] },
  }),
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
      workingGroups: new WorkingGroupApplicationFacade(pipeline, {
        list: async () => ({
          state: "success",
          data: {
            items: TEACHER_GROUPS.map((group) => ({
              id: group.scope.id,
              name: group.label,
              description: `${group.label} leírása.`,
              schoolYearId: "year-2026",
              schoolYearName: "2026/2027",
            })),
          },
        }),
      }),
      // The rota screens come after the owner's design approval; until then nothing is planned or published.
      rota: new RotaApplicationFacade(pipeline, ROTA_PORT_DOUBLE),
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
      return { parent: parentPort, admin: adminPort, teacher: teacherSource };
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
