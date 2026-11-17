import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  budapestToday,
  DUTY_CARD_TEXT,
  EMPTY_WEEK_REASON_TEXT,
  formatLongDay,
  formatShortDay,
  formatWeekRange,
  hasRotaRefusalMessage,
  HOLD_REASON_TEXT,
  PICK_STATE_TEXT,
  ROTA_JOB_LABELS,
  ROTA_WARNING_TEXT,
  rotaRefusalMessage,
  STANDING_LABELS,
  WEEKEND_SLOT_LABELS,
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
      "ROTA_SAME_WEEK_CLASH",
      "STANDING_INVALID",
      "DUTY_INELIGIBLE",
      "WEEKEND_PICK_CLOSED",
      "WEEKEND_PICK_LOCKED",
      "WEEKEND_PICK_NOT_NEEDED",
      "WEEKEND_SLOT_NOT_PICKABLE",
      "WEEKEND_SLOT_TAKEN",
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

  it("gives every refusal code of the four rotas and the weekend picks its own sentence, and none of them names a person", () => {
    const codes = [
      "ROTA_SAME_WEEK_CLASH",
      "STANDING_INVALID",
      "DUTY_INELIGIBLE",
      "WEEKEND_PICK_CLOSED",
      "WEEKEND_PICK_LOCKED",
      "WEEKEND_PICK_NOT_NEEDED",
      "WEEKEND_SLOT_NOT_PICKABLE",
      "WEEKEND_SLOT_TAKEN",
    ];
    const sentences = codes.map((code) => rotaRefusalMessage(code));
    assert.equal(new Set(sentences).size, codes.length, "each code reads differently");
    for (const sentence of sentences) assert.match(sentence, /[.]$/, "a full sentence");
  });
});

describe("the words of the four rotas", () => {
  it("names every rota and every weekend duty the way the database does", () => {
    assert.deepEqual(Object.keys(ROTA_JOB_LABELS), [
      "indoor_cleaning",
      "front_garden",
      "water_carrying",
      "weekend_animal_care",
    ]);
    assert.deepEqual(Object.keys(WEEKEND_SLOT_LABELS), [
      "saturday_opening",
      "saturday_closing",
      "sunday_opening",
      "sunday_closing",
      "shelter_cleaning",
    ]);
    assert.equal(ROTA_JOB_LABELS.front_garden, "Előkert");
    assert.equal(WEEKEND_SLOT_LABELS.shelter_cleaning, "Hétvégi takarítás");
  });

  it("has a sentence for every standing, empty-week reason, hold reason and pick state", () => {
    assert.deepEqual(Object.values(STANDING_LABELS), ["Marad", "Távozik", "Új"]);
    assert.deepEqual(Object.keys(EMPTY_WEEK_REASON_TEXT), ["no_family", "cleared", "break_week"]);
    assert.deepEqual(Object.keys(HOLD_REASON_TEXT), [
      "leaving_after_changeover",
      "new_before_changeover",
    ]);
    assert.deepEqual(Object.keys(PICK_STATE_TEXT), ["open", "picked", "missed", "not_needed"]);
    assert.ok(ROTA_WARNING_TEXT.twoJobs.length > 0 && ROTA_WARNING_TEXT.breakWeek.length > 0);
  });

  it("has a card text for the three other rotas and the weekend duties", () => {
    assert.ok(DUTY_CARD_TEXT.front_garden.watering.includes("öntözés"));
    assert.ok(DUTY_CARD_TEXT.water_carrying.bottlesAtWeekEnd.length > 0);
    assert.ok(DUTY_CARD_TEXT.weekend_animal_care.instruction.includes("hétvég"));
    assert.deepEqual(Object.keys(DUTY_CARD_TEXT.weekend_slot.day), [
      "saturday",
      "sunday",
      "weekend",
    ]);
    assert.deepEqual(Object.keys(DUTY_CARD_TEXT.weekend_slot.partOfDay), [
      "morning",
      "evening",
      "all_day",
    ]);
  });
});
