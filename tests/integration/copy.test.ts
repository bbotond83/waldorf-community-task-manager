import { describe, expect, it } from "vitest";
import {
  ADMIN_CONFLICT_MESSAGES,
  mapApplicationResult,
} from "../../app/admin/_lib/action-state.ts";
import { mapParentResult, PARENT_CONFLICT_MESSAGES } from "../../app/szulo/_lib/action-state.ts";
import { conflict, invalidated, success } from "../../src/application/index.ts";
import { statusLabel } from "../../src/application/status-labels.ts";
import { BUSINESS_CODE_STATES } from "../../src/data/results.ts";
import { roleProfile } from "../support/role-profiles.ts";

/** Words that would show an English message on a Hungarian screen. */
const ENGLISH = /\b(the|and|error|failed|not|full|closed|swap|request|cannot|already|open)\b/i;

const PARENT_CODES = [
  "DUTY_FULL",
  "DUTY_CLOSED",
  "DUTY_ALREADY_ASSIGNED",
  "REQUEST_DUPLICATE",
  "REQUEST_CONFLICT",
  "SWAP_CANNOT_BE_APPLIED",
  "SWAP_REQUEST_NOT_OPEN",
] as const;

const ADMIN_CODES = [
  "RESTORE_CONFLICT",
  "VERSION_CONFLICT",
  "ASSIGNMENT_CAPACITY_FULL",
  "MEMBERSHIP_DUPLICATE",
  "ACCOUNT_ALREADY_LINKED",
  "SCHOOL_YEAR_HAS_ACTIVE_GROUPS",
] as const;

const PARENT_FALLBACK = "A művelet ütközik az aktuális állapottal.";
const ADMIN_FALLBACK = "A művelet ütközés miatt nem hajtható végre.";

describe("the conflict messages of the parent screens (BR32.8)", () => {
  it.each(PARENT_CODES)("%s has its own Hungarian message", (code) => {
    const state = mapParentResult(conflict(code), "");
    expect(state).toMatchObject({ state: "conflict", code });
    expect(state.message).toBeTruthy();
    expect(state.message).not.toBe(PARENT_FALLBACK);
    expect(state.message).not.toContain(code);
    expect(state.message).not.toMatch(ENGLISH);
    expect(state.message).toBe(PARENT_CONFLICT_MESSAGES[code]);
  });

  it("gives the messages in the table of the contract, every one different", () => {
    const messages = PARENT_CODES.map((code) => PARENT_CONFLICT_MESSAGES[code]);
    expect(new Set(messages).size).toBe(PARENT_CODES.length);
    expect(Object.keys(PARENT_CONFLICT_MESSAGES).sort()).toEqual([...PARENT_CODES].sort());
  });

  it("says the generic sentence for a code it does not know, also for names on the object prototype", () => {
    for (const code of ["SOMETHING_NEW", "constructor", "toString", ""]) {
      expect(mapParentResult(conflict(code), "").message).toBe(PARENT_FALLBACK);
    }
  });

  it("asks for a refresh when the place or the request changed meanwhile", () => {
    for (const code of ["DUTY_VERSION_STALE", "REQUEST_VERSION_STALE"]) {
      expect(mapParentResult(invalidated(code), "")).toMatchObject({
        state: "invalidated",
        message: "Az adatok időközben megváltoztak. Frissítse az oldalt.",
      });
    }
  });

  it("keeps the success message the screen passes in", () => {
    expect(mapParentResult(success({}), "A kérelmet visszavonta.")).toMatchObject({
      state: "success",
      message: "A kérelmet visszavonta.",
    });
  });
});

describe("the conflict messages of the admin screens (BR32.8)", () => {
  it.each(ADMIN_CODES)("%s has its own Hungarian message", (code) => {
    const state = mapApplicationResult(conflict(code));
    expect(state).toMatchObject({ state: "conflict", code });
    expect(state.message).not.toBe(ADMIN_FALLBACK);
    expect(state.message).not.toContain(code);
    expect(state.message).not.toMatch(ENGLISH);
    expect(state.message).toBe(ADMIN_CONFLICT_MESSAGES[code]);
  });

  it("gives the messages in the table of the contract, every one different", () => {
    const messages = ADMIN_CODES.map((code) => ADMIN_CONFLICT_MESSAGES[code]);
    expect(new Set(messages).size).toBe(ADMIN_CODES.length);
    expect(Object.keys(ADMIN_CONFLICT_MESSAGES).sort()).toEqual([...ADMIN_CODES].sort());
  });

  it("says the generic sentence for a code it does not know, also for names on the object prototype", () => {
    for (const code of ["SOMETHING_NEW", "constructor", "hasOwnProperty"]) {
      expect(mapApplicationResult(conflict(code)).message).toBe(ADMIN_FALLBACK);
    }
  });
});

describe("every conflict code of the database adapters has a message on some screen", () => {
  // Approvals, settings, lifecycle and grants are answered by screens that were not changed in this unit and
  // keep their own handling; every other code of the table belongs to the parent or the admin record screens.
  const OTHER_SCREENS = /^(APPROVAL_|SETTINGS_|LIFECYCLE_|GRANT_)/;
  const covered = new Set<string>([...PARENT_CODES, ...ADMIN_CODES]);

  it("lists a message for each code of the table of results", () => {
    const missing = Object.entries(BUSINESS_CODE_STATES)
      .filter(([code, state]) => state === "conflict" && !OTHER_SCREENS.test(code))
      .map(([code]) => code)
      .filter((code) => !covered.has(code));
    expect(missing).toEqual([]);
  });
});

describe("the other new words of the screens", () => {
  it("has its own word for a closed task", () => {
    expect(statusLabel("closed")).toBe("Lezárva");
  });

  it("puts the new page into the parent menu after the tasks", () => {
    const items = roleProfile("parent").navigation;
    expect(items.map((item) => [item.id, item.label, item.href])).toEqual([
      ["parent-notifications", "Értesítések", "/szulo/ertesitesek"],
      ["parent-duties", "Feladatok", "/szulo/feladatok"],
      ["parent-rota", "Beosztás", "/szulo/beosztas"],
      ["parent-swaps", "Cserék", "/szulo/cserek"],
      ["parent-working-groups", "Munkacsoportok", "/szulo/munkacsoportok"],
    ]);
  });
});
