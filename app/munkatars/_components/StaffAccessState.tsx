import Link from "next/link";

export function StaffAccessState({
  kind,
}: Readonly<{ kind: "signed-out" | "denied" | "configuration-error" }>) {
  const signedOut = kind === "signed-out";
  return (
    <main id="fo-tartalom" className="centered-panel staff-state" data-testid={`staff-${kind}`}>
      <p className="eyebrow">Munkatársi felület</p>
      <h1 id="hozzaferes-megtagadva" tabIndex={-1} autoFocus>
        {signedOut ? "Bejelentkezés szükséges" : "Nincs jogosultság"}
      </h1>
      <p>
        {signedOut
          ? "A beosztás megtekintéséhez előbb válasszon munkatársi profilt."
          : kind === "configuration-error"
            ? "A helyi futtatási beállítás nem érhető el."
            : "A kért tartalom nem érhető el ezzel a profillal."}
      </p>
      <Link href="/" data-testid="staff-access-home-link">
        Vissza a biztonságos kezdőoldalra
      </Link>
    </main>
  );
}
