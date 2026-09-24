import { cookies } from "next/headers";
import { AppShell } from "../src/runtime/AppShell";
import { composeRuntime } from "../src/runtime/composition";
import { ProfileSelector } from "../src/runtime/ProfileSelector";
import { RuntimeConfigurationError } from "../src/runtime/RuntimeConfigurationError";
import { resolveSyntheticSession, SESSION_COOKIE_NAME } from "../src/runtime/session/session";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const composition = await composeRuntime();
  if (!composition.ok) {
    return <RuntimeConfigurationError error={composition.error} />;
  }

  if (composition.value.mode === "production") {
    return (
      <main id="fo-tartalom" className="centered-panel" data-testid="production-auth-boundary">
        <h1>Biztonságos bejelentkezés</h1>
        <p>Az éles hitelesítési kapcsolat még nincs összekötve ebben a helyi környezetben.</p>
      </main>
    );
  }

  const cookieStore = await cookies();
  const session = resolveSyntheticSession(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!session) {
    return <ProfileSelector profiles={composition.value.profiles} />;
  }

  return (
    <AppShell profile={session.profile}>
      <section className="home-panel">
        <p className="eyebrow">Helyi, szintetikus munkamenet</p>
        <h1 tabIndex={-1} autoFocus>
          Üdvözlünk, {session.profile.label}!
        </h1>
        <p>
          A megjelenő navigáció kizárólag a tesztprofil számára engedélyezett célokat tartalmazza. A
          részletes munkafelületek a következő szállítási egységekben készülnek el.
        </p>
      </section>
    </AppShell>
  );
}
