import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { TodoCard, TodoHistoryEntry } from "./contracts.ts";
import {
  deadlineText,
  eventLinkText,
  historyLine,
  notBeforeText,
  priorityText,
  todoNotes,
  todoState,
} from "./todo-format.ts";

const base = {
  isDone: false,
  needsAttention: false,
  ownerKind: "working_group",
  claimantDisplayName: undefined,
  status: "open",
} satisfies Pick<
  TodoCard,
  "isDone" | "needsAttention" | "ownerKind" | "claimantDisplayName" | "status"
>;

describe("the state of a task card", () => {
  it("is free, claimed, done or flagged, each with its own icon and word", () => {
    assert.deepEqual(todoState(base), { key: "free", label: "Szabad", icon: "ring" });
    assert.deepEqual(todoState({ ...base, claimantDisplayName: "Réka" }), {
      key: "claimed",
      label: "Vállalta: Réka",
      icon: "dot",
    });
    assert.deepEqual(todoState({ ...base, isDone: true, claimantDisplayName: "Réka" }), {
      key: "done",
      label: "Kész",
      icon: "check",
    });
  });

  it("names a removed family or a removed member when the task needs attention", () => {
    assert.equal(
      todoState({ ...base, needsAttention: true, ownerKind: "family" }).label,
      "Figyelem: korábbi család",
    );
    assert.equal(todoState({ ...base, needsAttention: true }).label, "Figyelem: korábbi tag");
    assert.equal(todoState({ ...base, needsAttention: true }).icon, "warning");
  });
});

describe("the lines under a task", () => {
  it("writes deadline, not-before and priority, or nothing", () => {
    assert.equal(deadlineText("2026-12-12"), "Határidő: 2026. december 12.");
    assert.equal(deadlineText(undefined), "");
    assert.equal(notBeforeText("2026-12-01"), "Nem előbb: 2026. december 1.");
    assert.equal(notBeforeText(undefined), "");
    assert.equal(priorityText(2), "2. prioritás");
    assert.equal(priorityText(undefined), "");
  });

  it("adds started, postponed, overdue and not-yet notes, and none for a done task", () => {
    const flags = { status: "open", isOverdue: false, isNotYet: false, isDone: false } as const;
    assert.deepEqual(todoNotes(flags), []);
    assert.deepEqual(todoNotes({ ...flags, status: "in_progress", isOverdue: true }), [
      "Folyamatban",
      "Lejárt",
    ]);
    assert.deepEqual(todoNotes({ ...flags, status: "postponed", isNotYet: true }), [
      "Elhalasztva",
      "Még nem kezdődik",
    ]);
    assert.deepEqual(todoNotes({ ...flags, status: "done", isDone: true }), []);
  });
});

describe("the history of a task", () => {
  const now = new Date("2026-11-25T12:00:00Z");
  const entry = (patch: Partial<TodoHistoryEntry>): TodoHistoryEntry => ({
    change: "created",
    actor: "Réka",
    at: "2026-11-25T08:12:00Z",
    ...patch,
  });

  it("writes the change, who did it and when", () => {
    assert.equal(historyLine(entry({}), now), "Létrehozva • Réka • ma 09:12");
  });

  it("adds the two statuses of a status change and the event of a pull", () => {
    assert.equal(
      historyLine(
        entry({ change: "status_changed", fromStatus: "open", toStatus: "postponed" }),
        now,
      ),
      "Állapot módosítva: Nyitott → Elhalasztva • Réka • ma 09:12",
    );
    assert.match(
      historyLine(entry({ change: "pulled_to_event", eventTitle: "Tavaszi vásár" }), now),
      /^Felvéve az eseményre: Tavaszi vásár • Réka/,
    );
  });

  it("falls back to the stored word for a change it does not know and omits an unreadable time", () => {
    assert.equal(historyLine(entry({ change: "other", at: "nem idő" }), now), "other • Réka");
  });
});

describe("the link from a task to an event", () => {
  const link = { eventId: "e1", pulledAt: "2026-11-25T08:00:00Z", eventClosed: false };
  it("says whether the task is on the list, done there or gone", () => {
    assert.equal(
      eventLinkText({ ...link, state: "on_list", eventTitle: "Vásár" }),
      "Felvéve az eseményre: Vásár",
    );
    assert.match(
      eventLinkText({ ...link, state: "done_on_event", eventTitle: "Vásár" }),
      /kész\.$/,
    );
    assert.match(
      eventLinkText({ ...link, state: "gone" }),
      /Már nincs az esemény feladatlistáján\.$/,
    );
  });
});
