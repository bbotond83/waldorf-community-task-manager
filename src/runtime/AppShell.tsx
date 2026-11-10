import type { ReactNode } from "react";
import { AppNav } from "./AppNav.tsx";
import { BrandMark } from "./BrandMark.tsx";
import type { ShellProfile } from "./shell-profile.ts";

type AppShellProps = {
  profile: ShellProfile;
  children: ReactNode;
  statusMessage?: string;
  /** What the header offers next to the person's name: the sign-out button of the real session. */
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
        {profile.switchLink && (
          <a
            className="button-link button-link-secondary site-header-switch"
            href={profile.switchLink.href}
            data-testid="app-shell-switch-link"
          >
            {profile.switchLink.label}
          </a>
        )}
        {headerAction}
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
