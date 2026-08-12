import { inspectSyntheticInvitation } from "../../../src/parent-web/index.ts";
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

export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
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
