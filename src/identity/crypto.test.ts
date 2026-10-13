import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateToken, hashToken, isPlausibleEmail, keyedHash, normalizeEmail } from "./crypto.ts";

describe("identity primitives (NFR2.6)", () => {
  it("makes 32-byte tokens that differ every time", () => {
    const first = generateToken();
    assert.equal(Buffer.from(first, "base64url").length, 32);
    assert.match(first, /^[A-Za-z0-9_-]{43}$/);
    assert.notEqual(first, generateToken());
  });

  it("hashes a token to lower-case hexadecimal SHA-256 and never returns the token", () => {
    assert.equal(
      hashToken("abc"),
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
    assert.equal(hashToken("a").includes("a".repeat(8)), false);
  });

  it("keys the email hash with the secret and the purpose, so it cannot be recomputed without them", () => {
    const secret = "s".repeat(40);
    const first = keyedHash("person@example.test", secret, "email");
    assert.match(first, /^[a-f0-9]{64}$/);
    assert.equal(keyedHash("person@example.test", secret, "email"), first);
    assert.notEqual(keyedHash("person@example.test", `${secret}x`, "email"), first);
    assert.notEqual(keyedHash("person@example.test", secret, "account"), first);
    assert.notEqual(keyedHash("other@example.test", secret, "email"), first);
    assert.notEqual(first, hashToken("person@example.test"));
  });

  it("normalizes and sanity-checks addresses", () => {
    assert.equal(normalizeEmail("  Person@Example.TEST "), "person@example.test");
    assert.equal(isPlausibleEmail("person@example.test"), true);
    for (const bad of ["", "no-at-sign", "a@b", "a b@c.d", `${"a".repeat(250)}@x.test`]) {
      assert.equal(isPlausibleEmail(bad), false, bad);
    }
  });
});
