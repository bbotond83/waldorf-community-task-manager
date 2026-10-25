import type { Role } from "../../src/access/index.ts";
import type { NavigationItem } from "../../src/application/index.ts";
import type { ShellProfile } from "../../src/runtime/shell-profile.ts";
import {
  GROUP_ADMIN_NAVIGATION,
  PARENT_NAVIGATION,
  SUPER_ADMIN_NAVIGATION,
  TEACHER_NAVIGATION,
} from "../../src/runtime/navigation.ts";

/**
 * The four roles of the application with the page each one lands on and the menu it sees, for the tests that
 * check navigation and access rules over every role. The data is the production navigation of
 * `src/runtime/navigation.ts`; only the page each role lands on is written here, as the contract under test.
 */
export type RoleProfile = Readonly<{
  id: "parent" | "teacher" | "group-admin" | "super-admin";
  role: Role;
  homePath: string;
  navigation: readonly NavigationItem[];
}>;

export const ROLE_PROFILES: readonly RoleProfile[] = Object.freeze([
  { id: "parent", role: "parent", homePath: "/szulo/ertesitesek", navigation: PARENT_NAVIGATION },
  {
    id: "teacher",
    role: "kindergarten_teacher",
    homePath: "/teacher/schedule",
    navigation: TEACHER_NAVIGATION,
  },
  {
    id: "group-admin",
    role: "group_admin",
    homePath: "/admin",
    navigation: GROUP_ADMIN_NAVIGATION,
  },
  {
    id: "super-admin",
    role: "super_admin",
    homePath: "/admin",
    navigation: SUPER_ADMIN_NAVIGATION,
  },
]);

export function roleProfile(id: RoleProfile["id"]): RoleProfile {
  return ROLE_PROFILES.find((profile) => profile.id === id)!;
}

/** The label and one-line scope each role shows in the page shell (the text of `resolve*Access`). */
const SHELL_TEXT: Record<RoleProfile["id"], { label: string; scopeSummary: string }> = {
  parent: { label: "Szülő", scopeSummary: "A család saját feladatai" },
  teacher: {
    label: "Óvónő",
    scopeSummary: "A kijelölt csoportok beosztása, módosítás nélkül",
  },
  "group-admin": { label: "Csoportadminisztrátor", scopeSummary: "A kijelölt csoportok" },
  "super-admin": {
    label: "Szuperadminisztrátor",
    scopeSummary: "A szervezet és a szerepkörök kezelése",
  },
};

/** What the page shell takes for a role: label, scope line, home page and menu. */
export function shellProfile(id: RoleProfile["id"]): ShellProfile {
  const profile = roleProfile(id);
  return {
    ...SHELL_TEXT[id],
    homePath: profile.homePath,
    navigation: profile.navigation,
  };
}
