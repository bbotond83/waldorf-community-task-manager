import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  DATABASE_TEST_FILES,
  defaultShuffleDeps,
  main,
  seededRandom,
  shuffle,
  type ShuffleDeps,
} from "./shuffled-tests.ts";

function fakeDeps(failing?: string) {
  const lines: string[] = [];
  const ran: string[] = [];
  const deps: ShuffleDeps = {
    runTestFile: async (file) => {
      ran.push(file);
      return file === failing ? 1 : 0;
    },
    log: (line) => lines.push(line),
    newSeed: () => 7,
  };
  return { deps, lines, ran };
}

describe("shuffled database test run", () => {
  it("lists exactly the files of the database test script", () => {
    const script = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"))
      .scripts["test:database:stack"] as string;
    const listed = script.split(" ").filter((part) => part.startsWith("tests/database/"));
    assert.deepEqual([...listed].sort(), [...DATABASE_TEST_FILES].sort());
  });

  it("produces the same order for the same seed, and a permutation of the files", () => {
    assert.deepEqual(shuffle(DATABASE_TEST_FILES, 42), shuffle(DATABASE_TEST_FILES, 42));
    assert.deepEqual([...shuffle(DATABASE_TEST_FILES, 42)].sort(), [...DATABASE_TEST_FILES].sort());
    const orders = new Set(
      Array.from({ length: 20 }, (_, seed) => shuffle(DATABASE_TEST_FILES, seed).join()),
    );
    assert.ok(orders.size > 1, "different seeds give different orders");
  });

  it("generates numbers between zero and one", () => {
    const random = seededRandom(1);
    for (let n = 0; n < 100; n++) {
      const value = random();
      assert.ok(value >= 0 && value < 1);
    }
  });

  it("runs every file once in the shuffled order and prints the seed", async () => {
    const fake = fakeDeps();
    assert.equal(await main([], fake.deps), 0);
    assert.deepEqual(fake.ran, shuffle(DATABASE_TEST_FILES, 7));
    assert.match(fake.lines[0]!, /--seed 7/);
    assert.match(fake.lines.at(-1)!, /SHUFFLED RUN PASSED files=5 seed=7/);
  });

  it("uses a given seed and stops at the first failing file, naming it", async () => {
    const order = shuffle(DATABASE_TEST_FILES, 99);
    const fake = fakeDeps(order[1]);
    assert.equal(await main(["--seed", "99"], fake.deps), 1);
    assert.deepEqual(fake.ran, order.slice(0, 2));
    assert.match(fake.lines.at(-1)!, new RegExp(`SHUFFLED RUN FAILED step=${order[1]} seed=99`));
  });

  it("ignores a seed that is not a whole number", async () => {
    const fake = fakeDeps();
    assert.equal(await main(["--seed", "abc"], fake.deps), 0);
    assert.match(fake.lines[0]!, /--seed 7/);
  });

  it("runs a real test file in a child process and reports its status", async () => {
    const deps = defaultShuffleDeps();
    assert.equal(await deps.runTestFile("scripts/db/does-not-exist.test.ts"), 1);
    assert.ok(deps.newSeed() >= 0);
    const original = console.log;
    let printed = "";
    console.log = (line: string) => {
      printed = line;
    };
    try {
      deps.log("shuffle line");
    } finally {
      console.log = original;
    }
    assert.equal(printed, "shuffle line");
  });
});
