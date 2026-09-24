import assert from "node:assert/strict";
import test from "node:test";
import { InMemoryNotificationStore } from "./in-memory-notifications.ts";
import { NotificationService } from "./notification-service.ts";
const now = () => new Date("2026-03-22T10:00:00.000Z");
const duty = (dueAt: string, revision = 1) => ({ id: "duty", dueAt, revision, recipientIds: ["parent"] });
function setup(clock = now) { const store = new InMemoryNotificationStore(); const jobs: Array<{ jobId: string; dutyId: string; recipientId: string; dueAt: string }> = []; const queue = { enqueue: (job: (typeof jobs)[number]) => jobs.push(job), cancelDuty: (_dutyId: string) => undefined }; const service = new NotificationService(store, { send: () => ({ accepted: true, honorsIdempotency: true }) }, queue, clock); return { store, jobs, service }; }
test("creates paired in-app and durable queued email outcomes at both thresholds", () => { const { store, jobs, service } = setup(); assert.equal(service.schedule(duty("2026-03-29T10:00:00.000Z")).length, 2); assert.equal(store.notifications.length, 2); assert.deepEqual(store.attempts.map((attempt) => attempt.status), ["queued", "queued"]); assert.equal(jobs.length, 2); });
test("creates missed threshold notification immediately once", () => { const { store, jobs, service } = setup(); const input = duty("2026-03-23T09:00:00.000Z"); assert.equal(service.schedule(input).length, 2); assert.equal(service.schedule(input).length, 0); assert.equal(store.notifications[0]?.createdAt, now().toISOString()); assert.equal(jobs[0]?.dueAt, now().toISOString()); });
test("records privacy-safe queued status", () => { const { service } = setup(); const status = service.schedule(duty("2026-03-29T10:00:00.000Z"))[0]; assert.equal(status?.status, "queued"); assert.equal(JSON.stringify(status).includes("@"), false); });
test("uses instants across Budapest DST boundaries without local-time arithmetic", () => { const { service } = setup(() => new Date("2026-03-22T10:00:00.000Z")); assert.equal(service.schedule(duty("2026-03-29T10:00:00.000Z"))[0]?.jobId.includes(":7d:"), true); });
