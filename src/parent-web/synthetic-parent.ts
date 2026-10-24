import { currentSyntheticActor } from "../runtime/synthetic/access-state.ts";
import type { Scope } from "../access/index.ts";
import {
  FacadePipeline,
  IdempotencyCoordinator,
  InMemoryIdempotencyStore,
  ParentApplicationFacade,
  SessionApplicationFacade,
  type AssignmentModel,
  type AuthorizationContract,
  type DomainOutcome,
  type DutyDetailModel,
  type DutyListModel,
  type EventNoteModel,
  type NotificationListModel,
  type NotificationModel,
  type ParentApplicationPort,
  type RequestModel,
  type SessionContext,
  type SessionGateway,
  type SwapRequestListModel,
} from "../application/index.ts";
import { getSyntheticProfile } from "../runtime/synthetic/profiles.ts";

export const PARENT_FAMILY_ID = "family-boroka";
export const PARENT_FAMILY_SCOPE: Scope = Object.freeze({
  id: PARENT_FAMILY_ID,
  type: "family",
  organizationId: "org-napsugar",
});

const DUTY_FIXTURES: readonly DutyDetailModel[] = Object.freeze([
  Object.freeze({
    id: "duty-garden",
    title: "Kerti előkészítés",
    dueAt: "2026-09-05T08:00:00+02:00",
    location: "Napsugár Waldorf Óvoda kertje",
    state: "available",
    version: 1,
    allergenNote: "Dióféléktől mentes közös étkezés.",
    ownContributionNote: "Gyümölcsöt viszünk.",
  }),
  Object.freeze({
    id: "duty-full",
    title: "Őszi vásár előkészítése",
    dueAt: "2026-09-12T09:00:00+02:00",
    location: "Közösségi terem",
    state: "full",
    version: 3,
  }),
  Object.freeze({
    id: "duty-ineligible",
    title: "Hétköznapi udvarrendezés",
    dueAt: "2026-09-16T14:00:00+02:00",
    location: "Óvodaudvar",
    state: "ineligible",
    version: 2,
  }),
  Object.freeze({
    id: "duty-assigned",
    title: "Lámpás ünnep előkészítése",
    dueAt: "2026-11-08T16:30:00+01:00",
    location: "Közösségi terem",
    state: "assigned",
    version: 4,
    assignmentId: "assignment-lampas",
    allergenNote: "A sütemények összetevőit külön jelöljük.",
    ownContributionNote: "Almalevet viszünk.",
  }),
]);

const NOTIFICATION_FIXTURES = Object.freeze([
  Object.freeze({
    id: "notice-7-day",
    title: "Egy hét múlva: Lámpás ünnep előkészítése",
    link: "/szulo/feladatok/duty-assigned",
    isRead: false,
    timing: "7-day" as const,
    providerStatus: "simulated-sent" as const,
  }),
  Object.freeze({
    id: "notice-24-hour",
    title: "Holnap: Kerti előkészítés",
    link: "/szulo/feladatok/duty-garden",
    isRead: false,
    timing: "24-hour" as const,
    providerStatus: "simulated-retry" as const,
  }),
  Object.freeze({
    id: "notice-stale",
    title: "Korábbi, már nem aktuális emlékeztető",
    link: "/szulo/ertesitesek",
    isRead: true,
    timing: "stale" as const,
    providerStatus: "simulated-cancelled" as const,
  }),
]);

/**
 * Per-browser copies of a few fixtures. The browser tests run three projects against separate
 * servers, but each project keeps its own copy so a mutation in one never affects another. They
 * exist only when the test-mode switch `SYNTHETIC_TEST_COPIES=1` is set, never in the demo.
 */
const TEST_DUTY_FIXTURES: readonly DutyDetailModel[] = Object.freeze([
  Object.freeze({
    id: "duty-garden-firefox",
    title: "Kerti előkészítés – Firefox próba",
    dueAt: "2026-09-06T08:00:00+02:00",
    location: "Napsugár Waldorf Óvoda kertje",
    state: "available",
    version: 1,
  }),
  Object.freeze({
    id: "duty-garden-mobile",
    title: "Kerti előkészítés – mobil próba",
    dueAt: "2026-09-07T08:00:00+02:00",
    location: "Napsugár Waldorf Óvoda kertje",
    state: "available",
    version: 1,
  }),
  Object.freeze({
    id: "duty-assigned-firefox",
    title: "Lámpás ünnep előkészítése – Firefox próba",
    dueAt: "2026-11-09T16:30:00+01:00",
    location: "Közösségi terem",
    state: "assigned",
    version: 4,
    assignmentId: "assignment-lampas-firefox",
    allergenNote: "A sütemények összetevőit külön jelöljük.",
    ownContributionNote: "Almalevet viszünk.",
  }),
  Object.freeze({
    id: "duty-assigned-mobile",
    title: "Lámpás ünnep előkészítése – mobil próba",
    dueAt: "2026-11-10T16:30:00+01:00",
    location: "Közösségi terem",
    state: "assigned",
    version: 4,
    assignmentId: "assignment-lampas-mobile",
    allergenNote: "A sütemények összetevőit külön jelöljük.",
    ownContributionNote: "Almalevet viszünk.",
  }),
]);

const TEST_NOTIFICATION_FIXTURES: readonly NotificationModel[] = Object.freeze([
  Object.freeze({
    id: "notice-7-day-firefox",
    title: "Egy hét múlva: Lámpás ünnep – Firefox próba",
    link: "/szulo/feladatok/duty-assigned-firefox",
    isRead: false,
    timing: "7-day" as const,
    providerStatus: "simulated-sent" as const,
  }),
  Object.freeze({
    id: "notice-7-day-mobile",
    title: "Egy hét múlva: Lámpás ünnep – mobil próba",
    link: "/szulo/feladatok/duty-assigned-mobile",
    isRead: false,
    timing: "7-day" as const,
    providerStatus: "simulated-sent" as const,
  }),
]);

/** The test-mode switch that adds the per-browser copies to the fixtures. */
export const TEST_COPIES_VARIABLE = "SYNTHETIC_TEST_COPIES";

export function buildDutyFixtures(testCopies: boolean): readonly DutyDetailModel[] {
  return testCopies ? [...DUTY_FIXTURES, ...TEST_DUTY_FIXTURES] : DUTY_FIXTURES;
}

export function buildNotificationFixtures(testCopies: boolean): readonly NotificationModel[] {
  return testCopies
    ? [...NOTIFICATION_FIXTURES, ...TEST_NOTIFICATION_FIXTURES]
    : NOTIFICATION_FIXTURES;
}

function testCopiesEnabled(): boolean {
  return process.env[TEST_COPIES_VARIABLE] === "1";
}

type MutableParentState = {
  duties: Map<string, DutyDetailModel>;
  notifications: Map<string, NotificationModel>;
  contributionNotes: Map<string, string>;
  requests: Map<string, RequestModel>;
};

/**
 * The state lives on the global object, not in a module variable: the production build can load
 * this file once for the pages and actions and once for the reset route, and a module variable
 * would then be reset in the wrong copy.
 */
const STATE_KEY = Symbol.for("waldorf.syntheticParentState");
type StateHolder = { [STATE_KEY]?: MutableParentState };

function currentState(): MutableParentState {
  const holder = globalThis as StateHolder;
  holder[STATE_KEY] ??= createState();
  return holder[STATE_KEY];
}

function createState(): MutableParentState {
  const dutyFixtures = buildDutyFixtures(testCopiesEnabled());
  return {
    duties: new Map(dutyFixtures.map((duty) => [duty.id, duty])),
    notifications: new Map(
      buildNotificationFixtures(testCopiesEnabled()).map((notice) => [notice.id, notice]),
    ),
    contributionNotes: new Map(
      dutyFixtures.flatMap((duty) =>
        duty.ownContributionNote ? [[duty.id, duty.ownContributionNote] as const] : [],
      ),
    ),
    requests: new Map(),
  };
}

export function resetSyntheticParentState(): void {
  (globalThis as StateHolder)[STATE_KEY] = createState();
}

class RetryableSyntheticFailure extends Error {}
class TerminalSyntheticFailure extends Error {}

export function createSyntheticParentFacade(
  authorization: AuthorizationContract,
): ParentApplicationFacade {
  const pipeline = new FacadePipeline(
    authorization,
    (error) => (error instanceof RetryableSyntheticFailure ? "retryable" : "terminal"),
    new IdempotencyCoordinator(new InMemoryIdempotencyStore()),
  );
  return new ParentApplicationFacade(pipeline, new SyntheticParentPort());
}

class SyntheticParentPort implements ParentApplicationPort {
  async listDuties(input: {
    actorId: string;
    familyId: string;
  }): Promise<DomainOutcome<DutyListModel>> {
    if (!ownsFamily(input)) return { state: "denied" };
    const duties = [...currentState().duties.values()].map(toListItem);
    return duties.length ? { state: "success", data: { duties } } : { state: "empty" };
  }

  async getDuty(input: {
    actorId: string;
    familyId: string;
    dutyId: string;
  }): Promise<DomainOutcome<DutyDetailModel>> {
    if (!ownsFamily(input)) return { state: "denied" };
    const duty = currentState().duties.get(input.dutyId);
    if (!duty) return { state: "denied" };
    return {
      state: "success",
      data: Object.freeze({
        ...duty,
        ownContributionNote: currentState().contributionNotes.get(duty.id),
      }),
    };
  }

  async signUp(input: {
    actorId: string;
    familyId: string;
    dutyId: string;
    expectedVersion: number;
  }): Promise<DomainOutcome<AssignmentModel>> {
    if (!ownsFamily(input)) return { state: "denied" };
    if (input.dutyId === "duty-retry") throw new RetryableSyntheticFailure();
    if (input.dutyId === "duty-terminal") throw new TerminalSyntheticFailure();
    const duty = currentState().duties.get(input.dutyId);
    if (!duty) return { state: "denied" };
    if (duty.version !== input.expectedVersion) {
      return { state: "invalidated", code: "DUTY_VERSION_STALE" };
    }
    if (duty.state === "full") return { state: "conflict", code: "DUTY_FULL" };
    if (duty.state === "ineligible") return { state: "conflict", code: "DUTY_INELIGIBLE" };
    if (duty.state !== "available") return { state: "conflict", code: "DUTY_ALREADY_ASSIGNED" };
    const assignment: AssignmentModel = Object.freeze({
      id: `assignment-${duty.id}`,
      state: "assigned",
      version: duty.version + 1,
    });
    currentState().duties.set(
      duty.id,
      Object.freeze({
        ...duty,
        state: "assigned",
        assignmentId: assignment.id,
        version: assignment.version,
      }),
    );
    return { state: "success", data: assignment };
  }

  async requestSwap(input: {
    actorId: string;
    familyId: string;
    assignmentId: string;
    counterpartId: string;
    expectedVersion: number;
  }): Promise<DomainOutcome<RequestModel>> {
    if (!ownsFamily(input)) return { state: "denied" };
    return this.createRequest(
      "swap",
      input.assignmentId,
      input.counterpartId,
      input.expectedVersion,
    );
  }

  async requestCancellation(input: {
    actorId: string;
    familyId: string;
    assignmentId: string;
    expectedVersion: number;
  }): Promise<DomainOutcome<RequestModel>> {
    if (!ownsFamily(input)) return { state: "denied" };
    return this.createRequest(
      "cancellation",
      input.assignmentId,
      input.assignmentId.replace("assignment-", ""),
      input.expectedVersion,
    );
  }

  /** The demo family has no other family to swap with, so the page for incoming requests is empty. */
  async listSwapRequests(input: {
    actorId: string;
    familyId: string;
  }): Promise<DomainOutcome<SwapRequestListModel>> {
    if (!ownsFamily(input)) return { state: "denied" };
    return { state: "empty" };
  }

  async listNotifications(input: {
    actorId: string;
  }): Promise<DomainOutcome<NotificationListModel>> {
    if (input.actorId !== "parent-local") return { state: "denied" };
    return {
      state: "success",
      data: { notifications: [...currentState().notifications.values()] },
    };
  }

  async markNotificationRead(input: {
    actorId: string;
    notificationId: string;
  }): Promise<DomainOutcome<Readonly<{ link: string }>>> {
    if (input.actorId !== "parent-local") return { state: "denied" };
    const notification = currentState().notifications.get(input.notificationId);
    if (!notification) return { state: "denied" };
    currentState().notifications.set(
      input.notificationId,
      Object.freeze({ ...notification, isRead: true }),
    );
    return { state: "success", data: Object.freeze({ link: notification.link }) };
  }

  async updateOwnContribution(input: {
    actorId: string;
    eventId: string;
    note: string;
  }): Promise<DomainOutcome<EventNoteModel>> {
    if (input.actorId !== "parent-local") return { state: "denied" };
    const duty = currentState().duties.get(input.eventId);
    if (!duty?.assignmentId) return { state: "denied" };
    currentState().contributionNotes.set(input.eventId, input.note);
    return {
      state: "success",
      data: Object.freeze({ eventId: input.eventId, note: input.note }),
    };
  }

  private createRequest(
    kind: "swap" | "cancellation",
    assignmentId: string,
    scenario: string,
    expectedVersion: number,
  ): DomainOutcome<RequestModel> {
    if (scenario.includes("retryable")) throw new RetryableSyntheticFailure();
    if (scenario.includes("terminal")) throw new TerminalSyntheticFailure();
    if (scenario === "conflict") return { state: "conflict", code: "REQUEST_CONFLICT" };
    if (scenario === "invalidated") {
      return { state: "invalidated", code: "REQUEST_INVALIDATED" };
    }
    const normalizedAssignmentId = assignmentId.split("--scenario-")[0]!;
    const assignedDuty = [...currentState().duties.values()].find(
      (duty) => duty.assignmentId === normalizedAssignmentId,
    );
    if (!assignedDuty) return { state: "denied" };
    if (assignedDuty.version !== expectedVersion) {
      return { state: "invalidated", code: "REQUEST_VERSION_STALE" };
    }
    const requestId = `${kind}-request-${assignedDuty.id}`;
    const existing = currentState().requests.get(requestId);
    if (existing) return { state: "conflict", code: "REQUEST_DUPLICATE" };
    const request = Object.freeze({ id: requestId, state: "pending" as const });
    currentState().requests.set(requestId, request);
    const duty = assignedDuty;
    currentState().duties.set(
      duty.id,
      Object.freeze({
        ...duty,
        state: kind === "swap" ? "swap-pending" : "cancellation-pending",
        version: duty.version + 1,
      }),
    );
    return { state: "success", data: request };
  }
}

function ownsFamily(input: { actorId: string; familyId: string }): boolean {
  return input.actorId === "parent-local" && input.familyId === PARENT_FAMILY_ID;
}

function toListItem(duty: DutyDetailModel) {
  return Object.freeze({
    id: duty.id,
    title: duty.title,
    dueAt: duty.dueAt,
    state: duty.state,
    version: duty.version,
  });
}

export type InvitationState = "valid" | "expired" | "used" | "invalid";

export function inspectSyntheticInvitation(token: string): InvitationState {
  if (token === "parent-valid-invitation") return "valid";
  if (token === "parent-expired-invitation") return "expired";
  if (token === "parent-used-invitation") return "used";
  return "invalid";
}

export function createSyntheticParentSessionFacade(
  authorization: AuthorizationContract,
): SessionApplicationFacade {
  const gateway: SessionGateway = {
    async resolve(reference): Promise<SessionContext | undefined> {
      return reference === "parent-local" ? parentApplicationSession() : undefined;
    },
    async selectSynthetic(profileId): Promise<SessionContext | undefined> {
      return profileId === "parent-local" ? parentApplicationSession() : undefined;
    },
    async switchSynthetic(profileId): Promise<SessionContext | undefined> {
      return profileId === "parent-local" ? parentApplicationSession() : undefined;
    },
    async acceptInvitation(token): Promise<{ destination: string } | undefined> {
      return inspectSyntheticInvitation(token) === "valid"
        ? { destination: "/szulo/feladatok" }
        : undefined;
    },
    async resendInvitation(): Promise<void> {},
  };
  return new SessionApplicationFacade("synthetic", gateway, authorization);
}

function parentApplicationSession(): SessionContext | undefined {
  const profile = getSyntheticProfile("parent-local");
  if (!profile) return undefined;
  return currentSyntheticActor(profile.id);
}
