import { ParentMutationForm } from "../../../_components/ParentMutationForm.tsx";
import { pendingRequests } from "../../../../../src/parent-web/notification-context.ts";
import type {
  ApplicationResult,
  SwapCandidateListModel,
  SwapCandidateModel,
} from "../../../../../src/application/index.ts";
import { isProductionMode } from "../../../../_identity/production-request.ts";
import { PendingRequestPanel } from "../../../_components/PendingRequestNotice.tsx";
import { ParentStatePanel } from "../../../_components/ParentStatePanel.tsx";
import { resolveParentFacade } from "../../../_lib/facade.ts";
import { resolveParentSession } from "../../../_lib/session.ts";
import { requestSwapAction } from "../../../actions.ts";
import { formatBudapestDate } from "../../page.tsx";

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
  const production = await isProductionMode();
  const result = await facade.getDuty(session.data.applicationSession, {
    familyScope: session.data.familyScope,
    familyId: session.data.familyId,
    dutyId: id,
  });
  // The partner list exists only against the real database; the synthetic mode keeps its fixed partner.
  const candidates =
    production && result.state === "success" && result.data.assignmentId
      ? await facade.listSwapCandidates(session.data.applicationSession, {
          familyScope: session.data.familyScope,
          familyId: session.data.familyId,
          assignmentId: result.data.assignmentId,
        })
      : undefined;
  return (
    <section className="parent-page" data-testid="swap-request-page">
      <a href={`/szulo/feladatok/${id}`} data-testid="swap-back-link">
        Vissza a feladathoz
      </a>
      <h1 tabIndex={-1}>Cserekérelem</h1>
      <ParentStatePanel result={result} emptyMessage="A megbízás nem érhető el." testId="swap-duty">
        {(duty) =>
          duty.assignmentId &&
          production &&
          !pendingRequests(duty).any &&
          candidates?.state !== "success" ? (
            <PartnerListUnavailable candidates={candidates} />
          ) : duty.assignmentId ? (
            <ParentMutationForm
              action={requestSwapAction}
              submitLabel="Cserekérelem elküldése"
              testId="swap-request-form"
              alreadyDone={pendingRequests(duty).any}
              freshIdempotencyKey={production}
              afterSuccess={
                <PendingRequestPanel
                  pending={
                    pendingRequests(duty).any
                      ? pendingRequests(duty)
                      : { swap: true, cancellation: false }
                  }
                  dutyId={duty.id}
                  testId="swap-pending-panel"
                />
              }
            >
              <input type="hidden" name="id" value={duty.id} />
              <input type="hidden" name="assignmentId" value={duty.assignmentId} />
              {production ? (
                candidates?.state === "success" && <PartnerList candidates={candidates.data} />
              ) : (
                <input
                  type="hidden"
                  name="counterpartId"
                  value={scenario === "success" ? "assignment-counterpart" : scenario}
                />
              )}
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

/** What the page shows instead of the form when there is no partner to choose: none exist, or the list failed. */
function PartnerListUnavailable({
  candidates,
}: Readonly<{ candidates: ApplicationResult<SwapCandidateListModel> | undefined }>) {
  if (candidates === undefined || candidates.state === "empty") {
    return (
      <p className="parent-notice" data-testid="swap-candidates-empty">
        Jelenleg nincs olyan másik családi feladat, amellyel cserélhetne. Később próbálja újra.
      </p>
    );
  }
  return (
    <p className="parent-notice" role="alert" data-testid="swap-candidates-error">
      A cseretársak listája most nem érhető el. Próbálja újra később.
    </p>
  );
}

/**
 * The tasks of other families this family may swap with: title, date and the other family's display name,
 * one choice. The chosen value carries the partner's place and the version that was on screen, so the
 * database can tell a changed place from an unchanged one.
 */
function PartnerList({ candidates }: Readonly<{ candidates: SwapCandidateListModel }>) {
  return (
    <fieldset className="swap-partner-list" data-testid="swap-candidate-list">
      <legend>Melyik családi feladatra cserélne?</legend>
      <input type="hidden" name="partnerList" value="1" />
      <ul className="parent-collection">
        {candidates.candidates.map((candidate: SwapCandidateModel, index: number) => {
          const inputId = index === 0 ? "counterpart" : `counterpart-${index}`;
          return (
            <li className="parent-card" key={candidate.assignmentId}>
              <input
                type="radio"
                id={inputId}
                name="counterpart"
                value={`${candidate.assignmentId}:${candidate.assignmentVersion}`}
                data-testid={`swap-candidate-${candidate.assignmentId}`}
              />
              <label htmlFor={inputId}>
                <strong>{candidate.title}</strong>
                <span> – {formatBudapestDate(candidate.startsAt)}</span>
                <span> – {candidate.familyDisplayName}</span>
              </label>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}
