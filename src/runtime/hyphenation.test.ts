import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { withoutSyllableBreaks, withSyllableBreaks } from "./hyphenation.ts";

describe("withSyllableBreaks", () => {
  it("breaks long role names only at Hungarian syllable boundaries", () => {
    assert.equal(
      withSyllableBreaks("Szuperadminisztrátor").split("­").join("-"),
      "Szu-per-ad-mi-niszt-rá-tor",
    );
  });

  it("never leaves a segment shorter than two letters", () => {
    for (const segment of withSyllableBreaks("Szuperadminisztrátor").split("­")) {
      assert.ok(segment.length >= 2, segment);
    }
  });

  it("round-trips to the original text", () => {
    assert.equal(
      withoutSyllableBreaks(withSyllableBreaks("Szuperadminisztrátor")),
      "Szuperadminisztrátor",
    );
  });

  it("leaves short and unknown text untouched", () => {
    assert.equal(withSyllableBreaks("Szülő"), "Szülő");
    assert.equal(withSyllableBreaks("Óvónő"), "Óvónő");
    assert.equal(withSyllableBreaks("Koordinátor"), "Koordinátor");
    assert.equal(withSyllableBreaks("Ismeretlen"), "Ismeretlen");
  });
});
