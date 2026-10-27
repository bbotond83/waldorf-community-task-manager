import { spawn } from "node:child_process";
import { type Log, runAsCommand } from "./common.ts";

/**
 * The quiet stage of the 2000-row import timing test (NFR4.10, NFR4.11). The test is skipped in every other database
 * group, because a busy shared runner made its 60 s ceiling fail without any change to the import. Here it runs alone,
 * right after the other database groups, and a failed run is repeated once after a pause. The ceilings are not
 * relaxed: a real slowdown fails both attempts.
 */
export const IMPORT_TIMING_FILE = "tests/database/notifications-timing.test.ts";
export const IMPORT_TIMING_PATTERN = "2000-row workbook";
export const IMPORT_TIMING_ENV = "IMPORT_TIMING_STAGE";
export const PAUSE_MS = 30_000;
export const ATTEMPTS = 2;

export interface TimingStageDeps {
  runTest: () => Promise<number>;
  sleep: (milliseconds: number) => Promise<void>;
  log: Log;
}

export function defaultTimingStageDeps(): TimingStageDeps {
  return {
    runTest: () =>
      new Promise((resolve) => {
        const child = spawn(
          process.execPath,
          [
            "--experimental-strip-types",
            "--test",
            `--test-name-pattern=${IMPORT_TIMING_PATTERN}`,
            IMPORT_TIMING_FILE,
          ],
          { stdio: "inherit", env: { ...process.env, [IMPORT_TIMING_ENV]: "1" } },
        );
        child.on("error", () => resolve(1));
        child.on("close", (status) => resolve(status ?? 1));
      }),
    sleep: (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
    log: (line) => console.log(line),
  };
}

export async function main(
  _argv: readonly string[],
  deps: TimingStageDeps = defaultTimingStageDeps(),
): Promise<number> {
  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    const status = await deps.runTest();
    if (status === 0) {
      deps.log(`IMPORT TIMING PASSED attempt=${attempt}/${ATTEMPTS}`);
      return 0;
    }
    if (attempt < ATTEMPTS) {
      deps.log(
        `IMPORT TIMING attempt ${attempt}/${ATTEMPTS} failed; trying once more in ${PAUSE_MS / 1000} s on a quiet machine`,
      );
      await deps.sleep(PAUSE_MS);
    }
  }
  deps.log(`IMPORT TIMING FAILED after ${ATTEMPTS} attempts`);
  return 1;
}

await runAsCommand(import.meta, () => main(process.argv.slice(2)));
