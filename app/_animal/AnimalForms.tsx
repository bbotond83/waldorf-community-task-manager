"use client";

import type { AnimalCalendarModel, AnimalSlotItem } from "../../src/application/index.ts";
import { ParentMutationForm } from "../szulo/_components/ParentMutationForm.tsx";
import {
  animalSignUpAction,
  createSlotsAction,
  giveUpAction,
  saveCalendarAction,
} from "./actions.ts";

/** One slot's name for assistive technology: "<day> reggeli" so each button says which row it acts on. */
export function slotLabel(slot: AnimalSlotItem, dayText: string): string {
  return `${dayText} ${slot.part === "morning" ? "reggeli" : "délutáni"} időpont`;
}

export function SignUpForm({
  slot,
  dayText,
  anchor,
}: Readonly<{ slot: AnimalSlotItem; dayText: string; anchor: string }>) {
  return (
    <ParentMutationForm
      action={animalSignUpAction}
      submitLabel="Elvállalom"
      submitAriaLabel={`Elvállalom: ${slotLabel(slot, dayText)}`}
      testId={`animal-signup-${slot.slotDate}-${slot.part}`}
    >
      <input type="hidden" name="id" value={slot.dutyId} />
      <input type="hidden" name="expectedVersion" value={slot.dutyVersion} />
      <input type="hidden" name="anchor" value={anchor} />
      <input
        type="hidden"
        name="idempotencyKey"
        value={`animal-signup:${slot.dutyId}:v${slot.dutyVersion}`}
      />
    </ParentMutationForm>
  );
}

/** Giving a slot up asks first: the form sits inside a disclosure whose text says what will happen. */
export function GiveUpForm({
  slot,
  dayText,
  anchor,
}: Readonly<{ slot: AnimalSlotItem; dayText: string; anchor: string }>) {
  if (!slot.placeId || slot.placeVersion === undefined) return null;
  return (
    <details className="parent-confirm" data-testid={`animal-giveup-${slot.slotDate}-${slot.part}`}>
      <summary aria-label={`Lemondás: ${slotLabel(slot, dayText)}`}>Lemondás</summary>
      <p>Biztosan lemondod ezt az időpontot? Utána más család elvállalhatja.</p>
      <ParentMutationForm
        action={giveUpAction}
        submitLabel="Igen, lemondom"
        submitAriaLabel={`Igen, lemondom: ${slotLabel(slot, dayText)}`}
        testId={`animal-giveup-form-${slot.slotDate}-${slot.part}`}
      >
        <input type="hidden" name="placeId" value={slot.placeId} />
        <input type="hidden" name="expectedVersion" value={slot.placeVersion} />
        <input type="hidden" name="anchor" value={anchor} />
        <input
          type="hidden"
          name="idempotencyKey"
          value={`animal-giveup:${slot.placeId}:v${slot.placeVersion}`}
        />
      </ParentMutationForm>
    </details>
  );
}

/** The settings of a school year: two start times and the group alerted about the slots (BR80.1). */
export function CalendarForm({ calendar }: Readonly<{ calendar: AnimalCalendarModel }>) {
  return (
    <ParentMutationForm
      action={saveCalendarAction}
      submitLabel="Mentés"
      testId="animal-calendar-form"
      freshIdempotencyKey
    >
      <input type="hidden" name="schoolYearId" value={calendar.schoolYearId} />
      <input type="hidden" name="expectedVersion" value={calendar.version} />
      <input
        type="hidden"
        name="idempotencyKey"
        value={`animal-calendar:${calendar.schoolYearId}:v${calendar.version}`}
      />
      <div className="parent-field">
        <label htmlFor="animal-morning">Reggeli kezdés</label>
        <input
          id="animal-morning"
          name="morningStart"
          type="time"
          defaultValue={calendar.morningStart}
          required
          data-testid="animal-morning"
        />
      </div>
      <div className="parent-field">
        <label htmlFor="animal-afternoon">Délutáni kezdés</label>
        <input
          id="animal-afternoon"
          name="afternoonStart"
          type="time"
          defaultValue={calendar.afternoonStart}
          required
          data-testid="animal-afternoon"
        />
      </div>
      <div className="parent-field">
        <label htmlFor="animal-group">Értesített csoport</label>
        <select
          id="animal-group"
          name="careGroupId"
          defaultValue={calendar.careGroupId ?? ""}
          data-testid="animal-group"
        >
          <option value="">Nincs</option>
          {calendar.groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </select>
      </div>
    </ParentMutationForm>
  );
}

export function CreateSlotsForm({ calendar }: Readonly<{ calendar: AnimalCalendarModel }>) {
  return (
    <ParentMutationForm
      action={createSlotsAction}
      submitLabel="Időpontok létrehozása"
      testId="animal-create-slots-form"
      freshIdempotencyKey
    >
      <input type="hidden" name="schoolYearId" value={calendar.schoolYearId} />
      <input type="hidden" name="idempotencyKey" value={`animal-slots:${calendar.schoolYearId}`} />
    </ParentMutationForm>
  );
}
