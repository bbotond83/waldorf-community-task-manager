export function ParentAccessState({
  kind,
}: Readonly<{ kind: "signed-out" | "denied" | "configuration-error" }>) {
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
      <Link href="/">Vissza a biztonságos kezdőoldalra</Link>
    </section>
  );
}
import Link from "next/link";
