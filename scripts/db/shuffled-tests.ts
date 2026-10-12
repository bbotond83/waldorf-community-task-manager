import { spawn } from "node:child_process";
import { type Log, parseArguments, runAsCommand } from "./common.ts";

/**
 * Runs the database test files once in a random order, one file after the other (NFR3.4: the tests
 * do not depend on each other or on run order). The seed is printed so a failing order can be
 * replayed with `--seed <number>`.
 */
export const DATABASE_TEST_FILES = [
  "tests/database/migrations.test.ts",
  "tests/database/audit.test.ts",
  "tests/database/idempotency.test.ts",
  "tests/database/holds.test.ts",
  "tests/database/worker.test.ts",
] as const;

/** A small seeded generator (mulberry32), so a printed seed reproduces the order. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(items: readonly T[], seed: number): T[] {
  const random = seededRandom(seed);
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [result[index], result[other]] = [result[other]!, result[index]!];
  }
  return result;
}

export interface ShuffleDeps {
  runTestFile: (file: string) => Promise<number>;
  log: Log;
  newSeed: () => number;
}

export function defaultShuffleDeps(): ShuffleDeps {
  return {
    runTestFile: (file) =>
      new Promise((resolve) => {
        const child = spawn(process.execPath, ["--experimental-strip-types", "--test", file], {
          stdio: "inherit",
        });
        child.on("error", () => resolve(1));
        child.on("close", (status) => resolve(status ?? 1));
      }),
    log: (line) => console.log(line),
    newSeed: () => Math.floor(Math.random() * 2 ** 31),
  };
}

export async function main(
  argv: readonly string[],
  deps: ShuffleDeps = defaultShuffleDeps(),
): Promise<number> {
  const { flags } = parseArguments(argv);
  const requested = Number(flags.get("seed"));
  const seed = Number.isInteger(requested) && flags.has("seed") ? requested : deps.newSeed();
  const order = shuffle(DATABASE_TEST_FILES, seed);
  deps.log(`database tests in random order (replay with --seed ${seed}):`);
  for (const file of order) deps.log(`  ${file}`);
  for (const file of order) {
    const status = await deps.runTestFile(file);
    if (status !== 0) {
      deps.log(`SHUFFLED RUN FAILED step=${file} seed=${seed}`);
      return 1;
    }
  }
  deps.log(`SHUFFLED RUN PASSED files=${order.length} seed=${seed}`);
  return 0;
}

await runAsCommand(import.meta, () => main(process.argv.slice(2)));
