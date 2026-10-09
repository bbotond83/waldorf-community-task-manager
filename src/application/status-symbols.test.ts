import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DUTY_STATE_LABELS,
  DUTY_STATE_SYMBOLS,
  dutyStateOptionText,
  dutyStateSymbol,
  NO_TEACHER_STATUS_LABEL,
  STATUS_ICON_CHARACTERS,
  STATUS_LABELS,
  STATUS_SYMBOLS,
  statusDisplay,
  statusOptionText,
  statusSymbol,
  teacherStatusDisplay,
  UNKNOWN_STATUS_SYMBOL,
} from "./status-labels.ts";

describe("status symbols", () => {
  it("gives every key of STATUS_LABELS an icon key and a plain character", () => {
    for (const key of Object.keys(STATUS_LABELS)) {
      const symbol = STATUS_SYMBOLS[key as keyof typeof STATUS_SYMBOLS];
      assert.ok(symbol, `no symbol for status ${key}`);
      assert.equal(symbol.character, STATUS_ICON_CHARACTERS[symbol.icon]);
      assert.ok(symbol.character.length > 0);
    }
    assert.deepEqual(Object.keys(STATUS_SYMBOLS).sort(), Object.keys(STATUS_LABELS).sort());
  });

  it("gives every key of DUTY_STATE_LABELS an icon key and a plain character", () => {
    for (const key of Object.keys(DUTY_STATE_LABELS)) {
      assert.ok(DUTY_STATE_SYMBOLS[key as keyof typeof DUTY_STATE_SYMBOLS], `no symbol for ${key}`);
    }
    assert.deepEqual(Object.keys(DUTY_STATE_SYMBOLS).sort(), Object.keys(DUTY_STATE_LABELS).sort());
  });

  it("uses check, cross and clock for the approval states", () => {
    assert.equal(statusSymbol("approved").icon, "check");
    assert.equal(statusSymbol("rejected").icon, "cross");
    assert.equal(statusSymbol("pending").icon, "clock");
  });

  it("uses only text-presentation characters, so no emoji font is needed", () => {
    for (const character of Object.values(STATUS_ICON_CHARACTERS)) {
      assert.doesNotMatch(character, /\p{Emoji_Presentation}/u);
      assert.equal(character.length, 1);
    }
  });

  it("gives an unknown or prototype key the neutral symbol", () => {
    assert.equal(statusSymbol("no-such-status"), UNKNOWN_STATUS_SYMBOL);
    assert.equal(statusSymbol("constructor"), UNKNOWN_STATUS_SYMBOL);
    assert.equal(dutyStateSymbol("no-such-state"), UNKNOWN_STATUS_SYMBOL);
    assert.equal(statusDisplay("no-such-status").label, "Ismeretlen állapot");
  });

  it("builds dropdown option text as character, space, word", () => {
    assert.equal(statusOptionText("approved"), "✓ Jóváhagyva");
    assert.equal(statusOptionText("rejected"), "✕ Elutasítva");
    assert.equal(statusOptionText("pending"), "◔ Függőben");
    assert.equal(dutyStateOptionText("full"), "■ Betelt");
  });
});

describe("teacher status mapping", () => {
  it("shows the source word 'Ütemezett' as the shared 'Ütemezve' with its symbol", () => {
    const display = teacherStatusDisplay("Ütemezett");
    assert.equal(display.label, "Ütemezve");
    assert.equal(display.symbol, STATUS_SYMBOLS.scheduled);
  });

  it("maps a word that already is a shared label", () => {
    const display = teacherStatusDisplay("Nyitott");
    assert.equal(display.label, "Nyitott");
    assert.equal(display.symbol, STATUS_SYMBOLS.open);
  });

  it("leaves unmapped text unchanged with the neutral symbol", () => {
    const display = teacherStatusDisplay("Egyedi állapot");
    assert.equal(display.label, "Egyedi állapot");
    assert.equal(display.symbol, UNKNOWN_STATUS_SYMBOL);
    assert.equal(teacherStatusDisplay("toString").label, "toString");
  });

  it("shows the fixed notice and no symbol when the source gives no status", () => {
    const display = teacherStatusDisplay(null);
    assert.equal(display.label, NO_TEACHER_STATUS_LABEL);
    assert.equal(display.symbol, null);
  });
});
