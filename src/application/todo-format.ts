import type { TodoCard, TodoDetailModel, TodoHistoryEntry, TodoStatus } from "./contracts.ts";
import { formatMoment } from "./recurring-format.ts";
import { formatLongDay } from "./rota-format.ts";
import type { StatusIconKey } from "./status-labels.ts";

/**
 * The words of the to-do screens (U12). The status of a card is read from the card (done, flagged, claimed or free);
 * "overdue" and "not yet" come from the dates the database already compared, so nothing here reads the clock.
 */

/** The four stored statuses as a person reads them in the form and on the task page. */
export const TODO_STATUS_LABELS: Readonly<Record<TodoStatus, string>> = Object.freeze({
  open: "Nyitott",
  in_progress: "Folyamatban",
  done: "Kész",
  postponed: "Elhalasztva",
});

/** The statuses a form offers: done has its own button. */
export const TODO_FORM_STATUSES = ["open", "in_progress", "postponed"] as const;

export type TodoStateKey = "free" | "claimed" | "done" | "attention";

export type TodoState = Readonly<{ key: TodoStateKey; label: string; icon: StatusIconKey }>;

/** Free, claimed (with who), done, or flagged for an administrator after a family or a person left (BR190.1). */
export function todoState(
  card: Pick<
    TodoCard,
    "isDone" | "needsAttention" | "ownerKind" | "claimantDisplayName" | "status"
  >,
): TodoState {
  if (card.isDone) return { key: "done", label: "Kész", icon: "check" };
  if (card.needsAttention) {
    return {
      key: "attention",
      label: card.ownerKind === "family" ? "Figyelem: korábbi család" : "Figyelem: korábbi tag",
      icon: "warning",
    };
  }
  if (card.claimantDisplayName !== undefined) {
    return { key: "claimed", label: `Vállalta: ${card.claimantDisplayName}`, icon: "dot" };
  }
  return { key: "free", label: "Szabad", icon: "ring" };
}

/** "Határidő: 2026. december 12." or nothing. */
export function deadlineText(deadline: string | undefined): string {
  return deadline ? `Határidő: ${formatLongDay(deadline)}` : "";
}

/** "Nem előbb: 2026. december 12." or nothing. */
export function notBeforeText(notBefore: string | undefined): string {
  return notBefore ? `Nem előbb: ${formatLongDay(notBefore)}` : "";
}

/** The second line of a card: status words that are not the state (started, postponed), overdue and not yet. */
export function todoNotes(
  card: Pick<TodoCard, "status" | "isOverdue" | "isNotYet" | "isDone">,
): readonly string[] {
  const notes: string[] = [];
  if (!card.isDone && card.status === "in_progress") notes.push(TODO_STATUS_LABELS.in_progress);
  if (!card.isDone && card.status === "postponed") notes.push(TODO_STATUS_LABELS.postponed);
  if (card.isOverdue) notes.push("Lejárt");
  if (card.isNotYet) notes.push("Még nem kezdődik");
  return notes;
}

/** The priority as the form and the card show it. */
export function priorityText(priority: number | undefined): string {
  return priority === undefined ? "" : `${priority}. prioritás`;
}

const HISTORY_WORDS: Readonly<Record<string, string>> = Object.freeze({
  created: "Létrehozva",
  edited: "Szerkesztve",
  claimed: "Vállalva",
  claim_given_back: "Visszaadva",
  claim_freed: "Felszabadítva",
  status_changed: "Állapot módosítva",
  marked_done: "Késznek jelölve",
  done_undone: "Mégsem kész",
  pulled_to_event: "Felvéve az eseményre",
  claimant_removed: "A vállaló már nem tag",
  migrated: "Átvéve a régi listából",
});

/** One history row as a line: the change, with the event or the two statuses where there are some, who and when. */
export function historyLine(entry: TodoHistoryEntry, now: Date = new Date()): string {
  const base = HISTORY_WORDS[entry.change] ?? entry.change;
  const detail =
    entry.change === "pulled_to_event" && entry.eventTitle
      ? `: ${entry.eventTitle}`
      : entry.fromStatus && entry.toStatus
        ? `: ${TODO_STATUS_LABELS[entry.fromStatus]} → ${TODO_STATUS_LABELS[entry.toStatus]}`
        : "";
  const when = formatMoment(entry.at, now);
  return `${base}${detail} • ${entry.actor}${when ? ` • ${when}` : ""}`;
}

/** What the page says of a link to an event: on its list, finished there, or no longer on it. */
export function eventLinkText(link: TodoDetailModel["eventLinks"][number]): string {
  const title = link.eventTitle ?? "az esemény";
  if (link.state === "gone")
    return `Felvéve az eseményre: ${title}. Már nincs az esemény feladatlistáján.`;
  if (link.state === "done_on_event") return `Felvéve az eseményre: ${title}. Az eseményen kész.`;
  return `Felvéve az eseményre: ${title}`;
}
