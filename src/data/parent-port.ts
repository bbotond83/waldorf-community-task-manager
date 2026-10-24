import type {
  AssignmentModel,
  DomainOutcome,
  DutyDetailModel,
  DutyListItemModel,
  DutyListModel,
  EventNoteModel,
  NotificationListModel,
  ParentApplicationPort,
  RequestModel,
  SwapCandidateListModel,
  SwapRequestListModel,
  SwapResponseModel,
  WithdrawnRequestModel,
} from "../application/index.ts";
import type { DatabaseClient } from "../runtime/database/client.ts";
import { malformedResponse } from "./errors.ts";
import { DataGateway, type Envelope } from "./gateway.ts";
import { listNotifications, markNotificationRead } from "./notifications.ts";
import { refused, toItemsOutcome, toOutcome } from "./results.ts";
import { asRow, integer, isUuid, oneOf, optionalText, text, type Row } from "./values.ts";

/**
 * Database adapter for the parent application port (BR32.1, BR32.2): listDuties, getDuty, signUp, requestSwap,
 * requestCancellation, updateOwnContribution and the swap operations that came with the real backend, each
 * calling one named database function and returning the result states and codes the screens already map
 * (BR32.8).
 *
 * The family is never taken from the caller: every function finds the signed-in parent's family from the
 * session's account (BR32.2), so `actorId` and `familyId` of the port are accepted for the shape of the port
 * and not sent anywhere. A parent whose account has no linked parent, or whose family is archived, is
 * answered with `denied` by the function itself.
 */

/**
 * The use cases of this adapter that change a family's assignments, and so need a notification once U4
 * connects them (BR31.10): a sign-up, a swap request, the other family's answer, a withdrawal and a
 * cancellation request. The admin side adds the decisions, the removal of a place and the family archive
 * (see `ADMIN_NOTIFICATION_USE_CASES`). A test asserts that these lists name exactly the use cases that
 * change assignments, so a new use case cannot be added without deciding about its notification.
 */
export const PARENT_NOTIFICATION_USE_CASES = Object.freeze([
  "duty.sign_up",
  "swap.request",
  "swap.respond",
  "swap.withdraw",
  "cancellation.request",
] as const);

const DUTY_STATES = [
  "available",
  "full",
  "ineligible",
  "assigned",
  "swap-pending",
  "cancellation-pending",
] as const;

/** What a screen sends back with an action: the family's own place version when it has one. */
function dutyVersion(row: Row): number {
  return row.assignment_id ? integer(row, "assignment_version") : integer(row, "version");
}

function toListItem(row: Row): DutyListItemModel {
  return Object.freeze({
    id: text(row, "id"),
    title: text(row, "title"),
    dueAt: text(row, "due_at"),
    state: oneOf(row, "state", DUTY_STATES),
    version: dutyVersion(row),
  });
}

function toDetail(row: Row): DutyDetailModel {
  const assignmentId = optionalText(row, "assignment_id");
  const allergenNote = optionalText(row, "allergen_note");
  const ownContributionNote = optionalText(row, "own_contribution_note");
  return Object.freeze({
    id: text(row, "id"),
    title: text(row, "title"),
    dueAt: text(row, "due_at"),
    location: text(row, "location"),
    state: oneOf(row, "state", DUTY_STATES),
    version: dutyVersion(row),
    ...(assignmentId !== undefined ? { assignmentId } : {}),
    ...(allergenNote !== undefined ? { allergenNote } : {}),
    ...(ownContributionNote !== undefined ? { ownContributionNote } : {}),
  });
}

const missingKey = () =>
  refused({ idempotencyKey: "VAL-IDEMPOTENCY-KEY" }, "idempotency_key_invalid");
const missingVersion = (field: string) =>
  refused({ [field]: "VAL-EXPECTED-VERSION" }, "field_invalid");

/** An id that is not a uuid cannot name anything: it reads like a record that does not exist. */
const unknownRecord = () => ({ state: "denied" as const });

export class DatabaseParentPort implements ParentApplicationPort {
  private readonly gateway: DataGateway;

  constructor(database: DatabaseClient) {
    this.gateway = new DataGateway(database);
  }

  async listDuties(): Promise<DomainOutcome<DutyListModel>> {
    const envelope = await this.gateway.call("duty_list", {});
    return toItemsOutcome(envelope, (rows) =>
      Object.freeze({ duties: Object.freeze(rows.map(toListItem)) }),
    );
  }

  async getDuty(input: { dutyId: string }): Promise<DomainOutcome<DutyDetailModel>> {
    if (!isUuid(input.dutyId)) return unknownRecord();
    const envelope = await this.gateway.call("duty_get", { p_task_id: input.dutyId });
    return toOutcome(envelope, (current) => toDetail(asRow(current.item)));
  }

  async signUp(input: {
    dutyId: string;
    expectedVersion: number;
    idempotencyKey?: string;
  }): Promise<DomainOutcome<AssignmentModel>> {
    if (!input.idempotencyKey) return missingKey();
    if (!isUuid(input.dutyId)) return unknownRecord();
    const envelope = await this.gateway.call(
      "duty_sign_up",
      {
        p_idempotency_key: input.idempotencyKey,
        p_task_id: input.dutyId,
        p_expected_version: input.expectedVersion,
      },
      input.idempotencyKey,
    );
    return toOutcome(envelope, assignment);
  }

  async requestSwap(input: {
    assignmentId: string;
    counterpartId: string;
    expectedVersion: number;
    counterpartVersion?: number;
    reason?: string;
    idempotencyKey?: string;
  }): Promise<DomainOutcome<RequestModel>> {
    if (!input.idempotencyKey) return missingKey();
    if (input.counterpartVersion === undefined) return missingVersion("counterpartVersion");
    if (!isUuid(input.assignmentId) || !isUuid(input.counterpartId)) return unknownRecord();
    const envelope = await this.gateway.call(
      "swap_request",
      {
        p_idempotency_key: input.idempotencyKey,
        p_assignment_id: input.assignmentId,
        p_expected_version: input.expectedVersion,
        p_target_assignment_id: input.counterpartId,
        p_target_version: input.counterpartVersion,
        p_reason: input.reason ?? null,
      },
      input.idempotencyKey,
    );
    return toOutcome(envelope, pendingRequest);
  }

  async requestCancellation(input: {
    assignmentId: string;
    expectedVersion: number;
    reason?: string;
    idempotencyKey?: string;
  }): Promise<DomainOutcome<RequestModel>> {
    if (!input.idempotencyKey) return missingKey();
    if (!isUuid(input.assignmentId)) return unknownRecord();
    const envelope = await this.gateway.call(
      "cancellation_request",
      {
        p_idempotency_key: input.idempotencyKey,
        p_assignment_id: input.assignmentId,
        p_expected_version: input.expectedVersion,
        p_reason: input.reason ?? null,
      },
      input.idempotencyKey,
    );
    return toOutcome(envelope, pendingRequest);
  }

  async listSwapCandidates(input: {
    assignmentId: string;
  }): Promise<DomainOutcome<SwapCandidateListModel>> {
    if (!isUuid(input.assignmentId)) return unknownRecord();
    const envelope = await this.gateway.call("swap_candidates", {
      p_assignment_id: input.assignmentId,
    });
    return toItemsOutcome(envelope, (rows) =>
      Object.freeze({
        candidates: Object.freeze(
          rows.map((row) =>
            Object.freeze({
              assignmentId: text(row, "assignment_id"),
              assignmentVersion: integer(row, "assignment_version"),
              taskId: text(row, "task_id"),
              title: text(row, "title"),
              startsAt: text(row, "starts_at"),
              familyDisplayName: text(row, "family_display_name"),
            }),
          ),
        ),
      }),
    );
  }

  async respondToSwap(input: {
    requestId: string;
    accept: boolean;
    expectedVersion?: number;
    idempotencyKey?: string;
  }): Promise<DomainOutcome<SwapResponseModel>> {
    if (!input.idempotencyKey) return missingKey();
    if (!isUuid(input.requestId)) return unknownRecord();
    const envelope = await this.gateway.call(
      "swap_respond",
      {
        p_idempotency_key: input.idempotencyKey,
        p_request_id: input.requestId,
        p_accept: input.accept,
        p_expected_version: input.expectedVersion ?? null,
      },
      input.idempotencyKey,
    );
    return toOutcome(envelope, (current) => {
      // A repeated key answers with the stored reference only; the choice the family sent says what happened.
      const outcome =
        current.outcome === "applied" || current.outcome === "declined"
          ? current.outcome
          : input.accept
            ? "applied"
            : "declined";
      return Object.freeze({ id: reference(current), outcome });
    });
  }

  async withdrawRequest(input: {
    requestId: string;
    idempotencyKey?: string;
  }): Promise<DomainOutcome<WithdrawnRequestModel>> {
    if (!input.idempotencyKey) return missingKey();
    if (!isUuid(input.requestId)) return unknownRecord();
    const envelope = await this.gateway.call(
      "swap_withdraw",
      { p_idempotency_key: input.idempotencyKey, p_request_id: input.requestId },
      input.idempotencyKey,
    );
    return toOutcome(envelope, (current) =>
      Object.freeze({ id: reference(current), state: "withdrawn" as const }),
    );
  }

  async listSwapRequests(): Promise<DomainOutcome<SwapRequestListModel>> {
    const envelope = await this.gateway.call("swap_incoming", {});
    return toItemsOutcome(envelope, (rows) =>
      Object.freeze({
        requests: Object.freeze(
          rows.map((row) => {
            const partnerTaskTitle = optionalText(row, "partner_task_title");
            const partnerTaskStartsAt = optionalText(row, "partner_task_starts_at");
            const partnerFamilyName = optionalText(row, "partner_family_name");
            return Object.freeze({
              id: text(row, "request_id"),
              kind: oneOf(row, "kind", ["swap", "cancellation"] as const),
              direction: oneOf(row, "direction", ["incoming", "outgoing"] as const),
              version: integer(row, "version"),
              ownTaskTitle: text(row, "own_task_title"),
              ownTaskStartsAt: text(row, "own_task_starts_at"),
              ...(partnerTaskTitle !== undefined ? { partnerTaskTitle } : {}),
              ...(partnerTaskStartsAt !== undefined ? { partnerTaskStartsAt } : {}),
              ...(partnerFamilyName !== undefined ? { partnerFamilyName } : {}),
            });
          }),
        ),
      }),
    );
  }

  /**
   * The parent's own notifications, newest first (BR40.2). The lazy reminder tick runs first, so reminders that
   * have come due are in the list; the database finds the parent from the session.
   */
  async listNotifications(): Promise<DomainOutcome<NotificationListModel>> {
    return listNotifications(this.gateway);
  }

  /** Marks the parent's own notification as read and returns its link; another parent's reads as denied (BR40.3). */
  async markNotificationRead(input: {
    notificationId: string;
  }): Promise<DomainOutcome<Readonly<{ link: string }>>> {
    return markNotificationRead(this.gateway, input.notificationId);
  }

  async updateOwnContribution(input: {
    eventId: string;
    note: string;
    idempotencyKey?: string;
  }): Promise<DomainOutcome<EventNoteModel>> {
    if (!input.idempotencyKey) return missingKey();
    // The parent port calls the duty an "event"; the function finds the family's own place on this task.
    if (!isUuid(input.eventId)) return unknownRecord();
    const envelope = await this.gateway.call(
      "contribution_save",
      {
        p_idempotency_key: input.idempotencyKey,
        p_task_id: input.eventId,
        p_text: input.note,
      },
      input.idempotencyKey,
    );
    return toOutcome(envelope, () =>
      Object.freeze({ eventId: input.eventId, note: input.note.trim() }),
    );
  }
}

function reference(envelope: Envelope): string {
  if (!envelope.reference) throw malformedResponse();
  return envelope.reference;
}

/**
 * The new place. A repeated key answers with the stored reference only, and a place always starts at
 * version 1, so that is the version reported then.
 */
function assignment(envelope: Envelope): AssignmentModel {
  return Object.freeze({
    id: reference(envelope),
    state: "assigned" as const,
    version: typeof envelope.version === "number" ? envelope.version : 1,
  });
}

function pendingRequest(envelope: Envelope): RequestModel {
  return Object.freeze({ id: reference(envelope), state: "pending" as const });
}

export function createParentPort(database: DatabaseClient): ParentApplicationPort {
  return new DatabaseParentPort(database);
}
