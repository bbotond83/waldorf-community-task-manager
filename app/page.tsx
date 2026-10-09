import { cookies } from "next/headers";
import { redirect } from "next/navigation";
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

  // A signed-in person goes straight to the profile's default page; there is no welcome page.
  redirect(session.profile.homePath);
}
