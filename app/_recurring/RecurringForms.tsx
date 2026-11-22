"use client";

import { useContext, useState, type ReactNode } from "react";
import type { RecurringItem, RecurringScheduleItem } from "../../src/application/index.ts";
import { MONTH_NAMES } from "../../src/application/recurring-format.ts";
import {
  ParentFieldErrorsContext,
  ParentMutationForm,
} from "../szulo/_components/ParentMutationForm.tsx";
import {
  markDoneAction,
  saveScheduleAction,
  setScheduleActiveAction,
  skipOccurrenceAction,
  undoDoneAction,
} from "./actions.ts";

/** The hidden fields every recurring form sends: the group it was opened for (when there is one) and a first key. */
function Context({
  keyName,
  groupId,
}: Readonly<{ keyName: string; groupId?: string | undefined }>) {
  return (
    <>
      <input type="hidden" name="idempotencyKey" value={keyName} />
      {groupId && <input type="hidden" name="groupId" value={groupId} />}
    </>
  );
}

function FieldError({ name, testId }: Readonly<{ name: string; testId: string }>) {
  const message = useContext(ParentFieldErrorsContext)[name];
  return message ? (
    <p
      id={`${name}-error`}
      className="parent-field-error"
      role="alert"
      data-testid={`${testId}-error`}
    >
      {message}
    </p>
  ) : null;
}

/** One labelled field: label, optional hint, the control and, after a refused save, its own message (NFR4.9). */
function Field({
  id,
  name,
  label,
  testId,
  hint,
  children,
}: Readonly<{
  id: string;
  name: string;
  label: string;
  testId: string;
  hint?: string;
  children: ReactNode;
}>) {
  const invalid = Boolean(useContext(ParentFieldErrorsContext)[name]);
  return (
    <div className={`parent-field${invalid ? " recurring-field-invalid" : ""}`}>
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && (
        <p id={`${id}-hint`} className="form-hint">
          {hint}
        </p>
      )}
      <FieldError name={name} testId={testId} />
    </div>
  );
}

/** The describedby of a control: its hint and, when it is refused, its message. */
function describedBy(
  id: string,
  name: string,
  hint: boolean,
  invalid: boolean,
): string | undefined {
  const parts = [hint ? `${id}-hint` : "", invalid ? `${name}-error` : ""].filter(Boolean);
  return parts.length ? parts.join(" ") : undefined;
}

function SeasonSelect({
  id,
  name,
  label,
  defaultValue,
  testId,
}: Readonly<{ id: string; name: string; label: string; defaultValue?: number; testId: string }>) {
  return (
    <div className="parent-field">
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        name={name}
        defaultValue={defaultValue === undefined ? "" : String(defaultValue)}
        data-testid={testId}
      >
        <option value="">Nincs megadva</option>
        {MONTH_NAMES.map((month, index) => (
          <option key={month} value={index + 1}>
            {month[0]!.toUpperCase() + month.slice(1)}
          </option>
        ))}
      </select>
    </div>
  );
}

/** The interval number: a plain number field whose limits are the database's, so a wrong entry shows its own message. */
function IntervalField({
  id,
  label,
  hint,
  defaultValue,
  testId,
}: Readonly<{ id: string; label: string; hint: string; defaultValue: number; testId: string }>) {
  const invalid = Boolean(useContext(ParentFieldErrorsContext).interval);
  return (
    <Field id={id} name="interval" label={label} hint={hint} testId={testId}>
      <input
        id={id}
        name="intervalCount"
        type="number"
        inputMode="numeric"
        step={1}
        defaultValue={defaultValue}
        required
        aria-invalid={invalid ? true : undefined}
        aria-describedby={describedBy(id, "interval", true, invalid)}
        data-testid={testId}
      />
    </Field>
  );
}

/**
 * Adds a group's schedule, or changes one when `schedule` is given. A new schedule is replaced by the confirmation
 * once it is saved, so the same entry cannot be sent twice; the owner of an existing schedule is shown, never changed.
 */
export function ScheduleForm({
  groupId,
  groupName,
  schedule,
  today,
  backHref,
}: Readonly<{
  groupId: string;
  groupName: string;
  schedule?: RecurringScheduleItem;
  today: string;
  backHref: string;
}>) {
  return (
    <ParentMutationForm
      action={saveScheduleAction}
      submitLabel="Mentés"
      testId="recurring-schedule-form"
      freshIdempotencyKey
      afterSuccess={
        schedule ? undefined : (
          <p className="parent-page-actions">
            <a href={backHref} data-testid="recurring-saved-back-link">
              Vissza az ismétlődő feladatokhoz
            </a>
          </p>
        )
      }
    >
      <Context
        keyName={
          schedule ? `recurring-schedule:${schedule.id}:v${schedule.version}` : "recurring-add"
        }
      />
      <input type="hidden" name="ownerKind" value="group" />
      <input type="hidden" name="workingGroupId" value={groupId} />
      {schedule && <input type="hidden" name="scheduleId" value={schedule.id} />}
      {schedule && <input type="hidden" name="expectedVersion" value={schedule.version} />}
      <Field
        id="recurring-title"
        name="title"
        label="Cím"
        hint="Legfeljebb 200 karakter."
        testId="recurring-title"
      >
        <input
          id="recurring-title"
          name="title"
          type="text"
          defaultValue={schedule?.title}
          maxLength={200}
          required
          aria-describedby="recurring-title-hint"
          data-testid="recurring-title"
        />
      </Field>
      <Field
        id="recurring-category"
        name="category"
        label="Kategória"
        hint="Címke a csoportosításhoz, például tyúk, kert vagy karbantartás."
        testId="recurring-category"
      >
        <input
          id="recurring-category"
          name="category"
          type="text"
          defaultValue={schedule?.category}
          maxLength={100}
          aria-describedby="recurring-category-hint"
          data-testid="recurring-category"
        />
      </Field>
      <IntervalField
        id="recurring-interval"
        label="Ismétlés gyakorisága (hét)"
        hint="Hány hetente ismétlődjön (1–52)."
        defaultValue={schedule?.intervalCount ?? 1}
        testId="recurring-interval"
      />
      <Field
        id="recurring-start"
        name="startDate"
        label="Első esedékesség"
        hint="Az ismétlődés ettől a naptól számolódik."
        testId="recurring-start"
      >
        <input
          id="recurring-start"
          name="startDate"
          type="date"
          defaultValue={schedule?.startDate ?? today}
          required
          aria-describedby="recurring-start-hint"
          data-testid="recurring-start"
        />
      </Field>
      <fieldset className="recurring-season" data-testid="recurring-season">
        <legend>Idény (nem kötelező)</legend>
        <p id="recurring-season-hint" className="form-hint">
          Mindkét hónapot add meg, vagy egyiket sem. Az idény nem lépi át az újévet.
        </p>
        <SeasonSelect
          id="recurring-season-from"
          name="seasonFromMonth"
          label="Ettől a hónaptól"
          defaultValue={schedule?.seasonFromMonth}
          testId="recurring-season-from"
        />
        <SeasonSelect
          id="recurring-season-to"
          name="seasonToMonth"
          label="Eddig a hónapig"
          defaultValue={schedule?.seasonToMonth}
          testId="recurring-season-to"
        />
        <SeasonError />
      </fieldset>
      <p className="recurring-owner" data-testid="recurring-owner">
        <strong>Felelős: {groupName} munkacsoport</strong>
        {schedule && <span> (A felelős meglévő ismétlődésnél nem módosítható.)</span>}
      </p>
    </ParentMutationForm>
  );
}

function SeasonError() {
  return <FieldError name="season" testId="recurring-season" />;
}

/** The one number of the school calendar page: every how-manieth water week the bottles are cleaned (BR147.1). */
export function BottleIntervalForm({ schedule }: Readonly<{ schedule: RecurringScheduleItem }>) {
  return (
    <ParentMutationForm
      action={saveScheduleAction}
      submitLabel="Mentés"
      testId="recurring-bottle-form"
      freshIdempotencyKey
    >
      <Context keyName={`recurring-bottle:${schedule.id}:v${schedule.version}`} />
      <input type="hidden" name="ownerKind" value="rota_week" />
      <input type="hidden" name="rotaJob" value="water_carrying" />
      <input type="hidden" name="scheduleId" value={schedule.id} />
      <input type="hidden" name="expectedVersion" value={schedule.version} />
      <input type="hidden" name="title" value={schedule.title} />
      <input type="hidden" name="category" value={schedule.category} />
      <input type="hidden" name="startDate" value={schedule.startDate} />
      {schedule.seasonFromMonth !== undefined && (
        <input type="hidden" name="seasonFromMonth" value={schedule.seasonFromMonth} />
      )}
      {schedule.seasonToMonth !== undefined && (
        <input type="hidden" name="seasonToMonth" value={schedule.seasonToMonth} />
      )}
      <IntervalField
        id="recurring-bottle-interval"
        label="Minden hányadik vízhordó héten"
        hint={`${schedule.title} minden ${schedule.intervalCount}. vízhordó héten. A már jelzett esedékességek nem változnak.`}
        defaultValue={schedule.intervalCount}
        testId="recurring-bottle-interval"
      />
    </ParentMutationForm>
  );
}

/** Switches a schedule on or off; switching off skips its later open occurrences. */
export function ActiveForm({
  schedule,
  groupId,
}: Readonly<{ schedule: RecurringScheduleItem; groupId: string }>) {
  const switchingOff = schedule.isActive;
  return (
    <ParentMutationForm
      action={setScheduleActiveAction}
      submitLabel={switchingOff ? "Kikapcsolás" : "Bekapcsolás"}
      submitAriaLabel={`${switchingOff ? "Kikapcsolás" : "Bekapcsolás"}: ${schedule.title}`}
      testId={`recurring-active-form-${schedule.id}`}
      freshIdempotencyKey
    >
      <Context keyName={`recurring-active:${schedule.id}:v${schedule.version}`} groupId={groupId} />
      <input type="hidden" name="scheduleId" value={schedule.id} />
      <input type="hidden" name="expectedVersion" value={schedule.version} />
      <input type="hidden" name="active" value={switchingOff ? "false" : "true"} />
    </ParentMutationForm>
  );
}

/** Marks an occurrence done: one native button, no other field. */
export function DoneForm({
  item,
  groupId,
}: Readonly<{ item: RecurringItem; groupId?: string | undefined }>) {
  return (
    <ParentMutationForm
      action={markDoneAction}
      submitLabel="Kész"
      submitAriaLabel={`Kész: ${item.title}`}
      testId={`recurring-done-form-${item.id}`}
      freshIdempotencyKey
    >
      <Context keyName={`recurring-done:${item.id}:v${item.version}`} groupId={groupId} />
      <input type="hidden" name="occurrenceId" value={item.id} />
      <input type="hidden" name="expectedVersion" value={item.version} />
    </ParentMutationForm>
  );
}

/** Takes a done mark back (within 24 hours). */
export function UndoForm({
  item,
  groupId,
}: Readonly<{ item: RecurringItem; groupId?: string | undefined }>) {
  return (
    <ParentMutationForm
      action={undoDoneAction}
      submitLabel="Mégsem"
      submitAriaLabel={`Mégsem: ${item.title} kész jelölésének visszavonása`}
      testId={`recurring-undo-form-${item.id}`}
      freshIdempotencyKey
    >
      <Context keyName={`recurring-undo:${item.id}:v${item.version}`} groupId={groupId} />
      <input type="hidden" name="occurrenceId" value={item.id} />
      <input type="hidden" name="expectedVersion" value={item.version} />
    </ParentMutationForm>
  );
}

/**
 * Skips an occurrence with a reason. "Kihagyom" is a native button that opens the reason form; the reason is written
 * in the form's own field and refused with its own message when it is empty or too long.
 */
export function SkipControl({
  item,
  groupId,
}: Readonly<{ item: RecurringItem; groupId?: string | undefined }>) {
  const [open, setOpen] = useState(false);
  const panel = `recurring-skip-panel-${item.id}`;
  return (
    <div className="recurring-skip">
      <button
        type="button"
        className="recurring-skip-toggle"
        aria-expanded={open}
        aria-controls={panel}
        aria-label={`Kihagyom: ${item.title}`}
        onClick={() => setOpen((value) => !value)}
        data-testid={`recurring-skip-toggle-${item.id}`}
      >
        Kihagyom
      </button>
      <div id={panel} hidden={!open} className="recurring-skip-panel">
        {open && (
          <ParentMutationForm
            action={skipOccurrenceAction}
            submitLabel="Kihagyás mentése"
            testId={`recurring-skip-form-${item.id}`}
            freshIdempotencyKey
          >
            <Context keyName={`recurring-skip:${item.id}:v${item.version}`} groupId={groupId} />
            <input type="hidden" name="occurrenceId" value={item.id} />
            <input type="hidden" name="expectedVersion" value={item.version} />
            <Field
              id={`recurring-skip-reason-${item.id}`}
              name="reason"
              label="Kihagyás oka"
              hint="Legfeljebb 200 karakter. Az indoklás a csoport tagjai számára is látható."
              testId={`recurring-skip-reason-${item.id}`}
            >
              <textarea
                id={`recurring-skip-reason-${item.id}`}
                name="reason"
                rows={3}
                maxLength={200}
                required
                aria-describedby={`recurring-skip-reason-${item.id}-hint`}
                data-testid={`recurring-skip-reason-${item.id}`}
              />
            </Field>
          </ParentMutationForm>
        )}
      </div>
    </div>
  );
}
