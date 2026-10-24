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
  SwapCandidateListModel,
  SwapRequestListModel,
  SwapResponseModel,
  WithdrawnRequestModel,
} from "./contracts.ts";
import type { DomainOutcome, FacadePipeline } from "./facade-pipeline.ts";
import { validateIdempotencyKey, validateMutationContext } from "./validation.ts";

/**
 * What the parent facade needs from a data source. The command inputs carry the idempotency key so a
 * database adapter can pass it on (BR32.1); the synthetic adapter ignores it. The swap operations that
 * came with the real backend (listSwapCandidates, respondToSwap, withdrawRequest, listSwapRequests) are
 * optional here for the same reason `getDuty` is: the synthetic adapter has none of them, and the facade
 * answers `denied` when the adapter lacks one.
 */
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
    idempotencyKey?: string;
  }): Promise<DomainOutcome<AssignmentModel>>;
  requestSwap(input: {
    actorId: string;
    familyId: string;
    assignmentId: string;
    counterpartId: string;
    expectedVersion: number;
    /** The chosen partner assignment's version, from the candidate list. */
    counterpartVersion?: number;
    reason?: string;
    idempotencyKey?: string;
  }): Promise<DomainOutcome<RequestModel>>;
  requestCancellation(input: {
    actorId: string;
    familyId: string;
    assignmentId: string;
    expectedVersion: number;
    reason?: string;
    idempotencyKey?: string;
  }): Promise<DomainOutcome<RequestModel>>;
  listSwapCandidates?(input: {
    actorId: string;
    familyId: string;
    assignmentId: string;
  }): Promise<DomainOutcome<SwapCandidateListModel>>;
  respondToSwap?(input: {
    actorId: string;
    familyId: string;
    requestId: string;
    accept: boolean;
    expectedVersion?: number;
    idempotencyKey?: string;
  }): Promise<DomainOutcome<SwapResponseModel>>;
  withdrawRequest?(input: {
    actorId: string;
    familyId: string;
    requestId: string;
    idempotencyKey?: string;
  }): Promise<DomainOutcome<WithdrawnRequestModel>>;
  listSwapRequests?(input: {
    actorId: string;
    familyId: string;
  }): Promise<DomainOutcome<SwapRequestListModel>>;
  listNotifications(input: { actorId: string }): Promise<DomainOutcome<NotificationListModel>>;
  markNotificationRead(input: {
    actorId: string;
    notificationId: string;
  }): Promise<DomainOutcome<Readonly<{ link: string }>>>;
  updateOwnContribution(input: {
    actorId: string;
    eventId: string;
    note: string;
    idempotencyKey?: string;
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
          idempotencyKey: input.idempotencyKey,
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
      /** The version of the chosen partner assignment (BR32.7); the real backend needs it. */
      counterpartVersion?: number;
      reason?: string;
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
        ...(input.counterpartVersion !== undefined
          ? { counterpartVersion: input.counterpartVersion }
          : {}),
        ...(input.reason !== undefined ? { reason: input.reason } : {}),
        idempotencyKey: input.idempotencyKey,
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
      reason?: string;
      idempotencyKey: string;
    },
  ): Promise<ApplicationResult<RequestModel>> {
    return this.mutateRequest(session, input, "cancellation_request", () =>
      this.domain.requestCancellation({
        actorId: session.subjectId,
        familyId: input.familyId,
        assignmentId: input.assignmentId,
        expectedVersion: input.expectedVersion,
        ...(input.reason !== undefined ? { reason: input.reason } : {}),
        idempotencyKey: input.idempotencyKey,
      }),
    );
  }

  /** The partners a parent may choose for one of their own assignments (BR31.4). */
  listSwapCandidates(
    session: SessionContext,
    input: { familyScope: Scope; familyId: string; assignmentId: string },
  ): Promise<ApplicationResult<SwapCandidateListModel>> {
    return this.pipeline.invoke<SwapCandidateListModel>({
      session,
      matrixRowId: "AUTH-PARENT-DUTIES",
      action: "read",
      resource: "swap_request",
      scope: input.familyScope,
      fields: ["SF-DISPLAY-NAME"],
      invoke: () =>
        this.domain.listSwapCandidates?.({
          actorId: session.subjectId,
          familyId: input.familyId,
          assignmentId: input.assignmentId,
        }) ?? Promise.resolve({ state: "denied" as const }),
      project: (model) =>
        Object.freeze({
          candidates: Object.freeze(model.candidates.map((item) => Object.freeze(item))),
        }),
    });
  }

  /** The open requests addressed to the family and the family's own open requests (BR31.4). */
  listSwapRequests(
    session: SessionContext,
    input: { familyScope: Scope; familyId: string },
  ): Promise<ApplicationResult<SwapRequestListModel>> {
    return this.pipeline.invoke<SwapRequestListModel>({
      session,
      matrixRowId: "AUTH-PARENT-DUTIES",
      action: "read",
      resource: "swap_request",
      scope: input.familyScope,
      fields: ["SF-DISPLAY-NAME"],
      invoke: () =>
        this.domain.listSwapRequests?.({
          actorId: session.subjectId,
          familyId: input.familyId,
        }) ?? Promise.resolve({ state: "denied" as const }),
      project: (model) =>
        Object.freeze({
          requests: Object.freeze(model.requests.map((item) => Object.freeze(item))),
        }),
    });
  }

  /** The other family confirms or declines a swap request addressed to it (BR31.4). */
  respondToSwap(
    session: SessionContext,
    input: {
      familyScope: Scope;
      familyId: string;
      requestId: string;
      accept: boolean;
      expectedVersion?: number;
      idempotencyKey: string;
    },
  ): Promise<ApplicationResult<SwapResponseModel>> {
    const invalid = validateIdempotencyKey(input.idempotencyKey);
    if (invalid) return Promise.resolve(invalid);
    return this.pipeline.invoke<SwapResponseModel>({
      session,
      matrixRowId: "AUTH-PARENT-DUTIES",
      action: "respond",
      resource: "swap_request",
      scope: input.familyScope,
      idempotencyKey: input.idempotencyKey,
      idempotency: {
        operation: "parent.swap_respond",
        fingerprint: `${input.requestId}:${input.accept}:${input.expectedVersion ?? ""}`,
      },
      invoke: () =>
        this.domain.respondToSwap?.({
          actorId: session.subjectId,
          familyId: input.familyId,
          requestId: input.requestId,
          accept: input.accept,
          ...(input.expectedVersion !== undefined
            ? { expectedVersion: input.expectedVersion }
            : {}),
          idempotencyKey: input.idempotencyKey,
        }) ?? Promise.resolve({ state: "denied" as const }),
      project: Object.freeze,
    });
  }

  /** The requester's family withdraws its own open swap or cancellation request (BR31.4). */
  withdrawRequest(
    session: SessionContext,
    input: {
      familyScope: Scope;
      familyId: string;
      requestId: string;
      kind?: "swap" | "cancellation";
      idempotencyKey: string;
    },
  ): Promise<ApplicationResult<WithdrawnRequestModel>> {
    const invalid = validateIdempotencyKey(input.idempotencyKey);
    if (invalid) return Promise.resolve(invalid);
    return this.pipeline.invoke<WithdrawnRequestModel>({
      session,
      matrixRowId: "AUTH-PARENT-DUTIES",
      action: "withdraw",
      resource: input.kind === "cancellation" ? "cancellation_request" : "swap_request",
      scope: input.familyScope,
      idempotencyKey: input.idempotencyKey,
      idempotency: { operation: "parent.request_withdraw", fingerprint: input.requestId },
      invoke: () =>
        this.domain.withdrawRequest?.({
          actorId: session.subjectId,
          familyId: input.familyId,
          requestId: input.requestId,
          idempotencyKey: input.idempotencyKey,
        }) ?? Promise.resolve({ state: "denied" as const }),
      project: Object.freeze,
    });
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
          idempotencyKey: input.idempotencyKey,
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
