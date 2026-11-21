import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Role, RoleGrant, Scope } from "../access/index.ts";
import type { SessionContext } from "./contracts.ts";
import {
  FOOD_CATEGORY_LABELS,
  formatDeadline,
  formatEventDay,
  formatEventRange,
  formatEventTime,
  ingredientWords,
  manageScopeFor,
  noticeLines,
} from "./event-format.ts";
import { FOOD_CATEGORIES } from "./contracts.ts";

const org: Scope = { id: "org-1", type: "organization", organizationId: "org-1" };
const family: Scope = { id: "family-1", type: "family", organizationId: "org-1" };
const groupA: Scope = { id: "group-a", type: "group", organizationId: "org-1" };

function session(
  grants: readonly Pick<RoleGrant, "role" | "scope" | "revokedAt">[],
): SessionContext {
  return {
    subjectId: "user-1",
    authorizationVersion: 1,
    isActive: true,
    grants: grants.map((grant, index) => ({
      id: `g${index}`,
      subjectId: "user-1",
      grantedAt: "2026-01-01T00:00:00Z",
      ...grant,
    })),
    roles: grants.map((grant) => grant.role as Role),
    scopes: grants.map((grant) => grant.scope),
  } as SessionContext;
}

describe("event wording", () => {
  it("writes the day, the hours and the deadline in Hungarian, in Budapest time", () => {
    // 09:00 UTC on 5 December is 10:00 in Budapest (winter time).
    assert.equal(formatEventDay("2026-12-05T09:00:00Z"), "2026. december 5., szombat");
    assert.equal(formatEventTime("2026-12-05T09:00:00Z"), "10:00");
    assert.equal(
      formatEventRange("2026-12-05T09:00:00Z", "2026-12-05T15:00:00Z"),
      "2026. december 5., szombat • 10:00–16:00",
    );
    assert.equal(formatDeadline("2026-12-01"), "2026. december 1.");
  });

  it("writes both ends in full when an event runs past midnight, and leaves a non-date as it is", () => {
    assert.equal(
      formatEventRange("2026-12-05T20:00:00Z", "2026-12-06T09:00:00Z"),
      "2026. december 5., szombat 21:00 – 2026. december 6., vasárnap 10:00",
    );
    assert.equal(formatEventDay("nem dátum"), "nem dátum");
    assert.equal(formatEventTime("nem dátum"), "");
  });

  it("has a word for every food category and lists the ticked ingredients", () => {
    for (const category of FOOD_CATEGORIES) assert.ok(FOOD_CATEGORY_LABELS[category]);
    assert.equal(
      ingredientWords({ hasMilk: true, hasEgg: false, hasGarlic: true }),
      "Tej, fokhagyma",
    );
    assert.equal(ingredientWords({ hasMilk: false, hasEgg: false, hasGarlic: false }), "");
  });

  it("reads a notices field as one notice per non-empty line", () => {
    assert.deepEqual(noticeLines(" Első \r\n\n  Második\n"), ["Első", "Második"]);
    assert.deepEqual(noticeLines(""), []);
  });
});

describe("the scope a manager's command carries", () => {
  it("is a super admin's own scope for any event", () => {
    const scope = manageScopeFor(session([{ role: "super_admin", scope: org }]), family, groupA.id);
    assert.deepEqual(scope, org);
  });

  it("is the group administrator's grant for the event's own group only", () => {
    const grants = [
      { role: "parent", scope: family },
      { role: "group_admin", scope: groupA },
    ] as const;
    assert.deepEqual(manageScopeFor(session(grants), family, "group-a"), groupA);
    assert.deepEqual(manageScopeFor(session(grants), family, "group-b"), family);
    assert.deepEqual(manageScopeFor(session(grants), family, undefined), family);
  });

  it("ignores a revoked grant", () => {
    const revoked = { role: "super_admin", scope: org, revokedAt: "2026-01-01T00:00:00Z" } as const;
    assert.deepEqual(manageScopeFor(session([revoked]), family, undefined), family);
  });
});
