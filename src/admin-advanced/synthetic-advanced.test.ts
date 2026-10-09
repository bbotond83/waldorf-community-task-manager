import { sessionGrantBindings } from "../access/session-grants.ts";
import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import type { Scope } from "../access/index.ts";
import {
  AuthorizationContract,
  InMemoryAuthorizationVersions,
  type AdminApplicationPort,
  type AdminOperation,
  type DomainOutcome,
  type SessionContext,
} from "../application/index.ts";
import {
  createSyntheticAdvancedAdminFacade,
  isSyntheticAdvancedSubjectRevoked,
  resetSyntheticAdvancedFixtures,
} from "./synthetic-advanced.ts";

const scope: Scope = { id: "org-napsugar", type: "organization", organizationId: "org-napsugar" };
const versions = new InMemoryAuthorizationVersions({
  "group-admin-local": 1,
  "super-admin-local": 1,
});
const authorization = new AuthorizationContract(versions);
const deniedCore: AdminApplicationPort = {
  async execute<T>(input: {
    actorId: string;
    operation: AdminOperation;
    scope: Scope;
    payload: Readonly<Record<string, unknown>>;
  }): Promise<DomainOutcome<T>> {
    void input;
    return { state: "denied" };
  },
};

function session(role: "group_admin" | "super_admin"): SessionContext {
  const subjectId = role === "group_admin" ? "group-admin-local" : "super-admin-local";
  const grantScope: Scope =
    role === "group_admin"
      ? { id: "group-boroka", type: "group", organizationId: scope.organizationId }
      : scope;
  return {
    subjectId,
    authorizationVersion: 1,
    ...sessionGrantBindings(subjectId, role, [grantScope]),
    roles: [role],
    scopes: [grantScope],
    runtimeMode: "synthetic",
    isSynthetic: true,
  };
}

function command(id: string, key: string, payload: Readonly<Record<string, unknown>> = {}) {
  return { scope, id, expectedVersion: 1, idempotencyKey: key, payload };
}

describe("synthetic advanced administrator workflows", () => {
  beforeEach(() => resetSyntheticAdvancedFixtures());

  it("denies Group Administrator import before adapter state is created", async () => {
    const facade = createSyntheticAdvancedAdminFacade(authorization, deniedCore);
    const denied = await facade.import.createPreview(
      session("group_admin"),
      command("workbook-waldorf-v1", "import:denied:01"),
    );
    assert.equal(denied.state, "denied");
    const status = await facade.import.status(session("super_admin"), scope);
    assert.equal(status.state, "empty");
  });

  it("validates, resolves, commits, and deduplicates one immutable import", async () => {
    const facade = createSyntheticAdvancedAdminFacade(authorization, deniedCore);
    const actor = session("super_admin");
    const preview = await facade.import.createPreview(
      actor,
      command("workbook-waldorf-v1", "import:preview:01"),
    );
    assert.equal(preview.state, "success");
    if (preview.state !== "success") return;
    const unresolved = await facade.import.commit(
      actor,
      command(preview.data.id, "import:commit:unresolved", {
        fingerprint: preview.data.fingerprint,
        confirmed: "yes",
      }),
    );
    assert.equal(unresolved.code, "IMPORT_CONFLICT_UNRESOLVED");
    const resolved = await facade.import.resolveConflict(
      actor,
      command(preview.data.id, "import:resolve:01", {
        conflictId: "conflict-family-1",
        resolution: "keep-existing",
      }),
    );
    assert.equal(resolved.state, "success");
    const committed = await facade.import.commit(
      actor,
      command(preview.data.id, "import:commit:01", {
        fingerprint: preview.data.fingerprint,
        confirmed: "yes",
      }),
    );
    const duplicate = await facade.import.commit(
      actor,
      command(preview.data.id, "import:commit:01", {
        fingerprint: preview.data.fingerprint,
        confirmed: "yes",
      }),
    );
    assert.deepEqual(duplicate, committed);
    assert.equal(committed.state === "success" ? committed.data.importedRows : 0, 3);
  });

  it("rejects changed fingerprint and stale preview without partial commit", async () => {
    const facade = createSyntheticAdvancedAdminFacade(authorization, deniedCore);
    const actor = session("super_admin");
    await facade.import.createPreview(actor, command("workbook-waldorf-v1", "import:preview:02"));
    const stale = await facade.import.resolveConflict(actor, {
      ...command("preview-waldorf-v1", "import:resolve:stale", {
        conflictId: "conflict-family-1",
        resolution: "use-import",
      }),
      expectedVersion: 2,
    });
    assert.equal(stale.code, "IMPORT_PREVIEW_STALE");
    const changed = await facade.import.commit(
      actor,
      command("preview-waldorf-v1", "import:commit:changed", {
        fingerprint: "sha256:changed",
        confirmed: "yes",
      }),
    );
    assert.equal(changed.code, "IMPORT_FINGERPRINT_CHANGED");
  });

  it("rejects malformed, oversized, missing-sheet, and missing-header workbooks", async () => {
    const facade = createSyntheticAdvancedAdminFacade(authorization, deniedCore);
    const actor = session("super_admin");
    for (const scenario of ["malformed", "oversized", "missing-sheet", "missing-header"]) {
      const result = await facade.import.createPreview(
        actor,
        command(`workbook-${scenario}`, `import:${scenario}:01`, { scenario }),
      );
      assert.equal(result.state, "conflict");
    }
    assert.equal((await facade.import.status(actor, scope)).state, "empty");
  });

  it("recovers an interrupted import using the original run identity", async () => {
    const facade = createSyntheticAdvancedAdminFacade(authorization, deniedCore);
    const actor = session("super_admin");
    const preview = await facade.import.createPreview(
      actor,
      command("workbook-waldorf-v1", "import:preview:03"),
    );
    assert.equal(preview.state, "success");
    await facade.import.resolveConflict(
      actor,
      command("preview-waldorf-v1", "import:resolve:03", {
        conflictId: "conflict-family-1",
        resolution: "use-import",
      }),
    );
    const interrupted = await facade.import.commit(
      actor,
      command("preview-waldorf-v1", "import:commit:interrupted", {
        fingerprint: "sha256:waldorf-advanced-v1:8b12",
        confirmed: "yes",
        scenario: "interrupted",
      }),
    );
    assert.equal(interrupted.state, "recovery");
    const recovered = await facade.import.recover(
      actor,
      command("run-waldorf-v1", "import:recover:03", { action: "resume" }),
    );
    assert.equal(recovered.state === "success" ? recovered.data.state : "failure", "recovered");
  });

  it("retries only classified reminder failures with the same correlation identity", async () => {
    const facade = createSyntheticAdvancedAdminFacade(authorization, deniedCore);
    const actor = session("super_admin");
    const retry = await facade.reminders.retry(actor, command("job-lampas", "corr-lampas-01"));
    assert.equal(retry.state === "success" ? retry.data.status : "failure", "retry-scheduled");
    const duplicate = await facade.reminders.retry(actor, command("job-lampas", "corr-lampas-01"));
    assert.deepEqual(duplicate, retry);
    const nonRetryable = await facade.reminders.retry(actor, command("job-kert", "corr-kert-01"));
    assert.equal(nonRetryable.code, "REMINDER_NOT_RETRYABLE");
  });

  it("enforces governance role, self-lockout, stale version, and next-request revocation", async () => {
    const facade = createSyntheticAdvancedAdminFacade(authorization, deniedCore);
    assert.equal((await facade.governance.list(session("group_admin"), scope)).state, "denied");
    const self = await facade.governance.updateGrant(
      session("super_admin"),
      command("grant-super-current", "grant:self:01", { scenario: "self-lockout" }),
    );
    assert.equal(self.code, "GRANT_SELF_LOCKOUT");
    const lastAdmin = await facade.governance.updateGrant(
      session("super_admin"),
      command("grant-super-backup", "grant:last:01", { scenario: "last-admin" }),
    );
    assert.equal(lastAdmin.code, "GRANT_LAST_SUPER_ADMIN");
    const stale = await facade.governance.updateGrant(session("super_admin"), {
      ...command("grant-group-target", "grant:stale:01"),
      expectedVersion: 2,
    });
    assert.equal(stale.code, "GRANT_STALE");
    const revoked = await facade.governance.updateGrant(
      session("super_admin"),
      command("grant-group-target", "grant:revoke:01"),
    );
    assert.equal(revoked.state, "success");
    assert.equal(isSyntheticAdvancedSubjectRevoked("group-admin-local"), true);
  });

  it("rechecks lifecycle blocker/version and performs one redacted atomic outcome", async () => {
    const facade = createSyntheticAdvancedAdminFacade(authorization, deniedCore);
    const actor = session("super_admin");
    const blocked = await facade.lifecycle.run(actor, {
      ...command("family-retained", "lifecycle:blocked:01", { confirmed: "yes" }),
      expectedVersion: 2,
    });
    assert.equal(blocked.code, "LIFECYCLE_BLOCKED");
    const stale = await facade.lifecycle.run(actor, {
      ...command("family-delete", "lifecycle:stale:01", { confirmed: "yes" }),
      expectedVersion: 3,
    });
    assert.equal(stale.code, "LIFECYCLE_STALE");
    const completed = await facade.lifecycle.run(
      actor,
      command("family-delete", "lifecycle:delete:01", { confirmed: "yes" }),
    );
    assert.equal(completed.state === "success" ? completed.data.state : "failure", "deleted");
    assert.match(
      completed.state === "success" ? completed.data.auditEvidenceId : "",
      /^audit-lifecycle-/,
    );
    const repeated = await facade.lifecycle.run(
      actor,
      command("family-delete", "lifecycle:delete:01", { confirmed: "yes" }),
    );
    assert.deepEqual(repeated, completed);
  });

  it("allowlists recipients and rejects stale or invented settings", async () => {
    const facade = createSyntheticAdvancedAdminFacade(authorization, deniedCore);
    const actor = session("super_admin");
    const invalid = await facade.settings.save(
      actor,
      command("advanced-settings", "settings:invalid:01", {
        recipientId: "all-contacts",
        remindersEnabled: "yes",
      }),
    );
    assert.equal(invalid.code, "SETTINGS_RECIPIENT_INVALID");
    const saved = await facade.settings.save(
      actor,
      command("advanced-settings", "settings:save:01", {
        recipientId: "recipient-group",
        remindersEnabled: "yes",
      }),
    );
    assert.equal(saved.state, "success");
    const stale = await facade.settings.save(
      actor,
      command("advanced-settings", "settings:stale:01", { recipientId: "recipient-duty" }),
    );
    assert.equal(stale.code, "SETTINGS_STALE");
  });

  it("maps retryable and terminal adapter failures without raw provider text", async () => {
    const facade = createSyntheticAdvancedAdminFacade(authorization, deniedCore);
    const actor = session("super_admin");
    const retryable = await facade.lifecycle.run(
      actor,
      command("family-delete", "lifecycle:retry:01", { confirmed: "yes", scenario: "retryable" }),
    );
    const terminal = await facade.lifecycle.run(
      actor,
      command("family-delete", "lifecycle:terminal:01", { confirmed: "yes", scenario: "terminal" }),
    );
    assert.equal(retryable.state, "dependency-failure-retryable");
    assert.equal(terminal.state, "dependency-failure-terminal");
    assert.doesNotMatch(
      JSON.stringify([retryable, terminal]),
      /synthetic retryable failure|provider body/i,
    );
  });
});
