import { randomUUID } from "node:crypto";
import type { OwnProfileModel } from "../../../src/application/index.ts";
import { terminalFailure } from "../../../src/application/results.ts";
import {
  pendingEmailChange,
  type PendingEmailChange,
} from "../../../src/identity/account-changes.ts";
import { accountChangeDeps, getIdentityRuntime } from "../../../src/identity/runtime.ts";
import { readTokenClaims } from "../../../src/identity/service.ts";
import { currentSession } from "../../_identity/current-session.ts";
import { STATUS_ICON_CHARACTERS } from "../../../src/application/status-labels.ts";
import { StatusBadge } from "../../../src/runtime/StatusBadge.tsx";
import { ParentTextField } from "../_components/ParentFields.tsx";
import { ParentMutationForm } from "../_components/ParentMutationForm.tsx";
import { resolveDirectoryFacade } from "../_lib/facade.ts";
import { resolveParentSession } from "../_lib/session.ts";
import {
  cancelEmailChangeAction,
  changePasswordAction,
  requestEmailChangeAction,
  resendEmailChangeAction,
  saveProfileAction,
  saveSharingAction,
} from "./actions.ts";

type PendingState =
  { state: "none" } | { state: "pending"; change: PendingEmailChange } | { state: "error" };

/** The pending address request of the signed-in account; a failure is its own state, not "nothing pending". */
async function readPending(accountId: string): Promise<PendingState> {
  try {
    const runtime = getIdentityRuntime();
    const result = await pendingEmailChange({ accountId }, accountChangeDeps(runtime));
    if (result.state !== "success") return { state: "error" };
    return result.data ? { state: "pending", change: result.data } : { state: "none" };
  } catch {
    return { state: "error" };
  }
}

const key = (prefix: string) => `${prefix}:${randomUUID()}`;

function HiddenKey({ prefix }: Readonly<{ prefix: string }>) {
  return <input type="hidden" name="idempotencyKey" value={key(prefix)} />;
}

function ProfilePanel({ profile }: Readonly<{ profile: OwnProfileModel }>) {
  return (
    <section
      className="parent-account-panel"
      aria-labelledby="fiok-adataim"
      data-testid="account-details-panel"
    >
      <p className="eyebrow">Személyes adatok</p>
      <h2 id="fiok-adataim">Adataim</h2>
      <p>
        Ezeket az adatokat más szülők csak akkor látják, ha a Láthatóság panelen engedélyezed. Az
        e-mail-címedet a Bejelentkezés panelen tudod módosítani.
      </p>
      <ParentMutationForm
        action={saveProfileAction}
        submitLabel="Adataim mentése"
        testId="account-details-form"
        freshIdempotencyKey
      >
        <HiddenKey prefix="profile" />
        <input type="hidden" name="expectedVersion" value={profile.version} />
        <ParentTextField
          id="profile-phone"
          name="phone"
          label="Telefonszám"
          type="tel"
          autoComplete="tel"
          defaultValue={profile.phone}
          maxLength={20}
          testId="account-phone"
        />
        <ParentTextField
          id="profile-residence"
          name="residence"
          label="Lakóhely"
          defaultValue={profile.residence}
          maxLength={100}
          testId="account-residence"
        />
        <ParentTextField
          id="profile-occupation"
          name="occupation"
          label="Foglalkozás"
          defaultValue={profile.occupation}
          maxLength={100}
          testId="account-occupation"
        />
        <ParentTextField
          id="profile-hobby"
          name="hobby"
          label="Hobbi"
          defaultValue={profile.hobby}
          maxLength={200}
          testId="account-hobby"
        />
        <ParentTextField
          id="profile-support"
          name="howISupport"
          label="Hogyan támogatom a közösséget"
          multiline
          defaultValue={profile.howISupport}
          maxLength={500}
          testId="account-support"
        />
      </ParentMutationForm>
    </section>
  );
}

function SharingPanel({ profile }: Readonly<{ profile: OwnProfileModel }>) {
  return (
    <section
      className="parent-account-panel"
      aria-labelledby="fiok-lathatosag"
      data-testid="account-sharing-panel"
    >
      <p className="eyebrow">Adatmegosztás a közösségben</p>
      <h2 id="fiok-lathatosag">Láthatóság</h2>
      <p data-testid="account-sharing-current">
        Jelenleg:{" "}
        {profile.sharingConsent
          ? "az adataid láthatók a közösségnek."
          : "az adataid nem láthatók a közösségnek."}
      </p>
      <dl className="parent-account-explain">
        <dt>Ha bejelölöd</dt>
        <dd>
          A többi szülő és az óvónők látják a telefonszámodat, az e-mail-címedet, a lakóhelyedet, a
          foglalkozásodat, a hobbidat és azt, hogyan támogatod a közösséget. Ha a családod minden
          szülője bejelölte, a gyermekeitek keresztneve is látszik a szülőknek.
        </dd>
        <dt>Ha nem jelölöd be</dt>
        <dd>
          A többi szülő csak a nevedet látja. Az óvónők a nevedet, a telefonszámodat és az
          e-mail-címedet látják. Az adminisztrátor a teljes nyilvántartást látja.
        </dd>
      </dl>
      <ParentMutationForm
        action={saveSharingAction}
        submitLabel="Láthatóság mentése"
        testId="account-sharing-form"
        freshIdempotencyKey
      >
        <HiddenKey prefix="sharing" />
        <input type="hidden" name="expectedVersion" value={profile.version} />
        <label className="parent-check">
          <input
            type="checkbox"
            name="sharing"
            defaultChecked={profile.sharingConsent}
            data-testid="account-sharing-checkbox"
          />
          Megosztom az adataimat a közösséggel
        </label>
      </ParentMutationForm>
    </section>
  );
}

function PendingNotice({ pending }: Readonly<{ pending: PendingState }>) {
  if (pending.state === "error") {
    return (
      <p className="parent-state" role="alert" data-testid="account-pending-error">
        A függőben lévő címváltoztatás állapota most nem olvasható. Próbáld újra később.
      </p>
    );
  }
  if (pending.state === "none") return null;
  return (
    <div className="parent-notice" role="status" data-testid="account-email-pending">
      <p>
        <strong>Megerősítésre vár: {pending.change.newEmail}.</strong> A régi cím marad érvényes,
        amíg meg nem erősíted.
      </p>
      <div className="parent-account-actions">
        <ParentMutationForm
          action={cancelEmailChangeAction}
          submitLabel="Mégse"
          testId="account-email-cancel-form"
          freshIdempotencyKey
        >
          <HiddenKey prefix="emailcancel" />
        </ParentMutationForm>
        <ParentMutationForm
          action={resendEmailChangeAction}
          submitLabel="Új levél"
          testId="account-email-resend-form"
          freshIdempotencyKey
        >
          <HiddenKey prefix="emailresend" />
        </ParentMutationForm>
      </div>
    </div>
  );
}

function SignInPanel({ email, pending }: Readonly<{ email?: string; pending: PendingState }>) {
  return (
    <section
      className="parent-account-panel"
      aria-labelledby="fiok-bejelentkezes"
      data-testid="account-signin-panel"
    >
      <p className="eyebrow">Fiókadatok és biztonság</p>
      <h2 id="fiok-bejelentkezes">Bejelentkezés</h2>
      {email && (
        <p data-testid="account-signin-email">
          Bejelentkezési e-mail-cím: <strong>{email}</strong>{" "}
          <StatusBadge
            className="parent-account-badge"
            label="Megerősített e-mail"
            symbol={CHECK_SYMBOL}
            testId="account-email-confirmed-badge"
          />
        </p>
      )}
      <PendingNotice pending={pending} />
      <h3>E-mail-cím módosítása</h3>
      <ParentMutationForm
        action={requestEmailChangeAction}
        submitLabel="Megerősítő levél küldése"
        testId="account-email-form"
        freshIdempotencyKey
      >
        <HiddenKey prefix="emailchange" />
        <ParentTextField
          id="email-new"
          name="email"
          label="Új e-mail-cím"
          type="email"
          autoComplete="email"
          maxLength={254}
          testId="account-email-new"
        />
        <ParentTextField
          id="email-password"
          name="currentPassword"
          label="Jelenlegi jelszó"
          type="password"
          autoComplete="current-password"
          testId="account-email-password"
        />
      </ParentMutationForm>
      <h3>Jelszó módosítása</h3>
      <ParentMutationForm
        action={changePasswordAction}
        submitLabel="Jelszó módosítása"
        testId="account-password-form"
        freshIdempotencyKey
        afterSuccess={<p>A következő bejelentkezésnél már az új jelszavadat használd.</p>}
      >
        <HiddenKey prefix="password" />
        <ParentTextField
          id="password-current"
          name="currentPassword"
          label="Jelenlegi jelszó"
          type="password"
          autoComplete="current-password"
          testId="account-password-current"
        />
        <div className="parent-account-password-pair">
          <ParentTextField
            id="password-new"
            name="newPassword"
            label="Új jelszó"
            type="password"
            autoComplete="new-password"
            testId="account-password-new"
          />
          <ParentTextField
            id="password-repeat"
            name="newPasswordRepeat"
            label="Új jelszó még egyszer"
            type="password"
            autoComplete="new-password"
            testId="account-password-repeat"
          />
        </div>
      </ParentMutationForm>
    </section>
  );
}

const CHECK_SYMBOL = Object.freeze({
  icon: "check" as const,
  character: STATUS_ICON_CHARACTERS.check,
});

/** "Fiókom": the parent's own details, sharing choice and sign-in settings (US3.2 to US3.4). */
export default async function AccountPage() {
  const session = await resolveParentSession();
  const directory = await resolveDirectoryFacade();
  const profile =
    session.state === "success" && directory
      ? await directory.ownProfile(
          session.data.applicationSession,
          session.data.familyScope,
          session.data.parentId,
        )
      : terminalFailure<OwnProfileModel>();
  const signedIn = await currentSession();
  const accountId = signedIn.status === "signed-in" ? signedIn.accountId : undefined;
  const email =
    signedIn.status === "signed-in" ? readTokenClaims(signedIn.accessToken)?.email : undefined;
  const pending: PendingState = accountId ? await readPending(accountId) : { state: "error" };
  const refused = profile.state === "denied" || profile.state === "invalidated";
  return (
    <section className="parent-page parent-account-page" data-testid="account-page">
      <header>
        <p className="eyebrow">Szülői felület</p>
        <div className="parent-account-title">
          <h1 tabIndex={-1}>Fiókom</h1>
          {(profile.state === "success" || profile.state === "recovery") && (
            <StatusBadge
              className="parent-account-badge"
              label="Hitelesített szülő"
              symbol={CHECK_SYMBOL}
              testId="account-verified-badge"
            />
          )}
        </div>
        <p>Az adataid, a láthatóságuk és a bejelentkezési beállításaid egy helyen.</p>
      </header>
      {profile.state === "success" || profile.state === "recovery" ? (
        <>
          <ProfilePanel profile={profile.data} />
          <SharingPanel profile={profile.data} />
        </>
      ) : (
        <section
          className="parent-state"
          role="alert"
          data-testid={refused ? "account-denied" : "account-error"}
        >
          <h2>{refused ? "Nincs jogosultság" : "Hiba történt"}</h2>
          <p>
            {refused
              ? "Az adataid nem érhetők el ezzel a fiókkal."
              : "Az adataid most nem tölthetők be. Próbáld meg később."}
          </p>
        </section>
      )}
      <SignInPanel email={typeof email === "string" ? email : undefined} pending={pending} />
    </section>
  );
}
