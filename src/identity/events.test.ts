import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createEventEmitter } from "./events.ts";

describe("structured security event lines (NFR1.17, NFR1.18)", () => {
  const secret = "e".repeat(40);
  const lines: string[] = [];
  const emitter = createEventEmitter({
    secret,
    sink: (line) => lines.push(line),
    now: () => Date.parse("2026-10-13T10:00:00Z"),
  });

  it("writes one JSON line with the event code and a timestamp", () => {
    lines.length = 0;
    emitter.emit("sign_out");
    assert.equal(lines.length, 1);
    assert.deepEqual(JSON.parse(lines[0]!), { event: "sign_out", at: "2026-10-13T10:00:00.000Z" });
  });

  it("identifies an account or an address only by a keyed hash, never by the value", () => {
    lines.length = 0;
    emitter.emit("sign_in_success", { account: "11111111-1111-4111-8111-111111111111" });
    emitter.emit("sign_in_failure", { address: "Person@Example.test" }, "rejected");
    emitter.emit("sign_in_failure", { address: "person@example.test" }, "rejected");
    const [account, address, same] = lines.map((line) => JSON.parse(line));
    assert.match(account.subject, /^[a-f0-9]{64}$/);
    assert.match(address.subject, /^[a-f0-9]{64}$/);
    assert.equal(address.subject, same.subject, "the address is normalized before hashing");
    assert.equal(address.code, "rejected");
    const text = lines.join("\n");
    for (const value of ["11111111-1111", "person@example.test", "Person@Example", secret]) {
      assert.equal(text.includes(value), false, value);
    }
  });

  it("writes to the console by default and with the real clock", () => {
    const written: unknown[] = [];
    const original = console.log;
    console.log = (line: unknown) => written.push(line);
    try {
      createEventEmitter({ secret }).emit("housekeeping_done");
    } finally {
      console.log = original;
    }
    assert.equal(written.length, 1);
    assert.equal(JSON.parse(String(written[0])).event, "housekeeping_done");
  });
});
