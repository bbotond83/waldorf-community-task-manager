import type { ReactNode } from "react";
import { BrandMark } from "./BrandMark.tsx";
import type { SyntheticProfile } from "./synthetic/profiles.ts";

type AppShellProps = {
  profile: SyntheticProfile;
  children: ReactNode;
  statusMessage?: string;
};

export function AppShell({ profile, children, statusMessage }: AppShellProps) {
  return (
    <div className="app-shell" data-testid="app-shell">
      <a className="skip-link" href="#fo-tartalom" data-testid="app-shell-skip-link">
        Ugrás a fő tartalomra
      </a>
      <header className="site-header">
        <div className="site-header-brand">
          <BrandMark size={48} />
          <div>
            <p className="eyebrow">Waldorf közösségi feladatkezelő</p>
            <p className="profile-summary" data-testid="app-shell-profile-summary">
              <strong>{profile.label}</strong>
              <span>{profile.scopeSummary}</span>
            </p>
          </div>
        </div>
        <form
          action="/api/synthetic/session"
          method="post"
          data-testid="app-shell-switch-profile-form"
        >
          <input
            type="hidden"
            name="profileId"
            value=""
            data-testid="app-shell-switch-profile-input"
          />
          <button
            className="secondary-button"
            type="submit"
            data-testid="app-shell-switch-profile-button"
          >
            Tesztprofil váltása
          </button>
        </form>
      </header>

      <details className="navigation-panel" open>
        <summary data-testid="app-shell-navigation-toggle">Navigáció</summary>
        <nav aria-label="Fő navigáció" data-testid="app-shell-navigation">
          <ul>
            {profile.navigation.map((item) => (
              <li key={item.id}>
                <a href={item.href} data-testid={`app-shell-navigation-${item.id}`}>
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </details>

      <main id="fo-tartalom" tabIndex={-1} data-testid="app-shell-main">
        {children}
      </main>
      <div className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">
        {statusMessage ?? `${profile.label} profil aktív.`}
      </div>
    </div>
  );
}
