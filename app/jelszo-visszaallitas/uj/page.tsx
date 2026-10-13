import type { Metadata } from "next";
import { BrandMark } from "../../../src/runtime/BrandMark.tsx";
import { COPY } from "../../../src/identity/copy.ts";
import { SetPasswordForm } from "./SetPasswordForm.tsx";

export const metadata: Metadata = { title: COPY.reset.newTitle };
export const dynamic = "force-dynamic";

/** The emailed link carries `token_hash` and `type=recovery`; opening it only shows this page (BR2.12). */
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{8,128}$/;

export default async function SetNewPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; type?: string }>;
}) {
  const { token_hash: tokenHash, type } = await searchParams;
  const usable = type === "recovery" && tokenHash !== undefined && TOKEN_SHAPE.test(tokenHash);
  return (
    <main
      id="fo-tartalom"
      className="centered-panel parent-public-page"
      data-testid="set-password-page"
    >
      <a className="skip-link" href="#fo-tartalom" data-testid="set-password-skip-link">
        {COPY.common.skipLink}
      </a>
      <BrandMark />
      {usable ? (
        <>
          <h1 tabIndex={-1}>{COPY.reset.newHeading}</h1>
          <SetPasswordForm tokenHash={tokenHash} />
        </>
      ) : (
        <section data-testid="set-password-not-valid">
          <h1 tabIndex={-1}>{COPY.reset.newHeading}</h1>
          <p role="alert">{COPY.reset.notValid}</p>
          <a href="/jelszo-visszaallitas" data-testid="set-password-request-link">
            {COPY.reset.requestNewLink}
          </a>
        </section>
      )}
    </main>
  );
}
