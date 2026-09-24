import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AdminAccessState } from "../../app/admin/_components/AdminAccessState.tsx";
import { AdminFilterBar } from "../../app/admin/_components/AdminFilterBar.tsx";
import { AdminPagination } from "../../app/admin/_components/AdminPagination.tsx";
import { AdminMutationForm } from "../../app/admin/_components/AdminMutationForm.tsx";
import { AsyncStatePanel } from "../../app/admin/_components/AsyncStatePanel.tsx";
import { ResponsiveCollection } from "../../app/admin/_components/ResponsiveCollection.tsx";
import {
  conflict,
  denied,
  empty,
  retryableFailure,
  success,
  terminalFailure,
  validation,
} from "../../src/application/index.ts";

describe("AsyncStatePanel", () => {
  it("renders authorized success data", () => {
    render(
      <AsyncStatePanel result={success({ count: 3 })} testId="panel" emptyMessage="Üres">
        {(data) => <span>{data.count}</span>}
      </AsyncStatePanel>,
    );
    expect(screen.getByTestId("panel")).toHaveTextContent("3");
  });

  it("renders empty and denied without data", () => {
    const { rerender } = render(
      <AsyncStatePanel result={empty()} testId="panel" emptyMessage="Nincs adat">
        {() => <span>védett</span>}
      </AsyncStatePanel>,
    );
    expect(screen.getByText("Nincs adat")).toBeInTheDocument();
    rerender(
      <AsyncStatePanel result={denied()} testId="panel" emptyMessage="Nincs adat">
        {() => <span>védett</span>}
      </AsyncStatePanel>,
    );
    expect(screen.getByText("Nincs jogosultság")).toBeInTheDocument();
    expect(screen.queryByText("védett")).not.toBeInTheDocument();
  });

  it("distinguishes validation, conflict, retryable, and terminal failures", () => {
    const states = [
      validation({ title: "required" }),
      conflict(),
      retryableFailure({ idempotencyKey: "retry:key:1", action: "save" }),
      terminalFailure(),
    ];
    const { rerender } = render(
      <AsyncStatePanel result={states[0]!} testId="panel" emptyMessage="Üres">
        {() => null}
      </AsyncStatePanel>,
    );
    expect(screen.getByTestId("panel-validation")).toBeInTheDocument();
    rerender(
      <AsyncStatePanel result={states[1]!} testId="panel" emptyMessage="Üres">
        {() => null}
      </AsyncStatePanel>,
    );
    expect(screen.getByTestId("panel-conflict")).toBeInTheDocument();
    rerender(
      <AsyncStatePanel result={states[2]!} testId="panel" emptyMessage="Üres">
        {() => null}
      </AsyncStatePanel>,
    );
    expect(screen.getByTestId("panel-retryable")).toBeInTheDocument();
    rerender(
      <AsyncStatePanel result={states[3]!} testId="panel" emptyMessage="Üres">
        {() => null}
      </AsyncStatePanel>,
    );
    expect(screen.getByTestId("panel-terminal")).toBeInTheDocument();
  });
});

describe("administrator shared presentation", () => {
  it("renders stable collection links and states", () => {
    render(
      <ResponsiveCollection
        items={[{ id: "family-feny", title: "Fenyő család", state: "active", version: 1 }]}
        basePath="/admin/nyilvantartasok"
        testId="records"
      />,
    );
    expect(screen.getByTestId("records-item-family-feny")).toHaveTextContent("active");
    expect(screen.getByTestId("records-open-family-feny")).toHaveAttribute(
      "href",
      "/admin/nyilvantartasok/family-feny",
    );
  });

  it("renders empty collection without an interactive link", () => {
    render(<ResponsiveCollection items={[]} basePath="/admin/nyilvantartasok" testId="records" />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("renders multiple collection entries without leaking unrelated text", () => {
    render(
      <ResponsiveCollection
        items={[
          { id: "family-feny", title: "Fenyő család", state: "active" },
          { id: "group-boroka", title: "Boróka csoport", state: "active" },
        ]}
        basePath="/admin/nyilvantartasok"
        testId="records"
      />,
    );
    expect(screen.getAllByRole("link")).toHaveLength(2);
    expect(document.body).not.toHaveTextContent("email");
  });

  it("renders generic denial without protected identifiers", () => {
    render(<AdminAccessState kind="denied" />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Nincs jogosultság");
    expect(document.body).not.toHaveTextContent("family-feny");
  });

  it("renders a safe configuration failure", () => {
    render(<AdminAccessState kind="configuration-error" message="Hiányzó futtatási beállítás." />);
    expect(screen.getByTestId("admin-configuration-error")).toHaveTextContent(
      "Hiányzó futtatási beállítás",
    );
  });

  it("uses a safe fallback for configuration failure without details", () => {
    render(<AdminAccessState kind="configuration-error" />);
    expect(screen.getByTestId("admin-configuration-error")).toHaveTextContent(
      "Ellenőrizze a helyi futtatási beállításokat",
    );
  });

  it("renders labelled filter controls and stable test ids", () => {
    render(<AdminFilterBar action="/admin/feladatok" query="kert" state="open" />);
    expect(screen.getByLabelText("Keresés")).toHaveValue("kert");
    expect(screen.getByLabelText("Állapot")).toHaveValue("open");
    expect(screen.getByTestId("admin-filter-submit-button")).toBeInTheDocument();
  });

  it("renders empty filter defaults", () => {
    render(<AdminFilterBar action="/admin/feladatok" />);
    expect(screen.getByLabelText("Keresés")).toHaveValue("");
    expect(screen.getByLabelText("Állapot")).toHaveValue("");
  });

  it("preserves Hungarian search input", () => {
    render(<AdminFilterBar action="/admin/feladatok" query="Lámpás ünnep" />);
    expect(screen.getByLabelText("Keresés")).toHaveValue("Lámpás ünnep");
  });

  it("renders bounded pagination semantics", () => {
    render(<AdminPagination />);
    expect(screen.getByRole("navigation", { name: "Lapozás" })).toHaveTextContent("1. oldal");
    expect(screen.getByText("Előző oldal")).toHaveAttribute("aria-disabled", "true");
  });

  it("does not expose unusable pagination links", () => {
    render(<AdminPagination />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("Következő oldal")).toHaveAttribute("aria-disabled", "true");
  });
});

describe("AdminMutationForm", () => {
  it("renders an enabled labelled mutation action initially", () => {
    render(
      <AdminMutationForm
        action={async () => ({ state: "success", message: "Mentve." })}
        submitLabel="Mentés"
        testId="mutation"
      >
        <label htmlFor="title">Megnevezés</label>
        <input id="title" name="title" />
      </AdminMutationForm>,
    );
    expect(screen.getByRole("button", { name: "Mentés" })).toBeEnabled();
    expect(screen.getByLabelText("Megnevezés")).toBeInTheDocument();
  });

  it("announces success without exposing field errors", async () => {
    render(
      <AdminMutationForm
        action={async () => ({ state: "success", message: "Mentve." })}
        submitLabel="Mentés"
        testId="mutation"
      >
        <input name="title" defaultValue="Fenyő" />
      </AdminMutationForm>,
    );
    fireEvent.submit(screen.getByTestId("mutation"));
    await waitFor(() =>
      expect(screen.getByTestId("mutation-state-success")).toHaveTextContent("Mentve"),
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("focuses validation and terminal summaries", async () => {
    const validationAction = async () => ({
      state: "validation" as const,
      message: "Ellenőrizze.",
      fieldErrors: { title: "Kötelező mező." },
    });
    const { rerender } = render(
      <AdminMutationForm action={validationAction} submitLabel="Mentés" testId="mutation">
        <input id="title" name="title" />
      </AdminMutationForm>,
    );
    fireEvent.submit(screen.getByTestId("mutation"));
    await waitFor(() => expect(screen.getByTestId("mutation-state-validation")).toHaveFocus());
    rerender(
      <AdminMutationForm
        action={async () => ({ state: "terminal", message: "Hiba történt." })}
        submitLabel="Mentés"
        testId="terminal-mutation"
      >
        <input name="title" />
      </AdminMutationForm>,
    );
    fireEvent.submit(screen.getByTestId("terminal-mutation"));
    await waitFor(() =>
      expect(screen.getByTestId("terminal-mutation-state-terminal")).toHaveFocus(),
    );
  });
});
