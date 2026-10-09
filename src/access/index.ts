export { AccessService } from "./access-service.ts";
export {
  InMemoryAccessTransaction,
  InMemoryAuditWriter,
  InMemoryRoleGrantRepository,
  InMemoryUserRepository,
} from "./in-memory-adapters.ts";
export type * from "./types.ts";

export { convertLegacyRoles } from "./legacy-role-conversion.ts";
export type { ConversionResult, ConversionPreconditions } from "./legacy-role-conversion.ts";
export {
  CURRENT_ROLES,
  isCurrentRole,
  isRoleScope,
  effectiveGrants,
  grantAllows,
} from "./role-policy.ts";
