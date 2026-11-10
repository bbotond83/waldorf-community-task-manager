import { grantAllows, isAuthorizationVersion, isRoleScope } from "../access/role-policy.ts";
import type { AuthorizationAction, Role, Scope } from "../access/index.ts";
import type {
  ApplicationResult,
  AuthorizationMatrixRowId,
  AuthorizedContext,
  NavigationItem,
  NavigationModel,
  SensitiveFieldId,
  SessionContext,
} from "./contracts.ts";
import { denied, invalidated, success } from "./results.ts";

export type ApplicationAction = AuthorizationAction;

export type AuthorizationRequest = Readonly<{
  matrixRowId: AuthorizationMatrixRowId;
  action: ApplicationAction;
  resource: string;
  scope: Scope;
  fields?: readonly SensitiveFieldId[];
}>;

export interface AuthorizationVersionPort {
  getCurrentVersion(subjectId: string): number | undefined | Promise<number | undefined>;
  clearProtectedCache(subjectId: string): void | Promise<void>;
}

type MatrixRow = Readonly<{
  id: AuthorizationMatrixRowId;
  roles: readonly Role[];
  actions: readonly ApplicationAction[];
  resources: readonly string[];
  fields: readonly SensitiveFieldId[];
  navigation?: NavigationItem;
  explicitDeny?: boolean;
}>;

export const AUTHORIZATION_MATRIX_VERSION = "four-role-v1";

const DISPLAY_NAME_FIELDS = ["SF-DISPLAY-NAME", "SF-PARTICIPANT-NAME"] as const;

export const AUTHORIZATION_MATRIX: readonly MatrixRow[] = Object.freeze([
  {
    id: "AUTH-PARENT-DUTIES",
    roles: ["parent"],
    actions: ["read", "create", "update", "respond", "withdraw"],
    resources: ["family", "assignment", "swap_request", "cancellation_request", "contribution"],
    fields: DISPLAY_NAME_FIELDS,
    navigation: { id: "parent-duties", label: "Feladatok", href: "/szulo/feladatok" },
  },
  {
    id: "AUTH-PARENT-NOTIFICATIONS",
    roles: ["parent"],
    actions: ["read", "update"],
    resources: ["notification"],
    fields: ["SF-DISPLAY-NAME"],
    navigation: {
      id: "parent-notifications",
      label: "Értesítések",
      href: "/szulo/ertesitesek",
    },
  },
  {
    id: "AUTH-TEACHER-TRACKING",
    roles: ["kindergarten_teacher"],
    actions: ["read"],
    resources: ["schedule", "coordination"],
    fields: DISPLAY_NAME_FIELDS,
    navigation: { id: "teacher-tracking", label: "Beosztás", href: "/teacher/schedule" },
  },
  {
    id: "AUTH-GROUP-ADMIN-CORE",
    roles: ["group_admin"],
    actions: ["read", "create", "update", "manage"],
    resources: ["dashboard", "task", "assignment", "approval", "archive"],
    fields: DISPLAY_NAME_FIELDS,
    navigation: { id: "admin-dashboard", label: "Áttekintés", href: "/admin" },
  },
  {
    id: "AUTH-WORKING-GROUPS",
    roles: ["parent", "group_admin", "kindergarten_teacher", "super_admin"],
    actions: ["read"],
    resources: ["working_group"],
    fields: [],
  },
  {
    // The published rota: every signed-in role reads it (BR24.1). The menus are in `src/runtime/navigation.ts`.
    id: "AUTH-ROTA-OVERVIEW",
    roles: ["parent", "group_admin", "kindergarten_teacher", "super_admin"],
    actions: ["read"],
    resources: ["rota"],
    fields: [],
  },
  {
    // A duty card opens for a parent of the holding family and for a super admin; the database decides which (BR24.2).
    // A group admin who is also a parent of that family holds the parent grant and opens it as a parent; a group
    // admin grant alone gives no card.
    id: "AUTH-ROTA-DUTY",
    roles: ["parent", "super_admin"],
    actions: ["read"],
    resources: ["rota_duty"],
    fields: [],
  },
  {
    // The school calendar and the rota plan are a super admin's alone (BR20.2, BR21.1).
    id: "AUTH-SUPER-ROTA",
    roles: ["super_admin"],
    actions: ["read", "create", "update", "delete", "manage"],
    resources: ["school_calendar", "rota_plan"],
    fields: [],
  },
  {
    id: "AUTH-SUPER-ADMIN",
    roles: ["super_admin"],
    actions: ["read", "create", "update", "delete", "manage"],
    resources: [
      "dashboard",
      "record",
      "task",
      "assignment",
      "approval",
      "archive",
      "reminder",
      "lifecycle",
      "settings",
    ],
    fields: DISPLAY_NAME_FIELDS,
    navigation: { id: "admin-dashboard", label: "Áttekintés", href: "/admin" },
  },
  {
    id: "AUTH-SUPER-GOVERNANCE",
    roles: ["super_admin"],
    actions: ["read", "create", "update", "delete", "manage"],
    resources: ["role_grant", "governance"],
    fields: DISPLAY_NAME_FIELDS,
    navigation: { id: "admin-settings", label: "Beállítások", href: "/admin/beallitasok" },
  },
]);

const HOME_PATH_BY_ROLE: Readonly<Record<Role, string>> = Object.freeze({
  parent: "/szulo/ertesitesek",
  kindergarten_teacher: "/teacher/schedule",
  group_admin: "/admin",
  super_admin: "/admin",
});

export class AuthorizationContract {
  readonly version = AUTHORIZATION_MATRIX_VERSION;
  private readonly versions: AuthorizationVersionPort;

  constructor(versions: AuthorizationVersionPort) {
    this.versions = versions;
  }

  async authorize(
    session: SessionContext,
    request: AuthorizationRequest,
  ): Promise<ApplicationResult<AuthorizedContext>> {
    if (!isCurrentSession(session)) return denied("INVALID_SESSION");

    const currentVersion = await this.versions.getCurrentVersion(session.subjectId);
    if (
      !isAuthorizationVersion(currentVersion) ||
      currentVersion !== session.authorizationVersion
    ) {
      await this.versions.clearProtectedCache(session.subjectId);
      return invalidated("AUTHORIZATION_VERSION_STALE");
    }

    const row = AUTHORIZATION_MATRIX.find((candidate) => candidate.id === request.matrixRowId);
    if (!row || row.explicitDeny || !matchesRow(row, session, request)) {
      return denied();
    }

    return success(
      Object.freeze({
        session,
        matrixRowId: row.id,
        scope: request.scope,
        fields: Object.freeze([...(request.fields ?? [])]),
      }),
      "AUTHORIZED",
    );
  }

  async navigation(session: SessionContext): Promise<ApplicationResult<NavigationModel>> {
    if (!isCurrentSession(session)) return denied();
    const currentVersion = await this.versions.getCurrentVersion(session.subjectId);
    if (
      !isAuthorizationVersion(currentVersion) ||
      currentVersion !== session.authorizationVersion
    ) {
      await this.versions.clearProtectedCache(session.subjectId);
      return invalidated("AUTHORIZATION_VERSION_STALE");
    }

    const items = AUTHORIZATION_MATRIX.filter(
      (row) =>
        !row.explicitDeny &&
        row.navigation !== undefined &&
        session.grants.some(
          (grant) =>
            grant.revokedAt === undefined &&
            isRoleScope(grant.role, grant.scope) &&
            row.roles.includes(grant.role),
        ),
    ).map((row) => row.navigation!);
    const firstRole = session.grants.find(
      (grant) => grant.revokedAt === undefined && isRoleScope(grant.role, grant.scope),
    )?.role;
    if (!firstRole || items.length === 0) return denied();

    return success(
      Object.freeze({ homePath: HOME_PATH_BY_ROLE[firstRole], items: Object.freeze(items) }),
      "NAVIGATION_READY",
    );
  }
}

function matchesRow(
  row: MatrixRow,
  session: SessionContext,
  request: AuthorizationRequest,
): boolean {
  const fields = request.fields ?? [];
  const fieldNames: Readonly<Record<string, string>> = {
    "SF-DISPLAY-NAME": "display_name",
    "SF-PARTICIPANT-NAME": "participant_name",
  };
  return (
    row.actions.includes(request.action) &&
    row.resources.includes(request.resource) &&
    fields.every((field) => row.fields.includes(field)) &&
    session.grants.some(
      (grant) =>
        grant.subjectId === session.subjectId &&
        row.roles.includes(grant.role) &&
        (fields.length ? fields : [undefined]).every((field) =>
          grantAllows(grant, {
            action: request.action,
            resource: {
              kind: request.resource,
              scope: request.scope,
              field: field ? (fieldNames[field] ?? field) : undefined,
            },
          }),
        ),
    )
  );
}
function isCurrentSession(session: SessionContext): boolean {
  return (
    session.isActive === true &&
    isAuthorizationVersion(session.authorizationVersion) &&
    Array.isArray(session.grants) &&
    session.grants.length > 0 &&
    session.grants.every(
      (grant) => grant.subjectId === session.subjectId && isRoleScope(grant.role, grant.scope),
    )
  );
}

export class InMemoryAuthorizationVersions implements AuthorizationVersionPort {
  readonly clearedSubjects: string[] = [];
  private readonly versions = new Map<string, number>();

  constructor(entries: Readonly<Record<string, number>> = {}) {
    Object.entries(entries).forEach(([subjectId, version]) =>
      this.versions.set(subjectId, version),
    );
  }

  getCurrentVersion(subjectId: string): number | undefined {
    return this.versions.get(subjectId);
  }

  clearProtectedCache(subjectId: string): void {
    this.clearedSubjects.push(subjectId);
  }

  setVersion(subjectId: string, version: number): void {
    this.versions.set(subjectId, version);
  }
}
