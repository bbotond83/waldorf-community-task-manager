import { STATUS_ICON_CHARACTERS } from "../../../src/application/status-labels.ts";
import {
  CHECK_OUTCOME_LABELS,
  checkLabel,
  deliveryReasonLabel,
  deliveryRetryKey,
  formatMoment,
} from "../../../src/application/delivery-labels.ts";
import { StatusBadge } from "../../../src/runtime/StatusBadge.tsx";
import { AdminAccessState } from "../_components/AdminAccessState.tsx";
import { AdminMutationForm } from "../_components/AdminMutationForm.tsx";
import { retryReminderAction } from "../advanced-actions.ts";
import { resolveAdminFacade } from "../_lib/facade.ts";
import { resolveAdminSession } from "../_lib/session.ts";

const FAILED = { icon: "warning", character: STATUS_ICON_CHARACTERS.warning } as const;
const MISSING = { icon: "clock", character: STATUS_ICON_CHARACTERS.clock } as const;

/**
 * "Kézbesítési hibák": the emails that could not be sent, grouped by kind and item with Try again for each group, and
 * the timed checks that failed or were missing in the last 30 days (Stitch screen "Kézbesítési hibák"). It shows kinds,
 * item dates, counts and the reason class in words: never an address, a name or a mail-server code or message.
 */
export default async function DeliveryProblemsPage() {
  const [session, facade] = await Promise.all([resolveAdminSession(), resolveAdminFacade()]);
  if (session.state !== "success" || !facade) return <AdminAccessState kind="denied" />;
  const result = await facade.reminders.list(session.data.applicationSession, session.data.scope);
  if (result.state === "denied" || result.state === "invalidated")
    return <AdminAccessState kind="denied" />;
  const groups = result.state === "success" ? result.data.groups : [];
  const checks = result.state === "success" ? result.data.checks : [];
  return (
    <section className="admin-page admin-delivery-page" data-testid="admin-reminder-page">
      <header>
        <p className="eyebrow">Adminisztráció</p>
        <h1 tabIndex={-1} autoFocus>
          Kézbesítési hibák
        </h1>
        <p>Itt látható, mely e-mailek nem érkeztek meg, és mely időzített ellenőrzések hibáztak.</p>
      </header>
      {result.state !== "success" && result.state !== "empty" ? (
        <p className="admin-delivery-notice admin-delivery-notice-error" role="alert">
          Hiba történt, a lista most nem tölthető be. Próbálja újra később.
        </p>
      ) : (
        <>
          <section aria-labelledby="admin-delivery-failed" data-testid="admin-reminder-emails">
            <div className="admin-delivery-heading">
              <h2 id="admin-delivery-failed">Sikertelen e-mailek</h2>
              {groups.length > 0 && (
                <span className="admin-delivery-count">{groups.length} esemény</span>
              )}
            </div>
            <p className="form-hint">
              Azok az e-mailek, amelyeket háromszori próbálkozás után sem sikerült elküldeni.
              Személyes adat nem jelenik meg.
            </p>
            {groups.length === 0 ? (
              <div
                className="admin-delivery-notice admin-delivery-notice-ok"
                data-testid="admin-reminder-empty"
              >
                <strong>Nincs sikertelen e-mail.</strong>
                <p>Minden értesítő e-mail sikeresen elment.</p>
              </div>
            ) : (
              <ul className="admin-delivery-groups" data-testid="admin-reminder-list">
                {groups.map((group) => {
                  const id = `${group.kind}-${group.targetId}`;
                  return (
                    <li
                      className="admin-delivery-group"
                      key={id}
                      data-testid={`admin-reminder-${id}`}
                    >
                      <div className="admin-delivery-group-head">
                        <h3>{group.title}</h3>
                        <StatusBadge label="Sikertelen" symbol={FAILED} />
                      </div>
                      <dl className="admin-delivery-facts">
                        <div>
                          <dt>Utolsó próbálkozás</dt>
                          <dd>{formatMoment(group.latestTryAt)}</dd>
                        </div>
                        <div>
                          <dt>Sikertelen e-mailek</dt>
                          <dd>{group.failedCount} db</dd>
                        </div>
                        <div>
                          <dt>Ok</dt>
                          <dd>{deliveryReasonLabel(group.reason)}</dd>
                        </div>
                      </dl>
                      <AdminMutationForm
                        action={retryReminderAction}
                        submitLabel="Újrapróbálás"
                        testId={`admin-reminder-retry-${id}`}
                      >
                        <input type="hidden" name="kind" value={group.kind} />
                        <input type="hidden" name="targetType" value={group.targetType} />
                        <input type="hidden" name="targetId" value={group.targetId} />
                        <input
                          type="hidden"
                          name="expected"
                          value={JSON.stringify(group.deliveries)}
                        />
                        <input type="hidden" name="expectedVersion" value={group.failedCount} />
                        <input
                          type="hidden"
                          name="idempotencyKey"
                          value={deliveryRetryKey(group.kind, group.targetId, group.deliveries)}
                        />
                      </AdminMutationForm>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
          <section aria-labelledby="admin-delivery-checks" data-testid="admin-check-problems">
            <div className="admin-delivery-heading">
              <h2 id="admin-delivery-checks">Időzített ellenőrzések, elmúlt 30 nap</h2>
            </div>
            <p className="form-hint">A hibás vagy hiányzó automatikus ellenőrzések.</p>
            {checks.length === 0 ? (
              <div
                className="admin-delivery-notice admin-delivery-notice-ok"
                data-testid="admin-check-empty"
              >
                <strong>Nincs hibás ellenőrzés.</strong>
                <p>Az elmúlt 30 napban minden időzített ellenőrzés hiba nélkül lefutott.</p>
              </div>
            ) : (
              <>
                <div className="admin-delivery-table-wrapper">
                  <table className="admin-delivery-table">
                    <thead>
                      <tr>
                        <th scope="col">Időpont</th>
                        <th scope="col">Ellenőrzés</th>
                        <th scope="col">Eredmény</th>
                        <th scope="col">Létrehozva / kihagyva</th>
                      </tr>
                    </thead>
                    <tbody>
                      {checks.map((check) => (
                        <tr
                          key={`${check.checkName}-${check.startedAt}`}
                          data-testid={`admin-check-${check.checkName}`}
                        >
                          <td>{formatMoment(check.startedAt)}</td>
                          <td>{checkLabel(check.checkName)}</td>
                          <td>
                            <StatusBadge
                              label={CHECK_OUTCOME_LABELS[check.outcome]}
                              symbol={check.outcome === "failed" ? FAILED : MISSING}
                            />
                          </td>
                          <td>
                            {check.created} létrehozva / {check.skipped} kihagyva
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <ul className="admin-delivery-check-cards">
                  {checks.map((check) => (
                    <li key={`card-${check.checkName}-${check.startedAt}`}>
                      <div className="admin-delivery-group-head">
                        <span className="form-hint">{formatMoment(check.startedAt)}</span>
                        <StatusBadge
                          label={CHECK_OUTCOME_LABELS[check.outcome]}
                          symbol={check.outcome === "failed" ? FAILED : MISSING}
                        />
                      </div>
                      <strong>{checkLabel(check.checkName)}</strong>
                      <span className="form-hint">
                        {check.created} létrehozva / {check.skipped} kihagyva
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        </>
      )}
    </section>
  );
}
