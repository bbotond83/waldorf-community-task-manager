import { randomUUID } from "node:crypto";
import { AdminMutationForm } from "../_components/AdminMutationForm.tsx";
import { AsyncStatePanel } from "../_components/AsyncStatePanel.tsx";
import { reverseSwapAction } from "../actions.ts";
import { resolveAdminFacade } from "../_lib/facade.ts";
import { resolveAdminSession } from "../_lib/session.ts";
import { terminalFailure } from "../../../src/application/results.ts";

/** The words of each swap state; `applied` is a swap an administrator can still reverse. */
const SWAP_STATE_LABEL: Readonly<Record<string, string>> = {
  pending: "Függőben",
  applied: "Elfogadva",
  "applied-final": "Elfogadva",
  rejected: "Elutasítva",
  withdrawn: "Visszavonva",
  expired: "Lejárt",
  cancelled: "Megszűnt",
  reversed: "Visszafordítva",
};

/**
 * The swaps the administrator may see (BR75.1): pending and ended, newest first. An applied swap that can still be
 * undone has the reverse button with its confirmation; one that can not shows why.
 */
export default async function AdminSwapsPage() {
  const session = await resolveAdminSession();
  const facade = await resolveAdminFacade();
  const result =
    session.state === "success" && facade
      ? await facade.listSwaps(session.data.applicationSession, session.data.scope)
      : terminalFailure();
  return (
    <section className="admin-page admin-swaps-page" data-testid="admin-swaps-page">
      <header>
        <p className="eyebrow">Adminisztráció</p>
        <h1 tabIndex={-1}>Cserék</h1>
        <p>
          A családok közötti feladatcserék áttekintése. Egy elfogadott csere visszafordítható, amíg
          a két feladat beosztása nem változott.
        </p>
      </header>
      <AsyncStatePanel
        result={result}
        testId="admin-swaps-state"
        emptyMessage="Még nincs cserekérelem."
      >
        {(data) => (
          <ul className="admin-collection" data-testid="admin-swaps-list">
            {data.items.map((swap) => (
              <li
                className="admin-card admin-swap-card"
                key={swap.id}
                data-testid={`admin-swap-${swap.id}`}
              >
                <h2>{swap.title}</h2>
                <p>
                  <span className="swap-status-chip" data-testid={`admin-swap-state-${swap.id}`}>
                    {SWAP_STATE_LABEL[swap.state] ?? swap.state}
                  </span>
                </p>
                {swap.state === "applied" && (
                  <AdminMutationForm
                    action={reverseSwapAction}
                    submitLabel="Visszafordítom"
                    testId={`admin-swap-reverse-form-${swap.id}`}
                  >
                    <input type="hidden" name="id" value={swap.id} />
                    <input type="hidden" name="expectedVersion" value={swap.version ?? 1} />
                    <input
                      type="hidden"
                      name="idempotencyKey"
                      value={`swap:reverse:${swap.id}:${randomUUID()}`}
                    />
                    <p className="form-hint">
                      Biztosan visszafordítod? Mindkét család az eredeti feladatát kapja vissza.
                    </p>
                  </AdminMutationForm>
                )}
                {swap.state === "applied-final" && (
                  <p className="form-hint" data-testid={`admin-swap-final-${swap.id}`}>
                    A csere óta megváltozott a beosztás, ezért nem fordítható vissza.
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </AsyncStatePanel>
    </section>
  );
}
