import "server-only";

import type { Scope } from "../../src/access/index.ts";
import type { SessionContext } from "../../src/application/index.ts";
import type { ShellProfile } from "../../src/runtime/shell-profile.ts";
import { resolveAdminSession } from "../admin/_lib/session.ts";
import { resolveParentSession } from "../szulo/_lib/session.ts";
import { resolveTeacherSession } from "../teacher/_lib/session.ts";

/** The signed-in person of the information page: every role reads it, so it resolves whichever role the account holds. */
export type InfoActor = Readonly<{
  session: SessionContext;
  scope: Scope;
  profile: ShellProfile;
}>;

/**
 * Resolves the person from the database (nothing the browser sends decides who they are). An administrator comes first,
 * because a group admin holds the group scope that edits their sections; a parent or teacher follows.
 */
export async function resolveInfoActor(): Promise<InfoActor | undefined> {
  const admin = await resolveAdminSession();
  if (admin.state === "success") {
    return {
      session: admin.data.applicationSession,
      scope: admin.data.scope,
      profile: admin.data.profile,
    };
  }
  const teacher = await resolveTeacherSession();
  if (teacher.state === "success") {
    return {
      session: teacher.data.applicationSession,
      scope: teacher.data.scope,
      profile: teacher.data.profile,
    };
  }
  const parent = await resolveParentSession();
  if (parent.state === "success") {
    return {
      session: parent.data.applicationSession,
      scope: parent.data.familyScope,
      profile: parent.data.profile,
    };
  }
  return undefined;
}
