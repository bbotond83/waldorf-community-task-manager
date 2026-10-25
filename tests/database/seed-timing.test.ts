import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import { resetSchema } from "../../scripts/db/reset.ts";
import { SEED_TARGETS_MS } from "../../scripts/db/seed-support.ts";
import { seedSchema } from "../../scripts/db/seed.ts";
import { seedAccount } from "../../scripts/db/seed/index.ts";
import { resetWorkerData } from "../../scripts/db/worker.ts";
import { realSeedDeps, rowCount, signInAs } from "./seed-support.ts";
import { lockSchemas, openDatabase, prepareSchema, report, useSchema } from "./stack-support.ts";

/**
 * The timing limits of the seed, the reset and a real sign-in on seeded data (NFR4.17 to NFR4.19). Each test fails above
 * its limit and prints the duration. The limits are those of the requirements and are never raised to make a run pass.
 */
const SCHEMA = "worker_4";

describe("seed and reset timing on the real stack", () => {
  let db: pg.Client;

  before(async () => {
    db = await openDatabase();
    await lockSchemas(db, [SCHEMA]);
    await prepareSchema(db, SCHEMA);
  });
  after(async () => {
    await db.end();
  });
  beforeEach(async () => {
    await useSchema(db, SCHEMA);
    await resetWorkerData(db, SCHEMA);
  });

  const seconds = (milliseconds: number) => (milliseconds / 1000).toFixed(2);

  it("seeds the small set within 60 seconds (NFR4.17)", async () => {
    const started = performance.now();
    await seedSchema(realSeedDeps().deps, { schema: SCHEMA, size: "small" });
    const elapsed = performance.now() - started;
    report(
      `seed small in ${SCHEMA}: ${seconds(elapsed)} s (limit ${SEED_TARGETS_MS.seed / 1000} s)`,
    );
    assert.ok(elapsed < SEED_TARGETS_MS.seed, `seed took ${seconds(elapsed)} s`);
    assert.equal(await rowCount(db, SCHEMA, "families"), 6);
  });

  it("resets a seeded schema within 30 seconds (NFR4.18)", async () => {
    await seedSchema(realSeedDeps().deps, { schema: SCHEMA, size: "small" });
    const started = performance.now();
    await resetSchema(realSeedDeps().deps, { schema: SCHEMA });
    const elapsed = performance.now() - started;
    report(`reset in ${SCHEMA}: ${seconds(elapsed)} s (limit ${SEED_TARGETS_MS.reset / 1000} s)`);
    assert.ok(elapsed < SEED_TARGETS_MS.reset, `reset took ${seconds(elapsed)} s`);
    assert.equal(await rowCount(db, SCHEMA, "families"), 0);
  });

  it("seeds the 30-family set within 120 seconds (NFR4.18)", async () => {
    const started = performance.now();
    await seedSchema(realSeedDeps().deps, { schema: SCHEMA, size: "large" });
    const elapsed = performance.now() - started;
    report(
      `seed 30 families in ${SCHEMA}: ${seconds(elapsed)} s (limit ${SEED_TARGETS_MS.seedLarge / 1000} s)`,
    );
    assert.ok(elapsed < SEED_TARGETS_MS.seedLarge, `the large seed took ${seconds(elapsed)} s`);
    assert.equal(await rowCount(db, SCHEMA, "families"), 30);
  });

  it("signs a seeded account in for real within 5000 ms (NFR4.19)", async () => {
    await seedSchema(realSeedDeps().deps, { schema: SCHEMA, size: "small" });
    const account = seedAccount(SCHEMA, "super-admin");
    const started = performance.now();
    const result = await signInAs(account.email, account.password);
    const elapsed = performance.now() - started;
    report(
      `sign-in on seeded data in ${SCHEMA}: ${Math.round(elapsed)} ms (limit ${SEED_TARGETS_MS.signIn} ms)`,
    );
    assert.ok(result.ok, "the seeded account signs in");
    assert.ok(elapsed < SEED_TARGETS_MS.signIn, `sign-in took ${Math.round(elapsed)} ms`);
  });
});
