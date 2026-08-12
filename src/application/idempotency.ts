import type { ApplicationResult } from "./contracts.ts";
import { conflict } from "./results.ts";

type StoredResult<T> =
  | { state: "pending"; fingerprint: string }
  | { state: "terminal"; fingerprint: string; result: ApplicationResult<T> };

export interface IdempotencyStore {
  get<T>(operationKey: string): StoredResult<T> | undefined;
  set<T>(operationKey: string, value: StoredResult<T>): void;
  delete(operationKey: string): void;
}

export class InMemoryIdempotencyStore implements IdempotencyStore {
  private readonly values = new Map<string, StoredResult<unknown>>();

  get<T>(operationKey: string): StoredResult<T> | undefined {
    return this.values.get(operationKey) as StoredResult<T> | undefined;
  }

  set<T>(operationKey: string, value: StoredResult<T>): void {
    this.values.set(operationKey, value as StoredResult<unknown>);
  }

  delete(operationKey: string): void {
    this.values.delete(operationKey);
  }
}

export class IdempotencyCoordinator {
  private readonly store: IdempotencyStore;

  constructor(store: IdempotencyStore) {
    this.store = store;
  }

  async execute<T>(input: {
    actorId: string;
    operation: string;
    idempotencyKey: string;
    fingerprint: string;
    invoke: () => Promise<ApplicationResult<T>>;
  }): Promise<ApplicationResult<T>> {
    const operationKey = `${input.actorId}:${input.operation}:${input.idempotencyKey}`;
    const stored = this.store.get<T>(operationKey);
    if (stored && stored.fingerprint !== input.fingerprint) {
      return conflict("IDEMPOTENCY_FINGERPRINT_MISMATCH");
    }
    if (stored?.state === "pending") return conflict("IDEMPOTENCY_OPERATION_PENDING");
    if (stored?.state === "terminal" && stored.result.state !== "dependency-failure-retryable") {
      return stored.result;
    }

    this.store.set(operationKey, { state: "pending", fingerprint: input.fingerprint });
    try {
      const result = await input.invoke();
      this.store.set(operationKey, { state: "terminal", fingerprint: input.fingerprint, result });
      return result;
    } catch (error) {
      this.store.delete(operationKey);
      throw error;
    }
  }
}
