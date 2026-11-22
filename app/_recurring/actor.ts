import "server-only";

import type { Scope } from "../../src/access/index.ts";
import type { SessionContext } from "../../src/application/index.ts";
import { resolveAdminSession } from "../admin/_lib/session.ts";
import { resolveParentSession } from "../szulo/_lib/session.ts";
import { resolveTeacherSession } from "../teacher/_lib/session.ts";

/** The pages of recurring duties for a parent (also a coordinator who is a parent) and for the admin area. */
export const RECURRING_BASE_PATH = Object.freeze({
  szulo: "/szulo/ismetlodo",
  admin: "/admin/ismetlodo",
});

/**
 * The three areas that show a working group's recurring page: the parent pages (also a coordinator's), the teacher
 * pages (read only) and the admin pages. The forms live in the parent and admin areas.
 */
export type RecurringArea = "szulo" | "teacher" | "admin";

/** The signed-in person of a recurring page: the session and the scope the area reads with. */
export type RecurringActor = Readonly<{
  area: RecurringArea;
  session: SessionContext;
  scope: Scope;
}>;

/** The address of a working group's recurring page in an area. */
export const groupRecurringPath = (area: RecurringArea, groupId: string): string =>
  `/${area}/munkacsoportok/${groupId}/ismetlodo`;

/** Resolves the person of one area from the database; nothing the browser sends decides who the person is. */
export async function resolveRecurringActor(
  area: RecurringArea,
): Promise<RecurringActor | undefined> {
  if (area === "szulo") {
    const result = await resolveParentSession();
    return result.state === "success"
      ? { area, session: result.data.applicationSession, scope: result.data.familyScope }
      : undefined;
  }
  if (area === "teacher") {
    const result = await resolveTeacherSession();
    return result.state === "success"
      ? { area, session: result.data.applicationSession, scope: result.data.scope }
      : undefined;
  }
  const result = await resolveAdminSession();
  return result.state === "success"
    ? { area, session: result.data.applicationSession, scope: result.data.scope }
    : undefined;
}

/** A parent who marks a duty done or takes the mark back: the family scope comes from the database. */
export type RecurringParent = Readonly<{ session: SessionContext; scope: Scope }>;

/**
 * A coordinator or super admin who keeps schedules and skips occurrences. A coordinator holds the group-admin grant
 * for each of their groups, so a command on a group names that group's scope; a super admin's scope is the whole
 * community. A group that is not one of the coordinator's has no scope, and the command is refused before the database.
 */
export type RecurringManager = Readonly<{
  session: SessionContext;
  isSuperAdmin: boolean;
  scopeFor(groupId?: string): Scope | undefined;
}>;

export async function resolveRecurringParent(): Promise<RecurringParent | undefined> {
  const result = await resolveParentSession();
  return result.state === "success"
    ? { session: result.data.applicationSession, scope: result.data.familyScope }
    : undefined;
}

export async function resolveRecurringManager(): Promise<RecurringManager | undefined> {
  const result = await resolveAdminSession();
  if (result.state !== "success") return undefined;
  const { applicationSession, scope, groupIds } = result.data;
  const isSuperAdmin = groupIds.length === 0;
  return {
    session: applicationSession,
    isSuperAdmin,
    scopeFor(groupId) {
      if (isSuperAdmin) return scope;
      if (groupId === undefined || !groupIds.includes(groupId)) return undefined;
      return { id: groupId, type: "group", organizationId: scope.organizationId };
    },
  };
}
