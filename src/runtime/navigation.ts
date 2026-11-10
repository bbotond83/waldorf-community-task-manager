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
];

export const TEACHER_NAVIGATION: readonly NavigationItem[] = [
  { id: "teacher-schedule", label: "Beosztás", href: "/teacher/schedule" },
  // "Beosztás" stays the task schedule; the indoor-cleaning rota has its own short name so the two never read alike.
  { id: "teacher-rota", label: "Takarítás", href: "/teacher/beosztas" },
  { id: "teacher-working-groups", label: "Munkacsoportok", href: "/teacher/munkacsoportok" },
];

export const GROUP_ADMIN_NAVIGATION: readonly NavigationItem[] = [
  { id: "admin-dashboard", label: "Áttekintés", href: "/admin" },
  { id: "admin-tasks", label: "Feladatok és események", href: "/admin/feladatok" },
  { id: "admin-approvals", label: "Jóváhagyások", href: "/admin/jovahagyasok" },
  { id: "admin-archive", label: "Archívum", href: "/admin/archivum" },
  { id: "admin-working-groups", label: "Munkacsoportok", href: "/admin/munkacsoportok" },
  // The overview is the parent page: a group admin is also a parent of a family, who reads it there (BR24.1).
  { id: "admin-rota-overview", label: "Beosztás", href: "/szulo/beosztas" },
];

export const SUPER_ADMIN_NAVIGATION: readonly NavigationItem[] = [
  { id: "admin-dashboard", label: "Áttekintés", href: "/admin" },
  { id: "admin-records", label: "Nyilvántartások", href: "/admin/nyilvantartasok" },
  { id: "admin-tasks", label: "Feladatok és események", href: "/admin/feladatok" },
  { id: "admin-approvals", label: "Jóváhagyások", href: "/admin/jovahagyasok" },
  { id: "admin-archive", label: "Archívum", href: "/admin/archivum" },
  { id: "admin-working-groups", label: "Munkacsoportok", href: "/admin/munkacsoportok" },
  { id: "admin-school-year", label: "Tanév", href: "/admin/tanev" },
  { id: "admin-rota", label: "Beosztás", href: "/admin/beosztas" },
  { id: "admin-reminders", label: "Emlékeztetők", href: "/admin/emlekeztetok" },
  { id: "admin-privacy", label: "Adatvédelem", href: "/admin/adatvedelem" },
  { id: "admin-settings", label: "Beállítások", href: "/admin/beallitasok" },
];
