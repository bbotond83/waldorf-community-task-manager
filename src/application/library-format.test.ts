import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { budapestToday, formatLibraryDate, isOverdue, latestReturnDate } from "./library-format.ts";

describe("library dates", () => {
  it("writes a date the way the community does, and leaves other text alone", () => {
    assert.equal(formatLibraryDate("2026-12-01"), "2026. 12. 01.");
    assert.equal(formatLibraryDate("2026-12-01T10:00:00Z"), "2026. 12. 01.");
    assert.equal(formatLibraryDate(undefined), "");
    assert.equal(formatLibraryDate("bármi"), "bármi");
  });

  it("reads today in Budapest, also just after midnight there", () => {
    assert.equal(budapestToday(new Date("2026-06-30T22:30:00Z")), "2026-07-01");
    assert.equal(budapestToday(new Date("2026-12-31T23:30:00Z")), "2027-01-01");
  });

  it("calls a book late only the day after its date", () => {
    assert.equal(isOverdue("2026-11-20", "2026-11-20"), false);
    assert.equal(isOverdue("2026-11-20", "2026-11-21"), true);
    assert.equal(isOverdue(undefined, "2026-11-21"), false);
    assert.equal(isOverdue("nem dátum", "2026-11-21"), false);
  });

  it("offers dates up to a year ahead", () => {
    assert.equal(latestReturnDate("2026-11-21"), "2027-11-21");
    assert.equal(latestReturnDate("2028-02-29"), "2029-02-28");
  });
});
