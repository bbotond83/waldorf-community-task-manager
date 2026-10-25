import { sessionGrantBindings } from "../access/session-grants.ts";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Scope } from "../access/index.ts";
import {
  AdminApplicationFacade,
  AuthorizationContract,
  FacadePipeline,
  IdempotencyCoordinator,
  InMemoryAuthorizationVersions,
  InMemoryIdempotencyStore,
  ParentApplicationFacade,
  TeacherApplicationFacade,
} from "./index.ts";
import type {
  AdminApplicationPort,
  AdminOperation,
  DomainOutcome,
  ParentApplicationPort,
  SessionContext,
  TeacherApplicationPort,
} from "./index.ts";

const organizationScope: Scope = { id: "org-1", type: "organization", organizationId: "org-1" };
const groupScope: Scope = { id: "group-1", type: "group", organizationId: "org-1" };
const familyScope: Scope = { id: "family-1", type: "family", organizationId: "org-1" };

const parentSession = makeSession("parent", familyScope);
const teacherSession = makeSession("kindergarten_teacher", groupScope);
const groupAdminSession = makeSession("group_admin", groupScope);
const kindergartenSession = makeSession("super_admin", organizationScope);

describe("role application facades", () => {
  it("returns an immutable parent duty list", async () => {
    const port = new FakeParentPort();
    const result = await new ParentApplicationFacade(pipelineFor(parentSession), port).listDuties(
      parentSession,
      { familyScope, familyId: "family-1" },
    );
    assert.equal(result.state, "success");
    if (result.state === "success") {
      assert.equal(result.data.duties[0]?.title, "Kerti munka");
      assert.equal(Object.isFrozen(result.data.duties), true);
    }
  });

  it("does not invoke a Parent port before authorization", async () => {
    const port = new FakeParentPort();
    const result = await new ParentApplicationFacade(
      pipelineFor(groupAdminSession),
      port,
    ).listDuties(groupAdminSession, { familyScope: groupScope, familyId: "family-1" });
    assert.equal(result.state, "denied");
    assert.equal(port.calls, 0);
  });

  it("deduplicates Parent signup with the same key and fingerprint", async () => {
    const port = new FakeParentPort();
    const facade = new ParentApplicationFacade(pipelineFor(parentSession), port);
    const input = {
      familyScope,
      familyId: "family-1",
      dutyId: "duty-1",
      expectedVersion: 1,
      idempotencyKey: "signup:key-0001",
    };
    const first = await facade.signUp(parentSession, input);
    const duplicate = await facade.signUp(parentSession, input);
    assert.equal(first.state, "success");
    assert.deepEqual(duplicate, first);
    assert.equal(port.signupCalls, 1);
  });

  it("rejects reuse of a signup key with different input", async () => {
    const port = new FakeParentPort();
    const facade = new ParentApplicationFacade(pipelineFor(parentSession), port);
    const common = {
      familyScope,
      familyId: "family-1",
      expectedVersion: 1,
      idempotencyKey: "signup:key-0002",
    };
    await facade.signUp(parentSession, { ...common, dutyId: "duty-1" });
    const mismatch = await facade.signUp(parentSession, { ...common, dutyId: "duty-2" });
    assert.equal(mismatch.state, "conflict");
    assert.equal(port.signupCalls, 1);
  });

  it("maps a classified Parent dependency failure to retryable", async () => {
    const port = new FakeParentPort();
    port.failure = new Error("transient database response");
    const result = await new ParentApplicationFacade(
      pipelineFor(parentSession, () => "retryable"),
      port,
    ).listDuties(parentSession, { familyScope, familyId: "family-1" });
    assert.equal(result.state, "dependency-failure-retryable");
    assert.equal(JSON.stringify(result).includes("database response"), false);
  });

  it("returns a Teacher schedule without mutation or contact fields", async () => {
    const port: TeacherApplicationPort = {
      getSchedule: async () => ({
        state: "success",
        data: {
          entries: [
            {
              id: "entry-1",
              sourceRecordId: "entry-1",
              groupId: groupScope.id,
              organizationId: groupScope.organizationId,
              ownerDisplayName: null,
              assigneeDisplayNames: [],
              currentStatusLabel: null,
              startsAt: "2026-08-12T08:00:00.000Z",
              endsAt: "2026-08-12T09:00:00.000Z",
              title: "Udvari felügyelet",
              location: "Udvar",
              coordinationDisplayName: "Kitalált Résztvevő",
            },
          ],
        },
      }),
    };
    const facade = new TeacherApplicationFacade(pipelineFor(teacherSession), port);
    const result = await facade.getSchedule(teacherSession, {
      groupScope,
      from: "2026-08-01",
      to: "2026-08-31",
    });
    assert.equal(result.state, "success");
    assert.equal(JSON.stringify(result).includes("email"), false);
    assert.equal("save" in facade, false);
  });

  it("validates a Teacher date range before invoking its port", async () => {
    let calls = 0;
    const port: TeacherApplicationPort = {
      getSchedule: async () => {
        calls += 1;
        return { state: "empty" };
      },
    };
    const result = await new TeacherApplicationFacade(
      pipelineFor(teacherSession),
      port,
    ).getSchedule(teacherSession, { groupScope, from: "invalid", to: "2026-08-31" });
    assert.equal(result.state, "validation");
    assert.equal(calls, 0);
  });

  it("returns one authorized Teacher schedule entry and hides missing entries", async () => {
    const port: TeacherApplicationPort = {
      getSchedule: async () => ({
        state: "success",
        data: {
          entries: [
            {
              id: "entry-1",
              sourceRecordId: "entry-1",
              groupId: groupScope.id,
              organizationId: groupScope.organizationId,
              ownerDisplayName: null,
              assigneeDisplayNames: [],
              currentStatusLabel: null,
              startsAt: "2026-08-12T08:00:00.000Z",
              endsAt: "2026-08-12T09:00:00.000Z",
              title: "Udvari felügyelet",
              location: "Udvar",
            },
          ],
        },
      }),
    };
    const facade = new TeacherApplicationFacade(pipelineFor(teacherSession), port);
    const common = { groupScope, from: "2026-08-01", to: "2026-08-31" };
    assert.equal(
      (await facade.getScheduleEntry(teacherSession, { ...common, entryId: "entry-1" })).state,
      "success",
    );
    assert.equal(
      (await facade.getScheduleEntry(teacherSession, { ...common, entryId: "missing" })).state,
      "denied",
    );
  });

  it("denies Group Administrator import before invoking its port", async () => {
    const port = new FakeAdminPort();
    const result = await new AdminApplicationFacade(
      pipelineFor(groupAdminSession),
      port,
    ).import.commit(groupAdminSession, {
      scope: groupScope,
      id: "preview-1",
      expectedVersion: 1,
      idempotencyKey: "import:key-0001",
    });
    assert.equal(result.state, "denied");
    assert.equal(port.calls, 0);
  });

  it("allows Super Administrator import through the public port", async () => {
    const port = new FakeAdminPort();
    const result = await new AdminApplicationFacade(
      pipelineFor(kindergartenSession),
      port,
    ).import.commit(kindergartenSession, {
      scope: organizationScope,
      id: "preview-1",
      expectedVersion: 1,
      idempotencyKey: "import:key-0002",
    });
    assert.equal(result.state, "success");
    assert.equal(port.calls, 1);
  });

  it("exposes the complete administrator workflow surface through one port", async () => {
    const port = new FlexibleAdminPort();
    const facade = new AdminApplicationFacade(pipelineFor(kindergartenSession), port);
    const command = {
      scope: organizationScope,
      id: "item-1",
      expectedVersion: 1,
      idempotencyKey: "admin:key-0001",
    };
    const operations = await Promise.all([
      facade.getDashboard(kindergartenSession, organizationScope),
      facade.listRecords(kindergartenSession, organizationScope),
      facade.getRecord(kindergartenSession, organizationScope, "family", "item-1"),
      facade.saveRecord(kindergartenSession, command),
      facade.archiveRecord(kindergartenSession, { ...command, idempotencyKey: "admin:key-0002" }),
      facade.restoreRecord(kindergartenSession, { ...command, idempotencyKey: "admin:key-0003" }),
      facade.listTasks(kindergartenSession, organizationScope),
      facade.saveTaskOrEvent(kindergartenSession, {
        ...command,
        idempotencyKey: "admin:key-0004",
      }),
      facade.assign(kindergartenSession, { ...command, idempotencyKey: "admin:key-0005" }),
      facade.listApprovals(kindergartenSession, organizationScope),
      facade.decideApproval(kindergartenSession, {
        ...command,
        decision: "approved",
        idempotencyKey: "admin:key-0006",
      }),
      facade.saveEventNotes(kindergartenSession, {
        ...command,
        idempotencyKey: "admin:key-0007",
      }),
      facade.import.createPreview(kindergartenSession, {
        ...command,
        idempotencyKey: "admin:key-0008",
      }),
      facade.import.resolveConflict(kindergartenSession, {
        ...command,
        idempotencyKey: "admin:key-0009",
      }),
      facade.import.recover(kindergartenSession, {
        ...command,
        idempotencyKey: "admin:key-0010",
      }),
      facade.reminders.list(kindergartenSession, organizationScope),
      facade.reminders.retry(kindergartenSession, {
        ...command,
        idempotencyKey: "admin:key-0011",
      }),
      facade.lifecycle.list(kindergartenSession, organizationScope),
      facade.lifecycle.run(kindergartenSession, {
        ...command,
        idempotencyKey: "admin:key-0012",
      }),
    ]);
    assert.equal(
      operations.every((result) => result.state === "success"),
      true,
    );
    assert.equal(port.calls, operations.length);
  });

  it("executes Parent request, notification, and note workflows", async () => {
    const port = new FakeParentPort();
    const facade = new ParentApplicationFacade(pipelineFor(parentSession), port);
    const base = {
      familyScope,
      familyId: "family-1",
      assignmentId: "assignment-1",
      expectedVersion: 1,
    };
    const results = await Promise.all([
      facade.requestSwap(parentSession, {
        ...base,
        counterpartId: "assignment-2",
        idempotencyKey: "parent:key-0001",
      }),
      facade.requestCancellation(parentSession, {
        ...base,
        idempotencyKey: "parent:key-0002",
      }),
      facade.listNotifications(parentSession, familyScope),
      facade.markNotificationRead(parentSession, {
        familyScope,
        notificationId: "notification-1",
        idempotencyKey: "parent:key-0003",
      }),
      facade.updateOwnContribution(parentSession, {
        familyScope,
        eventId: "event-1",
        note: "Elkészült",
        idempotencyKey: "parent:key-0004",
      }),
    ]);
    assert.equal(
      results.every((result) => result.state === "success"),
      true,
    );
  });
});

function makeSession(role: SessionContext["roles"][number], scope: Scope): SessionContext {
  return {
    subjectId: `${role}-synthetic`,
    authorizationVersion: 1,
    ...sessionGrantBindings(`${role}-synthetic`, role, [scope]),
    roles: [role],
    scopes: [scope],
  };
}

function authorizationFor(session: SessionContext): AuthorizationContract {
  return new AuthorizationContract(
    new InMemoryAuthorizationVersions({ [session.subjectId]: session.authorizationVersion }),
  );
}

function pipelineFor(
  session: SessionContext,
  classifier: (error: unknown) => "retryable" | "terminal" = () => "terminal",
): FacadePipeline {
  return new FacadePipeline(
    authorizationFor(session),
    classifier,
    new IdempotencyCoordinator(new InMemoryIdempotencyStore()),
  );
}

class FakeParentPort implements ParentApplicationPort {
  calls = 0;
  signupCalls = 0;
  failure?: Error;

  async listDuties(): Promise<
    DomainOutcome<{
      duties: readonly [{ id: string; title: string; dueAt: string; state: "available" }];
    }>
  > {
    this.calls += 1;
    if (this.failure) throw this.failure;
    return {
      state: "success",
      data: {
        duties: [{ id: "duty-1", title: "Kerti munka", dueAt: "2026-08-20", state: "available" }],
      },
    };
  }
  async signUp(): Promise<DomainOutcome<{ id: string; state: "assigned"; version: number }>> {
    this.signupCalls += 1;
    return { state: "success", data: { id: "assignment-1", state: "assigned", version: 1 } };
  }
  async requestSwap(): Promise<DomainOutcome<{ id: string; state: "pending" }>> {
    return { state: "success", data: { id: "swap-1", state: "pending" } };
  }
  async requestCancellation(): Promise<DomainOutcome<{ id: string; state: "pending" }>> {
    return { state: "success", data: { id: "cancel-1", state: "pending" } };
  }
  async listNotifications(): Promise<DomainOutcome<{ notifications: readonly [] }>> {
    return { state: "success", data: { notifications: [] } };
  }
  async markNotificationRead(): Promise<DomainOutcome<{ readonly link: string }>> {
    return { state: "success", data: { link: "/szulo/feladatok/duty-1" } };
  }
  async updateOwnContribution(): Promise<DomainOutcome<{ eventId: string; note: string }>> {
    return { state: "success", data: { eventId: "event-1", note: "Elkészült" } };
  }
}

class FakeAdminPort implements AdminApplicationPort {
  calls = 0;
  async execute<T>(input: {
    actorId: string;
    operation: AdminOperation;
    scope: Scope;
    payload: Readonly<Record<string, unknown>>;
  }): Promise<DomainOutcome<T>> {
    this.calls += 1;
    return {
      state: "success",
      data: {
        runId: String(input.payload.id),
        importedRows: 3,
        state: "committed",
      } as T,
    };
  }
}

class FlexibleAdminPort implements AdminApplicationPort {
  calls = 0;
  async execute<T>(): Promise<DomainOutcome<T>> {
    this.calls += 1;
    return { state: "success", data: Object.freeze({ completed: true }) as T };
  }
}
