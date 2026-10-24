import "server-only";

import { cookies } from "next/headers";
import type { Role, Scope } from "../../../src/access/index.ts";
import type { SessionContext as ApplicationSession } from "../../../src/application/index.ts";
import { composeRuntime } from "../../../src/runtime/composition.ts";
import { resolveAdminAccess } from "../../../src/runtime/production/access.ts";
import {
  resolveSyntheticSession,
  SESSION_COOKIE_NAME,
} from "../../../src/runtime/session/session.ts";
import type { ShellProfile } from "../../../src/runtime/shell-profile.ts";
import type { SyntheticProfile } from "../../../src/runtime/synthetic/profiles.ts";
import { isSyntheticAdvancedSubjectRevoked } from "../../../src/admin-advanced/index.ts";
import { productionRequest } from "../../_identity/production-request.ts";

const SYNTHETIC_ORGANIZATION_ID = "org-napsugar";

export type AdminSession = Readonly<{
  applicationSession: ApplicationSession;
  profile: ShellProfile;
  scope: Scope;
}>;

export type AdminSessionResult =
  | { state: "success"; data: AdminSession }
  | { state: "signed-out" }
  | { state: "denied"; homePath?: string }
  | { state: "configuration-error"; message: string };

const ROLE_BY_PROFILE: Readonly<Record<SyntheticProfile["role"], Role>> = {
  parent: "parent",
  "kindergarten-teacher": "kindergarten_teacher",
  "group-admin": "group_admin",
  "super-admin": "super_admin",
};

/**
 * The signed-in admin of this request. In the production mode the reach (the whole organization for a super
 * admin, a group for a group admin) comes from the person's role grants in the database; in the synthetic
 * mode it is the invented scope of the demo profile, as before.
 */
export async function resolveAdminSession(): Promise<AdminSessionResult> {
  const composition = await composeRuntime();
  if (!composition.ok) {
    return { state: "configuration-error", message: composition.error.message };
  }
  if (composition.value.mode === "production") return resolveProductionAdmin();

  const cookieStore = await cookies();
  const session = resolveSyntheticSession(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!session) return { state: "signed-out" };
  if (isSyntheticAdvancedSubjectRevoked(session.profile.id)) {
    return { state: "denied", homePath: session.profile.homePath };
  }

  const role = ROLE_BY_PROFILE[session.profile.role];
  if (!isAdministrator(role)) return { state: "denied", homePath: session.profile.homePath };

  const scope = scopeForProfile(session.profile);
  return {
    state: "success",
    data: {
      profile: session.profile,
      scope,
      applicationSession: session.actor,
    },
  };
}

async function resolveProductionAdmin(): Promise<AdminSessionResult> {
  const request = await productionRequest();
  if (request.state === "signed-out") return { state: "signed-out" };
  if (request.state !== "ready") {
    return { state: "configuration-error", message: "A kapcsolat most nem érhető el." };
  }
  const access = await resolveAdminAccess(request.services.database, request.accountId);
  if (access.state === "unavailable") {
    return { state: "configuration-error", message: "A kapcsolat most nem érhető el." };
  }
  return access;
}

function isAdministrator(role: Role): role is "group_admin" | "super_admin" {
  return role === "group_admin" || role === "super_admin";
}

function scopeForProfile(profile: SyntheticProfile): Scope {
  if (profile.role === "group-admin") {
    return { id: "group-boroka", type: "group", organizationId: SYNTHETIC_ORGANIZATION_ID };
  }
  return {
    id: SYNTHETIC_ORGANIZATION_ID,
    type: "organization",
    organizationId: SYNTHETIC_ORGANIZATION_ID,
  };
}
