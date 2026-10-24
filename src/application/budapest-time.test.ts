import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { budapestLocalToIso, isoToBudapestLocal } from "./budapest-time.ts";

describe("budapestLocalToIso", () => {
  it("uses the winter offset in winter and the summer offset in summer", () => {
    assert.equal(budapestLocalToIso("2026-11-05T09:00"), "2026-11-05T08:00:00.000Z");
    assert.equal(budapestLocalToIso("2026-07-05T09:00"), "2026-07-05T07:00:00.000Z");
  });

  it("handles the days the clocks change", () => {
    // Clocks go forward on 2027-03-28 at 02:00 and back on 2026-10-25 at 03:00.
    assert.equal(budapestLocalToIso("2027-03-28T01:30"), "2027-03-28T00:30:00.000Z");
    assert.equal(budapestLocalToIso("2027-03-28T03:30"), "2027-03-28T01:30:00.000Z");
    assert.equal(budapestLocalToIso("2026-10-25T01:30"), "2026-10-24T23:30:00.000Z");
    assert.equal(budapestLocalToIso("2026-10-25T04:30"), "2026-10-25T03:30:00.000Z");
  });

  it("refuses a time that does not exist, text that is not a date, and impossible dates", () => {
    assert.equal(budapestLocalToIso("2027-03-28T02:30"), undefined);
    assert.equal(budapestLocalToIso("holnap"), undefined);
    assert.equal(budapestLocalToIso(""), undefined);
    assert.equal(budapestLocalToIso("2026-02-30T10:00"), undefined);
    assert.equal(budapestLocalToIso("2026-13-01T10:00"), undefined);
  });
});

describe("isoToBudapestLocal", () => {
  it("writes an instant as the wall clock of Budapest", () => {
    assert.equal(isoToBudapestLocal("2026-11-05T08:00:00+00:00"), "2026-11-05T09:00");
    assert.equal(isoToBudapestLocal("2026-07-05T07:00:00.000Z"), "2026-07-05T09:00");
  });

  it("gives empty text for nothing or for text that is not a date", () => {
    assert.equal(isoToBudapestLocal(undefined), "");
    assert.equal(isoToBudapestLocal("nem dátum"), "");
  });

  it("is the inverse of budapestLocalToIso for existing times", () => {
    for (const value of ["2026-01-15T00:00", "2026-06-30T23:59", "2026-10-25T04:00"]) {
      assert.equal(isoToBudapestLocal(budapestLocalToIso(value)), value);
    }
  });
});
