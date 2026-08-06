export type Threshold = "7d" | "24h";
export interface Duty { id: string; dueAt: string; revision: number; recipientIds: string[]; }
export interface Notification { id: string; recipientId: string; dutyId: string; threshold: Threshold; createdAt: string; }
export interface EmailAttempt { jobId: string; recipientId: string; status: "queued" | "sent" | "retry_scheduled" | "at_least_once"; }
export interface EmailProvider { send(input: { jobId: string; recipientId: string; dueAt: string }): { accepted: boolean; honorsIdempotency: boolean }; }
export interface NotificationStore { saveNotification(notification: Notification): void; saveAttempt(attempt: EmailAttempt): void; hasJob(jobId: string): boolean; }
export interface NotificationJobQueue { enqueue(job: { jobId: string; dutyId: string; recipientId: string; dueAt: string }): void; cancelDuty(dutyId: string): void; }
export interface NotificationStatus { jobId: string; status: EmailAttempt["status"]; deliveryGuarantee: "provider_idempotent" | "at_least_once"; }
const OFFSETS: Record<Threshold, number> = { "7d": 7 * 24 * 60 * 60 * 1000, "24h": 24 * 60 * 60 * 1000 };
export class NotificationService {
  private readonly store: NotificationStore; private readonly provider: EmailProvider; private readonly now: () => Date;
  private readonly queue: NotificationJobQueue;
  constructor(store: NotificationStore, provider: EmailProvider, queue: NotificationJobQueue, now: () => Date = () => new Date()) { this.store = store; this.provider = provider; this.now = now; this.queue = queue; }
  cancelDuty(dutyId: string): void { this.queue.cancelDuty(dutyId); }
  schedule(duty: Duty): NotificationStatus[] { const now = this.now(); const due = new Date(duty.dueAt); return (["7d", "24h"] as Threshold[]).flatMap<NotificationStatus>((threshold) => this.scheduleThreshold(duty, threshold, due, now)); }
  private scheduleThreshold(duty: Duty, threshold: Threshold, due: Date, now: Date): NotificationStatus[] { const scheduledAt = new Date(due.getTime() - OFFSETS[threshold]); if (due <= now) return []; const sendAt = scheduledAt <= now ? now : scheduledAt; return duty.recipientIds.flatMap<NotificationStatus>((recipientId) => { const jobId = `${duty.id}:${duty.revision}:${threshold}:${recipientId}`; if (this.store.hasJob(jobId)) return []; this.store.saveNotification({ id: `in-app:${jobId}`, recipientId, dutyId: duty.id, threshold, createdAt: sendAt.toISOString() }); this.queue.enqueue({ jobId, dutyId: duty.id, recipientId, dueAt: sendAt.toISOString() }); this.store.saveAttempt({ jobId, recipientId, status: "queued" }); return [{ jobId, status: "queued", deliveryGuarantee: "provider_idempotent" }]; }); }
}
