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
  ...plan.standings.map((entry) => entry.id),
  plan.rotaPlan.id,
  ...plan.groups.map((entry) => entry.id),
  ...plan.families.map((entry) => entry.id),
  ...plan.memberships.map((entry) => entry.id),
  ...plan.extraGrants.map((entry) => entry.id),
  ...plan.parents.map((entry) => entry.id),
  ...plan.children.map((entry) => entry.id),
  ...plan.accounts.flatMap((entry) => [entry.id, entry.grantId]),
  ...plan.events.map((entry) => entry.id),
  ...plan.eventNotices.map((entry) => entry.id),
  ...plan.eventRoles.map((entry) => entry.id),
  ...plan.eventSignups.map((entry) => entry.id),
  ...plan.foodOffers.map((entry) => entry.id),
  ...plan.books.map((entry) => entry.id),
  ...plan.loans.map((entry) => entry.id),
  ...plan.watches.map((entry) => entry.id),
  ...plan.recurringSchedules.map((entry) => entry.id),
  ...plan.tasks.map((entry) => entry.id),
  ...plan.assignments.map((entry) => entry.id),
  ...plan.notices.flatMap((entry) => [entry.id, entry.deliveryId]),
  ...plan.timedRuns.flatMap((entry) => [entry.id, ...entry.checks.map((check) => check.id)]),
];

describe("seed data: the small set", () => {
  const plan = buildSeedPlan("public", "small");

  it("gives one event notices, roles (parent, typed name, organiser), sign-ups and food offers", () => {
    const event = plan.events.find((entry) => entry.foodSignupOn)!;
    assert.ok(event, "one event has food sign-up on");
    assert.ok(plan.eventNotices.some((row) => row.eventId === event.id));
    const roles = plan.eventRoles.filter((row) => row.eventId === event.id);
    assert.ok(
      roles.some((row) => row.personName !== null && row.parentId === null),
      "typed name",
    );
    assert.ok(
      roles.some((row) => row.isOrganiser && row.parentId !== null),
      "organiser",
    );
    assert.ok(
      roles.every((row) => !(row.parentId && row.personName)),
      "never both",
    );
    assert.ok(plan.eventSignups.length > 0 && plan.foodOffers.length > 0);
    const parents = new Set(plan.parents.map((parent) => parent.id));
    for (const row of [...plan.eventSignups, ...plan.foodOffers]) {
      assert.ok(parents.has(row.parentId), "a sign-up or offer belongs to a seeded parent");
    }
  });

  it("gives the library an owned book, a typed owner, a closed loan, an open loan, a late loan and watches", () => {
    assert.equal(plan.books.length, 6);
    assert.ok(plan.books.some((book) => book.ownerParentId !== null && book.ownerName === null));
    const typed = plan.books.filter((book) => book.ownerName !== null);
    assert.ok(typed.length > 0 && typed.every((book) => book.sourceKey && !book.ownerParentId));
    assert.ok(
      plan.loans.some((loan) => loan.returnedDaysAgo !== null),
      "closed loan",
    );
    const open = plan.loans.filter((loan) => loan.returnedDaysAgo === null);
    assert.ok(
      open.some((loan) => (loan.untilInDays ?? 0) > 0),
      "open loan with a date",
    );
    assert.ok(
      open.some((loan) => (loan.untilInDays ?? 0) < 0),
      "late loan",
    );
    const books = new Map(plan.books.map((book) => [book.id, book]));
    for (const watch of plan.watches) {
      const holder = open.find((loan) => loan.bookId === watch.bookId);
      assert.ok(holder, "a watch is on a borrowed book");
      assert.notEqual(holder.borrowerParentId, watch.parentId, "the holder does not watch");
      assert.notEqual(
        books.get(watch.bookId)?.ownerParentId,
        watch.parentId,
        "the owner does not watch",
      );
    }
  });

  it("gives the recurring duties the starting list: bottle cleaning every 4th water week, six animal items with three rabbit items off, rounds every 4 weeks, garden items with seasons, and one family schedule (U9)", () => {
    const schedules = plan.recurringSchedules;
    const byTitle = (title: string) => schedules.find((entry) => entry.title === title)!;
    const bottles = byTitle("Vizespalackok tisztítása");
    assert.deepEqual(
      [bottles.ownerKind, bottles.rotaJob, bottles.intervalCount, bottles.groupId],
      ["rota_week", "water_carrying", 4, null],
    );
    const animals = schedules.filter((entry) => entry.groupId === plan.groups[5]!.id);
    assert.equal(animals.length, 6);
    assert.deepEqual(
      animals.filter((entry) => !entry.isActive).map((entry) => entry.category),
      ["nyúl", "nyúl", "nyúl"],
    );
    assert.equal(byTitle("Játszótér körbejárása").groupId, plan.groups[0]!.id);
    assert.equal(byTitle("Játszótér körbejárása").intervalCount, 4);
    assert.equal(byTitle("Épület és udvar körbejárása").intervalCount, 4);
    assert.deepEqual(
      [byTitle("Fűnyírás"), byTitle("Gyomlálás"), byTitle("Komposzt átrakása")].map((entry) => [
        entry.intervalCount,
        entry.seasonFromMonth,
        entry.seasonToMonth,
      ]),
      [
        [2, 4, 10],
        [3, 4, 9],
        [6, 3, 11],
      ],
    );
    const family = schedules.filter((entry) => entry.ownerKind === "family");
    assert.deepEqual(
      family.map((entry) => entry.familyId),
      [plan.families[0]!.id],
    );
    for (const entry of schedules) {
      assert.ok(
        entry.startDate >= "2026-08-31" && new Date(entry.startDate).getUTCDay() === 1,
        "starts on a Monday",
      );
      assert.ok((entry.seasonFromMonth === null) === (entry.seasonToMonth === null));
    }
    assert.equal(plan.recurringSkippedByAccountId, plan.accounts[0]!.id);
  });

  it("has the six working groups, 6 families with parents and children, a super admin, two group admins and a teacher", () => {
    assert.deepEqual(describePlan(plan), {
      groups: 6,
      families: 6,
      parents: 12,
      children: 8,
      accounts: 10,
      events: 3,
      books: 6,
      loans: 4,
      watches: 4,
      recurringSchedules: 13,
      tasks: 8,
      assignments: 8,
      changeRequests: 2,
      notices: 2,
      standings: 2,
      plans: 1,
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

  it("seeds the sharing choice: some parents share a filled profile and some keep a filled one private", () => {
    for (const parent of plan.parents.filter((entry) => entry.sharing)) {
      assert.ok(parent.accountId !== null, "a sharing parent has an account");
      assert.ok(parent.occupation && parent.hobby && parent.howISupport);
    }
    assert.ok(plan.parents.some((parent) => parent.sharing && parent.occupation));
    assert.ok(plan.parents.some((parent) => !parent.sharing && parent.occupation));
  });
});

describe("seed data: the 30-family set", () => {
  const large = buildSeedPlan("worker_1", "large");

  it("is the same rules at a larger size: 30 families and the six working groups, one account for every family", () => {
    assert.equal(large.families.length, 30);
    assert.equal(large.groups.length, 6);
    assert.equal(large.accounts.length, 1 + 2 + 1 + 30);
    assert.equal(large.memberships.length, 51);
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

  it("gives every working group members and one coordinator who is a member of it (BR41.8), in both sizes", () => {
    for (const size of ["small", "large"] as const) {
      const plan = buildSeedPlan("worker_1", size);
      const parentOfAccount = new Map(
        plan.parents
          .filter((parent) => parent.accountId)
          .map((parent) => [parent.accountId, parent.id]),
      );
      const keys = plan.memberships.map((entry) => `${entry.parentId}|${entry.groupId}`);
      assert.equal(new Set(keys).size, keys.length, "no parent joins a group twice");
      for (const group of plan.groups) {
        assert.ok(
          plan.memberships.some((entry) => entry.groupId === group.id),
          `${size}: ${group.name} has members`,
        );
        const holders = [
          ...plan.accounts.filter(
            (entry) => entry.role === "group_admin" && entry.scopeId === group.id,
          ),
          ...plan.extraGrants.filter(
            (grant) => grant.role === "group_admin" && grant.scopeId === group.id,
          ),
        ].map((grant) => ("subjectId" in grant ? grant.subjectId : grant.id));
        assert.equal(holders.length, 1, `${size}: ${group.name} has exactly one coordinator`);
        const parentId = parentOfAccount.get(holders[0]!);
        assert.ok(parentId, "the coordinator is a linked parent");
        assert.ok(
          plan.memberships.some(
            (entry) => entry.parentId === parentId && entry.groupId === group.id,
          ),
          `${size}: the coordinator of ${group.name} is a member of it`,
        );
      }
    }
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

  it("seeds invented notices for sign-ups of parents with an account, in every delivery state, and one failed check", () => {
    assert.ok(large.notices.length > 0);
    const placed = new Set(large.assignments.map((entry) => entry.parentId));
    for (const notice of large.notices) {
      const parent = large.parents.find((entry) => entry.id === notice.parentId)!;
      assert.ok(parent.accountId !== null, "the notice goes to a parent with an account");
      assert.ok(placed.has(notice.parentId), "and was caused by that parent's own sign-up");
    }
    const states = new Set(large.notices.map((entry) => entry.deliveryStatus));
    assert.deepEqual([...states].sort(), ["failed", "queued", "sent"]);
    const run = large.timedRuns[0]!;
    assert.deepEqual(
      run.checks.map((check) => check.outcome),
      ["success", "failed"],
    );
    assert.ok(
      run.checks.every(
        (check) => check.errorCode === null || /^[0-9A-Z]{5}$/.test(check.errorCode),
      ),
    );
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

  it("seeds one four-rota plan: a draft in the small set, published with six picks in the large set (BR61.1)", () => {
    const small = buildSeedPlan("public", "small");
    assert.deepEqual(
      {
        published: small.rotaPlan.published,
        by: small.rotaPlan.publishedBy,
        picks: small.rotaPlan.picks,
      },
      { published: false, by: null, picks: 0 },
    );
    const large = buildSeedPlan("public", "large");
    assert.equal(large.rotaPlan.published, true);
    assert.equal(large.rotaPlan.publishedBy, large.accounts[0]!.id, "the super admin published it");
    assert.equal(large.rotaPlan.picks, 6);
    assert.notEqual(small.rotaPlan.id, buildSeedPlan("worker_1", "small").rotaPlan.id);
  });

  it("lets a run ask for the other state of the rota plan, for the timing of the draft and the publish", () => {
    const draft = buildSeedPlan("public", "large", "draft");
    assert.deepEqual(
      [draft.rotaPlan.published, draft.rotaPlan.publishedBy, draft.rotaPlan.picks],
      [false, null, 0],
    );
    const published = buildSeedPlan("public", "small", "published");
    assert.equal(published.rotaPlan.published, true);
    assert.equal(published.rotaPlan.picks, 6);
    assert.equal(published.rotaPlan.publishedBy, published.accounts[0]!.id);
  });

  it("seeds one leaving and one new family, the last two, in both sets (BR60.1)", () => {
    for (const size of ["small", "large"] as const) {
      const plan = buildSeedPlan("public", size);
      assert.deepEqual(
        plan.standings.map((entry) => entry.standing),
        ["leaving", "new"],
      );
      assert.deepEqual(
        plan.standings.map((entry) => entry.familyId),
        plan.families.slice(-2).map((family) => family.id),
      );
    }
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
    assert.match(text, /^\{("[A-Za-z]+":\d+,?)+\}$/);
    for (const password of Object.values(SEED_PASSWORDS)) assert.ok(!text.includes(password));
  });
});
