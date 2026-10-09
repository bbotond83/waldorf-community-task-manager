import assert from "node:assert/strict";
import test from "node:test";
import type { Scope } from "../access/types.ts";
import { AdminExperienceService } from "./admin-service.ts";
const scope: Scope = { id: "group", type: "group", organizationId: "org" }; const actor = { subjectId: "admin", authorizationVersion: 1 };
function service(allowed = true) { return new AdminExperienceService({ listQueue: () => [{ id: "approval", scopeId: "group", kind: "approval", status: "open", title: "Swap" }, { id: "resolved", scopeId: "group", kind: "import_conflict", status: "resolved", title: "Old" }], findSchoolYear: (id) => id === "year" ? { id, scopeId: "group", name: "2025/26", archivedAt: "2026-08-01T00:00:00Z" } : undefined }, { authorize: () => allowed ? { allowed: true, code: "allowed" } : { allowed: false, code: "authorization_denied", message: "Nincs jogosultság" } }); }
test("filters scoped open admin queues", () => { assert.deepEqual(service().getQueue(actor, scope, "approval"), { state: "ready", value: [{ id: "approval", scopeId: "group", kind: "approval", status: "open", title: "Swap" }] }); });
test("returns generic scope denial", () => { assert.deepEqual(service(false).getQueue(actor, scope), { state: "denied", message: "Nincs jogosultság" }); });
test("returns archived school year as read-only projection", () => { assert.deepEqual(service().getSchoolYear(actor, scope, "year"), { state: "ready", value: { id: "year", scopeId: "group", name: "2025/26", archivedAt: "2026-08-01T00:00:00Z" } }); });
test("does not disclose other or missing school years", () => { assert.deepEqual(service().getSchoolYear(actor, scope, "other"), { state: "denied", message: "Nincs jogosultság" }); });

test("dispatches each core and advanced operation using its exact resource", () => {
 const requests: string[] = []; const calls: string[] = [];
 const instance = new AdminExperienceService({ listQueue: () => [], findSchoolYear: () => undefined }, { authorize: (_actor, request) => { requests.push(request.resource.kind); return { allowed: true, code: "allowed" }; } }, { execute: (_actor, _scope, operation) => { calls.push(operation); return true; } });
 for (const operation of ["record", "approval", "archive", "role", "import", "privacy"] as const) assert.equal(instance.operate(actor, scope, operation).state, "ready");
 assert.deepEqual(requests, ["record", "approval", "archive", "role_grant", "import", "lifecycle"]); assert.deepEqual(calls, ["record", "approval", "archive", "role", "import", "privacy"]);
});
test("denied and unsupported operations cannot mutate downstream state", () => {
 let calls = 0; let authorizations = 0;
 const instance = new AdminExperienceService({ listQueue: () => [], findSchoolYear: () => undefined }, { authorize: () => { authorizations++; return { allowed: false, code: "authorization_denied" }; } }, { execute: () => { calls++; return true; } });
 for (const operation of ["record", "approval", "archive", "role", "import", "privacy"] as const) assert.equal(instance.operate(actor, scope, operation).state, "denied");
 for (const operation of ["unknown", "toString", "__proto__"] as never[]) assert.equal(instance.operate(actor, scope, operation).state, "denied");
 assert.equal(calls, 0); assert.equal(authorizations, 6);
});
test("missing or refusing execution seam remains a generic denial", () => {
 assert.equal(service().operate(actor, scope, "record").state, "denied");
 const instance = new AdminExperienceService({ listQueue: () => [], findSchoolYear: () => undefined }, { authorize: () => ({ allowed: true, code: "allowed" }) }, { execute: () => false });
 assert.equal(instance.operate(actor, scope, "archive").state, "denied");
});
