import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { NotificationModel } from "../application/index.ts";
import {
  notificationHref,
  pendingRequests,
  resolveNotificationContext,
} from "./notification-context.ts";

const notice = (id: string, link: string): NotificationModel => ({
  id,
  title: id,
  link,
  isRead: false,
  timing: "7-day",
  providerStatus: "simulated-sent",
});

const notifications = [
  notice("notice-a", "/szulo/feladatok/duty-assigned"),
  notice("notice-b", "/szulo/feladatok/duty-garden"),
  notice("notice-stale", "/szulo/ertesitesek"),
];

describe("resolveNotificationContext", () => {
  it("resolves the parent's own notification that targets this task", () => {
    assert.equal(
      resolveNotificationContext(notifications, "notice-a", "duty-assigned")?.id,
      "notice-a",
    );
  });

  it("ignores an unknown id, a missing id and another task's notification", () => {
    assert.equal(
      resolveNotificationContext(notifications, "notice-zzz", "duty-assigned"),
      undefined,
    );
    assert.equal(resolveNotificationContext(notifications, undefined, "duty-assigned"), undefined);
    assert.equal(resolveNotificationContext(notifications, "", "duty-assigned"), undefined);
    assert.equal(resolveNotificationContext(notifications, "notice-b", "duty-assigned"), undefined);
  });

  it("ignores the stale notification that points to the list itself", () => {
    assert.equal(
      resolveNotificationContext(notifications, "notice-stale", "duty-assigned"),
      undefined,
    );
  });

  it("ignores every id when the parent has no notifications", () => {
    assert.equal(resolveNotificationContext([], "notice-a", "duty-assigned"), undefined);
  });
});

describe("notificationHref", () => {
  it("adds the notification id to a task link", () => {
    assert.equal(
      notificationHref(notifications[0]!),
      "/szulo/feladatok/duty-assigned?ertesites=notice-a",
    );
  });

  it("keeps a list-targeted link without context", () => {
    assert.equal(notificationHref(notifications[2]!), "/szulo/ertesitesek");
  });
});

describe("pendingRequests", () => {
  it("reports a waiting swap, a waiting cancellation, or neither", () => {
    assert.deepEqual(pendingRequests({ state: "swap-pending" }), {
      swap: true,
      cancellation: false,
      any: true,
    });
    assert.deepEqual(pendingRequests({ state: "cancellation-pending" }), {
      swap: false,
      cancellation: true,
      any: true,
    });
    assert.deepEqual(pendingRequests({ state: "assigned" }), {
      swap: false,
      cancellation: false,
      any: false,
    });
  });
});
