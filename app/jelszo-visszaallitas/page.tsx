import type { Metadata } from "next";
import { BrandMark } from "../../src/runtime/BrandMark.tsx";
import { COPY } from "../../src/identity/copy.ts";
import { RequestResetForm } from "./RequestResetForm.tsx";

export const metadata: Metadata = { title: COPY.reset.requestTitle };
export const dynamic = "force-dynamic";

export default function RequestResetPage() {
  return (
    <main
      id="fo-tartalom"
      className="centered-panel parent-public-page"
      data-testid="request-reset-page"
    >
      <a className="skip-link" href="#fo-tartalom" data-testid="request-reset-skip-link">
        {COPY.common.skipLink}
      </a>
      <BrandMark />
      <h1 tabIndex={-1}>{COPY.reset.requestHeading}</h1>
      <p>{COPY.reset.requestIntro}</p>
      <RequestResetForm />
      <p>
        <a href="/bejelentkezes" data-testid="request-reset-back-link">
          {COPY.reset.backToSignIn}
        </a>
      </p>
    </main>
  );
}
