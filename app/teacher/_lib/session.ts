import "server-only";

import type { Scope } from "../../../src/access/index.ts";
import type { SessionContext } from "../../../src/application/index.ts";
import { resolveTeacherAccess } from "../../../src/runtime/production/access.ts";
import type { ShellProfile } from "../../../src/runtime/shell-profile.ts";
import { productionRequest } from "../../_identity/production-request.ts";

export type TeacherSession = Readonly<{
  applicationSession: SessionContext;
  scope: Scope;
  profile: ShellProfile;
}>;

export type TeacherSessionResult =
  | { state: "success"; data: TeacherSession }
  | { state: "signed-out" }
  | { state: "denied" }
  | { state: "configuration-error" };

/**
 * The signed-in teacher of this request: the community comes from the person's role grant in the database.
 */
export async function resolveTeacherSession(): Promise<TeacherSessionResult> {
  const request = await productionRequest();
  if (request.state === "signed-out") return { state: "signed-out" };
  if (request.state !== "ready") return { state: "configuration-error" };
  const access = await resolveTeacherAccess(request.services.database, request.accountId);
  if (access.state === "success") return access;
  return access.state === "signed-out"
    ? access
    : { state: access.state === "denied" ? "denied" : "configuration-error" };
}
