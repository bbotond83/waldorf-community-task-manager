import { ParentMutationForm } from "../../_components/ParentMutationForm.tsx";
import { ParentStatePanel } from "../../_components/ParentStatePanel.tsx";
import { resolveParentFacade } from "../../_lib/facade.ts";
import { resolveParentSession } from "../../_lib/session.ts";
import { signUpAction, updateContributionAction } from "../../actions.ts";
import { formatBudapestDate } from "../page.tsx";

export default async function DutyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ allapot?: string }>;
}) {
  const { id } = await params;
  const { allapot = "" } = await searchParams;
  const session = await resolveParentSession();
  const facade = await resolveParentFacade();
  if (session.state !== "success" || !facade) return null;
  const result = await facade.getDuty(session.data.applicationSession, {
    familyScope: session.data.familyScope,
    familyId: session.data.familyId,
    dutyId: id,
  });
  const backHref = `/szulo/feladatok${allapot ? `?allapot=${encodeURIComponent(allapot)}` : ""}`;

  return (
    <section className="parent-page" data-testid="duty-detail-page">
      <a href={backHref} data-testid="duty-detail-back-link">
        Vissza a feladatokhoz
      </a>
      <ParentStatePanel
        result={result}
        emptyMessage="A feladat nem érhető el."
        testId="duty-detail"
      >
        {(duty) => (
          <>
            <header>
              <p className="eyebrow">Feladat részletei</p>
              <h1 tabIndex={-1}>{duty.title}</h1>
            </header>
            <dl className="parent-detail-grid">
              <div>
                <dt>Időpont</dt>
                <dd>{formatBudapestDate(duty.dueAt)}</dd>
              </div>
              <div>
                <dt>Helyszín</dt>
                <dd>{duty.location}</dd>
              </div>
            </dl>
            {duty.state === "available" && (
              <ParentMutationForm
                action={signUpAction}
                submitLabel="Jelentkezem"
                testId="signup-form"
              >
                <MutationContext id={duty.id} version={duty.version} keyPrefix="signup" />
              </ParentMutationForm>
            )}
            {duty.state === "full" && (
              <p className="parent-notice" data-testid="duty-full-state">
                A feladat betelt; jelentkezés nem indítható.
              </p>
            )}
            {duty.state === "ineligible" && (
              <p className="parent-notice" data-testid="duty-ineligible-state">
                A család ehhez a feladathoz most nem jogosult.
              </p>
            )}
            {duty.assignmentId && (
              <nav aria-label="Feladatműveletek" className="parent-page-actions">
                <a href={`/szulo/feladatok/${duty.id}/csere`} data-testid="swap-request-link">
                  Cserekérelem
                </a>
                <a
                  href={`/szulo/feladatok/${duty.id}/lemondas`}
                  data-testid="cancellation-request-link"
                >
                  Lemondási kérelem
                </a>
              </nav>
            )}
            {duty.allergenNote !== undefined && (
              <section className="parent-note-panel" data-testid="permitted-allergen-note">
                <h2>Engedélyezett allergéninformáció</h2>
                <p>{duty.allergenNote}</p>
              </section>
            )}
            {duty.assignmentId && (
              <ParentMutationForm
                action={updateContributionAction}
                submitLabel="Saját megjegyzés mentése"
                testId="contribution-form"
              >
                <input type="hidden" name="id" value={duty.id} />
                <input
                  type="hidden"
                  name="idempotencyKey"
                  value={`note:${duty.id}:v${duty.version}`}
                />
                <label htmlFor="note">Saját hozzájárulási megjegyzés</label>
                <textarea
                  id="note"
                  name="note"
                  defaultValue={duty.ownContributionNote}
                  maxLength={300}
                  required
                  data-testid="contribution-note-input"
                />
                <p className="form-hint">Csak a saját hozzájárulási megjegyzés módosítható.</p>
              </ParentMutationForm>
            )}
          </>
        )}
      </ParentStatePanel>
    </section>
  );
}

function MutationContext({
  id,
  version,
  keyPrefix,
}: Readonly<{ id: string; version: number; keyPrefix: string }>) {
  return (
    <>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="expectedVersion" value={version} />
      <input type="hidden" name="idempotencyKey" value={`${keyPrefix}:${id}:v${version}`} />
    </>
  );
}
