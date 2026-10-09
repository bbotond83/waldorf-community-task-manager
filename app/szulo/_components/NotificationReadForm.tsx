"use client";

import { useActionState, useEffect, useRef, type ChangeEvent } from "react";
import { markNotificationReadAction } from "../actions.ts";

const VALIDATION_HINT = "Jelölje be a négyzetet, hogy az értesítés olvasott legyen.";

/**
 * "Olvasottnak jelölöm" checkbox of a notification card. Ticking the box marks the notification
 * as read at once; a read notification shows the box ticked and disabled. Without JavaScript the
 * visible "Mentés" button of the `<noscript>` fallback submits the same form.
 */
export function NotificationReadForm({
  id,
  title,
  isRead,
}: Readonly<{ id: string; title: string; isRead: boolean }>) {
  const [state, action, isPending] = useActionState(markNotificationReadAction, {
    state: "initial" as const,
  });
  const checkboxRef = useRef<HTMLInputElement>(null);
  const failed = state.state !== "initial" && state.state !== "success";
  const done = isRead || state.state === "success";

  // A failed request returns the box to unticked and makes it focusable again.
  useEffect(() => {
    if (!failed) return;
    const checkbox = checkboxRef.current;
    if (!checkbox) return;
    checkbox.checked = false;
    checkbox.focus();
  }, [failed, state]);

  // After the read state is saved the disabled box cannot keep focus, so focus moves to the
  // notification's whole-card link (a sibling inside the shared card container).
  useEffect(() => {
    if (state.state !== "success") return;
    const form = checkboxRef.current?.form;
    const container = form?.closest("li") ?? form?.parentElement;
    const link = container?.querySelector<HTMLElement>(`[data-testid="notification-link-${id}"]`);
    link?.focus();
  }, [state, id]);

  function submitWhenTicked(event: ChangeEvent<HTMLInputElement>) {
    if (event.currentTarget.checked) event.currentTarget.form?.requestSubmit();
  }

  return (
    <form
      action={action}
      className="notification-read-form"
      data-testid={`notification-read-form-${id}`}
    >
      <input type="hidden" name="idempotencyKey" value={`notice:${id}:read`} />
      <label className="notification-read-label">
        <input
          ref={checkboxRef}
          type="checkbox"
          name="id"
          value={id}
          defaultChecked={done}
          disabled={done || isPending}
          aria-busy={isPending}
          onChange={submitWhenTicked}
          data-testid={`notification-read-checkbox-${id}`}
        />
        <span>Olvasottnak jelölöm</span> <span className="visually-hidden">{title}</span>
      </label>
      <noscript>
        <button type="submit" data-testid={`notification-read-save-${id}`}>
          Mentés
        </button>
      </noscript>
      {state.state !== "initial" && (
        <p
          className="notification-read-state"
          role={state.state === "success" ? "status" : "alert"}
          aria-live={state.state === "success" ? "polite" : "assertive"}
          data-testid={`notification-state-${id}-${state.state}`}
        >
          {state.state === "validation" ? VALIDATION_HINT : state.message}
        </p>
      )}
    </form>
  );
}
