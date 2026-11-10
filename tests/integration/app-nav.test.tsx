import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppNav, currentNavigationId } from "../../src/runtime/AppNav";
import { BackToHomeLink } from "../../src/runtime/BackToHomeLink";
import { roleProfile } from "../support/role-profiles";

const navigation = vi.hoisted(() => ({
  pathname: null as string | null,
  search: "" as string,
}));
vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useSearchParams: () => new URLSearchParams(navigation.search),
}));

const adminItems = roleProfile("super-admin").navigation;

beforeEach(() => {
  navigation.pathname = null;
  navigation.search = "";
});

describe("AppNav", () => {
  it("renders every item as a button-styled link with a stable test id", () => {
    render(<AppNav items={adminItems} />);
    expect(screen.getByRole("navigation", { name: "Fő navigáció" })).toBeVisible();
    for (const item of adminItems) {
      const link = screen.getByTestId(`app-shell-navigation-${item.id}`);
      expect(link).toHaveAttribute("href", item.href);
      expect(link).toHaveClass("nav-button");
      expect(link).toHaveTextContent(item.label);
    }
    expect(screen.getByTestId("app-shell-navigation-toggle")).toHaveTextContent("Navigáció");
  });

  it("marks no item as current when the path is unknown", () => {
    render(<AppNav items={adminItems} />);
    expect(document.querySelector("[aria-current]")).toBeNull();
  });

  it("marks exactly the current page with aria-current", () => {
    navigation.pathname = "/admin/jovahagyasok";
    render(<AppNav items={adminItems} />);
    const current = document.querySelectorAll("[aria-current]");
    expect(current).toHaveLength(1);
    expect(screen.getByTestId("app-shell-navigation-admin-approvals")).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("keeps the section of a detail page marked", () => {
    navigation.pathname = "/admin/nyilvantartasok/family-feny";
    render(<AppNav items={adminItems} />);
    expect(screen.getByTestId("app-shell-navigation-admin-records")).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByTestId("app-shell-navigation-admin-dashboard")).not.toHaveAttribute(
      "aria-current",
    );
  });
});

describe("AppNav for a parent", () => {
  const parentItems = roleProfile("parent").navigation;

  it("lists Értesítések before Feladatok, then Beosztás, Cserék and Munkacsoportok", () => {
    render(<AppNav items={parentItems} />);
    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual([
      "Értesítések",
      "Feladatok",
      "Beosztás",
      "Cserék",
      "Munkacsoportok",
    ]);
  });

  it("marks Cserék current on the incoming swaps page and not Feladatok", () => {
    navigation.pathname = "/szulo/cserek";
    render(<AppNav items={parentItems} />);
    expect(screen.getByTestId("app-shell-navigation-parent-swaps")).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByTestId("app-shell-navigation-parent-duties")).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("keeps Feladatok current on a task page opened from the task list", () => {
    navigation.pathname = "/szulo/feladatok/duty-assigned";
    render(<AppNav items={parentItems} />);
    expect(screen.getByTestId("app-shell-navigation-parent-duties")).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByTestId("app-shell-navigation-parent-notifications")).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("marks Értesítések current on a task page opened from a notification", () => {
    navigation.pathname = "/szulo/feladatok/duty-assigned";
    navigation.search = "ertesites=notice-7-day";
    render(<AppNav items={parentItems} />);
    expect(document.querySelectorAll("[aria-current]")).toHaveLength(1);
    expect(screen.getByTestId("app-shell-navigation-parent-notifications")).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("ignores the notification parameter outside a task page", () => {
    navigation.pathname = "/szulo/feladatok";
    navigation.search = "ertesites=notice-7-day";
    render(<AppNav items={parentItems} />);
    expect(screen.getByTestId("app-shell-navigation-parent-duties")).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});

describe("currentNavigationId", () => {
  it("lets a task page opened from a notification stand for the notification list", () => {
    const items = roleProfile("parent").navigation;
    expect(currentNavigationId(items, "/szulo/feladatok/duty-1", true)).toBe(
      "parent-notifications",
    );
    expect(currentNavigationId(items, "/szulo/feladatok/duty-1", false)).toBe("parent-duties");
    expect(currentNavigationId(items, "/szulo/feladatok/duty-1/csere", true)).toBe("parent-duties");
    expect(currentNavigationId(adminItems, "/szulo/feladatok/duty-1", true)).toBeUndefined();
  });

  it("matches the dashboard only exactly", () => {
    expect(currentNavigationId(adminItems, "/admin")).toBe("admin-dashboard");
    expect(currentNavigationId(adminItems, "/admin/")).toBe("admin-dashboard");
    expect(currentNavigationId(adminItems, "/admin/ismeretlen")).toBeUndefined();
  });

  it("returns nothing for a missing path or an empty menu", () => {
    expect(currentNavigationId(adminItems, null)).toBeUndefined();
    expect(currentNavigationId([], "/teacher/schedule")).toBeUndefined();
  });

  it("prefers the longest matching address", () => {
    const items = [
      { id: "a", label: "A", href: "/x" },
      { id: "b", label: "B", href: "/x/y" },
    ];
    expect(currentNavigationId(items, "/x/y/z")).toBe("b");
  });
});

describe("BackToHomeLink", () => {
  it("leads the teacher back to Beosztás", () => {
    render(
      <BackToHomeLink homePath="/teacher/schedule" label="Vissza a kezdőlapra" testId="back" />,
    );
    expect(screen.getByTestId("back")).toHaveTextContent("Vissza a beosztáshoz");
    expect(screen.getByTestId("back")).toHaveAttribute("href", "/teacher/schedule");
  });

  it("uses the given label and the person's own default page otherwise", () => {
    render(<BackToHomeLink homePath="/admin" label="Vissza a kezdőlapra" testId="back" />);
    expect(screen.getByTestId("back")).toHaveTextContent("Vissza a kezdőlapra");
    expect(screen.getByTestId("back")).toHaveAttribute("href", "/admin");
  });

  it("falls back to the start page without a session", () => {
    render(<BackToHomeLink label="Vissza a kezdőlapra" />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/");
  });
});
