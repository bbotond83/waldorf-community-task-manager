import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  emptyFilterFields,
  FilterClearLink,
  focusPageHeading,
} from "../../src/runtime/FilterClearLink.tsx";

const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

beforeEach(() => router.push.mockClear());

describe("FilterClearLink", () => {
  it("stays a plain link to the unfiltered address", () => {
    render(
      <FilterClearLink href="/x" className="button-link" testId="clear">
        Szűrők törlése
      </FilterClearLink>,
    );
    expect(screen.getByRole("link", { name: "Szűrők törlése" })).toHaveAttribute("href", "/x");
    expect(screen.getByTestId("clear")).toHaveClass("button-link");
  });

  it("leaves a modified click to the browser (new tab keeps its normal meaning)", () => {
    render(<FilterClearLink href="/x">Törlés</FilterClearLink>);
    const allowed = fireEvent.click(screen.getByRole("link"), { ctrlKey: true });
    expect(allowed).toBe(true);
    expect(router.push).not.toHaveBeenCalled();
  });

  it("empties the form it names, not only the one around it", () => {
    render(
      <>
        <form data-testid="f">
          <input name="q" defaultValue="kert" />
          <input type="hidden" name="keep" defaultValue="1" />
          <input type="checkbox" name="box" defaultChecked />
        </form>
        <FilterClearLink href="/x" formSelector='[data-testid="f"]'>
          Törlés
        </FilterClearLink>
      </>,
    );
    fireEvent.click(screen.getByRole("link"));
    expect(document.querySelector<HTMLInputElement>("[name=q]")!.value).toBe("");
    expect(document.querySelector<HTMLInputElement>("[name=keep]")!.value).toBe("1");
    expect(document.querySelector<HTMLInputElement>("[name=box]")!.checked).toBe(true);
    expect(router.push).toHaveBeenCalledWith("/x");
  });

  it("does nothing to fields when the named form is missing", () => {
    render(
      <FilterClearLink href="/x" formSelector="#missing">
        Törlés
      </FilterClearLink>,
    );
    fireEvent.click(screen.getByRole("link"));
    expect(router.push).toHaveBeenCalledWith("/x");
  });
});

describe("emptyFilterFields and focusPageHeading", () => {
  it("puts a dropdown back on its empty choice, or its first choice when it has none", () => {
    document.body.innerHTML = `<form id="f"><select name="a"><option value="">Mind</option><option value="x" selected>X</option></select><select name="b"><option value="p" selected>P</option><option value="q">Q</option></select></form>`;
    const form = document.getElementById("f") as HTMLFormElement;
    emptyFilterFields(form);
    expect((form.elements.namedItem("a") as HTMLSelectElement).value).toBe("");
    expect((form.elements.namedItem("b") as HTMLSelectElement).value).toBe("p");
  });

  it("focuses the main heading, adds a tab stop, and tolerates a page without one", () => {
    document.body.innerHTML = `<main><h1>Cím</h1></main>`;
    focusPageHeading();
    expect(document.querySelector("h1")).toHaveFocus();
    expect(document.querySelector("h1")).toHaveAttribute("tabindex", "-1");
    document.body.innerHTML = `<p>Nincs cím</p>`;
    expect(() => focusPageHeading()).not.toThrow();
  });
});
