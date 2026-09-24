type AdminAccessStateProps = Readonly<{
  kind: "denied" | "configuration-error";
  message?: string;
  embedded?: boolean;
}>;

export function AdminAccessState({ kind, message, embedded = false }: AdminAccessStateProps) {
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
      <Link href="/" data-testid="admin-access-state-home-link">
        Vissza a kezdőlapra
      </Link>
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
import Link from "next/link";
