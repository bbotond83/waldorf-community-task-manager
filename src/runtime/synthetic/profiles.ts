import { z } from "zod";
import type { NavigationItem } from "../../application/index.ts";

export const syntheticProfileIdSchema = z.enum([
  "parent-local",
  "kindergarten-teacher-local",
  "group-admin-local",
  "super-admin-local",
]);

export type SyntheticProfileId = z.infer<typeof syntheticProfileIdSchema>;

export type { NavigationItem } from "../../application/index.ts";

export type SyntheticProfile = {
  id: SyntheticProfileId;
  role: "parent" | "kindergarten-teacher" | "group-admin" | "super-admin";
  label: string;
  scopeSummary: string;
  authorizationVersion: number;
  homePath: string;
  navigation: readonly NavigationItem[];
};

export const PARENT_NAVIGATION: readonly NavigationItem[] = [
  { id: "parent-notifications", label: "Értesítések", href: "/szulo/ertesitesek" },
  { id: "parent-duties", label: "Feladatok", href: "/szulo/feladatok" },
  { id: "parent-swaps", label: "Cserék", href: "/szulo/cserek" },
];

// The teacher's only page is Beosztás, so the shell shows no menu for this profile.
export const TEACHER_NAVIGATION: readonly NavigationItem[] = [];

// One consistent menu per profile: every page shows exactly this list (no request-time rewrite).
export const GROUP_ADMIN_NAVIGATION: readonly NavigationItem[] = [
  { id: "admin-dashboard", label: "Áttekintés", href: "/admin" },
  { id: "admin-records", label: "Nyilvántartások", href: "/admin/nyilvantartasok" },
  { id: "admin-tasks", label: "Feladatok és események", href: "/admin/feladatok" },
  { id: "admin-approvals", label: "Jóváhagyások", href: "/admin/jovahagyasok" },
  { id: "admin-archive", label: "Archívum", href: "/admin/archivum" },
];

export const SUPER_ADMIN_NAVIGATION: readonly NavigationItem[] = [
  ...GROUP_ADMIN_NAVIGATION,
  { id: "admin-import", label: "Importálás", href: "/admin/import" },
  { id: "admin-reminders", label: "Emlékeztetők", href: "/admin/emlekeztetok" },
  { id: "admin-privacy", label: "Adatvédelem", href: "/admin/adatvedelem" },
  { id: "admin-settings", label: "Beállítások", href: "/admin/beallitasok" },
];

export const SYNTHETIC_PROFILES: readonly SyntheticProfile[] = Object.freeze([
  {
    id: "parent-local",
    role: "parent",
    label: "Szülő",
    scopeSummary: "Egy kitalált család saját feladatai",
    authorizationVersion: 1,
    homePath: "/szulo/ertesitesek",
    navigation: PARENT_NAVIGATION,
  },
  {
    id: "kindergarten-teacher-local",
    role: "kindergarten-teacher",
    label: "Óvónő",
    scopeSummary: "Egy kitalált csoport beosztása, módosítás nélkül",
    authorizationVersion: 1,
    homePath: "/teacher/schedule",
    navigation: TEACHER_NAVIGATION,
  },
  {
    id: "group-admin-local",
    role: "group-admin",
    label: "Csoportadminisztrátor",
    scopeSummary: "Egy kitalált, kijelölt csoport",
    authorizationVersion: 1,
    homePath: "/admin",
    navigation: GROUP_ADMIN_NAVIGATION,
  },
  {
    id: "super-admin-local",
    role: "super-admin",
    label: "Szuperadminisztrátor",
    scopeSummary: "A kitalált szervezet és szerepkörök kezelése",
    authorizationVersion: 1,
    homePath: "/admin",
    navigation: [...SUPER_ADMIN_NAVIGATION],
  },
]);

export function getSyntheticProfile(profileId: string): SyntheticProfile | undefined {
  return SYNTHETIC_PROFILES.find((profile) => profile.id === profileId);
}
