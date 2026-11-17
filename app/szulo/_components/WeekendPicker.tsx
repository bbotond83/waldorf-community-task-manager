import type {
  RotaDutyCardModel,
  WeekendOwnPickModel,
  WeekendSlot,
} from "../../../src/application/index.ts";
import {
  PICK_STATE_TEXT,
  WEEKEND_PICKER_TEXT,
  WEEKEND_SLOT_LABELS,
} from "../../../src/application/rota-format.ts";
import { pickSlotAction } from "../actions.ts";
import { ParentMutationForm } from "./ParentMutationForm.tsx";

type Option = Readonly<{ slot: WeekendSlot; version: number }>;

/**
 * The options of the picker: the openings and closings still free, and the family's own current pick (it is held by
 * the family and so is not free, but the family may change it until Friday noon). The place version of each option is
 * sent with the choice, the version that was on screen (BR63.4).
 */
function options(card: RotaDutyCardModel, own: WeekendOwnPickModel): readonly Option[] {
  const list: Option[] = own.freeSlots.map((free) => ({
    slot: free.slot,
    version: free.placeVersion,
  }));
  if (own.slot && !list.some((option) => option.slot === own.slot)) {
    const held = card.weekend?.slots.find((slot) => slot.slot === own.slot);
    if (held) list.push({ slot: own.slot, version: held.placeVersion });
  }
  return list;
}

/** The weekend picker of a duty card: a fieldset of native radio buttons and one save button. */
export function WeekendPicker({
  card,
  own,
}: Readonly<{ card: RotaDutyCardModel; own: WeekendOwnPickModel }>) {
  const choices = options(card, own);
  if (choices.length === 0) {
    return (
      <p className="parent-notice" data-testid="rota-picker-state">
        {PICK_STATE_TEXT.open} {WEEKEND_PICKER_TEXT.taken}.
      </p>
    );
  }
  return (
    <ParentMutationForm
      action={pickSlotAction}
      submitLabel={WEEKEND_PICKER_TEXT.submit}
      testId="weekend-pick-form"
      freshIdempotencyKey
    >
      <input type="hidden" name="rotaWeekId" value={own.rotaWeekId} />
      <input type="hidden" name="idempotencyKey" value={`pick:${own.rotaWeekId}:v1`} />
      <fieldset className="parent-rota-picker-fields" data-testid="weekend-pick-fieldset">
        <legend>{WEEKEND_PICKER_TEXT.legend}</legend>
        {own.state === "picked" && own.slot && (
          <p className="form-hint" data-testid="weekend-pick-current">
            {PICK_STATE_TEXT.picked} {WEEKEND_SLOT_LABELS[own.slot]}.
          </p>
        )}
        {choices.map((choice) => (
          <label key={choice.slot} className="parent-rota-pick-option">
            <input
              type="radio"
              name="slot"
              value={`${choice.slot}:${choice.version}`}
              defaultChecked={choice.slot === own.slot}
              data-testid={`weekend-pick-${choice.slot}`}
            />
            <span>{WEEKEND_SLOT_LABELS[choice.slot]}</span>
          </label>
        ))}
      </fieldset>
    </ParentMutationForm>
  );
}
