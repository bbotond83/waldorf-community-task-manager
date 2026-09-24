"use client";

import { useEffect } from "react";

export default function AdminError({
  error,
  reset,
}: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  useEffect(() => {
    console.error("Admin route failure", { digest: error.digest });
  }, [error.digest]);

  return (
    <section className="admin-page admin-state" data-testid="admin-terminal-error">
      <p className="eyebrow">Adminisztráció</p>
      <h1 id="admin-hiba" tabIndex={-1}>
        Hiba történt
      </h1>
      <p>Az oldal betöltése sikertelen. A védett adatok nem jeleníthetők meg.</p>
      <button type="button" onClick={reset} data-testid="admin-terminal-error-retry-button">
        Újrapróbálás
      </button>
    </section>
  );
}
