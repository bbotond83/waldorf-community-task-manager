import { AdminAccessState } from "../_components/AdminAccessState.tsx";
import { AdminMutationForm } from "../_components/AdminMutationForm.tsx";
import { DeveloperDetails } from "../_components/DeveloperDetails.tsx";
import { saveAdvancedSettingsAction, updateGrantAction } from "../advanced-actions.ts";
import { resolveAdminFacade } from "../_lib/facade.ts";
import { resolveAdminSession } from "../_lib/session.ts";

export default async function AdvancedSettingsPage() {
  const [session, facade] = await Promise.all([resolveAdminSession(), resolveAdminFacade()]);
  if (session.state !== "success" || !facade) return <AdminAccessState kind="denied" />;
  const { applicationSession, scope } = session.data;
  const [settings, governance] = await Promise.all([
    facade.settings.get(applicationSession, scope),
    facade.governance.list(applicationSession, scope),
  ]);
  if (settings.state === "denied" || settings.state === "invalidated")
    return <AdminAccessState kind="denied" />;
  return (
    <section className="admin-page" data-testid="admin-advanced-settings-page">
      <header>
        <p className="eyebrow">Adminisztráció</p>
        <h1 tabIndex={-1} autoFocus>
          Beállítások és jogosultságok
        </h1>
        <p>A címzetti kör engedélyezett, összesített lehetőségekre korlátozott.</p>
      </header>
      {settings.state === "success" && (
        <section className="advanced-panel" data-testid="admin-recipient-settings">
          <h2>Emlékeztető-beállítások</h2>
          <AdminMutationForm
            action={saveAdvancedSettingsAction}
            submitLabel="Beállítások mentése"
            testId="admin-settings-form"
          >
            <label htmlFor="recipientId">Címzetti kör</label>
            <select
              id="recipientId"
              name="recipientId"
              defaultValue={settings.data.selectedRecipientId}
            >
              {settings.data.recipients.map((recipient) => (
                <option key={recipient.id} value={recipient.id}>
                  {recipient.label} — {recipient.summary}
                </option>
              ))}
            </select>
            <label>
              <input
                type="checkbox"
                name="remindersEnabled"
                value="yes"
                defaultChecked={settings.data.remindersEnabled}
              />{" "}
              Emlékeztetők engedélyezése
            </label>
            <input type="hidden" name="expectedVersion" value={settings.data.version} />
            <input
              type="hidden"
              name="idempotencyKey"
              value={`settings-v${settings.data.version}`}
            />
          </AdminMutationForm>
        </section>
      )}
      {governance.state === "success" && (
        <section data-testid="admin-governance-section">
          <h2>Szuperadminisztrátori jogosultságok</h2>
          <p>A visszavonás az érintett személy következő kérésénél azonnal érvényes.</p>
          {governance.data.lastOutcome && (
            <div
              className="success-panel advanced-panel"
              role="status"
              data-testid="admin-governance-outcome"
            >
              A jogosultság visszavonva; az érintett profil következő kérése már megtagadott.
            </div>
          )}
          <ul className="advanced-collection">
            {governance.data.grants.map((grant) => (
              <li className="advanced-panel" key={grant.id} data-testid={`admin-grant-${grant.id}`}>
                <h3>{grant.subjectLabel}</h3>
                <p>
                  {grant.role} · {grant.scopeLabel}
                </p>
                <AdminMutationForm
                  action={updateGrantAction}
                  submitLabel="Jogosultság visszavonása"
                  testId={`admin-grant-revoke-${grant.id}`}
                >
                  <input type="hidden" name="grantId" value={grant.id} />
                  <input type="hidden" name="expectedVersion" value={grant.version} />
                  <input
                    type="hidden"
                    name="idempotencyKey"
                    value={`grant-revoke-${grant.id}-v${grant.version}`}
                  />
                </AdminMutationForm>
              </li>
            ))}
          </ul>
        </section>
      )}
      {governance.state === "success" && (
        <DeveloperDetails>
          {governance.data.grants.map((grant) => (
            <div key={grant.id}>
              <label htmlFor={`grant-scenario-${grant.id}`}>
                Ellenőrzési forgatókönyv – {grant.subjectLabel}
              </label>
              <select
                id={`grant-scenario-${grant.id}`}
                name="scenario"
                form={`admin-grant-revoke-${grant.id}`}
                defaultValue={grant.isSelf ? "self-lockout" : "success"}
              >
                <option value="success">Szabályos visszavonás</option>
                <option value="self-lockout">Saját hozzáférés védelme</option>
                <option value="retryable">Átmeneti hiba</option>
              </select>
            </div>
          ))}
        </DeveloperDetails>
      )}
    </section>
  );
}
