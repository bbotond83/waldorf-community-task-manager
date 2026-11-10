import { describe, expect, it } from "vitest";
import type { Role } from "../../src/access/index.ts";
import { AUTHORIZATION_MATRIX } from "../../src/application/index.ts";
import { ROLE_PROFILES, roleProfile } from "../support/role-profiles.ts";

// The authorization resource each page needs (the page guards use the same resources).
const RESOURCE_BY_ROUTE: Readonly<Record<string, string>> = {
  "/szulo/feladatok": "assignment",
  "/szulo/cserek": "swap_request",
  "/szulo/ertesitesek": "notification",
  "/szulo/munkacsoportok": "working_group",
  "/teacher/schedule": "schedule",
  "/teacher/munkacsoportok": "working_group",
  "/admin": "dashboard",
  "/admin/munkacsoportok": "working_group",
  "/admin/nyilvantartasok": "record",
  "/admin/feladatok": "task",
  "/admin/jovahagyasok": "approval",
  "/admin/archivum": "archive",
  "/admin/emlekeztetok": "reminder",
  "/admin/adatvedelem": "lifecycle",
  "/admin/beallitasok": "settings",
};

function mayOpen(role: Role, path: string): boolean {
  const resource = RESOURCE_BY_ROUTE[path];
  if (!resource) return false;
  const rows = AUTHORIZATION_MATRIX.filter(
    (row) => row.roles.includes(role) && row.resources.includes(resource),
  );
  return rows.length > 0 && rows.every((row) => !row.explicitDeny);
}

function labels(profileId: Parameters<typeof roleProfile>[0]): string[] {
  return roleProfile(profileId).navigation.map((item) => item.label);
}

describe("navigation and default pages follow the access rules", () => {
  it.each(ROLE_PROFILES)("$id: every menu link and the default page are allowed", (profile) => {
    for (const item of profile.navigation) {
      expect(RESOURCE_BY_ROUTE[item.href], `${item.href} has a known resource`).toBeDefined();
      expect(mayOpen(profile.role, item.href), `${profile.id} may open ${item.href}`).toBe(true);
    }
    expect(
      mayOpen(profile.role, profile.homePath),
      `${profile.id} may open ${profile.homePath}`,
    ).toBe(true);
  });

  it("gives no profile a page its role could not open before", () => {
    for (const profile of ROLE_PROFILES) {
      const hrefs = profile.navigation.map((item) => item.href);
      expect(new Set(hrefs).size).toBe(hrefs.length);
      const allowed = Object.keys(RESOURCE_BY_ROUTE).filter((path) => mayOpen(profile.role, path));
      for (const href of hrefs) expect(allowed).toContain(href);
    }
  });

  it("keeps records, reminders, privacy and settings out of the group admin menu (BR3.9)", () => {
    const hrefs = roleProfile("group-admin").navigation.map((item) => item.href);
    for (const forbidden of [
      "/admin/nyilvantartasok",
      "/admin/emlekeztetok",
      "/admin/adatvedelem",
      "/admin/beallitasok",
    ]) {
      expect(hrefs).not.toContain(forbidden);
      expect(mayOpen("group_admin", forbidden)).toBe(false);
    }
  });

  it("lists the agreed items in the agreed order", () => {
    expect(labels("parent")).toEqual(["Értesítések", "Feladatok", "Cserék", "Munkacsoportok"]);
    expect(labels("teacher")).toEqual(["Beosztás", "Munkacsoportok"]);
    expect(labels("group-admin")).toEqual([
      "Áttekintés",
      "Feladatok és események",
      "Jóváhagyások",
      "Archívum",
      "Munkacsoportok",
    ]);
    expect(labels("super-admin")).toEqual([
      "Áttekintés",
      "Nyilvántartások",
      "Feladatok és események",
      "Jóváhagyások",
      "Archívum",
      "Munkacsoportok",
      "Emlékeztetők",
      "Adatvédelem",
      "Beállítások",
    ]);
  });

  it("gives the super admin every group admin item", () => {
    expect(labels("super-admin")).toEqual(expect.arrayContaining(labels("group-admin")));
  });

  it("opens the agreed default page for every profile", () => {
    expect(
      Object.fromEntries(ROLE_PROFILES.map((profile) => [profile.id, profile.homePath])),
    ).toEqual({
      parent: "/szulo/ertesitesek",
      teacher: "/teacher/schedule",
      "group-admin": "/admin",
      "super-admin": "/admin",
    });
  });
});
