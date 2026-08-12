import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppShell } from "../../src/runtime/AppShell";
import { ProfileSelector } from "../../src/runtime/ProfileSelector";
import { RuntimeConfigurationError } from "../../src/runtime/RuntimeConfigurationError";
import { SYNTHETIC_PROFILES } from "../../src/runtime/synthetic/profiles";

describe("runtime shell", () => {
  it("renders every privacy-safe test profile with stable controls", () => {
    render(<ProfileSelector profiles={SYNTHETIC_PROFILES} />);
    expect(screen.getByRole("heading", { name: "Helyi tesztprofil kiválasztása" })).toBeVisible();
    expect(screen.getAllByRole("button", { name: "Profil használata" })).toHaveLength(5);
    expect(screen.getByTestId("profile-selector-parent-local-button")).toBeVisible();
  });

  it("renders the semantic shell and role announcement", () => {
    render(
      <AppShell profile={SYNTHETIC_PROFILES[0]}>
        <h1>Szülői kezdőlap</h1>
      </AppShell>,
    );
    expect(screen.getByRole("banner")).toBeVisible();
    expect(screen.getByRole("main")).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("Szülő profil aktív.");
    expect(screen.getByTestId("app-shell-skip-link")).toHaveAttribute("href", "#fo-tartalom");
  });

  it("projects only parent navigation for a parent profile", () => {
    render(
      <AppShell profile={SYNTHETIC_PROFILES[0]}>
        <h1>Szülői kezdőlap</h1>
      </AppShell>,
    );
    const navigation = within(screen.getByRole("navigation"));
    expect(navigation.getByRole("link", { name: "Feladatok" })).toHaveAttribute(
      "href",
      "/szulo/feladatok",
    );
    expect(navigation.queryByRole("link", { name: "Importálás" })).not.toBeInTheDocument();
  });

  it("renders a redacted configuration failure", () => {
    render(
      <RuntimeConfigurationError
        error={{
          code: "CONFIG_PRODUCTION_INVALID",
          variable: "APP_SESSION_SECRET",
          message: "Production runtime configuration is invalid.",
        }}
      />,
    );
    expect(screen.getByRole("heading")).toHaveTextContent("konfigurációja hibás");
    expect(screen.getByText("CONFIG_PRODUCTION_INVALID")).toBeVisible();
    expect(document.body).not.toHaveTextContent("Production runtime configuration is invalid.");
  });
});
