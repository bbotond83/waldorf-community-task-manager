import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ParentAccessState } from "../../app/szulo/_components/ParentAccessState.tsx";
import { ParentMutationForm } from "../../app/szulo/_components/ParentMutationForm.tsx";
import { ParentStatePanel } from "../../app/szulo/_components/ParentStatePanel.tsx";
import { denied, empty, retryableFailure, success } from "../../src/application/index.ts";

describe("ParentStatePanel", () => {
  it("renders authorized content", () => {
    render(
      <ParentStatePanel
        result={success({ title: "Kerti előkészítés" })}
        emptyMessage="Üres"
        testId="panel"
      >
        {(data) => <p>{data.title}</p>}
      </ParentStatePanel>,
    );
    expect(screen.getByTestId("panel")).toHaveTextContent("Kerti előkészítés");
  });

  it("renders empty and generic denial without protected content", () => {
    const { rerender } = render(
      <ParentStatePanel result={empty()} emptyMessage="Nincs feladat" testId="panel">
        {() => <p>protected@example.test</p>}
      </ParentStatePanel>,
    );
    expect(screen.getByText("Nincs feladat")).toBeInTheDocument();
    rerender(
      <ParentStatePanel result={denied()} emptyMessage="Nincs feladat" testId="panel">
        {() => <p>protected@example.test</p>}
      </ParentStatePanel>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("nem érhető el");
    expect(document.body).not.toHaveTextContent("protected@example.test");
  });

  it("announces retryable failure without raw provider detail", () => {
    render(
      <ParentStatePanel
        result={retryableFailure({ idempotencyKey: "retry:key:1", action: "signup" })}
        emptyMessage="Üres"
        testId="panel"
      >
        {() => null}
      </ParentStatePanel>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Átmeneti hiba");
    expect(document.body).not.toHaveTextContent("provider");
  });

  it("renders hostile authorized text as text instead of executable markup", () => {
    render(
      <ParentStatePanel
        result={success({ title: '<script data-protected="true">alert(1)</script>' })}
        emptyMessage="Üres"
        testId="panel"
      >
        {(data) => <p>{data.title}</p>}
      </ParentStatePanel>,
    );
    expect(screen.getByText(/script data-protected/)).toBeInTheDocument();
    expect(document.querySelector("script[data-protected]")).toBeNull();
  });
});

describe("ParentMutationForm", () => {
  it("renders a labelled enabled action", () => {
    render(
      <ParentMutationForm
        action={async () => ({ state: "success", message: "Mentve." })}
        submitLabel="Mentés"
        testId="parent-mutation"
      >
        <label htmlFor="note">Megjegyzés</label>
        <input id="note" name="note" />
      </ParentMutationForm>,
    );
    expect(screen.getByLabelText("Megjegyzés")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mentés" })).toBeEnabled();
  });

  it("announces one success state", async () => {
    render(
      <ParentMutationForm
        action={async () => ({ state: "success", message: "Mentve." })}
        submitLabel="Mentés"
        testId="parent-mutation"
      />,
    );
    fireEvent.submit(screen.getByTestId("parent-mutation"));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Mentve"));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("replaces its fields and button by the after-success content once sent", async () => {
    render(
      <ParentMutationForm
        action={async () => ({ state: "success", message: "Elküldve." })}
        submitLabel="Küldés"
        testId="parent-mutation"
        afterSuccess={<p data-testid="after">Cserekérelem folyamatban</p>}
      >
        <input name="reason" aria-label="Indoklás" />
      </ParentMutationForm>,
    );
    expect(screen.getByLabelText("Indoklás")).toBeInTheDocument();
    expect(screen.queryByTestId("after")).not.toBeInTheDocument();
    fireEvent.submit(screen.getByTestId("parent-mutation"));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Elküldve"));
    expect(screen.getByTestId("after")).toBeInTheDocument();
    expect(screen.queryByLabelText("Indoklás")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Küldés" })).not.toBeInTheDocument();
  });

  it("shows the after-success content from the start for a request sent earlier", () => {
    render(
      <ParentMutationForm
        action={async () => ({ state: "success", message: "Elküldve." })}
        submitLabel="Küldés"
        testId="parent-mutation"
        alreadyDone
        afterSuccess={<p data-testid="after">Cserekérelem folyamatban</p>}
      >
        <input name="reason" aria-label="Indoklás" />
      </ParentMutationForm>,
    );
    expect(screen.getByTestId("after")).toBeInTheDocument();
    expect(screen.queryByLabelText("Indoklás")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("keeps its fields after a failed send even with after-success content", async () => {
    render(
      <ParentMutationForm
        action={async () => ({ state: "conflict", message: "Már van kérelem." })}
        submitLabel="Küldés"
        testId="parent-mutation"
        afterSuccess={<p data-testid="after">Cserekérelem folyamatban</p>}
      >
        <input name="reason" aria-label="Indoklás" />
      </ParentMutationForm>,
    );
    fireEvent.submit(screen.getByTestId("parent-mutation"));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Már van kérelem"));
    expect(screen.getByLabelText("Indoklás")).toBeInTheDocument();
    expect(screen.queryByTestId("after")).not.toBeInTheDocument();
  });

  it("focuses a validation summary and links its field", async () => {
    render(
      <ParentMutationForm
        action={async () => ({
          state: "validation",
          message: "Ellenőrizze.",
          fieldErrors: { reason: "Kötelező mező." },
        })}
        submitLabel="Küldés"
        testId="parent-mutation"
      >
        <textarea id="reason" name="reason" />
      </ParentMutationForm>,
    );
    fireEvent.submit(screen.getByTestId("parent-mutation"));
    await waitFor(() =>
      expect(screen.getByTestId("parent-mutation-state-validation")).toHaveFocus(),
    );
    expect(screen.getByRole("link", { name: "Kötelező mező." })).toHaveAttribute("href", "#reason");
  });
});

describe("ParentAccessState", () => {
  it("offers login from signed-out state", () => {
    render(<ParentAccessState kind="signed-out" />);
    expect(screen.getByTestId("parent-login-link")).toHaveAttribute("href", "/bejelentkezes");
  });

  it("renders generic denial without unrelated identifiers", () => {
    render(<ParentAccessState kind="denied" />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Nincs jogosultság");
    expect(document.body).not.toHaveTextContent("family-unrelated");
  });

  it("leads a teacher who opened a parent page back to Beosztás", () => {
    render(<ParentAccessState kind="denied" homePath="/teacher/schedule" />);
    expect(screen.getByTestId("parent-access-home-link")).toHaveTextContent("Vissza a beosztáshoz");
    expect(screen.getByTestId("parent-access-home-link")).toHaveAttribute(
      "href",
      "/teacher/schedule",
    );
  });
});
