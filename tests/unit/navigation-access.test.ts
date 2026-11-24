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
  "/szulo/esemenyek": "event",
  "/teacher/esemenyek": "event",
  "/admin/esemenyek": "event",
  "/admin/sablonok": "event",
  "/szulo/ismetlodo": "recurring",
  "/szulo/konyvtar": "library",
  "/teacher/konyvtar": "library",
  "/admin/konyvtar": "library",
  "/szulo/beosztas": "rota",
  "/szulo/szulok": "directory",
  "/teacher/szulok": "directory",
  "/admin/szulok": "directory",
  "/szulo/fiokom": "own_account",
  "/teacher/beosztas": "rota",
  "/admin/tanev": "school_calendar",
  "/admin/beosztas": "rota_plan",
  "/teacher/schedule": "schedule",
  "/teacher/munkacsoportok": "working_group",
  "/admin": "dashboard",
  "/admin/munkacsoportok": "working_group",
  "/admin/nyilvantartasok": "record",
  "/admin/feladatok": "task",
  "/admin/jovahagyasok": "approval",
  "/admin/cserek": "approval",
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

  it("keeps records, delivery failures, privacy and settings out of the group admin menu (BR3.9)", () => {
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
    expect(labels("parent")).toEqual([
      "Értesítések",
      "Feladatok",
      "Beosztás",
      "Cserék",
      "Munkacsoportok",
      "Ismétlődők",
      "Események",
      "Könyvtár",
      "Szülők",
      "Fiókom",
    ]);
    expect(labels("teacher")).toEqual([
      "Beosztás",
      "Takarítás",
      "Munkacsoportok",
      "Események",
      "Könyvtár",
      "Szülők",
    ]);
    expect(labels("group-admin")).toEqual([
      "Áttekintés",
      "Feladatok és események",
      "Jóváhagyások",
      "Cserék",
      "Archívum",
      "Munkacsoportok",
      "Események",
      "Ismétlődők",
      "Könyvtár",
      "Beosztás",
      "Szülők",
    ]);
    expect(labels("super-admin")).toEqual([
      "Áttekintés",
      "Nyilvántartások",
      "Feladatok és események",
      "Jóváhagyások",
      "Cserék",
      "Archívum",
      "Munkacsoportok",
      "Események",
      "Sablonok",
      "Könyvtár",
      "Tanév",
      "Beosztás",
      "Szülők",
      "Kézbesítési hibák",
      "Adatvédelem",
      "Beállítások",
    ]);
  });

  it("gives the super admin every group admin item", () => {
    // "Ismétlődők" is a parent's own page (the family's and the groups' duties); a super admin has no family and
    // reaches a group's recurring duties from the group's page instead.
    expect(labels("super-admin")).toEqual(
      expect.arrayContaining(labels("group-admin").filter((label) => label !== "Ismétlődők")),
    );
  });

  it("sends the group admin to the parent rota overview and the super admin to the planning page (BR24.1)", () => {
    const groupAdmin = roleProfile("group-admin").navigation.filter(
      (item) => item.label === "Beosztás",
    );
    expect(groupAdmin.map((item) => item.href)).toEqual(["/szulo/beosztas"]);
    expect(mayOpen("group_admin", "/szulo/beosztas")).toBe(true);
    // The super admin's single "Beosztás" entry is the planning page, so the menu never holds two alike.
    const superAdmin = roleProfile("super-admin").navigation.filter(
      (item) => item.label === "Beosztás",
    );
    expect(superAdmin.map((item) => item.href)).toEqual(["/admin/beosztas"]);
  });

  it("keeps one clearly worded teacher entry per purpose and none that reads alike (review finding 3)", () => {
    const teacher = roleProfile("teacher").navigation;
    expect(teacher.map((item) => [item.label, item.href])).toEqual([
      ["Beosztás", "/teacher/schedule"],
      ["Takarítás", "/teacher/beosztas"],
      ["Munkacsoportok", "/teacher/munkacsoportok"],
      ["Események", "/teacher/esemenyek"],
      ["Könyvtár", "/teacher/konyvtar"],
      ["Szülők", "/teacher/szulok"],
    ]);
    expect(teacher.filter((item) => /beoszt/i.test(item.label))).toHaveLength(1);
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

describe("the directory and the own account follow the access rules (BR30, BR31.2, BR32.1)", () => {
  it("lets every role open the directory and only the parent open the own account", () => {
    for (const role of ["parent", "group_admin", "kindergarten_teacher", "super_admin"] as const) {
      expect(mayOpen(role, "/szulo/szulok"), role).toBe(true);
    }
    expect(mayOpen("parent", "/szulo/fiokom")).toBe(true);
    for (const role of ["group_admin", "kindergarten_teacher", "super_admin"] as const) {
      expect(mayOpen(role, "/szulo/fiokom"), role).toBe(false);
    }
  });

  it("shows the directory to the teacher and the super admin on their own areas and Fiókom to parents only", () => {
    expect(roleProfile("teacher").navigation.map((item) => item.href)).toContain("/teacher/szulok");
    expect(roleProfile("super-admin").navigation.map((item) => item.href)).toContain(
      "/admin/szulok",
    );
    for (const id of ["teacher", "group-admin", "super-admin"] as const) {
      expect(roleProfile(id).navigation.map((item) => item.href)).not.toContain("/szulo/fiokom");
    }
    expect(roleProfile("parent").navigation.map((item) => item.href)).toContain("/szulo/fiokom");
  });
});

describe("the working-group pages follow the access rules (BR42, BR40, BR41, NFR3.16)", () => {
  const DETAIL_ROUTES = [
    "/szulo/munkacsoportok/[id]",
    "/teacher/munkacsoportok/[id]",
    "/admin/munkacsoportok/[id]",
  ] as const;

  it("opens each group page from the Munkacsoportok list of the same area, and adds no menu entry of its own", () => {
    for (const profile of ROLE_PROFILES) {
      const entries = profile.navigation.filter((item) => item.label === "Munkacsoportok");
      expect(entries, profile.id).toHaveLength(1);
      expect(DETAIL_ROUTES).toContain(`${entries[0]!.href}/[id]`);
      for (const item of profile.navigation) expect(item.href).not.toContain("[id]");
    }
  });

  it("lets every role read a group, only the parent join and leave, and only the super admin appoint", () => {
    for (const role of ["parent", "group_admin", "kindergarten_teacher", "super_admin"] as const) {
      expect(mayOpen(role, "/szulo/munkacsoportok"), role).toBe(true);
    }
    const holders = (resource: string, action: string) =>
      AUTHORIZATION_MATRIX.filter(
        (row) =>
          row.resources.includes(resource) &&
          row.actions.includes(action as (typeof row.actions)[number]) &&
          !row.explicitDeny,
      ).flatMap((row) => row.roles);
    expect([...new Set(holders("working_group_membership", "create"))]).toEqual(["parent"]);
    expect([...new Set(holders("working_group_membership", "update"))]).toEqual(["parent"]);
    expect([...new Set(holders("working_group_coordinator", "manage"))]).toEqual(["super_admin"]);
  });
});
