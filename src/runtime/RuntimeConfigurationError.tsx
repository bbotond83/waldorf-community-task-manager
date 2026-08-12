import type { RuntimeConfigError } from "./config.ts";

export function RuntimeConfigurationError({ error }: { error: RuntimeConfigError }) {
  return (
    <main id="fo-tartalom" className="centered-panel" data-testid="runtime-configuration-error">
      <h1>Az alkalmazás konfigurációja hibás</h1>
      <p>A helyi indítás előtt javítsd a megnevezett beállítást.</p>
      <p>
        <code>{error.code}</code> · <code>{error.variable}</code>
      </p>
    </main>
  );
}
