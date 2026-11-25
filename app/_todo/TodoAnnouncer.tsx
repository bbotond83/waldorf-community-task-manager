"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { ParentAction } from "../szulo/_components/ParentMutationForm.tsx";

/**
 * The page-level announcement of a one-press action's result. A one-press button (Vállalom, Kész, ...) lives inside
 * the card it changes: after the press the page refreshes and the button's own success text goes with it, so a
 * screen reader would hear nothing. This region is rendered once per page, outside every card, and stays mounted
 * across the refresh, so the result is read aloud after it. Errors are not sent here: the form that failed is still
 * on the page and announces them itself (role=alert).
 */
type Announcement = Readonly<{ serial: number; message: string }>;

let current: Announcement = { serial: 0, message: "" };
const listeners = new Set<() => void>();
const EMPTY: Announcement = { serial: 0, message: "" };

/** Says a message in the page's status region. The same message twice in a row is said twice. */
export function announceTodo(message: string): void {
  current = { serial: current.serial + 1, message };
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The always-present, visually hidden status region (polite: it waits for the reader to finish what it is saying). */
export function TodoStatusRegion() {
  const { serial, message } = useSyncExternalStore(
    subscribe,
    () => current,
    () => EMPTY,
  );
  // Leaving the page forgets what was said on it, so the next page starts silent.
  useEffect(
    () => () => {
      current = { serial: current.serial, message: "" };
    },
    [],
  );
  return (
    <div
      className="visually-hidden"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-testid="todo-status-region"
    >
      <span key={serial}>{message}</span>
    </div>
  );
}

/** An action that also announces its success message in the page's status region. */
export function announcing(action: ParentAction): ParentAction {
  return async (state, formData) => {
    const next = await action(state, formData);
    if (next.state === "success" && next.message) announceTodo(next.message);
    return next;
  };
}
