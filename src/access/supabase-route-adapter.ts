import type { Scope } from "./types.ts";
export interface SupabaseClientPort { rpc(name: string, args: Record<string, unknown>): Promise<{ data: unknown; error: unknown }>; }
export class SupabaseRouteAdapter {
  private readonly client: SupabaseClientPort;
  constructor(client: SupabaseClientPort) { this.client = client; }
  async authorizationVersion(subjectId: string): Promise<number | undefined> { const result = await this.client.rpc("authorization_version_for", { requested_subject_id: subjectId }); if (result.error) throw result.error; return typeof result.data === "number" ? result.data : undefined; }
  async hasActiveScope(scope: Scope): Promise<boolean> { const result = await this.client.rpc("has_active_scope", { requested_organization_id: scope.organizationId, requested_scope_id: scope.id }); if (result.error) throw result.error; return result.data === true; }
}
