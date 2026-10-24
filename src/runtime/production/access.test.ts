import assert from "node:assert/strict";
import test from "node:test";
import {
  failure,
  fakeData,
  ok,
  type FakeHandlers,
  type QueryCall,
} from "../../../tests/support/data-fakes.ts";
import { resolveAdminAccess, resolveParentAccess, resolveTeacherAccess } from "./access.ts";

const ACCOUNT = "bbbbbbbb-0000-4000-8000-000000000014";
const ORG = "aaaaaaaa-0000-4000-8000-000000000001";
const FAMILY = "cccccccc-0000-4000-8000-000000000201";
const GROUP_A = "cccccccc-0000-4000-8000-000000000102";
const GROUP_B = "cccccccc-0000-4000-8000-000000000101";
const NOW = () => new Date("2026-10-22T10:00:00.000Z");

type Row = Record<string, unknown>;

const grant = (role: string, scopeType: string, scopeId: string, id = `${role}-${scopeId}`) => ({
  id,
  role,
  scope_type: scopeType,
  scope_id: scopeId,
  organization_id: ORG,
});

function world(
  grants: Row[],
  extra: { parent?: boolean; version?: number | null; active?: boolean } = {},
): FakeHandlers {
  return {
    rpc: () => ok(extra.active ?? true),
    table: (query: QueryCall) => {
      if (query.table === "app_authorization_versions") {
        const version = extra.version === undefined ? 4 : extra.version;
        return ok(version === null ? [] : [{ authorization_version: version }]);
      }
      if (query.table === "app_role_grants") return ok(grants);
      if (query.table === "parents") {
        return ok(extra.parent ? [{ id: "p1", family_id: FAMILY, organization_id: ORG }] : []);
      }
      if (query.table === "families") return ok([{ id: FAMILY }]);
      return ok([]);
    },
  };
}

test("a parent's family comes from the linked Parent and the matching family grant", async () => {
  const fake = fakeData(world([grant("parent", "family", FAMILY)], { parent: true }));
  const access = await resolveParentAccess(fake.database, ACCOUNT, NOW);
  assert.equal(access.state, "success");
  if (access.state !== "success") return;
  assert.equal(access.data.familyId, FAMILY);
  assert.deepEqual(access.data.familyScope, { id: FAMILY, type: "family", organizationId: ORG });
  assert.equal(access.data.applicationSession.subjectId, ACCOUNT);
  assert.equal(access.data.applicationSession.runtimeMode, "production");
  assert.equal(access.data.profile.homePath, "/szulo/ertesitesek");
  assert.deepEqual(
    access.data.profile.navigation.map((item) => item.href),
    ["/szulo/ertesitesek", "/szulo/feladatok", "/szulo/cserek"],
  );
});

test("a parent grant for another family than the linked one is not a family at all", async () => {
  const fake = fakeData(
    world([grant("parent", "family", "cccccccc-0000-4000-8000-000000000999")], { parent: true }),
  );
  const access = await resolveParentAccess(fake.database, ACCOUNT, NOW);
  assert.deepEqual(access, { state: "denied", homePath: "/szulo/ertesitesek" });
});

test("an account with no linked parent is denied, with the home of the role it does hold", async () => {
  const noParent = fakeData(world([grant("parent", "family", FAMILY)]));
  assert.equal((await resolveParentAccess(noParent.database, ACCOUNT, NOW)).state, "denied");
  const admin = fakeData(world([grant("group_admin", "group", GROUP_A)]));
  assert.deepEqual(await resolveParentAccess(admin.database, ACCOUNT, NOW), {
    state: "denied",
    homePath: "/admin",
  });
  const nothing = fakeData(world([]));
  assert.deepEqual(await resolveParentAccess(nothing.database, ACCOUNT, NOW), { state: "denied" });
});

test("an inactive session is signed out and a database that cannot answer is unavailable", async () => {
  const signedOut = fakeData(world([], { active: false }));
  for (const resolve of [resolveParentAccess, resolveAdminAccess, resolveTeacherAccess]) {
    assert.deepEqual(await resolve(signedOut.database, ACCOUNT, NOW), { state: "signed-out" });
  }
  const down = fakeData({ rpc: () => failure("08006"), table: () => failure("08006") });
  for (const resolve of [resolveParentAccess, resolveAdminAccess, resolveTeacherAccess]) {
    assert.deepEqual(await resolve(down.database, ACCOUNT, NOW), { state: "unavailable" });
  }
});

test("a super admin reaches the organization and ranks above a group admin grant", async () => {
  const fake = fakeData(
    world([grant("group_admin", "group", GROUP_A), grant("super_admin", "organization", ORG)]),
  );
  const access = await resolveAdminAccess(fake.database, ACCOUNT, NOW);
  assert.equal(access.state, "success");
  if (access.state !== "success") return;
  assert.deepEqual(access.data.scope, { id: ORG, type: "organization", organizationId: ORG });
  assert.equal(access.data.profile.label, "Szuperadminisztrátor");
  assert.ok(access.data.profile.navigation.some((item) => item.href === "/admin/beallitasok"));
});

test("a group admin reaches the first of their groups in a stable order", async () => {
  const fake = fakeData(
    world([grant("group_admin", "group", GROUP_A), grant("group_admin", "group", GROUP_B)]),
  );
  const access = await resolveAdminAccess(fake.database, ACCOUNT, NOW);
  assert.equal(access.state, "success");
  if (access.state !== "success") return;
  assert.equal(access.data.scope.id, GROUP_B);
  assert.equal(access.data.profile.label, "Csoportadminisztrátor");
  assert.ok(!access.data.profile.navigation.some((item) => item.href === "/admin/beallitasok"));
});

test("a teacher or a parent is not an admin", async () => {
  const teacher = fakeData(world([grant("kindergarten_teacher", "group", GROUP_A)]));
  assert.deepEqual(await resolveAdminAccess(teacher.database, ACCOUNT, NOW), {
    state: "denied",
    homePath: "/teacher/schedule",
  });
});

test("a teacher holds a granted group, and others are denied to the home of their own role", async () => {
  const fake = fakeData(world([grant("kindergarten_teacher", "group", GROUP_A)]));
  const access = await resolveTeacherAccess(fake.database, ACCOUNT, NOW);
  assert.equal(access.state, "success");
  if (access.state === "success") {
    assert.equal(access.data.profile.label, "Óvónő");
    assert.equal(access.data.profile.navigation.length, 0);
    assert.equal(access.data.applicationSession.roles[0], "kindergarten_teacher");
  }
  const admin = fakeData(world([grant("super_admin", "organization", ORG)]));
  assert.deepEqual(await resolveTeacherAccess(admin.database, ACCOUNT, NOW), {
    state: "denied",
    homePath: "/admin",
  });
});

test("the production path holds no fixed family, parent, login or organization", async () => {
  const { readdirSync, readFileSync } = await import("node:fs");
  const roots = ["src/data", "src/runtime/production", "app/_identity"];
  const forbidden =
    /family-boroka|parent-local|org-napsugar|group-boroka|TEST_COPIES|SYNTHETIC_TEST/;
  const checked: string[] = [];
  for (const root of roots) {
    for (const name of readdirSync(root)) {
      if (!/\.tsx?$/.test(name) || /\.test\./.test(name)) continue;
      checked.push(`${root}/${name}`);
      assert.doesNotMatch(readFileSync(`${root}/${name}`, "utf8"), forbidden, `${root}/${name}`);
    }
  }
  assert.ok(
    checked.length >= 20,
    "the search covered the adapters, the composition and the session code",
  );
  for (const file of [
    "app/szulo/_lib/session.ts",
    "app/admin/_lib/session.ts",
    "app/teacher/_lib/session.ts",
  ]) {
    const text = readFileSync(file, "utf8");
    const start = text.indexOf("async function resolveProduction");
    assert.ok(start > 0, `${file} has a production path`);
    const production = text.slice(start, text.indexOf("\n}\n", start));
    assert.doesNotMatch(production, forbidden, file);
  }
});
