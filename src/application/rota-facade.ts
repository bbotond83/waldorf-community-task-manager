import type { Scope } from "../access/index.ts";
import type {
  ApplicationResult,
  RotaChangeModel,
  RotaDutyCardModel,
  RotaOverviewModel,
  RotaPlanModel,
  SchoolCalendarModel,
  SessionContext,
} from "./contracts.ts";
import type { DomainOutcome, FacadePipeline } from "./facade-pipeline.ts";
import { validateIdempotencyKey, validateMutationContext } from "./validation.ts";

/**
 * The database's answers for the school calendar and the rota (U2). The adapter in `src/data/rota.ts` calls the
 * named functions; an in-memory port can stand in for it in a screen test.
 */
export interface RotaApplicationPort {
  calendar(input: { schoolYearId?: string }): Promise<DomainOutcome<SchoolCalendarModel>>;
  addBreakWeek(input: {
    idempotencyKey: string;
    schoolYearId: string;
    weekStart: string;
    label?: string;
  }): Promise<DomainOutcome<RotaChangeModel>>;
  removeBreakWeek(input: {
    idempotencyKey: string;
    breakWeekId: string;
    expectedVersion: number;
  }): Promise<DomainOutcome<RotaChangeModel>>;
  plan(input: { schoolYearId?: string }): Promise<DomainOutcome<RotaPlanModel>>;
  makeDraft(input: {
    idempotencyKey: string;
    schoolYearId: string;
  }): Promise<DomainOutcome<RotaChangeModel>>;
  setWeek(input: {
    idempotencyKey: string;
    weekId: string;
    familyId: string | null;
    expectedVersion: number;
  }): Promise<DomainOutcome<RotaChangeModel>>;
  discard(input: {
    idempotencyKey: string;
    planId: string;
    expectedVersion: number;
    changedWeeks: number;
  }): Promise<DomainOutcome<RotaChangeModel>>;
  publish(input: {
    idempotencyKey: string;
    planId: string;
    expectedVersion: number;
  }): Promise<DomainOutcome<RotaChangeModel>>;
  overview(): Promise<DomainOutcome<RotaOverviewModel>>;
  dutyCard(input: { dutyId: string }): Promise<DomainOutcome<RotaDutyCardModel>>;
}

const identity = <T>(value: T): Readonly<T> => value;

/**
 * The calendar and the rota for every role (BR20 to BR24). Only a super admin plans, adjusts, discards and
 * publishes; every signed-in role reads the published overview; a parent of the holding family and a super admin
 * open a duty card. Each caller names the scope of a right it holds; the database decides again (NFR3.2).
 */
export class RotaApplicationFacade {
  private readonly pipeline: FacadePipeline;
  private readonly domain: RotaApplicationPort;

  constructor(pipeline: FacadePipeline, domain: RotaApplicationPort) {
    this.pipeline = pipeline;
    this.domain = domain;
  }

  getCalendar(
    session: SessionContext,
    scope: Scope,
    schoolYearId?: string,
  ): Promise<ApplicationResult<SchoolCalendarModel>> {
    return this.pipeline.invoke<SchoolCalendarModel>({
      session,
      matrixRowId: "AUTH-SUPER-ROTA",
      action: "read",
      resource: "school_calendar",
      scope,
      invoke: () => this.domain.calendar({ schoolYearId }),
      project: identity,
    });
  }

  addBreakWeek(
    session: SessionContext,
    scope: Scope,
    input: { idempotencyKey: string; schoolYearId: string; weekStart: string; label?: string },
  ): Promise<ApplicationResult<RotaChangeModel>> {
    return this.pipeline.invoke<RotaChangeModel>({
      session,
      matrixRowId: "AUTH-SUPER-ROTA",
      action: "create",
      resource: "school_calendar",
      scope,
      idempotencyKey: input.idempotencyKey,
      validate: () => validateIdempotencyKey(input.idempotencyKey),
      invoke: () => this.domain.addBreakWeek(input),
      project: identity,
    });
  }

  removeBreakWeek(
    session: SessionContext,
    scope: Scope,
    input: { idempotencyKey: string; breakWeekId: string; expectedVersion: number },
  ): Promise<ApplicationResult<RotaChangeModel>> {
    return this.pipeline.invoke<RotaChangeModel>({
      session,
      matrixRowId: "AUTH-SUPER-ROTA",
      action: "delete",
      resource: "school_calendar",
      scope,
      idempotencyKey: input.idempotencyKey,
      validate: () => mutationCheck(input),
      invoke: () => this.domain.removeBreakWeek(input),
      project: identity,
    });
  }

  getPlan(
    session: SessionContext,
    scope: Scope,
    schoolYearId?: string,
  ): Promise<ApplicationResult<RotaPlanModel>> {
    return this.pipeline.invoke<RotaPlanModel>({
      session,
      matrixRowId: "AUTH-SUPER-ROTA",
      action: "read",
      resource: "rota_plan",
      scope,
      invoke: () => this.domain.plan({ schoolYearId }),
      project: identity,
    });
  }

  makeDraft(
    session: SessionContext,
    scope: Scope,
    input: { idempotencyKey: string; schoolYearId: string },
  ): Promise<ApplicationResult<RotaChangeModel>> {
    return this.pipeline.invoke<RotaChangeModel>({
      session,
      matrixRowId: "AUTH-SUPER-ROTA",
      action: "create",
      resource: "rota_plan",
      scope,
      idempotencyKey: input.idempotencyKey,
      validate: () => validateIdempotencyKey(input.idempotencyKey),
      invoke: () => this.domain.makeDraft(input),
      project: identity,
    });
  }

  /** Puts a family on a week of the draft, or empties the week when `familyId` is null (BR22.1). */
  setWeek(
    session: SessionContext,
    scope: Scope,
    input: {
      idempotencyKey: string;
      weekId: string;
      familyId: string | null;
      expectedVersion: number;
    },
  ): Promise<ApplicationResult<RotaChangeModel>> {
    return this.pipeline.invoke<RotaChangeModel>({
      session,
      matrixRowId: "AUTH-SUPER-ROTA",
      action: "update",
      resource: "rota_plan",
      scope,
      idempotencyKey: input.idempotencyKey,
      validate: () => mutationCheck(input),
      invoke: () => this.domain.setWeek(input),
      project: identity,
    });
  }

  /** Discards a draft; `changedWeeks` is the count of hand-changed weeks the screen showed (BR21.5). */
  discardDraft(
    session: SessionContext,
    scope: Scope,
    input: {
      idempotencyKey: string;
      planId: string;
      expectedVersion: number;
      changedWeeks: number;
    },
  ): Promise<ApplicationResult<RotaChangeModel>> {
    return this.pipeline.invoke<RotaChangeModel>({
      session,
      matrixRowId: "AUTH-SUPER-ROTA",
      action: "delete",
      resource: "rota_plan",
      scope,
      idempotencyKey: input.idempotencyKey,
      validate: () => mutationCheck(input),
      invoke: () => this.domain.discard(input),
      project: identity,
    });
  }

  publish(
    session: SessionContext,
    scope: Scope,
    input: { idempotencyKey: string; planId: string; expectedVersion: number },
  ): Promise<ApplicationResult<RotaChangeModel>> {
    return this.pipeline.invoke<RotaChangeModel>({
      session,
      matrixRowId: "AUTH-SUPER-ROTA",
      action: "manage",
      resource: "rota_plan",
      scope,
      idempotencyKey: input.idempotencyKey,
      validate: () => mutationCheck(input),
      invoke: () => this.domain.publish(input),
      project: identity,
    });
  }

  /** The published rota every signed-in role reads (BR24.1). */
  getOverview(
    session: SessionContext,
    scope: Scope,
  ): Promise<ApplicationResult<RotaOverviewModel>> {
    return this.pipeline.invoke<RotaOverviewModel>({
      session,
      matrixRowId: "AUTH-ROTA-OVERVIEW",
      action: "read",
      resource: "rota",
      scope,
      invoke: () => this.domain.overview(),
      project: identity,
    });
  }

  getDutyCard(
    session: SessionContext,
    scope: Scope,
    dutyId: string,
  ): Promise<ApplicationResult<RotaDutyCardModel>> {
    return this.pipeline.invoke<RotaDutyCardModel>({
      session,
      matrixRowId: "AUTH-ROTA-DUTY",
      action: "read",
      resource: "rota_duty",
      scope,
      invoke: () => this.domain.dutyCard({ dutyId }),
      project: identity,
    });
  }
}

function mutationCheck(input: { idempotencyKey: string; expectedVersion: number }) {
  const checked = validateMutationContext(input);
  return checked.state === "validation" ? checked : undefined;
}
