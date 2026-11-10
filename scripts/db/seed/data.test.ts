import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { checkPassword } from "../../../src/identity/password.ts";
import {
  buildSeedPlan,
  describePlan,
  SEED_PASSWORDS,
  SEED_SHAPES,
  SEED_STAFF_TAGS,
  seedAccount,
  seedAccounts,
  type SeedPlan,
} from "./data.ts";

const SCHEMAS = ["public", "worker_1", "worker_2", "worker_3", "worker_4"];

const allIds = (plan: SeedPlan): string[] => [
  plan.organization.id,
  plan.schoolYear.id,
  ...plan.breakWeeks.map((entry) => entry.id),
  ...plan.groups.map((entry) => entry.id),
  ...plan.families.map((entry) => entry.id),
  ...plan.memberships.map((entry) => entry.id),
  ...plan.extraGrants.map((entry) => entry.id),
  ...plan.parents.map((entry) => entry.id),
  ...plan.children.map((entry) => entry.id),
  ...plan.accounts.flatMap((entry) => [entry.id, entry.grantId]),
  ...plan.events.map((entry) => entry.id),
  ...plan.tasks.map((entry) => entry.id),
  ...plan.assignments.map((entry) => entry.id),
];

describe("seed data: the small set", () => {
  const plan = buildSeedPlan("public", "small");

  it("has the six working groups, 6 families with parents and children, a super admin, two group admins and a teacher", () => {
    assert.deepEqual(describePlan(plan), {
      groups: 6,
      families: 6,
      parents: 12,
      children: 8,
      accounts: 10,
      events: 3,
      tasks: 8,
      assignments: 8,
    });
    assert.deepEqual(
      plan.accounts.filter((entry) => entry.role !== "parent").map((entry) => entry.tag),
      [
        SEED_STAFF_TAGS.superAdmin,
        SEED_STAFF_TAGS.groupAdmin1,
        SEED_STAFF_TAGS.groupAdmin2,
        SEED_STAFF_TAGS.teacher1,
      ],
    );
    assert.equal(SEED_SHAPES.small.families, plan.families.length);
  });

  it("scopes every account's grant to what its role allows", () => {
    for (const account of plan.accounts) {
      if (account.role === "super_admin") {
        assert.deepEqual(
          [account.scopeType, account.scopeId],
          ["organization", plan.organization.id],
        );
      } else if (account.role === "parent") {
        assert.equal(account.scopeType, "family");
        assert.ok(plan.families.some((family) => family.id === account.scopeId));
      } else if (account.role === "kindergarten_teacher") {
        assert.deepEqual(
          [account.scopeType, account.scopeId],
          ["organization", plan.organization.id],
        );
      } else {
        assert.equal(account.scopeType, "group");
        assert.ok(plan.groups.some((group) => group.id === account.scopeId));
      }
    }
  });

  it("links the first parent of every family to the family's account, and the second parent of the first two families to a group admin", () => {
    plan.families.forEach((family, index) => {
      const parents = plan.parents.filter((parent) => parent.familyId === family.id);
      assert.equal(parents.length, 2);
      const linked = parents.filter((parent) => parent.accountId !== null);
      const account = plan.accounts.find((entry) => entry.id === linked[0]!.accountId);
      assert.equal(account?.scopeId, family.id);
      assert.equal(account?.role, "parent");
      assert.equal(linked.length, index < 2 ? 2 : 1, family.name);
      if (index < 2) {
        const coParent = plan.accounts.find((entry) => entry.id === linked[1]!.accountId);
        assert.equal(coParent?.role, "group_admin");
      }
    });
  });

  it("never fills a task beyond its capacity and never places a family on a task twice", () => {
    for (const task of plan.tasks) {
      const placed = plan.assignments.filter((entry) => entry.taskId === task.id);
      assert.ok(placed.length <= task.capacity, task.title);
    }
    const keys = plan.assignments.map((entry) => `${entry.familyId}|${entry.taskId}`);
    assert.equal(new Set(keys).size, keys.length);
  });

  it("keeps tasks of an event in the event's group, in the future, with an end after the start", () => {
    for (const task of plan.tasks) {
      assert.ok(task.endsAtHours > task.startsAtHours);
      assert.ok(task.startsAtHours > 24, "starts after today");
      const event = plan.events.find((entry) => entry.id === task.eventId);
      if (task.eventId) assert.equal(event?.groupId, task.groupId);
    }
    for (const event of plan.events) assert.ok(event.endsAtHours >= event.startsAtHours);
  });

  it("gives a sign-up the family's own parent", () => {
    for (const assignment of plan.assignments) {
      const family = plan.families.find((entry) => entry.id === assignment.familyId)!;
      if (assignment.source === "parent_sign_up") {
        const parent = plan.parents.find((entry) => entry.id === assignment.parentId);
        assert.equal(parent?.familyId, family.id);
      } else {
        assert.equal(assignment.parentId, null);
      }
    }
  });

  it("is written in Hungarian with fictitious names, example addresses and allowed example phone numbers", () => {
    const allowlist = JSON.parse(
      readFileSync(new URL("../../verification/privacy-allowlist.json", import.meta.url), "utf8"),
    ) as { phoneNumbers: string[]; emailDomains: string[] };
    assert.deepEqual(
      plan.groups.map((entry) => entry.name),
      [
        "Játszókert",
        "Karbantartó",
        "Ünnep-előkészítő",
        "Kreatív-alkotó",
        "Nagytakarítás szervezése",
        "Állatgondozás",
      ],
    );
    assert.ok(plan.tasks.some((entry) => entry.title === "Sütés"));
    assert.ok(plan.events.some((entry) => entry.title === "Őszi vásár"));
    for (const parent of plan.parents) {
      assert.match(parent.name, /^[\p{L}-]+ [\p{L}-]+$/u);
      assert.match(parent.contactEmail, /^[^@\s]+@[^@\s]+[.][^@\s]+$/);
      assert.ok(allowlist.emailDomains.includes(parent.contactEmail.split("@")[1]!));
      if (parent.contactPhone) {
        assert.match(parent.contactPhone, /^[0-9 +-]{6,20}$/);
        assert.ok(allowlist.phoneNumbers.includes(parent.contactPhone), parent.contactPhone);
      }
    }
    assert.ok(plan.families.every((family) => family.name.endsWith(" család")));
  });

  it("stores a parent's optional profile only with consent (the database's own rule)", () => {
    for (const parent of plan.parents) {
      assert.ok(parent.consent || parent.optionalProfile === null);
    }
    assert.ok(plan.parents.some((parent) => parent.consent && parent.optionalProfile));
  });
});

describe("seed data: the 30-family set", () => {
  const large = buildSeedPlan("worker_1", "large");

  it("is the same rules at a larger size: 30 families and the six working groups, one account for every family", () => {
    assert.equal(large.families.length, 30);
    assert.equal(large.groups.length, 6);
    assert.equal(large.accounts.length, 1 + 2 + 1 + 30);
    assert.equal(large.memberships.length, 30);
  });

  it("holds the role fixtures of the Unit: an administrator who is a parent, one of two groups, a community teacher (BR2.1)", () => {
    const small = buildSeedPlan("worker_1", "small");
    const admin1 = small.accounts.find((entry) => entry.tag === "group-admin-1")!;
    const admin2 = small.accounts.find((entry) => entry.tag === "group-admin-2")!;
    assert.ok(small.parents.some((parent) => parent.accountId === admin1.id));
    assert.ok(
      small.extraGrants.some((grant) => grant.subjectId === admin1.id && grant.role === "parent"),
    );
    assert.equal(
      small.extraGrants.filter(
        (grant) => grant.subjectId === admin2.id && grant.role === "group_admin",
      ).length,
      1,
    );
    const teacher = small.accounts.find((entry) => entry.tag === "teacher-1")!;
    assert.deepEqual([teacher.scopeType, teacher.scopeId], ["organization", small.organization.id]);
    assert.ok(small.tasks.some((task) => task.groupId === null));
    assert.ok(small.events.some((event) => event.groupId === null));
  });

  it("keeps every rule of the small set: capacity, group reach and unique places", () => {
    for (const task of large.tasks) {
      assert.ok(
        large.assignments.filter((entry) => entry.taskId === task.id).length <= task.capacity,
      );
    }
    const keys = large.assignments.map((entry) => `${entry.familyId}|${entry.taskId}`);
    assert.equal(new Set(keys).size, keys.length);
    const names = large.families.map((family) => family.name);
    assert.equal(new Set(names).size, names.length, "every family name is different");
  });

  it("has two children in every third family and one in the others", () => {
    for (const family of large.families) {
      const number = large.families.indexOf(family) + 1;
      const count = large.children.filter((child) => child.familyId === family.id).length;
      assert.equal(count, number % 3 === 0 ? 2 : 1);
    }
  });
});

describe("seed data: the school calendar", () => {
  it("gives the year a changeover date after its end and invented break weeks on Mondays inside it", () => {
    for (const size of ["small", "large"] as const) {
      const { schoolYear, breakWeeks } = buildSeedPlan("public", size);
      assert.equal(schoolYear.changeoverDate, "2027-07-01");
      assert.ok(schoolYear.changeoverDate > schoolYear.endsOn);
      assert.deepEqual(
        breakWeeks.map((week) => week.weekStart),
        ["2026-11-02", "2026-12-21", "2026-12-28", "2027-04-05"],
      );
      for (const week of breakWeeks) {
        assert.equal(new Date(`${week.weekStart}T00:00:00Z`).getUTCDay(), 1, week.weekStart);
        assert.ok(week.weekStart >= schoolYear.startsOn && week.weekStart <= schoolYear.endsOn);
        assert.ok(week.label.length > 0);
      }
    }
  });

  it("seeds no rota plan: the owner makes the first draft on the planning screen", () => {
    const plan = buildSeedPlan("public", "small") as unknown as Record<string, unknown>;
    assert.equal("rotaPlan" in plan, false);
    assert.equal("rotaWeeks" in plan, false);
  });

  it("gives the same break weeks to every schema, with ids of its own", () => {
    const first = buildSeedPlan("worker_1", "small").breakWeeks;
    const second = buildSeedPlan("worker_2", "small").breakWeeks;
    assert.deepEqual(
      first.map((week) => week.weekStart),
      second.map((week) => week.weekStart),
    );
    assert.equal(
      first.some((week) => second.some((other) => other.id === week.id)),
      false,
    );
  });
});

describe("seed data: determinism and separation of schemas", () => {
  it("gives the same plan for the same schema and size", () => {
    assert.deepEqual(buildSeedPlan("worker_2", "small"), buildSeedPlan("worker_2", "small"));
    assert.deepEqual(buildSeedPlan("worker_2", "large"), buildSeedPlan("worker_2", "large"));
  });

  it("uses unique ids inside a plan and shares no id and no address between schemas", () => {
    const seenIds = new Set<string>();
    const seenEmails = new Set<string>();
    for (const schema of SCHEMAS) {
      for (const size of ["small", "large"] as const) {
        const plan = buildSeedPlan(schema, size);
        const ids = allIds(plan);
        assert.equal(new Set(ids).size, ids.length, `${schema} ${size} ids are unique`);
        if (size === "small") {
          for (const id of ids) assert.ok(!seenIds.has(id), `${schema}: ${id} already used`);
          for (const id of ids) seenIds.add(id);
          for (const account of plan.accounts) {
            assert.ok(!seenEmails.has(account.email), account.email);
            seenEmails.add(account.email);
          }
        }
      }
    }
  });

  it("gives the large set the same ids as the small set for the records they share", () => {
    const small = buildSeedPlan("worker_3", "small");
    const large = buildSeedPlan("worker_3", "large");
    assert.equal(small.organization.id, large.organization.id);
    assert.equal(small.accounts[0]!.id, large.accounts[0]!.id);
    assert.equal(small.families[0]!.id, large.families[0]!.id);
  });

  it("names accounts <schema>.<tag>@example.test in lower case, so the schema's reset removes exactly them", () => {
    for (const schema of SCHEMAS) {
      for (const account of seedAccounts(schema, "large")) {
        assert.equal(account.email, `${schema}.${account.tag}@example.test`);
        assert.equal(account.email, account.email.toLowerCase());
        assert.ok(account.email.startsWith(`${schema}.`));
      }
    }
  });
});

describe("seed data: passwords and lookups", () => {
  it("keeps fictitious test passwords that satisfy the password rule, one per role, only in this module", () => {
    assert.deepEqual(Object.keys(SEED_PASSWORDS).sort(), [
      "group_admin",
      "kindergarten_teacher",
      "parent",
      "super_admin",
    ]);
    for (const password of Object.values(SEED_PASSWORDS)) {
      assert.equal(checkPassword(password).ok, true, "meets the app's password rule");
    }
    assert.equal(new Set(Object.values(SEED_PASSWORDS)).size, 4);
    for (const account of seedAccounts("public")) {
      assert.equal(account.password, SEED_PASSWORDS[account.role]);
    }
  });

  it("finds an account by its tag and refuses an unknown tag", () => {
    assert.equal(seedAccount("worker_1", "super-admin").role, "super_admin");
    assert.equal(seedAccount("worker_1", "parent-6").role, "parent");
    assert.equal(seedAccount("worker_1", "parent-30", "large").role, "parent");
    assert.throws(() => seedAccount("worker_1", "parent-30"), /No seeded account/);
  });

  it("prints counts only: no names, addresses or passwords", () => {
    const text = JSON.stringify(describePlan(buildSeedPlan("public", "small")));
    assert.match(text, /^\{("[a-z]+":\d+,?)+\}$/);
    for (const password of Object.values(SEED_PASSWORDS)) assert.ok(!text.includes(password));
  });
});
