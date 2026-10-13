import type { Metadata } from "next";
import { BrandMark } from "../../src/runtime/BrandMark.tsx";
import { COPY } from "../../src/identity/copy.ts";
import { SignOutButton } from "../_identity/SignOutButton.tsx";
import { currentSession } from "../_identity/current-session.ts";
import { SignInForm } from "./SignInForm.tsx";

export const metadata: Metadata = { title: COPY.signIn.title };
export const dynamic = "force-dynamic";

export default async function SignInPage() {
  const session = await currentSession();
  return (
    <main id="fo-tartalom" className="centered-panel parent-public-page" data-testid="sign-in-page">
      <a className="skip-link" href="#fo-tartalom" data-testid="sign-in-skip-link">
        {COPY.common.skipLink}
      </a>
      <BrandMark />
      {session.status === "signed-in" ? (
        <section data-testid="signed-in-panel">
          <h1 tabIndex={-1}>{COPY.signIn.signedInHeading}</h1>
          <p role="status">{COPY.signIn.signedInMessage}</p>
          <SignOutButton />
        </section>
      ) : (
        <>
          <h1 tabIndex={-1}>{COPY.signIn.heading}</h1>
          <SignInForm />
          <p>
            <a href="/jelszo-visszaallitas" data-testid="sign-in-forgot-link">
              {COPY.signIn.forgotLink}
            </a>
          </p>
        </>
      )}
    </main>
  );
}
