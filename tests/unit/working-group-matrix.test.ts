import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CURRENT_ROLES, grantAllows } from "../../src/access/role-policy.ts";
import type { AuthorizationAction, Role, RoleGrant, Scope } from "../../src/access/index.ts";

type MatrixRow = {
  id: string;
  role: string;
  route: string;
  actions: AuthorizationAction[];
  resources: string[];
  effect: "allow" | "deny";
};

const rows = (
  JSON.parse(
    readFileSync(resolve(process.cwd(), "verification/authorization-matrix.json"), "utf8"),
  ) as { rows: MatrixRow[] }
).rows;

/**
 * The three group pages of U4 (BR42, NFR3.16): each route needs its own exact row for every role. A wildcard row
 * such as `/admin/**` does not count, so a role added or a route renamed without a deliberate row fails here.
 */
const ROUTES: Readonly<Record<string, Readonly<Record<Role, "allow" | "deny">>>> = {
  "/szulo/munkacsoportok/[id]": {
    parent: "allow",
    kindergarten_teacher: "deny",
    group_admin: "deny",
    super_admin: "deny",
  },
  "/teacher/munkacsoportok/[id]": {
    parent: "deny",
    kindergarten_teacher: "allow",
    group_admin: "deny",
    super_admin: "deny",
  },
  "/admin/munkacsoportok/[id]": {
    parent: "deny",
    kindergarten_teacher: "deny",
    group_admin: "allow",
    super_admin: "allow",
  },
};

const org: Scope = { id: "org", type: "organization", organizationId: "org" };
const group: Scope = { ...org, id: "group", type: "group" };
const family: Scope = { ...org, id: "family", type: "family" };
const SCOPE_OF_ROLE: Readonly<Record<Role, Scope>> = {
  parent: family,
  group_admin: group,
  kindergarten_teacher: org,
  super_admin: org,
};
const allowedByCode = (role: Role, action: AuthorizationAction, resource: string): boolean => {
  const scope = SCOPE_OF_ROLE[role];
  const grant: RoleGrant = {
    id: "grant",
    subjectId: "user",
    role,
    scope,
    grantedAt: "2026-11-15",
  };
  return grantAllows(grant, { action, resource: { kind: resource, scope } });
};

describe("the three working-group page routes have an exact row for every role", () => {
  for (const [route, expected] of Object.entries(ROUTES)) {
    it.each(CURRENT_ROLES)(`${route}: %s has exactly one row, with the expected effect`, (role) => {
      const matching = rows.filter((row) => row.route === route && row.role === role);
      expect(matching, `${route} for ${role}`).toHaveLength(1);
      expect(matching[0]!.effect).toBe(expected[role]);
      expect(matching[0]!.route).not.toContain("*");
    });
  }

  it("has no wildcard row standing in for a page route", () => {
    for (const route of Object.keys(ROUTES)) {
      expect(route).not.toContain("*");
      expect(rows.filter((row) => row.route === route)).toHaveLength(CURRENT_ROLES.length);
    }
  });

  it("gives every row of the three routes a unique id and a current role", () => {
    const own = rows.filter((row) => row.route in ROUTES);
    expect(own).toHaveLength(Object.keys(ROUTES).length * CURRENT_ROLES.length);
    expect(new Set(own.map((row) => row.id)).size).toBe(own.length);
    for (const row of own) expect(CURRENT_ROLES).toContain(row.role as Role);
  });

  it("claims in an allow row only what the access policy really grants that role", () => {
    for (const row of rows.filter((candidate) => candidate.route in ROUTES)) {
      if (row.effect === "deny") continue;
      const role = row.role as Role;
      for (const resource of row.resources) {
        const granted = row.actions.filter((action) => allowedByCode(role, action, resource));
        expect(
          granted.length,
          `${row.id} lists ${resource} with no action the policy grants`,
        ).toBeGreaterThan(0);
      }
      // Every resource the policy gives the role on the page appears in the row.
      for (const resource of [
        "working_group",
        "working_group_membership",
        "working_group_coordinator",
      ]) {
        const policyGrants = (["read", "create", "update", "manage"] as const).some((action) =>
          allowedByCode(role, action, resource),
        );
        if (resource === "working_group_membership" && role !== "parent") continue;
        if (resource === "working_group_coordinator" && role !== "super_admin") continue;
        if (policyGrants) expect(row.resources, `${row.id}`).toContain(resource);
      }
    }
  });

  it("matches the commands: joining and leaving are the parent's, appointing and revoking the super admin's", () => {
    expect(allowedByCode("parent", "create", "working_group_membership")).toBe(true);
    expect(allowedByCode("parent", "update", "working_group_membership")).toBe(true);
    expect(allowedByCode("super_admin", "create", "working_group_membership")).toBe(false);
    expect(allowedByCode("group_admin", "update", "working_group_membership")).toBe(false);
    expect(allowedByCode("kindergarten_teacher", "update", "working_group_membership")).toBe(false);
    expect(allowedByCode("super_admin", "manage", "working_group_coordinator")).toBe(true);
    for (const role of ["parent", "group_admin", "kindergarten_teacher"] as const) {
      expect(allowedByCode(role, "manage", "working_group_coordinator"), role).toBe(false);
    }
    // Every role reads a group page.
    for (const role of CURRENT_ROLES)
      expect(allowedByCode(role, "read", "working_group")).toBe(true);
  });
});
