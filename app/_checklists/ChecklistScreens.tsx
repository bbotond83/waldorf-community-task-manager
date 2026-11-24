import type {
  ChecklistClaimModel,
  ChecklistModel,
  ChecklistSectionModel,
  ChecklistTaskModel,
} from "../../src/application/index.ts";
import { formatLibraryDate } from "../../src/application/library-format.ts";
import { terminalFailure } from "../../src/application/results.ts";
import { STATUS_ICON_CHARACTERS, type StatusSymbol } from "../../src/application/status-labels.ts";
import { StatusBadge } from "../../src/runtime/StatusBadge.tsx";
import { resolveEventFacade } from "../_events/facade.ts";
import type { EventActor } from "../_events/actor.ts";
import { ParentStatePanel } from "../szulo/_components/ParentStatePanel.tsx";
import {
  ClaimForm,
  CopyTemplateForm,
  DoneForm,
  MoveForm,
  RemoveSectionForm,
  RemoveTaskForm,
  SECTION_KIND_LABELS,
  SectionForm,
  TaskForm,
  UndoDoneForm,
  WithdrawClaimForm,
} from "./ChecklistForms.tsx";
import { resolveChecklistFacade } from "./facade.ts";

const symbol = (icon: keyof typeof STATUS_ICON_CHARACTERS): StatusSymbol => ({
  icon,
  character: STATUS_ICON_CHARACTERS[icon],
});

const FORMER_MEMBER = "korábbi tag";

/** The words and symbol of a task's state; a state is always a word with a symbol, never only a colour. */
function taskState(task: ChecklistTaskModel): {
  label: string;
  icon: keyof typeof STATUS_ICON_CHARACTERS;
} {
  if (task.done) return { label: `Kész – ${task.done.byDisplayName}`, icon: "check" };
  const free = task.helpersNeeded - task.helpersTaken;
  if (free <= 0)
    return {
      label: `${task.helpersTaken}/${task.helpersNeeded} vállalta (betelt)`,
      icon: "square",
    };
  if (task.helpersTaken === 0) {
    return { label: `0/${task.helpersNeeded} vállalta (${free} szabad hely)`, icon: "warning" };
  }
  return {
    label: `${task.helpersTaken}/${task.helpersNeeded} vállalta (${free} szabad hely)`,
    icon: "clock",
  };
}

function claimName(claim: ChecklistClaimModel): string {
  if (claim.typedName) return claim.typedName;
  const person = claim.parentDisplayName ?? FORMER_MEMBER;
  return claim.familyDisplayName ? `${person} (${claim.familyDisplayName})` : person;
}

const sectionOpenCount = (section: ChecklistSectionModel): number =>
  section.tasks.filter((task) => !task.done && task.helpersTaken < task.helpersNeeded).length;

/* ---------- On the event page ---------- */

function TaskCard({
  task,
  actor,
  eventId,
  groupId,
  team,
}: Readonly<{
  task: ChecklistTaskModel;
  actor: EventActor;
  eventId: string;
  groupId?: string | undefined;
  team: boolean;
}>) {
  const state = taskState(task);
  return (
    <li
      className="checklist-task"
      data-testid={`checklist-task-${task.id}`}
      data-done={task.done ? "yes" : "no"}
    >
      <h3 className="checklist-task-title">{task.title}</h3>
      {(task.place || task.props) && (
        <p className="checklist-meta">{[task.place, task.props].filter(Boolean).join(" • ")}</p>
      )}
      {task.tip && <p className="checklist-tip">{task.tip}</p>}
      {task.deadline && (
        <p className="checklist-meta">Határidő: {formatLibraryDate(task.deadline)}</p>
      )}
      <p>
        <StatusBadge
          className="checklist-status"
          label={state.label}
          symbol={symbol(state.icon)}
          testId={`checklist-status-${task.id}`}
        />
      </p>
      {task.claims.length > 0 && (
        <ul className="checklist-claims" aria-label={`Vállalók: ${task.title}`}>
          {task.claims.map((claim) => (
            <li key={claim.id} data-testid={`checklist-claim-row-${claim.id}`}>
              <span>
                {claimName(claim)}
                {claim.isOwn && <strong> (Te)</strong>}
                {claim.note && <span className="checklist-meta"> – {claim.note}</span>}
              </span>
              {claim.isOwn && !task.done && (
                <WithdrawClaimForm
                  area={actor.area}
                  eventId={eventId}
                  claimId={claim.id}
                  version={claim.version}
                  title={task.title}
                />
              )}
              {!claim.isOwn && claim.canRemove && team && !task.done && (
                <WithdrawClaimForm
                  area={actor.area}
                  eventId={eventId}
                  groupId={groupId}
                  claimId={claim.id}
                  version={claim.version}
                  title={task.title}
                  asManager
                  label="Levétel"
                />
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="checklist-actions">
        {task.can.claim && <ClaimForm area={actor.area} eventId={eventId} task={task} />}
        {task.can.markDone && <DoneForm area={actor.area} eventId={eventId} task={task} />}
        {task.can.undoDone && <UndoDoneForm area={actor.area} eventId={eventId} task={task} />}
      </div>
    </li>
  );
}

function Section({
  section,
  actor,
  eventId,
  groupId,
  team,
}: Readonly<{
  section: ChecklistSectionModel;
  actor: EventActor;
  eventId: string;
  groupId?: string | undefined;
  team: boolean;
}>) {
  return (
    <section
      className="checklist-section"
      aria-labelledby={`checklist-section-${section.id}`}
      data-testid={`checklist-section-${section.id}`}
    >
      <div className="checklist-section-head">
        <h2 id={`checklist-section-${section.id}`}>{section.title}</h2>
        {section.kind === "organisers" ? (
          <span className="checklist-chip">Csak a szervezők látják</span>
        ) : (
          <span className="checklist-chip">{section.tasks.length} feladat</span>
        )}
      </div>
      <ul className="checklist-tasks" aria-label={section.title}>
        {section.tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            actor={actor}
            eventId={eventId}
            groupId={groupId}
            team={team}
          />
        ))}
      </ul>
    </section>
  );
}

/**
 * An event's checklist on the event page (BR160 to BR170): what is still open, each section with its tasks, who took
 * them, and the buttons the database says the caller may use. A refused or failed read shows nothing here, so the rest
 * of the event page still reads; a list with no sections shows only a hint to the organising team.
 */
export async function ChecklistBlock({
  actor,
  eventId,
  groupId,
}: Readonly<{ actor: EventActor; eventId: string; groupId?: string | undefined }>) {
  const checklists = await resolveChecklistFacade();
  const result = checklists
    ? await checklists.checklist(actor.session, actor.scope, eventId)
    : terminalFailure();
  if (result.state !== "success" && result.state !== "recovery") return null;
  const list = result.data;
  const team = list.caller.canManage;
  if (list.sections.length === 0 && !(team && actor.area !== "teacher")) return null;
  const open = list.sections
    .filter((section) => section.kind === "parents")
    .reduce((sum, section) => sum + sectionOpenCount(section), 0);
  return (
    <section
      className="parent-event-section checklist-block"
      aria-labelledby="checklist-title"
      data-testid="event-checklist"
    >
      <div className="checklist-section-head">
        <h2 id="checklist-title">Feladatlista</h2>
        {team && actor.area !== "teacher" && (
          <a href={`${actor.basePath}/${eventId}/feladatlista`} data-testid="checklist-edit-link">
            Feladatlista szerkesztése
          </a>
        )}
      </div>
      {list.sections.length === 0 ? (
        <p className="parent-event-empty" role="status" data-testid="checklist-empty">
          Még nincs feladatlista. A szerkesztőben sablonból is indíthatod.
        </p>
      ) : (
        <>
          {open > 0 && !list.isFinished && !list.isCancelled && (
            <p className="checklist-callout" role="status" data-testid="checklist-open-callout">
              <strong>Gazdátlan feladatok vannak.</strong> Még {open} feladatra nincs vállaló.
              Segíts!
            </p>
          )}
          {list.sections.map((section) => (
            <Section
              key={section.id}
              section={section}
              actor={actor}
              eventId={eventId}
              groupId={groupId}
              team={team}
            />
          ))}
          {list.allDone && (
            <p
              className="checklist-callout checklist-callout-success"
              role="status"
              data-testid="checklist-all-done"
            >
              <strong>Minden feladat kész!</strong> Köszönjük a közösség munkáját.
            </p>
          )}
        </>
      )}
    </section>
  );
}

/* ---------- The editor ---------- */

function orderOf(list: ChecklistModel): { section_id: string; task_ids: string[] }[] {
  return list.sections.map((section) => ({
    section_id: section.id,
    task_ids: section.tasks.map((task) => task.id),
  }));
}

const swapped = <T,>(items: readonly T[], from: number, to: number): T[] => {
  const next = [...items];
  [next[from], next[to]] = [next[to]!, next[from]!];
  return next;
};

/** The order after moving a section (`move` of sections) or a task inside its section by one place. */
function movedOrder(
  list: ChecklistModel,
  sectionIndex: number,
  taskIndex: number | undefined,
  delta: -1 | 1,
) {
  const order = orderOf(list);
  if (taskIndex === undefined) return swapped(order, sectionIndex, sectionIndex + delta);
  const entry = order[sectionIndex]!;
  const next = order.map((item) => ({ ...item }));
  next[sectionIndex] = {
    ...entry,
    task_ids: swapped(entry.task_ids, taskIndex, taskIndex + delta),
  };
  return next;
}

/**
 * The editor of an event's checklist for its organising team: sections and tasks to add, change, remove and move,
 * or a template to copy into an empty list. A version that went stale reads as a conflict with its own sentence.
 */
export async function ChecklistEditorScreen({
  actor,
  eventId,
}: Readonly<{ actor: EventActor; eventId: string }>) {
  const checklists = await resolveChecklistFacade();
  const events = await resolveEventFacade();
  const result = checklists
    ? await checklists.checklist(actor.session, actor.scope, eventId)
    : terminalFailure();
  const detail = events ? await events.detail(actor.session, actor.scope, eventId) : undefined;
  const groupId =
    detail && (detail.state === "success" || detail.state === "recovery")
      ? detail.data.event.groupId
      : undefined;
  const options =
    checklists && (result.state === "success" || result.state === "recovery") && result.data.isEmpty
      ? await checklists.templateOptions(actor.session, actor.scope, groupId)
      : undefined;
  const templates =
    options && (options.state === "success" || options.state === "recovery")
      ? options.data.items
      : [];
  const backHref = `${actor.basePath}/${eventId}`;
  return (
    <section className="parent-page checklist-page" data-testid="checklist-editor-page">
      <a href={backHref} className="parent-back-link" data-testid="checklist-back-link">
        Vissza az eseményhez
      </a>
      <ParentStatePanel
        result={result}
        emptyMessage="Az esemény nem érhető el."
        testId="checklist-editor"
      >
        {(list) => {
          const editor = {
            area: actor.area,
            eventId,
            groupId,
            checklistVersion: list.checklistVersion,
          };
          if (!list.caller.canManage) {
            return (
              <p className="parent-state" role="alert" data-testid="checklist-editor-denied">
                Ezt a feladatlistát nem kezelheted.
              </p>
            );
          }
          const closed = list.isFinished || list.isCancelled;
          return (
            <>
              <header className="parent-detail-header">
                <p className="eyebrow">Esemény menedzselés • Szerkesztés</p>
                <h1 tabIndex={-1}>{list.eventTitle} – feladatlista</h1>
                <p className="checklist-meta">
                  A kaláka feladatainak, felelőseinek és szekcióinak beállítása és átrendezése.{" "}
                  <a href={`${backHref}/feladatlista`} data-testid="checklist-reload-link">
                    Oldal újratöltése
                  </a>
                </p>
              </header>
              {closed && (
                <p className="parent-state" role="status" data-testid="checklist-closed">
                  Az esemény már lezárult vagy elmaradt, a lista nem módosítható.
                </p>
              )}
              {list.isEmpty && templates.length > 0 && !closed && (
                <section className="parent-event-section" aria-labelledby="checklist-copy-title">
                  <h2 id="checklist-copy-title">Indítás sablonból</h2>
                  <CopyTemplateForm editor={editor} templates={templates} />
                </section>
              )}
              {list.sections.map((section, si) => (
                <section
                  key={section.id}
                  className="checklist-editor-section"
                  aria-labelledby={`editor-section-${section.id}`}
                  data-testid={`checklist-editor-section-${section.id}`}
                >
                  <h2 id={`editor-section-${section.id}`}>{section.title}</h2>
                  <SectionForm editor={editor} section={section} />
                  <div className="checklist-move-row">
                    {si > 0 && (
                      <MoveForm
                        editor={editor}
                        order={movedOrder(list, si, undefined, -1)}
                        direction="up"
                        label={`Rész feljebb: ${section.title}`}
                        testId={`checklist-section-up-${section.id}`}
                      />
                    )}
                    {si < list.sections.length - 1 && (
                      <MoveForm
                        editor={editor}
                        order={movedOrder(list, si, undefined, 1)}
                        direction="down"
                        label={`Rész lejjebb: ${section.title}`}
                        testId={`checklist-section-down-${section.id}`}
                      />
                    )}
                    <RemoveSectionForm editor={editor} section={section} />
                  </div>
                  {section.tasks.map((task, ti) => (
                    <div
                      key={task.id}
                      className="checklist-editor-task"
                      data-testid={`checklist-editor-task-${task.id}`}
                    >
                      <h3>{task.title}</h3>
                      <TaskForm editor={editor} sectionId={section.id} task={task} />
                      <div className="checklist-move-row">
                        {ti > 0 && (
                          <MoveForm
                            editor={editor}
                            order={movedOrder(list, si, ti, -1)}
                            direction="up"
                            label={`Feladat feljebb: ${task.title}`}
                            testId={`checklist-task-up-${task.id}`}
                          />
                        )}
                        {ti < section.tasks.length - 1 && (
                          <MoveForm
                            editor={editor}
                            order={movedOrder(list, si, ti, 1)}
                            direction="down"
                            label={`Feladat lejjebb: ${task.title}`}
                            testId={`checklist-task-down-${task.id}`}
                          />
                        )}
                        <RemoveTaskForm editor={editor} task={task} />
                      </div>
                    </div>
                  ))}
                  <h3>Új feladat ebbe a részbe</h3>
                  <TaskForm editor={editor} sectionId={section.id} />
                </section>
              ))}
              <section
                className="parent-event-section"
                aria-labelledby="checklist-new-section-title"
              >
                <h2 id="checklist-new-section-title">Új rész</h2>
                <SectionForm editor={editor} />
              </section>
              <p className="form-hint">
                Szerepkörök: a {SECTION_KIND_LABELS.parents} szóló részeket a szülők vállalhatják, a{" "}
                {SECTION_KIND_LABELS.organisers} szólót csak a szervezők látják.
              </p>
            </>
          );
        }}
      </ParentStatePanel>
    </section>
  );
}
