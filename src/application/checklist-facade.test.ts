import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Role, Scope } from "../access/index.ts";
import { sessionGrantBindings } from "../access/session-grants.ts";
import {
  AuthorizationContract,
  ChecklistApplicationFacade,
  FacadePipeline,
  InMemoryAuthorizationVersions,
  type ChecklistApplicationPort,
  type DomainOutcome,
  type SessionContext,
} from "./index.ts";
import type { ChecklistChangeModel, ChecklistModel } from "./contracts.ts";

const organization: Scope = { id: "org-1", type: "organization", organizationId: "org-1" };
const family: Scope = { id: "family-1", type: "family", organizationId: "org-1" };
const group: Scope = { id: "group-1", type: "group", organizationId: "org-1" };
const KEY = "key-0001-abcdefgh";
const CHANGE: ChecklistChangeModel = { id: "x-1", version: 2 };
const CHECKLIST: ChecklistModel = {
  eventId: "event-1",
  eventTitle: "Őszi vásár",
  checklistVersion: 1,
  isEmpty: true,
  isOpen: true,
  isFinished: false,
  isCancelled: false,
  isSummer: false,
  sections: [],
  caller: { inTeam: false, canManage: false, canClaimTasks: true },
};

function session(role: Role, scope: Scope): SessionContext {
  return {
    subjectId: `${role}-synthetic`,
    authorizationVersion: 1,
    ...sessionGrantBindings(`${role}-synthetic`, role, [scope]),
    roles: [role],
    scopes: [scope],
  };
}

function setup(role: Role) {
  const calls: Record<string, unknown>[] = [];
  const record =
    (name: string) =>
    async (input: unknown): Promise<DomainOutcome<ChecklistChangeModel>> => {
      calls.push({ [name]: input });
      return { state: "success", data: CHANGE };
    };
  const read =
    <T>(name: string, data: T) =>
    async (...input: unknown[]): Promise<DomainOutcome<T>> => {
      calls.push({ [name]: input });
      return { state: "success", data };
    };
  const port: ChecklistApplicationPort = {
    checklist: read("checklist", CHECKLIST),
    templates: read("templates", { items: [], canManageCommunity: false, managedGroupIds: [] }),
    templatesForGroup: read("templatesForGroup", {
      items: [],
      canManageCommunity: false,
      managedGroupIds: [],
    }),
    template: read("template", { id: "t", name: "N", isRemoved: false, version: 1, sections: [] }),
    templateOptions: read("templateOptions", { items: [] }),
    saveTemplate: record("saveTemplate"),
    setTemplateRemoved: record("setTemplateRemoved"),
    copyTemplate: record("copyTemplate"),
    saveSection: record("saveSection"),
    removeSection: record("removeSection"),
    saveTask: record("saveTask"),
    removeTask: record("removeTask"),
    reorder: record("reorder"),
    claim: record("claim"),
    claimTyped: record("claimTyped"),
    changeClaim: record("changeClaim"),
    withdrawClaim: record("withdrawClaim"),
    markDone: record("markDone"),
    undoDone: record("undoDone"),
  };
  const versions = new InMemoryAuthorizationVersions({ [`${role}-synthetic`]: 1 });
  const facade = new ChecklistApplicationFacade(
    new FacadePipeline(new AuthorizationContract(versions)),
    port,
  );
  return { facade, calls };
}

const ROLES = [
  ["parent", family],
  ["kindergarten_teacher", organization],
  ["group_admin", group],
  ["super_admin", organization],
] as const;

describe("the checklist facade", () => {
  it("lets every signed-in role read a checklist and the template reads", async () => {
    for (const [role, scope] of ROLES) {
      const { facade, calls } = setup(role);
      const s = session(role, scope);
      const read = await facade.checklist(s, scope, "event-1");
      assert.equal(read.state, "success", role);
      if (read.state === "success") assert.equal(Object.isFrozen(read.data), true);
      assert.equal((await facade.templates(s, scope)).state, "success");
      assert.equal((await facade.templatesForGroup(s, scope, "group-1")).state, "success");
      assert.equal((await facade.template(s, scope, "t-1")).state, "success");
      assert.equal((await facade.templateOptions(s, scope, "group-1")).state, "success");
      assert.equal(calls.length, 5);
    }
  });

  it("lets a parent claim, change, give up, mark done and undo, and passes only the key, ids and versions on", async () => {
    const { facade, calls } = setup("parent");
    const s = session("parent", family);
    const results = await Promise.all([
      facade.claim(s, {
        scope: family,
        idempotencyKey: KEY,
        taskId: "t-1",
        note: "n",
        chosenAt: "2026-11-02T09:00:00Z",
      }),
      facade.claim(s, { scope: family, idempotencyKey: KEY, taskId: "t-1" }),
      facade.claimTyped(s, {
        scope: family,
        idempotencyKey: KEY,
        taskId: "t-1",
        name: "Vince",
        note: "n",
        chosenAt: "x",
      }),
      facade.claimTyped(s, { scope: family, idempotencyKey: KEY, taskId: "t-1", name: "Vince" }),
      facade.changeClaim(s, {
        scope: family,
        idempotencyKey: KEY,
        claimId: "c-1",
        expectedVersion: 2,
        note: "új",
        chosenAt: "y",
      }),
      facade.changeClaim(s, {
        scope: family,
        idempotencyKey: KEY,
        claimId: "c-1",
        expectedVersion: 2,
      }),
      facade.withdrawClaim(s, {
        scope: family,
        idempotencyKey: KEY,
        claimId: "c-1",
        expectedVersion: 2,
      }),
      facade.markDone(s, { scope: family, idempotencyKey: KEY, taskId: "t-1", expectedVersion: 3 }),
      facade.undoDone(s, { scope: family, idempotencyKey: KEY, taskId: "t-1", expectedVersion: 4 }),
    ]);
    assert.ok(results.every((result) => result.state === "success"));
    assert.deepEqual(calls[1], { claim: { idempotencyKey: KEY, taskId: "t-1" } });
    assert.deepEqual(calls[6], {
      withdrawClaim: { idempotencyKey: KEY, claimId: "c-1", expectedVersion: 2 },
    });
    assert.ok(calls.every((call) => !JSON.stringify(call).includes("scope")));
  });

  it("refuses a teacher every claim and edit, and a group admin or super admin the parent-only claims", async () => {
    const claimInput = { idempotencyKey: KEY, taskId: "t-1" };
    for (const [role, scope] of ROLES.filter(([role]) => role !== "parent")) {
      const { facade, calls } = setup(role);
      const s = session(role, scope);
      const refused = await facade.claim(s, { scope, ...claimInput });
      assert.equal(refused.state, "denied", role);
      assert.equal(calls.length, 0);
    }
    const teacher = setup("kindergarten_teacher");
    const edit = await teacher.facade.copyTemplate(session("kindergarten_teacher", organization), {
      scope: organization,
      idempotencyKey: KEY,
      eventId: "e",
      templateId: "t",
    });
    assert.equal(edit.state, "denied");
    assert.equal(teacher.calls.length, 0);
  });

  it("lets a manager edit the checklist and the templates, and the team remove another's claim", async () => {
    for (const [role, scope] of ROLES.filter(
      ([role]) => role === "group_admin" || role === "super_admin",
    )) {
      const { facade, calls } = setup(role);
      const s = session(role, scope);
      const base = { scope, idempotencyKey: KEY };
      const v = { expectedChecklistVersion: 5 };
      const results = await Promise.all([
        facade.saveTemplate(s, { ...base, template: { name: "N" } }),
        facade.setTemplateRemoved(s, {
          ...base,
          templateId: "t-1",
          removed: true,
          expectedVersion: 2,
        }),
        facade.copyTemplate(s, { ...base, eventId: "e-1", templateId: "t-1" }),
        facade.saveSection(s, { ...base, ...v, eventId: "e-1", section: { title: "S" } }),
        facade.removeSection(s, { ...base, ...v, sectionId: "s-1" }),
        facade.saveTask(s, { ...base, ...v, eventId: "e-1", task: { title: "T" } }),
        facade.removeTask(s, { ...base, ...v, taskId: "t-1" }),
        facade.reorder(s, { ...base, ...v, eventId: "e-1", order: {} }),
        facade.withdrawClaim(s, { ...base, claimId: "c-1", expectedVersion: 1, asManager: true }),
      ]);
      assert.ok(
        results.every((result) => result.state === "success"),
        role,
      );
      assert.equal(calls.length, 9);
    }
  });

  it("refuses a command with a bad key or version before it reaches the database", async () => {
    const { facade, calls } = setup("parent");
    const s = session("parent", family);
    const badKey = await facade.claim(s, { scope: family, idempotencyKey: "x", taskId: "t-1" });
    assert.equal(badKey.state, "validation");
    const badVersion = await facade.markDone(s, {
      scope: family,
      idempotencyKey: KEY,
      taskId: "t-1",
      expectedVersion: 0,
    });
    assert.equal(badVersion.state, "validation");
    const manager = setup("super_admin");
    const badChecklistVersion = await manager.facade.removeTask(
      session("super_admin", organization),
      {
        scope: organization,
        idempotencyKey: KEY,
        taskId: "t-1",
        expectedChecklistVersion: -1,
      },
    );
    assert.equal(badChecklistVersion.state, "validation");
    assert.equal(calls.length + manager.calls.length, 0);
  });
});
