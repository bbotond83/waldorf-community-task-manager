import assert from "node:assert/strict";
import test from "node:test";
import { AUTHORIZATION_MATRIX } from "../application/authorization.ts";
import { grantAllows } from "./role-policy.ts";
import type { AuthorizationAction, Role, RoleGrant, Scope } from "./types.ts";

// U3 (BR32.7): the parent row and the role policy gained the actions "respond" (answer a swap request
// addressed to your family) and "withdraw" (take back your own open request).
const group: Scope = { id: "oak", type: "group", organizationId: "org" };
const family: Scope = { id: "family-1", type: "family", organizationId: "org" };
const otherFamily: Scope = { id: "family-2", type: "family", organizationId: "org" };
const org: Scope = { id: "org", type: "organization", organizationId: "org" };

const grant = (role: Role, scope: Scope): RoleGrant => ({
  id: "grant",
  subjectId: "user",
  role,
  scope,
  grantedAt: "2026-10-22",
});

const allows = (
  held: RoleGrant,
  action: AuthorizationAction,
  kind: string,
  scope: Scope,
  field?: string,
) => grantAllows(held, { action, resource: { kind, scope, ...(field ? { field } : {}) } });

test("a parent may answer a swap request and withdraw a swap or cancellation request of their own family", () => {
  const parent = grant("parent", family);
  assert.equal(allows(parent, "respond", "swap_request", family), true);
  assert.equal(allows(parent, "withdraw", "swap_request", family), true);
  assert.equal(allows(parent, "withdraw", "cancellation_request", family), true);
});

test("a cancellation request cannot be answered: only a swap has a second family", () => {
  assert.equal(allows(grant("parent", family), "respond", "cancellation_request", family), false);
});

test("create and read of requests stay as they were, and the new actions open nothing else", () => {
  const parent = grant("parent", family);
  assert.equal(allows(parent, "create", "swap_request", family), true);
  assert.equal(allows(parent, "read", "cancellation_request", family), true);
  for (const kind of ["assignment", "contribution", "notification", "family", "schedule", "record"]) {
    assert.equal(allows(parent, "respond", kind, family), false, `respond ${kind}`);
    assert.equal(allows(parent, "withdraw", kind, family), false, `withdraw ${kind}`);
  }
});

test("a parent cannot answer or withdraw for another family", () => {
  const parent = grant("parent", family);
  assert.equal(allows(parent, "respond", "swap_request", otherFamily), false);
  assert.equal(allows(parent, "withdraw", "swap_request", otherFamily), false);
});

test("no other role holds the new actions, not even a super admin who may do everything else", () => {
  for (const held of [
    grant("group_admin", group),
    grant("kindergarten_teacher", group),
    grant("super_admin", org),
  ]) {
    const kinds = ["swap_request", "cancellation_request", "assignment", "approval", "record"];
    for (const kind of kinds) {
      assert.equal(allows(held, "respond", kind, group), false, `${held.role} respond ${kind}`);
      assert.equal(allows(held, "withdraw", kind, group), false, `${held.role} withdraw ${kind}`);
    }
  }
  assert.equal(allows(grant("super_admin", org), "manage", "approval", group), true);
});

test("an action nobody knows is refused for every role", () => {
  for (const held of [grant("parent", family), grant("super_admin", org)]) {
    assert.equal(allows(held, "approve" as AuthorizationAction, "swap_request", family), false);
  }
});

test("the parent row of the matrix lists the new actions and no other row does", () => {
  const rows = AUTHORIZATION_MATRIX.filter((row) => row.actions.some((action) => action === "respond" || action === "withdraw"));
  assert.deepEqual(
    rows.map((row) => row.id),
    ["AUTH-PARENT-DUTIES"],
  );
  const parentRow = AUTHORIZATION_MATRIX.find((row) => row.id === "AUTH-PARENT-DUTIES")!;
  assert.deepEqual(parentRow.actions, ["read", "create", "update", "respond", "withdraw"]);
  assert.ok(parentRow.resources.includes("swap_request"));
  assert.ok(parentRow.resources.includes("cancellation_request"));
});
