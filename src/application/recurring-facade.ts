import type { Scope } from "../access/index.ts";
import type {
  ApplicationResult,
  AuthorizationMatrixRowId,
  RecurringCardModel,
  RecurringChangeModel,
  RecurringGroupListModel,
  RecurringItemsModel,
  RecurringOwnerKind,
  RecurringScheduleListModel,
  RecurringScheduleModel,
  SessionContext,
} from "./contracts.ts";
import type { DomainOutcome, FacadePipeline } from "./facade-pipeline.ts";
import { validateIdempotencyKey, validateMutationContext } from "./validation.ts";

type Outcome<T> = Promise<DomainOutcome<T>>;
type Key = { idempotencyKey: string };
type Versioned = Key & { expectedVersion: number };

/** The fields of a schedule that a form sends. A new schedule carries no id and no version. */
export type RecurringScheduleInput = Key & {
  scheduleId?: string;
  expectedVersion?: number;
  title: string;
  category: string;
  ownerKind: RecurringOwnerKind;
  workingGroupId?: string;
  familyId?: string;
  rotaJob?: string;
  intervalCount: number;
  startDate: string;
  seasonFromMonth?: number;
  seasonToMonth?: number;
};

/** One database function per method, with the idempotency key and, where a row changes, the version the screen saw. */
export interface RecurringApplicationPort {
  groupList(groupId: string): Outcome<RecurringGroupListModel>;
  card(occurrenceId: string): Outcome<RecurringCardModel>;
  mine(): Outcome<RecurringItemsModel>;
  bottle(dutyId: string): Outcome<RecurringItemsModel>;
  adminList(): Outcome<RecurringScheduleListModel>;
  scheduleGet(scheduleId: string): Outcome<RecurringScheduleModel>;
  saveSchedule(input: RecurringScheduleInput): Outcome<RecurringChangeModel>;
  setActive(
    input: Versioned & { scheduleId: string; active: boolean },
  ): Outcome<RecurringChangeModel>;
  markDone(input: Versioned & { occurrenceId: string }): Outcome<RecurringChangeModel>;
  undoDone(input: Versioned & { occurrenceId: string }): Outcome<RecurringChangeModel>;
  skip(input: Versioned & { occurrenceId: string; reason: string }): Outcome<RecurringChangeModel>;
}

type Command<T> = Readonly<{ scope: Scope }> & T;

/**
 * The recurring duties of U9 (BR141 to BR150). Every signed-in role reads the pages (a teacher reads only); a parent
 * marks the duties of the family or group they belong to; a coordinator and a super admin keep the schedules. The
 * caller names the scope of a right it holds and the database repeats every check, including who may mark done (a
 * super admin may not, D-SEC-1).
 */
export class RecurringApplicationFacade {
  private readonly pipeline: FacadePipeline;
  private readonly domain: RecurringApplicationPort;

  constructor(pipeline: FacadePipeline, domain: RecurringApplicationPort) {
    this.pipeline = pipeline;
    this.domain = domain;
  }

  /** A working group's recurring page, in one call. A missing or other-community group reads as denied. */
  groupList(
    session: SessionContext,
    scope: Scope,
    groupId: string,
  ): Promise<ApplicationResult<RecurringGroupListModel>> {
    return this.read(session, scope, () => this.domain.groupList(groupId));
  }

  /** One duty card. A family's or rota duty of someone else reads as denied. */
  card(
    session: SessionContext,
    scope: Scope,
    occurrenceId: string,
  ): Promise<ApplicationResult<RecurringCardModel>> {
    return this.read(session, scope, () => this.domain.card(occurrenceId));
  }

  /** The caller's own recurring duties: the family's, its rota weeks and its groups'. */
  mine(session: SessionContext, scope: Scope): Promise<ApplicationResult<RecurringItemsModel>> {
    return this.read(session, scope, () => this.domain.mine());
  }

  /** The recurring line of a rota duty card, for the holding family and a super admin. */
  bottle(
    session: SessionContext,
    scope: Scope,
    dutyId: string,
  ): Promise<ApplicationResult<RecurringItemsModel>> {
    return this.read(session, scope, () => this.domain.bottle(dutyId));
  }

  /** The schedules of families and rota jobs: a super admin's list. */
  adminList(
    session: SessionContext,
    scope: Scope,
  ): Promise<ApplicationResult<RecurringScheduleListModel>> {
    return this.pipeline.invoke<RecurringScheduleListModel>({
      session,
      matrixRowId: "AUTH-RECURRING-MANAGE",
      action: "read",
      resource: "recurring_schedule",
      scope,
      invoke: () => this.domain.adminList(),
      project: (model) => Object.freeze(model) as Readonly<RecurringScheduleListModel>,
    });
  }

  /** One schedule for the form. */
  scheduleGet(
    session: SessionContext,
    scope: Scope,
    scheduleId: string,
  ): Promise<ApplicationResult<RecurringScheduleModel>> {
    return this.read(session, scope, () => this.domain.scheduleGet(scheduleId));
  }

  /** Adds a schedule, or changes one when the input carries its id and the version the screen saw. */
  saveSchedule(session: SessionContext, input: Command<RecurringScheduleInput>) {
    return this.command(
      session,
      input,
      "AUTH-RECURRING-MANAGE",
      "recurring_schedule",
      input.scheduleId === undefined ? "create" : "update",
      () => this.domain.saveSchedule(withoutScope(input)),
    );
  }

  /** Switches a schedule on or off. */
  setActive(
    session: SessionContext,
    input: Command<Versioned & { scheduleId: string; active: boolean }>,
  ) {
    return this.command(
      session,
      input,
      "AUTH-RECURRING-MANAGE",
      "recurring_schedule",
      "manage",
      () => this.domain.setActive(withoutScope(input)),
    );
  }

  markDone(session: SessionContext, input: Command<Versioned & { occurrenceId: string }>) {
    return this.dutyCommand(session, input, () => this.domain.markDone(withoutScope(input)));
  }

  undoDone(session: SessionContext, input: Command<Versioned & { occurrenceId: string }>) {
    return this.dutyCommand(session, input, () => this.domain.undoDone(withoutScope(input)));
  }

  skip(
    session: SessionContext,
    input: Command<Versioned & { occurrenceId: string; reason: string }>,
  ) {
    return this.dutyCommand(session, input, () => this.domain.skip(withoutScope(input)));
  }

  private read<T>(
    session: SessionContext,
    scope: Scope,
    run: () => DomainOutcome<T> | Promise<DomainOutcome<T>>,
  ): Promise<ApplicationResult<T>> {
    return this.pipeline.invoke<T>({
      session,
      matrixRowId: "AUTH-RECURRING",
      action: "read",
      resource: "recurring",
      scope,
      invoke: run,
      project: (model) => Object.freeze(model) as Readonly<T>,
    });
  }

  private dutyCommand(
    session: SessionContext,
    input: Command<Key & { expectedVersion?: number }>,
    run: () => Outcome<RecurringChangeModel>,
  ) {
    return this.command(session, input, "AUTH-RECURRING-DUTY", "recurring_duty", "update", run);
  }

  private command(
    session: SessionContext,
    input: Command<Key & { expectedVersion?: number }>,
    matrixRowId: AuthorizationMatrixRowId,
    resource: string,
    action: "create" | "update" | "manage",
    run: () => Outcome<RecurringChangeModel>,
  ): Promise<ApplicationResult<RecurringChangeModel>> {
    return this.pipeline.invoke<RecurringChangeModel>({
      session,
      matrixRowId,
      action,
      resource,
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
