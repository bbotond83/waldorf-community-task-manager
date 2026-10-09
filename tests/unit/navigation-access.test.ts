import { describe, expect, it } from "vitest";
import type { Role } from "../../src/access/index.ts";
import { AUTHORIZATION_MATRIX } from "../../src/application/index.ts";
import { SYNTHETIC_PROFILES, type SyntheticProfile } from "../../src/runtime/synthetic/profiles.ts";

// The authorization resource each page needs (the page guards use the same resources).
const RESOURCE_BY_ROUTE: Readonly<Record<string, string>> = {
  "/szulo/feladatok": "assignment",
  "/szulo/ertesitesek": "notification",
  "/teacher/schedule": "schedule",
  "/admin": "dashboard",
  "/admin/nyilvantartasok": "record",
  "/admin/feladatok": "task",
  "/admin/jovahagyasok": "approval",
  "/admin/archivum": "archive",
  "/admin/import": "import",
  "/admin/emlekeztetok": "reminder",
  "/admin/adatvedelem": "lifecycle",
  "/admin/beallitasok": "settings",
};

const ROLE_BY_PROFILE: Readonly<Record<SyntheticProfile["role"], Role>> = {
  parent: "parent",
  "kindergarten-teacher": "kindergarten_teacher",
  "group-admin": "group_admin",
  "super-admin": "super_admin",
};

function mayOpen(role: Role, path: string): boolean {
  const resource = RESOURCE_BY_ROUTE[path];
  if (!resource) return false;
  const rows = AUTHORIZATION_MATRIX.filter(
    (row) => row.roles.includes(role) && row.resources.includes(resource),
  );
  return rows.length > 0 && rows.every((row) => !row.explicitDeny);
}

function labels(profileId: string): string[] {
  return SYNTHETIC_PROFILES.find((profile) => profile.id === profileId)!.navigation.map(
    (item) => item.label,
  );
}

describe("navigation and default pages follow the access rules", () => {
  it.each(SYNTHETIC_PROFILES)(
    "$id: every menu link and the default page are allowed",
    (profile) => {
      const role = ROLE_BY_PROFILE[profile.role];
      for (const item of profile.navigation) {
        expect(RESOURCE_BY_ROUTE[item.href], `${item.href} has a known resource`).toBeDefined();
        expect(mayOpen(role, item.href), `${profile.id} may open ${item.href}`).toBe(true);
      }
      expect(mayOpen(role, profile.homePath), `${profile.id} may open ${profile.homePath}`).toBe(
        true,
      );
    },
  );

  it("gives no profile a page its role could not open before", () => {
    for (const profile of SYNTHETIC_PROFILES) {
      const hrefs = profile.navigation.map((item) => item.href);
      expect(new Set(hrefs).size).toBe(hrefs.length);
      const allowed = Object.keys(RESOURCE_BY_ROUTE).filter((path) =>
        mayOpen(ROLE_BY_PROFILE[profile.role], path),
      );
      for (const href of hrefs) expect(allowed).toContain(href);
    }
  });

  it("keeps import, reminders, privacy and settings out of the group admin menu", () => {
    const hrefs = SYNTHETIC_PROFILES.find((p) => p.id === "group-admin-local")!.navigation.map(
      (item) => item.href,
    );
    for (const forbidden of [
      "/admin/import",
      "/admin/emlekeztetok",
      "/admin/adatvedelem",
      "/admin/beallitasok",
    ]) {
      expect(hrefs).not.toContain(forbidden);
      expect(mayOpen("group_admin", forbidden)).toBe(false);
    }
  });

  it("lists the agreed items in the agreed order", () => {
    expect(labels("parent-local")).toEqual(["Értesítések", "Feladatok"]);
    expect(labels("kindergarten-teacher-local")).toEqual([]);
    expect(labels("group-admin-local")).toEqual([
      "Áttekintés",
      "Nyilvántartások",
      "Feladatok és események",
      "Jóváhagyások",
      "Archívum",
    ]);
    expect(labels("super-admin-local")).toEqual([
      "Áttekintés",
      "Nyilvántartások",
      "Feladatok és események",
      "Jóváhagyások",
      "Archívum",
      "Importálás",
      "Emlékeztetők",
      "Adatvédelem",
      "Beállítások",
    ]);
  });

  it("starts the super admin menu with exactly the group admin items", () => {
    expect(labels("super-admin-local").slice(0, 5)).toEqual(labels("group-admin-local"));
  });

  it("opens the agreed default page for every profile", () => {
    expect(
      Object.fromEntries(SYNTHETIC_PROFILES.map((profile) => [profile.id, profile.homePath])),
    ).toEqual({
      "parent-local": "/szulo/ertesitesek",
      "kindergarten-teacher-local": "/teacher/schedule",
      "group-admin-local": "/admin",
      "super-admin-local": "/admin",
    });
  });
});
