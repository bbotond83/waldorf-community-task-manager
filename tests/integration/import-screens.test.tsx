import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  ImportWorkflow,
  newUploadHref,
  type ImportWorkflowActions,
} from "../../app/admin/_components/ImportWorkflow.tsx";
import type { AdminActionState } from "../../app/admin/actions.ts";
import type { ImportPreviewModel } from "../../src/application/index.ts";

const RUN = "dddddddd-0000-4000-8000-000000000001";
const C1 = "dddddddd-0000-4000-8000-000000000011";
const C2 = "dddddddd-0000-4000-8000-000000000012";

const base: ImportPreviewModel = {
  id: RUN,
  runId: RUN,
  runVersion: 3,
  fileName: "tavaszi-feladatok.xlsx",
  fingerprint: "ab".repeat(32),
  changedRows: ["Boróka csoport: 2 módosítás"],
  conflicts: [
    { id: C1, rowLabel: "Szülők elérhetősége · 2. sor", message: "Az elem már létezik." },
    { id: C2, rowLabel: "Kinti takarítás · 3. sor", message: "Ismeretlen család.", skipOnly: true },
  ],
  step: 4,
  totalRows: 42,
  state: "conflicts",
  warningCount: 0,
};

type Recorded = { name: string; data: FormData };

function recording() {
  const calls: Recorded[] = [];
  const answer = (name: string) =>
    vi.fn(async (_state: AdminActionState, data: FormData): Promise<AdminActionState> => {
      calls.push({ name, data });
      return { state: "success", message: "Rendben." };
    });
  const actions: ImportWorkflowActions = {
    resolveConflict: answer("resolve"),
    commit: answer("commit"),
    recover: answer("recover"),
    upload: answer("upload"),
    cancel: answer("cancel"),
  };
  return { calls, actions };
}

const production = (preview: ImportPreviewModel | undefined, actions: ImportWorkflowActions) =>
  render(<ImportWorkflow preview={preview} actions={actions} />);

function hidden(form: HTMLElement, name: string): string | undefined {
  return form.querySelector<HTMLInputElement>(`input[name="${name}"]`)?.value;
}

describe("the upload step in production mode", () => {
  it("offers a labelled .xlsx file input with the size hint and no demo controls", () => {
    production(undefined, recording().actions);
    const input = screen.getByLabelText("Munkafüzet (.xlsx)");
    expect(input).toHaveAttribute("type", "file");
    expect(input).toHaveAttribute("accept", ".xlsx");
    expect(input).toHaveAttribute("data-testid", "admin-import-file-input");
    expect(screen.getByText(/legfeljebb 5 MB/)).toBeInTheDocument();
    expect(screen.queryByTestId("admin-import-fixture-select")).not.toBeInTheDocument();
    expect(screen.queryByTestId("admin-import-scenario-select")).not.toBeInTheDocument();
    expect(screen.queryByTestId("developer-details")).not.toBeInTheDocument();
    expect(document.querySelector('[name="scenario"]')).toBeNull();
  });

  it("has no demo workbook select, no scenario select and no fixed key: the form takes a file only", () => {
    render(<ImportWorkflow actions={recording().actions} />);
    expect(screen.queryByTestId("admin-import-fixture-select")).not.toBeInTheDocument();
    expect(screen.queryByTestId("admin-import-scenario-select")).not.toBeInTheDocument();
    expect(screen.getByTestId("admin-import-file-input")).toBeInTheDocument();
    const form = screen.getByTestId("admin-import-preview-form");
    expect(hidden(form, "idempotencyKey")).not.toBe("import-preview-waldorf-v1");
  });

  it("falls back to no form when the upload action is not provided", () => {
    const { actions } = recording();
    production(undefined, { ...actions, upload: undefined });
    expect(screen.queryByTestId("admin-import-preview-form")).not.toBeInTheDocument();
  });

  it("posts the form and shows a refusal next to the file input, linked to it", async () => {
    const { actions } = recording();
    const refuse = vi.fn(async (): Promise<AdminActionState> => ({
      state: "validation",
      message: "Ellenőrizze a megadott adatokat.",
      fieldErrors: { workbook: "Válasszon ki egy .xlsx munkafüzetet." },
    }));
    production(undefined, { ...actions, upload: refuse });
    fireEvent.submit(screen.getByTestId("admin-import-preview-form"));
    await waitFor(() => expect(refuse).toHaveBeenCalled());
    const input = await screen.findByTestId("admin-import-file-input");
    await waitFor(() => expect(input).toHaveAttribute("aria-invalid", "true"));
    expect(input.getAttribute("aria-describedby")).toContain("workbook-error");
    expect(screen.getByTestId("admin-import-file-input-error")).toHaveTextContent(
      "Válasszon ki egy .xlsx munkafüzetet.",
    );
  });
});

describe("the preview and the conflict forms in production mode", () => {
  it("shows the file name on the source line instead of the demo fixture id", () => {
    production(base, recording().actions);
    expect(screen.getByTestId("admin-import-source")).toHaveTextContent("tavaszi-feladatok.xlsx");
  });

  it("sends the real run id and run version, never the demo constants", () => {
    production(base, recording().actions);
    const forms = screen.getAllByTestId("admin-import-conflict-form");
    expect(forms).toHaveLength(2);
    for (const form of forms) {
      expect(hidden(form, "previewId")).toBe(RUN);
      expect(hidden(form, "expectedVersion")).toBe("3");
    }
    expect(hidden(forms[0]!, "conflictId")).toBe(C1);
    expect(hidden(forms[1]!, "conflictId")).toBe(C2);
    expect(document.body.innerHTML).not.toContain("run-waldorf-v1");
  });

  it("offers only 'keep existing' when there is nothing to import into", () => {
    production(base, recording().actions);
    const [first, second] = screen.getAllByTestId("admin-import-conflict-form");
    expect(within(first!).getAllByRole("radio")).toHaveLength(2);
    expect(within(second!).getAllByRole("radio")).toHaveLength(1);
    expect(within(second!).getByLabelText(/Meglévő adat megtartása/)).toBeInTheDocument();
  });

  it("sends a fresh idempotency key with every attempt of a conflict form", async () => {
    const { actions, calls } = recording();
    production(base, actions);
    const form = screen.getAllByTestId("admin-import-conflict-form")[0]!;
    fireEvent.click(within(form).getByLabelText(/Importált adat használata/));
    fireEvent.submit(form);
    fireEvent.submit(form);
    await waitFor(() => expect(calls).toHaveLength(2));
    const keys = calls.map((call) => String(call.data.get("idempotencyKey")));
    expect(keys[0]).toMatch(/^import-resolve:[0-9a-f]{32}$/);
    expect(keys[1]).toMatch(/^import-resolve:[0-9a-f]{32}$/);
    expect(keys[0]).not.toBe(keys[1]);
    expect(calls[0]!.data.get("resolution")).toBe("use-import");
    expect(calls[0]!.data.get("expectedVersion")).toBe("3");
  });

  it("follows the run version through a run with two conflicts", () => {
    const first = recording();
    const view = production(base, first.actions);
    expect(hidden(screen.getAllByTestId("admin-import-conflict-form")[0]!, "expectedVersion")).toBe(
      "3",
    );
    // The first conflict is resolved: the page renders again with the version the answer carried.
    view.rerender(
      <ImportWorkflow
        actions={first.actions}
        preview={{
          ...base,
          runVersion: 4,
          conflicts: [{ ...base.conflicts[0]!, resolution: "use-import" }, base.conflicts[1]!],
        }}
      />,
    );
    const remaining = screen.getAllByTestId("admin-import-conflict-form");
    expect(remaining).toHaveLength(1);
    expect(hidden(remaining[0]!, "conflictId")).toBe(C2);
    expect(hidden(remaining[0]!, "expectedVersion")).toBe("4");
    view.rerender(
      <ImportWorkflow
        actions={first.actions}
        preview={{
          ...base,
          runVersion: 5,
          step: 5,
          state: "preview",
          conflicts: [
            { ...base.conflicts[0]!, resolution: "use-import" },
            { ...base.conflicts[1]!, resolution: "keep-existing" },
          ],
        }}
      />,
    );
    expect(screen.queryByTestId("admin-import-conflict-form")).not.toBeInTheDocument();
    expect(hidden(screen.getByTestId("admin-import-commit-form"), "expectedVersion")).toBe("5");
  });
});

describe("the confirmation and the result in production mode", () => {
  const ready: ImportPreviewModel = {
    ...base,
    runVersion: 5,
    step: 5,
    state: "preview",
    conflicts: [{ ...base.conflicts[0]!, resolution: "use-import" }],
  };

  it("states the real size of the run, not the demo sentence", () => {
    production(ready, recording().actions);
    const text = screen.getByTestId("admin-import-confirm-text").textContent ?? "";
    expect(text).toContain("42 sorát");
    expect(text).toContain("1 feloldott ütközéssel");
    expect(document.body).not.toHaveTextContent("3 engedélyezett változást");
  });

  it("states the real size of the run even when the preview carries no file name", () => {
    render(
      <ImportWorkflow actions={recording().actions} preview={{ ...ready, fileName: undefined }} />,
    );
    expect(screen.getByTestId("admin-import-confirm-text")).toHaveTextContent("42 sorát");
    // The database always names the file; with no name the source line is empty and shows no demo fixture id.
    expect(screen.getByTestId("admin-import-source")).toBeEmptyDOMElement();
  });

  it("sends the fingerprint, the confirmation, a fresh key and no scenario", async () => {
    const { actions, calls } = recording();
    production(ready, actions);
    const form = screen.getByTestId("admin-import-commit-form");
    fireEvent.click(screen.getByTestId("admin-import-confirm-checkbox"));
    fireEvent.submit(form);
    fireEvent.submit(form);
    await waitFor(() => expect(calls).toHaveLength(2));
    const [one, two] = calls.map((call) => call.data);
    expect(one!.get("previewId")).toBe(RUN);
    expect(one!.get("fingerprint")).toBe("ab".repeat(32));
    expect(one!.get("confirmed")).toBe("yes");
    expect(one!.get("expectedVersion")).toBe("5");
    expect(one!.has("scenario")).toBe(false);
    expect(String(one!.get("idempotencyKey"))).toMatch(/^import-commit:[0-9a-f]{32}$/);
    expect(one!.get("idempotencyKey")).not.toBe(two!.get("idempotencyKey"));
  });

  it("shows the real counts and a new-upload link once the run is committed", () => {
    production(
      {
        ...ready,
        step: 7,
        state: "committed",
        conflicts: [],
        importedRows: 11,
        skippedRows: 31,
      },
      recording().actions,
    );
    const outcome = screen.getByTestId("admin-import-outcome");
    expect(outcome).toHaveAttribute("role", "status");
    expect(screen.getByTestId("admin-import-outcome-counts")).toHaveTextContent(
      "11 elem jött létre vagy módosult, 31 sor változatlan maradt",
    );
    expect(outcome).not.toHaveTextContent("3 elem módosult");
    expect(outcome).not.toHaveTextContent("OUTSTANDING");
    expect(screen.getByTestId("admin-import-new-upload-link")).toHaveAttribute(
      "href",
      newUploadHref(RUN),
    );
    expect(newUploadHref(RUN)).toBe(`/admin/import?uj=${RUN}`);
    expect(screen.queryByTestId("admin-import-commit-form")).not.toBeInTheDocument();
    expect(screen.queryByTestId("admin-import-cancel-form")).not.toBeInTheDocument();
  });

  it("shows a recovered run as a finished one with its counts", () => {
    production(
      { ...ready, step: 7, state: "recovered", conflicts: [], importedRows: 2, skippedRows: 0 },
      recording().actions,
    );
    expect(screen.getByTestId("admin-import-outcome-counts")).toHaveTextContent(
      "2 elem jött létre vagy módosult, 0 sor",
    );
    expect(screen.queryByTestId("admin-import-recovery-form")).not.toBeInTheDocument();
  });

  it("counts a result without numbers as zero rather than inventing them", () => {
    production({ ...ready, step: 7, state: "committed", conflicts: [] }, recording().actions);
    expect(screen.getByTestId("admin-import-outcome-counts")).toHaveTextContent(
      "0 elem jött létre vagy módosult, 0 sor",
    );
  });
});

describe("an interrupted run and the cancel control in production mode", () => {
  const interrupted: ImportPreviewModel = {
    ...base,
    runVersion: 7,
    step: 6,
    state: "interrupted",
    conflicts: [{ ...base.conflicts[0]!, resolution: "use-import" }],
  };

  it("offers the recovery with the real run id and no commit form", async () => {
    const { actions, calls } = recording();
    production(interrupted, actions);
    const form = screen.getByTestId("admin-import-recovery-form");
    expect(hidden(form, "runId")).toBe(RUN);
    expect(document.body.innerHTML).not.toContain("run-waldorf-v1");
    expect(screen.queryByTestId("admin-import-commit-form")).not.toBeInTheDocument();
    fireEvent.submit(form);
    fireEvent.submit(form);
    await waitFor(() => expect(calls).toHaveLength(2));
    expect(calls[0]!.data.get("idempotencyKey")).not.toBe(calls[1]!.data.get("idempotencyKey"));
    expect(String(calls[0]!.data.get("idempotencyKey"))).toMatch(/^import-recover:/);
    expect(calls[0]!.data.has("scenario")).toBe(false);
  });

  it("offers a cancel for an open run with the run version and a fresh key", async () => {
    const { actions, calls } = recording();
    production(interrupted, actions);
    const form = screen.getByTestId("admin-import-cancel-form");
    expect(screen.getByRole("button", { name: "Import megszakítása" })).toBeInTheDocument();
    expect(hidden(form, "runId")).toBe(RUN);
    expect(hidden(form, "expectedVersion")).toBe("7");
    fireEvent.submit(form);
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(String(calls[0]!.data.get("idempotencyKey"))).toMatch(/^import-cancel:[0-9a-f]{32}$/);
  });

  it("offers the cancel next to the conflicts of a fresh preview", () => {
    production(base, recording().actions);
    expect(screen.getByTestId("admin-import-cancel-form")).toBeInTheDocument();
    expect(screen.getAllByTestId("admin-import-conflict-form")).toHaveLength(2);
  });

  it("does not render the cancel without a cancel action", () => {
    const { actions } = recording();
    production(base, { ...actions, cancel: undefined });
    expect(screen.queryByTestId("admin-import-cancel-form")).not.toBeInTheDocument();
  });
});
