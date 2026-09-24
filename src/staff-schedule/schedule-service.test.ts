import assert from "node:assert/strict";
import test from "node:test";
import type { Scope } from "../access/types.ts";
import { StaffScheduleService } from "./schedule-service.ts";
const scope: Scope = { id: "group", type: "group", organizationId: "org" }; const actor = { subjectId: "staff", authorizationVersion: 1 };
const entry = { id: "event", groupId: "group", startsAt: "2026-08-10T10:00:00Z", endsAt: "2026-08-10T11:00:00Z", title: "Feladat", location: "Óvoda", coordinationDisplayName: "Anna", email: "secret@example.test", familyId: "family" };
function service(allowed = true, entries = [entry]) { return new StaffScheduleService({ list: () => entries }, { authorize: () => allowed ? { allowed: true, code: "allowed" } : { allowed: false, code: "authorization_denied", message: "Nincs jogosultság" } }); }
test("returns only schedule projection fields for scoped staff", () => { const result = service().get(actor, { groupScope: scope, from: "2026-08-01", to: "2026-08-31" }); assert.equal(result.state, "ready"); if (result.state === "ready") assert.deepEqual(result.entries[0], { id: "event", groupId: "group", startsAt: entry.startsAt, endsAt: entry.endsAt, title: "Feladat", location: "Óvoda", coordinationDisplayName: "Anna" }); });
test("returns generic denial without schedule existence", () => { assert.deepEqual(service(false).get(actor, { groupScope: scope, from: "2026-08-01", to: "2026-08-31" }), { state: "denied", message: "Nincs jogosultság" }); });
test("rejects invalid and unbounded date ranges", () => { assert.equal(service().get(actor, { groupScope: scope, from: "bad", to: "2026-08-31" }).state, "invalid-filter"); assert.equal(service().get(actor, { groupScope: scope, from: "2026-01-01", to: "2026-03-31" }).state, "invalid-filter"); });
test("returns explicit empty state", () => { assert.deepEqual(service(true, []).get(actor, { groupScope: scope, from: "2026-08-01", to: "2026-08-31" }), { state: "empty" }); });
