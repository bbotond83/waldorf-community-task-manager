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
