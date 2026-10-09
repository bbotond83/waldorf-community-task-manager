import Link from "next/link";

export function TeacherAccessState({
  kind,
}: Readonly<{ kind: "signed-out" | "denied" | "configuration-error" }>) {
  const signedOut = kind === "signed-out";
  return (
    <main id="fo-tartalom" className="centered-panel teacher-state" data-testid={`teacher-${kind}`}>
      <p className="eyebrow">Óvónő felület</p>
      <h1 id="hozzaferes-megtagadva" tabIndex={-1} autoFocus>
        {signedOut ? "Bejelentkezés szükséges" : "Nincs jogosultság"}
      </h1>
      <p>
        {signedOut
          ? "A beosztás megtekintéséhez előbb válasszon óvónői profilt."
          : kind === "configuration-error"
            ? "A helyi futtatási beállítás nem érhető el."
            : "A kért tartalom nem érhető el ezzel a profillal."}
      </p>
      <Link href="/" data-testid="teacher-access-home-link">
        Vissza a biztonságos kezdőoldalra
      </Link>
    </main>
  );
}
