import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Role, Scope } from "../access/index.ts";
import { sessionGrantBindings } from "../access/session-grants.ts";
import {
  AuthorizationContract,
  FacadePipeline,
  InMemoryAuthorizationVersions,
  InformationApplicationFacade,
  type DomainOutcome,
  type InformationApplicationPort,
  type SessionContext,
} from "./index.ts";
import type { InfoChangeModel, InfoSectionsModel } from "./contracts.ts";

const organization: Scope = { id: "org-1", type: "organization", organizationId: "org-1" };
const family: Scope = { id: "family-1", type: "family", organizationId: "org-1" };
const group: Scope = { id: "group-1", type: "group", organizationId: "org-1" };
const KEY = "key-0001-abcdefgh";
const CHANGE: InfoChangeModel = { id: "i-1", version: 2 };
const PAGE: InfoSectionsModel = { canManage: false, ownerGroupNames: [], items: [] };
const FIELDS = { title: "Kert", body: "Szöveg", position: 1 } as const;

function session(role: Role, scope: Scope): SessionContext {
  return {
    subjectId: `${role}-synthetic`,
    authorizationVersion: 1,
    ...sessionGrantBindings(`${role}-synthetic`, role, [scope]),
    roles: [role],
    scopes: [scope],
  };
}

function setup(role: Role, answer?: DomainOutcome<InfoChangeModel>) {
  const calls: Record<string, unknown>[] = [];
  const reply = answer ?? { state: "success" as const, data: CHANGE };
  const record =
    (name: string) =>
    async (input: unknown): Promise<DomainOutcome<InfoChangeModel>> => {
      calls.push({ [name]: input });
      return reply;
    };
  const port: InformationApplicationPort = {
    list: async () => {
      calls.push({ list: undefined });
      return { state: "success", data: PAGE };
    },
    update: record("update"),
    create: record("create"),
    setHidden: record("setHidden"),
  };
  const versions = new InMemoryAuthorizationVersions({ [`${role}-synthetic`]: 1 });
  const facade = new InformationApplicationFacade(
    new FacadePipeline(new AuthorizationContract(versions)),
    port,
  );
  return { facade, calls };
}

describe("the information facade", () => {
  it("lets every signed-in role read the page as one frozen port call", async () => {
    for (const [role, scope] of [
      ["parent", family],
      ["kindergarten_teacher", organization],
      ["group_admin", group],
      ["super_admin", organization],
    ] as const) {
      const { facade, calls } = setup(role);
      const result = await facade.list(session(role, scope), scope);
      assert.ok(result.state === "success" && Object.isFrozen(result.data), role);
      assert.equal(calls.length, 1);
    }
  });

  it("passes a coordinator's and a super admin's edits on with key and version and without the scope", async () => {
    for (const [role, scope] of [
      ["group_admin", group],
      ["super_admin", organization],
    ] as const) {
      const { facade, calls } = setup(role);
      const s = session(role, scope);
      const base = { scope, idempotencyKey: KEY };
      const results = await Promise.all([
        facade.update(s, { ...base, ...FIELDS, sectionId: "i-1", expectedVersion: 1 }),
        facade.create(s, { ...base, ...FIELDS }),
        facade.setHidden(s, { ...base, sectionId: "i-1", hidden: true, expectedVersion: 1 }),
      ]);
      assert.ok(
        results.every((r) => r.state === "success"),
        role,
      );
      assert.deepEqual(calls[0], {
        update: { idempotencyKey: KEY, ...FIELDS, sectionId: "i-1", expectedVersion: 1 },
      });
      assert.ok(calls.every((c) => !JSON.stringify(c).includes("scope")));
    }
  });

  it("refuses a parent and a teacher every edit before the port", async () => {
    for (const [role, scope] of [
      ["parent", family],
      ["kindergarten_teacher", organization],
    ] as const) {
      const { facade, calls } = setup(role);
      const s = session(role, scope);
      const base = { scope, idempotencyKey: KEY };
      const refused = await Promise.all([
        facade.update(s, { ...base, ...FIELDS, sectionId: "i-1", expectedVersion: 1 }),
        facade.create(s, { ...base, ...FIELDS }),
        facade.setHidden(s, { ...base, sectionId: "i-1", hidden: true, expectedVersion: 1 }),
      ]);
      assert.ok(
        refused.every((r) => r.state === "denied"),
        role,
      );
      assert.deepEqual(calls, []);
    }
  });

  it("refuses a malformed key or a missing version before the port is reached", async () => {
    const { facade, calls } = setup("super_admin");
    const s = session("super_admin", organization);
    const checks = await Promise.all([
      facade.create(s, { scope: organization, idempotencyKey: "x", ...FIELDS }),
      facade.update(s, {
        scope: organization,
        idempotencyKey: KEY,
        ...FIELDS,
        sectionId: "i-1",
        expectedVersion: 0,
      }),
    ]);
    assert.ok(checks.every((r) => r.state === "validation"));
    assert.deepEqual(calls, []);
  });

  it("returns a refusal of the database as the application result, never as success", async () => {
    const { facade } = setup("group_admin", { state: "conflict", code: "VERSION_CONFLICT" });
    const result = await facade.update(session("group_admin", group), {
      scope: group,
      idempotencyKey: KEY,
      ...FIELDS,
      sectionId: "i-1",
      expectedVersion: 1,
    });
    assert.deepEqual([result.state, result.code], ["conflict", "VERSION_CONFLICT"]);
  });
});
