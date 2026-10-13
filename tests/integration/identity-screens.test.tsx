import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { COPY } from "../../src/identity/copy";
import type { FormState } from "../../src/identity/form-state";

const mocks = vi.hoisted(() => ({
  signIn: vi.fn(),
  requestReset: vi.fn(),
  setPassword: vi.fn(),
  accept: vi.fn(),
  signOut: vi.fn(),
  session: vi.fn(),
  configured: vi.fn(),
  lookup: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined, set: () => {} }) }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { digest: `NEXT_REDIRECT;replace;${url}` });
  },
}));
vi.mock("../../app/bejelentkezes/actions", () => ({ signInAction: mocks.signIn }));
vi.mock("../../app/jelszo-visszaallitas/actions", () => ({
  requestResetAction: mocks.requestReset,
}));
vi.mock("../../app/jelszo-visszaallitas/uj/actions", () => ({
  setNewPasswordAction: mocks.setPassword,
}));
vi.mock("../../app/_identity/actions", () => ({ signOutAction: mocks.signOut }));
vi.mock("../../app/_identity/current-session", () => ({ currentSession: mocks.session }));
vi.mock("../../src/identity/runtime", () => ({
  isIdentityConfigured: mocks.configured,
  getIdentityRuntime: () => ({ admin: {}, events: { emit: () => {} } }),
}));
vi.mock("../../src/identity/invitations", async (original) => ({
  ...(await original<typeof import("../../src/identity/invitations")>()),
  lookupInvitation: mocks.lookup,
}));
vi.mock("../../app/meghivas/[token]/actions", () => ({
  acceptRealInvitationAction: mocks.accept,
  acceptInvitationAction: vi.fn(),
  resendInvitationAction: vi.fn(),
}));

import SignInPage from "../../app/bejelentkezes/page";
import { SignInForm } from "../../app/bejelentkezes/SignInForm";
import RequestResetPage from "../../app/jelszo-visszaallitas/page";
import { RequestResetForm } from "../../app/jelszo-visszaallitas/RequestResetForm";
import SetNewPasswordPage from "../../app/jelszo-visszaallitas/uj/page";
import { SetPasswordForm } from "../../app/jelszo-visszaallitas/uj/SetPasswordForm";
import { SignOutButton } from "../../app/_identity/SignOutButton";
import InvitationPage from "../../app/meghivas/[token]/page";
import { AcceptInvitationForm } from "../../app/meghivas/[token]/AcceptInvitationForm";

const REAL_TOKEN = "R".repeat(43);

beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset();
  mocks.configured.mockReturnValue(false);
});

function submit(form: HTMLElement) {
  return act(async () => {
    fireEvent.submit(form);
  });
}

describe("SignInForm (W1, BR2.20)", () => {
  it("labels its controls, shows the Hungarian required messages and does not call the server for an empty form", async () => {
    render(<SignInForm />);
    expect(screen.getByLabelText(COPY.signIn.emailLabel)).toBeInTheDocument();
    expect(screen.getByLabelText(COPY.signIn.passwordLabel)).toHaveAttribute("type", "password");
    await submit(screen.getByTestId("sign-in-form"));
    expect(screen.getByTestId("sign-in-email-error")).toHaveTextContent(COPY.signIn.emailRequired);
    expect(screen.getByTestId("sign-in-password-error")).toHaveTextContent(
      COPY.signIn.passwordRequired,
    );
    expect(screen.getByTestId("sign-in-email")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByTestId("sign-in-email")).toHaveAttribute(
      "aria-describedby",
      "signin-email-error",
    );
    expect(mocks.signIn).not.toHaveBeenCalled();
  });

  it("sends the values to the action, shows the server's message in an alert region and keeps only the address", async () => {
    mocks.signIn.mockResolvedValue({
      status: "error",
      message: COPY.signIn.invalid,
      email: "person@example.test",
    } satisfies FormState);
    render(<SignInForm />);
    fireEvent.change(screen.getByTestId("sign-in-email"), {
      target: { value: "person@example.test" },
    });
    fireEvent.change(screen.getByTestId("sign-in-password"), {
      target: { value: "wrong-password-1" },
    });
    await submit(screen.getByTestId("sign-in-form"));
    await waitFor(() => expect(mocks.signIn).toHaveBeenCalledTimes(1));
    const data = mocks.signIn.mock.calls[0]![1] as FormData;
    expect(data.get("email")).toBe("person@example.test");
    expect(data.get("password")).toBe("wrong-password-1");
    const alert = await screen.findByTestId("sign-in-error");
    expect(alert).toHaveTextContent(COPY.signIn.invalid);
    expect(alert).toHaveAttribute("role", "alert");
    expect(alert).not.toHaveAttribute("hidden");
    expect(screen.getByTestId("sign-in-email")).toHaveValue("person@example.test");
    expect(screen.getByTestId("sign-in-password")).toHaveValue("");
    expect(document.body.innerHTML).not.toContain("wrong-password-1");
  });

  it("starts with the error region hidden and the submit button enabled", () => {
    render(<SignInForm />);
    expect(screen.getByTestId("sign-in-error")).toHaveAttribute("hidden");
    expect(screen.getByTestId("sign-in-submit")).toHaveTextContent(COPY.signIn.submit);
    expect(screen.getByTestId("sign-in-submit")).not.toBeDisabled();
  });
});

describe("RequestResetForm (W6)", () => {
  it("shows the neutral confirmation the server returns", async () => {
    mocks.requestReset.mockResolvedValue({
      status: "success",
      message: COPY.reset.confirmation,
    } satisfies FormState);
    render(<RequestResetForm />);
    fireEvent.change(screen.getByTestId("request-reset-email"), {
      target: { value: "person@example.test" },
    });
    await submit(screen.getByTestId("request-reset-form"));
    const confirmation = await screen.findByTestId("request-reset-confirmation");
    expect(confirmation).toHaveTextContent(COPY.reset.confirmation);
    expect(confirmation).toHaveAttribute("role", "status");
  });

  it("links an invalid address error to the field", async () => {
    mocks.requestReset.mockResolvedValue({
      status: "error",
      message: COPY.reset.emailInvalid,
      field: "email",
      email: "x",
    } satisfies FormState);
    render(<RequestResetForm />);
    await submit(screen.getByTestId("request-reset-form"));
    const error = await screen.findByTestId("request-reset-error");
    expect(error).toHaveAttribute("role", "alert");
    expect(screen.getByTestId("request-reset-email")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByTestId("request-reset-email")).toHaveAttribute(
      "aria-describedby",
      "reset-request-message",
    );
  });
});

describe("SetPasswordForm (W6, BR2.4)", () => {
  it("shows the rule, refuses a weak password on screen without calling the server, and links the error to the field", async () => {
    render(<SetPasswordForm tokenHash={"a".repeat(56)} />);
    expect(screen.getByTestId("set-password-rule")).toHaveTextContent(COPY.password.hint);
    fireEvent.change(screen.getByTestId("set-password-input"), { target: { value: "short1" } });
    await submit(screen.getByTestId("set-password-form"));
    expect(screen.getByTestId("set-password-field-error")).toHaveTextContent(
      COPY.password.ruleError,
    );
    expect(screen.getByTestId("set-password-input")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByTestId("set-password-input").getAttribute("aria-describedby")).toContain(
      "new-password-error",
    );
    expect(mocks.setPassword).not.toHaveBeenCalled();
  });

  it("binds the link's code to the action and offers a new link when the code is no longer valid", async () => {
    mocks.setPassword.mockResolvedValue({
      status: "error",
      message: COPY.reset.notValid,
      kind: "not-valid",
    } satisfies FormState);
    render(<SetPasswordForm tokenHash={"b".repeat(56)} />);
    fireEvent.change(screen.getByTestId("set-password-input"), {
      target: { value: "good-password-1" },
    });
    await submit(screen.getByTestId("set-password-form"));
    await waitFor(() => expect(mocks.setPassword).toHaveBeenCalledTimes(1));
    expect(mocks.setPassword.mock.calls[0]![0]).toBe("b".repeat(56));
    expect(await screen.findByTestId("set-password-error")).toHaveTextContent(COPY.reset.notValid);
    expect(screen.getByTestId("set-password-request-link")).toHaveAttribute(
      "href",
      "/jelszo-visszaallitas",
    );
  });

  it("shows a server-side password message on the field", async () => {
    mocks.setPassword.mockResolvedValue({
      status: "error",
      message: COPY.password.ruleError,
      field: "password",
    } satisfies FormState);
    render(<SetPasswordForm tokenHash={"c".repeat(56)} />);
    fireEvent.change(screen.getByTestId("set-password-input"), {
      target: { value: "good-password-1" },
    });
    await submit(screen.getByTestId("set-password-form"));
    expect(await screen.findByTestId("set-password-field-error")).toHaveTextContent(
      COPY.password.ruleError,
    );
  });
});

describe("AcceptInvitationForm (W5, BR2.4)", () => {
  it("checks the password rule on screen, then sends the password with the token and the page's key", async () => {
    mocks.accept.mockResolvedValue({
      status: "error",
      message: COPY.common.temporary,
    } satisfies FormState);
    render(<AcceptInvitationForm token={REAL_TOKEN} idempotencyKey="page-key" />);
    fireEvent.change(screen.getByTestId("accept-invitation-password"), {
      target: { value: "abc" },
    });
    await submit(screen.getByTestId("accept-invitation-form"));
    expect(screen.getByTestId("accept-invitation-field-error")).toHaveTextContent(
      COPY.password.ruleError,
    );
    expect(mocks.accept).not.toHaveBeenCalled();
    fireEvent.change(screen.getByTestId("accept-invitation-password"), {
      target: { value: "good-password-1" },
    });
    await submit(screen.getByTestId("accept-invitation-form"));
    await waitFor(() => expect(mocks.accept).toHaveBeenCalledTimes(1));
    expect(mocks.accept.mock.calls[0]!.slice(0, 2)).toEqual([REAL_TOKEN, "page-key"]);
    expect(await screen.findByTestId("accept-invitation-error")).toHaveTextContent(
      COPY.common.temporary,
    );
    expect(screen.queryByTestId("accept-invitation-field-error")).toBeNull();
  });

  it("shows a server-side password message on the field and states the rule", async () => {
    mocks.accept.mockResolvedValue({
      status: "error",
      message: COPY.password.ruleError,
      field: "password",
    } satisfies FormState);
    render(<AcceptInvitationForm token={REAL_TOKEN} idempotencyKey="k" />);
    expect(screen.getByTestId("accept-invitation-rule")).toHaveTextContent(COPY.password.hint);
    fireEvent.change(screen.getByTestId("accept-invitation-password"), {
      target: { value: "good-password-1" },
    });
    await submit(screen.getByTestId("accept-invitation-form"));
    expect(await screen.findByTestId("accept-invitation-field-error")).toHaveTextContent(
      COPY.password.ruleError,
    );
  });
});

describe("SignOutButton (BR2.8)", () => {
  it("submits the sign-out action", async () => {
    mocks.signOut.mockResolvedValue(undefined);
    render(<SignOutButton />);
    expect(screen.getByTestId("sign-out-button")).toHaveTextContent(COPY.signOut.label);
    await submit(screen.getByTestId("sign-out-form"));
    await waitFor(() => expect(mocks.signOut).toHaveBeenCalledTimes(1));
  });
});

describe("pages", () => {
  it("shows the sign-in form to a signed-out person and the sign-out control to a signed-in one", async () => {
    mocks.session.mockResolvedValue({ status: "signed-out", clearCookies: false });
    const out = renderToStaticMarkup(await SignInPage());
    expect(out).toContain('data-testid="sign-in-form"');
    expect(out).toContain(COPY.signIn.forgotLink);
    mocks.session.mockResolvedValue({
      status: "signed-in",
      accountId: "a",
      sessionId: "s",
      accessToken: "t",
    });
    const inn = renderToStaticMarkup(await SignInPage());
    expect(inn).toContain('data-testid="signed-in-panel"');
    expect(inn).toContain(COPY.signIn.signedInHeading);
    expect(inn).not.toContain('data-testid="sign-in-form"');
  });

  it("renders the reset request page with its heading, explanation and way back", () => {
    const html = renderToStaticMarkup(<RequestResetPage />);
    expect(html).toContain(COPY.reset.requestHeading);
    expect(html).toContain(COPY.reset.requestIntro);
    expect(html).toContain(COPY.reset.backToSignIn);
  });

  it("shows the new-password form only for a recovery link and the not-valid page for anything else", async () => {
    const valid = renderToStaticMarkup(
      await SetNewPasswordPage({
        searchParams: Promise.resolve({ token_hash: "x".repeat(40), type: "recovery" }),
      }),
    );
    expect(valid).toContain('data-testid="set-password-form"');
    for (const params of [
      {},
      { token_hash: "x".repeat(40) },
      { token_hash: "short", type: "recovery" },
      { token_hash: "x".repeat(40), type: "signup" },
    ]) {
      const html = renderToStaticMarkup(
        await SetNewPasswordPage({ searchParams: Promise.resolve(params) }),
      );
      expect(html).toContain('data-testid="set-password-not-valid"');
      expect(html).toContain(COPY.reset.notValid);
      expect(html).toContain(COPY.reset.requestNewLink);
    }
  });

  it("shows the real invitation page for a valid token, with role and scope in Hungarian and the accept form", async () => {
    mocks.configured.mockReturnValue(true);
    mocks.lookup.mockResolvedValue({ validity: "valid", role: "parent", scopeType: "family" });
    const html = renderToStaticMarkup(
      await InvitationPage({ params: Promise.resolve({ token: REAL_TOKEN }) }),
    );
    expect(html).toContain('data-testid="real-invitation-valid"');
    expect(html).toContain(COPY.invitation.roles.parent);
    expect(html).toContain(COPY.invitation.scopes.family);
    expect(html).toContain('data-testid="accept-invitation-form"');
    expect(html).not.toContain(REAL_TOKEN);
  });

  it("shows the not-valid message for an expired or unknown real token and the synthetic page otherwise", async () => {
    mocks.configured.mockReturnValue(true);
    for (const validity of ["expired", "not_valid"]) {
      mocks.lookup.mockResolvedValue({ validity });
      const html = renderToStaticMarkup(
        await InvitationPage({ params: Promise.resolve({ token: REAL_TOKEN }) }),
      );
      expect(html).toContain('data-testid="real-invitation-not-valid"');
      expect(html).toContain(COPY.invitation.notValid);
      expect(html).not.toContain('data-testid="accept-invitation-form"');
    }
    mocks.lookup.mockResolvedValue({ validity: "unavailable" });
    const unavailable = renderToStaticMarkup(
      await InvitationPage({ params: Promise.resolve({ token: REAL_TOKEN }) }),
    );
    expect(unavailable).toContain('data-testid="invitation-page-invalid"');
    mocks.lookup.mockRejectedValue(new Error("down"));
    const broken = renderToStaticMarkup(
      await InvitationPage({ params: Promise.resolve({ token: REAL_TOKEN }) }),
    );
    expect(broken).toContain('data-testid="invitation-page-invalid"');
    mocks.lookup.mockReset();
    const word = renderToStaticMarkup(
      await InvitationPage({ params: Promise.resolve({ token: "parent-valid-invitation" }) }),
    );
    expect(word).toContain('data-testid="invitation-page-valid"');
    expect(mocks.lookup).not.toHaveBeenCalled();
    mocks.configured.mockReturnValue(false);
    const notConfigured = renderToStaticMarkup(
      await InvitationPage({ params: Promise.resolve({ token: REAL_TOKEN }) }),
    );
    expect(notConfigured).toContain('data-testid="invitation-page-invalid"');
    expect(mocks.lookup).not.toHaveBeenCalled();
  });
});
