import assert from "node:assert/strict";
import test from "node:test";
import {
  InMemoryAccessTransaction,
  InMemoryAuditWriter,
  InMemoryRoleGrantRepository,
  InMemoryUserRepository,
} from "./in-memory-adapters.ts";
function setup() {
  const users = new InMemoryUserRepository([
    { id: "user", isActive: true, authorizationVersion: 1 },
  ]);
  const grants = new InMemoryRoleGrantRepository();
  const audit = new InMemoryAuditWriter();
  const store = new InMemoryAccessTransaction(users, grants, audit);
  return { users, grants, audit, store };
}
test("synchronous transaction commits coherent state", () => {
  const { store, users } = setup();
  store.run(() => store.saveUser({ id: "user", isActive: true, authorizationVersion: 2 }));
  assert.equal(users.findById("user")?.authorizationVersion, 2);
});
test("writer exclusion deterministically rejects nested writer before mutation", () => {
  const { store, users } = setup();
  let entered = false;
  store.run(() => {
    assert.throws(
      () =>
        store.run(() => {
          entered = true;
          store.saveUser({ id: "user", isActive: false, authorizationVersion: 3 });
        }),
      /WRITER_BUSY/,
    );
  });
  assert.equal(entered, false);
  assert.equal(users.findById("user")?.isActive, true);
});
test("rollback restores user and audit writes", () => {
  const { store, users, audit } = setup();
  assert.throws(() =>
    store.run(() => {
      users.save({ id: "user", isActive: false, authorizationVersion: 2 });
      audit.write({
        actorId: "user",
        eventType: "role_granted",
        occurredAt: "now",
        summary: "changed",
      });
      throw new Error("failure");
    }),
  );
  assert.equal(users.findById("user")?.isActive, true);
  assert.deepEqual(audit.events, []);
});
test("transaction releases exclusion after failure", () => {
  const { store } = setup();
  assert.throws(() =>
    store.run(() => {
      throw new Error("failure");
    }),
  );
  assert.equal(
    store.run(() => 42),
    42,
  );
});
test("asynchronous callback fails rather than silently committing partial work", () => {
  const { store } = setup();
  assert.throws(() => store.run(() => Promise.resolve(1)), /ASYNC_TRANSACTION_UNSUPPORTED/);
});
test("repository reads are detached from mutable backing state", () => {
  const { users } = setup();
  const user = users.findById("user")!;
  user.isActive = false;
  assert.equal(users.findById("user")?.isActive, true);
});
test("normal repository cannot save removed role", () => {
  const { grants } = setup();
  assert.throws(
    () =>
      grants.save({
        id: "grant",
        subjectId: "user",
        role: "read_only_staff",
        scope: { id: "oak", type: "group", organizationId: "org" },
        grantedAt: "now",
      } as never),
    /UNSUPPORTED_ROLE_OR_SCOPE/,
  );
  assert.deepEqual(grants.list(), []);
});
