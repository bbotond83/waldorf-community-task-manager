import { describe, expect, it } from "vitest";
import {
  classifySource,
  discoverProduction,
  validateProductionCoverage,
} from "./support/production-inventory";

const runtime = classifySource("src/example.ts", "export function example() { return 1; }");
const counter = { s: { "0": 0 }, f: { "0": 0 }, b: { "0": [0, 0] } };
describe("honest executable denominator", () => {
  it("includes runtime initialization and does not credit zero-hit branches", () => {
    expect(classifySource("init.ts", "const value = initialize();").classification).toBe("runtime");
    const report = validateProductionCoverage({ "src/example.ts": counter }, [runtime]);
    expect(report.measured).toBe(1);
    expect(counter.b["0"]).toEqual([0, 0]);
  });
  it("rejects missing and empty executable entries", () => {
    expect(() => validateProductionCoverage({ other: counter }, [runtime])).toThrow("Unmeasured");
    expect(() =>
      validateProductionCoverage({ "src/example.ts": { s: {}, f: {}, b: {} } }, [runtime]),
    ).toThrow("Unmeasured");
  });
  it("rejects malformed and negative counters", () => {
    expect(() => validateProductionCoverage(null, [runtime])).toThrow("Malformed");
    expect(() => validateProductionCoverage({}, [runtime])).toThrow("Empty");
    expect(() =>
      validateProductionCoverage({ "src/example.ts": { ...counter, s: { "0": -1 } } }, [runtime]),
    ).toThrow("Invalid");
    expect(() => validateProductionCoverage({ "src/example.ts": { s: {} } }, [runtime])).toThrow(
      "Malformed",
    );
  });
  it("allows proven type-only files while accounting for imported initialization", () => {
    expect(
      classifySource("default.ts", 'import Default, { type T } from "./example.ts";')
        .classification,
    ).toBe("linkage-only");
    expect(classifySource("empty.ts", 'import {} from "./example.ts";').classification).toBe(
      "linkage-only",
    );
    expect(classifySource("only.ts", 'import { type T } from "./example.ts";').classification).toBe(
      "type-only",
    );
    const types = classifySource(
      "src/types.ts",
      "export interface Model { id: string }; export type Id = string;",
    );
    expect(types.classification).toBe("type-only");
    expect(
      validateProductionCoverage({ "src/example.ts": counter }, [runtime, types]).candidates,
    ).toBe(2);
    const linkage = classifySource("src/index.ts", 'export { example } from "./example.ts";');
    expect(linkage.dependencies).toEqual(["./example.ts"]);
    expect(() => validateProductionCoverage({ other: counter }, [runtime, linkage])).toThrow(
      "Unmeasured",
    );
    expect(() => validateProductionCoverage({ other: counter }, [linkage])).toThrow("Unaccounted");
  });
  it("normalizes absolute and relative source paths", () => {
    for (const malformed of [
      { s: [], f: {}, b: {} },
      { s: null, f: {}, b: {} },
      { s: {}, f: {}, b: { "0": 0 } },
      { s: { "0": [] }, f: {}, b: {} },
    ])
      expect(() => validateProductionCoverage({ "src/example.ts": malformed }, [runtime])).toThrow(
        "Malformed",
      );
    expect(
      validateProductionCoverage({ [`${process.cwd()}/src/example.ts`]: counter }, [runtime])
        .measured,
    ).toBe(1);
    expect(validateProductionCoverage({ "./src/example.ts": counter }, [runtime]).measured).toBe(1);
  });
  it("U2 teacher inventory discovers all application/scripts and separates tests/declarations", () => {
    const inventory = discoverProduction();
    expect(inventory.some((entry) => entry.path === "scripts/validate-runtime-config.ts")).toBe(
      true,
    );
    expect(inventory.some((entry) => entry.path === "app/page.tsx")).toBe(true);
    expect(
      inventory.some((entry) => entry.path.includes(".test.") || entry.path.endsWith(".d.ts")),
    ).toBe(false);
    // 164 earlier files plus the 13 production files U1 adds (scripts/db, src/runtime/database, scan-core),
    // plus the 31 U2 adds: 13 under app/ (the four screens, their actions and the sign-out control),
    // 16 under src/identity and the operator command with its terminal (scripts/db), plus src/identity/refresh.ts
    // (the request refresh, review follow-up), plus the 20 U3 adds so far: the 15 database adapter files under
    // src/data, admin-payloads.ts and shell-profile.ts, access.ts and services.ts under src/runtime/production,
    // and app/_identity/production-request.ts, plus the 11 the screen changes add (step 28): the incoming
    // swaps page and its board, the fresh-key helper, the sign-out shell action and the production home,
    // the record and task field sets with their payload reader and lookups, and budapest-time.ts; minus the
    // 13 production files of the four replaced modules that step 31 deletes (src/directory 4,
    // src/coordination 4, src/parent-experience 3, src/privacy-audit 2), plus the one file of the repair
    // pass (src/admin-advanced/interim-port.ts, the empty-state port for the operations that stay with U4),
    // plus the 3 files U4's skeleton adds under src/import-parser (limits, template, index), plus the 7 the
    // parser and adapter steps add: types, zip, workbook and server under src/import-parser, imports.ts and
    // notifications.ts under src/data, and import-upload.ts under src/application; minus the 7 production files
    // of the two modules step 26 deletes (src/notifications 4, src/import-migration 3), plus the one file that
    // keeps the synthetic archive presentation's sheet table (src/admin-experience/legacy-destinations.ts), plus
    // the one file of the import screen (app/admin/_lib/import-messages.ts, the Hungarian import messages).
    expect(inventory.length).toBe(233);
    for (const path of [
      "src/runtime/AppNav.tsx",
      "src/runtime/StatusBadge.tsx",
      "src/runtime/FilterClearLink.tsx",
      "app/teacher/_lib/schedule.ts",
      "src/runtime/BackToHomeLink.tsx",
      "src/application/status-labels.ts",
      "src/parent-web/notification-context.ts",
      "app/szulo/_components/MarkNotificationRead.tsx",
      "app/szulo/_components/PendingRequestNotice.tsx",
      "app/admin/_components/AdminBackLink.tsx",
      "app/admin/_components/DeveloperDetails.tsx",
    ]) {
      expect(inventory.some((entry) => entry.path === path)).toBe(true);
    }
    expect(inventory.some((entry) => entry.path === "scripts/verification/current-role-database.ts")).toBe(true);
    for (const path of ["src/teacher-tracking/tracking-model.ts", "src/teacher-web/synthetic-teacher-repository.ts", "app/teacher/_lib/compatibility.ts", "app/munkatars/beosztas/route.ts", "app/munkatars/beosztas/[id]/route.ts"]) expect(inventory.some(entry => entry.path === path)).toBe(true);
    expect(inventory.some(entry => entry.path.startsWith("src/staff-") || entry.path === "src/application/staff-facade.ts")).toBe(false);
    for (const path of [
      "src/access/role-policy.ts",
      "src/access/legacy-role-conversion.ts",
      "src/access/session-grants.ts",
      "src/runtime/synthetic/access-state.ts",
    ]) {
      expect(inventory.some((entry) => entry.path === path)).toBe(true);
    }
  });
});
