"use client";

import { useActionState } from "react";
import { markNotificationReadAction } from "../actions.ts";

export function NotificationReadForm({ id }: Readonly<{ id: string }>) {
  const [state, action, isPending] = useActionState(markNotificationReadAction, {
    state: "initial" as const,
  });
  return (
    <form
      action={action}
      className="notification-actions"
      data-testid={`notification-read-form-${id}`}
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="idempotencyKey" value={`notice:${id}:read`} />
      {state.state !== "initial" && (
        <p
          role={state.state === "success" ? "status" : "alert"}
          aria-live={state.state === "success" ? "polite" : "assertive"}
          data-testid={`notification-state-${id}-${state.state}`}
        >
          {state.message}
          {state.link && (
            <>
              {" "}
              <a href={state.link} data-testid={`notification-result-link-${id}`}>
                Kapcsolódó feladat
              </a>
            </>
          )}
        </p>
      )}
      <button type="submit" disabled={isPending} data-testid={`notification-read-button-${id}`}>
        {isPending ? "Feldolgozás folyamatban" : "Olvasottnak jelölöm"}
      </button>
    </form>
  );
}
