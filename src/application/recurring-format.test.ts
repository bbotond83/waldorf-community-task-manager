import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  daysBetween,
  dueLine,
  formatMoment,
  intervalText,
  recurringState,
  seasonText,
} from "./recurring-format.ts";

describe("how often a duty comes back", () => {
  it("writes weekly intervals and the water-week interval in words", () => {
    assert.equal(intervalText({ intervalKind: "weeks", intervalCount: 1 }), "Hetente");
    assert.equal(intervalText({ intervalKind: "weeks", intervalCount: 2 }), "Kéthetente");
    assert.equal(intervalText({ intervalKind: "weeks", intervalCount: 6 }), "6 hetente");
    assert.equal(
      intervalText({ intervalKind: "rota_weeks", intervalCount: 1 }),
      "Minden vízhordó héten",
    );
    assert.equal(
      intervalText({ intervalKind: "rota_weeks", intervalCount: 4 }),
      "Minden 4. vízhordó héten",
    );
  });

  it("names a season by its two months and says nothing for a duty that runs all year", () => {
    assert.equal(seasonText({ seasonFromMonth: 4, seasonToMonth: 10 }), "április–október");
    assert.equal(seasonText({}), undefined);
    assert.equal(seasonText({ seasonFromMonth: 4 }), undefined);
    assert.equal(seasonText({ seasonFromMonth: 13, seasonToMonth: 14 }), undefined);
  });
});

describe("which state an occurrence is shown in", () => {
  const open = { status: "open" as const, isOverdue: false };
  it("keeps done and skipped as they are and sorts an open one by its date", () => {
    assert.equal(
      recurringState({ dueDate: "2026-11-01", status: "done", isOverdue: false }, "2026-11-22"),
      "done",
    );
    assert.equal(
      recurringState({ dueDate: "2026-11-01", status: "skipped", isOverdue: false }, "2026-11-22"),
      "skipped",
    );
    assert.equal(recurringState({ ...open, dueDate: "2026-11-22" }, "2026-11-22"), "due");
    assert.equal(recurringState({ ...open, dueDate: "2026-11-23" }, "2026-11-22"), "upcoming");
    assert.equal(recurringState({ ...open, dueDate: "2026-11-21" }, "2026-11-22"), "overdue");
    assert.equal(
      recurringState({ dueDate: "2026-11-23", status: "open", isOverdue: true }, "2026-11-22"),
      "overdue",
    );
  });
});

describe("the due line", () => {
  it("says today, yesterday, days ago, tomorrow and days ahead", () => {
    assert.equal(dueLine("2026-11-22", "2026-11-22"), "Esedékes: ma (vasárnap)");
    assert.equal(dueLine("2026-11-21", "2026-11-22"), "Esedékes volt: tegnap (2026. november 21.)");
    assert.equal(
      dueLine("2026-11-19", "2026-11-22"),
      "Esedékes volt: 3 napja (2026. november 19.)",
    );
    assert.equal(
      dueLine("2026-11-23", "2026-11-22"),
      "Esedékes: 2026. november 23. (hétfő) • holnap",
    );
    assert.equal(
      dueLine("2026-12-01", "2026-11-22"),
      "Esedékes: 2026. december 1. (kedd) • 9 nap múlva",
    );
  });

  it("counts whole days and treats text that is not a date as no distance", () => {
    assert.equal(daysBetween("2026-02-28", "2026-03-01"), 1);
    assert.equal(daysBetween("nem dátum", "2026-03-01"), 0);
  });
});

describe("a moment in Budapest time", () => {
  const now = new Date("2026-11-22T10:00:00Z");
  it("writes today, yesterday and an earlier day, also across the clock change", () => {
    assert.equal(formatMoment("2026-11-22T08:12:00Z", now), "ma 09:12");
    assert.equal(formatMoment("2026-11-21T15:40:00Z", now), "tegnap 16:40");
    assert.equal(formatMoment("2026-11-20T14:30:00Z", now), "2026. nov. 20. 15:30");
    assert.equal(formatMoment("2026-07-01T10:00:00Z", now), "2026. júl. 1. 12:00");
  });

  it("is empty for no moment or one that is not an instant", () => {
    assert.equal(formatMoment(undefined, now), "");
    assert.equal(formatMoment("nem idő", now), "");
  });
});
