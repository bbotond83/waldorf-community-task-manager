import "server-only";

import type { Scope } from "../../src/access/index.ts";
import type { SessionContext } from "../../src/application/index.ts";
import { resolveAdminSession } from "../admin/_lib/session.ts";
import { resolveParentSession } from "../szulo/_lib/session.ts";
import { resolveTeacherSession } from "../teacher/_lib/session.ts";

/** The three areas that show events: the parent pages (also a coordinator's), the teacher pages and the admin pages. */
export type EventArea = "szulo" | "teacher" | "admin";

export const EVENT_BASE_PATH: Readonly<Record<EventArea, string>> = Object.freeze({
  szulo: "/szulo/esemenyek",
  teacher: "/teacher/esemenyek",
  admin: "/admin/esemenyek",
});

/** The signed-in person of an events page: the session, the scope the area reads with, and (parent area) the family. */
export type EventActor = Readonly<{
  area: EventArea;
  session: SessionContext;
  scope: Scope;
  basePath: string;
}>;

export function isEventArea(value: unknown): value is EventArea {
  return value === "szulo" || value === "teacher" || value === "admin";
}

/** Resolves the person of one area from the database; nothing the browser sends decides who the person is. */
export async function resolveEventActor(area: EventArea): Promise<EventActor | undefined> {
  const basePath = EVENT_BASE_PATH[area];
  if (area === "szulo") {
    const result = await resolveParentSession();
    return result.state === "success"
      ? { area, basePath, session: result.data.applicationSession, scope: result.data.familyScope }
      : undefined;
  }
  if (area === "teacher") {
    const result = await resolveTeacherSession();
    return result.state === "success"
      ? { area, basePath, session: result.data.applicationSession, scope: result.data.scope }
      : undefined;
  }
  const result = await resolveAdminSession();
  return result.state === "success"
    ? { area, basePath, session: result.data.applicationSession, scope: result.data.scope }
    : undefined;
}
