import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { resolveProductionHome } from "./_identity/production-home";
import { SignOutButton } from "./_identity/SignOutButton";
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
    // A signed-in person goes to the home of their role; everyone else is pointed at the sign-in page.
    const home = await resolveProductionHome();
    if (home.state === "ready") redirect(home.path);
    return (
      <main id="fo-tartalom" className="centered-panel" data-testid="production-auth-boundary">
        <h1>Biztonságos bejelentkezés</h1>
        {home.state === "signed-out" && (
          <>
            <p>A használathoz jelentkezzen be a fiókjával.</p>
            <p>
              <a
                className="button-link"
                href="/bejelentkezes"
                data-testid="production-sign-in-link"
              >
                Bejelentkezés
              </a>
            </p>
          </>
        )}
        {home.state === "no-role" && (
          <>
            <p role="status" data-testid="production-no-role">
              Ehhez a fiókhoz még nem tartozik szerepkör. Kérje az adminisztrátort, hogy hívja meg.
            </p>
            <SignOutButton />
          </>
        )}
        {home.state === "unavailable" && (
          <p role="alert" data-testid="production-unavailable">
            A bejelentkezési szolgáltatás átmenetileg nem érhető el. Próbálja újra később.
          </p>
        )}
      </main>
    );
  }

  const cookieStore = await cookies();
  const session = resolveSyntheticSession(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!session) {
    return <ProfileSelector profiles={composition.value.profiles} />;
  }

  // A signed-in person goes straight to the profile's default page; there is no welcome page.
  redirect(session.profile.homePath);
}
