import type { Scope } from "../access/index.ts";
import type {
  ApplicationResult,
  AssignmentModel,
  DutyDetailModel,
  DutyListModel,
  EventNoteModel,
  NotificationListModel,
  RequestModel,
  SessionContext,
} from "./contracts.ts";
import type { DomainOutcome, FacadePipeline } from "./facade-pipeline.ts";
import { validateMutationContext } from "./validation.ts";

export interface ParentApplicationPort {
  listDuties(input: { actorId: string; familyId: string }): Promise<DomainOutcome<DutyListModel>>;
  getDuty?(input: {
    actorId: string;
    familyId: string;
    dutyId: string;
  }): Promise<DomainOutcome<DutyDetailModel>>;
  signUp(input: {
    actorId: string;
    familyId: string;
    dutyId: string;
    expectedVersion: number;
  }): Promise<DomainOutcome<AssignmentModel>>;
  requestSwap(input: {
    actorId: string;
    familyId: string;
    assignmentId: string;
    counterpartId: string;
    expectedVersion: number;
  }): Promise<DomainOutcome<RequestModel>>;
  requestCancellation(input: {
    actorId: string;
    familyId: string;
    assignmentId: string;
    expectedVersion: number;
  }): Promise<DomainOutcome<RequestModel>>;
  listNotifications(input: { actorId: string }): Promise<DomainOutcome<NotificationListModel>>;
  markNotificationRead(input: {
    actorId: string;
    notificationId: string;
  }): Promise<DomainOutcome<Readonly<{ link: string }>>>;
  updateOwnContribution(input: {
    actorId: string;
    eventId: string;
    note: string;
  }): Promise<DomainOutcome<EventNoteModel>>;
}

export class ParentApplicationFacade {
  private readonly pipeline: FacadePipeline;
  private readonly domain: ParentApplicationPort;

  constructor(pipeline: FacadePipeline, domain: ParentApplicationPort) {
    this.pipeline = pipeline;
    this.domain = domain;
  }

  listDuties(
    session: SessionContext,
    input: { familyScope: Scope; familyId: string },
  ): Promise<ApplicationResult<DutyListModel>> {
    return this.pipeline.invoke<DutyListModel>({
      session,
      matrixRowId: "AUTH-PARENT-DUTIES",
      action: "read",
      resource: "assignment",
      scope: input.familyScope,
      fields: ["SF-DISPLAY-NAME"],
      invoke: () =>
        this.domain.listDuties({ actorId: session.subjectId, familyId: input.familyId }),
      project: freezeDutyList,
    });
  }

  getDuty(
    session: SessionContext,
    input: { familyScope: Scope; familyId: string; dutyId: string },
  ): Promise<ApplicationResult<DutyDetailModel>> {
    return this.pipeline.invoke<DutyDetailModel>({
      session,
      matrixRowId: "AUTH-PARENT-DUTIES",
      action: "read",
      resource: "assignment",
      scope: input.familyScope,
      fields: ["SF-DISPLAY-NAME", "SF-PARTICIPANT-NAME"],
      invoke: () =>
        this.domain.getDuty?.({
          actorId: session.subjectId,
          familyId: input.familyId,
          dutyId: input.dutyId,
        }) ?? Promise.resolve({ state: "denied" as const }),
      project: Object.freeze,
    });
  }

  signUp(
    session: SessionContext,
    input: {
      familyScope: Scope;
      familyId: string;
      dutyId: string;
      expectedVersion: number;
      idempotencyKey: string;
    },
  ): Promise<ApplicationResult<AssignmentModel>> {
    const validation = validateMutationContext(input);
    if (validation.state !== "success") return Promise.resolve(validation);
    return this.pipeline.invoke<AssignmentModel>({
      session,
      matrixRowId: "AUTH-PARENT-DUTIES",
      action: "create",
      resource: "assignment",
      scope: input.familyScope,
      idempotencyKey: input.idempotencyKey,
      idempotency: {
        operation: "parent.signUp",
        fingerprint: `${input.familyId}:${input.dutyId}:${input.expectedVersion}`,
      },
      invoke: () =>
        this.domain.signUp({
          actorId: session.subjectId,
          familyId: input.familyId,
          dutyId: input.dutyId,
          expectedVersion: input.expectedVersion,
        }),
      project: Object.freeze,
    });
  }

  requestSwap(
    session: SessionContext,
    input: {
      familyScope: Scope;
      familyId: string;
      assignmentId: string;
      counterpartId: string;
      expectedVersion: number;
      idempotencyKey: string;
    },
  ): Promise<ApplicationResult<RequestModel>> {
    return this.mutateRequest(session, input, "swap_request", () =>
      this.domain.requestSwap({
        actorId: session.subjectId,
        familyId: input.familyId,
        assignmentId: input.assignmentId,
        counterpartId: input.counterpartId,
        expectedVersion: input.expectedVersion,
      }),
    );
  }

  requestCancellation(
    session: SessionContext,
    input: {
      familyScope: Scope;
      familyId: string;
      assignmentId: string;
      expectedVersion: number;
      idempotencyKey: string;
    },
  ): Promise<ApplicationResult<RequestModel>> {
    return this.mutateRequest(session, input, "cancellation_request", () =>
      this.domain.requestCancellation({
        actorId: session.subjectId,
        familyId: input.familyId,
        assignmentId: input.assignmentId,
        expectedVersion: input.expectedVersion,
      }),
    );
  }

  listNotifications(
    session: SessionContext,
    familyScope: Scope,
  ): Promise<ApplicationResult<NotificationListModel>> {
    return this.pipeline.invoke<NotificationListModel>({
      session,
      matrixRowId: "AUTH-PARENT-NOTIFICATIONS",
      action: "read",
      resource: "notification",
      scope: familyScope,
      invoke: () => this.domain.listNotifications({ actorId: session.subjectId }),
      project: (model) =>
        Object.freeze({
          notifications: Object.freeze(model.notifications.map((item) => Object.freeze(item))),
        }),
    });
  }

  markNotificationRead(
    session: SessionContext,
    input: { familyScope: Scope; notificationId: string; idempotencyKey: string },
  ): Promise<ApplicationResult<Readonly<{ link: string }>>> {
    return this.pipeline.invoke<Readonly<{ link: string }>>({
      session,
      matrixRowId: "AUTH-PARENT-NOTIFICATIONS",
      action: "update",
      resource: "notification",
      scope: input.familyScope,
      idempotencyKey: input.idempotencyKey,
      idempotency: {
        operation: "parent.markNotificationRead",
        fingerprint: input.notificationId,
      },
      invoke: () =>
        this.domain.markNotificationRead({
          actorId: session.subjectId,
          notificationId: input.notificationId,
        }),
      project: Object.freeze,
    });
  }

  updateOwnContribution(
    session: SessionContext,
    input: { familyScope: Scope; eventId: string; note: string; idempotencyKey: string },
  ): Promise<ApplicationResult<EventNoteModel>> {
    return this.pipeline.invoke<EventNoteModel>({
      session,
      matrixRowId: "AUTH-PARENT-DUTIES",
      action: "update",
      resource: "contribution",
      scope: input.familyScope,
      idempotencyKey: input.idempotencyKey,
      idempotency: {
        operation: "parent.updateOwnContribution",
        fingerprint: `${input.eventId}:${input.note}`,
      },
      invoke: () =>
        this.domain.updateOwnContribution({
          actorId: session.subjectId,
          eventId: input.eventId,
          note: input.note,
        }),
      project: Object.freeze,
    });
  }

  private mutateRequest(
    session: SessionContext,
    input: {
      familyScope: Scope;
      familyId: string;
      assignmentId: string;
      expectedVersion: number;
      idempotencyKey: string;
    },
    resource: "swap_request" | "cancellation_request",
    invoke: () => Promise<DomainOutcome<RequestModel>>,
  ): Promise<ApplicationResult<RequestModel>> {
    const validation = validateMutationContext(input);
    if (validation.state !== "success") return Promise.resolve(validation);
    return this.pipeline.invoke<RequestModel>({
      session,
      matrixRowId: "AUTH-PARENT-DUTIES",
      action: "create",
      resource,
      scope: input.familyScope,
      idempotencyKey: input.idempotencyKey,
      idempotency: {
        operation: `parent.${resource}`,
        fingerprint: `${input.assignmentId}:${input.expectedVersion}`,
      },
      invoke,
      project: Object.freeze,
    });
  }
}

function freezeDutyList(model: DutyListModel): DutyListModel {
  return Object.freeze({
    duties: Object.freeze(model.duties.map((item) => Object.freeze(item))),
  });
}
