import { notificationHref } from "../../../src/application/notification-context.ts";
import { NotificationReadForm } from "../_components/NotificationReadForm.tsx";
import { ParentStatePanel } from "../_components/ParentStatePanel.tsx";
import { resolveParentFacade } from "../_lib/facade.ts";
import { resolveParentSession } from "../_lib/session.ts";

const TIMING_LABEL = {
  "7-day": "7 nappal előtte",
  "24-hour": "24 órával előtte",
  "within-threshold": "Közeli időpont",
  stale: "Elavult",
  cancelled: "Törölt",
} as const;

const PROVIDER_LABEL = {
  "simulated-sent": "Szimulált szolgáltató: elküldve",
  "simulated-retry": "Szimulált szolgáltató: újrapróbálás ütemezve",
  "simulated-cancelled": "Szimulált szolgáltató: törölve",
} as const;

export default async function ParentNotificationsPage() {
  const session = await resolveParentSession();
  const facade = await resolveParentFacade();
  if (session.state !== "success" || !facade) return null;
  const result = await facade.listNotifications(
    session.data.applicationSession,
    session.data.familyScope,
  );
  return (
    <section className="parent-page" data-testid="parent-notifications-page">
      <header>
        <p className="eyebrow">Szülői felület</p>
        <h1 tabIndex={-1} autoFocus>
          Értesítések
        </h1>
        <p>A szolgáltatói állapotok helyben szimuláltak; valós kézbesítést nem igazolnak.</p>
      </header>
      <ParentStatePanel result={result} emptyMessage="Nincs értesítés." testId="notifications">
        {(model) => (
          <ul className="parent-collection" data-testid="notification-list">
            {model.notifications.map((notification) => (
              <li
                className={`parent-card notification-card${notification.isRead ? " notification-card-read" : ""}`}
                key={notification.id}
                data-testid={`notification-card-${notification.id}`}
              >
                <a
                  className="parent-card-link"
                  href={notificationHref(notification)}
                  data-testid={`notification-link-${notification.id}`}
                >
                  <h2>{notification.title}</h2>
                  <p>{TIMING_LABEL[notification.timing]}</p>
                  <p className="delivery-note">{PROVIDER_LABEL[notification.providerStatus]}</p>
                  <strong>{notification.isRead ? "Olvasott" : "Olvasatlan"}</strong>
                </a>
                <NotificationReadForm
                  id={notification.id}
                  title={notification.title}
                  isRead={notification.isRead}
                />
              </li>
            ))}
          </ul>
        )}
      </ParentStatePanel>
    </section>
  );
}
