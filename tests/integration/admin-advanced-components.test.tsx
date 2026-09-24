import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ImportWorkflow } from "../../app/admin/_components/ImportWorkflow.tsx";
import type { ImportPreviewModel } from "../../src/application/index.ts";

const preview: ImportPreviewModel = {
  id: "preview-waldorf-v1",
  fingerprint: "sha256:waldorf-advanced-v1:8b12",
  changedRows: ["Boróka csoport: 2 módosítás"],
  conflicts: [{ id: "conflict-family-1", rowLabel: "Családok · 12. sor", message: "Már létezik." }],
  step: 4,
  fixtureId: "workbook-waldorf-v1",
  totalRows: 30,
  state: "conflicts",
};

const actions = {
  createPreview: async () => ({ state: "success" as const, message: "Előnézet kész." }),
  resolveConflict: async (_state: unknown, formData: FormData) =>
    formData.get("resolution")
      ? { state: "success" as const, message: "Feloldva." }
      : {
          state: "validation" as const,
          message: "Ellenőrizze.",
          fieldErrors: { resolution: "Válasszon feloldási módot." },
        },
  commit: async () => ({ state: "success" as const, message: "Mentve." }),
  recover: async () => ({ state: "success" as const, message: "Helyreállt." }),
};

describe("ImportWorkflow", () => {
  it("renders all seven labelled steps and the bounded preview", () => {
    render(<ImportWorkflow preview={preview} actions={actions} />);
    expect(screen.getAllByRole("listitem").length).toBeGreaterThanOrEqual(8);
    expect(screen.getByText("Megerősítés")).toBeInTheDocument();
    expect(screen.getByTestId("admin-import-preview")).toHaveTextContent("30");
    expect(document.body).not.toHaveTextContent("email");
  });

  it("requires an explicit conflict resolution", async () => {
    render(<ImportWorkflow preview={preview} actions={actions} />);
    fireEvent.submit(screen.getByTestId("admin-import-conflict-form"));
    await waitFor(() =>
      expect(screen.getByTestId("admin-import-conflict-form-state-validation")).toHaveFocus(),
    );
    expect(screen.getByText("Válasszon feloldási módot.")).toBeInTheDocument();
  });

  it("renders recovery and success as distinct accessible outcomes", () => {
    const { rerender } = render(
      <ImportWorkflow
        actions={actions}
        preview={{
          ...preview,
          conflicts: [{ ...preview.conflicts[0]!, resolution: "use-import" }],
          step: 6,
          state: "confirmed",
        }}
      />,
    );
    expect(screen.getByTestId("admin-import-recovery-form")).toBeInTheDocument();
    rerender(
      <ImportWorkflow
        actions={actions}
        preview={{ ...preview, conflicts: [], step: 7, state: "committed" }}
      />,
    );
    expect(screen.getByTestId("admin-import-outcome")).toHaveAttribute("role", "status");
    expect(screen.queryByTestId("admin-import-commit-form")).not.toBeInTheDocument();
  });
});
