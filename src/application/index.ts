export { AdminApplicationFacade } from "./admin-facade.ts";
export type { AdminApplicationPort, AdminOperation } from "./admin-facade.ts";
export type * from "./admin-payloads.ts";
export {
  AUTHORIZATION_MATRIX,
  AUTHORIZATION_MATRIX_VERSION,
  AuthorizationContract,
  InMemoryAuthorizationVersions,
} from "./authorization.ts";
export type {
  ApplicationAction,
  AuthorizationRequest,
  AuthorizationVersionPort,
} from "./authorization.ts";
export { EventCoordinator, EvidenceRecorder, InMemoryApplicationJournal } from "./evidence.ts";
export type { EvidencePort, EventPublisher } from "./evidence.ts";
export { FacadePipeline } from "./facade-pipeline.ts";
export type { AdapterFailureClassifier, DomainOutcome } from "./facade-pipeline.ts";
export { IdempotencyCoordinator, InMemoryIdempotencyStore } from "./idempotency.ts";
export type { IdempotencyStore } from "./idempotency.ts";
export { ParentApplicationFacade } from "./parent-facade.ts";
export type { ParentApplicationPort } from "./parent-facade.ts";
export {
  assertNoForbiddenProperties,
  projectAllowlisted,
  UnsafeProjectionError,
} from "./projection.ts";
export * from "./results.ts";
export { RotaApplicationFacade } from "./rota-facade.ts";
export type { RotaApplicationPort } from "./rota-facade.ts";
export { TeacherApplicationFacade } from "./teacher-facade.ts";
export type { TeacherApplicationPort } from "./teacher-facade.ts";
export type * from "./contracts.ts";
export {
  normalizeRequiredText,
  validateDateRange,
  validateIdempotencyKey,
  validateMutationContext,
} from "./validation.ts";
export type { ValidationCode } from "./validation.ts";
export { WorkingGroupApplicationFacade } from "./working-group-facade.ts";
export type { WorkingGroupApplicationPort } from "./working-group-facade.ts";
