import type { Role, Scope } from "../access/index.ts";
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

export type ApplicationAction = "read" | "create" | "update" | "delete" | "manage";

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

export const AUTHORIZATION_MATRIX_VERSION = "2026-08-12.1";

const DISPLAY_NAME_FIELDS = ["SF-DISPLAY-NAME", "SF-PARTICIPANT-NAME"] as const;

export const AUTHORIZATION_MATRIX: readonly MatrixRow[] = Object.freeze([
  {
    id: "AUTH-PARENT-DUTIES",
    roles: ["parent"],
    actions: ["read", "create", "update"],
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
    id: "AUTH-STAFF-SCHEDULE",
    roles: ["read_only_staff"],
    actions: ["read"],
    resources: ["schedule", "coordination"],
    fields: DISPLAY_NAME_FIELDS,
    navigation: { id: "staff-schedule", label: "Beosztás", href: "/munkatars/beosztas" },
  },
  {
    id: "AUTH-GROUP-ADMIN-CORE",
    roles: ["group_admin"],
    actions: ["read", "create", "update", "manage"],
    resources: ["dashboard", "record", "task", "assignment", "approval", "archive"],
    fields: DISPLAY_NAME_FIELDS,
    navigation: { id: "admin-dashboard", label: "Áttekintés", href: "/admin" },
  },
  {
    id: "AUTH-GRP-IMPORT-DENY",
    roles: ["group_admin"],
    actions: ["read", "create", "update", "manage"],
    resources: ["import"],
    fields: [],
    explicitDeny: true,
  },
  {
    id: "AUTH-KINDERGARTEN-ADMIN",
    roles: ["kindergarten_admin"],
    actions: ["read", "create", "update", "delete", "manage"],
    resources: [
      "dashboard",
      "record",
      "task",
      "assignment",
      "approval",
      "archive",
      "import",
      "reminder",
      "lifecycle",
      "settings",
    ],
    fields: DISPLAY_NAME_FIELDS,
    navigation: { id: "admin-dashboard", label: "Áttekintés", href: "/admin" },
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
      "import",
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
  parent: "/szulo/feladatok",
  read_only_staff: "/munkatars/beosztas",
  group_admin: "/admin",
  kindergarten_admin: "/admin",
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
    if (!isValidSessionMode(session)) return denied("INVALID_SESSION_MODE");

    const currentVersion = await this.versions.getCurrentVersion(session.subjectId);
    if (currentVersion === undefined || currentVersion !== session.authorizationVersion) {
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
    const currentVersion = await this.versions.getCurrentVersion(session.subjectId);
    if (currentVersion === undefined || currentVersion !== session.authorizationVersion) {
      await this.versions.clearProtectedCache(session.subjectId);
      return invalidated("AUTHORIZATION_VERSION_STALE");
    }

    const items = AUTHORIZATION_MATRIX.filter(
      (row) =>
        !row.explicitDeny &&
        row.navigation !== undefined &&
        row.roles.some((role) => session.roles.includes(role)),
    ).map((row) => row.navigation!);
    const firstRole = session.roles[0];
    if (!firstRole || items.length === 0) return denied();

    return success(
      Object.freeze({ homePath: HOME_PATH_BY_ROLE[firstRole], items: Object.freeze(items) }),
      "NAVIGATION_READY",
    );
  }
}

function isValidSessionMode(session: SessionContext): boolean {
  return session.runtimeMode === "synthetic" ? session.isSynthetic : !session.isSynthetic;
}

function matchesRow(
  row: MatrixRow,
  session: SessionContext,
  request: AuthorizationRequest,
): boolean {
  return (
    row.roles.some((role) => session.roles.includes(role)) &&
    row.actions.includes(request.action) &&
    row.resources.includes(request.resource) &&
    session.scopes.some((scope) => scopeContains(scope, request.scope)) &&
    (request.fields ?? []).every((field) => row.fields.includes(field))
  );
}

function scopeContains(grant: Scope, requested: Scope): boolean {
  return (
    grant.organizationId === requested.organizationId &&
    (grant.type === "organization" || (grant.type === requested.type && grant.id === requested.id))
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
