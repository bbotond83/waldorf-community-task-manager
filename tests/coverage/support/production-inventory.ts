import { readdirSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import ts from "typescript";

export interface SourceEntry {
  path: string;
  classification: "runtime" | "type-only" | "linkage-only";
  dependencies: string[];
}

export function classifySource(path: string, source: string): SourceEntry {
  const file = ts.createSourceFile(
    path,
    source,
    ts.ScriptTarget.Latest,
    true,
    path.endsWith("tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const dependencies: string[] = [];
  let linkage = false;
  let runtime = false;
  for (const statement of file.statements) {
    if (
      ts.isInterfaceDeclaration(statement) ||
      ts.isTypeAliasDeclaration(statement) ||
      ts.isEmptyStatement(statement)
    )
      continue;
    if (ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) {
      const typeOnly = ts.isImportDeclaration(statement)
        ? statement.importClause?.isTypeOnly
        : statement.isTypeOnly;
      const clause = ts.isImportDeclaration(statement)
        ? statement.importClause?.namedBindings
        : statement.exportClause;
      const allTypeOnly =
        clause &&
        (ts.isNamedImports(clause) || ts.isNamedExports(clause)) &&
        clause.elements.length > 0 &&
        clause.elements.every((entry) => entry.isTypeOnly) &&
        !(ts.isImportDeclaration(statement) && statement.importClause?.name);
      if (typeOnly || allTypeOnly) continue;
      linkage = true;
      if (statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier))
        dependencies.push(statement.moduleSpecifier.text);
      continue;
    }
    runtime = true;
  }
  return {
    path,
    classification: runtime ? "runtime" : linkage ? "linkage-only" : "type-only",
    dependencies,
  };
}

export function discoverProduction(root = process.cwd()): SourceEntry[] {
  const paths: string[] = [];
  function walk(directory: string) {
    for (const entry of readdirSync(resolve(root, directory), { withFileTypes: true })) {
      const path = `${directory}/${entry.name}`;
      if (entry.isDirectory()) walk(path);
      else if (/\.(?:tsx?|mjs|js)$/.test(path) && !/\.(?:test\.[^/]+|d\.ts)$/.test(path))
        paths.push(path);
    }
  }
  for (const directory of ["app", "src", "scripts"]) walk(directory);
  paths.push("proxy.ts", "next.config.ts");
  return paths
    .sort()
    .map((path) => classifySource(path, readFileSync(resolve(root, path), "utf8")));
}

export function validateProductionCoverage(
  map: unknown,
  inventory: SourceEntry[],
  root = process.cwd(),
) {
  if (!map || typeof map !== "object" || Array.isArray(map))
    throw new Error("Malformed production coverage map");
  const records = map as Record<
    string,
    { s?: Record<string, number>; f?: Record<string, number>; b?: Record<string, number[]> }
  >;
  const normalized = new Map(
    Object.entries(records).map(([path, value]) => [
      isAbsolute(path) ? relative(root, path) : path.replace(/^\.\//, ""),
      value,
    ]),
  );
  if (normalized.size === 0) throw new Error("Empty production coverage map");
  const missing: string[] = [];
  for (const entry of inventory) {
    const record = normalized.get(entry.path);
    if (!record) {
      if (entry.classification === "runtime") missing.push(entry.path);
      continue;
    }
    for (const key of ["s", "f", "b"] as const) {
      const values = record[key];
      if (!values || typeof values !== "object" || Array.isArray(values))
        throw new Error(`Malformed ${key} counters: ${entry.path}`);
      for (const value of Object.values(values)) {
        if (
          (key === "b" && (!Array.isArray(value) || value.length === 0)) ||
          (key !== "b" && Array.isArray(value))
        )
          throw new Error(`Malformed ${key} counter: ${entry.path}`);
        const counters = Array.isArray(value) ? value : [value];
        if (
          counters.some(
            (counter) => typeof counter !== "number" || !Number.isFinite(counter) || counter < 0,
          )
        )
          throw new Error(`Invalid ${key} counter: ${entry.path}`);
      }
    }
    if (
      entry.classification === "runtime" &&
      Object.keys(record.s!).length === 0 &&
      Object.keys(record.f!).length === 0
    )
      missing.push(entry.path);
  }
  // Linkage executes dependencies: every local runtime dependency remains independently required.
  for (const entry of inventory.filter(
    (candidate) => candidate.classification === "linkage-only",
  )) {
    for (const dependency of entry.dependencies.filter((path) => path.startsWith("."))) {
      const path = relative(root, resolve(root, entry.path, "..", dependency));
      const possible = [
        path,
        ...["ts", "tsx", "js", "mjs"].flatMap((extension) => [
          `${path}.${extension}`,
          `${path}/index.${extension}`,
        ]),
      ];
      const target = inventory.find((candidate) => possible.includes(candidate.path));
      if (!target)
        throw new Error(`Unaccounted linkage dependency: ${entry.path} -> ${dependency}`);
    }
  }
  if (missing.length)
    throw new Error(`Unmeasured executable production files: ${missing.join(", ")}`);
  return {
    candidates: inventory.length,
    files: inventory,
    measured: inventory.filter((entry) => normalized.has(entry.path)).length,
    css: ["app/globals.css"],
    tooling: ["vitest.config.ts", "tests/coverage/", "eslint.config.mjs", "playwright.config.ts"],
  };
}
