import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";

const mode = process.argv[2];
if (!mode || !["privacy", "secrets", "sast", "no-deploy"].includes(mode))
  throw new Error("usage: scan-artifacts.ts <privacy|secrets|sast|no-deploy>");

const root = process.cwd();
const excluded = new Set([
  ".git",
  "node_modules",
  "aidlc",
  "source-materials",
  ".next",
  "coverage",
  "playwright-report",
  "test-results",
]);

function filesUnder(path: string): string[] {
  if (!existsSync(path)) return [];
  if (statSync(path).isFile()) return [path];
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory() && excluded.has(entry.name)) return [];
    return filesUnder(join(path, entry.name));
  });
}

const artifactRoots = [
  "verification/fixtures.json",
  ".verification/evidence",
  ".verification/logs",
  "verification/reports",
  "test-results",
  "playwright-report",
];
const executableRoots = [
  "app",
  "src",
  "scripts",
  "tests",
  "package.json",
  "playwright.config.ts",
  "next.config.ts",
  "proxy.ts",
  ".github",
];
const allRepoFiles = filesUnder(root).filter(
  (path) => !path.endsWith("scripts/verification/scan-artifacts.ts"),
);
const artifactFiles = artifactRoots.flatMap((path) => filesUnder(resolve(path)));
const executableFiles = executableRoots
  .flatMap((path) => filesUnder(resolve(path)))
  .filter((path) => !path.endsWith("scripts/verification/scan-artifacts.ts"));

const textExtensions = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".md",
  ".yml",
  ".yaml",
  ".txt",
  ".log",
  "",
]);
function scan(paths: string[], patterns: RegExp[]): string[] {
  const findings: string[] = [];
  for (const path of [...new Set(paths)].sort()) {
    if (!textExtensions.has(extname(path))) continue;
    const content = readFileSync(path, "utf8");
    for (const pattern of patterns)
      if (pattern.test(content)) findings.push(`${relative(root, path)} matched ${pattern.source}`);
  }
  return findings;
}

let findings: string[];
if (mode === "privacy") {
  findings = scan(artifactFiles, [
    /[A-Z0-9._%+-]+@(?!example\.test\b)[A-Z0-9.-]+\.[A-Z]{2,}/i,
    /(?:\+36|06)[ -]?(?:1|20|30|31|50|70)[ -]?\d{3}[ -]?\d{4}\b/,
    /(?:utca|út|tér)\s+\d+\b/iu,
  ]);
} else if (mode === "secrets") {
  findings = scan(allRepoFiles, [
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
    /\b(?:ghp|github_pat|glpat|sk_live|sk_test|xox[baprs])-[_A-Za-z0-9]{16,}\b/,
    /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/,
  ]);
} else if (mode === "sast") {
  findings = scan(
    executableFiles.filter((path) => path.includes("/app/") || path.includes("/src/")),
    [/\beval\s*\(/, /new\s+Function\s*\(/, /dangerouslySetInnerHTML\s*=/, /child_process/],
  );
} else {
  findings = scan(executableFiles, [
    /\bvercel\s+(?:deploy|promote|rollback)\b/i,
    /\bsupabase\s+(?:db\s+push|functions\s+deploy|link)\b/i,
    /\bnpm\s+publish\b/i,
    /curl\s+[^\n]*(?:https?:\/\/(?!127\.0\.0\.1|localhost))/i,
  ]);
}

if (findings.length > 0)
  throw new Error(`${mode.toUpperCase()}_SCAN_FAILED\n${findings.join("\n")}`);
console.log(
  `${mode.toUpperCase()}_SCAN_PASS files=${mode === "privacy" ? artifactFiles.length : mode === "secrets" ? allRepoFiles.length : executableFiles.length}`,
);
