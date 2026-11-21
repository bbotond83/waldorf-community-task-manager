"use client";

import { useContext, useState, type ReactNode } from "react";
import { isoToBudapestLocal } from "../../src/application/budapest-time.ts";
import type {
  EventDetailModel,
  EventRoleModel,
  EventSignupModel,
  FoodOfferModel,
} from "../../src/application/index.ts";
import { FOOD_CATEGORIES, type FoodCategory } from "../../src/application/contracts.ts";
import {
  FOOD_CATEGORY_LABELS,
  FOOD_INGREDIENTS,
  formatEventRange,
} from "../../src/application/event-format.ts";
import {
  ParentFieldErrorsContext,
  ParentMutationForm,
} from "../szulo/_components/ParentMutationForm.tsx";
import type { EventArea } from "./actor.ts";
import {
  addOfferAction,
  addSignupAction,
  cancelEventAction,
  changeOfferAction,
  changeSignupAction,
  removeRoleAction,
  saveEventAction,
  saveNoticesAction,
  saveRoleAction,
  saveTaleAction,
  withdrawOfferAction,
  withdrawSignupAction,
} from "./actions.ts";

type EventModel = EventDetailModel["event"];

/** The hidden fields every event form sends: the area it was opened in and a first key (the browser sends a fresh one). */
function Context({ area, keyName }: Readonly<{ area: EventArea; keyName: string }>) {
  return (
    <>
      <input type="hidden" name="area" value={area} />
      <input type="hidden" name="idempotencyKey" value={keyName} />
    </>
  );
}

function FieldError({ name, testId }: Readonly<{ name: string; testId: string }>) {
  const message = useContext(ParentFieldErrorsContext)[name];
  return message ? (
    <p id={`${name}-error`} className="parent-field-error" data-testid={`${testId}-error`}>
      {message}
    </p>
  ) : null;
}

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
  return (
    <div className="parent-field">
      <label htmlFor={id}>{label}</label>
      {hint && (
        <p id={`${id}-hint`} className="form-hint">
          {hint}
        </p>
      )}
      {children}
      <FieldError name={name} testId={testId} />
    </div>
  );
}

function TextInput(
  props: Readonly<{
    id: string;
    name: string;
    label: string;
    testId: string;
    type?: "text" | "date" | "datetime-local" | "number";
    defaultValue?: string;
    hint?: string;
    required?: boolean;
    maxLength?: number;
    min?: string | number;
    max?: string | number;
  }>,
) {
  const message = useContext(ParentFieldErrorsContext)[props.name];
  return (
    <Field
      id={props.id}
      name={props.name}
      label={props.label}
      testId={props.testId}
      hint={props.hint}
    >
      <input
        id={props.id}
        name={props.name}
        type={props.type ?? "text"}
        defaultValue={props.defaultValue}
        required={props.required}
        maxLength={props.maxLength}
        min={props.min}
        max={props.max}
        aria-invalid={message ? true : undefined}
        aria-describedby={
          [props.hint ? `${props.id}-hint` : undefined, message ? `${props.name}-error` : undefined]
            .filter(Boolean)
            .join(" ") || undefined
        }
        data-testid={props.testId}
      />
    </Field>
  );
}

function TextArea(
  props: Readonly<{
    id: string;
    name: string;
    label: string;
    testId: string;
    defaultValue?: string;
    hint?: string;
    maxLength?: number;
    rows?: number;
  }>,
) {
  const message = useContext(ParentFieldErrorsContext)[props.name];
  return (
    <Field
      id={props.id}
      name={props.name}
      label={props.label}
      testId={props.testId}
      hint={props.hint}
    >
      <textarea
        id={props.id}
        name={props.name}
        rows={props.rows ?? 4}
        defaultValue={props.defaultValue}
        maxLength={props.maxLength}
        aria-invalid={message ? true : undefined}
        aria-describedby={
          [props.hint ? `${props.id}-hint` : undefined, message ? `${props.name}-error` : undefined]
            .filter(Boolean)
            .join(" ") || undefined
        }
        data-testid={props.testId}
      />
    </Field>
  );
}

function CheckBox({
  id,
  name,
  label,
  testId,
  defaultChecked,
}: Readonly<{
  id: string;
  name: string;
  label: string;
  testId: string;
  defaultChecked?: boolean;
}>) {
  return (
    <label className="parent-event-check" htmlFor={id}>
      <input
        id={id}
        name={name}
        type="checkbox"
        defaultChecked={defaultChecked}
        data-testid={testId}
      />
      <span>{label}</span>
    </label>
  );
}

/* ---------- Sign-ups ---------- */

/** The time a sign-up may name lies inside the event (BR108.2); the field limits are the event's own hours. */
function chosenAtLimits(event: Pick<EventModel, "startsAt" | "endsAt">) {
  return { min: isoToBudapestLocal(event.startsAt), max: isoToBudapestLocal(event.endsAt) };
}

export function SignupAddForm({
  area,
  event,
}: Readonly<{ area: EventArea; event: Pick<EventModel, "id" | "startsAt" | "endsAt"> }>) {
  const limits = chosenAtLimits(event);
  return (
    <ParentMutationForm
      action={addSignupAction}
      submitLabel="Jelentkezem"
      testId="event-signup-form"
      freshIdempotencyKey
    >
      <Context area={area} keyName={`signup-add:${event.id}`} />
      <input type="hidden" name="eventId" value={event.id} />
      <TextInput
        id="signup-chosen-at"
        name="chosenAt"
        type="datetime-local"
        label="Tervezett érkezés (nem kötelező)"
        hint={`Az esemény időpontján belül add meg: ${formatEventRange(event.startsAt, event.endsAt)}`}
        min={limits.min}
        max={limits.max}
        testId="event-signup-time-input"
      />
      <TextArea
        id="signup-note"
        name="note"
        label="Megjegyzés (nem kötelező)"
        hint="Például mikor érkezel, vagy miben segítenél."
        maxLength={500}
        testId="event-signup-note-input"
      />
    </ParentMutationForm>
  );
}

export function SignupChangeForm({
  area,
  event,
  signup,
}: Readonly<{
  area: EventArea;
  event: Pick<EventModel, "id" | "startsAt" | "endsAt">;
  signup: EventSignupModel;
}>) {
  const limits = chosenAtLimits(event);
  return (
    <ParentMutationForm
      action={changeSignupAction}
      submitLabel="Módosítás"
      testId={`event-signup-change-${signup.id}`}
      freshIdempotencyKey
    >
      <Context area={area} keyName={`signup-change:${signup.id}:v${signup.version}`} />
      <input type="hidden" name="eventId" value={event.id} />
      <input type="hidden" name="signupId" value={signup.id} />
      <input type="hidden" name="expectedVersion" value={signup.version} />
      <TextInput
        id={`signup-chosen-at-${signup.id}`}
        name="chosenAt"
        type="datetime-local"
        label="Tervezett érkezés"
        defaultValue={isoToBudapestLocal(signup.chosenAt)}
        min={limits.min}
        max={limits.max}
        testId={`event-signup-change-time-${signup.id}`}
      />
      <TextArea
        id={`signup-note-${signup.id}`}
        name="note"
        label="Megjegyzés"
        defaultValue={signup.note}
        maxLength={500}
        testId={`event-signup-change-note-${signup.id}`}
      />
    </ParentMutationForm>
  );
}

export function WithdrawSignupForm({
  area,
  eventId,
  groupId,
  signup,
  asManager,
}: Readonly<{
  area: EventArea;
  eventId: string;
  groupId?: string;
  signup: EventSignupModel;
  asManager: boolean;
}>) {
  return (
    <ParentMutationForm
      action={withdrawSignupAction}
      submitLabel={asManager ? "Jelentkezés törlése" : "Visszavonom"}
      submitAriaLabel={`${asManager ? "Jelentkezés törlése" : "Jelentkezés visszavonása"}: ${signup.parentDisplayName}`}
      testId={`event-signup-withdraw-${signup.id}`}
      freshIdempotencyKey
    >
      <Context area={area} keyName={`signup-withdraw:${signup.id}:v${signup.version}`} />
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="signupId" value={signup.id} />
      <input type="hidden" name="expectedVersion" value={signup.version} />
      {asManager && <input type="hidden" name="asManager" value="1" />}
      {groupId && <input type="hidden" name="groupId" value={groupId} />}
    </ParentMutationForm>
  );
}

/* ---------- Food offers ---------- */

export function OfferAddForm({ area, eventId }: Readonly<{ area: EventArea; eventId: string }>) {
  return (
    <ParentMutationForm
      action={addOfferAction}
      submitLabel="Felajánlom"
      testId="event-offer-form"
      freshIdempotencyKey
    >
      <Context area={area} keyName={`offer-add:${eventId}`} />
      <input type="hidden" name="eventId" value={eventId} />
      <Field id="offer-category" name="category" label="Kategória" testId="event-offer-category">
        <select
          id="offer-category"
          name="category"
          defaultValue=""
          required
          data-testid="event-offer-category-select"
        >
          <option value="" disabled>
            Válassz kategóriát
          </option>
          {FOOD_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {FOOD_CATEGORY_LABELS[category]}
            </option>
          ))}
        </select>
      </Field>
      <TextInput
        id="offer-text"
        name="text"
        label="Felajánlott étel vagy ital megnevezése"
        maxLength={200}
        required
        testId="event-offer-text-input"
      />
      <fieldset className="parent-event-ingredients">
        <legend>Allergének: ezt tartalmazza</legend>
        {FOOD_INGREDIENTS.map((item) => (
          <CheckBox
            key={item.field}
            id={`offer-${item.field}`}
            name={item.field}
            label={item.label}
            testId={`event-offer-${item.field}`}
          />
        ))}
      </fieldset>
    </ParentMutationForm>
  );
}

/** Changes one of the parent's own offers: the same fields as the add form, filled from the offer and its version. */
export function OfferChangeForm({
  area,
  eventId,
  category,
  offer,
}: Readonly<{
  area: EventArea;
  eventId: string;
  category: FoodCategory;
  offer: FoodOfferModel;
}>) {
  const id = offer.id;
  return (
    <ParentMutationForm
      action={changeOfferAction}
      submitLabel="Módosítás mentése"
      testId={`event-offer-change-${id}`}
      freshIdempotencyKey
    >
      <Context area={area} keyName={`offer-change:${id}:v${offer.version}`} />
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="offerId" value={id} />
      <input type="hidden" name="expectedVersion" value={offer.version} />
      <Field
        id={`offer-category-${id}`}
        name="category"
        label="Kategória"
        testId={`event-offer-change-category-${id}`}
      >
        <select
          id={`offer-category-${id}`}
          name="category"
          defaultValue={category}
          required
          data-testid={`event-offer-change-category-select-${id}`}
        >
          {FOOD_CATEGORIES.map((entry) => (
            <option key={entry} value={entry}>
              {FOOD_CATEGORY_LABELS[entry]}
            </option>
          ))}
        </select>
      </Field>
      <TextInput
        id={`offer-text-${id}`}
        name="text"
        label="Felajánlott étel vagy ital megnevezése"
        defaultValue={offer.text}
        maxLength={200}
        required
        testId={`event-offer-change-text-${id}`}
      />
      <fieldset className="parent-event-ingredients">
        <legend>Allergének: ezt tartalmazza</legend>
        {FOOD_INGREDIENTS.map((item) => (
          <CheckBox
            key={item.field}
            id={`offer-${item.field}-${id}`}
            name={item.field}
            label={item.label}
            defaultChecked={offer[item.field]}
            testId={`event-offer-change-${item.field}-${id}`}
          />
        ))}
      </fieldset>
    </ParentMutationForm>
  );
}

export function WithdrawOfferForm({
  area,
  eventId,
  groupId,
  offer,
  asManager,
}: Readonly<{
  area: EventArea;
  eventId: string;
  groupId?: string;
  offer: FoodOfferModel;
  asManager: boolean;
}>) {
  return (
    <ParentMutationForm
      action={withdrawOfferAction}
      submitLabel={asManager ? "Felajánlás törlése" : "Visszavonom"}
      submitAriaLabel={`${asManager ? "Felajánlás törlése" : "Felajánlás visszavonása"}: ${offer.text}`}
      testId={`event-offer-withdraw-${offer.id}`}
      freshIdempotencyKey
    >
      <Context area={area} keyName={`offer-withdraw:${offer.id}:v${offer.version}`} />
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="offerId" value={offer.id} />
      <input type="hidden" name="expectedVersion" value={offer.version} />
      {asManager && <input type="hidden" name="asManager" value="1" />}
      {groupId && <input type="hidden" name="groupId" value={groupId} />}
    </ParentMutationForm>
  );
}

/* ---------- Manager forms ---------- */

export type GroupOption = Readonly<{ value: string; label: string }>;

/** The event's own fields: title, group, times, place and the settings the event page needs (BR100 to BR102). */
export function EventCoreForm({
  area,
  event,
  groups,
}: Readonly<{
  area: EventArea;
  event?: EventModel;
  groups: readonly GroupOption[];
}>) {
  const creating = event === undefined;
  return (
    <ParentMutationForm
      action={saveEventAction}
      submitLabel={creating ? "Esemény létrehozása" : "Alapadatok mentése"}
      testId="event-core-form"
      freshIdempotencyKey
    >
      <Context area={area} keyName={creating ? "event-create" : `event-save:${event.id}`} />
      <input type="hidden" name="extended" value="1" />
      <input type="hidden" name="id" value={creating ? "new" : event.id} />
      <input type="hidden" name="expectedVersion" value={creating ? 1 : event.version} />
      {event?.groupId && <input type="hidden" name="currentGroupId" value={event.groupId} />}
      <TextInput
        id="event-title"
        name="title"
        label="Az esemény címe"
        defaultValue={event?.title}
        maxLength={200}
        required
        testId="event-title-input"
      />
      <Field
        id="event-group"
        name="groupId"
        label="Felelős munkacsoport"
        testId="event-group"
        hint={creating ? undefined : "Ha az eseménynek már van feladata, a csoport nem váltható."}
      >
        <select
          id="event-group"
          name="groupId"
          defaultValue={event ? (event.groupId ?? "community") : (groups[0]?.value ?? "")}
          required
          data-testid="event-group-select"
        >
          {creating && groups.length > 1 && <option value="">Válassz munkacsoportot</option>}
          {groups.map((group) => (
            <option key={group.value} value={group.value}>
              {group.label}
            </option>
          ))}
          {!creating && !groups.some((group) => group.value === (event.groupId ?? "community")) && (
            <option value={event.groupId ?? "community"}>
              {event.groupName ?? "Közösségi esemény"}
            </option>
          )}
        </select>
      </Field>
      <div className="parent-event-form-row">
        <TextInput
          id="event-starts-at"
          name="startsAt"
          type="datetime-local"
          label="Kezdés (budapesti idő)"
          defaultValue={isoToBudapestLocal(event?.startsAt)}
          required
          testId="event-starts-at-input"
        />
        <TextInput
          id="event-ends-at"
          name="endsAt"
          type="datetime-local"
          label="Befejezés (budapesti idő)"
          defaultValue={isoToBudapestLocal(event?.endsAt)}
          required
          testId="event-ends-at-input"
        />
      </div>
      <TextInput
        id="event-location"
        name="location"
        label="Helyszín"
        defaultValue={event?.location}
        maxLength={200}
        testId="event-location-input"
      />
      <div className="parent-event-form-row">
        <TextInput
          id="event-deadline"
          name="signupDeadline"
          type="date"
          label="Jelentkezési határidő (nem kötelező)"
          defaultValue={event?.signupDeadline}
          testId="event-deadline-input"
        />
        <TextInput
          id="event-notice-lead"
          name="noticeLeadDays"
          type="number"
          min={1}
          max={60}
          label="Értesítés ennyi nappal előtte (nem kötelező)"
          defaultValue={
            event?.noticeLeadDays === undefined ? undefined : String(event.noticeLeadDays)
          }
          hint="1 és 60 nap között."
          testId="event-notice-lead-input"
        />
      </div>
      <CheckBox
        id="event-food-on"
        name="foodSignupOn"
        label="Ételfelajánlás engedélyezése"
        defaultChecked={event?.foodSignupOn}
        testId="event-food-on-input"
      />
      <CheckBox
        id="event-summer"
        name="isSummer"
        label="Nyári esemény"
        defaultChecked={event?.isSummer}
        testId="event-summer-input"
      />
    </ParentMutationForm>
  );
}

export function NoticesForm({
  area,
  event,
  notices,
}: Readonly<{ area: EventArea; event: EventModel; notices: readonly string[] }>) {
  return (
    <ParentMutationForm
      action={saveNoticesAction}
      submitLabel="Tudnivalók mentése"
      testId="event-notices-form"
      freshIdempotencyKey
    >
      <Context area={area} keyName={`event-notices:${event.id}:v${event.version}`} />
      <input type="hidden" name="eventId" value={event.id} />
      <input type="hidden" name="expectedVersion" value={event.version} />
      {event.groupId && <input type="hidden" name="groupId" value={event.groupId} />}
      <TextArea
        id="event-notices"
        name="notices"
        label="Tudnivalók és házirend"
        hint="Soronként egy tudnivaló, legfeljebb 10 sor, soronként legfeljebb 300 karakter."
        defaultValue={notices.join("\n")}
        rows={6}
        testId="event-notices-input"
      />
    </ParentMutationForm>
  );
}

export function TaleForm({ area, event }: Readonly<{ area: EventArea; event: EventModel }>) {
  return (
    <ParentMutationForm
      action={saveTaleAction}
      submitLabel="Az év meséjének mentése"
      testId="event-tale-form"
      freshIdempotencyKey
    >
      <Context area={area} keyName={`event-tale:${event.id}:v${event.version}`} />
      <input type="hidden" name="eventId" value={event.id} />
      <input type="hidden" name="expectedVersion" value={event.version} />
      {event.groupId && <input type="hidden" name="groupId" value={event.groupId} />}
      <TextArea
        id="event-tale"
        name="tale"
        label="Mese szövege vagy ajánló idézet"
        defaultValue={event.tale}
        rows={6}
        testId="event-tale-input"
      />
    </ParentMutationForm>
  );
}

export type ParentOption = Readonly<{ id: string; name: string }>;

/** One role: its name, who holds it (a parent of the community or a typed name) and the organiser mark (BR105, BR106). */
export function RoleForm({
  area,
  event,
  role,
  parents,
}: Readonly<{
  area: EventArea;
  event: EventModel;
  role?: EventRoleModel;
  parents: readonly ParentOption[];
}>) {
  const suffix = role?.id ?? "new";
  return (
    <ParentMutationForm
      action={saveRoleAction}
      submitLabel={role ? "Szerep mentése" : "Szerep hozzáadása"}
      testId={`event-role-form-${suffix}`}
      freshIdempotencyKey
    >
      <Context
        area={area}
        keyName={role ? `event-role:${role.id}:v${role.version}` : `event-role-add:${event.id}`}
      />
      <input type="hidden" name="eventId" value={event.id} />
      {role && <input type="hidden" name="roleId" value={role.id} />}
      {role && <input type="hidden" name="expectedVersion" value={role.version} />}
      {event.groupId && <input type="hidden" name="groupId" value={event.groupId} />}
      <TextInput
        id={`role-name-${suffix}`}
        name="name"
        label="Szerepkör megnevezése"
        defaultValue={role?.name}
        maxLength={100}
        required
        testId={`event-role-name-${suffix}`}
      />
      <Field
        id={`role-parent-${suffix}`}
        name="parentId"
        label="Felelős szülő"
        testId={`event-role-parent-${suffix}`}
        hint="Válassz szülőt, vagy írd be a nevet lent. Pontosan az egyiket add meg."
      >
        <select
          id={`role-parent-${suffix}`}
          name="parentId"
          defaultValue={role?.parentId ?? ""}
          data-testid={`event-role-parent-select-${suffix}`}
        >
          <option value="">Nincs kiválasztva</option>
          {parents.map((parent) => (
            <option key={parent.id} value={parent.id}>
              {parent.name}
            </option>
          ))}
        </select>
      </Field>
      <TextInput
        id={`role-person-${suffix}`}
        name="personName"
        label="Vagy a felelős neve"
        defaultValue={role?.kind === "typed" ? role.displayName : undefined}
        maxLength={200}
        testId={`event-role-person-${suffix}`}
      />
      <CheckBox
        id={`role-organiser-${suffix}`}
        name="isOrganiser"
        label="Főszervező (csak szülő lehet)"
        defaultChecked={role?.isOrganiser}
        testId={`event-role-organiser-${suffix}`}
      />
    </ParentMutationForm>
  );
}

export function RemoveRoleForm({
  area,
  event,
  role,
}: Readonly<{ area: EventArea; event: EventModel; role: EventRoleModel }>) {
  return (
    <ParentMutationForm
      action={removeRoleAction}
      submitLabel="Szerep törlése"
      testId={`event-role-remove-${role.id}`}
      freshIdempotencyKey
    >
      <Context area={area} keyName={`event-role-remove:${role.id}:v${role.version}`} />
      <input type="hidden" name="eventId" value={event.id} />
      <input type="hidden" name="roleId" value={role.id} />
      <input type="hidden" name="expectedVersion" value={role.version} />
      {event.groupId && <input type="hidden" name="groupId" value={event.groupId} />}
    </ParentMutationForm>
  );
}

/** Cancelling asks first, on the same page: the families are told and the event's open tasks are closed (BR118). */
export function CancelEventPanel({
  area,
  event,
}: Readonly<{ area: EventArea; event: Pick<EventModel, "id" | "version" | "groupId"> }>) {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <button
        type="button"
        className="parent-event-secondary-button"
        onClick={() => setConfirming(true)}
        data-testid="event-cancel-button"
      >
        Esemény lemondása
      </button>
    );
  }
  return (
    <section aria-label="Lemondás megerősítése" data-testid="event-cancel-confirm">
      <p className="parent-event-question">
        Biztosan lemondod az eseményt? A családok értesítést kapnak, az esemény nyitott feladatai
        lezárulnak.
      </p>
      <ParentMutationForm
        action={cancelEventAction}
        submitLabel="Igen, lemondom"
        testId="event-cancel-form"
        freshIdempotencyKey
      >
        <Context area={area} keyName={`event-cancel:${event.id}:v${event.version}`} />
        <input type="hidden" name="eventId" value={event.id} />
        <input type="hidden" name="expectedVersion" value={event.version} />
        {event.groupId && <input type="hidden" name="groupId" value={event.groupId} />}
        <button
          type="button"
          className="parent-event-secondary-button"
          onClick={() => setConfirming(false)}
          data-testid="event-cancel-abort"
        >
          Mégsem
        </button>
      </ParentMutationForm>
    </section>
  );
}

/** The switch of the list: a native checkbox that reloads the list with or without the finished events (BR104.2). */
export function PastEventsToggle({
  action,
  checked,
}: Readonly<{ action: string; checked: boolean }>) {
  return (
    <form
      method="get"
      action={action}
      className="parent-event-toggle"
      data-testid="event-past-form"
    >
      <label htmlFor="event-past">
        <input
          id="event-past"
          type="checkbox"
          name="korabbi"
          value="1"
          defaultChecked={checked}
          onChange={(change) => change.currentTarget.form?.requestSubmit()}
          data-testid="event-past-toggle"
        />
        <span>Korábbi események is</span>
      </label>
      <noscript>
        <button type="submit">Lista frissítése</button>
      </noscript>
    </form>
  );
}
