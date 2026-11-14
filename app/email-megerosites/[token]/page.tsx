import { BrandMark } from "../../../src/runtime/BrandMark.tsx";
import { COPY as IDENTITY_COPY } from "../../../src/identity/copy.ts";
import { ConfirmEmailForm } from "./ConfirmEmailForm.tsx";

/** A token is 32 random bytes in base64url; anything else is shown as no longer valid without a request. */
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{8,128}$/;

export default async function ConfirmEmailPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <main
      id="fo-tartalom"
      className="centered-panel parent-public-page parent-confirm-page"
      data-testid="email-confirm-page"
    >
      <a className="skip-link" href="#fo-tartalom">
        {IDENTITY_COPY.common.skipLink}
      </a>
      <BrandMark />
      <p className="eyebrow">Fiókbiztonság és hitelesítés</p>
      {TOKEN_SHAPE.test(token) ? (
        <ConfirmEmailForm token={token} />
      ) : (
        <section className="parent-state" role="alert" data-testid="email-confirm-not-valid">
          <h1 tabIndex={-1}>A hivatkozás már nem érvényes</h1>
          <p>Ez a hivatkozás már nem érvényes. Kérj újat a Fiókom oldalon.</p>
          <a className="button-link" href="/szulo/fiokom">
            Vissza a Fiókomhoz
          </a>
        </section>
      )}
    </main>
  );
}
