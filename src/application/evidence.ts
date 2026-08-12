import type { ApplicationEvent, Clock, EvidenceReference, IdGenerator } from "./contracts.ts";
import { assertNoForbiddenProperties } from "./projection.ts";

export interface EventPublisher {
  publish(event: ApplicationEvent): void | Promise<void>;
}

export interface EvidencePort {
  record(reference: EvidenceReference): void | Promise<void>;
}

export class EventCoordinator {
  private readonly publisher: EventPublisher;
  private readonly clock: Clock;
  private readonly ids: IdGenerator;

  constructor(publisher: EventPublisher, clock: Clock, ids: IdGenerator) {
    this.publisher = publisher;
    this.clock = clock;
    this.ids = ids;
  }

  async publish(input: Omit<ApplicationEvent, "id" | "occurredAt">): Promise<ApplicationEvent> {
    const event = Object.freeze({
      ...input,
      id: this.ids.nextId(),
      occurredAt: this.clock.now().toISOString(),
    });
    assertNoForbiddenProperties(event);
    await this.publisher.publish(event);
    return event;
  }
}

export class EvidenceRecorder {
  private readonly evidence: EvidencePort;
  private readonly clock: Clock;
  private readonly ids: IdGenerator;

  constructor(evidence: EvidencePort, clock: Clock, ids: IdGenerator) {
    this.evidence = evidence;
    this.clock = clock;
    this.ids = ids;
  }

  async record(
    input: Omit<EvidenceReference, "id" | "recordedAt" | "status"> & {
      outcome: "passed" | "failed";
    },
  ): Promise<EvidenceReference> {
    const reference: EvidenceReference = Object.freeze({
      id: this.ids.nextId(),
      scenarioId: input.scenarioId,
      storyId: input.storyId,
      requirementId: input.requirementId,
      matrixRowId: input.matrixRowId,
      executionTarget: input.executionTarget,
      status:
        input.executionTarget === "linked-target"
          ? "OUTSTANDING"
          : input.outcome === "passed"
            ? "PASS"
            : "FAIL",
      recordedAt: this.clock.now().toISOString(),
      location: input.location,
    });
    assertNoForbiddenProperties(reference);
    await this.evidence.record(reference);
    return reference;
  }
}

export class InMemoryApplicationJournal implements EventPublisher, EvidencePort {
  readonly events: ApplicationEvent[] = [];
  readonly evidence: EvidenceReference[] = [];

  publish(event: ApplicationEvent): void {
    this.events.push(event);
  }

  record(reference: EvidenceReference): void {
    this.evidence.push(reference);
  }
}
