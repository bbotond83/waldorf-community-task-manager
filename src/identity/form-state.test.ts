import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  conflict,
  denied,
  retryableFailure,
  success,
  terminalFailure,
  validation,
} from "../application/results.ts";
import { COPY } from "./copy.ts";
import { IDLE_FORM, passwordFormState, signInFormState } from "./form-state.ts";
import { INVITATION_BUSY, INVITATION_NOT_VALID, PASSWORD_RULE } from "./invitations.ts";
import { PASSWORD_REJECTED, RESET_NOT_VALID } from "./reset.ts";
import { SIGN_IN_INVALID, SIGN_IN_LOCKED, SIGN_IN_RATE_LIMITED } from "./sign-in.ts";

const retry = { idempotencyKey: "k", action: "a" };

describe("form states (BR2.1, BR2.20)", () => {
  it("starts idle and keeps the address after a failed sign-in, never a password", () => {
    assert.deepEqual(IDLE_FORM, { status: "idle", message: "" });
    const wrong = signInFormState(denied(SIGN_IN_INVALID), "person@example.test");
    assert.deepEqual(wrong, {
      status: "error",
      message: COPY.signIn.invalid,
      email: "person@example.test",
    });
    assert.equal(JSON.stringify(wrong).includes("password"), false);
  });

  it("gives the generic message for every sign-in failure and the locked message for a lockout", () => {
    assert.equal(
      signInFormState(denied(SIGN_IN_LOCKED), "a@example.test").message,
      COPY.signIn.locked,
    );
    assert.equal(
      signInFormState(validation({ x: "y" }), "a@example.test").message,
      COPY.signIn.invalid,
    );
    assert.equal(signInFormState(conflict(), "a@example.test").message, COPY.signIn.invalid);
    for (const result of [retryableFailure(retry), terminalFailure()]) {
      assert.equal(signInFormState(result, "a@example.test").message, COPY.signIn.temporary);
    }
    assert.deepEqual(signInFormState(success(1), "a@example.test"), {
      status: "success",
      message: "",
    });
  });

  it("tells a person about a burst of sign-ins differently from an outage, and about a refused new password differently from the rule", () => {
    assert.equal(
      signInFormState(retryableFailure(retry, SIGN_IN_RATE_LIMITED), "a@example.test").message,
      COPY.common.rateLimited,
    );
    assert.notEqual(COPY.common.rateLimited, COPY.signIn.temporary);
    const refused = passwordFormState(
      validation({ password: "rejected" }, PASSWORD_REJECTED),
      COPY.reset.notValid,
    );
    assert.deepEqual(refused, { status: "error", message: COPY.password.rejectedNewLink });
    assert.notEqual(COPY.password.rejectedNewLink, COPY.password.ruleError);
  });

  it("explains a password that breaks the rule on its field, and links nothing else to it", () => {
    const state = passwordFormState(
      validation({ password: "too_short" }, PASSWORD_RULE),
      COPY.reset.notValid,
    );
    assert.deepEqual(state, {
      status: "error",
      message: COPY.password.ruleError,
      field: "password",
    });
  });

  it("shows the not-valid message for a used, expired or unusable link and invitation", () => {
    for (const result of [
      denied(RESET_NOT_VALID),
      denied(INVITATION_NOT_VALID),
      conflict("invitation_exists"),
    ]) {
      assert.deepEqual(passwordFormState(result, COPY.invitation.notValid), {
        status: "error",
        message: COPY.invitation.notValid,
        kind: "not-valid",
      });
    }
  });

  it("shows the temporary message for retryable, busy and unexpected results, and success as success", () => {
    for (const result of [
      retryableFailure(retry, INVITATION_BUSY),
      retryableFailure(retry),
      terminalFailure(),
      validation({ x: "y" }, "OTHER"),
    ]) {
      assert.deepEqual(passwordFormState(result, COPY.reset.notValid), {
        status: "error",
        message: COPY.common.temporary,
      });
    }
    assert.deepEqual(passwordFormState(success(null), COPY.reset.notValid), {
      status: "success",
      message: "",
    });
  });
});
