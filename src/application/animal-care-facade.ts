import type { Scope } from "../access/index.ts";
import type {
  AnimalCalendarModel,
  AnimalChangeModel,
  AnimalFairShareModel,
  AnimalSlotsModel,
  ApplicationResult,
  AuthorizationMatrixRowId,
  SessionContext,
} from "./contracts.ts";
import type { DomainOutcome, FacadePipeline } from "./facade-pipeline.ts";
import { validateIdempotencyKey, validateMutationContext } from "./validation.ts";
import { validation } from "./results.ts";

type Outcome<T> = Promise<DomainOutcome<T>>;
type Key = { idempotencyKey: string };
type Versioning = "none" | "from-one" | "from-zero";

/** The settings a super admin saves. The version is 0 while the school year has no calendar yet. */
export type AnimalCalendarInput = Key & {
  schoolYearId: string;
  morningStart: string;
  afternoonStart: string;
  careGroupId?: string;
  expectedVersion: number;
};

/** One database function per method (U8). Signing up for a slot is the existing parent sign-up. */
export interface AnimalCareApplicationPort {
  slots(input: {
    schoolYearId: string;
    fromDate?: string;
    weeks?: number;
  }): Outcome<AnimalSlotsModel>;
  fairShare(schoolYearId: string): Outcome<AnimalFairShareModel>;
  calendar(schoolYearId: string): Outcome<AnimalCalendarModel>;
  saveCalendar(input: AnimalCalendarInput): Outcome<AnimalChangeModel>;
  createSlots(input: Key & { schoolYearId: string }): Outcome<AnimalChangeModel>;
  giveUp(input: Key & { placeId: string; expectedVersion: number }): Outcome<AnimalChangeModel>;
}

type Command<T> = Readonly<{ scope: Scope }> & T;

/**
 * The daily animal-care slots (BR80 to BR85). Every signed-in role reads the sign-up page and the fair share; a parent
 * gives up their family's own slot; a super admin keeps the settings and creates the year's slots. The caller names the
 * scope of a right it holds and the database repeats every check (the holder, the 24-hour limit, the open swap).
 */
export class AnimalCareApplicationFacade {
  private readonly pipeline: FacadePipeline;
  private readonly domain: AnimalCareApplicationPort;

  constructor(pipeline: FacadePipeline, domain: AnimalCareApplicationPort) {
    this.pipeline = pipeline;
    this.domain = domain;
  }

  /** The slots of the coming weeks. A school year of another community reads as denied. */
  slots(
    session: SessionContext,
    scope: Scope,
    input: { schoolYearId: string; fromDate?: string; weeks?: number },
  ): Promise<ApplicationResult<AnimalSlotsModel>> {
    return this.read(session, scope, "AUTH-ANIMAL", "animal_care", () => this.domain.slots(input));
  }

  /** The fair-share panel: the caller's family first, then every counted family. */
  fairShare(
    session: SessionContext,
    scope: Scope,
    schoolYearId: string,
  ): Promise<ApplicationResult<AnimalFairShareModel>> {
    return this.read(session, scope, "AUTH-ANIMAL", "animal_care", () =>
      this.domain.fairShare(schoolYearId),
    );
  }

  /** The year's times and alert group, for a super admin. */
  calendar(
    session: SessionContext,
    scope: Scope,
    schoolYearId: string,
  ): Promise<ApplicationResult<AnimalCalendarModel>> {
    return this.read(session, scope, "AUTH-ANIMAL-MANAGE", "animal_calendar", () =>
      this.domain.calendar(schoolYearId),
    );
  }

  saveCalendar(session: SessionContext, input: Command<AnimalCalendarInput>) {
    // Version 0 is allowed: it means the school year has no calendar yet.
    return this.command(
      session,
      input,
      "AUTH-ANIMAL-MANAGE",
      "animal_calendar",
      "update",
      "from-zero",
      () => this.domain.saveCalendar(withoutScope(input)),
    );
  }

  createSlots(session: SessionContext, input: Command<Key & { schoolYearId: string }>) {
    return this.command(
      session,
      input,
      "AUTH-ANIMAL-MANAGE",
      "animal_calendar",
      "create",
      "none",
      () => this.domain.createSlots(withoutScope(input)),
    );
  }

  giveUp(
    session: SessionContext,
    input: Command<Key & { placeId: string; expectedVersion: number }>,
  ) {
    return this.command(
      session,
      input,
      "AUTH-ANIMAL-SLOT",
      "animal_slot",
      "update",
      "from-one",
      () => this.domain.giveUp(withoutScope(input)),
    );
  }

  private read<T>(
    session: SessionContext,
    scope: Scope,
    matrixRowId: AuthorizationMatrixRowId,
    resource: string,
    run: () => DomainOutcome<T> | Promise<DomainOutcome<T>>,
  ): Promise<ApplicationResult<T>> {
    return this.pipeline.invoke<T>({
      session,
      matrixRowId,
      action: "read",
      resource,
      scope,
      invoke: run,
      project: (model) => Object.freeze(model) as Readonly<T>,
    });
  }

  private command(
    session: SessionContext,
    input: Command<Key & { expectedVersion?: number }>,
    matrixRowId: AuthorizationMatrixRowId,
    resource: string,
    action: "create" | "update",
    versioned: Versioning,
    run: () => Outcome<AnimalChangeModel>,
  ): Promise<ApplicationResult<AnimalChangeModel>> {
    return this.pipeline.invoke<AnimalChangeModel>({
      session,
      matrixRowId,
      action,
      resource,
      scope: input.scope,
      idempotencyKey: input.idempotencyKey,
      validate: () => keyCheck(input, versioned),
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

function keyCheck(input: Key & { expectedVersion?: number }, versioning: Versioning) {
  if (versioning === "none" || input.expectedVersion === undefined) {
    return validateIdempotencyKey(input.idempotencyKey);
  }
  if (versioning === "from-zero") {
    const key = validateIdempotencyKey(input.idempotencyKey);
    if (key) return key;
    return Number.isInteger(input.expectedVersion) && input.expectedVersion >= 0
      ? undefined
      : validation({ expectedVersion: "VAL-EXPECTED-VERSION" });
  }
  const checked = validateMutationContext({
    idempotencyKey: input.idempotencyKey,
    expectedVersion: input.expectedVersion,
  });
  return checked.state === "validation" ? checked : undefined;
}
