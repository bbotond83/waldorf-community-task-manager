import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  budapestToday,
  formatLongDay,
  formatShortDay,
  formatWeekRange,
  hasRotaRefusalMessage,
  rotaRefusalMessage,
  weekdayName,
  weekPhase,
} from "./rota-format.ts";

describe("dates in Hungarian", () => {
  it("writes a day long and short", () => {
    assert.equal(formatLongDay("2026-11-02"), "2026. november 2.");
    assert.equal(formatShortDay("2026-09-01"), "2026. szept. 1.");
    assert.equal(formatLongDay("nem nap"), "nem nap");
    assert.equal(formatShortDay("2026-02-30"), "2026-02-30");
  });

  it("writes a week inside one month, across two months and across two years", () => {
    assert.equal(formatWeekRange("2026-11-02"), "2026. nov. 2–8.");
    assert.equal(formatWeekRange("2026-10-26"), "2026. okt. 26. – nov. 1.");
    assert.equal(formatWeekRange("2026-12-28"), "2026. dec. 28. – 2027. jan. 3.");
    assert.equal(formatWeekRange("hétfő"), "hétfő");
  });

  it("names the weekday", () => {
    assert.equal(weekdayName("2026-11-02"), "hétfő");
    assert.equal(weekdayName("2026-11-08"), "vasárnap");
    assert.equal(weekdayName("x"), "");
  });

  it("finds the Budapest day around midnight", () => {
    assert.equal(budapestToday(new Date("2026-11-10T22:30:00Z")), "2026-11-10");
    assert.equal(budapestToday(new Date("2026-11-10T23:30:00Z")), "2026-11-11");
  });
});

describe("which week is now", () => {
  it("marks the current week, the next one and every other", () => {
    assert.equal(weekPhase("2026-11-09", "2026-11-09"), "current");
    assert.equal(weekPhase("2026-11-09", "2026-11-15"), "current");
    assert.equal(weekPhase("2026-11-09", "2026-11-02"), "next");
    assert.equal(weekPhase("2026-11-09", "2026-11-08"), "next");
    assert.equal(weekPhase("2026-11-09", "2026-10-30"), "other");
    assert.equal(weekPhase("2026-11-09", "2026-11-16"), "other");
    assert.equal(weekPhase("2026-11-09", "nincs"), "other");
  });
});

describe("refusal messages", () => {
  it("has a sentence for every code of the calendar and the rota", () => {
    for (const code of [
      "ROTA_PLAN_EXISTS",
      "ROTA_PLAN_PUBLISHED",
      "ROTA_FAMILY_INELIGIBLE",
      "ROTA_BREAK_WEEK",
      "ROTA_WEEKS_EMPTY",
      "ROTA_DISCARD_OUTDATED",
      "BREAK_WEEK_INVALID",
      "BREAK_WEEK_EXISTS",
      "DUTY_ROTA_MANAGED",
      "VERSION_CONFLICT",
      "idempotency_key_reused",
    ]) {
      assert.equal(hasRotaRefusalMessage(code), true, code);
      assert.notEqual(rotaRefusalMessage(code), rotaRefusalMessage("ismeretlen"), code);
    }
  });

  it("gives the general sentence for an unknown or missing code", () => {
    assert.equal(rotaRefusalMessage("ismeretlen"), "A művelet most nem hajtható végre.");
    assert.equal(rotaRefusalMessage(undefined), "A művelet most nem hajtható végre.");
    assert.equal(hasRotaRefusalMessage(undefined), false);
  });
});
