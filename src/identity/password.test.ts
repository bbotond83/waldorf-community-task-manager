import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { checkPassword, PASSWORD_MAX_BYTES } from "./password.ts";

describe("password rule (BR2.4)", () => {
  it("accepts 8 to 72 characters with a letter and a digit", () => {
    assert.deepEqual(checkPassword("abcdefg1"), { ok: true });
    assert.deepEqual(checkPassword("Árvíztűrő9"), { ok: true });
    assert.deepEqual(checkPassword(`${"a".repeat(PASSWORD_MAX_BYTES - 1)}1`), { ok: true });
  });

  it("refuses fewer than 8 characters, counting characters and not bytes", () => {
    assert.deepEqual(checkPassword("abc1234"), { ok: false, violation: "too_short" });
    assert.deepEqual(checkPassword("áéíóú12"), { ok: false, violation: "too_short" });
    assert.deepEqual(checkPassword(""), { ok: false, violation: "too_short" });
  });

  it("refuses more than 72 bytes, the limit of the sign-in service's hashing", () => {
    assert.deepEqual(checkPassword(`${"a".repeat(PASSWORD_MAX_BYTES)}1`), {
      ok: false,
      violation: "too_long",
    });
    assert.deepEqual(checkPassword(`${"ő".repeat(36)}1`), { ok: false, violation: "too_long" });
  });

  it("refuses a password without a letter or without a digit", () => {
    assert.deepEqual(checkPassword("12345678"), { ok: false, violation: "no_letter" });
    assert.deepEqual(checkPassword("abcdefgh"), { ok: false, violation: "no_digit" });
    assert.deepEqual(checkPassword("!!!!!!!!"), { ok: false, violation: "no_letter" });
  });
});
