import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { validateManifests, REQUIRED_NFR08_SCENARIOS } from "../../scripts/verification/core.ts";
import { SYNTHETIC_PROFILES } from "../../src/runtime/synthetic/profiles.ts";
import { LEGACY_DESTINATIONS, REQUIRED_SHEETS } from "../../src/import-migration/import-service.ts";
const read = (path: string) => readFileSync(path, "utf8");
const json = (path: string) => JSON.parse(read(path));
it("current fixtures exactly match four runtime profiles role and home contracts", () => {
  const profiles = json("verification/fixtures.json").profiles;
  expect(profiles).toHaveLength(4);
  for (const runtime of SYNTHETIC_PROFILES)
    expect(profiles.find((p: { id: string }) => p.id === runtime.id)).toMatchObject({
      role: runtime.role.replaceAll("-", "_"),
      home: runtime.homePath,
    });
});
it("current scenarios retain all mandatory workflow browser and outstanding inventories", () => {
  const scenarios = validateManifests();
  expect(scenarios).toHaveLength(39);
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
    "src/admin-experience/admin-service.ts",
    "src/application/admin-facade.ts",
    "src/import-migration/import-service.ts",
    "src/runtime/synthetic/profiles.ts",
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
  for (const path of [
    "tests/unit/current-role-session.test.ts",
    "tests/integration/synthetic-route.test.ts",
  ])
    expect(read(path)).toContain('"staff-local"');
  expect(read("tests/integration/teacher-boundaries.test.ts")).toContain('"read_only_staff"');
  expect(read("tests/integration/teacher-routes.test.ts")).toContain("munkatars/beosztas");
});
it("archive coverage preserves all sheets and current administrator ownership", () => {
  expect(Object.keys(LEGACY_DESTINATIONS)).toEqual([...REQUIRED_SHEETS]);
  expect(REQUIRED_SHEETS).toHaveLength(17);
  const adminArchives = [
    "ÁLLATOK",
    "Állatok etetése info",
    "Nagytakarítás szervezés",
    "Hajó javítás",
    "Kertfejlesztés",
  ] as const;
  for (const sheet of adminArchives)
    expect(LEGACY_DESTINATIONS[sheet]).toMatchObject({
      owner: "super-admin",
      mode: "read_only_archive",
    });
  expect(LEGACY_DESTINATIONS["Munkacsoportok"].owner).toBe("workgroup-organizer");
});
it("Super governance allow is paired with an explicit non-Super advanced denial", () => {
  const rows = json("verification/authorization-matrix.json").rows;
  expect(rows.find((r: { id: string }) => r.id === "AUTH-SUPER-GOVERNANCE-ALLOW")).toMatchObject({
    role: "super_admin",
    effect: "allow",
  });
  expect(rows.find((r: { id: string }) => r.id === "AUTH-NON-SUPER-ADVANCED-DENY")).toMatchObject({
    effect: "deny",
    resources: ["import", "reminder", "lifecycle", "settings", "role_grant", "governance"],
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
