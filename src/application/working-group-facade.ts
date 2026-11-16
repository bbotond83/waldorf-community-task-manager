import type { Scope } from "../access/index.ts";
import type {
  ApplicationResult,
  SessionContext,
  WorkingGroupChangeModel,
  WorkingGroupDetailModel,
  WorkingGroupItem,
  WorkingGroupListModel,
} from "./contracts.ts";
import type { DomainOutcome, FacadePipeline } from "./facade-pipeline.ts";
import { validateIdempotencyKey, validateMutationContext } from "./validation.ts";

export interface WorkingGroupApplicationPort {
  list(): Promise<DomainOutcome<{ items: readonly WorkingGroupItem[] }>>;
  detail(groupId: string): Promise<DomainOutcome<WorkingGroupDetailModel>>;
  join(input: {
    idempotencyKey: string;
    groupId: string;
  }): Promise<DomainOutcome<WorkingGroupChangeModel>>;
  leave(input: {
    idempotencyKey: string;
    membershipId: string;
    expectedVersion: number;
  }): Promise<DomainOutcome<WorkingGroupChangeModel>>;
  appoint(input: {
    idempotencyKey: string;
    membershipId: string;
    expectedVersion: number;
  }): Promise<DomainOutcome<WorkingGroupChangeModel>>;
  revoke(input: {
    idempotencyKey: string;
    membershipId: string;
    expectedVersion: number;
  }): Promise<DomainOutcome<WorkingGroupChangeModel>>;
}

type MembershipCommand = Readonly<{
  scope: Scope;
  idempotencyKey: string;
  membershipId: string;
  expectedVersion: number;
}>;

/**
 * The working-group list and group page every role reads (BR2.3, BR42), joining and leaving (a parent only,
 * BR40) and appointing or revoking a coordinator (a super admin only, BR41). Each caller names the scope of a
 * right it holds; the database repeats every check.
 */
export class WorkingGroupApplicationFacade {
  private readonly pipeline: FacadePipeline;
  private readonly domain: WorkingGroupApplicationPort;

  constructor(pipeline: FacadePipeline, domain: WorkingGroupApplicationPort) {
    this.pipeline = pipeline;
    this.domain = domain;
  }

  list(session: SessionContext, scope: Scope): Promise<ApplicationResult<WorkingGroupListModel>> {
    return this.pipeline.invoke<WorkingGroupListModel>({
      session,
      matrixRowId: "AUTH-WORKING-GROUPS",
      action: "read",
      resource: "working_group",
      scope,
      invoke: () => this.domain.list(),
      project: (model) => Object.freeze({ items: Object.freeze([...model.items]) }),
    });
  }

  /** The group page. A missing, archived or other-community group reads as denied, like a refused access. */
  detail(
    session: SessionContext,
    scope: Scope,
    groupId: string,
  ): Promise<ApplicationResult<WorkingGroupDetailModel>> {
    return this.pipeline.invoke<WorkingGroupDetailModel>({
      session,
      matrixRowId: "AUTH-WORKING-GROUPS",
      action: "read",
      resource: "working_group",
      scope,
      invoke: () => this.domain.detail(groupId),
      project: (model) =>
        Object.freeze({
          ...model,
          members: Object.freeze(model.members.map((member) => Object.freeze({ ...member }))),
        }),
    });
  }

  join(
    session: SessionContext,
    input: { scope: Scope; idempotencyKey: string; groupId: string },
  ): Promise<ApplicationResult<WorkingGroupChangeModel>> {
    return this.pipeline.invoke<WorkingGroupChangeModel>({
      session,
      matrixRowId: "AUTH-PARENT-GROUP-MEMBERSHIP",
      action: "create",
      resource: "working_group_membership",
      scope: input.scope,
      idempotencyKey: input.idempotencyKey,
      validate: () => validateIdempotencyKey(input.idempotencyKey),
      invoke: () =>
        this.domain.join({ idempotencyKey: input.idempotencyKey, groupId: input.groupId }),
      project: (model) => Object.freeze({ ...model }),
    });
  }

  leave(
    session: SessionContext,
    input: MembershipCommand,
  ): Promise<ApplicationResult<WorkingGroupChangeModel>> {
    return this.pipeline.invoke<WorkingGroupChangeModel>({
      session,
      matrixRowId: "AUTH-PARENT-GROUP-MEMBERSHIP",
      action: "update",
      resource: "working_group_membership",
      scope: input.scope,
      idempotencyKey: input.idempotencyKey,
      validate: () => validateContext(input),
      invoke: () => this.domain.leave(commandOf(input)),
      project: (model) => Object.freeze({ ...model }),
    });
  }

  appoint(
    session: SessionContext,
    input: MembershipCommand,
  ): Promise<ApplicationResult<WorkingGroupChangeModel>> {
    return this.coordinatorCommand(session, input, () => this.domain.appoint(commandOf(input)));
  }

  revoke(
    session: SessionContext,
    input: MembershipCommand,
  ): Promise<ApplicationResult<WorkingGroupChangeModel>> {
    return this.coordinatorCommand(session, input, () => this.domain.revoke(commandOf(input)));
  }

  private coordinatorCommand(
    session: SessionContext,
    input: MembershipCommand,
    run: () => Promise<DomainOutcome<WorkingGroupChangeModel>>,
  ): Promise<ApplicationResult<WorkingGroupChangeModel>> {
    return this.pipeline.invoke<WorkingGroupChangeModel>({
      session,
      matrixRowId: "AUTH-SUPER-ADMIN",
      action: "manage",
      resource: "working_group_coordinator",
      scope: input.scope,
      idempotencyKey: input.idempotencyKey,
      validate: () => validateContext(input),
      invoke: run,
      project: (model) => Object.freeze({ ...model }),
    });
  }
}

const commandOf = (input: MembershipCommand) => ({
  idempotencyKey: input.idempotencyKey,
  membershipId: input.membershipId,
  expectedVersion: input.expectedVersion,
});

function validateContext(input: MembershipCommand) {
  const checked = validateMutationContext(input);
  return checked.state === "validation" ? checked : undefined;
}
