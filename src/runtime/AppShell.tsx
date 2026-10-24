import type { ReactNode } from "react";
import { AppNav } from "./AppNav.tsx";
import { BrandMark } from "./BrandMark.tsx";
import type { ShellProfile } from "./shell-profile.ts";

type AppShellProps = {
  profile: ShellProfile;
  children: ReactNode;
  statusMessage?: string;
  /**
   * What the header offers in place of the test-profile switcher. The synthetic mode passes nothing and
   * keeps the switcher; a real person's session passes its own control (the sign-out button), because a
   * real person never switches to a test profile.
   */
  headerAction?: ReactNode;
};

export function AppShell({ profile, children, statusMessage, headerAction }: AppShellProps) {
  return (
    <div className="app-shell" data-testid="app-shell">
      <a className="skip-link" href="#fo-tartalom" data-testid="app-shell-skip-link">
        Ugrás a fő tartalomra
      </a>
      <header className="site-header">
        <div className="site-header-brand">
          <BrandMark size={48} href={profile.homePath} />
          <div>
            <p className="eyebrow">Waldorf közösségi feladatkezelő</p>
            <p className="profile-summary" data-testid="app-shell-profile-summary">
              <strong>{profile.label}</strong>
              <span>{profile.scopeSummary}</span>
            </p>
          </div>
        </div>
        {headerAction ?? (
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
        )}
      </header>

      {profile.navigation.length > 0 && <AppNav items={profile.navigation} />}

      <main id="fo-tartalom" tabIndex={-1} data-testid="app-shell-main">
        {children}
      </main>
      <div className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">
        {statusMessage ?? `${profile.label} profil aktív.`}
      </div>
    </div>
  );
}
