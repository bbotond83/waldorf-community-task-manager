import type { Scope } from "../access/index.ts";
import type {
  ApplicationResult,
  ChecklistChangeModel,
  ChecklistModel,
  SessionContext,
  TemplateListModel,
  TemplateModel,
  TemplateOptionsModel,
} from "./contracts.ts";
import { matrixRowFor } from "./admin-facade.ts";
import type { DomainOutcome, FacadePipeline } from "./facade-pipeline.ts";
import { validateIdempotencyKey, validateMutationContext } from "./validation.ts";

type Outcome<T> = Promise<DomainOutcome<T>>;
type Key = { idempotencyKey: string };
/** Section, task, template and order payloads are plain records the database validates field by field. */
export type ChecklistPayload = Readonly<Record<string, unknown>>;

/** One database function per method, with the idempotency key and, where a row changes, the version the screen saw. */
export interface ChecklistApplicationPort {
  checklist(eventId: string): Outcome<ChecklistModel>;
  templates(): Outcome<TemplateListModel>;
  templatesForGroup(groupId: string): Outcome<TemplateListModel>;
  template(templateId: string): Outcome<TemplateModel>;
  templateOptions(groupId?: string): Outcome<TemplateOptionsModel>;
  saveTemplate(input: Key & { template: ChecklistPayload }): Outcome<ChecklistChangeModel>;
  setTemplateRemoved(
    input: Key & { templateId: string; removed: boolean; expectedVersion: number },
  ): Outcome<ChecklistChangeModel>;
  copyTemplate(input: Key & { eventId: string; templateId: string }): Outcome<ChecklistChangeModel>;
  saveSection(
    input: Key & { eventId: string; expectedChecklistVersion: number; section: ChecklistPayload },
  ): Outcome<ChecklistChangeModel>;
  removeSection(
    input: Key & { sectionId: string; expectedChecklistVersion: number },
  ): Outcome<ChecklistChangeModel>;
  saveTask(
    input: Key & { eventId: string; expectedChecklistVersion: number; task: ChecklistPayload },
  ): Outcome<ChecklistChangeModel>;
  removeTask(
    input: Key & { taskId: string; expectedChecklistVersion: number },
  ): Outcome<ChecklistChangeModel>;
  reorder(
    input: Key & { eventId: string; expectedChecklistVersion: number; order: ChecklistPayload },
  ): Outcome<ChecklistChangeModel>;
  claim(
    input: Key & { taskId: string; note?: string; chosenAt?: string },
  ): Outcome<ChecklistChangeModel>;
  claimTyped(
    input: Key & { taskId: string; name: string; note?: string; chosenAt?: string },
  ): Outcome<ChecklistChangeModel>;
  changeClaim(
    input: Key & { claimId: string; expectedVersion: number; note?: string; chosenAt?: string },
  ): Outcome<ChecklistChangeModel>;
  withdrawClaim(
    input: Key & { claimId: string; expectedVersion: number },
  ): Outcome<ChecklistChangeModel>;
  markDone(input: Key & { taskId: string; expectedVersion: number }): Outcome<ChecklistChangeModel>;
  undoDone(input: Key & { taskId: string; expectedVersion: number }): Outcome<ChecklistChangeModel>;
}

type Command<T> = Readonly<{ scope: Scope }> & T;
type Versioned = Key & { expectedVersion: number };
type ChecklistVersioned = Key & { expectedChecklistVersion: number };

/**
 * Event checklists and their templates (U11; BR160 to BR170). Every signed-in role reads a checklist (the database
 * decides which parts); a parent claims tasks and marks them done as their own act; the manager of the event and of a
 * template edits. Each caller names the scope of a right it holds, and the database repeats every check.
 */
export class ChecklistApplicationFacade {
  private readonly pipeline: FacadePipeline;
  private readonly domain: ChecklistApplicationPort;

  constructor(pipeline: FacadePipeline, domain: ChecklistApplicationPort) {
    this.pipeline = pipeline;
    this.domain = domain;
  }

  checklist(
    session: SessionContext,
    scope: Scope,
    eventId: string,
  ): Promise<ApplicationResult<ChecklistModel>> {
    return this.read(session, scope, () => this.domain.checklist(eventId));
  }

  templates(session: SessionContext, scope: Scope): Promise<ApplicationResult<TemplateListModel>> {
    return this.read(session, scope, () => this.domain.templates());
  }

  templatesForGroup(
    session: SessionContext,
    scope: Scope,
    groupId: string,
  ): Promise<ApplicationResult<TemplateListModel>> {
    return this.read(session, scope, () => this.domain.templatesForGroup(groupId));
  }

  template(
    session: SessionContext,
    scope: Scope,
    templateId: string,
  ): Promise<ApplicationResult<TemplateModel>> {
    return this.read(session, scope, () => this.domain.template(templateId));
  }

  templateOptions(
    session: SessionContext,
    scope: Scope,
    groupId?: string,
  ): Promise<ApplicationResult<TemplateOptionsModel>> {
    return this.read(session, scope, () => this.domain.templateOptions(groupId));
  }

  saveTemplate(session: SessionContext, input: Command<Key & { template: ChecklistPayload }>) {
    return this.manager(session, input, () =>
      this.domain.saveTemplate({ idempotencyKey: input.idempotencyKey, template: input.template }),
    );
  }

  setTemplateRemoved(
    session: SessionContext,
    input: Command<Versioned & { templateId: string; removed: boolean }>,
  ) {
    return this.manager(session, input, () =>
      this.domain.setTemplateRemoved({
        idempotencyKey: input.idempotencyKey,
        templateId: input.templateId,
        removed: input.removed,
        expectedVersion: input.expectedVersion,
      }),
    );
  }

  copyTemplate(
    session: SessionContext,
    input: Command<Key & { eventId: string; templateId: string }>,
  ) {
    return this.manager(session, input, () =>
      this.domain.copyTemplate({
        idempotencyKey: input.idempotencyKey,
        eventId: input.eventId,
        templateId: input.templateId,
      }),
    );
  }

  saveSection(
    session: SessionContext,
    input: Command<ChecklistVersioned & { eventId: string; section: ChecklistPayload }>,
  ) {
    return this.manager(session, input, () =>
      this.domain.saveSection({
        idempotencyKey: input.idempotencyKey,
        eventId: input.eventId,
        expectedChecklistVersion: input.expectedChecklistVersion,
        section: input.section,
      }),
    );
  }

  removeSection(
    session: SessionContext,
    input: Command<ChecklistVersioned & { sectionId: string }>,
  ) {
    return this.manager(session, input, () =>
      this.domain.removeSection({
        idempotencyKey: input.idempotencyKey,
        sectionId: input.sectionId,
        expectedChecklistVersion: input.expectedChecklistVersion,
      }),
    );
  }

  saveTask(
    session: SessionContext,
    input: Command<ChecklistVersioned & { eventId: string; task: ChecklistPayload }>,
  ) {
    return this.manager(session, input, () =>
      this.domain.saveTask({
        idempotencyKey: input.idempotencyKey,
        eventId: input.eventId,
        expectedChecklistVersion: input.expectedChecklistVersion,
        task: input.task,
      }),
    );
  }

  removeTask(session: SessionContext, input: Command<ChecklistVersioned & { taskId: string }>) {
    return this.manager(session, input, () =>
      this.domain.removeTask({
        idempotencyKey: input.idempotencyKey,
        taskId: input.taskId,
        expectedChecklistVersion: input.expectedChecklistVersion,
      }),
    );
  }

  reorder(
    session: SessionContext,
    input: Command<ChecklistVersioned & { eventId: string; order: ChecklistPayload }>,
  ) {
    return this.manager(session, input, () =>
      this.domain.reorder({
        idempotencyKey: input.idempotencyKey,
        eventId: input.eventId,
        expectedChecklistVersion: input.expectedChecklistVersion,
        order: input.order,
      }),
    );
  }

  claim(
    session: SessionContext,
    input: Command<Key & { taskId: string; note?: string; chosenAt?: string }>,
  ) {
    return this.parent(session, input, "create", () =>
      this.domain.claim({
        idempotencyKey: input.idempotencyKey,
        taskId: input.taskId,
        ...(input.note !== undefined ? { note: input.note } : {}),
        ...(input.chosenAt !== undefined ? { chosenAt: input.chosenAt } : {}),
      }),
    );
  }

  /** The organising team enters a helper without an account by name. */
  claimTyped(
    session: SessionContext,
    input: Command<Key & { taskId: string; name: string; note?: string; chosenAt?: string }>,
  ) {
    return this.parent(session, input, "create", () =>
      this.domain.claimTyped({
        idempotencyKey: input.idempotencyKey,
        taskId: input.taskId,
        name: input.name,
        ...(input.note !== undefined ? { note: input.note } : {}),
        ...(input.chosenAt !== undefined ? { chosenAt: input.chosenAt } : {}),
      }),
    );
  }

  changeClaim(
    session: SessionContext,
    input: Command<Versioned & { claimId: string; note?: string; chosenAt?: string }>,
  ) {
    return this.parent(session, input, "update", () =>
      this.domain.changeClaim({
        idempotencyKey: input.idempotencyKey,
        claimId: input.claimId,
        expectedVersion: input.expectedVersion,
        ...(input.note !== undefined ? { note: input.note } : {}),
        ...(input.chosenAt !== undefined ? { chosenAt: input.chosenAt } : {}),
      }),
    );
  }

  /** The owner gives their own claim up; `asManager` is for the organising team removing another's. */
  withdrawClaim(
    session: SessionContext,
    input: Command<Versioned & { claimId: string; asManager?: boolean }>,
  ) {
    const run = () =>
      this.domain.withdrawClaim({
        idempotencyKey: input.idempotencyKey,
        claimId: input.claimId,
        expectedVersion: input.expectedVersion,
      });
    return input.asManager
      ? this.manager(session, input, run)
      : this.parent(session, input, "delete", run);
  }

  markDone(session: SessionContext, input: Command<Versioned & { taskId: string }>) {
    return this.parent(session, input, "update", () =>
      this.domain.markDone({
        idempotencyKey: input.idempotencyKey,
        taskId: input.taskId,
        expectedVersion: input.expectedVersion,
      }),
    );
  }

  undoDone(session: SessionContext, input: Command<Versioned & { taskId: string }>) {
    return this.parent(session, input, "update", () =>
      this.domain.undoDone({
        idempotencyKey: input.idempotencyKey,
        taskId: input.taskId,
        expectedVersion: input.expectedVersion,
      }),
    );
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

  private parent(
    session: SessionContext,
    input: Command<Key & { expectedVersion?: number }>,
    action: "create" | "update" | "delete",
    run: () => Outcome<ChecklistChangeModel>,
  ): Promise<ApplicationResult<ChecklistChangeModel>> {
    return this.pipeline.invoke<ChecklistChangeModel>({
      session,
      matrixRowId: "AUTH-PARENT-EVENT-SIGNUP",
      action,
      resource: "checklist_claim",
      scope: input.scope,
      idempotencyKey: input.idempotencyKey,
      validate: () => keyCheck(input),
      invoke: run,
      project: (model) => Object.freeze({ ...model }),
    });
  }

  private manager(
    session: SessionContext,
    input: Command<Key & { expectedVersion?: number; expectedChecklistVersion?: number }>,
    run: () => Outcome<ChecklistChangeModel>,
  ): Promise<ApplicationResult<ChecklistChangeModel>> {
    return this.pipeline.invoke<ChecklistChangeModel>({
      session,
      matrixRowId: matrixRowFor(session, input.scope),
      action: "manage",
      resource: "event_manage",
      scope: input.scope,
      idempotencyKey: input.idempotencyKey,
      validate: () =>
        keyCheck({
          ...input,
          expectedVersion: input.expectedVersion ?? input.expectedChecklistVersion,
        }),
      invoke: run,
      project: (model) => Object.freeze({ ...model }),
    });
  }
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
