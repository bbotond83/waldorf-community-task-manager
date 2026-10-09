import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { withoutSyllableBreaks, withSyllableBreaks } from "./hyphenation.ts";

describe("withSyllableBreaks", () => {
  it("breaks long role names only at Hungarian syllable boundaries", () => {
    assert.equal(
      withSyllableBreaks("Csoportadminisztrátor").split("­").join("-"),
      "Cso-port-ad-mi-niszt-rá-tor",
    );
    assert.equal(
      withSyllableBreaks("Szuperadminisztrátor").split("­").join("-"),
      "Szu-per-ad-mi-niszt-rá-tor",
    );
  });

  it("never leaves a segment shorter than two letters", () => {
    for (const name of ["Csoportadminisztrátor", "Szuperadminisztrátor"]) {
      for (const segment of withSyllableBreaks(name).split("­")) {
        assert.ok(segment.length >= 2, segment);
      }
    }
  });

  it("round-trips to the original text", () => {
    for (const name of ["Csoportadminisztrátor", "Szuperadminisztrátor"]) {
      assert.equal(withoutSyllableBreaks(withSyllableBreaks(name)), name);
    }
  });

  it("leaves short and unknown text untouched", () => {
    assert.equal(withSyllableBreaks("Szülő"), "Szülő");
    assert.equal(withSyllableBreaks("Óvónő"), "Óvónő");
    assert.equal(withSyllableBreaks("Ismeretlen"), "Ismeretlen");
  });
});
