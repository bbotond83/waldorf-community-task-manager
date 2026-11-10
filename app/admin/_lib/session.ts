import "server-only";

import type { Scope } from "../../../src/access/index.ts";
import type { SessionContext as ApplicationSession } from "../../../src/application/index.ts";
import { resolveAdminAccess } from "../../../src/runtime/production/access.ts";
import type { ShellProfile } from "../../../src/runtime/shell-profile.ts";
import { productionRequest } from "../../_identity/production-request.ts";

export type AdminSession = Readonly<{
  applicationSession: ApplicationSession;
  profile: ShellProfile;
  scope: Scope;
  /** Empty for a super admin; otherwise every working group the person administers. */
  groupIds: readonly string[];
}>;

export type AdminSessionResult =
  | { state: "success"; data: AdminSession }
  | { state: "signed-out" }
  | { state: "denied"; homePath?: string }
  | { state: "configuration-error"; message: string };

const UNAVAILABLE = "A kapcsolat most nem érhető el.";

/**
 * The signed-in admin of this request: the reach (the whole organization for a super admin, a group for a
 * group admin) comes from the person's role grants in the database.
 */
export async function resolveAdminSession(): Promise<AdminSessionResult> {
  const request = await productionRequest();
  if (request.state === "signed-out") return { state: "signed-out" };
  if (request.state !== "ready") return { state: "configuration-error", message: UNAVAILABLE };
  const access = await resolveAdminAccess(request.services.database, request.accountId);
  if (access.state === "unavailable") {
    return { state: "configuration-error", message: UNAVAILABLE };
  }
  return access;
}
