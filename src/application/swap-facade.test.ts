import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Scope } from "../access/index.ts";
import { sessionGrantBindings } from "../access/session-grants.ts";
import {
  AdminApplicationFacade,
  AuthorizationContract,
  FacadePipeline,
  InMemoryAuthorizationVersions,
  ParentApplicationFacade,
  TeacherApplicationFacade,
  type AdminApplicationPort,
  type DomainOutcome,
  type ParentApplicationPort,
  type SessionContext,
  type TeacherApplicationPort,
} from "./index.ts";

const organization: Scope = { id: "org-1", type: "organization", organizationId: "org-1" };
const group: Scope = { id: "group-1", type: "group", organizationId: "org-1" };
const family: Scope = { id: "family-1", type: "family", organizationId: "org-1" };
const input = { familyScope: family, familyId: "family-1" };
const KEY = "swap:key-0001";

function session(role: SessionContext["roles"][number], scope: Scope): SessionContext {
  return {
    subjectId: `${role}-1`,
    authorizationVersion: 1,
    ...sessionGrantBindings(`${role}-1`, role, [scope]),
    roles: [role],
    scopes: [scope],
    runtimeMode: "production",
    isSynthetic: false,
  };
}

const pipeline = (actor: SessionContext) =>
  new FacadePipeline(
    new AuthorizationContract(
      new InMemoryAuthorizationVersions({ [actor.subjectId]: actor.authorizationVersion }),
    ),
  );

/** A port with the new swap operations, recording what the facade passes on. */
class SwapPort implements ParentApplicationPort {
  readonly calls: { name: string; input: Record<string, unknown> }[] = [];
  outcome: DomainOutcome<never> | undefined;

  private record<T>(name: string, value: Record<string, unknown>, data: T): DomainOutcome<T> {
    this.calls.push({ name, input: value });
    return (this.outcome as DomainOutcome<T> | undefined) ?? { state: "success", data };
  }
  async listDuties() {
    return this.record("listDuties", {}, { duties: [] });
  }
  async signUp(value: Record<string, unknown>) {
    return this.record("signUp", value, { id: "a", state: "assigned" as const, version: 1 });
  }
  async requestSwap(value: Record<string, unknown>) {
    return this.record("requestSwap", value, { id: "r", state: "pending" as const });
  }
  async requestCancellation(value: Record<string, unknown>) {
    return this.record("requestCancellation", value, { id: "r", state: "pending" as const });
  }
  async listNotifications() {
    return this.record("listNotifications", {}, { notifications: [] });
  }
  async markNotificationRead() {
    return this.record("markNotificationRead", {}, { link: "/x" });
  }
  async updateOwnContribution(value: Record<string, unknown>) {
    return this.record("updateOwnContribution", value, { eventId: "e", note: "n" });
  }
  async listSwapCandidates(value: Record<string, unknown>) {
    return this.record("listSwapCandidates", value, {
      candidates: [
        {
          assignmentId: "a2",
          assignmentVersion: 2,
          taskId: "t2",
          title: "Sütés",
          startsAt: "2026-11-02T10:00:00Z",
          familyDisplayName: "Fenyő család",
        },
      ],
    });
  }
  async listSwapRequests(value: Record<string, unknown>) {
    return this.record("listSwapRequests", value, {
      requests: [
        {
          id: "r1",
          kind: "swap" as const,
          direction: "incoming" as const,
          version: 1,
          ownTaskTitle: "A",
          ownTaskStartsAt: "2026-11-02T10:00:00Z",
        },
      ],
    });
  }
  async respondToSwap(value: Record<string, unknown>) {
    return this.record("respondToSwap", value, { id: "r1", outcome: "applied" as const });
  }
  async withdrawRequest(value: Record<string, unknown>) {
    return this.record("withdrawRequest", value, { id: "r1", state: "withdrawn" as const });
  }
}

describe("the swap operations of the parent facade (BR32.7)", () => {
  const parent = session("parent", family);

  it("lets a parent list partners and requests, and freezes what it returns", async () => {
    const port = new SwapPort();
    const facade = new ParentApplicationFacade(pipeline(parent), port);
    const partners = await facade.listSwapCandidates(parent, { ...input, assignmentId: "a1" });
    assert.equal(partners.state, "success");
    if (partners.state === "success") {
      assert.ok(Object.isFrozen(partners.data.candidates));
      assert.ok(Object.isFrozen(partners.data.candidates[0]));
    }
    const requests = await facade.listSwapRequests(parent, input);
    assert.equal(requests.state, "success");
    if (requests.state === "success") assert.ok(Object.isFrozen(requests.data.requests[0]));
    assert.deepEqual(port.calls[0]?.input, {
      actorId: "parent-1",
      familyId: "family-1",
      assignmentId: "a1",
    });
  });

  it("lets a parent answer a swap request with the new respond action and passes the key on", async () => {
    const port = new SwapPort();
    const facade = new ParentApplicationFacade(pipeline(parent), port);
    const result = await facade.respondToSwap(parent, {
      ...input,
      requestId: "r1",
      accept: true,
      expectedVersion: 3,
      idempotencyKey: KEY,
    });
    assert.equal(result.state, "success");
    assert.deepEqual(port.calls[0]?.input, {
      actorId: "parent-1",
      familyId: "family-1",
      requestId: "r1",
      accept: true,
      expectedVersion: 3,
      idempotencyKey: KEY,
    });
  });

  it("lets a parent withdraw a swap request or a cancellation request", async () => {
    const port = new SwapPort();
    const facade = new ParentApplicationFacade(pipeline(parent), port);
    for (const kind of [undefined, "swap", "cancellation"] as const) {
      const result = await facade.withdrawRequest(parent, {
        ...input,
        requestId: "r1",
        ...(kind ? { kind } : {}),
        idempotencyKey: KEY,
      });
      assert.equal(result.state, "success", String(kind));
    }
    assert.equal(port.calls.length, 3);
  });

  it("passes the partner's version, the reason and the key of a swap request to the port", async () => {
    const port = new SwapPort();
    const facade = new ParentApplicationFacade(pipeline(parent), port);
    await facade.requestSwap(parent, {
      ...input,
      assignmentId: "a1",
      counterpartId: "a2",
      expectedVersion: 2,
      counterpartVersion: 5,
      reason: "beteg",
      idempotencyKey: KEY,
    });
    assert.deepEqual(port.calls[0]?.input, {
      actorId: "parent-1",
      familyId: "family-1",
      assignmentId: "a1",
      counterpartId: "a2",
      expectedVersion: 2,
      counterpartVersion: 5,
      reason: "beteg",
      idempotencyKey: KEY,
    });
    await facade.requestCancellation(parent, {
      ...input,
      assignmentId: "a1",
      expectedVersion: 2,
      reason: "beteg",
      idempotencyKey: KEY,
    });
    assert.equal(port.calls[1]?.input.reason, "beteg");
    assert.equal(port.calls[1]?.input.idempotencyKey, KEY);
  });

  it("refuses a command with a bad key before the port is reached", async () => {
    const port = new SwapPort();
    const facade = new ParentApplicationFacade(pipeline(parent), port);
    const answer = await facade.respondToSwap(parent, {
      ...input,
      requestId: "r1",
      accept: true,
      idempotencyKey: "x",
    });
    const withdraw = await facade.withdrawRequest(parent, {
      ...input,
      requestId: "r1",
      idempotencyKey: "x",
    });
    for (const result of [answer, withdraw]) {
      assert.equal(result.state, "validation");
      if (result.state === "validation") {
        assert.deepEqual(result.fieldErrors, { idempotencyKey: "VAL-IDEMPOTENCY-KEY" });
      }
    }
    assert.equal(port.calls.length, 0);
  });

  it("denies the operations when the adapter has none of them, as for a synthetic adapter", async () => {
    const synthetic = new SwapPort();
    const bare: ParentApplicationPort = {
      listDuties: synthetic.listDuties.bind(synthetic),
      signUp: synthetic.signUp.bind(synthetic),
      requestSwap: synthetic.requestSwap.bind(synthetic),
      requestCancellation: synthetic.requestCancellation.bind(synthetic),
      listNotifications: synthetic.listNotifications.bind(synthetic),
      markNotificationRead: synthetic.markNotificationRead.bind(synthetic),
      updateOwnContribution: synthetic.updateOwnContribution.bind(synthetic),
    };
    const facade = new ParentApplicationFacade(pipeline(parent), bare);
    assert.equal(
      (await facade.listSwapCandidates(parent, { ...input, assignmentId: "a" })).state,
      "denied",
    );
    assert.equal((await facade.listSwapRequests(parent, input)).state, "denied");
    assert.equal(
      (
        await facade.respondToSwap(parent, {
          ...input,
          requestId: "r",
          accept: true,
          idempotencyKey: KEY,
        })
      ).state,
      "denied",
    );
    assert.equal(
      (await facade.withdrawRequest(parent, { ...input, requestId: "r", idempotencyKey: KEY }))
        .state,
      "denied",
    );
  });

  it("passes a field validation of the adapter through to the screen", async () => {
    const port = new SwapPort();
    port.outcome = {
      state: "validation",
      fieldErrors: { counterpartVersion: "VAL-EXPECTED-VERSION" },
      code: "field_invalid",
    } as never;
    const facade = new ParentApplicationFacade(pipeline(parent), port);
    const result = await facade.requestSwap(parent, {
      ...input,
      assignmentId: "a1",
      counterpartId: "a2",
      expectedVersion: 1,
      idempotencyKey: KEY,
    });
    assert.equal(result.state, "validation");
    if (result.state === "validation") {
      assert.deepEqual(result.fieldErrors, { counterpartVersion: "VAL-EXPECTED-VERSION" });
      assert.equal(result.code, "field_invalid");
    }
  });
});

describe("who may answer or withdraw (the parent row and the role policy)", () => {
  const roles = [
    ["group_admin", group],
    ["kindergarten_teacher", group],
    ["super_admin", organization],
  ] as const;

  it("denies the respond and withdraw actions to every role but a parent, before the port is reached", async () => {
    for (const [role, scope] of roles) {
      const actor = session(role, scope);
      const port = new SwapPort();
      const facade = new ParentApplicationFacade(pipeline(actor), port);
      const respond = await facade.respondToSwap(actor, {
        familyScope: scope,
        familyId: "family-1",
        requestId: "r1",
        accept: true,
        idempotencyKey: KEY,
      });
      const withdraw = await facade.withdrawRequest(actor, {
        familyScope: scope,
        familyId: "family-1",
        requestId: "r1",
        idempotencyKey: KEY,
      });
      assert.equal(respond.state, "denied", role);
      assert.equal(withdraw.state, "denied", role);
      assert.equal(port.calls.length, 0, role);
    }
  });

  it("denies a parent the actions on another family's scope", async () => {
    const parent = session("parent", family);
    const port = new SwapPort();
    const facade = new ParentApplicationFacade(pipeline(parent), port);
    const other: Scope = { id: "family-2", type: "family", organizationId: "org-1" };
    const result = await facade.respondToSwap(parent, {
      familyScope: other,
      familyId: "family-2",
      requestId: "r1",
      accept: true,
      idempotencyKey: KEY,
    });
    assert.equal(result.state, "denied");
    assert.equal(port.calls.length, 0);
  });
});

describe("the admin and teacher facades with the extended ports", () => {
  const admin = session("super_admin", organization);

  it("passes the idempotency key of a command to the admin port, and none for a read", async () => {
    const seen: { operation: string; idempotencyKey?: string }[] = [];
    const port: AdminApplicationPort = {
      async execute(value) {
        seen.push({ operation: value.operation, idempotencyKey: value.idempotencyKey });
        return {
          state: "success",
          data: { id: "x", title: "t", state: "open", version: 2 },
        } as never;
      },
    };
    const facade = new AdminApplicationFacade(pipeline(admin), port);
    await facade.listRecords(admin, organization, {});
    await facade.saveRecord(admin, {
      scope: organization,
      id: "new",
      expectedVersion: 1,
      idempotencyKey: "record:save:key-1",
      payload: { title: "x", kind: "family" },
    });
    await facade.removeAssignment(admin, {
      scope: organization,
      id: "asg",
      expectedVersion: 1,
      idempotencyKey: "assignment:remove:key-1",
    });
    assert.deepEqual(seen, [
      { operation: "records.list", idempotencyKey: undefined },
      { operation: "records.save", idempotencyKey: "record:save:key-1" },
      { operation: "assignments.remove", idempotencyKey: "assignment:remove:key-1" },
    ]);
  });

  it("returns an adapter's validation outcome to the admin screen with its field errors", async () => {
    const port: AdminApplicationPort = {
      async execute() {
        return {
          state: "validation",
          fieldErrors: { name: "VAL-TAKEN" },
          code: "field_invalid",
        } as never;
      },
    };
    const facade = new AdminApplicationFacade(pipeline(admin), port);
    const result = await facade.saveRecord(admin, {
      scope: organization,
      id: "new",
      expectedVersion: 1,
      idempotencyKey: "record:save:key-2",
      payload: {},
    });
    assert.equal(result.state, "validation");
    if (result.state === "validation") assert.deepEqual(result.fieldErrors, { name: "VAL-TAKEN" });
  });

  it("returns an adapter's validation outcome to the teacher screen", async () => {
    const teacher = session("kindergarten_teacher", group);
    const port: TeacherApplicationPort = {
      async getSchedule() {
        return { state: "validation", fieldErrors: { range: "VAL-DATE-RANGE" } };
      },
    };
    const facade = new TeacherApplicationFacade(pipeline(teacher), port);
    const result = await facade.getSchedule(teacher, { groupScope: group });
    assert.equal(result.state, "validation");
  });
});
