import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Role, Scope } from "../access/index.ts";
import { sessionGrantBindings } from "../access/session-grants.ts";
import {
  AuthorizationContract,
  FacadePipeline,
  InMemoryAuthorizationVersions,
  TODO_PULL_LIMIT,
  TodoApplicationFacade,
  type DomainOutcome,
  type SessionContext,
  type TodoApplicationPort,
} from "./index.ts";
import type {
  MyTasksModel,
  TodoChangeModel,
  TodoDetailModel,
  TodoGroupListModel,
  TodoListModel,
  TodoPullModel,
} from "./contracts.ts";

const organization: Scope = { id: "org-1", type: "organization", organizationId: "org-1" };
const family: Scope = { id: "family-1", type: "family", organizationId: "org-1" };
const group: Scope = { id: "group-1", type: "group", organizationId: "org-1" };
const KEY = "key-0001-abcdefgh";
const CHANGE: TodoChangeModel = { id: "t-1", version: 2 };
const LIST = {
  items: [],
  truncated: false,
  caller: { canClaimTasks: true },
} as never as TodoListModel;
const DETAIL = { item: { id: "t-1" } } as never as TodoDetailModel;
const GROUP_LIST: TodoGroupListModel = { items: [], truncated: false };
const MINE: MyTasksModel = {
  thisWeek: [],
  later: [],
  noDate: [],
  isEmpty: true,
  weekEnd: "2026-11-29",
};
const PULL: TodoPullModel = { eventId: "e-1", added: 1, alreadyOnList: 0, claimantsCarried: 0 };

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
    async (input: unknown): Promise<DomainOutcome<TodoChangeModel>> => {
      calls.push({ [name]: input });
      return { state: "success", data: CHANGE };
    };
  const read =
    <T>(name: string, data: T) =>
    async (input?: unknown): Promise<DomainOutcome<T>> => {
      calls.push({ [name]: input });
      return { state: "success", data };
    };
  const port: TodoApplicationPort = {
    list: read("list", LIST),
    get: read("get", DETAIL),
    groupList: read("groupList", GROUP_LIST),
    myTasks: read("myTasks", MINE),
    save: record("save"),
    claim: record("claim"),
    giveBack: record("giveBack"),
    freeClaim: record("freeClaim"),
    update: record("update"),
    markDone: record("markDone"),
    undoDone: record("undoDone"),
    pullToEvent: async (input) => {
      calls.push({ pullToEvent: input });
      return { state: "success", data: PULL };
    },
  };
  const versions = new InMemoryAuthorizationVersions({ [`${role}-synthetic`]: 1 });
  const facade = new TodoApplicationFacade(
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
const TASK = { taskId: "t-1", expectedVersion: 1 } as const;

describe("the to-do facade reads", () => {
  it("lets every signed-in role read the list and a task page, each as one port call", async () => {
    for (const [role, scope] of ROLES) {
      const { facade, calls } = setup(role);
      const s = session(role, scope);
      const results = await Promise.all([
        facade.list(s, scope, { showHidden: true }),
        facade.get(s, scope, "t-1"),
      ]);
      assert.ok(
        results.every((result) => result.state === "success" && Object.isFrozen(result.data)),
        role,
      );
      assert.deepEqual(calls, [{ list: { showHidden: true } }, { get: "t-1" }]);
    }
  });

  it("gives a group's management list to a coordinator and a super admin, and refuses a parent and a teacher before the port", async () => {
    for (const [role, scope, expected] of [
      ["super_admin", organization, "success"],
      ["group_admin", group, "success"],
      ["parent", family, "denied"],
      ["kindergarten_teacher", organization, "denied"],
    ] as const) {
      const { facade, calls } = setup(role);
      const result = await facade.groupList(session(role, scope), scope, "group-1");
      assert.equal(result.state, expected, role);
      assert.equal(calls.length, expected === "success" ? 1 : 0, role);
    }
  });

  it("gives My tasks to a parent, a coordinator and a super admin, and refuses a teacher", async () => {
    for (const [role, scope, expected] of [
      ["parent", family, "success"],
      ["group_admin", group, "success"],
      ["super_admin", organization, "success"],
      ["kindergarten_teacher", organization, "denied"],
    ] as const) {
      const { facade, calls } = setup(role);
      const result = await facade.myTasks(session(role, scope), scope);
      assert.equal(result.state, expected, role);
      assert.equal(calls.length, expected === "success" ? 1 : 0, role);
    }
  });
});

describe("the to-do facade commands", () => {
  it("lets a parent take, give back, update and finish tasks and undo a finish, and passes each on without the scope", async () => {
    const { facade, calls } = setup("parent");
    const s = session("parent", family);
    const base = { scope: family, idempotencyKey: KEY, ...TASK };
    const results = await Promise.all([
      facade.claim(s, base),
      facade.giveBack(s, base),
      facade.update(s, { ...base, status: "in_progress", note: "Megvan a festék" }),
      facade.markDone(s, base),
      facade.undoDone(s, base),
    ]);
    assert.ok(results.every((result) => result.state === "success"));
    assert.deepEqual(calls[0], { claim: { idempotencyKey: KEY, ...TASK } });
    assert.deepEqual(calls[2], {
      update: { idempotencyKey: KEY, ...TASK, status: "in_progress", note: "Megvan a festék" },
    });
    assert.ok(calls.every((call) => !JSON.stringify(call).includes("scope")));
  });

  it("refuses a parent every management command and a teacher every command, before the port", async () => {
    const parent = setup("parent");
    const p = session("parent", family);
    const pBase = { scope: family, idempotencyKey: KEY };
    const refused = await Promise.all([
      parent.facade.save(p, { ...pBase, topic: "Festés" }),
      parent.facade.freeClaim(p, { ...pBase, ...TASK }),
      parent.facade.pullToEvent(p, { ...pBase, eventId: "e-1", tasks: [TASK] }),
    ]);
    assert.ok(refused.every((result) => result.state === "denied"));
    assert.deepEqual(parent.calls, []);

    const teacher = setup("kindergarten_teacher");
    const t = session("kindergarten_teacher", organization);
    const tBase = { scope: organization, idempotencyKey: KEY };
    const refusedByTeacher = await Promise.all([
      teacher.facade.claim(t, { ...tBase, ...TASK }),
      teacher.facade.markDone(t, { ...tBase, ...TASK }),
      teacher.facade.save(t, { ...tBase, topic: "Festés" }),
    ]);
    assert.ok(refusedByTeacher.every((result) => result.state === "denied"));
    assert.deepEqual(teacher.calls, []);
  });

  it("lets a coordinator and a super admin save, free a claim and pull tasks into an event", async () => {
    for (const [role, scope] of [
      ["group_admin", group],
      ["super_admin", organization],
    ] as const) {
      const { facade, calls } = setup(role);
      const s = session(role, scope);
      const base = { scope, idempotencyKey: KEY };
      const created = await facade.save(s, { ...base, ownerGroupId: "group-1", topic: "Festés" });
      const changed = await facade.save(s, { ...base, topic: "Festés", ...TASK });
      const freed = await facade.freeClaim(s, { ...base, ...TASK });
      const pulled = await facade.pullToEvent(s, { ...base, eventId: "e-1", tasks: [TASK] });
      assert.deepEqual(
        [created.state, changed.state, freed.state, pulled.state],
        ["success", "success", "success", "success"],
        role,
      );
      assert.deepEqual(calls[0], {
        save: { idempotencyKey: KEY, ownerGroupId: "group-1", topic: "Festés" },
      });
      assert.deepEqual(calls[3], {
        pullToEvent: { idempotencyKey: KEY, eventId: "e-1", tasks: [TASK] },
      });
    }
  });

  it("refuses a malformed key or a version below one before the port is reached", async () => {
    const { facade, calls } = setup("parent");
    const s = session("parent", family);
    const badKey = await facade.claim(s, { scope: family, idempotencyKey: "x", ...TASK });
    const badVersion = await facade.markDone(s, {
      scope: family,
      idempotencyKey: KEY,
      taskId: "t-1",
      expectedVersion: 0,
    });
    assert.equal(badKey.state, "validation");
    assert.equal(badVersion.state, "validation");
    assert.deepEqual(calls, []);
  });
});

describe("the to-do facade pull check", () => {
  const admin = () => ({ ...setup("super_admin"), s: session("super_admin", organization) });
  const base = { scope: organization, idempotencyKey: KEY, eventId: "e-1" };

  it("refuses no tasks, too many, the same task twice and a version below one", async () => {
    const { facade, calls, s } = admin();
    const many = Array.from({ length: TODO_PULL_LIMIT + 1 }, (_, i) => ({
      taskId: `t-${i}`,
      expectedVersion: 1,
    }));
    const results = await Promise.all([
      facade.pullToEvent(s, { ...base, tasks: [] }),
      facade.pullToEvent(s, { ...base, tasks: many }),
      facade.pullToEvent(s, { ...base, tasks: [TASK, TASK] }),
      facade.pullToEvent(s, { ...base, tasks: [{ taskId: "t-1", expectedVersion: 0 }] }),
      facade.pullToEvent(s, { ...base, idempotencyKey: "x", tasks: [TASK] }),
    ]);
    assert.ok(results.every((result) => result.state === "validation"));
    assert.deepEqual(calls, []);
  });

  it("accepts exactly the limit", async () => {
    const { facade, calls, s } = admin();
    const full = Array.from({ length: TODO_PULL_LIMIT }, (_, i) => ({
      taskId: `t-${i}`,
      expectedVersion: 1,
    }));
    assert.equal((await facade.pullToEvent(s, { ...base, tasks: full })).state, "success");
    assert.equal(calls.length, 1);
  });
});
