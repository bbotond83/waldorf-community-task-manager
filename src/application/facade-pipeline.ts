import type {
  ApplicationResult,
  AuthorizationMatrixRowId,
  SensitiveFieldId,
  SessionContext,
} from "./contracts.ts";
import type { ApplicationAction, AuthorizationContract } from "./authorization.ts";
import { mapUnexpectedFailure, validation } from "./results.ts";
import type { Scope } from "../access/index.ts";
import type { IdempotencyCoordinator } from "./idempotency.ts";

export type DomainOutcome<T> =
  | { state: "success"; data: T }
  | { state: "empty" }
  | { state: "denied" }
  | { state: "validation"; fieldErrors: Readonly<Record<string, string>>; code?: string }
  | { state: "conflict"; code?: string }
  | { state: "invalidated"; code?: string }
  | { state: "recovery"; data: T };

export type AdapterFailureClassifier = (error: unknown) => "retryable" | "terminal";

export class FacadePipeline {
  private readonly authorization: AuthorizationContract;
  private readonly classifyFailure: AdapterFailureClassifier;
  private readonly idempotency?: IdempotencyCoordinator;

  constructor(
    authorization: AuthorizationContract,
    classifyFailure: AdapterFailureClassifier = () => "terminal",
    idempotency?: IdempotencyCoordinator,
  ) {
    this.authorization = authorization;
    this.classifyFailure = classifyFailure;
    this.idempotency = idempotency;
  }

  async invoke<T>(input: {
    session: SessionContext;
    matrixRowId: AuthorizationMatrixRowId;
    action: ApplicationAction;
    resource: string;
    scope: Scope;
    fields?: readonly SensitiveFieldId[];
    idempotencyKey?: string;
    idempotency?: Readonly<{ operation: string; fingerprint: string }>;
    validate?: () => Extract<ApplicationResult<never>, { state: "validation" }> | undefined;
    invoke: () => DomainOutcome<T> | Promise<DomainOutcome<T>>;
    project: (value: T) => Readonly<T>;
  }): Promise<ApplicationResult<T>> {
    const authorization = await this.authorization.authorize(input.session, {
      matrixRowId: input.matrixRowId,
      action: input.action,
      resource: input.resource,
      scope: input.scope,
      fields: input.fields,
    });
    if (authorization.state === "denied" || authorization.state === "invalidated") {
      return authorization;
    }
    if (authorization.state !== "success") {
      return mapUnexpectedFailure(new Error("Unexpected authorization result"), {
        idempotencyKey: "retry-not-available",
        action: "authorize",
      });
    }

    // Optional filter validation runs only after current authority succeeds.
    const validationResult = input.validate?.();
    if (validationResult) return validationResult;
    const execute = () => this.invokeDomain(input);
    if (input.idempotency && input.idempotencyKey && this.idempotency) {
      return this.idempotency.execute({
        actorId: input.session.subjectId,
        operation: input.idempotency.operation,
        idempotencyKey: input.idempotencyKey,
        fingerprint: input.idempotency.fingerprint,
        invoke: execute,
      });
    }
    return execute();
  }

  private async invokeDomain<T>(input: {
    action: ApplicationAction;
    resource: string;
    idempotencyKey?: string;
    invoke: () => DomainOutcome<T> | Promise<DomainOutcome<T>>;
    project: (value: T) => Readonly<T>;
  }): Promise<ApplicationResult<T>> {
    try {
      const outcome = await input.invoke();
      switch (outcome.state) {
        case "success":
          return {
            state: "success",
            code: "SUCCESS",
            presentationCode: "APP-SUCCESS",
            focusTarget: "#fo-tartalom",
            announcement: "polite",
            data: input.project(outcome.data),
          };
        case "recovery":
          return {
            state: "recovery",
            code: "RECOVERY_REQUIRED",
            presentationCode: "APP-RECOVERY",
            focusTarget: "#fo-tartalom",
            announcement: "assertive",
            data: input.project(outcome.data),
          };
        case "empty":
          return {
            state: "empty",
            code: "EMPTY",
            presentationCode: "APP-EMPTY",
            focusTarget: "#fo-tartalom",
            announcement: "polite",
          };
        case "denied":
          return {
            state: "denied",
            code: "AUTHORIZATION_DENIED",
            presentationCode: "APP-DENIED",
            focusTarget: "#hozzaferes-megtagadva",
            announcement: "assertive",
          };
        case "validation":
          return validation(outcome.fieldErrors, outcome.code);
        case "conflict":
          return {
            state: "conflict",
            code: outcome.code ?? "STATE_CONFLICT",
            presentationCode: "APP-CONFLICT",
            focusTarget: "#fo-tartalom",
            announcement: "assertive",
          };
        case "invalidated":
          return {
            state: "invalidated",
            code: outcome.code ?? "STATE_INVALIDATED",
            presentationCode: "APP-INVALIDATED",
            focusTarget: "#fo-tartalom",
            announcement: "assertive",
          };
      }
    } catch (error) {
      return mapUnexpectedFailure(
        error,
        {
          idempotencyKey: input.idempotencyKey ?? "retry-not-available",
          action: `${input.action}:${input.resource}`,
        },
        this.classifyFailure,
      );
    }
  }
}
