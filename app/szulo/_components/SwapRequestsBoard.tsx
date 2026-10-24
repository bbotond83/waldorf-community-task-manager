"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import type { SwapRequestItemModel } from "../../../src/application/index.ts";
import { respondToSwapAction, withdrawRequestAction } from "../actions.ts";
import type { ParentActionState } from "../_lib/action-state.ts";
import { freshKey } from "./fresh-key.ts";

/** One open request with its dates already written for the screen (the server formats them). */
export type SwapRequestView = SwapRequestItemModel &
  Readonly<{ ownWhen: string; partnerWhen?: string }>;

const KIND_LABEL = { swap: "Cserekérelem", cancellation: "Lemondási kérelem" } as const;

/**
 * The open requests of the family: the swap requests other families addressed to it, with Confirm and
 * Decline, and the family's own open requests, with Withdraw. One status region at the top announces the
 * result of the last action; it stays after the answered request has left the list, so the result is never
 * lost with the card. Every button names the partner's task, so a screen reader hears what it answers.
 */
export function SwapRequestsBoard({
  incoming,
  outgoing,
}: Readonly<{ incoming: readonly SwapRequestView[]; outgoing: readonly SwapRequestView[] }>) {
  const [last, setLast] = useState<ParentActionState>({ state: "initial" });
  const regionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (last.state !== "initial") regionRef.current?.focus();
  }, [last]);

  return (
    <div data-testid="swap-board">
      {last.state !== "initial" && (
        <div
          ref={regionRef}
          className={`parent-action-state parent-action-state-${last.state}`}
          role={last.state === "success" ? "status" : "alert"}
          aria-live={last.state === "success" ? "polite" : "assertive"}
          tabIndex={-1}
          data-testid={`swap-board-state-${last.state}`}
        >
          <strong>{last.message}</strong>
          {last.fieldErrors && (
            <ul>
              {Object.entries(last.fieldErrors).map(([field, message]) => (
                <li key={field}>{message}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {incoming.length === 0 && outgoing.length === 0 && (
        <p data-testid="swap-requests-empty">Jelenleg nincs nyitott cserekérelem.</p>
      )}
      <section aria-labelledby="incoming-heading" data-testid="swap-incoming-section">
        <h2 id="incoming-heading">Önöknek címzett cserekérelmek</h2>
        {incoming.length === 0 ? (
          <p data-testid="swap-incoming-empty">
            Jelenleg egy másik család sem kért cserét Önöktől.
          </p>
        ) : (
          <ul className="parent-collection" data-testid="swap-incoming-list">
            {incoming.map((item) => (
              <li
                className="parent-card swap-request-card"
                key={item.id}
                data-testid={`swap-incoming-${item.id}`}
              >
                <IncomingCard item={item} onResult={setLast} />
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby="outgoing-heading" data-testid="swap-outgoing-section">
        <h2 id="outgoing-heading">Saját nyitott kérelmek</h2>
        {outgoing.length === 0 ? (
          <p data-testid="swap-outgoing-empty">Önöknek jelenleg nincs nyitott kérelmük.</p>
        ) : (
          <ul className="parent-collection" data-testid="swap-outgoing-list">
            {outgoing.map((item) => (
              <li
                className="parent-card swap-request-card"
                key={item.id}
                data-testid={`swap-outgoing-${item.id}`}
              >
                <OutgoingCard item={item} onResult={setLast} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/**
 * Sends one card's form and hands the result to the board. The result goes to the board straight from the
 * answer, not through the card's own state: a successful answer removes the card from the list, and a card
 * that is gone cannot report anything.
 */
function useSend(
  action: (state: ParentActionState, formData: FormData) => Promise<ParentActionState>,
  keyName: string,
  onResult: (state: ParentActionState) => void,
): (formData: FormData) => Promise<void> {
  return async (formData) => {
    formData.set("idempotencyKey", freshKey(keyName));
    onResult(await action({ state: "initial" }, formData));
  };
}

/** A button of an answer form that is off while the form is being sent (so an answer is never sent twice). */
function AnswerButton({
  children,
  ...props
}: Readonly<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { "data-testid": string; children: string }
>) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} {...props}>
      {children}
    </button>
  );
}

function IncomingCard({
  item,
  onResult,
}: Readonly<{ item: SwapRequestView; onResult: (state: ParentActionState) => void }>) {
  const send = useSend(respondToSwapAction, "respond", onResult);
  const partnerTask = item.partnerTaskTitle ?? "a másik család feladata";
  const partnerWhen = item.partnerWhen ? `, ${item.partnerWhen}` : "";
  return (
    <form className="swap-request-form" action={send} data-testid={`swap-respond-form-${item.id}`}>
      <div className="swap-request-text">
        <h3>{item.partnerFamilyName ?? "Egy másik család"} cserét kér</h3>
        <p>
          Önök jelenleg ezt a feladatot vállalták: <strong>{item.ownTaskTitle}</strong> (
          {item.ownWhen}).
        </p>
        <p>
          A csere után ezt a feladatot vállalnák: <strong>{partnerTask}</strong>
          {item.partnerWhen ? ` (${item.partnerWhen})` : ""}.
        </p>
      </div>
      <input type="hidden" name="id" value={item.id} />
      <input type="hidden" name="expectedVersion" value={item.version} />
      <input type="hidden" name="idempotencyKey" value={`respond:${item.id}:v${item.version}`} />
      <div className="swap-request-actions">
        <AnswerButton
          name="decision"
          value="accept"
          aria-label={`Megerősítés: ${partnerTask}${partnerWhen}`}
          data-testid={`swap-confirm-${item.id}`}
        >
          Megerősítés
        </AnswerButton>
        <AnswerButton
          name="decision"
          value="decline"
          className="secondary-button"
          aria-label={`Elutasítás: ${partnerTask}${partnerWhen}`}
          data-testid={`swap-decline-${item.id}`}
        >
          Elutasítás
        </AnswerButton>
      </div>
    </form>
  );
}

function OutgoingCard({
  item,
  onResult,
}: Readonly<{ item: SwapRequestView; onResult: (state: ParentActionState) => void }>) {
  const send = useSend(withdrawRequestAction, "withdraw", onResult);
  const label = KIND_LABEL[item.kind];
  return (
    <form className="swap-request-form" action={send} data-testid={`swap-withdraw-form-${item.id}`}>
      <div className="swap-request-text">
        <h3>{label}</h3>
        <p>
          Az Önök feladata: <strong>{item.ownTaskTitle}</strong> ({item.ownWhen}).
        </p>
        {item.kind === "swap" && item.partnerTaskTitle !== undefined && (
          <p>
            Cserélnének erre: <strong>{item.partnerTaskTitle}</strong>
            {item.partnerWhen ? ` (${item.partnerWhen})` : ""}
            {item.partnerFamilyName ? `, ${item.partnerFamilyName}` : ""}.
          </p>
        )}
        <p className="form-hint">
          {item.kind === "swap"
            ? "A másik család válaszára vagy az adminisztrátor döntésére vár."
            : "Az adminisztrátor döntésére vár."}
        </p>
      </div>
      <input type="hidden" name="id" value={item.id} />
      <input type="hidden" name="kind" value={item.kind} />
      <input type="hidden" name="expectedVersion" value={item.version} />
      <input type="hidden" name="idempotencyKey" value={`withdraw:${item.id}:v${item.version}`} />
      <div className="swap-request-actions">
        <AnswerButton
          className="secondary-button"
          aria-label={`Visszavonás: ${label}, ${item.ownTaskTitle}`}
          data-testid={`swap-withdraw-${item.id}`}
        >
          Visszavonás
        </AnswerButton>
      </div>
    </form>
  );
}
