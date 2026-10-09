import assert from "node:assert/strict";
import { it } from "node:test";
import type { Scope } from "../access/types.ts";
import { TeacherScheduleService } from "./schedule-service.ts";
const scope: Scope = { id: "group", type: "group", organizationId: "org" };
const actor = { subjectId: "teacher", authorizationVersion: 1 };
const row = {
  id: "event",
  sourceRecordId: "event",
  organizationId: "org",
  groupId: "group",
  startsAt: "2026-08-10T10:00:00Z",
  endsAt: "2026-08-10T11:00:00Z",
  title: "Feladat",
  location: "Óvoda",
  ownerDisplayName: "Anna",
  assigneeDisplayNames: ["Béla"],
  currentStatusLabel: "Nyitott",
  email: "secret@example.test",
};
function service(allowed = true, entries = [row]) {
  return new TeacherScheduleService(
    { list: () => entries },
    {
      authorize: () =>
        allowed
          ? { allowed: true, code: "allowed" }
          : { allowed: false, code: "authorization_denied" },
    },
  );
}
const query = { groupScope: scope, from: "2026-08-01", to: "2026-08-31" };
it("Teacher returns immutable allowlisted fields", () => {
  const result = service().get(actor, query);
  assert.equal(result.state, "ready");
  if (result.state === "ready") {
    assert.equal(result.entries[0]?.ownerDisplayName, "Anna");
    assert.equal("email" in result.entries[0]!, false);
    assert.equal("sourceRecordId" in result.entries[0]!, false);
    assert.ok(Object.isFrozen(result.entries));
  }
});
it("Teacher denies before validating or calling repository", () => {
  let reads = 0;
  const denied = new TeacherScheduleService(
    {
      list: () => {
        reads++;
        return [row];
      },
    },
    { authorize: () => ({ allowed: false, code: "authorization_denied" }) },
  );
  assert.equal(denied.get(actor, { ...query, from: "bad" }).state, "denied");
  assert.equal(reads, 0);
});
it("Teacher rejects invalid and unbounded calendars", () => {
  for (const from of ["bad", "2026-02-30", "2026-06-31", "2026-01-01"])
    assert.equal(service().get(actor, { ...query, from }).state, "invalid-filter");
});
it("Teacher returns authorized empty", () =>
  assert.deepEqual(service(true, []).get(actor, query), { state: "empty" }));
it("Teacher denies whole mixed organization result", () =>
  assert.equal(
    service(true, [row, { ...row, organizationId: "other" }]).get(actor, query).state,
    "denied",
  ));
it("Teacher fails closed on malformed data", () =>
  assert.equal(
    service(true, [{ ...row, endsAt: "bad" }]).get(actor, query).state,
    "dependency-failure-terminal",
  ));
it("Teacher preserves missing source values", () => {
  const result = service(true, [
    {
      ...row,
      ownerDisplayName: null,
      assigneeDisplayNames: [],
      currentStatusLabel: null,
    } as unknown as typeof row,
  ]).get(actor, query);
  assert.equal(result.state, "ready");
  if (result.state === "ready") assert.equal(result.entries[0]?.ownerDisplayName, null);
});
it("Teacher catches unavailable repository without fallback", () => {
  const failed = new TeacherScheduleService(
    {
      list: () => {
        throw Error("private");
      },
    },
    { authorize: () => ({ allowed: true, code: "allowed" }) },
  );
  assert.deepEqual(failed.get(actor, query), { state: "dependency-failure-terminal" });
});
