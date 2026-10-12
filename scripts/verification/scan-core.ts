import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";

/**
 * The repository scans (privacy, secrets, SAST, no-deploy). `scan-artifacts.ts` is the command-line
 * wrapper; this module holds the logic so tests can run it against temporary directories with
 * planted files (BR1.4, BR11.1, BR11.2, NFR1.6, NFR1.7).
 */
export type ScanMode = "privacy" | "secrets" | "sast" | "no-deploy";
export const SCAN_MODES: readonly ScanMode[] = ["privacy", "secrets", "sast", "no-deploy"];

export interface Allowlist {
  emailDomains: string[];
  emails: string[];
  phoneNumbers: string[];
  allowedPaths: string[];
  ignoredPrefixes: string[];
  secretIgnoredPrefixes: string[];
  defaultKeyHashes: string[];
}

export function loadAllowlist(
  path = new URL("./privacy-allowlist.json", import.meta.url),
): Allowlist {
  const raw = JSON.parse(readFileSync(path, "utf8")) as Partial<Allowlist>;
  return {
    emailDomains: raw.emailDomains ?? [],
    emails: raw.emails ?? [],
    phoneNumbers: raw.phoneNumbers ?? [],
    allowedPaths: raw.allowedPaths ?? [],
    ignoredPrefixes: raw.ignoredPrefixes ?? [],
    secretIgnoredPrefixes: raw.secretIgnoredPrefixes ?? [],
    defaultKeyHashes: raw.defaultKeyHashes ?? [],
  };
}

export interface ScanResult {
  findings: string[];
  scanned: number;
}

export const FIXTURE_FOLDER = "tests/fixtures/fictitious/";
const DATA_EXTENSIONS = new Set([".xlsx", ".xls", ".ods", ".csv", ".sql"]);
const LOCK_FILES = new Set([
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "bun.lockb",
  "npm-shrinkwrap.json",
]);
const GENERATED_FOLDERS = [
  ".next/",
  "node_modules/",
  "coverage/",
  "playwright-report/",
  "test-results/",
  ".git/",
];
const BINARY_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".ico",
  ".webp",
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
  ".pdf",
  ".xlsx",
  ".xls",
  ".ods",
  ".zip",
  ".gz",
  ".tgz",
  ".tar",
  ".mp4",
  ".mov",
  ".webm",
  ".bin",
]);
const MAX_TEXT_BYTES = 2 * 1024 * 1024;
const SELF_FILES = ["scripts/verification/scan-artifacts.ts", "scripts/verification/scan-core.ts"];
const WALK_EXCLUDED = new Set([
  ".git",
  "node_modules",
  ".next",
  "coverage",
  "playwright-report",
  "test-results",
]);

export const EMAIL_PATTERN = /[A-Z0-9._%+-]+@([A-Z0-9-]+(?:\.[A-Z0-9-]+)*\.[A-Z]{2,})\b/gi;
export const PHONE_PATTERNS: readonly RegExp[] = [
  /(?<![\w+])(?:\+36|06)[ -]?(?:1|20|30|31|50|70)[ -]?\d{3}[ -]?\d{4}\b/g,
  /(?<![\w+])\+(?!36)[1-9]\d{0,2}[ -]?\(?\d{1,4}\)?(?:[ -]?\d{2,4}){2,3}\b/g,
];
const STREET_PATTERN = /(?:utca|út|tér)\s+\d+\b/iu;

const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/g;
const STACK_KEY_PATTERN = /\bsb_(?:publishable|secret)_[A-Za-z0-9_-]{16,}/g;
/** A service-role key name followed by something that looks like a literal value. */
const SERVICE_ROLE_VALUE =
  /\b(?:[A-Z0-9_]*SERVICE_ROLE_KEY|[a-z0-9_]*service_role_key|serviceRoleKey)\b["']?[ \t]*[=:][ \t]*["'`]?(?!process\.env|env\(|\$\{?|<|%)([A-Za-z0-9._+/=-]{24,})/g;
const FIXED_SECRET_PATTERNS: readonly [RegExp, string][] = [
  [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, "a private key header"],
  [/\b(?:ghp|github_pat|glpat|sk_live|sk_test|xox[baprs])-[_A-Za-z0-9]{16,}\b/, "a provider token"],
];

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

function listFilesWithin(root: string, directory = ""): string[] {
  const absolute = resolve(root, directory);
  if (!existsSync(absolute)) return [];
  if (statSync(absolute).isFile()) return [directory];
  return readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory() && WALK_EXCLUDED.has(entry.name)) return [];
    return listFilesWithin(root, join(directory, entry.name));
  });
}

/** Tracked files (relative paths) from git; undefined when git cannot answer. */
export function gitTrackedFiles(root: string): string[] | undefined {
  try {
    const output = execFileSync("git", ["ls-files", "-z"], {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
    });
    if (typeof output !== "string") return undefined;
    return output.split("\0").filter((path) => path.length > 0);
  } catch {
    return undefined;
  }
}

export interface ScanOptions {
  root: string;
  /** Overrides the file list; by default git's tracked files, else every file under the root. */
  trackedFiles?: readonly string[];
  allowlist?: Allowlist;
}

function repositoryFiles(options: ScanOptions): string[] {
  const files =
    options.trackedFiles ?? gitTrackedFiles(options.root) ?? listFilesWithin(options.root);
  return files.filter((path) => existsSync(resolve(options.root, path)));
}

const startsWithAny = (path: string, prefixes: readonly string[]) =>
  prefixes.some((prefix) => path.startsWith(prefix));

function isTextCandidate(root: string, path: string): boolean {
  if (BINARY_EXTENSIONS.has(extname(path).toLowerCase())) return false;
  const size = statSync(resolve(root, path)).size;
  return size <= MAX_TEXT_BYTES;
}

function readText(root: string, path: string): string | undefined {
  if (!isTextCandidate(root, path)) return undefined;
  const content = readFileSync(resolve(root, path), "utf8");
  return content.includes("\0") ? undefined : content;
}

function digits(value: string): number {
  return value.replace(/\D/g, "").length;
}

/** Privacy scan (BR11.1, BR11.2): data files, emails and phone numbers outside the allowed places. */
export function scanPrivacy(options: ScanOptions): ScanResult {
  const allowlist = options.allowlist ?? loadAllowlist();
  const findings: string[] = [];
  const files = repositoryFiles(options).sort();
  let scanned = 0;
  const allowedEmails = new Set(allowlist.emails.map((value) => value.toLowerCase()));
  const allowedDomains = new Set(allowlist.emailDomains.map((value) => value.toLowerCase()));
  const allowedPhones = new Set(allowlist.phoneNumbers.map((value) => value.replace(/\D/g, "")));

  for (const path of files) {
    const inFixtures = path.startsWith(FIXTURE_FOLDER);
    if (
      DATA_EXTENSIONS.has(extname(path).toLowerCase()) &&
      !inFixtures &&
      !startsWithAny(path, allowlist.allowedPaths)
    ) {
      findings.push(`${path} is a tracked data file (${extname(path)}) outside ${FIXTURE_FOLDER}`);
      continue;
    }
    if (
      inFixtures ||
      LOCK_FILES.has(path.split("/").at(-1) ?? "") ||
      startsWithAny(path, GENERATED_FOLDERS) ||
      startsWithAny(path, allowlist.ignoredPrefixes) ||
      SELF_FILES.includes(path)
    ) {
      continue;
    }
    const text = readText(options.root, path);
    if (text === undefined) continue;
    scanned++;
    for (const match of text.matchAll(EMAIL_PATTERN)) {
      const domain = match[1]!.toLowerCase();
      if (allowedEmails.has(match[0].toLowerCase()) || allowedDomains.has(domain)) continue;
      findings.push(`${path} contains an email address`);
      break;
    }
    for (const pattern of PHONE_PATTERNS) {
      const hit = [...text.matchAll(pattern)].find(
        (match) => digits(match[0]) >= 8 && !allowedPhones.has(match[0].replace(/\D/g, "")),
      );
      if (hit) {
        findings.push(`${path} contains a phone number`);
        break;
      }
    }
  }

  // Generated evidence and report folders are scanned even though they are not tracked (existing rule).
  const artifactRoots = [
    "verification/fixtures.json",
    ".verification/evidence",
    ".verification/logs",
    "verification/reports",
    "test-results",
    "playwright-report",
  ];
  for (const artifactRoot of artifactRoots) {
    for (const path of listFilesWithin(options.root, artifactRoot)) {
      if (!isTextCandidate(options.root, path)) continue;
      const text = readText(options.root, path);
      if (text === undefined) continue;
      scanned++;
      for (const pattern of [
        /[A-Z0-9._%+-]+@(?!example\.test\b)[A-Z0-9.-]+\.[A-Z]{2,}/i,
        /(?:\+36|06)[ -]?(?:1|20|30|31|50|70)[ -]?\d{3}[ -]?\d{4}\b/,
        STREET_PATTERN,
      ]) {
        if (pattern.test(text)) findings.push(`${path} matched ${pattern.source}`);
      }
    }
  }
  return { findings: [...new Set(findings)], scanned };
}

/** Secret scan (BR1.4, NFR1.6): key material and service-role key names with values. */
export function scanSecrets(options: ScanOptions): ScanResult {
  const allowlist = options.allowlist ?? loadAllowlist();
  const defaults = new Set(allowlist.defaultKeyHashes);
  const findings: string[] = [];
  let scanned = 0;
  for (const path of repositoryFiles(options).sort()) {
    if (
      SELF_FILES.includes(path) ||
      startsWithAny(path, allowlist.secretIgnoredPrefixes) ||
      startsWithAny(path, GENERATED_FOLDERS)
    ) {
      continue;
    }
    const text = readText(options.root, path);
    if (text === undefined) continue;
    scanned++;
    for (const [pattern, description] of FIXED_SECRET_PATTERNS) {
      if (pattern.test(text)) findings.push(`${path} contains ${description}`);
    }
    for (const [pattern, description] of [
      [JWT_PATTERN, "a JWT-shaped string"],
      [STACK_KEY_PATTERN, "a stack key"],
    ] as const) {
      for (const match of text.matchAll(pattern)) {
        if (!defaults.has(sha256(match[0]))) {
          findings.push(`${path} contains ${description}`);
          break;
        }
      }
    }
    for (const match of text.matchAll(SERVICE_ROLE_VALUE)) {
      if (!defaults.has(sha256(match[1]!))) {
        findings.push(`${path} contains a service-role key name with a value`);
        break;
      }
    }
  }
  return { findings: [...new Set(findings)], scanned };
}

const TEXT_EXTENSIONS = new Set([
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

function scanPatterns(
  root: string,
  paths: readonly string[],
  patterns: readonly RegExp[],
): string[] {
  const findings: string[] = [];
  for (const path of [...new Set(paths)].sort()) {
    if (!TEXT_EXTENSIONS.has(extname(path))) continue;
    const content = readFileSync(resolve(root, path), "utf8");
    for (const pattern of patterns) {
      if (pattern.test(content))
        findings.push(`${relative(root, resolve(root, path))} matched ${pattern.source}`);
    }
  }
  return findings;
}

const EXECUTABLE_ROOTS = [
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

function executableFiles(root: string): string[] {
  return EXECUTABLE_ROOTS.flatMap((path) => listFilesWithin(root, path)).filter(
    (path) => !SELF_FILES.some((own) => path.endsWith(own)),
  );
}

/** SAST (application code only) and the no-deployment check (existing rules, unchanged). */
export function scanSast(root: string): ScanResult {
  const files = executableFiles(root);
  return {
    findings: scanPatterns(
      root,
      files.filter((path) => path.startsWith("app/") || path.startsWith("src/")),
      [/\beval\s*\(/, /new\s+Function\s*\(/, /dangerouslySetInnerHTML\s*=/, /child_process/],
    ),
    scanned: files.length,
  };
}

export function scanNoDeploy(root: string): ScanResult {
  const files = executableFiles(root);
  return {
    findings: scanPatterns(root, files, [
      /\bvercel\s+(?:deploy|promote|rollback)\b/i,
      /\bsupabase\s+(?:db\s+push|functions\s+deploy|link)\b/i,
      /\bnpm\s+publish\b/i,
      /curl\s+[^\n]*(?:https?:\/\/(?!127\.0\.0\.1|localhost))/i,
    ]),
    scanned: files.length,
  };
}

export function runScan(mode: ScanMode, options: ScanOptions): ScanResult {
  if (mode === "privacy") return scanPrivacy(options);
  if (mode === "secrets") return scanSecrets(options);
  if (mode === "sast") return scanSast(options.root);
  return scanNoDeploy(options.root);
}
