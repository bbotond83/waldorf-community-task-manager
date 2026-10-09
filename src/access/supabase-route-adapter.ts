import { isAuthorizationVersion, isRoleScope } from "./role-policy.ts";
import type { Role, Scope } from "./types.ts";
export interface SupabaseClientPort {
  rpc(name: string, args: Record<string, unknown>): Promise<{ data: unknown; error: unknown }>;
}
export class SupabaseRouteAdapter {
  private readonly client: SupabaseClientPort;
  constructor(client: SupabaseClientPort) {
    this.client = client;
  }
  async authorizationVersion(subjectId: string): Promise<number | undefined> {
    const result = await this.client.rpc("authorization_version_for", {
      requested_subject_id: subjectId,
    });
    if (result.error) throw result.error;
    return isAuthorizationVersion(result.data) ? result.data : undefined;
  }
  async hasCurrentRoleScope(role: Role, scope: Scope): Promise<boolean> {
    if (!isRoleScope(role, scope)) return false;
    const result = await this.client.rpc("has_current_role_scope", {
      requested_role: role,
      requested_organization_id: scope.organizationId,
      requested_scope_type: scope.type,
      requested_scope_id: scope.id,
    });
    if (result.error) throw result.error;
    return result.data === true;
  }
  /** Scope alone is not sufficient authority; callers must supply a current role. */
  async hasActiveScope(scope: Scope, role?: Role): Promise<boolean> {
    return role ? this.hasCurrentRoleScope(role, scope) : false;
  }
}
