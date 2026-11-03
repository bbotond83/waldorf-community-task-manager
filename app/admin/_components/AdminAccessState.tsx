import { BackToHomeLink } from "../../../src/runtime/BackToHomeLink.tsx";
import { AccessStateExit } from "../../_identity/AccessStateExit.tsx";

/** Every page under this path renders this same screen, so a link back into it would only loop. */
const ADMIN_AREA = "/admin";

type AdminAccessStateProps = Readonly<{
  kind: "denied" | "configuration-error";
  message?: string;
  embedded?: boolean;
  homePath?: string;
}>;

export function AdminAccessState({
  kind,
  message,
  embedded = false,
  homePath,
}: AdminAccessStateProps) {
  const isDenied = kind === "denied";
  const content = (
    <>
      <p className="eyebrow">Adminisztráció</p>
      <h1 id={isDenied ? "hozzaferes-megtagadva" : "admin-konfiguracios-hiba"} tabIndex={-1}>
        {isDenied ? "Nincs jogosultság" : "Az adminisztráció nem érhető el"}
      </h1>
      <p>
        {isDenied
          ? "Ehhez a művelethez nincs megfelelő jogosultság."
          : (message ?? "Ellenőrizze a helyi futtatási beállításokat.")}
      </p>
      {homePath?.startsWith(ADMIN_AREA) ? null : (
        <BackToHomeLink
          homePath={homePath}
          label="Vissza a kezdőlapra"
          testId="admin-access-state-home-link"
        />
      )}
      <AccessStateExit explain={isDenied} />
    </>
  );
  return embedded ? (
    <section className="admin-page admin-state" data-testid={`admin-${kind}`}>
      {content}
    </section>
  ) : (
    <main id="fo-tartalom" className="centered-panel admin-state" data-testid={`admin-${kind}`}>
      {content}
    </main>
  );
}
