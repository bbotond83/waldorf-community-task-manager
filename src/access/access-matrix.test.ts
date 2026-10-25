import assert from "node:assert/strict";
import test from "node:test";
import {
  AccessService,
  InMemoryAuditWriter,
  InMemoryRoleGrantRepository,
  InMemoryUserRepository,
} from "./index.ts";
const scope = { id: "family", type: "family" as const, organizationId: "org" };
const service = new AccessService(
  new InMemoryUserRepository([{ id: "parent", isActive: true, authorizationVersion: 1 }]),
  new InMemoryRoleGrantRepository([
    { id: "g", subjectId: "parent", role: "parent", scope, grantedAt: "2026-01-01T00:00:00Z" },
  ]),
  new InMemoryAuditWriter(),
);
test("enforces parent action-resource-field matrix", () => {
  const actor = { subjectId: "parent", authorizationVersion: 1 };
  assert.equal(
    service.authorize(actor, { action: "update", resource: { kind: "contribution", scope } })
      .allowed,
    true,
  );
  assert.equal(
    service.authorize(actor, { action: "update", resource: { kind: "assignment", scope } }).allowed,
    false,
  );
  assert.equal(
    service.authorize(actor, {
      action: "read",
      resource: { kind: "family", scope, field: "email" },
    }).allowed,
    false,
  );
});
