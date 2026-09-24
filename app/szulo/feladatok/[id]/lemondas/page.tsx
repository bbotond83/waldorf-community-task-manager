import { ParentMutationForm } from "../../../_components/ParentMutationForm.tsx";
import { ParentStatePanel } from "../../../_components/ParentStatePanel.tsx";
import { resolveParentFacade } from "../../../_lib/facade.ts";
import { resolveParentSession } from "../../../_lib/session.ts";
import { requestCancellationAction } from "../../../actions.ts";

export default async function CancellationRequestPage({
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
    <section className="parent-page" data-testid="cancellation-request-page">
      <a href={`/szulo/feladatok/${id}`} data-testid="cancellation-back-link">
        Vissza a feladathoz
      </a>
      <h1 tabIndex={-1}>Lemondási kérelem</h1>
      <ParentStatePanel
        result={result}
        emptyMessage="A megbízás nem érhető el."
        testId="cancellation-duty"
      >
        {(duty) =>
          duty.assignmentId ? (
            <ParentMutationForm
              action={requestCancellationAction}
              submitLabel="Lemondási kérelem elküldése"
              testId="cancellation-request-form"
            >
              <input type="hidden" name="id" value={duty.id} />
              <input
                type="hidden"
                name="assignmentId"
                value={
                  scenario === "success"
                    ? duty.assignmentId
                    : `${duty.assignmentId}--scenario-${scenario}`
                }
              />
              <input type="hidden" name="expectedVersion" value={duty.version} />
              <input
                type="hidden"
                name="idempotencyKey"
                value={`cancel:${duty.id}:v${duty.version}`}
              />
              <label htmlFor="reason">Indoklás</label>
              <textarea
                id="reason"
                name="reason"
                maxLength={500}
                required
                aria-describedby="reason-hint"
                data-testid="cancellation-reason-input"
              />
              <p id="reason-hint" className="form-hint">
                Az indoklás védett adat, és nem kerül a képernyőmodellbe.
              </p>
            </ParentMutationForm>
          ) : (
            <p data-testid="cancellation-ineligible-state">
              Ehhez a feladathoz nincs lemondható saját megbízás.
            </p>
          )
        }
      </ParentStatePanel>
    </section>
  );
}
