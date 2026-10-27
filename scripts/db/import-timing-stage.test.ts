import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ATTEMPTS, main, PAUSE_MS, type TimingStageDeps } from "./import-timing-stage.ts";

function run(statuses: number[]) {
  const lines: string[] = [];
  const pauses: number[] = [];
  let calls = 0;
  const deps: TimingStageDeps = {
    runTest: async () => statuses[calls++] ?? 1,
    sleep: async (milliseconds) => {
      pauses.push(milliseconds);
    },
    log: (line) => lines.push(line),
  };
  return { deps, lines, pauses, calls: () => calls };
}

describe("import timing quiet stage", () => {
  it("passes on the first attempt without a pause", async () => {
    const { deps, pauses, calls } = run([0]);
    assert.equal(await main([], deps), 0);
    assert.deepEqual([calls(), pauses], [1, []]);
  });

  it("repeats a failed run once after a pause and passes when the second run passes", async () => {
    const { deps, lines, pauses, calls } = run([1, 0]);
    assert.equal(await main([], deps), 0);
    assert.deepEqual([calls(), pauses], [2, [PAUSE_MS]]);
    assert.match(lines.join("\n"), /attempt 1\/2 failed/);
  });

  it("fails when both attempts fail, and never tries a third time", async () => {
    const { deps, lines, calls } = run([1, 1, 0]);
    assert.equal(await main([], deps), 1);
    assert.equal(calls(), ATTEMPTS);
    assert.match(lines.at(-1)!, /FAILED after 2 attempts/);
  });
});
