import "server-only";

import type { Scope } from "../../src/access/index.ts";
import type { SessionContext } from "../../src/application/index.ts";
import { resolveAdminSession } from "../admin/_lib/session.ts";
import { resolveParentSession } from "../szulo/_lib/session.ts";
import { resolveTeacherSession } from "../teacher/_lib/session.ts";

/**
 * The three areas that show the library: the parent pages (also a group admin's), the teacher pages, and the admin pages,
 * which a super admin without a parent record of their own uses.
 */
export type LibraryArea = "szulo" | "teacher" | "admin";

export const LIBRARY_BASE_PATH: Readonly<Record<LibraryArea, string>> = Object.freeze({
  szulo: "/szulo/konyvtar",
  teacher: "/teacher/konyvtar",
  admin: "/admin/konyvtar",
});

/** The signed-in person of a library page: the session and the scope the area reads and writes with. */
export type LibraryActor = Readonly<{
  area: LibraryArea;
  session: SessionContext;
  scope: Scope;
  basePath: string;
}>;

export function isLibraryArea(value: unknown): value is LibraryArea {
  return value === "szulo" || value === "teacher" || value === "admin";
}

/** Resolves the person of one area from the database; nothing the browser sends decides who the person is. */
export async function resolveLibraryActor(area: LibraryArea): Promise<LibraryActor | undefined> {
  const basePath = LIBRARY_BASE_PATH[area];
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
