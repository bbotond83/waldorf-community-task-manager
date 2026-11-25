"use client";

import { useContext, useMemo, useState, type ReactNode } from "react";
import type { TodoDetailModel, TodoStatus } from "../../src/application/index.ts";
import { TODO_FORM_STATUSES, TODO_STATUS_LABELS } from "../../src/application/todo-format.ts";
import { StatusBadge } from "../../src/runtime/StatusBadge.tsx";
import {
  ParentFieldErrorsContext,
  ParentMutationForm,
} from "../szulo/_components/ParentMutationForm.tsx";
import { markDoneAction as markRecurringDoneAction } from "../_recurring/actions.ts";
import {
  claimTodoAction,
  freeTodoClaimAction,
  giveBackTodoAction,
  markTodoDoneAction,
  pullTodosAction,
  saveTodoAction,
  undoTodoDoneAction,
  updateTodoAction,
} from "./actions.ts";
import { announcing } from "./TodoAnnouncer.tsx";

/** The hidden fields every to-do button form sends: a first key, the task and the version the screen saw. */
function TaskFields({
  keyName,
  taskId,
  version,
  groupId,
}: Readonly<{ keyName: string; taskId: string; version: number; groupId?: string | undefined }>) {
  return (
    <>
      <input type="hidden" name="idempotencyKey" value={`${keyName}:${taskId}:v${version}`} />
      <input type="hidden" name="taskId" value={taskId} />
      <input type="hidden" name="expectedVersion" value={version} />
      {groupId && <input type="hidden" name="groupId" value={groupId} />}
    </>
  );
}

type ButtonProps = Readonly<{
  taskId: string;
  topic: string;
  version: number;
  groupId?: string | undefined;
  /** The to-do list shows the buttons small, inside a row; the task page shows them in the action bar. */
  className?: string;
}>;

function TaskButton({
  action,
  label,
  keyName,
  testName,
  task,
}: Readonly<{
  action: Parameters<typeof ParentMutationForm>[0]["action"];
  label: string;
  keyName: string;
  testName: string;
  task: ButtonProps;
}>) {
  const announced = useMemo(() => announcing(action), [action]);
  return (
    <ParentMutationForm
      action={announced}
      submitLabel={label}
      submitAriaLabel={`${label}: ${task.topic}`}
      testId={`todo-${testName}-form-${task.taskId}`}
      freshIdempotencyKey
    >
      <TaskFields
        keyName={keyName}
        taskId={task.taskId}
        version={task.version}
        groupId={task.groupId}
      />
    </ParentMutationForm>
  );
}

/** "Vállalom": a parent with a family takes a free task. */
export const ClaimButton = (task: ButtonProps) => (
  <TaskButton
    action={claimTodoAction}
    label="Vállalom"
    keyName="todo-claim"
    testName="claim"
    task={task}
  />
);

/** "Visszaadom": the claimant gives the task back. */
export const GiveBackButton = (task: ButtonProps) => (
  <TaskButton
    action={giveBackTodoAction}
    label="Visszaadom"
    keyName="todo-giveback"
    testName="giveback"
    task={task}
  />
);

/** "Kész": the claimant marks the task done. */
export const DoneButton = (task: ButtonProps) => (
  <TaskButton
    action={markTodoDoneAction}
    label="Kész"
    keyName="todo-done"
    testName="done"
    task={task}
  />
);

/** "Kész" on a recurring duty of My tasks: it uses the command of the recurring-duty screen. */
export function MyRecurringDoneButton({
  occurrenceId,
  title,
  version,
}: Readonly<{ occurrenceId: string; title: string; version: number }>) {
  const announced = useMemo(() => announcing(markRecurringDoneAction), []);
  return (
    <ParentMutationForm
      action={announced}
      submitLabel="Kész"
      submitAriaLabel={`Kész: ${title}`}
      testId={`todo-recurring-done-form-${occurrenceId}`}
      freshIdempotencyKey
    >
      <input
        type="hidden"
        name="idempotencyKey"
        value={`recurring-done:${occurrenceId}:v${version}`}
      />
      <input type="hidden" name="occurrenceId" value={occurrenceId} />
      <input type="hidden" name="expectedVersion" value={version} />
    </ParentMutationForm>
  );
}

/** "Mégsem kész": takes the done mark back. */
export const UndoDoneButton = (task: ButtonProps) => (
  <TaskButton
    action={undoTodoDoneAction}
    label="Mégsem kész"
    keyName="todo-undo"
    testName="undo"
    task={task}
  />
);

/** "Felszabadítás": an administrator frees someone else's claim. */
export const FreeClaimButton = (task: ButtonProps) => (
  <TaskButton
    action={freeTodoClaimAction}
    label="Felszabadítás"
    keyName="todo-free"
    testName="free"
    task={task}
  />
);

/** The claimant's status and note (done has its own button). */
export function UpdateForm({ detail }: Readonly<{ detail: TodoDetailModel }>) {
  const { item } = detail;
  const statuses: readonly TodoStatus[] = TODO_FORM_STATUSES;
  return (
    <ParentMutationForm
      action={updateTodoAction}
      submitLabel="Mentés"
      submitAriaLabel={`Mentés: ${item.topic}`}
      testId="todo-update-form"
      freshIdempotencyKey
    >
      <TaskFields keyName="todo-update" taskId={item.id} version={item.version} />
      <div className="parent-field">
        <label htmlFor="todo-update-status">Állapot</label>
        <select
          id="todo-update-status"
          name="status"
          defaultValue={item.status === "done" ? "open" : item.status}
          data-testid="todo-update-status"
        >
          {statuses.map((status) => (
            <option key={status} value={status}>
              {TODO_STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </div>
      <div className="parent-field">
        <label htmlFor="todo-update-note">Megjegyzés</label>
        <textarea
          id="todo-update-note"
          name="note"
          rows={3}
          maxLength={1000}
          defaultValue={detail.note}
          data-testid="todo-update-note"
        />
      </div>
    </ParentMutationForm>
  );
}

/* ---------- The task form ---------- */

function FieldError({ name }: Readonly<{ name: string }>) {
  const message = useContext(ParentFieldErrorsContext)[name];
  return message ? (
    <p
      id={`${name}-error`}
      className="parent-field-error"
      role="alert"
      data-testid={`todo-${name}-error`}
    >
      {message}
    </p>
  ) : null;
}

function Field({
  id,
  name,
  label,
  hint,
  children,
}: Readonly<{ id: string; name: string; label: string; hint?: string; children: ReactNode }>) {
  const invalid = Boolean(useContext(ParentFieldErrorsContext)[name]);
  return (
    <div className={`parent-field${invalid ? " todo-field-invalid" : ""}`}>
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && (
        <p id={`${id}-hint`} className="form-hint">
          {hint}
        </p>
      )}
      <FieldError name={name} />
    </div>
  );
}

export type TodoFormTask = Readonly<{
  id: string;
  version: number;
  topic: string;
  status: TodoStatus;
  priority?: number | undefined;
  description?: string | undefined;
  materials?: string | undefined;
  note?: string | undefined;
  notBefore?: string | undefined;
  deadline?: string | undefined;
}>;

export type TodoOwnerOption = Readonly<{ id: string; name: string }>;

/**
 * Adds a task, or changes one when `task` is given. The owner is a working group: fixed (a coordinator's group, or the
 * group of an existing task) or, for a super admin who opened the form without a group, chosen from `groups`. A family-owned
 * task keeps its family unless a super admin picks another one from `families` (the hand-over).
 */
export function TodoForm({
  task,
  ownerGroupId,
  ownerFamilyId,
  ownerLabel,
  groups,
  families,
  backHref,
}: Readonly<{
  task?: TodoFormTask | undefined;
  ownerGroupId?: string | undefined;
  ownerFamilyId?: string | undefined;
  ownerLabel?: string | undefined;
  groups?: readonly TodoOwnerOption[] | undefined;
  /** The other active families a super admin may hand a family-owned task to (none: no chooser). */
  families?: readonly TodoOwnerOption[] | undefined;
  backHref: string;
}>) {
  const done = task?.status === "done";
  return (
    <ParentMutationForm
      action={saveTodoAction}
      submitLabel="Mentés"
      testId="todo-form"
      freshIdempotencyKey
      afterSuccess={
        task ? undefined : (
          <p className="parent-page-actions">
            <a href={backHref} data-testid="todo-saved-back-link">
              Vissza a teendőkhöz
            </a>
          </p>
        )
      }
    >
      <input
        type="hidden"
        name="idempotencyKey"
        value={task ? `todo-save:${task.id}:v${task.version}` : "todo-add"}
      />
      {task && <input type="hidden" name="taskId" value={task.id} />}
      {task && <input type="hidden" name="expectedVersion" value={task.version} />}
      {ownerGroupId && <input type="hidden" name="ownerGroupId" value={ownerGroupId} />}
      {ownerFamilyId && <input type="hidden" name="ownerFamilyId" value={ownerFamilyId} />}
      {!ownerGroupId && !ownerFamilyId && groups && (
        <Field id="todo-owner" name="owner" label="Munkacsoport">
          <select
            id="todo-owner"
            name="ownerGroupId"
            required
            defaultValue=""
            data-testid="todo-owner"
          >
            <option value="" disabled>
              Válassz munkacsoportot
            </option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        </Field>
      )}
      {ownerLabel && (
        <p className="todo-owner-line" data-testid="todo-owner-line">
          Felelős: <strong>{ownerLabel}</strong>
        </p>
      )}
      {ownerFamilyId && families && families.length > 0 && (
        <Field id="todo-new-owner-family" name="newOwnerFamilyId" label="Átadás másik családnak">
          <select
            id="todo-new-owner-family"
            name="newOwnerFamilyId"
            defaultValue=""
            data-testid="todo-new-owner-family"
          >
            <option value="">Nem változik</option>
            {families.map((family) => (
              <option key={family.id} value={family.id}>
                {family.name}
              </option>
            ))}
          </select>
        </Field>
      )}
      <Field id="todo-topic" name="topic" label="Téma" hint="Legfeljebb 200 karakter.">
        <input
          id="todo-topic"
          name="topic"
          type="text"
          maxLength={200}
          required
          defaultValue={task?.topic}
          aria-describedby="todo-topic-hint"
          data-testid="todo-topic"
        />
      </Field>
      <Field id="todo-priority" name="priority" label="Prioritás">
        <select
          id="todo-priority"
          name="priority"
          defaultValue={task?.priority === undefined ? "" : String(task.priority)}
          data-testid="todo-priority"
        >
          <option value="">Nincs megadva</option>
          <option value="1">1</option>
          <option value="2">2</option>
          <option value="3">3</option>
        </select>
      </Field>
      <Field id="todo-description" name="description" label="Leírás">
        <textarea
          id="todo-description"
          name="description"
          rows={4}
          maxLength={2000}
          defaultValue={task?.description}
          data-testid="todo-description"
        />
      </Field>
      <Field id="todo-materials" name="materials" label="Eszközök és anyagok">
        <textarea
          id="todo-materials"
          name="materials"
          rows={2}
          maxLength={500}
          defaultValue={task?.materials}
          data-testid="todo-materials"
        />
      </Field>
      {!done && (
        <Field id="todo-status" name="status" label="Állapot">
          <select
            id="todo-status"
            name="status"
            defaultValue={task?.status ?? "open"}
            data-testid="todo-status"
          >
            {TODO_FORM_STATUSES.map((status) => (
              <option key={status} value={status}>
                {TODO_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </Field>
      )}
      <Field id="todo-note" name="note" label="Megjegyzés">
        <textarea
          id="todo-note"
          name="note"
          rows={3}
          maxLength={1000}
          defaultValue={task?.note}
          data-testid="todo-note"
        />
      </Field>
      <Field id="todo-not-before" name="notBefore" label="Nem előbb">
        <input
          id="todo-not-before"
          name="notBefore"
          type="date"
          defaultValue={task?.notBefore}
          data-testid="todo-not-before"
        />
      </Field>
      <Field id="todo-deadline" name="deadline" label="Határidő">
        <input
          id="todo-deadline"
          name="deadline"
          type="date"
          defaultValue={task?.deadline}
          data-testid="todo-deadline"
        />
      </Field>
    </ParentMutationForm>
  );
}

/* ---------- The pull list ---------- */

export type TodoPullRow = Readonly<{
  id: string;
  version: number;
  topic: string;
  stateLabel: string;
  stateIcon: Parameters<typeof StatusBadge>[0]["symbol"];
  meta: string;
  onEvent: boolean;
}>;

/**
 * The tasks a coordinator may add to an event's checklist: one checkbox per open task with a name for assistive
 * technology, a count on the button, and a "Már hozzáadva" mark for a task that is already on an event's list.
 */
export function PullForm({
  eventId,
  groupId,
  rows,
}: Readonly<{ eventId: string; groupId?: string | undefined; rows: readonly TodoPullRow[] }>) {
  const [chosen, setChosen] = useState<ReadonlySet<string>>(new Set());
  function toggle(id: string, checked: boolean) {
    setChosen((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }
  return (
    <ParentMutationForm
      action={pullTodosAction}
      submitLabel={`Kijelöltek hozzáadása (${chosen.size})`}
      testId="todo-pull-form"
      freshIdempotencyKey
    >
      <input type="hidden" name="idempotencyKey" value={`todo-pull:${eventId}`} />
      <input type="hidden" name="eventId" value={eventId} />
      {groupId && <input type="hidden" name="groupId" value={groupId} />}
      <FieldError name="tasks" />
      <ul className="todo-pull-list" aria-label="Felvehető teendők">
        {rows.map((row) => (
          <li key={row.id} className="todo-pull-row" data-testid={`todo-pull-row-${row.id}`}>
            <label className="todo-pull-label">
              <input
                type="checkbox"
                name="task"
                value={`${row.id}:${row.version}`}
                onChange={(event) => toggle(row.id, event.currentTarget.checked)}
                aria-label={`Kijelölés: ${row.topic}`}
                data-testid={`todo-pull-check-${row.id}`}
              />
              <span className="todo-pull-text">
                <strong>{row.topic}</strong>
                {row.meta && <span className="todo-meta">{row.meta}</span>}
              </span>
            </label>
            <StatusBadge className="todo-status" label={row.stateLabel} symbol={row.stateIcon} />
            {row.onEvent && (
              <span className="todo-chip" data-testid={`todo-pull-added-${row.id}`}>
                Már hozzáadva
              </span>
            )}
          </li>
        ))}
      </ul>
    </ParentMutationForm>
  );
}
