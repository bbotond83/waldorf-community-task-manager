import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { workerAccountEmail } from "../worker.ts";
import { SEED_NAMESPACE, seedEmail, seedId, uuidV5 } from "./ids.ts";

const UUID_V5 = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("seed identifiers", () => {
  it("computes version 5 uuids the way RFC 4122 defines them (the published DNS example)", () => {
    assert.equal(
      uuidV5("www.example.com", "6ba7b810-9dad-11d1-80b4-00c04fd430c8"),
      "2ed6657d-e927-568b-95e1-2665a8aea6a2",
    );
  });

  it("derives the same id for the same schema and key, every time", () => {
    assert.equal(seedId("worker_1", "family:3"), seedId("worker_1", "family:3"));
    assert.match(seedId("worker_1", "family:3"), UUID_V5);
    assert.match(SEED_NAMESPACE, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it("derives different ids for different keys and never the same id in two schemas", () => {
    const ids = new Set<string>();
    for (const schema of ["public", "worker_1", "worker_2", "worker_3", "worker_4"]) {
      for (const key of ["organization", "family:1", "family:2", "account:super-admin"]) {
        ids.add(seedId(schema, key));
      }
    }
    assert.equal(ids.size, 5 * 4);
  });

  it("keeps schema names that share a prefix apart", () => {
    assert.notEqual(seedId("worker_1", "2:family"), seedId("worker_12", ":family"));
    assert.notEqual(seedId("worker_1", "family:1"), seedId("worker_2", "family:1"));
  });

  it("builds a sign-in address that starts with the schema prefix the worker reset removes", () => {
    assert.equal(seedEmail("worker_2", "super-admin"), "worker_2.super-admin@example.test");
    assert.equal(seedEmail("public", "parent-1"), "public.parent-1@example.test");
    assert.ok(seedEmail("worker_1", "x").startsWith("worker_1."));
    assert.ok(!seedEmail("worker_1", "x").startsWith("worker_2."));
  });

  it("uses the address namespace of db:worker, so a reset removes exactly the accounts of its own schema", () => {
    for (const schema of ["public", "worker_1", "worker_4"]) {
      for (const tag of ["super-admin", "parent-3", "teacher-1"]) {
        assert.equal(seedEmail(schema, tag), workerAccountEmail(schema, tag));
        assert.ok(seedEmail(schema, tag).startsWith(`${schema}.`));
      }
    }
  });
});
