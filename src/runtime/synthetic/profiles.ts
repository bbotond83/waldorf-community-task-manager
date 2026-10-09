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

const kindergartenTeacherNavigation: readonly NavigationItem[] = [
  { id: "teacher-tracking", label: "Beosztás", href: "/teacher/schedule" },
];

const groupAdminNavigation: readonly NavigationItem[] = [
  { id: "admin-dashboard", label: "Áttekintés", href: "/admin" },
  { id: "admin-tasks", label: "Feladatok", href: "/admin/feladatok" },
  { id: "admin-approvals", label: "Jóváhagyások", href: "/admin/jovahagyasok" },
];

const organizationAdminNavigation: readonly NavigationItem[] = [
  ...groupAdminNavigation,
  { id: "admin-records", label: "Nyilvántartások", href: "/admin/nyilvantartasok" },
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
    homePath: "/szulo/feladatok",
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
