"use client";

import { useState, type ReactNode } from "react";
import type {
  ChecklistSectionKind,
  ChecklistSectionModel,
  ChecklistTaskModel,
  TemplateModel,
  TemplateOptionsModel,
} from "../../src/application/index.ts";
import type { EventArea } from "../_events/actor.ts";
import { ParentMutationForm } from "../szulo/_components/ParentMutationForm.tsx";
import {
  claimTaskAction,
  copyTemplateAction,
  markTaskDoneAction,
  removeSectionAction,
  removeTaskAction,
  reorderAction,
  saveSectionAction,
  saveTaskAction,
  saveTemplateAction,
  setTemplateRemovedAction,
  undoTaskDoneAction,
  withdrawClaimAction,
} from "./actions.ts";

export const SECTION_KIND_LABELS: Readonly<Record<ChecklistSectionKind, string>> = Object.freeze({
  parents: "Szülőknek",
  organisers: "Szervezőknek",
  teachers: "Pedagógusoknak",
});

const KINDS: readonly ChecklistSectionKind[] = ["parents", "organisers", "teachers"];

/** The hidden fields every checklist form sends: the area, a first key, and the event and group the page was opened for. */
function Context({
  area,
  keyName,
  eventId,
  groupId,
}: Readonly<{ area: EventArea; keyName: string; eventId?: string; groupId?: string | undefined }>) {
  return (
    <>
      <input type="hidden" name="area" value={area} />
      <input type="hidden" name="idempotencyKey" value={keyName} />
      {eventId && <input type="hidden" name="eventId" value={eventId} />}
      {groupId && <input type="hidden" name="groupId" value={groupId} />}
    </>
  );
}

type TaskRef = Readonly<{ area: EventArea; eventId: string; task: ChecklistTaskModel }>;

/* ---------- On the event page ---------- */

export function ClaimForm({ area, eventId, task }: TaskRef) {
  return (
    <ParentMutationForm
      action={claimTaskAction}
      submitLabel="Elvállalom"
      submitAriaLabel={`Elvállalom: ${task.title}`}
      testId={`checklist-claim-${task.id}`}
      freshIdempotencyKey
    >
      <Context area={area} eventId={eventId} keyName="checklist-claim" />
      <input type="hidden" name="taskId" value={task.id} />
    </ParentMutationForm>
  );
}

export function WithdrawClaimForm({
  area,
  eventId,
  groupId,
  claimId,
  version,
  title,
  asManager = false,
  label = "Visszaadom",
}: Readonly<{
  area: EventArea;
  eventId: string;
  groupId?: string | undefined;
  claimId: string;
  version: number;
  title: string;
  asManager?: boolean;
  label?: string;
}>) {
  return (
    <ParentMutationForm
      action={withdrawClaimAction}
      submitLabel={label}
      submitAriaLabel={`${label}: ${title}`}
      testId={`checklist-withdraw-${claimId}`}
      freshIdempotencyKey
    >
      <Context area={area} eventId={eventId} groupId={groupId} keyName="checklist-withdraw" />
      <input type="hidden" name="claimId" value={claimId} />
      <input type="hidden" name="expectedVersion" value={version} />
      {asManager && <input type="hidden" name="asManager" value="1" />}
    </ParentMutationForm>
  );
}

export function DoneForm({ area, eventId, task }: TaskRef) {
  return (
    <ParentMutationForm
      action={markTaskDoneAction}
      submitLabel="Kész"
      submitAriaLabel={`Kész: ${task.title}`}
      testId={`checklist-done-${task.id}`}
      freshIdempotencyKey
    >
      <Context area={area} eventId={eventId} keyName="checklist-done" />
      <input type="hidden" name="taskId" value={task.id} />
      <input type="hidden" name="expectedVersion" value={task.version} />
    </ParentMutationForm>
  );
}

export function UndoDoneForm({ area, eventId, task }: TaskRef) {
  return (
    <ParentMutationForm
      action={undoTaskDoneAction}
      submitLabel="Visszavonás"
      submitAriaLabel={`Visszavonás: ${task.title}`}
      testId={`checklist-undo-${task.id}`}
      freshIdempotencyKey
    >
      <Context area={area} eventId={eventId} keyName="checklist-undo" />
      <input type="hidden" name="taskId" value={task.id} />
      <input type="hidden" name="expectedVersion" value={task.version} />
    </ParentMutationForm>
  );
}

/* ---------- The editor of one event's list ---------- */

type EditorRef = Readonly<{
  area: EventArea;
  eventId: string;
  groupId?: string | undefined;
  checklistVersion: number;
}>;

function EditorContext({
  area,
  eventId,
  groupId,
  checklistVersion,
  keyName,
}: EditorRef & { keyName: string }) {
  return (
    <>
      <Context area={area} eventId={eventId} groupId={groupId} keyName={keyName} />
      <input type="hidden" name="checklistVersion" value={checklistVersion} />
    </>
  );
}

function Labelled({
  id,
  label,
  children,
}: Readonly<{ id: string; label: string; children: ReactNode }>) {
  return (
    <div className="parent-field">
      <label htmlFor={id}>{label}</label>
      {children}
    </div>
  );
}

export function SectionForm({
  editor,
  section,
}: Readonly<{ editor: EditorRef; section?: ChecklistSectionModel }>) {
  const key = section?.id ?? "new";
  return (
    <ParentMutationForm
      action={saveSectionAction}
      submitLabel={section ? "Rész mentése" : "Új rész hozzáadása"}
      testId={`checklist-section-form-${key}`}
      freshIdempotencyKey
    >
      <EditorContext {...editor} keyName="checklist-section" />
      {section && <input type="hidden" name="sectionId" value={section.id} />}
      {section && <input type="hidden" name="expectedVersion" value={section.version} />}
      <Labelled id={`section-title-${key}`} label="Rész megnevezése">
        <input
          id={`section-title-${key}`}
          name="title"
          type="text"
          maxLength={100}
          required
          defaultValue={section?.title}
          data-testid={`checklist-section-title-${key}`}
        />
      </Labelled>
      <Labelled id={`section-kind-${key}`} label="Kinek szól?">
        <select
          id={`section-kind-${key}`}
          name="kind"
          defaultValue={section?.kind ?? "parents"}
          data-testid={`checklist-section-kind-${key}`}
        >
          {KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {SECTION_KIND_LABELS[kind]}
            </option>
          ))}
        </select>
      </Labelled>
    </ParentMutationForm>
  );
}

export function RemoveSectionForm({
  editor,
  section,
}: Readonly<{ editor: EditorRef; section: ChecklistSectionModel }>) {
  return (
    <ParentMutationForm
      action={removeSectionAction}
      submitLabel="Rész törlése"
      submitAriaLabel={`Rész törlése: ${section.title}`}
      testId={`checklist-section-remove-${section.id}`}
      freshIdempotencyKey
    >
      <EditorContext {...editor} keyName="checklist-section-remove" />
      <input type="hidden" name="sectionId" value={section.id} />
    </ParentMutationForm>
  );
}

export function TaskForm({
  editor,
  sectionId,
  task,
}: Readonly<{ editor: EditorRef; sectionId: string; task?: ChecklistTaskModel }>) {
  const key = task?.id ?? `new-${sectionId}`;
  const locked = task !== undefined && (task.claims.length > 0 || task.done !== undefined);
  return (
    <ParentMutationForm
      action={saveTaskAction}
      submitLabel={task ? "Mentés" : "Új feladat hozzáadása"}
      submitAriaLabel={task ? `Mentés: ${task.title}` : undefined}
      testId={`checklist-task-form-${key}`}
      freshIdempotencyKey
    >
      <EditorContext {...editor} keyName="checklist-task" />
      <input type="hidden" name="sectionId" value={sectionId} />
      {task && <input type="hidden" name="taskId" value={task.id} />}
      {task && <input type="hidden" name="expectedVersion" value={task.version} />}
      <Labelled id={`task-title-${key}`} label="Feladat neve">
        <input
          id={`task-title-${key}`}
          name="title"
          type="text"
          maxLength={200}
          required
          defaultValue={task?.title}
          data-testid={`checklist-task-title-${key}`}
        />
      </Labelled>
      <Labelled id={`task-place-${key}`} label="Helyszín">
        <input
          id={`task-place-${key}`}
          name="place"
          type="text"
          maxLength={200}
          defaultValue={task?.place}
        />
      </Labelled>
      <Labelled id={`task-props-${key}`} label="Eszközök">
        <input
          id={`task-props-${key}`}
          name="props"
          type="text"
          maxLength={300}
          defaultValue={task?.props}
        />
      </Labelled>
      <Labelled id={`task-materials-${key}`} label="Anyagok">
        <input
          id={`task-materials-${key}`}
          name="materials"
          type="text"
          maxLength={300}
          defaultValue={task?.materials}
        />
      </Labelled>
      <div className="checklist-row">
        <Labelled id={`task-priority-${key}`} label="Fontosság (1–3)">
          <select
            id={`task-priority-${key}`}
            name="priority"
            defaultValue={String(task?.priority ?? "")}
          >
            <option value="">Nincs megadva</option>
            <option value="1">1 – Alacsony</option>
            <option value="2">2 – Közepes</option>
            <option value="3">3 – Sürgős</option>
          </select>
        </Labelled>
        <Labelled id={`task-helpers-${key}`} label="Hány segítő kell?">
          <input
            id={`task-helpers-${key}`}
            name="helpersNeeded"
            type="number"
            min={1}
            max={20}
            defaultValue={task?.helpersNeeded ?? 1}
            data-testid={`checklist-task-helpers-${key}`}
          />
        </Labelled>
        <Labelled id={`task-deadline-${key}`} label="Határidő">
          <input
            id={`task-deadline-${key}`}
            name="deadline"
            type="date"
            defaultValue={task?.deadline}
          />
        </Labelled>
      </div>
      <p className="checklist-checks">
        <label>
          <input type="checkbox" name="timeMatters" defaultChecked={task?.timeMatters} /> Időpont
          számít
        </label>
        <label>
          <input type="checkbox" name="summerOnly" defaultChecked={task?.summerOnly} /> Csak nyáron
        </label>
      </p>
      <Labelled id={`task-tip-${key}`} label="Gyakorlati tipp / megjegyzés">
        <textarea
          id={`task-tip-${key}`}
          name="tip"
          maxLength={1000}
          rows={2}
          defaultValue={task?.tip}
        />
      </Labelled>
      {locked && (
        <p className="form-hint" data-testid={`checklist-task-locked-${key}`}>
          Vállalt vagy kész feladatot nem lehet törölni vagy másik részbe tenni.
        </p>
      )}
    </ParentMutationForm>
  );
}

export function RemoveTaskForm({
  editor,
  task,
}: Readonly<{ editor: EditorRef; task: ChecklistTaskModel }>) {
  return (
    <ParentMutationForm
      action={removeTaskAction}
      submitLabel="Törlés"
      submitAriaLabel={`Törlés: ${task.title}`}
      testId={`checklist-task-remove-${task.id}`}
      freshIdempotencyKey
    >
      <EditorContext {...editor} keyName="checklist-task-remove" />
      <input type="hidden" name="taskId" value={task.id} />
    </ParentMutationForm>
  );
}

type OrderEntry = Readonly<{ section_id: string; task_ids: readonly string[] }>;

/** A button that sends the full order after one move: the page works out the new order, the database checks it. */
export function MoveForm({
  editor,
  order,
  label,
  direction,
  testId,
}: Readonly<{
  editor: EditorRef;
  order: readonly OrderEntry[];
  label: string;
  direction: "up" | "down";
  testId: string;
}>) {
  return (
    <ParentMutationForm
      action={reorderAction}
      submitLabel={direction === "up" ? "Fel" : "Le"}
      submitAriaLabel={label}
      testId={testId}
      freshIdempotencyKey
    >
      <EditorContext {...editor} keyName="checklist-order" />
      <input type="hidden" name="order" value={JSON.stringify(order)} />
    </ParentMutationForm>
  );
}

/** Copies a template into the empty list. */
export function CopyTemplateForm({
  editor,
  templates,
}: Readonly<{ editor: EditorRef; templates: TemplateOptionsModel["items"] }>) {
  return (
    <ParentMutationForm
      action={copyTemplateAction}
      submitLabel="Sablon másolása"
      testId="checklist-copy-form"
      freshIdempotencyKey
    >
      <EditorContext {...editor} keyName="checklist-copy" />
      <Labelled id="checklist-copy-template" label="Sablon">
        <select
          id="checklist-copy-template"
          name="templateId"
          required
          data-testid="checklist-copy-select"
        >
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name}
            </option>
          ))}
        </select>
      </Labelled>
    </ParentMutationForm>
  );
}

/* ---------- Template editor ---------- */

type TaskDraft = {
  title: string;
  place: string;
  props: string;
  materials: string;
  tip: string;
  priority: string;
  helpersNeeded: string;
  summerOnly: boolean;
  timeMatters: boolean;
};
type SectionDraft = { title: string; kind: ChecklistSectionKind; tasks: TaskDraft[] };

const emptyTask = (): TaskDraft => ({
  title: "",
  place: "",
  props: "",
  materials: "",
  tip: "",
  priority: "",
  helpersNeeded: "1",
  summerOnly: false,
  timeMatters: false,
});

const draftOf = (template?: TemplateModel): SectionDraft[] =>
  template?.sections.map((section) => ({
    title: section.title,
    kind: section.kind,
    tasks: section.tasks.map((task) => ({
      title: task.title,
      place: task.place ?? "",
      props: task.props ?? "",
      materials: task.materials ?? "",
      tip: task.tip ?? "",
      priority: task.priority === undefined ? "" : String(task.priority),
      helpersNeeded: String(task.helpersNeeded),
      summerOnly: task.summerOnly,
      timeMatters: task.timeMatters,
    })),
  })) ?? [{ title: "", kind: "parents", tasks: [emptyTask()] }];

function swap<T>(list: readonly T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return [...list];
  const next = [...list];
  [next[from], next[to]] = [next[to]!, next[from]!];
  return next;
}

/**
 * The whole template in one form: name, description, lead days and the sections with their tasks. Adding, removing and
 * moving sections and tasks only changes the draft on the page; one save sends it all, and the database replaces the
 * template's sections in one step. A stale version is refused and asks for a reload.
 */
export function TemplateEditorForm({
  area,
  template,
  groupId,
  backHref,
}: Readonly<{
  area: EventArea;
  template?: TemplateModel;
  groupId?: string | undefined;
  backHref: string;
}>) {
  const [name, setName] = useState(template?.name ?? "");
  const [description, setDescription] = useState(template?.description ?? "");
  const [lead, setLead] = useState(
    template?.defaultLeadDays === undefined ? "" : String(template.defaultLeadDays),
  );
  const [sections, setSections] = useState<SectionDraft[]>(() => draftOf(template));

  const setSection = (index: number, patch: Partial<SectionDraft>) =>
    setSections((list) => list.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  const setTask = (si: number, ti: number, patch: Partial<TaskDraft>) =>
    setSections((list) =>
      list.map((s, i) =>
        i === si ? { ...s, tasks: s.tasks.map((t, j) => (j === ti ? { ...t, ...patch } : t)) } : s,
      ),
    );

  const payload = JSON.stringify({
    name,
    description,
    defaultLeadDays: lead,
    sections,
  });

  return (
    <ParentMutationForm
      action={saveTemplateAction}
      submitLabel="Mentés"
      testId="template-editor-form"
      freshIdempotencyKey
    >
      <Context
        area={area}
        groupId={groupId}
        keyName={template ? `template-save:${template.id}` : "template-create"}
      />
      <input type="hidden" name="backHref" value={backHref} />
      {template && <input type="hidden" name="templateId" value={template.id} />}
      {template && <input type="hidden" name="expectedVersion" value={template.version} />}
      <input type="hidden" name="template" value={payload} />
      <Labelled id="template-name" label="Sablon neve">
        <input
          id="template-name"
          type="text"
          maxLength={200}
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          data-testid="template-name-input"
        />
      </Labelled>
      <Labelled id="template-description" label="Leírás">
        <textarea
          id="template-description"
          rows={3}
          maxLength={1000}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          data-testid="template-description-input"
        />
      </Labelled>
      <Labelled id="template-lead" label="Értesítés előre (nap)">
        <input
          id="template-lead"
          type="number"
          min={1}
          max={60}
          value={lead}
          onChange={(event) => setLead(event.target.value)}
          data-testid="template-lead-input"
        />
        <p className="form-hint">
          Ennyi nappal az esemény előtt kapnak értesítést a családok. 1 és 60 között.
        </p>
      </Labelled>
      {sections.map((section, si) => (
        <fieldset
          key={si}
          className="checklist-template-section"
          data-testid={`template-section-${si}`}
        >
          <legend>{si + 1}. rész</legend>
          <Labelled id={`template-section-title-${si}`} label="Rész megnevezése">
            <input
              id={`template-section-title-${si}`}
              type="text"
              maxLength={100}
              required
              value={section.title}
              onChange={(event) => setSection(si, { title: event.target.value })}
              data-testid={`template-section-title-${si}`}
            />
          </Labelled>
          <Labelled id={`template-section-kind-${si}`} label="Kinek szól?">
            <select
              id={`template-section-kind-${si}`}
              value={section.kind}
              onChange={(event) =>
                setSection(si, { kind: event.target.value as ChecklistSectionKind })
              }
            >
              {KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {SECTION_KIND_LABELS[kind]}
                </option>
              ))}
            </select>
          </Labelled>
          {section.tasks.map((task, ti) => (
            <div
              key={ti}
              className="checklist-template-task"
              data-testid={`template-task-${si}-${ti}`}
            >
              <Labelled id={`template-task-title-${si}-${ti}`} label="Feladat neve">
                <input
                  id={`template-task-title-${si}-${ti}`}
                  type="text"
                  maxLength={200}
                  required
                  value={task.title}
                  onChange={(event) => setTask(si, ti, { title: event.target.value })}
                  data-testid={`template-task-title-${si}-${ti}`}
                />
              </Labelled>
              <Labelled id={`template-task-place-${si}-${ti}`} label="Helyszín">
                <input
                  id={`template-task-place-${si}-${ti}`}
                  type="text"
                  maxLength={200}
                  value={task.place}
                  onChange={(event) => setTask(si, ti, { place: event.target.value })}
                />
              </Labelled>
              <Labelled id={`template-task-props-${si}-${ti}`} label="Eszközök">
                <input
                  id={`template-task-props-${si}-${ti}`}
                  type="text"
                  maxLength={300}
                  value={task.props}
                  onChange={(event) => setTask(si, ti, { props: event.target.value })}
                />
              </Labelled>
              <div className="checklist-row">
                <Labelled id={`template-task-priority-${si}-${ti}`} label="Fontosság (1–3)">
                  <select
                    id={`template-task-priority-${si}-${ti}`}
                    value={task.priority}
                    onChange={(event) => setTask(si, ti, { priority: event.target.value })}
                  >
                    <option value="">Nincs megadva</option>
                    <option value="1">1 – Alacsony</option>
                    <option value="2">2 – Közepes</option>
                    <option value="3">3 – Sürgős</option>
                  </select>
                </Labelled>
                <Labelled id={`template-task-helpers-${si}-${ti}`} label="Hány segítő kell?">
                  <input
                    id={`template-task-helpers-${si}-${ti}`}
                    type="number"
                    min={1}
                    max={20}
                    value={task.helpersNeeded}
                    onChange={(event) => setTask(si, ti, { helpersNeeded: event.target.value })}
                  />
                </Labelled>
              </div>
              <p className="checklist-checks">
                <label>
                  <input
                    type="checkbox"
                    checked={task.timeMatters}
                    onChange={(event) => setTask(si, ti, { timeMatters: event.target.checked })}
                  />{" "}
                  Időpont számít
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={task.summerOnly}
                    onChange={(event) => setTask(si, ti, { summerOnly: event.target.checked })}
                  />{" "}
                  Csak nyáron
                </label>
              </p>
              <p className="checklist-move-row">
                <button
                  type="button"
                  aria-label={`Feladat feljebb: ${task.title || `${ti + 1}. feladat`}`}
                  onClick={() => setSection(si, { tasks: swap(section.tasks, ti, ti - 1) })}
                >
                  Fel
                </button>
                <button
                  type="button"
                  aria-label={`Feladat lejjebb: ${task.title || `${ti + 1}. feladat`}`}
                  onClick={() => setSection(si, { tasks: swap(section.tasks, ti, ti + 1) })}
                >
                  Le
                </button>
                <button
                  type="button"
                  aria-label={`Feladat törlése: ${task.title || `${ti + 1}. feladat`}`}
                  onClick={() =>
                    setSection(si, { tasks: section.tasks.filter((_, j) => j !== ti) })
                  }
                >
                  Törlés
                </button>
              </p>
            </div>
          ))}
          <p className="checklist-move-row">
            <button
              type="button"
              data-testid={`template-add-task-${si}`}
              onClick={() => setSection(si, { tasks: [...section.tasks, emptyTask()] })}
            >
              Új feladat hozzáadása ehhez a részhez
            </button>
            <button
              type="button"
              aria-label={`Rész feljebb: ${section.title || `${si + 1}. rész`}`}
              onClick={() => setSections((list) => swap(list, si, si - 1))}
            >
              Rész fel
            </button>
            <button
              type="button"
              aria-label={`Rész lejjebb: ${section.title || `${si + 1}. rész`}`}
              onClick={() => setSections((list) => swap(list, si, si + 1))}
            >
              Rész le
            </button>
            <button
              type="button"
              aria-label={`Rész törlése: ${section.title || `${si + 1}. rész`}`}
              onClick={() => setSections((list) => list.filter((_, i) => i !== si))}
            >
              Rész törlése
            </button>
          </p>
        </fieldset>
      ))}
      <p>
        <button
          type="button"
          data-testid="template-add-section"
          onClick={() =>
            setSections((list) => [...list, { title: "", kind: "parents", tasks: [emptyTask()] }])
          }
        >
          Új rész hozzáadása
        </button>
      </p>
    </ParentMutationForm>
  );
}

export function TemplateRemovedForm({
  area,
  groupId,
  template,
  removed,
}: Readonly<{
  area: EventArea;
  groupId?: string | undefined;
  template: Readonly<{ id: string; name: string; version: number }>;
  removed: boolean;
}>) {
  const label = removed ? "Törlés" : "Visszaállítás";
  return (
    <ParentMutationForm
      action={setTemplateRemovedAction}
      submitLabel={label}
      submitAriaLabel={`${label}: ${template.name}`}
      testId={`template-${removed ? "remove" : "restore"}-${template.id}`}
      freshIdempotencyKey
    >
      <Context area={area} groupId={groupId} keyName="template-removed" />
      <input type="hidden" name="templateId" value={template.id} />
      <input type="hidden" name="expectedVersion" value={template.version} />
      <input type="hidden" name="removed" value={removed ? "true" : "false"} />
    </ParentMutationForm>
  );
}

/* ---------- On the new-event form ---------- */

/**
 * The "start from a template" choice of a new event. Choosing a template suggests its lead time in the notice field
 * (only while that field is empty, so a typed value is never overwritten) and says when the template has summer tasks.
 */
export function TemplateChooser({
  templates,
}: Readonly<{ templates: TemplateOptionsModel["items"] }>) {
  const [chosen, setChosen] = useState("");
  const template = templates.find((item) => item.id === chosen);
  function choose(id: string) {
    setChosen(id);
    const lead = templates.find((item) => item.id === id)?.defaultLeadDays;
    const field = document.getElementById("event-notice-lead");
    if (lead !== undefined && field instanceof HTMLInputElement && field.value === "") {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(field, String(lead));
      field.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }
  return (
    <div className="checklist-chooser" data-testid="event-template-chooser">
      <div className="parent-field">
        <label htmlFor="event-template">Indítás sablonból</label>
        <select
          id="event-template"
          name="templateId"
          value={chosen}
          onChange={(event) => choose(event.target.value)}
          aria-describedby="event-template-hint"
          data-testid="event-template-select"
        >
          <option value="">Nem kérek sablont</option>
          {templates.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <p id="event-template-hint" className="form-hint">
          A sablon feladatai bemásolódnak az esemény feladatlistájába, utána szerkeszthetők.
        </p>
      </div>
      {template?.defaultLeadDays !== undefined && (
        <p className="form-hint" data-testid="event-template-lead-hint">
          A sablon javaslata: {template.defaultLeadDays} nappal előtte értesítés. Az értesítés
          mezőben átírható.
        </p>
      )}
      {template?.hasSummerTasks && (
        <p className="form-hint" data-testid="event-template-summer-hint">
          A sablon nyári feladatokat is tartalmaz: nyári eseménynél bekerülnek, másnál kimaradnak.
          Jelöld be a „Nyári esemény” mezőt, ha kell.
        </p>
      )}
    </div>
  );
}
