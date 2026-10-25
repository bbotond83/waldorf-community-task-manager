import type { Role, Scope } from "../../access/index.ts";
import type { NavigationItem, SessionContext } from "../../application/index.ts";
import { readAccessContext, toSessionContext, type AccessContext } from "../../data/index.ts";
import type { DatabaseClient } from "../database/client.ts";
import type { ShellProfile } from "../shell-profile.ts";
import {
  GROUP_ADMIN_NAVIGATION,
  PARENT_NAVIGATION,
  SUPER_ADMIN_NAVIGATION,
  TEACHER_NAVIGATION,
} from "../navigation.ts";

/**
 * What a signed-in account may do on the parent, admin and teacher pages, read from the database as the
 * person themselves (FR2.8, BR32.2, BR32.7): the family of a parent comes from the Parent linked to the
 * account, the reach of an admin and the groups of a teacher from their role grants. Nothing is a constant.
 * An account that holds no fitting role is `denied` (with the home path of the role it does hold), one with
 * no active session is `signed-out`, and a database that cannot answer is `unavailable`.
 */
export type AccessResult<T> =
  | { state: "success"; data: T }
  | { state: "signed-out" }
  | { state: "denied"; homePath?: string }
  | { state: "unavailable" };

export type ParentAccess = Readonly<{
  applicationSession: SessionContext;
  familyScope: Scope;
  familyId: string;
  profile: ShellProfile;
}>;

export type AdminAccess = Readonly<{
  applicationSession: SessionContext;
  scope: Scope;
  profile: ShellProfile;
}>;

export type TeacherAccess = Readonly<{
  applicationSession: SessionContext;
  profile: ShellProfile;
}>;

const HOME: Readonly<Record<Role, string>> = Object.freeze({
  parent: "/szulo/ertesitesek",
  kindergarten_teacher: "/teacher/schedule",
  group_admin: "/admin",
  super_admin: "/admin",
});

/** Which home a person lands on when the page they asked for is not theirs: the strongest role first. */
const HOME_ORDER: readonly Role[] = [
  "super_admin",
  "group_admin",
  "kindergarten_teacher",
  "parent",
];

function homeOf(context: AccessContext): string | undefined {
  const role = HOME_ORDER.find((candidate) =>
    context.grants.some((grant) => grant.role === candidate),
  );
  return role ? HOME[role] : undefined;
}

/** Denied, pointing at the home of whichever role the account does hold (none: nowhere to point). */
function deniedFor(context: AccessContext): { state: "denied"; homePath?: string } {
  const homePath = homeOf(context);
  return homePath ? { state: "denied", homePath } : { state: "denied" };
}

function profile(
  label: string,
  scopeSummary: string,
  homePath: string,
  navigation: readonly NavigationItem[],
): ShellProfile {
  return Object.freeze({ label, scopeSummary, homePath, navigation });
}

async function load(
  database: DatabaseClient,
  accountId: string,
  now: () => Date,
): Promise<AccessContext | "unavailable" | undefined> {
  try {
    return await readAccessContext(database, accountId, now);
  } catch {
    return "unavailable";
  }
}

export async function resolveParentAccess(
  database: DatabaseClient,
  accountId: string,
  now: () => Date = () => new Date(),
): Promise<AccessResult<ParentAccess>> {
  const context = await load(database, accountId, now);
  if (context === "unavailable") return { state: "unavailable" };
  if (!context) return { state: "signed-out" };
  const link = context.parent;
  const granted =
    link !== undefined &&
    context.grants.some(
      (grant) =>
        grant.role === "parent" &&
        grant.scope.type === "family" &&
        grant.scope.id === link.familyId &&
        grant.scope.organizationId === link.organizationId,
    );
  if (!link || !granted) return deniedFor(context);
  return {
    state: "success",
    data: Object.freeze({
      applicationSession: toSessionContext(accountId, context),
      familyId: link.familyId,
      familyScope: {
        id: link.familyId,
        type: "family" as const,
        organizationId: link.organizationId,
      },
      profile: profile("Szülő", "A család saját feladatai", HOME.parent, PARENT_NAVIGATION),
    }),
  };
}

export async function resolveAdminAccess(
  database: DatabaseClient,
  accountId: string,
  now: () => Date = () => new Date(),
): Promise<AccessResult<AdminAccess>> {
  const context = await load(database, accountId, now);
  if (context === "unavailable") return { state: "unavailable" };
  if (!context) return { state: "signed-out" };
  const superGrant = context.grants.find((grant) => grant.role === "super_admin");
  const groupGrant = context.grants
    .filter((grant) => grant.role === "group_admin")
    .toSorted((a, b) => a.scope.id.localeCompare(b.scope.id))[0];
  const chosen = superGrant ?? groupGrant;
  if (!chosen) return deniedFor(context);
  return {
    state: "success",
    data: Object.freeze({
      applicationSession: toSessionContext(accountId, context),
      scope: chosen.scope,
      profile: superGrant
        ? profile(
            "Szuperadminisztrátor",
            "A szervezet és a szerepkörök kezelése",
            HOME.super_admin,
            SUPER_ADMIN_NAVIGATION,
          )
        : profile(
            "Csoportadminisztrátor",
            "A kijelölt csoportok",
            HOME.group_admin,
            GROUP_ADMIN_NAVIGATION,
          ),
    }),
  };
}

export async function resolveTeacherAccess(
  database: DatabaseClient,
  accountId: string,
  now: () => Date = () => new Date(),
): Promise<AccessResult<TeacherAccess>> {
  const context = await load(database, accountId, now);
  if (context === "unavailable") return { state: "unavailable" };
  if (!context) return { state: "signed-out" };
  if (!context.grants.some((grant) => grant.role === "kindergarten_teacher")) {
    return deniedFor(context);
  }
  return {
    state: "success",
    data: Object.freeze({
      applicationSession: toSessionContext(accountId, context),
      profile: profile(
        "Óvónő",
        "A kijelölt csoportok beosztása, módosítás nélkül",
        HOME.kindergarten_teacher,
        TEACHER_NAVIGATION,
      ),
    }),
  };
}
