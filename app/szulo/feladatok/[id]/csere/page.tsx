import { ParentMutationForm } from "../../../_components/ParentMutationForm.tsx";
import { ParentStatePanel } from "../../../_components/ParentStatePanel.tsx";
import { resolveParentFacade } from "../../../_lib/facade.ts";
import { resolveParentSession } from "../../../_lib/session.ts";
import { requestSwapAction } from "../../../actions.ts";

export default async function SwapRequestPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ scenario?: string }>;
}) {
  const { id } = await params;
  const { scenario = "success" } = await searchParams;
  const session = await resolveParentSession();
  const facade = await resolveParentFacade();
  if (session.state !== "success" || !facade) return null;
  const result = await facade.getDuty(session.data.applicationSession, {
    familyScope: session.data.familyScope,
    familyId: session.data.familyId,
    dutyId: id,
  });
  return (
    <section className="parent-page" data-testid="swap-request-page">
      <a href={`/szulo/feladatok/${id}`} data-testid="swap-back-link">
        Vissza a feladathoz
      </a>
      <h1 tabIndex={-1}>Cserekérelem</h1>
      <ParentStatePanel result={result} emptyMessage="A megbízás nem érhető el." testId="swap-duty">
        {(duty) =>
          duty.assignmentId ? (
            <ParentMutationForm
              action={requestSwapAction}
              submitLabel="Cserekérelem elküldése"
              testId="swap-request-form"
            >
              <input type="hidden" name="id" value={duty.id} />
              <input type="hidden" name="assignmentId" value={duty.assignmentId} />
              <input
                type="hidden"
                name="counterpartId"
                value={scenario === "success" ? "assignment-counterpart" : scenario}
              />
              <input type="hidden" name="expectedVersion" value={duty.version} />
              <input
                type="hidden"
                name="idempotencyKey"
                value={`swap:${duty.id}:v${duty.version}`}
              />
              <label htmlFor="reason">Indoklás</label>
              <textarea
                id="reason"
                name="reason"
                maxLength={500}
                required
                aria-describedby="reason-hint"
                data-testid="swap-reason-input"
              />
              <p id="reason-hint" className="form-hint">
                Az indoklás védett adat; más család számára nem jelenik meg.
              </p>
            </ParentMutationForm>
          ) : (
            <p data-testid="swap-ineligible-state">
              Ehhez a feladathoz nincs cserélhető saját megbízás.
            </p>
          )
        }
      </ParentStatePanel>
    </section>
  );
}
