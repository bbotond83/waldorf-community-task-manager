import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { COPY } from "../../src/identity/copy.ts";

const signOut = vi.hoisted(() => vi.fn());
vi.mock("server-only", () => ({}));
vi.mock("../../app/_identity/actions.ts", () => ({ signOutAction: signOut }));

import { AccessStateExit } from "../../app/_identity/AccessStateExit.tsx";
import { TeacherAccessState } from "../../app/teacher/_components/TeacherAccessState.tsx";

describe("AccessStateExit (FR1.1, FR2)", () => {
  it("shows the guidance and the sign-out button", () => {
    render(<AccessStateExit explain />);
    expect(screen.getByTestId("access-guidance")).toHaveTextContent(COPY.noAccess.guidance);
    expect(screen.getByTestId("sign-out-button")).toHaveTextContent(COPY.signOut.label);
  });

  it("leaves out the guidance when not asked, keeping the button", () => {
    render(<AccessStateExit explain={false} />);
    expect(screen.queryByTestId("access-guidance")).not.toBeInTheDocument();
    expect(screen.getByTestId("sign-out-button")).toBeInTheDocument();
  });

  it("submits the existing sign-out action (FR1.2)", async () => {
    signOut.mockResolvedValue(undefined);
    render(<AccessStateExit explain />);
    await act(async () => {
      fireEvent.submit(screen.getByTestId("sign-out-form"));
    });
    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
  });
});

describe("TeacherAccessState (FR1.3, FR2, FR4)", () => {
  it("explains a denial and offers sign-out, keeping the heading and the home link", () => {
    render(<TeacherAccessState kind="denied" />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Nincs jogosultság");
    expect(screen.getByTestId("access-guidance")).toBeInTheDocument();
    expect(screen.getByTestId("sign-out-button")).toBeInTheDocument();
    expect(screen.getByTestId("teacher-access-home-link")).toHaveAttribute("href", "/");
  });

  it("offers sign-out without the explanation on a configuration error", () => {
    render(<TeacherAccessState kind="configuration-error" />);
    expect(screen.queryByTestId("access-guidance")).not.toBeInTheDocument();
    expect(screen.getByTestId("sign-out-button")).toBeInTheDocument();
  });

  it("offers neither to a signed-out visitor", () => {
    render(<TeacherAccessState kind="signed-out" />);
    expect(screen.queryByTestId("access-guidance")).not.toBeInTheDocument();
    expect(screen.queryByTestId("sign-out-button")).not.toBeInTheDocument();
  });
});
