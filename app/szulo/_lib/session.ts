import "server-only";

import { cookies } from "next/headers";
import type { Scope } from "../../../src/access/index.ts";
import type { SessionContext } from "../../../src/application/index.ts";
import { composeRuntime } from "../../../src/runtime/composition.ts";
import { resolveParentAccess } from "../../../src/runtime/production/access.ts";
import {
  resolveSyntheticSession,
  SESSION_COOKIE_NAME,
} from "../../../src/runtime/session/session.ts";
import type { ShellProfile } from "../../../src/runtime/shell-profile.ts";
import { PARENT_FAMILY_SCOPE } from "../../../src/parent-web/index.ts";
import { productionRequest } from "../../_identity/production-request.ts";

export type ParentSession = Readonly<{
  applicationSession: SessionContext;
  profile: ShellProfile;
  familyScope: Scope;
  familyId: string;
}>;

export type ParentSessionResult =
  | { state: "success"; data: ParentSession }
  | { state: "signed-out" }
  | { state: "denied"; homePath?: string }
  | { state: "configuration-error" };

/**
 * The signed-in parent of this request. In the production mode the family comes from the database, from the
 * Parent linked to the signed-in account (FR2.8, BR32.2); in the synthetic mode it is the invented family of
 * the demo profile, as before.
 */
export async function resolveParentSession(): Promise<ParentSessionResult> {
  const composition = await composeRuntime();
  if (!composition.ok) return { state: "configuration-error" };
  if (composition.value.mode === "production") return resolveProductionParent();

  const cookieStore = await cookies();
  const resolved = resolveSyntheticSession(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!resolved) return { state: "signed-out" };
  if (resolved.profile.role !== "parent") {
    return { state: "denied", homePath: resolved.profile.homePath };
  }

  return {
    state: "success",
    data: {
      profile: resolved.profile,
      familyId: PARENT_FAMILY_SCOPE.id,
      familyScope: PARENT_FAMILY_SCOPE,
      applicationSession: resolved.actor,
    },
  };
}

async function resolveProductionParent(): Promise<ParentSessionResult> {
  const request = await productionRequest();
  if (request.state === "signed-out") return { state: "signed-out" };
  if (request.state !== "ready") return { state: "configuration-error" };
  const access = await resolveParentAccess(request.services.database, request.accountId);
  return access.state === "unavailable" ? { state: "configuration-error" } : access;
}
