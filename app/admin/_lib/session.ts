import "server-only";

import { cookies } from "next/headers";
import type { Role, Scope } from "../../../src/access/index.ts";
import type { SessionContext as ApplicationSession } from "../../../src/application/index.ts";
import { composeRuntime } from "../../../src/runtime/composition.ts";
import {
  resolveSyntheticSession,
  SESSION_COOKIE_NAME,
} from "../../../src/runtime/session/session.ts";
import type { SyntheticProfile } from "../../../src/runtime/synthetic/profiles.ts";
import { isSyntheticAdvancedSubjectRevoked } from "../../../src/admin-advanced/index.ts";

const SYNTHETIC_ORGANIZATION_ID = "org-napsugar";

export type AdminSession = Readonly<{
  applicationSession: ApplicationSession;
  profile: SyntheticProfile;
  scope: Scope;
}>;

export type AdminSessionResult =
  | { state: "success"; data: AdminSession }
  | { state: "signed-out" }
  | { state: "denied" }
  | { state: "configuration-error"; message: string };

const ROLE_BY_PROFILE: Readonly<Record<SyntheticProfile["role"], Role>> = {
  parent: "parent",
  staff: "read_only_staff",
  "group-admin": "group_admin",
  "kindergarten-admin": "kindergarten_admin",
  "super-admin": "super_admin",
};

export async function resolveAdminSession(): Promise<AdminSessionResult> {
  const composition = await composeRuntime();
  if (!composition.ok) {
    return { state: "configuration-error", message: composition.error.message };
  }
  if (composition.value.mode !== "synthetic") return { state: "denied" };

  const cookieStore = await cookies();
  const session = resolveSyntheticSession(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!session) return { state: "signed-out" };
  if (isSyntheticAdvancedSubjectRevoked(session.profile.id)) return { state: "denied" };

  const role = ROLE_BY_PROFILE[session.profile.role];
  if (!isAdministrator(role)) return { state: "denied" };

  const scope = scopeForProfile(session.profile);
  return {
    state: "success",
    data: {
      profile: withCoreNavigation(session.profile),
      scope,
      applicationSession: {
        subjectId: session.profile.id,
        authorizationVersion: session.authorizationVersion,
        roles: [role],
        scopes: [scope],
        runtimeMode: "synthetic",
        isSynthetic: true,
      },
    },
  };
}

function isAdministrator(role: Role): role is "group_admin" | "kindergarten_admin" | "super_admin" {
  return role === "group_admin" || role === "kindergarten_admin" || role === "super_admin";
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

function withCoreNavigation(profile: SyntheticProfile): SyntheticProfile {
  const coreItems = [
    { id: "admin-dashboard", label: "Áttekintés", href: "/admin" },
    { id: "admin-records", label: "Nyilvántartások", href: "/admin/nyilvantartasok" },
    { id: "admin-tasks", label: "Feladatok és események", href: "/admin/feladatok" },
    { id: "admin-approvals", label: "Jóváhagyások", href: "/admin/jovahagyasok" },
    { id: "admin-archive", label: "Archívum", href: "/admin/archivum" },
  ] as const;
  const advancedItems = profile.navigation.filter(
    (item) => !coreItems.some((coreItem) => coreItem.id === item.id),
  );
  return { ...profile, navigation: [...coreItems, ...advancedItems] };
}
