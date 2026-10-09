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

const parentNavigation: readonly NavigationItem[] = [
  { id: "parent-duties", label: "Feladatok", href: "/szulo/feladatok" },
  { id: "parent-notifications", label: "Értesítések", href: "/szulo/ertesitesek" },
];

// The teacher's only page is Beosztás, so the shell shows no menu for this profile.
const kindergartenTeacherNavigation: readonly NavigationItem[] = [];

// One consistent menu per profile: every page shows exactly this list (no request-time rewrite).
const groupAdminNavigation: readonly NavigationItem[] = [
  { id: "admin-dashboard", label: "Áttekintés", href: "/admin" },
  { id: "admin-records", label: "Nyilvántartások", href: "/admin/nyilvantartasok" },
  { id: "admin-tasks", label: "Feladatok és események", href: "/admin/feladatok" },
  { id: "admin-approvals", label: "Jóváhagyások", href: "/admin/jovahagyasok" },
  { id: "admin-archive", label: "Archívum", href: "/admin/archivum" },
];

const organizationAdminNavigation: readonly NavigationItem[] = [
  ...groupAdminNavigation,
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
    navigation: parentNavigation,
  },
  {
    id: "kindergarten-teacher-local",
    role: "kindergarten-teacher",
    label: "Óvónő",
    scopeSummary: "Egy kitalált csoport beosztása, módosítás nélkül",
    authorizationVersion: 1,
    homePath: "/teacher/schedule",
    navigation: kindergartenTeacherNavigation,
  },
  {
    id: "group-admin-local",
    role: "group-admin",
    label: "Csoportadminisztrátor",
    scopeSummary: "Egy kitalált, kijelölt csoport",
    authorizationVersion: 1,
    homePath: "/admin",
    navigation: groupAdminNavigation,
  },
  {
    id: "super-admin-local",
    role: "super-admin",
    label: "Szuperadminisztrátor",
    scopeSummary: "A kitalált szervezet és szerepkörök kezelése",
    authorizationVersion: 1,
    homePath: "/admin",
    navigation: [...organizationAdminNavigation],
  },
]);

export function getSyntheticProfile(profileId: string): SyntheticProfile | undefined {
  return SYNTHETIC_PROFILES.find((profile) => profile.id === profileId);
}
