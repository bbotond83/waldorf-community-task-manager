import "server-only";

import { cookies } from "next/headers";
import type { SessionContext } from "../../../src/application/index.ts";
import { composeRuntime } from "../../../src/runtime/composition.ts";
import { resolveTeacherAccess } from "../../../src/runtime/production/access.ts";
import {
  resolveSyntheticSession,
  SESSION_COOKIE_NAME,
} from "../../../src/runtime/session/session.ts";
import type { ShellProfile } from "../../../src/runtime/shell-profile.ts";
import { productionRequest } from "../../_identity/production-request.ts";

export type TeacherSession = Readonly<{
  applicationSession: SessionContext;
  profile: ShellProfile;
}>;

export type TeacherSessionResult =
  | { state: "success"; data: TeacherSession }
  | { state: "signed-out" }
  | { state: "denied" }
  | { state: "configuration-error" };

/**
 * The signed-in teacher of this request. In the production mode the granted groups come from the person's
 * role grants in the database; in the synthetic mode they are the invented groups of the demo profile.
 */
export async function resolveTeacherSession(): Promise<TeacherSessionResult> {
  const composition = await composeRuntime();
  if (!composition.ok) return { state: "configuration-error" };
  if (composition.value.mode === "production") return resolveProductionTeacher();

  const cookieStore = await cookies();
  const resolved = resolveSyntheticSession(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!resolved) return { state: "signed-out" };
  if (resolved.profile.role !== "kindergarten-teacher") return { state: "denied" };

  return {
    state: "success",
    data: {
      profile: resolved.profile,
      applicationSession: resolved.actor,
    },
  };
}

async function resolveProductionTeacher(): Promise<TeacherSessionResult> {
  const request = await productionRequest();
  if (request.state === "signed-out") return { state: "signed-out" };
  if (request.state !== "ready") return { state: "configuration-error" };
  const access = await resolveTeacherAccess(request.services.database, request.accountId);
  if (access.state === "success") return access;
  return access.state === "signed-out"
    ? access
    : { state: access.state === "denied" ? "denied" : "configuration-error" };
}
