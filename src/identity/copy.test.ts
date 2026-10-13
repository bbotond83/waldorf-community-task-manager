import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { COPY } from "./copy.ts";

function strings(value: unknown, found: string[] = []): string[] {
  if (typeof value === "string") found.push(value);
  else if (value && typeof value === "object")
    for (const item of Object.values(value)) strings(item, found);
  return found;
}

describe("Hungarian copy (NFR5.3)", () => {
  const all = strings(COPY);

  it("has the fixed wording of the design", () => {
    assert.equal(COPY.signIn.invalid, "Hibás e-mail-cím vagy jelszó.");
    assert.equal(
      COPY.signIn.locked,
      "Túl sok sikertelen próbálkozás. Próbálja újra 15 perc múlva.",
    );
    assert.equal(
      COPY.reset.confirmation,
      "Ha az e-mail-cím ismert, elküldtük a jelszó-visszaállítási levelet.",
    );
    assert.equal(
      COPY.invitation.notValid,
      "Ez a meghívó már nem érvényes. Kérjen újat a csoport adminisztrátorától.",
    );
    assert.equal(
      COPY.password.ruleError,
      "A jelszó legalább 8 és legfeljebb 72 karakter legyen, és tartalmazzon betűt és számot.",
    );
    assert.equal(COPY.common.temporary, "Átmeneti hiba történt. Próbálja újra.");
    assert.equal(COPY.common.accessDenied, "Ehhez az adathoz nincs jogosultsága.");
  });

  it("holds only non-empty text and no common English word", () => {
    assert.ok(all.length > 40);
    for (const text of all) {
      assert.ok(text.trim().length > 0);
      assert.equal(
        /\b(the|and|please|sign in|password|invalid|error|try again|email)\b/i.test(text),
        false,
        text,
      );
    }
  });

  it("names every role and scope an invitation can have", () => {
    for (const role of ["parent", "kindergarten_teacher", "group_admin", "super_admin"]) {
      assert.ok(COPY.invitation.roles[role]);
    }
    for (const scope of ["family", "group", "organization"])
      assert.ok(COPY.invitation.scopes[scope]);
  });
});
