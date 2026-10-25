import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppShell } from "../../src/runtime/AppShell";
import { RuntimeConfigurationError } from "../../src/runtime/RuntimeConfigurationError";
import { shellProfile } from "../support/role-profiles";

describe("runtime shell", () => {
  it("links the logo in the app header to the profile's default page", () => {
    render(
      <AppShell profile={shellProfile("group-admin")}>
        <h1>Kezdőlap</h1>
      </AppShell>,
    );
    expect(screen.getByTestId("brand-link")).toHaveAttribute("href", "/admin");
    expect(screen.getByRole("img", { name: "Cinkotai Waldorf Óvoda" })).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("Csoportadminisztrátor profil aktív.");
  });

  it("renders the semantic shell and role announcement", () => {
    render(
      <AppShell profile={shellProfile("parent")}>
        <h1>Szülői kezdőlap</h1>
      </AppShell>,
    );
    expect(screen.getByRole("banner")).toBeVisible();
    expect(screen.getByRole("main")).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("Szülő profil aktív.");
    expect(screen.getByTestId("app-shell-skip-link")).toHaveAttribute("href", "#fo-tartalom");
  });

  it("has no profile switcher: the header offers only what the page gives it", () => {
    const { rerender } = render(
      <AppShell profile={shellProfile("parent")}>
        <h1>Szülői kezdőlap</h1>
      </AppShell>,
    );
    expect(screen.queryByTestId("app-shell-switch-profile-form")).not.toBeInTheDocument();
    expect(screen.queryByTestId("app-shell-switch-profile-button")).not.toBeInTheDocument();
    expect(screen.queryByText("Tesztprofil váltása")).not.toBeInTheDocument();
    rerender(
      <AppShell profile={shellProfile("parent")} headerAction={<button>Kilépés</button>}>
        <h1>Szülői kezdőlap</h1>
      </AppShell>,
    );
    expect(screen.getByRole("button", { name: "Kilépés" })).toBeVisible();
    expect(screen.queryByTestId("app-shell-switch-profile-button")).not.toBeInTheDocument();
  });

  it("shows the profile summary and a custom status message", () => {
    render(
      <AppShell profile={shellProfile("teacher")} statusMessage="Betöltve.">
        <h1>x</h1>
      </AppShell>,
    );
    expect(screen.getByTestId("app-shell-profile-summary")).toHaveTextContent(
      "A kijelölt csoportok beosztása, módosítás nélkül",
    );
    expect(screen.getByRole("status")).toHaveTextContent("Betöltve.");
  });

  it("projects only parent navigation for a parent profile", () => {
    render(
      <AppShell profile={shellProfile("parent")}>
        <h1>Szülői kezdőlap</h1>
      </AppShell>,
    );
    const navigation = within(screen.getByRole("navigation"));
    expect(navigation.getByRole("link", { name: "Feladatok" })).toHaveAttribute(
      "href",
      "/szulo/feladatok",
    );
    expect(navigation.getByRole("link", { name: "Értesítések" })).toHaveAttribute(
      "href",
      "/szulo/ertesitesek",
    );
    expect(navigation.getByRole("link", { name: "Cserék" })).toHaveAttribute(
      "href",
      "/szulo/cserek",
    );
    expect(navigation.getAllByRole("link")).toHaveLength(3);
    expect(navigation.getAllByRole("link").map((link) => link.textContent)).toEqual([
      "Értesítések",
      "Feladatok",
      "Cserék",
    ]);
    expect(navigation.queryByRole("link", { name: "Importálás" })).not.toBeInTheDocument();
  });

  it.each([
    ["group-admin", 5],
    ["super-admin", 9],
  ] as const)("shows the one menu of %s with %i items", (id, count) => {
    const profile = shellProfile(id);
    render(
      <AppShell profile={profile}>
        <h1>Kezdőlap</h1>
      </AppShell>,
    );
    const links = within(screen.getByRole("navigation")).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual(profile.navigation.map((i) => i.label));
    expect(links).toHaveLength(count);
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

it("teacher shell announces the localized role and has no menu", () => {
  render(
    <AppShell profile={shellProfile("teacher")}>
      <h1>Óvónői kezdőlap</h1>
    </AppShell>,
  );
  expect(screen.getByRole("status")).toHaveTextContent("Óvónő profil aktív.");
  expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  expect(screen.queryByTestId("app-shell-navigation-toggle")).not.toBeInTheDocument();
  expect(screen.getByTestId("brand-link")).toHaveAttribute("href", "/teacher/schedule");
  expect(screen.getByTestId("app-shell-skip-link")).toHaveAttribute("href", "#fo-tartalom");
  expect(screen.getByTestId("app-shell-main")).toHaveAttribute("tabindex", "-1");
  expect(screen.queryByRole("link", { name: "Importálás" })).not.toBeInTheDocument();
});
