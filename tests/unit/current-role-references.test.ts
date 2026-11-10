import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { validateManifests, REQUIRED_NFR08_SCENARIOS } from "../../scripts/verification/core.ts";
import { ROLE_PROFILES } from "../support/role-profiles.ts";
const read = (path: string) => readFileSync(path, "utf8");
const json = (path: string) => JSON.parse(read(path));
it("current fixtures exactly match the four role and home contracts", () => {
  const profiles = json("verification/fixtures.json").profiles;
  expect(profiles).toHaveLength(4);
  for (const runtime of ROLE_PROFILES)
    expect(profiles.find((p: { role: string }) => p.role === runtime.role)).toMatchObject({
      role: runtime.role,
      home: runtime.homePath,
    });
});
it("current scenarios retain all mandatory workflow browser and outstanding inventories", () => {
  const scenarios = validateManifests();
  expect(scenarios).toHaveLength(37);
  for (const id of REQUIRED_NFR08_SCENARIOS) expect(scenarios.some((s) => s.id === id)).toBe(true);
  expect(
    scenarios
      .filter((s) => s.target === "linked-target")
      .every((s) => s.expected === "OUTSTANDING"),
  ).toBe(true);
  expect(
    scenarios.some((s) => s.id === "LOCAL-TEACHER-TRACKING" && s.route === "/teacher/schedule"),
  ).toBe(true);
});
it("current owned executable references have no fifth role or obsolete teacher module", () => {
  const current = [
    "verification/fixtures.json",
    "verification/authorization-matrix.json",
    "verification/scenarios.json",
    "verification/sensitive-fields.json",
    "verification/AUTHORIZATION.md",
    "verification/RUNBOOK.md",
    "src/application/admin-facade.ts",
    "src/runtime/navigation.ts",
    "tests/browser/admin-core.spec.ts",
    "tests/browser/admin-advanced.spec.ts",
    "tests/browser/runtime-foundation.spec.ts",
  ];
  for (const path of current)
    expect(read(path), path).not.toMatch(
      /read_only_staff|kindergarten_admin|staff-local|kindergarten-admin-local|AUTH-STAFF|AUTH-KINDERGARTEN|src\/staff-web|src\/staff-schedule|Munkatárs/,
    );
});
it("explicit conversion and removed-profile rejection fixtures retain documented legacy inputs", () => {
  expect(read("src/access/legacy-role-conversion.ts")).toContain('"kindergarten_admin"');
  expect(read("src/access/types.ts")).toContain('"read_only_staff"');
  // The removed fifth role's sign-in profiles ("staff-local") no longer exist at all; the session test keeps
  // the removed role itself as an input that must not become authority.
  expect(read("tests/unit/current-role-session.test.ts")).toContain('"read_only_staff"');
  expect(read("tests/integration/teacher-boundaries.test.ts")).toContain('"read_only_staff"');
  expect(read("tests/integration/teacher-routes.test.ts")).toContain("munkatars/beosztas");
});
it("Super governance allow is paired with an explicit non-Super advanced denial", () => {
  const rows = json("verification/authorization-matrix.json").rows;
  expect(rows.find((r: { id: string }) => r.id === "AUTH-SUPER-GOVERNANCE-ALLOW")).toMatchObject({
    role: "super_admin",
    effect: "allow",
  });
  expect(rows.find((r: { id: string }) => r.id === "AUTH-NON-SUPER-ADVANCED-DENY")).toMatchObject({
    effect: "deny",
    resources: ["reminder", "lifecycle", "settings", "role_grant", "governance"],
  });
});
it("historical baseline migration and local-only exclusion remain independent of current claims", () => {
  expect(read("supabase/migrations/20260806_access_rls.sql")).toContain("kindergarten_admin");
  for (const unit of ["u1-current-role-foundation", "u2-teacher-tracking"])
    expect(
      read(
        `aidlc/spaces/default/intents/261006-simplify-user-roles/construction/${unit}/code-generation/source-manifest.json`,
      ),
    ).not.toContain("next-env.d.ts");
  expect(
    createHash("sha256").update(read("supabase/migrations/20260806_access_rls.sql")).digest("hex"),
  ).toBe("2d176c02b418f72cadf41b8a1c5f672bba19d1b047f14b19ae25cfedf1567631");
});
