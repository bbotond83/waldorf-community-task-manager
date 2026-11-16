"use client";

import { useState } from "react";
import { joinGroupAction, leaveGroupAction } from "../group-actions.ts";
import { ParentMutationForm, type ParentAction } from "./ParentMutationForm.tsx";

export const COORDINATOR_LEAVE_WARNING =
  "Ha kilépsz, megszűnik a koordinátori jogod ebben a csoportban.";

/**
 * A parent's own membership of one group: "Csatlakozom" when not a member, "Kilépek" when a member. Leaving asks
 * first, on the same page (a coordinator is told the right ends with it, BR42.4). The page refreshes after a
 * success and swaps the button, so the confirmation sentence is kept here, outside the form that disappears.
 */
export function GroupMembershipPanel({
  groupId,
  membership,
  isCoordinator,
}: Readonly<{
  groupId: string;
  membership: Readonly<{ id: string; version: number }> | null;
  isCoordinator: boolean;
}>) {
  const [confirming, setConfirming] = useState(false);
  const [notice, setNotice] = useState<string | undefined>();
  const remember =
    (action: ParentAction): ParentAction =>
    async (state, formData) => {
      const next = await action(state, formData);
      if (next.state === "success") {
        setNotice(next.message);
        setConfirming(false);
      }
      return next;
    };

  return (
    <section className="parent-group-membership" data-testid="parent-group-membership">
      {notice && (
        <p className="parent-group-notice" role="status" data-testid="parent-group-confirmation">
          {notice}
        </p>
      )}
      {membership === null ? (
        <ParentMutationForm
          action={remember(joinGroupAction)}
          submitLabel="Csatlakozom"
          testId="parent-group-join"
          freshIdempotencyKey
        >
          <input type="hidden" name="groupId" value={groupId} />
          <input type="hidden" name="idempotencyKey" value={`group-join:${groupId}`} />
        </ParentMutationForm>
      ) : confirming ? (
        <section
          className="parent-group-confirm"
          aria-label="Kilépés megerősítése"
          data-testid="parent-group-leave-confirm"
        >
          <p className="parent-group-question">Biztosan ki szeretnél lépni ebből a csoportból?</p>
          {isCoordinator && (
            <p className="parent-group-warning" data-testid="parent-group-coordinator-warning">
              {COORDINATOR_LEAVE_WARNING}
            </p>
          )}
          <ParentMutationForm
            action={remember(leaveGroupAction)}
            submitLabel="Igen, kilépek"
            testId="parent-group-leave"
            freshIdempotencyKey
          >
            <input type="hidden" name="groupId" value={groupId} />
            <input type="hidden" name="membershipId" value={membership.id} />
            <input type="hidden" name="expectedVersion" value={membership.version} />
            <input
              type="hidden"
              name="idempotencyKey"
              value={`group-leave:${membership.id}:v${membership.version}`}
            />
            <button
              type="button"
              className="parent-group-cancel"
              onClick={() => setConfirming(false)}
              data-testid="parent-group-leave-cancel"
            >
              Mégsem
            </button>
          </ParentMutationForm>
        </section>
      ) : (
        <button
          type="button"
          className="parent-group-leave-button"
          onClick={() => setConfirming(true)}
          data-testid="parent-group-leave-button"
        >
          Kilépek
        </button>
      )}
    </section>
  );
}
