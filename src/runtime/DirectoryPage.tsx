import type { ApplicationResult, DirectoryModel } from "../application/index.ts";
import { DirectorySearch } from "./DirectorySearch.tsx";

function StateMessage({ result }: Readonly<{ result: ApplicationResult<DirectoryModel> }>) {
  if (result.state === "empty") {
    return (
      <section className="parent-state" role="status" data-testid="directory-empty">
        <h2>Még nincs szülő a névsorban.</h2>
        <p>Amint egy családot felvesznek a nyilvántartásba, itt jelenik meg.</p>
      </section>
    );
  }
  const refused = result.state === "denied" || result.state === "invalidated";
  return (
    <section
      className="parent-state"
      role="alert"
      data-testid={refused ? "directory-denied" : "directory-error"}
    >
      <h2>{refused ? "Nincs jogosultság" : "Hiba történt"}</h2>
      <p>
        {refused
          ? "A kért tartalom nem érhető el."
          : "A névsor most nem tölthető be. Próbáld meg később."}
      </p>
    </section>
  );
}

/**
 * The parent directory, shared by the parent, teacher and admin areas. Success, empty, denied and error are separate
 * states (NFR4.5); what each viewer may see was decided by the database before it got here.
 */
export function DirectoryPage({ result }: Readonly<{ result: ApplicationResult<DirectoryModel> }>) {
  return (
    <section className="parent-page parent-directory-page" data-testid="directory-page">
      <header>
        <p className="eyebrow">Közösség</p>
        <h1 tabIndex={-1}>Szülők</h1>
        <p>A közösség családjai és az általuk megosztott elérhetőségek.</p>
      </header>
      {result.state === "success" || result.state === "recovery" ? (
        <DirectorySearch families={result.data.families} />
      ) : (
        <StateMessage result={result} />
      )}
    </section>
  );
}
