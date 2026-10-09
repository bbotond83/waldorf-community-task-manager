import { BackToHomeLink } from "../../../src/runtime/BackToHomeLink.tsx";

export function ParentAccessState({
  kind,
  homePath,
}: Readonly<{ kind: "signed-out" | "denied" | "configuration-error"; homePath?: string }>) {
  if (kind === "signed-out") {
    return (
      <section className="centered-panel" data-testid="parent-signed-out">
        <h1 tabIndex={-1}>Bejelentkezés szükséges</h1>
        <p>A szülői felülethez előbb jelentkezzen be.</p>
        <a href="/belepes" data-testid="parent-login-link">
          Tovább a bejelentkezéshez
        </a>
      </section>
    );
  }
  return (
    <section
      id="hozzaferes-megtagadva"
      className="centered-panel"
      tabIndex={-1}
      data-testid="parent-access-denied"
    >
      <h1>Nincs jogosultság</h1>
      <p>
        {kind === "configuration-error"
          ? "A helyi futtatási beállítás nem érhető el."
          : "A kért tartalom nem érhető el ezzel a profillal."}
      </p>
      <BackToHomeLink
        homePath={homePath}
        label="Vissza a biztonságos kezdőoldalra"
        testId="parent-access-home-link"
      />
    </section>
  );
}
