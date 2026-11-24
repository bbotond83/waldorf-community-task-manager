import type { NavigationItem } from "../application/index.ts";

/**
 * The menu each role sees, one consistent list per role: every page of the role shows exactly this list (no
 * request-time rewrite).
 */
export const PARENT_NAVIGATION: readonly NavigationItem[] = [
  { id: "parent-notifications", label: "Értesítések", href: "/szulo/ertesitesek" },
  { id: "parent-duties", label: "Feladatok", href: "/szulo/feladatok" },
  { id: "parent-rota", label: "Beosztás", href: "/szulo/beosztas" },
  { id: "parent-swaps", label: "Cserék", href: "/szulo/cserek" },
  { id: "parent-working-groups", label: "Munkacsoportok", href: "/szulo/munkacsoportok" },
  { id: "parent-recurring", label: "Ismétlődők", href: "/szulo/ismetlodo" },
  { id: "parent-events", label: "Események", href: "/szulo/esemenyek" },
  { id: "parent-library", label: "Könyvtár", href: "/szulo/konyvtar" },
  { id: "parent-animal-care", label: "Állatgondozás", href: "/szulo/allatok" },
  { id: "parent-information", label: "Információ", href: "/informacio" },
  { id: "parent-directory", label: "Szülők", href: "/szulo/szulok" },
  { id: "parent-account", label: "Fiókom", href: "/szulo/fiokom" },
];

export const TEACHER_NAVIGATION: readonly NavigationItem[] = [
  { id: "teacher-schedule", label: "Beosztás", href: "/teacher/schedule" },
  // "Beosztás" stays the task schedule; the indoor-cleaning rota has its own short name so the two never read alike.
  { id: "teacher-rota", label: "Takarítás", href: "/teacher/beosztas" },
  { id: "teacher-working-groups", label: "Munkacsoportok", href: "/teacher/munkacsoportok" },
  { id: "teacher-events", label: "Események", href: "/teacher/esemenyek" },
  { id: "teacher-library", label: "Könyvtár", href: "/teacher/konyvtar" },
  { id: "teacher-animal-care", label: "Állatgondozás", href: "/teacher/allatok" },
  { id: "teacher-information", label: "Információ", href: "/informacio" },
  { id: "teacher-directory", label: "Szülők", href: "/teacher/szulok" },
];

export const GROUP_ADMIN_NAVIGATION: readonly NavigationItem[] = [
  { id: "admin-dashboard", label: "Áttekintés", href: "/admin" },
  { id: "admin-tasks", label: "Feladatok és események", href: "/admin/feladatok" },
  { id: "admin-approvals", label: "Jóváhagyások", href: "/admin/jovahagyasok" },
  { id: "admin-swaps", label: "Cserék", href: "/admin/cserek" },
  { id: "admin-archive", label: "Archívum", href: "/admin/archivum" },
  { id: "admin-working-groups", label: "Munkacsoportok", href: "/admin/munkacsoportok" },
  { id: "admin-events", label: "Események", href: "/admin/esemenyek" },
  // The personal recurring-duty page is the parent page: a group admin is also a parent, who marks duties done there.
  { id: "admin-recurring", label: "Ismétlődők", href: "/szulo/ismetlodo" },
  // The library is the parent page: an admin is also a parent of a family, who borrows and adds books there.
  { id: "admin-library", label: "Könyvtár", href: "/szulo/konyvtar" },
  // The sign-up page is the parent page: a group admin is also a parent of a family, who signs up there.
  { id: "admin-animal-care", label: "Állatgondozás", href: "/szulo/allatok" },
  { id: "admin-information", label: "Információ", href: "/informacio" },
  // The overview is the parent page: a group admin is also a parent of a family, who reads it there (BR24.1).
  { id: "admin-rota-overview", label: "Beosztás", href: "/szulo/beosztas" },
  // The directory is the parent page, which every signed-in role opens (BR30.1). "Fiókom" is the parent's own page.
  { id: "admin-directory", label: "Szülők", href: "/szulo/szulok" },
];

export const SUPER_ADMIN_NAVIGATION: readonly NavigationItem[] = [
  { id: "admin-dashboard", label: "Áttekintés", href: "/admin" },
  { id: "admin-records", label: "Nyilvántartások", href: "/admin/nyilvantartasok" },
  { id: "admin-tasks", label: "Feladatok és események", href: "/admin/feladatok" },
  { id: "admin-approvals", label: "Jóváhagyások", href: "/admin/jovahagyasok" },
  { id: "admin-swaps", label: "Cserék", href: "/admin/cserek" },
  { id: "admin-archive", label: "Archívum", href: "/admin/archivum" },
  { id: "admin-working-groups", label: "Munkacsoportok", href: "/admin/munkacsoportok" },
  { id: "admin-events", label: "Események", href: "/admin/esemenyek" },
  { id: "admin-templates", label: "Sablonok", href: "/admin/sablonok" },
  { id: "admin-library", label: "Könyvtár", href: "/admin/konyvtar" },
  { id: "admin-animal-care", label: "Állatgondozás", href: "/admin/allatgondozas" },
  { id: "admin-information", label: "Információ", href: "/informacio" },
  { id: "admin-school-year", label: "Tanév", href: "/admin/tanev" },
  { id: "admin-rota", label: "Beosztás", href: "/admin/beosztas" },
  { id: "admin-directory", label: "Szülők", href: "/admin/szulok" },
  { id: "admin-reminders", label: "Kézbesítési hibák", href: "/admin/emlekeztetok" },
  { id: "admin-privacy", label: "Adatvédelem", href: "/admin/adatvedelem" },
  { id: "admin-settings", label: "Beállítások", href: "/admin/beallitasok" },
];
