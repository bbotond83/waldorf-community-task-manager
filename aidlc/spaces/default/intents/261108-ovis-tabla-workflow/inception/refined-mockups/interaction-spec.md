# Interaction Specification

How the screens in `mockups.md` behave. Rules come from `stories.md` and `requirements.md`; delivery rules from `team-practices.md`.

## Shared Behaviour

| Situation | Behaviour |
|---|---|
| Loading | The existing server-rendered page; a sending button turns Muted Brown with a busy cursor |
| Empty | A sentence saying why and the next action |
| Error | A Danger Wash panel with `role="alert"` saying what happened and what to do |
| Refused by a rule | A notice in Hungarian naming the rule, with the form kept |
| Out-of-date page | "Az oldal közben megváltozott", then a reload; nothing is overwritten |
| Repeated click | The result of the first click is shown; no duplicate |
| Destructive action | A confirmation naming what is affected |

## Key Components

### Slot Row

| Field | Value |
|---|---|
| Component | SlotRow |
| Description | One morning or afternoon animal-care slot |
| Category | input |

| State | Description | Trigger |
|---|---|---|
| default | Empty slot with Elvállalom | page load |
| taken | Family name, no button | another family holds it |
| mine | Family name with a "Ti" tag and Lemondás, which gives up the slot at once until 24 hours before it (Q5); the slot becomes empty and the family's count drops. Later, only Csere is offered | my family holds it |
| disabled | Button off, with the reason | the changeover rule applies |
| error | Inline notice "Már foglalt" | someone took it first |

Responsive: one row on every width. Accessibility: a native button named with the day and time, for example "Elvállalom: hétfő reggel"; a result is announced through a status region; focus stays on the row.

### Weekend Pick

| Field | Value |
|---|---|
| Component | WeekendPick |
| Description | Pick one opening or closing |
| Category | input |

| State | Description | Trigger |
|---|---|---|
| default | Four radio rows, the free ones enabled | a picking family opens the duty |
| taken | Row disabled, labelled with the family | another family picked it |
| saved | A confirmation with the chosen slot | saved |
| conflict | A notice to pick again, list refreshed | two families picked at once |

Accessibility: a fieldset with a legend; native radios; disabled rows carry their reason as text.

### Status Pill

Reuses the existing pill with an icon and a word. New words: Üres, Kész, Folyamatban, Elhalasztva, Szünet.

### Checklist Task

| State | Description | Trigger |
|---|---|---|
| open | Elvállalom | no claim |
| claimed | Name shown; for the claimer, Kész | claimed |
| done | Name and time, a check icon and the word Kész | marked done |

Tips open in place under the task. Summer-only tasks carry a "Nyáron" tag.

### Sharing Tick Box

A native checkbox with a plain explanation beside it listing what others will see. Saves with the form; the result is confirmed in a status message.

## Flows

**Flow: swap a duty.** Persona: parent. Trigger: "Csere" on a duty. Steps: choose a duty, write the reason, send; the other family accepts or declines in the inbox. Success: the duty moves in both families' lists and both are notified. Error paths: rule break, disabled with the reason; declined, withdrawn or expired, a notice; a change meanwhile, the acceptance is refused.

**Flow: publish a rota.** Persona: administrator. Trigger: opening rota planning. Steps: make a draft, adjust the cells, publish, confirm. Success: parents see the rota and families are notified. Error paths: a rule break, the change is not saved; unfilled weeks stay listed with the reason.

**Flow: take an animal-care slot.** Persona: parent. Trigger: an empty slot or a warning message link. Steps: tap Elvállalom. Success: the row shows my family and the count rises.

**Flow: run a big cleaning.** Persona: coordinator. Trigger: Új esemény from a template. Steps: pick the template, set the dates and the deadline, tick "summer" if it applies, publish; parents claim and finish tasks. Success: everything is done and the closing round is shown as ready.

## Responsive Behaviour

Mobile-first. Existing breakpoints stay: 36rem for pill placement, 44rem for table-to-card. The bottom bar shows below 44rem, and the top navigation panel above it. Page content leaves room for the bar.
