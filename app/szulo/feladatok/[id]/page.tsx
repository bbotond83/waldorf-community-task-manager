import { redirect } from "next/navigation";
import { dutyStateDisplay } from "../../../../src/application/status-labels.ts";
import { StatusBadge } from "../../../../src/runtime/StatusBadge.tsx";
import {
  NOTIFICATION_LIST_PATH,
  pendingRequests,
  resolveNotificationContext,
} from "../../../../src/parent-web/notification-context.ts";
import { MarkNotificationRead } from "../../_components/MarkNotificationRead.tsx";
import { ParentMutationForm } from "../../_components/ParentMutationForm.tsx";
import { PendingRequestNotice } from "../../_components/PendingRequestNotice.tsx";
import { ParentStatePanel } from "../../_components/ParentStatePanel.tsx";
import { resolveParentFacade } from "../../_lib/facade.ts";
import { resolveParentSession, type ParentSession } from "../../_lib/session.ts";
import { signUpAction, updateContributionAction } from "../../actions.ts";
import { formatBudapestDate } from "../page.tsx";

export default async function DutyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ allapot?: string; ertesites?: string }>;
}) {
  const { id } = await params;
  const { allapot = "", ertesites } = await searchParams;
  const session = await resolveParentSession();
  const facade = await resolveParentFacade();
  if (session.state !== "success" || !facade) return null;
  const result = await facade.getDuty(session.data.applicationSession, {
    familyScope: session.data.familyScope,
    familyId: session.data.familyId,
    dutyId: id,
  });
  const notification = await openedFromNotification(facade, session.data, ertesites, id, allapot);
  const backHref = notification
    ? NOTIFICATION_LIST_PATH
    : `/szulo/feladatok${allapot ? `?allapot=${encodeURIComponent(allapot)}` : ""}`;

  return (
    <section className="parent-page" data-testid="duty-detail-page">
      {notification && <MarkNotificationRead notificationId={notification.id} />}
      <a href={backHref} data-testid="duty-detail-back-link">
        {notification ? "Vissza az értesítésekhez" : "Vissza a feladatokhoz"}
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
              <div>
                <dt>Állapot</dt>
                <dd data-testid="duty-detail-state">
                  <StatusBadge {...dutyStateDisplay(duty.state)} />
                </dd>
              </div>
            </dl>
            <PendingRequestNotice pending={pendingRequests(duty)} />
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
            {duty.assignmentId && !pendingRequests(duty).any && (
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

/**
 * The notification this task page was opened from. The address parameter counts only when it is
 * one of the signed-in parent's own notifications and it points at this task; any other value
 * sends the parent to the clean task address, so the page behaves exactly as if the parameter
 * were absent (no marking, "Feladatok" current, back link to the task list).
 */
async function openedFromNotification(
  facade: NonNullable<Awaited<ReturnType<typeof resolveParentFacade>>>,
  session: ParentSession,
  notificationId: string | undefined,
  dutyId: string,
  allapot: string,
) {
  if (notificationId === undefined) return undefined;
  const list = await facade.listNotifications(session.applicationSession, session.familyScope);
  const notification =
    list.state === "success"
      ? resolveNotificationContext(list.data.notifications, notificationId, dutyId)
      : undefined;
  if (!notification) {
    redirect(
      `/szulo/feladatok/${dutyId}${allapot ? `?allapot=${encodeURIComponent(allapot)}` : ""}`,
    );
  }
  return notification;
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
