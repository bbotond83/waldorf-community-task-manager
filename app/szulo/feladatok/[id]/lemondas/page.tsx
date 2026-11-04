import { ParentMutationForm } from "../../../_components/ParentMutationForm.tsx";
import { pendingRequests } from "../../../../../src/application/notification-context.ts";
import { PendingRequestPanel } from "../../../_components/PendingRequestNotice.tsx";
import { ParentStatePanel } from "../../../_components/ParentStatePanel.tsx";
import { resolveParentFacade } from "../../../_lib/facade.ts";
import { resolveParentSession } from "../../../_lib/session.ts";
import { requestCancellationAction } from "../../../actions.ts";

export default async function CancellationRequestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await resolveParentSession();
  const facade = await resolveParentFacade();
  if (session.state !== "success" || !facade) return null;
  const result = await facade.getDuty(session.data.applicationSession, {
    familyScope: session.data.familyScope,
    familyId: session.data.familyId,
    dutyId: id,
  });
  return (
    <section
      className="parent-page parent-cancellation-page"
      data-testid="cancellation-request-page"
    >
      <a
        href={`/szulo/feladatok/${id}`}
        className="parent-back-link"
        data-testid="cancellation-back-link"
      >
        Vissza a feladathoz
      </a>
      <header className="parent-detail-header">
        <h1 tabIndex={-1}>Lemondási kérelem</h1>
      </header>
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
              alreadyDone={pendingRequests(duty).any}
              freshIdempotencyKey
              afterSuccess={
                <PendingRequestPanel
                  pending={
                    pendingRequests(duty).any
                      ? pendingRequests(duty)
                      : { swap: false, cancellation: true }
                  }
                  dutyId={duty.id}
                  testId="cancellation-pending-panel"
                />
              }
            >
              <input type="hidden" name="id" value={duty.id} />
              <input type="hidden" name="assignmentId" value={duty.assignmentId} />
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
            <p className="parent-notice" data-testid="cancellation-ineligible-state">
              Ehhez a feladathoz nincs lemondható saját megbízás.
            </p>
          )
        }
      </ParentStatePanel>
    </section>
  );
}
