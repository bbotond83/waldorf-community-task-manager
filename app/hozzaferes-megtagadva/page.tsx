import Link from "next/link";

export default function AccessDeniedPage() {
  return (
    <main id="fo-tartalom" className="centered-panel" data-testid="access-denied-state">
      <h1 tabIndex={-1}>Nincs jogosultság</h1>
      <p>A kért tartalom nem érhető el ezzel a profillal.</p>
      <Link href="/" data-testid="access-denied-home-link">
        Vissza a biztonságos kezdőlapra
      </Link>
    </main>
  );
}
