import { isRoleScope } from "./role-policy.ts";
import type {
  AuditWriter,
  ConversionEvidence,
  ConversionStore,
  LegacyConversionGrant,
  RedactedAuditEvent,
  RoleGrant,
  RoleGrantRepository,
  User,
  UserRepository,
} from "./types.ts";
const clone = <T>(value: T): T => structuredClone(value);
export class InMemoryUserRepository implements UserRepository {
  private users = new Map<string, User>();
  constructor(users: User[] = []) {
    users.forEach((user) => this.save(user));
  }
  findById(id: string) {
    const user = this.users.get(id);
    return user && clone(user);
  }
  save(user: User) {
    this.users.set(user.id, clone(user));
  }
  list() {
    return clone([...this.users.values()]);
  }
  restore(users: User[]) {
    this.users = new Map(clone(users).map((user) => [user.id, user]));
  }
}
export class InMemoryRoleGrantRepository implements RoleGrantRepository {
  private grants = new Map<string, RoleGrant>();
  constructor(grants: RoleGrant[] = []) {
    grants.forEach((grant) => this.save(grant));
  }
  findById(id: string) {
    const grant = this.grants.get(id);
    return grant && clone(grant);
  }
  findBySubjectId(id: string) {
    return this.list().filter((grant) => grant.subjectId === id);
  }
  save(grant: RoleGrant) {
    if (!isRoleScope(grant.role, grant.scope)) throw new Error("UNSUPPORTED_ROLE_OR_SCOPE");
    this.grants.set(grant.id, clone(grant));
  }
  list() {
    return clone([...this.grants.values()]);
  }
  /** Explicit fixture conversion input; never used by normal grant/session paths. */
  loadConversionFixture(grants: LegacyConversionGrant[]) {
    this.grants = new Map(clone(grants).map((grant) => [grant.id, grant as RoleGrant]));
  }
  restore(grants: RoleGrant[]) {
    this.grants = new Map(clone(grants).map((grant) => [grant.id, grant]));
  }
}
export class InMemoryAuditWriter implements AuditWriter {
  readonly events: RedactedAuditEvent[] = [];
  write(event: RedactedAuditEvent) {
    this.events.push(clone(event));
  }
}
/** Synchronous exclusive writer. Reentrant/interleaved transactions fail closed. */
export class InMemoryAccessTransaction implements ConversionStore {
  readonly conversionEvidence: ConversionEvidence[] = [];
  currentRolesEnforced = false;
  private running = false;
  private readonly users: InMemoryUserRepository;
  private readonly grants: InMemoryRoleGrantRepository;
  private readonly audit: InMemoryAuditWriter;
  private readonly fault?: (stage: string) => void;
  constructor(
    users: InMemoryUserRepository,
    grants: InMemoryRoleGrantRepository,
    audit: InMemoryAuditWriter,
    fault?: (stage: string) => void,
  ) {
    this.users = users;
    this.grants = grants;
    this.audit = audit;
    this.fault = fault;
  }
  run<T>(operation: () => T): T {
    if (this.running) throw new Error("WRITER_BUSY");
    this.running = true;
    const users = this.users.list(),
      grants = this.grants.list(),
      events = clone(this.audit.events),
      evidence = clone(this.conversionEvidence),
      enforcement = this.currentRolesEnforced;
    try {
      this.fault?.("preflight");
      const result = operation();
      if (result instanceof Promise) throw new Error("ASYNC_TRANSACTION_UNSUPPORTED");
      this.fault?.("commit");
      return result;
    } catch (error) {
      this.users.restore(users);
      this.grants.restore(grants);
      this.audit.events.splice(0, this.audit.events.length, ...events);
      this.conversionEvidence.splice(0, this.conversionEvidence.length, ...evidence);
      this.currentRolesEnforced = enforcement;
      throw error;
    } finally {
      this.running = false;
    }
  }
  listGrants() {
    return this.grants.list();
  }
  listUsers() {
    return this.users.list();
  }
  saveConvertedGrant(grant: RoleGrant) {
    this.assertRunning();
    this.fault?.("grant");
    this.grants.save(grant);
  }
  saveUser(user: User) {
    this.assertRunning();
    this.fault?.("version");
    this.users.save(user);
  }
  appendConversionEvidence(evidence: ConversionEvidence) {
    this.assertRunning();
    this.fault?.("evidence");
    this.conversionEvidence.push(clone(evidence));
  }
  private assertRunning() {
    if (!this.running) throw new Error("TRANSACTION_REQUIRED");
  }
  enforceCurrentRoles() {
    this.assertRunning();
    this.fault?.("enforcement");
    if (this.grants.list().some((grant) => !isRoleScope(grant.role, grant.scope)))
      throw new Error("UNSUPPORTED_ROLE_OR_SCOPE");
    this.currentRolesEnforced = true;
  }
}
