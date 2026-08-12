"use client";

import { useActionState } from "react";
import type { InvitationActionState } from "./actions.ts";
import { resendInvitationAction } from "./actions.ts";

type BoundAcceptAction = (
  state: InvitationActionState,
  formData: FormData,
) => Promise<InvitationActionState>;

export function InvitationAcceptForm({ action }: Readonly<{ action: BoundAcceptAction }>) {
  const [state, formAction, isPending] = useActionState(action, { state: "initial" });
  return (
    <form action={formAction} className="parent-form" data-testid="invitation-accept-form">
      {state.state !== "initial" && (
        <p
          role={state.state === "success" ? "status" : "alert"}
          data-testid={`invitation-accept-${state.state}`}
        >
          {state.message}{" "}
          {state.destination && (
            <a href={state.destination} data-testid="invitation-destination-link">
              Tovább
            </a>
          )}
        </p>
      )}
      <button type="submit" disabled={isPending} data-testid="invitation-accept-button">
        {isPending ? "Feldolgozás folyamatban" : "Meghívás elfogadása"}
      </button>
    </form>
  );
}

export function InvitationResendForm() {
  const [state, action, isPending] = useActionState(resendInvitationAction, {
    state: "initial" as const,
  });
  return (
    <form action={action} className="parent-form" data-testid="invitation-resend-form">
      {state.state !== "initial" && (
        <p
          role={state.state === "success" ? "status" : "alert"}
          data-testid={`invitation-resend-${state.state}`}
        >
          {state.message}
        </p>
      )}
      <label htmlFor="identifier">E-mail-cím</label>
      <input
        id="identifier"
        name="identifier"
        type="email"
        autoComplete="email"
        data-testid="invitation-resend-identifier"
      />
      <button type="submit" disabled={isPending} data-testid="invitation-resend-button">
        {isPending ? "Kérés folyamatban" : "Új meghívó kérése"}
      </button>
    </form>
  );
}
