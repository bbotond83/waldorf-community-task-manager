import { randomUUID } from "node:crypto";
import { BrandMark } from "../../../src/runtime/BrandMark.tsx";
import { inspectSyntheticInvitation } from "../../../src/parent-web/index.ts";
import { COPY as IDENTITY_COPY } from "../../../src/identity/copy.ts";
import { lookupInvitation } from "../../../src/identity/invitations.ts";
import { getIdentityRuntime, isIdentityConfigured } from "../../../src/identity/runtime.ts";
import { AcceptInvitationForm } from "./AcceptInvitationForm.tsx";
import { InvitationAcceptForm, InvitationResendForm } from "./InvitationActions.tsx";
import { acceptInvitationAction } from "./actions.ts";

const COPY = {
  valid: {
    heading: "Érvényes meghívás",
    message: "A meghívás elfogadható, majd a szülői felületre irányít.",
  },
  expired: {
    heading: "A meghívás lejárt",
    message: "Kérjen új meghívót. A válasz nem árulja el, hogy a cím szerepel-e a rendszerben.",
  },
  used: {
    heading: "A meghívást már felhasználták",
    message: "Ha már van hozzáférése, jelentkezzen be; különben kérjen új meghívót.",
  },
  invalid: {
    heading: "A meghívás nem használható",
    message: "Kérjen új meghívót. A rendszer nem ad fióklétezési információt.",
  },
} as const;

/** A real token is 32 random bytes in base64url (43 characters); the old synthetic tokens are words. */
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

export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const real = await realInvitation(token);
  if (real) {
    const copy = IDENTITY_COPY.invitation;
    return (
      <main
        id="fo-tartalom"
        className="centered-panel parent-public-page"
        data-testid={
          real.validity === "valid" ? "real-invitation-valid" : "real-invitation-not-valid"
        }
      >
        <a className="skip-link" href="#fo-tartalom" data-testid="invitation-skip-link">
          {IDENTITY_COPY.common.skipLink}
        </a>
        <BrandMark />
        {real.validity === "valid" ? (
          <>
            <h1 tabIndex={-1}>{copy.heading}</h1>
            <dl data-testid="real-invitation-details">
              <dt>{copy.roleLabel}</dt>
              <dd>{copy.roles[real.role] ?? real.role}</dd>
              <dt>{copy.scopeLabel}</dt>
              <dd>{copy.scopes[real.scopeType] ?? real.scopeType}</dd>
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

  const state = inspectSyntheticInvitation(token);
  const acceptAction = acceptInvitationAction.bind(null, token);
  return (
    <main
      id="fo-tartalom"
      className="centered-panel parent-public-page"
      data-testid={`invitation-page-${state}`}
    >
      <a className="skip-link" href="#fo-tartalom" data-testid="invitation-skip-link">
        Ugrás a fő tartalomra
      </a>
      <BrandMark />
      <p className="eyebrow">Szülői meghívás</p>
      <h1 tabIndex={-1}>{COPY[state].heading}</h1>
      <p>{COPY[state].message}</p>
      {state === "valid" && <InvitationAcceptForm action={acceptAction} />}
      {state !== "valid" && <InvitationResendForm />}
      <a href="/belepes" data-testid="invitation-login-link">
        Tovább a bejelentkezéshez
      </a>
    </main>
  );
}
