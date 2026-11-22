import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Role, Scope } from "../access/index.ts";
import { sessionGrantBindings } from "../access/session-grants.ts";
import {
  AuthorizationContract,
  FacadePipeline,
  InMemoryAuthorizationVersions,
  RecurringApplicationFacade,
  type DomainOutcome,
  type RecurringApplicationPort,
  type SessionContext,
} from "./index.ts";
import type {
  RecurringCardModel,
  RecurringChangeModel,
  RecurringGroupListModel,
  RecurringItemsModel,
  RecurringScheduleListModel,
  RecurringScheduleModel,
} from "./contracts.ts";

const organization: Scope = { id: "org-1", type: "organization", organizationId: "org-1" };
const family: Scope = { id: "family-1", type: "family", organizationId: "org-1" };
const group: Scope = { id: "group-1", type: "group", organizationId: "org-1" };
const KEY = "key-0001-abcdefgh";
const CHANGE: RecurringChangeModel = { id: "x-1", version: 2 };
const SCHEDULE = {
  id: "s-1",
  title: "Komposztálás",
  category: "kert",
  ownerKind: "group",
  intervalKind: "weeks",
  intervalCount: 6,
  startDate: "2026-09-07",
  isActive: true,
  version: 1,
} as const;
const ITEM = {
  id: "o-1",
  scheduleId: "s-1",
  title: "Komposztálás",
  category: "kert",
  ownerKind: "group",
  dueDate: "2026-11-30",
  status: "open",
  isOverdue: false,
  version: 1,
  canMarkDone: true,
  canUndo: false,
  canSkip: false,
} as const;
const GROUP_PAGE: RecurringGroupListModel = {
  group: { id: "group-1", name: "Kert", status: "active" },
  schedules: [SCHEDULE],
  items: [ITEM],
  history: [],
  canManage: false,
  canMark: true,
};
const CARD: RecurringCardModel = { item: ITEM, schedule: SCHEDULE };
const ITEMS: RecurringItemsModel = { items: [ITEM] };
const SCHEDULES: RecurringScheduleListModel = { items: [SCHEDULE] };
const ONE: RecurringScheduleModel = { schedule: SCHEDULE, canManage: false };

function session(role: Role, scope: Scope): SessionContext {
  return {
    subjectId: `${role}-synthetic`,
    authorizationVersion: 1,
    ...sessionGrantBindings(`${role}-synthetic`, role, [scope]),
    roles: [role],
    scopes: [scope],
  };
}

function setup(role: Role, answer?: DomainOutcome<RecurringChangeModel>) {
  const calls: Record<string, unknown>[] = [];
  const reply = answer ?? { state: "success" as const, data: CHANGE };
  const record =
    (name: string) =>
    async (input: unknown): Promise<DomainOutcome<RecurringChangeModel>> => {
      calls.push({ [name]: input });
      return reply;
    };
  const read =
    <T>(name: string, data: T) =>
    async (input?: unknown): Promise<DomainOutcome<T>> => {
      calls.push({ [name]: input });
      return { state: "success", data };
    };
  const port: RecurringApplicationPort = {
    groupList: read("groupList", GROUP_PAGE),
    card: read("card", CARD),
    mine: read("mine", ITEMS),
    bottle: read("bottle", ITEMS),
    adminList: read("adminList", SCHEDULES),
    scheduleGet: read("scheduleGet", ONE),
    saveSchedule: record("saveSchedule"),
    setActive: record("setActive"),
    markDone: record("markDone"),
    undoDone: record("undoDone"),
    skip: record("skip"),
  };
  const versions = new InMemoryAuthorizationVersions({ [`${role}-synthetic`]: 1 });
  const facade = new RecurringApplicationFacade(
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
const SAVE = {
  title: "T",
  category: "k",
  ownerKind: "group",
  workingGroupId: "group-1",
  intervalCount: 2,
  startDate: "2026-09-07",
} as const;

describe("the recurring facade reads", () => {
  it("lets every signed-in role read a group page, a card, my duties and a schedule; a page is one port call", async () => {
    for (const [role, scope] of ROLES) {
      const { facade, calls } = setup(role);
      const s = session(role, scope);
      const results = await Promise.all([
        facade.groupList(s, scope, "group-1"),
        facade.card(s, scope, "o-1"),
        facade.mine(s, scope),
        facade.bottle(s, scope, "duty-1"),
        facade.scheduleGet(s, scope, "s-1"),
      ]);
      assert.ok(
        results.every((result) => result.state === "success"),
        role,
      );
      assert.ok(
        results.every((result) => result.state === "success" && Object.isFrozen(result.data)),
      );
      assert.deepEqual(calls, [
        { groupList: "group-1" },
        { card: "o-1" },
        { mine: undefined },
        { bottle: "duty-1" },
        { scheduleGet: "s-1" },
      ]);
    }
  });

  it("gives the administrator list to a super admin and a coordinator, and refuses a parent and a teacher before the port", async () => {
    for (const [role, scope, expected] of [
      ["super_admin", organization, "success"],
      ["group_admin", group, "success"],
      ["parent", family, "denied"],
      ["kindergarten_teacher", organization, "denied"],
    ] as const) {
      const { facade, calls } = setup(role);
      const result = await facade.adminList(session(role, scope), scope);
      assert.equal(result.state, expected, role);
      assert.equal(calls.length, expected === "success" ? 1 : 0, role);
    }
  });
});

describe("the recurring facade commands", () => {
  it("passes every command on with its key and version and without the scope", async () => {
    const { facade, calls } = setup("group_admin");
    const s = session("group_admin", group);
    const base = { scope: group, idempotencyKey: KEY };
    const results = await Promise.all([
      facade.saveSchedule(s, { ...base, ...SAVE }),
      facade.saveSchedule(s, { ...base, ...SAVE, scheduleId: "s-1", expectedVersion: 2 }),
      facade.setActive(s, { ...base, scheduleId: "s-1", expectedVersion: 2, active: false }),
      facade.markDone(s, { ...base, occurrenceId: "o-1", expectedVersion: 1 }),
      facade.undoDone(s, { ...base, occurrenceId: "o-1", expectedVersion: 2 }),
      facade.skip(s, { ...base, occurrenceId: "o-1", expectedVersion: 1, reason: "Havazás" }),
    ]);
    assert.ok(results.every((result) => result.state === "success"));
    assert.deepEqual(calls[0], { saveSchedule: { idempotencyKey: KEY, ...SAVE } });
    assert.deepEqual(calls[2], {
      setActive: { idempotencyKey: KEY, scheduleId: "s-1", expectedVersion: 2, active: false },
    });
    assert.deepEqual(calls[5], {
      skip: { idempotencyKey: KEY, occurrenceId: "o-1", expectedVersion: 1, reason: "Havazás" },
    });
    assert.ok(calls.every((call) => !JSON.stringify(call).includes("scope")));
  });

  it("lets a parent mark and undo duties, and refuses a parent every schedule command", async () => {
    const { facade, calls } = setup("parent");
    const s = session("parent", family);
    const base = { scope: family, idempotencyKey: KEY };
    assert.equal(
      (await facade.markDone(s, { ...base, occurrenceId: "o-1", expectedVersion: 1 })).state,
      "success",
    );
    assert.equal(
      (await facade.undoDone(s, { ...base, occurrenceId: "o-1", expectedVersion: 2 })).state,
      "success",
    );
    const refused = await Promise.all([
      facade.saveSchedule(s, { ...base, ...SAVE }),
      facade.setActive(s, { ...base, scheduleId: "s-1", expectedVersion: 1, active: true }),
    ]);
    assert.ok(refused.every((result) => result.state === "denied"));
    assert.equal(calls.length, 2);
  });

  it("lets a super admin keep schedules and skip, and refuses a teacher every command before the port", async () => {
    const admin = setup("super_admin");
    const a = session("super_admin", organization);
    const base = { scope: organization, idempotencyKey: KEY };
    assert.equal((await admin.facade.saveSchedule(a, { ...base, ...SAVE })).state, "success");
    assert.equal(
      (
        await admin.facade.skip(a, {
          ...base,
          occurrenceId: "o-1",
          expectedVersion: 1,
          reason: "x",
        })
      ).state,
      "success",
    );
    const teacher = setup("kindergarten_teacher");
    const t = session("kindergarten_teacher", organization);
    const refused = await Promise.all([
      teacher.facade.saveSchedule(t, { ...base, ...SAVE }),
      teacher.facade.setActive(t, { ...base, scheduleId: "s-1", expectedVersion: 1, active: true }),
      teacher.facade.markDone(t, { ...base, occurrenceId: "o-1", expectedVersion: 1 }),
      teacher.facade.undoDone(t, { ...base, occurrenceId: "o-1", expectedVersion: 1 }),
      teacher.facade.skip(t, { ...base, occurrenceId: "o-1", expectedVersion: 1, reason: "x" }),
    ]);
    assert.ok(refused.every((result) => result.state === "denied"));
    assert.deepEqual(teacher.calls, []);
  });

  it("refuses a malformed key or a missing version before the port is reached", async () => {
    const { facade, calls } = setup("group_admin");
    const s = session("group_admin", group);
    assert.equal(
      (await facade.saveSchedule(s, { scope: group, idempotencyKey: "x", ...SAVE })).state,
      "validation",
    );
    assert.equal(
      (
        await facade.markDone(s, {
          scope: group,
          idempotencyKey: KEY,
          occurrenceId: "o-1",
          expectedVersion: 0,
        })
      ).state,
      "validation",
    );
    assert.deepEqual(calls, []);
  });

  it("returns a refusal of the database as the application result, never as success", async () => {
    for (const code of ["VERSION_CONFLICT", "RECURRING_CLOSED", "RECURRING_UNDO_TOO_LATE"]) {
      const { facade } = setup("parent", { state: "conflict", code });
      const result = await facade.markDone(session("parent", family), {
        scope: family,
        idempotencyKey: KEY,
        occurrenceId: "o-1",
        expectedVersion: 1,
      });
      assert.deepEqual([result.state, result.code], ["conflict", code]);
    }
  });
});
