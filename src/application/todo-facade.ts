import type { Scope } from "../access/index.ts";
import type {
  ApplicationResult,
  AuthorizationMatrixRowId,
  MyTasksModel,
  SessionContext,
  TodoChangeModel,
  TodoDetailModel,
  TodoGroupListModel,
  TodoListFilters,
  TodoListModel,
  TodoPullModel,
  TodoStatus,
} from "./contracts.ts";
import type { DomainOutcome, FacadePipeline } from "./facade-pipeline.ts";
import { validation } from "./results.ts";
import { validateIdempotencyKey, validateMutationContext } from "./validation.ts";

type Outcome<T> = Promise<DomainOutcome<T>>;
type Key = { idempotencyKey: string };
type Versioned = Key & { expectedVersion: number };
type Command<T> = Readonly<{ scope: Scope }> & T;

/** Most tasks one pull may carry (BR185.1). */
export const TODO_PULL_LIMIT = 50;

/**
 * The fields of a task a form sends. A new task carries no id and no version; the owner is exactly one of a working
 * group and a family (a family is a super admin's). Saving never sets done: that has its own command.
 */
export type TodoSaveInput = Key & {
  taskId?: string;
  expectedVersion?: number;
  ownerGroupId?: string;
  ownerFamilyId?: string;
  topic: string;
  priority?: number;
  description?: string;
  materials?: string;
  status?: TodoStatus;
  note?: string;
  notBefore?: string;
  deadline?: string;
};

/** One database function per method, with the idempotency key and, where a row changes, the version the screen saw. */
export interface TodoApplicationPort {
  list(filters: TodoListFilters): Outcome<TodoListModel>;
  get(taskId: string): Outcome<TodoDetailModel>;
  groupList(groupId: string): Outcome<TodoGroupListModel>;
  myTasks(): Outcome<MyTasksModel>;
  save(input: TodoSaveInput): Outcome<TodoChangeModel>;
  claim(input: Versioned & { taskId: string }): Outcome<TodoChangeModel>;
  giveBack(input: Versioned & { taskId: string }): Outcome<TodoChangeModel>;
  freeClaim(input: Versioned & { taskId: string }): Outcome<TodoChangeModel>;
  update(
    input: Versioned & { taskId: string; status?: TodoStatus; note?: string },
  ): Outcome<TodoChangeModel>;
  markDone(input: Versioned & { taskId: string }): Outcome<TodoChangeModel>;
  undoDone(input: Versioned & { taskId: string }): Outcome<TodoChangeModel>;
  pullToEvent(input: {
    idempotencyKey: string;
    eventId: string;
    tasks: readonly { taskId: string; expectedVersion: number }[];
  }): Outcome<TodoPullModel>;
}

/**
 * The to-do list and My tasks of U12 (BR180 to BR190). Every signed-in role reads the list and a task's page (a teacher
 * reads only); a parent with a family takes, finishes and gives back tasks; a coordinator and a super admin keep a
 * group's tasks, free claims and pull tasks into an event. The caller names the scope of a right it holds and the
 * database repeats every check, including who may claim (a family-owned task belongs to that family alone).
 */
export class TodoApplicationFacade {
  private readonly pipeline: FacadePipeline;
  private readonly domain: TodoApplicationPort;

  constructor(pipeline: FacadePipeline, domain: TodoApplicationPort) {
    this.pipeline = pipeline;
    this.domain = domain;
  }

  /** The community's list. A caller who may not read it gets the denied result, never an empty list. */
  list(
    session: SessionContext,
    scope: Scope,
    filters: TodoListFilters = {},
  ): Promise<ApplicationResult<TodoListModel>> {
    return this.read(session, scope, "AUTH-TODO", "todo", () => this.domain.list(filters));
  }

  /** One task page. A task of another community reads as denied, like an unknown one. */
  get(
    session: SessionContext,
    scope: Scope,
    taskId: string,
  ): Promise<ApplicationResult<TodoDetailModel>> {
    return this.read(session, scope, "AUTH-TODO", "todo", () => this.domain.get(taskId));
  }

  /** A group's tasks for its coordinator (the management page). */
  groupList(
    session: SessionContext,
    scope: Scope,
    groupId: string,
  ): Promise<ApplicationResult<TodoGroupListModel>> {
    return this.read(session, scope, "AUTH-TODO-MANAGE", "todo_manage", () =>
      this.domain.groupList(groupId),
    );
  }

  /** The caller's own duties, recurring duties and claimed tasks. */
  myTasks(session: SessionContext, scope: Scope): Promise<ApplicationResult<MyTasksModel>> {
    return this.read(session, scope, "AUTH-MY-TASKS", "my_tasks", () => this.domain.myTasks());
  }

  /** Adds a task, or changes one when the input carries its id and the version the screen saw. */
  save(session: SessionContext, input: Command<TodoSaveInput>) {
    return this.command(
      session,
      input,
      "AUTH-TODO-MANAGE",
      "todo_manage",
      input.taskId === undefined ? "create" : "update",
      () => this.domain.save(withoutScope(input)),
    );
  }

  claim(session: SessionContext, input: Command<Versioned & { taskId: string }>) {
    return this.taskCommand(session, input, () => this.domain.claim(withoutScope(input)));
  }

  giveBack(session: SessionContext, input: Command<Versioned & { taskId: string }>) {
    return this.taskCommand(session, input, () => this.domain.giveBack(withoutScope(input)));
  }

  /** An administrator frees another person's claim. */
  freeClaim(session: SessionContext, input: Command<Versioned & { taskId: string }>) {
    return this.command(session, input, "AUTH-TODO-MANAGE", "todo_manage", "update", () =>
      this.domain.freeClaim(withoutScope(input)),
    );
  }

  update(
    session: SessionContext,
    input: Command<Versioned & { taskId: string; status?: TodoStatus; note?: string }>,
  ) {
    return this.taskCommand(session, input, () => this.domain.update(withoutScope(input)));
  }

  markDone(session: SessionContext, input: Command<Versioned & { taskId: string }>) {
    return this.taskCommand(session, input, () => this.domain.markDone(withoutScope(input)));
  }

  undoDone(session: SessionContext, input: Command<Versioned & { taskId: string }>) {
    return this.taskCommand(session, input, () => this.domain.undoDone(withoutScope(input)));
  }

  /** Pulls open tasks into an event's checklist: one to fifty tasks, each with the version the screen saw. */
  pullToEvent(
    session: SessionContext,
    input: Command<{
      idempotencyKey: string;
      eventId: string;
      tasks: readonly { taskId: string; expectedVersion: number }[];
    }>,
  ): Promise<ApplicationResult<TodoPullModel>> {
    return this.pipeline.invoke<TodoPullModel>({
      session,
      matrixRowId: "AUTH-TODO-MANAGE",
      action: "update",
      resource: "todo_manage",
      scope: input.scope,
      idempotencyKey: input.idempotencyKey,
      validate: () => pullCheck(input),
      invoke: () => this.domain.pullToEvent(withoutScope(input)),
      project: (model) => Object.freeze({ ...model }),
    });
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

  private taskCommand(
    session: SessionContext,
    input: Command<Key & { expectedVersion?: number }>,
    run: () => Outcome<TodoChangeModel>,
  ) {
    return this.command(session, input, "AUTH-TODO-TASK", "todo_task", "update", run);
  }

  private command(
    session: SessionContext,
    input: Command<Key & { expectedVersion?: number }>,
    matrixRowId: AuthorizationMatrixRowId,
    resource: string,
    action: "create" | "update",
    run: () => Outcome<TodoChangeModel>,
  ): Promise<ApplicationResult<TodoChangeModel>> {
    return this.pipeline.invoke<TodoChangeModel>({
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

/** A pull carries a key and one to fifty distinct tasks, each with a version. */
function pullCheck(input: {
  idempotencyKey: string;
  tasks: readonly { taskId: string; expectedVersion: number }[];
}) {
  const keyProblem = validateIdempotencyKey(input.idempotencyKey);
  if (keyProblem) return keyProblem;
  const tasks = input.tasks;
  if (!Array.isArray(tasks) || tasks.length === 0) return validation({ tasks: "VAL-REQUIRED" });
  if (tasks.length > TODO_PULL_LIMIT) return validation({ tasks: "VAL-TOO-MANY" });
  if (new Set(tasks.map((task) => task.taskId)).size !== tasks.length) {
    return validation({ tasks: "VAL-INVALID" });
  }
  if (
    tasks.some(
      (task) =>
        typeof task.expectedVersion !== "number" ||
        !Number.isInteger(task.expectedVersion) ||
        task.expectedVersion < 1,
    )
  ) {
    return validation({ expectedVersion: "VAL-EXPECTED-VERSION" });
  }
  return undefined;
}
