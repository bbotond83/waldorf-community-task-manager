import assert from "node:assert/strict";
import test from "node:test";
import { grantAllows } from "../access/role-policy.ts";
import { sessionGrantBindings } from "../access/session-grants.ts";
import type { Role, Scope } from "../access/index.ts";
import {
  DIRECTORY_REFUSAL_MESSAGES,
  REMOVAL_BLOCK_LABELS,
  REMOVAL_FLAGGED_KIND_LABELS,
  REMOVAL_TEXTS,
} from "../data/copy.ts";
import { AuthorizationContract, InMemoryAuthorizationVersions } from "./authorization.ts";
import type { RemovalPreviewModel, RemovalSubjectModel, SessionContext } from "./contracts.ts";
import { FacadePipeline } from "./facade-pipeline.ts";
import { RemovalApplicationFacade, type RemovalApplicationPort } from "./removal-facade.ts";

const ORG = "org-1";
const organization: Scope = { id: ORG, type: "organization", organizationId: ORG };
const SCOPES: Record<Role, Scope> = {
  super_admin: organization,
  kindergarten_teacher: organization,
  group_admin: { id: "group-1", type: "group", organizationId: ORG },
  parent: { id: "family-1", type: "family", organizationId: ORG },
};
const SUBJECT: RemovalSubjectModel = { kind: "family", id: "family-2" };
const PREVIEW: RemovalPreviewModel = {
  subject: SUBJECT,
  version: 2,
  steps: [],
  totals: { toClear: 0, toFlag: 0 },
  groupsLeftWithoutCoordinator: [],
  refusal: "SELF_REMOVAL",
};

function session(role: Role, scope: Scope = SCOPES[role]): SessionContext {
  return {
    subjectId: "user-1",
    authorizationVersion: 1,
    ...sessionGrantBindings("user-1", role, [scope]),
    roles: [role],
    scopes: [scope],
  };
}

function build(port: Partial<RemovalApplicationPort> = {}) {
  const calls: string[] = [];
  const versions = new InMemoryAuthorizationVersions({ "user-1": 1 });
  const facade = new RemovalApplicationFacade(
    new FacadePipeline(new AuthorizationContract(versions)),
    {
      preview: async (subject) => {
        calls.push(`preview:${subject.kind}`);
        return { state: "success", data: PREVIEW };
      },
      flaggedItems: async (subject) => {
        calls.push(`flagged:${subject.kind}`);
        return { state: "success", data: { subject, items: [] } };
      },
      ...port,
    },
  );
  return { facade, calls };
}

test("a super admin reads the preview and the flagged items, and gets them as the database answered", async () => {
  const { facade, calls } = build();
  const preview = await facade.preview(session("super_admin"), organization, SUBJECT);
  assert.equal(preview.state, "success");
  if (preview.state === "success") assert.deepEqual(preview.data, PREVIEW);
  const flagged = await facade.flaggedItems(session("super_admin"), organization, SUBJECT);
  assert.equal(flagged.state, "success");
  if (flagged.state === "success") assert.deepEqual(flagged.data.items, []);
  assert.deepEqual(calls, ["preview:family", "flagged:family"]);
});

test("no other role reaches the database through either read", async () => {
  const { facade, calls } = build();
  for (const role of ["parent", "group_admin", "kindergarten_teacher"] as const) {
    for (const read of ["preview", "flaggedItems"] as const) {
      const result = await facade[read](session(role), SCOPES[role], SUBJECT);
      assert.equal(result.state, "denied", `${role} ${read}`);
    }
  }
  assert.deepEqual(calls, []);
});

test("a super admin of another community is denied, and a database refusal stays a denial", async () => {
  const other: Scope = { id: "org-2", type: "organization", organizationId: "org-2" };
  const { facade, calls } = build();
  assert.equal(
    (await facade.preview(session("super_admin", other), organization, SUBJECT)).state,
    "denied",
  );
  assert.deepEqual(calls, []);
  const refused = build({ preview: async () => ({ state: "denied" }) });
  assert.equal(
    (await refused.facade.preview(session("super_admin"), organization, SUBJECT)).state,
    "denied",
  );
});

test("an unexpected failure becomes a failure state that carries no database text", async () => {
  const { facade } = build({
    flaggedItems: async () => {
      throw new Error("relation todo_tasks does not exist");
    },
  });
  const result = await facade.flaggedItems(session("super_admin"), organization, SUBJECT);
  assert.match(result.state, /^dependency-failure-/);
  assert.ok(!JSON.stringify(result).includes("todo_tasks"));
});

test("the access policy gives the removal resource to a super admin alone", () => {
  for (const role of Object.keys(SCOPES) as Role[]) {
    for (const action of ["read", "delete"] as const) {
      const allowed = grantAllows({ role, scope: SCOPES[role] }, {
        action,
        resource: { kind: "removal", scope: SCOPES[role] },
      } as never);
      assert.equal(allowed, role === "super_admin", `${role} ${action}`);
    }
  }
});

test("every refusal, step, flagged kind and warning has its Hungarian words", () => {
  for (const code of [
    "SELF_REMOVAL",
    "last_super_admin",
    "PARENT_LAST_IN_FAMILY",
    "VERSION_CONFLICT",
  ]) {
    assert.ok(DIRECTORY_REFUSAL_MESSAGES[code], code);
  }
  assert.equal(
    DIRECTORY_REFUSAL_MESSAGES.SELF_REMOVAL,
    "Ezt egy másik főadminisztrátornak kell elvégeznie",
  );
  assert.equal(Object.keys(REMOVAL_BLOCK_LABELS).length, 11);
  assert.equal(Object.keys(REMOVAL_FLAGGED_KIND_LABELS).length, 5);
  assert.equal(REMOVAL_TEXTS.failed, "Az eltávolítás nem sikerült, semmi sem változott.");
  assert.equal(
    REMOVAL_TEXTS.signOutWarning,
    "Egy kijelentkeztetés nem sikerült; a fiók a következő kérésnél úgyis le lesz tiltva.",
  );
});
