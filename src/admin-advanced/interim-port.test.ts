import assert from "node:assert/strict";
import test from "node:test";
import type { Scope } from "../access/index.ts";
import type { AdminOperation } from "../application/index.ts";
import { getInterimAdvancedPort } from "./index.ts";

const ORG = "aaaaaaaa-0000-4000-8000-000000000001";
const SCOPE: Scope = { id: ORG, type: "organization", organizationId: ORG };

const run = (operation: AdminOperation, payload: Record<string, unknown> = {}) =>
  getInterimAdvancedPort().execute<unknown>({ actorId: "any", operation, scope: SCOPE, payload });

test("reading the import status or the reminders answers the empty state, with no fixture data", async () => {
  assert.deepEqual(await run("import.status"), { state: "empty" });
  assert.deepEqual(await run("reminders.list"), { state: "empty" });
});

test("anything that would change something is denied, so no screen reports a success that changed nothing", async () => {
  for (const operation of [
    "import.preview",
    "import.resolve",
    "import.commit",
    "import.recover",
    "reminders.retry",
  ] as const) {
    assert.deepEqual(await run(operation, { scenario: "valid" }), { state: "denied" }, operation);
  }
});

test("one admin's attempt leaves nothing for the next admin: the port keeps no state", async () => {
  await run("import.preview", { scenario: "valid" });
  assert.deepEqual(await run("import.status"), { state: "empty" });
});
