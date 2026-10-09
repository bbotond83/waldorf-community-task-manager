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
    expect(screen.getAllByRole("button")).toHaveLength(4);
    expect(screen.queryByText("Profil használata")).not.toBeInTheDocument();
    expect(screen.getByTestId("profile-selector-parent-local-button")).toBeVisible();
  });

  it("shows the logo with its name and a decorative cover photo on the chooser", () => {
    render(<ProfileSelector profiles={SYNTHETIC_PROFILES} />);
    const logo = screen.getByRole("img", { name: "Cinkotai Waldorf Óvoda" });
    expect(logo).toBeVisible();
    expect(logo.closest("a")).toBeNull();
    const cover = within(screen.getByTestId("selector-hero")).getAllByRole("presentation");
    expect(cover[0]).toHaveAttribute("alt", "");
  });

  it("links the logo in the app header to the start page", () => {
    render(
      <AppShell profile={SYNTHETIC_PROFILES[2]}>
        <h1>Kezdőlap</h1>
      </AppShell>,
    );
    expect(screen.getByTestId("brand-link")).toHaveAttribute("href", "/");
    expect(screen.getByRole("img", { name: "Cinkotai Waldorf Óvoda" })).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("Csoportadminisztrátor profil aktív.");
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

it("shows four role controls and no removed profile selection", () => {
  render(<ProfileSelector profiles={SYNTHETIC_PROFILES} />);
  expect(screen.getByRole("button", { name: /^Óvónő\./ })).toBeVisible();
  expect(screen.getByTestId("profile-selector-kindergarten-teacher-local-button")).toHaveAttribute(
    "type",
    "submit",
  );
  expect(screen.queryByTestId("profile-selector-staff-local-button")).not.toBeInTheDocument();
  expect(
    screen.queryByTestId("profile-selector-kindergarten-admin-local-button"),
  ).not.toBeInTheDocument();
});
it("teacher shell announces localized role and current navigation without mutations", () => {
  render(
    <AppShell profile={SYNTHETIC_PROFILES[1]}>
      <h1>Óvónői kezdőlap</h1>
    </AppShell>,
  );
  expect(screen.getByRole("status")).toHaveTextContent("Óvónő profil aktív.");
  expect(screen.getByTestId("app-shell-navigation-teacher-tracking")).toHaveAttribute(
    "href",
    "/teacher/schedule",
  );
  expect(screen.getByTestId("app-shell-skip-link")).toHaveAttribute("href", "#fo-tartalom");
  expect(screen.getByTestId("app-shell-main")).toHaveAttribute("tabindex", "-1");
  expect(screen.queryByRole("link", { name: "Importálás" })).not.toBeInTheDocument();
});
it("selector uses native keyboard-operable forms and stable accessible submit names", () => {
  render(<ProfileSelector profiles={SYNTHETIC_PROFILES} />);
  for (const profile of SYNTHETIC_PROFILES) {
    const form = screen.getByTestId(`profile-selector-${profile.id}-form`);
    expect(form).toHaveAttribute("method", "post");
    expect(form).toHaveAttribute("action", "/api/synthetic/session");
    const card = within(form).getByRole("button", {
      name: `${profile.label}. ${profile.scopeSummary}`,
    });
    expect(card).toBeEnabled();
    expect(card).toHaveAttribute("type", "submit");
    expect(within(form).getByTestId(`profile-selector-${profile.id}-input`)).toHaveAttribute(
      "value",
      profile.id,
    );
  }
});

it("breaks long role names at syllables in the card but keeps the plain accessible name", () => {
  render(<ProfileSelector profiles={SYNTHETIC_PROFILES} />);
  const card = screen.getByTestId("profile-selector-super-admin-local-button");
  expect(card.textContent).toContain("Szu­per­ad­mi­niszt­rá­tor");
  expect(card).toHaveAccessibleName(/^Szuperadminisztrátor\./);
});
