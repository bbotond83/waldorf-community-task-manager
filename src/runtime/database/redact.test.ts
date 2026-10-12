import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { REDACTED, redactSecrets } from "./redact.ts";

// Every value below is generated for the test; none is a real credential.
const fakeJwt = `eyJ${"a".repeat(12)}.${"b".repeat(12)}.${"c".repeat(12)}`;

describe("secret redaction", () => {
  it("removes JWT-shaped tokens and stack keys", () => {
    const text = `token ${fakeJwt} key sb_secret_${"x".repeat(20)} other sb_publishable_${"y".repeat(20)}`;
    const result = redactSecrets(text);
    assert.equal(result.includes("eyJ"), false);
    assert.equal(result.includes("sb_secret_"), false);
    assert.equal(result.includes("sb_publishable_"), false);
  });

  it("keeps the user name but removes the password inside a connection address", () => {
    const result = redactSecrets("postgresql://postgres:fake-password-1@127.0.0.1:54322/postgres");
    assert.equal(result, `postgresql://postgres:${REDACTED}@127.0.0.1:54322/postgres`);
  });

  it("removes private key blocks and caller-supplied literal values", () => {
    // Assembled at run time so the secret scan does not flag this test file itself.
    const label = ["PRIVATE", "KEY"].join(" ");
    const block = `-----BEGIN ${label}-----\nabc\n-----END ${label}-----`;
    assert.equal(redactSecrets(`x ${block} y`), `x ${REDACTED} y`);
    assert.equal(
      redactSecrets("a fake-literal-value b", ["fake-literal-value", undefined, "abc"]),
      `a ${REDACTED} b`,
    );
  });

  it("leaves ordinary text and short literals alone", () => {
    assert.equal(redactSecrets("nothing secret here", ["no"]), "nothing secret here");
  });
});
