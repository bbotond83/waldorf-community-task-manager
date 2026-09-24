import assert from "node:assert/strict";
import test from "node:test";
import { DurableNotificationJobs } from "./durable-jobs.ts";
test("dispatches due jobs and records retry state", () => { const saved: unknown[] = []; const jobs = new DurableNotificationJobs({ listDue: () => [{ id: "job", dutyId: "duty", dueAt: "2026-08-01T00:00:00Z", status: "queued", attempts: 0 }], save: (job) => saved.push(job), cancelByDuty: () => {} }, { dispatch: () => false }, () => new Date("2026-08-06T00:00:00Z")); assert.equal(jobs.dispatchDue()[0]?.status, "retry_scheduled"); assert.equal(saved.length, 1); });
test("cancels stale duty jobs", () => { let cancelled = ""; const jobs = new DurableNotificationJobs({ listDue: () => [], save: () => {}, cancelByDuty: (id) => { cancelled = id; } }, { dispatch: () => true }); jobs.cancelDuty("duty"); assert.equal(cancelled, "duty"); });
