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
    expect(inventory.length).toBe(156);
    for (const path of [
      "src/runtime/AppNav.tsx",
      "src/runtime/BackToHomeLink.tsx",
      "src/application/status-labels.ts",
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
