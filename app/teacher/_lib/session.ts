import "server-only";

import { cookies } from "next/headers";
import type { SessionContext } from "../../../src/application/index.ts";
import { composeRuntime } from "../../../src/runtime/composition.ts";
import {
  resolveSyntheticSession,
  SESSION_COOKIE_NAME,
} from "../../../src/runtime/session/session.ts";
import type { SyntheticProfile } from "../../../src/runtime/synthetic/profiles.ts";

export type TeacherSession = Readonly<{
  applicationSession: SessionContext;
  profile: SyntheticProfile;
}>;

export type TeacherSessionResult =
  | { state: "success"; data: TeacherSession }
  | { state: "signed-out" }
  | { state: "denied" }
  | { state: "configuration-error" };

export async function resolveTeacherSession(): Promise<TeacherSessionResult> {
  const composition = await composeRuntime();
  if (!composition.ok) return { state: "configuration-error" };
  if (composition.value.mode !== "synthetic") return { state: "denied" };

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
