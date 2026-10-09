import assert from "node:assert/strict";
import test from "node:test";
import { sessionGrantBindings } from "../access/session-grants.ts";
import type { Scope, Role } from "../access/types.ts";
import {
  AdminApplicationFacade,
  AuthorizationContract,
  FacadePipeline,
  InMemoryAuthorizationVersions,
  type SessionContext,
  type AdminApplicationPort,
} from "./index.ts";
const orgA: Scope = { id: "orgA", type: "organization", organizationId: "orgA" };
const groupB: Scope = { id: "groupB", type: "group", organizationId: "orgB" };
const orgB: Scope = { id: "orgB", type: "organization", organizationId: "orgB" };
function actor(role: Role, scope: Scope): SessionContext {
  return {
    subjectId: "actor",
    authorizationVersion: 1,
    ...sessionGrantBindings("actor", role, [scope]),
    roles: [role],
    scopes: [scope],
    runtimeMode: "synthetic",
    isSynthetic: true,
  };
}
function setup() {
  const calls: string[] = [];
  const versions = new InMemoryAuthorizationVersions({ actor: 1 });
  const domain: AdminApplicationPort = {
    execute: async <T>(input: { operation: string }) => {
      calls.push(input.operation);
      return { state: "success", data: { completed: true } as T };
    },
  };
  const facade = new AdminApplicationFacade(
    new FacadePipeline(new AuthorizationContract(versions)),
    domain,
  );
  return { calls, versions, facade };
}
const command = (scope: Scope) => ({
  scope,
  id: "record",
  expectedVersion: 1,
  idempotencyKey: "command-key",
});
function mixed() {
  const superActor = actor("super_admin", orgA);
  const groupActor = actor("group_admin", groupB);
  return {
    ...superActor,
    grants: [...superActor.grants, ...groupActor.grants],
    roles: ["super_admin", "group_admin"] as const,
    scopes: [orgA, groupB],
  };
}
test("mixed organizations choose authorized Group core without unrelated Super privilege", async () => {
  for (const grants of [mixed().grants, [...mixed().grants].reverse()]) {
    const s = setup();
    const session = { ...mixed(), grants };
    assert.equal((await s.facade.listRecords(session, groupB)).state, "success");
    assert.equal((await s.facade.saveRecord(session, command(groupB))).state, "success");
    assert.equal((await s.facade.import.status(session, orgB)).state, "denied");
    assert.equal((await s.facade.governance.list(session, orgB)).state, "denied");
    assert.deepEqual(s.calls, ["records.list", "records.save"]);
  }
});
test("Super administrator retains core advanced and governance only in its organization", async () => {
  const s = setup();
  const session = actor("super_admin", orgA);
  for (const result of [
    await s.facade.getDashboard(session, orgA),
    await s.facade.import.status(session, orgA),
    await s.facade.reminders.list(session, orgA),
    await s.facade.lifecycle.list(session, orgA),
    await s.facade.settings.get(session, orgA),
    await s.facade.governance.list(session, orgA),
  ])
    assert.equal(result.state, "success");
  const count = s.calls.length;
  assert.equal((await s.facade.settings.get(session, orgB)).state, "denied");
  assert.equal(s.calls.length, count);
});
test("Parent Teacher and Group admin direct advanced mutations never invoke domain", async () => {
  for (const [role, scope] of [
    ["parent", { id: "family", type: "family", organizationId: "orgB" }],
    ["kindergarten_teacher", groupB],
    ["group_admin", groupB],
  ] as const) {
    const s = setup();
    const session = actor(role, scope);
    for (const result of [
      await s.facade.import.commit(session, command(orgB)),
      await s.facade.reminders.retry(session, command(orgB)),
      await s.facade.lifecycle.run(session, command(orgB)),
      await s.facade.settings.save(session, command(orgB)),
      await s.facade.governance.updateGrant(session, command(orgB)),
    ])
      assert.equal(result.state, "denied");
    assert.deepEqual(s.calls, []);
  }
});
test("wrong subject revoked inactive or malformed grants never create Super selection", async () => {
  const session = actor("super_admin", orgA);
  for (const context of [
    { ...session, grants: session.grants.map((g) => ({ ...g, subjectId: "other" })) },
    { ...session, grants: session.grants.map((g) => ({ ...g, revokedAt: "now" })) },
    { ...session, isActive: false },
    { ...session, grants: session.grants.map((g) => ({ ...g, scope: { ...orgA, id: "wrong" } })) },
  ]) {
    const s = setup();
    assert.equal((await s.facade.getDashboard(context, orgA)).state, "denied");
    assert.deepEqual(s.calls, []);
  }
});
test("stale authorization version invalidates before source and mutation", async () => {
  const s = setup();
  s.versions.setVersion("actor", 2);
  assert.equal((await s.facade.getDashboard(mixed(), groupB)).state, "invalidated");
  assert.equal((await s.facade.saveRecord(mixed(), command(groupB))).state, "invalidated");
  assert.deepEqual(s.calls, []);
});
test("unknown or ungranted scopes deny without protected data", async () => {
  const s = setup();
  for (const scope of [
    { ...groupB, id: "ungranted" },
    { ...groupB, type: "unsupported" } as never,
    { ...groupB, organizationId: "other" },
  ]) {
    const result = await s.facade.listRecords(actor("group_admin", groupB), scope);
    assert.equal(result.state, "denied");
    assert.equal("data" in result, false);
  }
  assert.deepEqual(s.calls, []);
});
test("revoked unrelated Super cannot shadow a surviving Group grant", async () => {
  const s = setup();
  const session = mixed();
  const revoked = {
    ...session,
    grants: session.grants.map((g) => (g.role === "super_admin" ? { ...g, revokedAt: "now" } : g)),
  };
  assert.equal((await s.facade.listRecords(revoked, groupB)).state, "success");
  assert.equal((await s.facade.import.status(revoked, orgA)).state, "denied");
  assert.deepEqual(s.calls, ["records.list"]);
});
