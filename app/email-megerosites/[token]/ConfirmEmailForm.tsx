"use client";

import { useActionState } from "react";
import { confirmEmailAction, type ConfirmState } from "./actions.ts";

const INITIAL: ConfirmState = { status: "idle" };

/** The button that spends the link, and what the person reads afterwards: done, no longer valid, or try again. */
export function ConfirmEmailForm({ token }: Readonly<{ token: string }>) {
  const [state, action, isPending] = useActionState(() => confirmEmailAction(token), INITIAL);
  if (state.status === "success") {
    return (
      <section
        className="parent-action-state parent-action-state-success"
        role="status"
        data-testid="email-confirm-success"
      >
        <h1 tabIndex={-1}>Az e-mail-cím megváltozott</h1>
        <p>Mostantól az új címeddel jelentkezhetsz be. A régi címre értesítést küldtünk.</p>
        <a className="button-link" href="/bejelentkezes">
          Bejelentkezés
        </a>
      </section>
    );
  }
  if (state.status === "not-valid") {
    return (
      <section className="parent-state" role="alert" data-testid="email-confirm-not-valid">
        <h1 tabIndex={-1}>A hivatkozás már nem érvényes</h1>
        <p>Ez a hivatkozás már nem érvényes. Kérj újat a Fiókom oldalon.</p>
        <a className="button-link" href="/szulo/fiokom">
          Vissza a Fiókomhoz
        </a>
      </section>
    );
  }
  return (
    <form action={action} className="parent-form" data-testid="email-confirm-form">
      <h1 tabIndex={-1}>E-mail-cím megerősítése</h1>
      <p>Az alábbi gombbal megerősítheted az új bejelentkezési e-mail-címedet.</p>
      {state.status === "error" && (
        <p role="alert" data-testid="email-confirm-error">
          A megerősítés most nem sikerült. Kérjük, próbáld újra.
        </p>
      )}
      <button type="submit" disabled={isPending} data-testid="email-confirm-submit">
        {isPending ? "Feldolgozás folyamatban" : "E-mail-cím megerősítése"}
      </button>
    </form>
  );
}
