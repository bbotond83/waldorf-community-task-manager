import type { Scope } from "../access/index.ts";
import type {
  ApplicationResult,
  EventChangeModel,
  EventDetailModel,
  EventListModel,
  SessionContext,
  TypedRoleListModel,
} from "./contracts.ts";
import { matrixRowFor } from "./admin-facade.ts";
import type { DomainOutcome, FacadePipeline } from "./facade-pipeline.ts";
import { validateMutationContext, validateIdempotencyKey } from "./validation.ts";

type Outcome<T> = Promise<DomainOutcome<T>>;
type Key = { idempotencyKey: string };

/** One database function per method, with the idempotency key and, where a row changes, the version the screen saw. */
export interface EventApplicationPort {
  list(input: { past: boolean }): Outcome<EventListModel>;
  listForGroup(input: { groupId: string; past: boolean }): Outcome<EventListModel>;
  detail(eventId: string): Outcome<EventDetailModel>;
  saveNotices(
    input: Key & { eventId: string; expectedVersion: number; notices: readonly string[] },
  ): Outcome<EventChangeModel>;
  saveTale(
    input: Key & { eventId: string; expectedVersion: number; tale: string },
  ): Outcome<EventChangeModel>;
  saveRole(
    input: Key & {
      eventId: string;
      roleId?: string;
      expectedVersion?: number;
      name: string;
      parentId?: string;
      personName?: string;
      isOrganiser: boolean;
    },
  ): Outcome<EventChangeModel>;
  removeRole(input: Key & { roleId: string; expectedVersion: number }): Outcome<EventChangeModel>;
  clearRoleName(
    input: Key & { roleId: string; expectedVersion: number },
  ): Outcome<EventChangeModel>;
  typedRoles(input: {
    subjectKind: "parent" | "family";
    subjectId: string;
  }): Outcome<TypedRoleListModel>;
  addSignup(
    input: Key & { eventId: string; note?: string; chosenAt?: string },
  ): Outcome<EventChangeModel>;
  changeSignup(
    input: Key & { signupId: string; expectedVersion: number; note?: string; chosenAt?: string },
  ): Outcome<EventChangeModel>;
  withdrawSignup(
    input: Key & { signupId: string; expectedVersion: number },
  ): Outcome<EventChangeModel>;
  addOffer(
    input: Key & {
      eventId: string;
      category: string;
      text: string;
      hasMilk: boolean;
      hasEgg: boolean;
      hasGarlic: boolean;
    },
  ): Outcome<EventChangeModel>;
  changeOffer(
    input: Key & {
      offerId: string;
      expectedVersion: number;
      category: string;
      text: string;
      hasMilk: boolean;
      hasEgg: boolean;
      hasGarlic: boolean;
    },
  ): Outcome<EventChangeModel>;
  withdrawOffer(
    input: Key & { offerId: string; expectedVersion: number },
  ): Outcome<EventChangeModel>;
}

type Command<T> = Readonly<{ scope: Scope }> & T;
type Versioned = Key & { expectedVersion: number };

/**
 * The event pages every signed-in role reads, the sign-up and food-offer commands (a parent's own act, withdrawing
 * also a manager's), and the manager's commands for notices, tale and roles (U10; BR100 to BR124). Each caller names
 * the scope of a right it holds; the database repeats every check and decides who manages which event.
 */
export class EventApplicationFacade {
  private readonly pipeline: FacadePipeline;
  private readonly domain: EventApplicationPort;

  constructor(pipeline: FacadePipeline, domain: EventApplicationPort) {
    this.pipeline = pipeline;
    this.domain = domain;
  }

  list(
    session: SessionContext,
    scope: Scope,
    options: { past?: boolean } = {},
  ): Promise<ApplicationResult<EventListModel>> {
    return this.read(session, scope, () => this.domain.list({ past: options.past === true }));
  }

  listForGroup(
    session: SessionContext,
    scope: Scope,
    groupId: string,
    options: { past?: boolean } = {},
  ): Promise<ApplicationResult<EventListModel>> {
    return this.read(session, scope, () =>
      this.domain.listForGroup({ groupId, past: options.past === true }),
    );
  }

  /** One event page. A missing event, and one of another community, read as denied. */
  detail(
    session: SessionContext,
    scope: Scope,
    eventId: string,
  ): Promise<ApplicationResult<EventDetailModel>> {
    return this.read(session, scope, () => this.domain.detail(eventId));
  }

  addSignup(
    session: SessionContext,
    input: Command<Key & { eventId: string; note?: string; chosenAt?: string }>,
  ) {
    return this.parentCommand(session, input, "create", "event_signup", () =>
      this.domain.addSignup(withoutScope(input)),
    );
  }

  changeSignup(
    session: SessionContext,
    input: Command<Versioned & { signupId: string; note?: string; chosenAt?: string }>,
  ) {
    return this.parentCommand(session, input, "update", "event_signup", () =>
      this.domain.changeSignup(withoutScope(input)),
    );
  }

  /** The owner withdraws their own sign-up; `asManager` is for the manager of the event, who may withdraw any. */
  withdrawSignup(
    session: SessionContext,
    input: Command<Versioned & { signupId: string; asManager?: boolean }>,
  ) {
    return input.asManager
      ? this.managerCommand(session, input, () =>
          this.domain.withdrawSignup({
            idempotencyKey: input.idempotencyKey,
            signupId: input.signupId,
            expectedVersion: input.expectedVersion,
          }),
        )
      : this.parentCommand(session, input, "delete", "event_signup", () =>
          this.domain.withdrawSignup({
            idempotencyKey: input.idempotencyKey,
            signupId: input.signupId,
            expectedVersion: input.expectedVersion,
          }),
        );
  }

  addOffer(
    session: SessionContext,
    input: Command<
      Key & {
        eventId: string;
        category: string;
        text: string;
        hasMilk: boolean;
        hasEgg: boolean;
        hasGarlic: boolean;
      }
    >,
  ) {
    return this.parentCommand(session, input, "create", "food_offer", () =>
      this.domain.addOffer(withoutScope(input)),
    );
  }

  changeOffer(
    session: SessionContext,
    input: Command<
      Versioned & {
        offerId: string;
        category: string;
        text: string;
        hasMilk: boolean;
        hasEgg: boolean;
        hasGarlic: boolean;
      }
    >,
  ) {
    return this.parentCommand(session, input, "update", "food_offer", () =>
      this.domain.changeOffer(withoutScope(input)),
    );
  }

  withdrawOffer(
    session: SessionContext,
    input: Command<Versioned & { offerId: string; asManager?: boolean }>,
  ) {
    const run = () =>
      this.domain.withdrawOffer({
        idempotencyKey: input.idempotencyKey,
        offerId: input.offerId,
        expectedVersion: input.expectedVersion,
      });
    return input.asManager
      ? this.managerCommand(session, input, run)
      : this.parentCommand(session, input, "delete", "food_offer", run);
  }

  saveNotices(
    session: SessionContext,
    input: Command<Versioned & { eventId: string; notices: readonly string[] }>,
  ) {
    return this.managerCommand(session, input, () =>
      this.domain.saveNotices({
        idempotencyKey: input.idempotencyKey,
        eventId: input.eventId,
        expectedVersion: input.expectedVersion,
        notices: input.notices,
      }),
    );
  }

  saveTale(session: SessionContext, input: Command<Versioned & { eventId: string; tale: string }>) {
    return this.managerCommand(session, input, () =>
      this.domain.saveTale({
        idempotencyKey: input.idempotencyKey,
        eventId: input.eventId,
        expectedVersion: input.expectedVersion,
        tale: input.tale,
      }),
    );
  }

  /** Adds a role (no `roleId`, no version) or changes one (both). */
  saveRole(
    session: SessionContext,
    input: Command<
      Key & {
        eventId: string;
        roleId?: string;
        expectedVersion?: number;
        name: string;
        parentId?: string;
        personName?: string;
        isOrganiser: boolean;
      }
    >,
  ) {
    return this.pipeline.invoke<EventChangeModel>({
      session,
      matrixRowId: matrixRowFor(session, input.scope),
      action: "manage",
      resource: "event_manage",
      scope: input.scope,
      idempotencyKey: input.idempotencyKey,
      validate: () => keyCheck(input),
      invoke: () => this.domain.saveRole(withoutScope(input)),
      project: (model) => Object.freeze({ ...model }),
    });
  }

  removeRole(session: SessionContext, input: Command<Versioned & { roleId: string }>) {
    return this.managerCommand(session, input, () =>
      this.domain.removeRole({
        idempotencyKey: input.idempotencyKey,
        roleId: input.roleId,
        expectedVersion: input.expectedVersion,
      }),
    );
  }

  /** Clears a typed name that refers to a removed person: a super admin's alone (BR124.2). */
  clearRoleName(session: SessionContext, input: Command<Versioned & { roleId: string }>) {
    return this.pipeline.invoke<EventChangeModel>({
      session,
      matrixRowId: "AUTH-SUPER-ADMIN",
      action: "manage",
      resource: "event_role_clear",
      scope: input.scope,
      idempotencyKey: input.idempotencyKey,
      validate: () => mutationCheck(input),
      invoke: () =>
        this.domain.clearRoleName({
          idempotencyKey: input.idempotencyKey,
          roleId: input.roleId,
          expectedVersion: input.expectedVersion,
        }),
      project: (model) => Object.freeze({ ...model }),
    });
  }

  /** The typed names that may refer to a person being removed, for the removal screen (a super admin only). */
  typedRoles(
    session: SessionContext,
    scope: Scope,
    input: { subjectKind: "parent" | "family"; subjectId: string },
  ): Promise<ApplicationResult<TypedRoleListModel>> {
    return this.pipeline.invoke<TypedRoleListModel>({
      session,
      matrixRowId: "AUTH-SUPER-ADMIN",
      action: "read",
      resource: "event_role_clear",
      scope,
      invoke: () => this.domain.typedRoles(input),
      project: (model) => Object.freeze({ items: Object.freeze([...model.items]) }),
    });
  }

  private read<T>(
    session: SessionContext,
    scope: Scope,
    run: () => DomainOutcome<T> | Promise<DomainOutcome<T>>,
  ): Promise<ApplicationResult<T>> {
    return this.pipeline.invoke<T>({
      session,
      matrixRowId: "AUTH-EVENTS",
      action: "read",
      resource: "event",
      scope,
      invoke: run,
      project: (model) => Object.freeze(model) as Readonly<T>,
    });
  }

  private parentCommand(
    session: SessionContext,
    input: Command<Key & { expectedVersion?: number }>,
    action: "create" | "update" | "delete",
    resource: "event_signup" | "food_offer",
    run: () => Outcome<EventChangeModel>,
  ): Promise<ApplicationResult<EventChangeModel>> {
    return this.pipeline.invoke<EventChangeModel>({
      session,
      matrixRowId: "AUTH-PARENT-EVENT-SIGNUP",
      action,
      resource,
      scope: input.scope,
      idempotencyKey: input.idempotencyKey,
      validate: () => keyCheck(input),
      invoke: run,
      project: (model) => Object.freeze({ ...model }),
    });
  }

  private managerCommand(
    session: SessionContext,
    input: Command<Key & { expectedVersion?: number }>,
    run: () => Outcome<EventChangeModel>,
  ): Promise<ApplicationResult<EventChangeModel>> {
    return this.pipeline.invoke<EventChangeModel>({
      session,
      matrixRowId: matrixRowFor(session, input.scope),
      action: "manage",
      resource: "event_manage",
      scope: input.scope,
      idempotencyKey: input.idempotencyKey,
      validate: () => keyCheck(input),
      invoke: run,
      project: (model) => Object.freeze({ ...model }),
    });
  }
}

function withoutScope<T extends { scope: Scope }>(input: T): Omit<T, "scope"> {
  const rest: Partial<T> = { ...input };
  delete rest.scope;
  return rest as Omit<T, "scope">;
}

/** The key, and the version when the command carries one. */
function keyCheck(input: Key & { expectedVersion?: number }) {
  if (input.expectedVersion === undefined) return validateIdempotencyKey(input.idempotencyKey);
  const checked = validateMutationContext({
    idempotencyKey: input.idempotencyKey,
    expectedVersion: input.expectedVersion,
  });
  return checked.state === "validation" ? checked : undefined;
}

const mutationCheck = keyCheck;
