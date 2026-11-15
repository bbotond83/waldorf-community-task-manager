import assert from "node:assert/strict";
import test from "node:test";
import {
  checkLabel,
  deliveryRetryKey,
  deliveryReasonLabel,
  formatMoment,
  UNKNOWN_REASON,
} from "./delivery-labels.ts";

test("names each reason class in words and never passes a code through", () => {
  assert.equal(deliveryReasonLabel("mail_unavailable"), "a levelezőszerver nem elérhető");
  assert.equal(deliveryReasonLabel("mail_rejected"), "a levelezőszerver elutasította a levelet");
  assert.match(deliveryReasonLabel("claim_expired"), /megszakadt/);
  assert.equal(deliveryReasonLabel("550 person@example.test"), UNKNOWN_REASON);
  assert.equal(deliveryReasonLabel(undefined), UNKNOWN_REASON);
});

test("names registered checks and keeps an unregistered name as it is", () => {
  assert.equal(checkLabel("duty_reminders"), "Feladat-emlékeztetők");
  assert.equal(checkLabel("other_check"), "other_check");
});

test("shows a moment in Budapest time, summer and winter, and a non-date as it came", () => {
  assert.equal(formatMoment("2026-11-14T06:15:00+00:00"), "2026. 11. 14. 07:15");
  assert.equal(formatMoment("2026-07-14T06:15:00Z"), "2026. 07. 14. 08:15");
  assert.equal(formatMoment("not a date"), "not a date");
});

test("the Try again key follows the whole list, not the sum of its try counts", () => {
  const a = "11111111-0000-4000-8000-0000000000a1";
  const b = "11111111-0000-4000-8000-0000000000a2";
  // After a partial retry: 3 + 3 became one email that failed again at 6 and one that is gone, same sum, other list.
  const before = deliveryRetryKey("sign_up_confirmed", a, [
    { id: a, tryCount: 3 },
    { id: b, tryCount: 3 },
  ]);
  const after = deliveryRetryKey("sign_up_confirmed", a, [{ id: a, tryCount: 6 }]);
  assert.notEqual(before, after);
  // Same list, any order: the same key (a repeated click is replayed).
  assert.equal(
    before,
    deliveryRetryKey("sign_up_confirmed", a, [
      { id: b, tryCount: 3 },
      { id: a, tryCount: 3 },
    ]),
  );
  assert.notEqual(
    before,
    deliveryRetryKey("sign_up_confirmed", a, [
      { id: a, tryCount: 3 },
      { id: b, tryCount: 4 },
    ]),
  );
  assert.ok(before.length < 200);
});
