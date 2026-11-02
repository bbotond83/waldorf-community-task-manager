import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BrandMark } from "../../src/runtime/BrandMark.tsx";
import { COPY } from "../../src/identity/copy.ts";
import { currentSession } from "../_identity/current-session.ts";
import { SignInForm } from "./SignInForm.tsx";

export const metadata: Metadata = { title: COPY.signIn.title };
export const dynamic = "force-dynamic";

export default async function SignInPage() {
  // A signed-in person has nothing to do here: `/` routes to the home page of their role.
  if ((await currentSession()).status === "signed-in") redirect("/");
  return (
    <main id="fo-tartalom" className="centered-panel parent-public-page" data-testid="sign-in-page">
      <a className="skip-link" href="#fo-tartalom" data-testid="sign-in-skip-link">
        {COPY.common.skipLink}
      </a>
      <BrandMark />
      <h1 tabIndex={-1}>{COPY.signIn.heading}</h1>
      <SignInForm />
      <p>
        <a href="/jelszo-visszaallitas" data-testid="sign-in-forgot-link">
          {COPY.signIn.forgotLink}
        </a>
      </p>
    </main>
  );
}
