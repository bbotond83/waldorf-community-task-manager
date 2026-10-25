import "server-only";

import type { Scope } from "../../../src/access/index.ts";
import type { SessionContext } from "../../../src/application/index.ts";
import { resolveParentAccess } from "../../../src/runtime/production/access.ts";
import type { ShellProfile } from "../../../src/runtime/shell-profile.ts";
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
 * The signed-in parent of this request: the family comes from the database, from the Parent linked to the
 * signed-in account (FR2.8, BR32.2).
 */
export async function resolveParentSession(): Promise<ParentSessionResult> {
  const request = await productionRequest();
  if (request.state === "signed-out") return { state: "signed-out" };
  if (request.state !== "ready") return { state: "configuration-error" };
  const access = await resolveParentAccess(request.services.database, request.accountId);
  return access.state === "unavailable" ? { state: "configuration-error" } : access;
}
