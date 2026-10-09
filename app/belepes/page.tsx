import { BrandMark } from "../../src/runtime/BrandMark.tsx";
import { getSyntheticProfile } from "../../src/runtime/synthetic/profiles.ts";
import { resolveParentSession } from "../szulo/_lib/session.ts";
import { AuthenticationEntry } from "./AuthenticationEntry.tsx";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ tovabb?: string }>;
}) {
  const defaultPath = getSyntheticProfile("parent-local")!.homePath;
  const { tovabb = defaultPath } = await searchParams;
  const intendedPath = /^\/szulo(?:\/|$)/.test(tovabb) ? tovabb : defaultPath;
  const session = await resolveParentSession();
  return (
    <main id="fo-tartalom" className="centered-panel parent-public-page" data-testid="login-page">
      <a className="skip-link" href="#fo-tartalom" data-testid="login-skip-link">
        Ugrás a fő tartalomra
      </a>
      <BrandMark />
      <p className="eyebrow">Szülői belépés</p>
      <h1 tabIndex={-1}>Bejelentkezés</h1>
      {session.state === "success" ? (
        <section data-testid="upcoming-duty-notice">
          <h2>Közelgő feladat</h2>
          <p>A következő vállalt feladat: Lámpás ünnep előkészítése.</p>
          <a href={intendedPath} data-testid="upcoming-duty-link">
            Tovább az alkalmazásba
          </a>
        </section>
      ) : (
        <>
          <AuthenticationEntry intendedPath={intendedPath} />
          <p data-testid="upcoming-duty-empty">
            Bejelentkezés után a közelgő feladat vagy az üres állapot jelenik meg.
          </p>
        </>
      )}
    </main>
  );
}
