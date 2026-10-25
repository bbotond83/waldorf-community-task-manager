import { randomUUID } from "node:crypto";
import { BrandMark } from "../../../src/runtime/BrandMark.tsx";
import { COPY as IDENTITY_COPY } from "../../../src/identity/copy.ts";
import { lookupInvitation } from "../../../src/identity/invitations.ts";
import { getIdentityRuntime, isIdentityConfigured } from "../../../src/identity/runtime.ts";
import { AcceptInvitationForm } from "./AcceptInvitationForm.tsx";

/** A real token is 32 random bytes in base64url (43 characters). */
const REAL_TOKEN = /^[A-Za-z0-9_-]{43}$/;

async function realInvitation(token: string) {
  if (!REAL_TOKEN.test(token) || !isIdentityConfigured()) return undefined;
  try {
    const runtime = getIdentityRuntime();
    const view = await lookupInvitation(token, { admin: runtime.admin, events: runtime.events });
    return view.validity === "unavailable" ? undefined : view;
  } catch {
    return undefined;
  }
}

/**
 * The invitation page. A token that is not a usable invitation (malformed, unknown, expired, used, or the
 * service could not answer) gets the same plain "not valid" answer, so the page tells nothing about accounts.
 */
export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const real = await realInvitation(token);
  const copy = IDENTITY_COPY.invitation;
  const valid = real?.validity === "valid" ? real : undefined;
  return (
    <main
      id="fo-tartalom"
      className="centered-panel parent-public-page"
      data-testid={valid ? "real-invitation-valid" : "real-invitation-not-valid"}
    >
      <a className="skip-link" href="#fo-tartalom" data-testid="invitation-skip-link">
        {IDENTITY_COPY.common.skipLink}
      </a>
      <BrandMark />
      {valid ? (
        <>
          <h1 tabIndex={-1}>{copy.heading}</h1>
          <dl data-testid="real-invitation-details">
            <dt>{copy.roleLabel}</dt>
            <dd>{copy.roles[valid.role] ?? valid.role}</dd>
            <dt>{copy.scopeLabel}</dt>
            <dd>{copy.scopes[valid.scopeType] ?? valid.scopeType}</dd>
          </dl>
          <AcceptInvitationForm token={token} idempotencyKey={randomUUID()} />
        </>
      ) : (
        <section>
          <h1 tabIndex={-1}>{copy.notValidTitle}</h1>
          <p role="alert" data-testid="real-invitation-not-valid-message">
            {copy.notValid}
          </p>
        </section>
      )}
      <a href="/bejelentkezes" data-testid="invitation-login-link">
        {IDENTITY_COPY.signIn.heading}
      </a>
    </main>
  );
}
