import { runScan, SCAN_MODES, type ScanMode } from "./scan-core.ts";

const mode = process.argv[2];
if (!mode || !(SCAN_MODES as readonly string[]).includes(mode))
  throw new Error("usage: scan-artifacts.ts <privacy|secrets|sast|no-deploy>");

/** Reported target for the privacy and secret scans together (NFR4.4); never a failure. */
const SCAN_TARGET_MS = 15_000;

const started = Date.now();
const { findings, scanned } = runScan(mode as ScanMode, { root: process.cwd() });

if (findings.length > 0)
  throw new Error(`${mode.toUpperCase()}_SCAN_FAILED\n${findings.join("\n")}`);
console.log(`${mode.toUpperCase()}_SCAN_PASS files=${scanned}`);
const elapsed = Date.now() - started;
console.log(
  `TIMING scan(${mode}) ${(elapsed / 1000).toFixed(1)} s (target ${SCAN_TARGET_MS / 1000}.0 s for privacy and secrets together: ${elapsed <= SCAN_TARGET_MS ? "met" : "MISSED, reported only"})`,
);
