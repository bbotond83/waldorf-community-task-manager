import assert from "node:assert/strict";
import test from "node:test";
import {
  failure,
  fakeData,
  ok,
  type FakeHandlers,
  type QueryCall,
} from "../../tests/support/data-fakes.ts";
import { RetryableDataFailure } from "./errors.ts";
import {
  createVersionPort,
  readAccessContext,
  readAuthorizationVersion,
  toSessionContext,
} from "./session.ts";
import { DataGateway } from "./gateway.ts";

const ACCOUNT = "bbbbbbbb-0000-4000-8000-000000000014";
const ORG = "aaaaaaaa-0000-4000-8000-000000000001";
const FAMILY = "cccccccc-0000-4000-8000-000000000201";
const NOW = () => new Date("2026-10-22T10:00:00.000Z");

type Row = Record<string, unknown>;

function world(options: {
  /** False: the session is not active (the default is an active one). */
  active?: boolean;
  version?: number | null;
  grants?: Row[];
  parents?: Row[];
  families?: Row[];
}): FakeHandlers {
  return {
    rpc: () => ok(options.active ?? true),
    table: (query: QueryCall) => {
      if (query.table === "app_authorization_versions") {
        return ok(
          options.version === undefined || options.version === null
            ? []
            : [{ authorization_version: options.version }],
        );
      }
      if (query.table === "app_role_grants") return ok(options.grants ?? []);
      if (query.table === "parents") return ok(options.parents ?? []);
      if (query.table === "families") return ok(options.families ?? []);
      return ok([]);
    },
  };
}

const parentGrant = {
  id: "g1",
  role: "parent",
  scope_type: "family",
  scope_id: FAMILY,
  organization_id: ORG,
};

test("the grants, version and parent link are read as the signed-in account", async () => {
  const fake = fakeData(
    world({
      version: 3,
      grants: [parentGrant],
      parents: [{ id: "p1", family_id: FAMILY, organization_id: ORG }],
      families: [{ id: FAMILY }],
    }),
  );
  const context = await readAccessContext(fake.database, ACCOUNT, NOW);
  assert.deepEqual(context, {
    authorizationVersion: 3,
    grants: [
      {
        id: "g1",
        subjectId: ACCOUNT,
        role: "parent",
        scope: { id: FAMILY, type: "family", organizationId: ORG },
        grantedAt: "2026-10-22T10:00:00.000Z",
      },
    ],
    parent: { parentId: "p1", familyId: FAMILY, organizationId: ORG },
  });
  const tables = fake.queries.map((query) => query.table).sort();
  assert.deepEqual(tables, [
    "app_authorization_versions",
    "app_role_grants",
    "families",
    "parents",
  ]);
  const grantQuery = fake.queries.find((query) => query.table === "app_role_grants");
  assert.deepEqual(grantQuery?.steps, [
    ["eq", "subject_id", ACCOUNT],
    ["is", "revoked_at", null],
  ]);
});

test("an account whose session is not active has no context at all", async () => {
  const fake = fakeData(world({ active: false, version: 3, grants: [parentGrant] }));
  assert.equal(await readAccessContext(fake.database, ACCOUNT, NOW), undefined);
});

test("an active session of an account with no version row reads as version 0, which no authorization accepts", async () => {
  const fake = fakeData(world({ version: null }));
  assert.deepEqual(await readAccessContext(fake.database, ACCOUNT, NOW), {
    authorizationVersion: 0,
    grants: [],
  });
});

test("an account with no linked parent, or a parent in an archived family, has no family", async () => {
  const noParent = fakeData(world({ version: 1, grants: [parentGrant] }));
  assert.equal((await readAccessContext(noParent.database, ACCOUNT, NOW))?.parent, undefined);
  const archived = fakeData(
    world({
      version: 1,
      grants: [parentGrant],
      parents: [{ id: "p1", family_id: FAMILY, organization_id: ORG }],
      families: [],
    }),
  );
  assert.equal((await readAccessContext(archived.database, ACCOUNT, NOW))?.parent, undefined);
});

test("a grant with an unknown role or a scope that does not fit its role is left out", async () => {
  const fake = fakeData(
    world({
      version: 1,
      grants: [
        { ...parentGrant, id: "ok" },
        { ...parentGrant, id: "role", role: "read_only_staff" },
        { ...parentGrant, id: "scope", scope_type: "group" },
        { ...parentGrant, id: "type", scope_type: "planet" },
        { ...parentGrant, id: "ids", scope_id: null },
      ],
    }),
  );
  const context = await readAccessContext(fake.database, ACCOUNT, NOW);
  assert.deepEqual(
    context?.grants.map((grant) => grant.id),
    ["ok"],
  );
});

test("an account id that is not a uuid reads no version", async () => {
  const fake = fakeData(world({ version: 1 }));
  assert.equal(await readAuthorizationVersion(new DataGateway(fake.database), "nope"), undefined);
  assert.equal(fake.queries.length, 0);
});

test("a version that is not a positive whole number is no version", async () => {
  for (const version of [0, -1, 1.5, "2"]) {
    const fake = fakeData({ table: () => ok([{ authorization_version: version }]) });
    assert.equal(
      await readAuthorizationVersion(new DataGateway(fake.database), ACCOUNT),
      undefined,
    );
  }
});

test("a database that cannot answer is a retryable failure for the caller to handle", async () => {
  const fake = fakeData({ rpc: () => ok(true), table: () => failure("08006") });
  await assert.rejects(readAccessContext(fake.database, ACCOUNT, NOW), RetryableDataFailure);
});

test("the application session lists the roles and scopes of the grants it was built from", () => {
  const session = toSessionContext(ACCOUNT, {
    authorizationVersion: 5,
    grants: [
      {
        id: "g1",
        subjectId: ACCOUNT,
        role: "group_admin",
        scope: { id: "a", type: "group", organizationId: ORG },
        grantedAt: "x",
      },
      {
        id: "g2",
        subjectId: ACCOUNT,
        role: "group_admin",
        scope: { id: "b", type: "group", organizationId: ORG },
        grantedAt: "x",
      },
    ],
  });
  assert.equal(session.subjectId, ACCOUNT);
  assert.equal(session.authorizationVersion, 5);
  assert.equal(session.runtimeMode, "production");
  assert.equal(session.isSynthetic, false);
  assert.equal(session.isActive, true);
  assert.deepEqual(session.roles, ["group_admin"]);
  assert.equal(session.scopes.length, 2);
  assert.ok(Object.isFrozen(session));
});

test("the version port answers from the database and has no cache to clear", async () => {
  const fake = fakeData(world({ version: 7 }));
  const port = createVersionPort(fake.database);
  assert.equal(await port.getCurrentVersion(ACCOUNT), 7);
  assert.equal(await port.clearProtectedCache(ACCOUNT), undefined);
  assert.deepEqual(fake.queries[0]?.steps, [
    ["eq", "subject_id", ACCOUNT],
    ["limit", 1],
  ]);
  assert.equal(fake.queries[0]?.table, "app_authorization_versions");
});
