import "server-only";

import { cookies } from "next/headers";
import type { Scope } from "../../../src/access/index.ts";
import type { SessionContext } from "../../../src/application/index.ts";
import { composeRuntime } from "../../../src/runtime/composition.ts";
import {
  resolveSyntheticSession,
  SESSION_COOKIE_NAME,
} from "../../../src/runtime/session/session.ts";
import type { SyntheticProfile } from "../../../src/runtime/synthetic/profiles.ts";
import { PARENT_FAMILY_SCOPE } from "../../../src/parent-web/index.ts";

export type ParentSession = Readonly<{
  applicationSession: SessionContext;
  profile: SyntheticProfile;
  familyScope: Scope;
  familyId: string;
}>;

export type ParentSessionResult =
  | { state: "success"; data: ParentSession }
  | { state: "signed-out" }
  | { state: "denied" }
  | { state: "configuration-error" };

export async function resolveParentSession(): Promise<ParentSessionResult> {
  const composition = await composeRuntime();
  if (!composition.ok) return { state: "configuration-error" };
  if (composition.value.mode !== "synthetic") return { state: "denied" };

  const cookieStore = await cookies();
  const resolved = resolveSyntheticSession(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!resolved) return { state: "signed-out" };
  if (resolved.profile.role !== "parent") return { state: "denied" };

  return {
    state: "success",
    data: {
      profile: resolved.profile,
      familyId: PARENT_FAMILY_SCOPE.id,
      familyScope: PARENT_FAMILY_SCOPE,
      applicationSession: {
        subjectId: resolved.profile.id,
        authorizationVersion: resolved.authorizationVersion,
        roles: ["parent"],
        scopes: [PARENT_FAMILY_SCOPE],
        runtimeMode: "synthetic",
        isSynthetic: true,
      },
    },
  };
}
