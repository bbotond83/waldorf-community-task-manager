import { seedEmail, seedId } from "./ids.ts";

/**
 * The data of the seed, defined once (NFR2.31): the small set and the 30-family set are the same rules applied to
 * two sizes. Everything here is fictitious: Hungarian names, example domains and example phone numbers that the privacy
 * scan allows, and test passwords that are used only for the accounts the seed creates and that live only in this file
 * (NFR1.64). Nothing prints a password; nothing reads `source-materials/`.
 *
 * Dates are stored as hours from the start of today (the writer turns them into timestamps), so a seed made today
 * has tasks in the coming days and the same rules hold on any day.
 *
 * The production runtime never imports this module; a test proves it (NFR1.64).
 */

export type SeedSize = "small" | "large";
export type SeedRole = "super_admin" | "group_admin" | "kindergarten_teacher" | "parent";
export type SeedScopeType = "organization" | "group" | "family";

/** Fictitious test passwords, one per role. They satisfy the password rule (8 to 72 characters, a letter and a digit). */
export const SEED_PASSWORDS: Readonly<Record<SeedRole, string>> = {
  super_admin: "Teszt-Szuperadmin-2026",
  group_admin: "Teszt-Csoportadmin-2026",
  kindergarten_teacher: "Teszt-Ovono-2026",
  parent: "Teszt-Szulo-2026",
};

/** The shape of each set: how many families and groups. The rules below do the rest. */
export const SEED_SHAPES: Readonly<Record<SeedSize, { families: number; groups: number }>> = {
  small: { families: 6, groups: 2 },
  large: { families: 30, groups: 3 },
};

export interface SeedAccount {
  key: string;
  /** The part of the address between `<schema>.` and `@example.test`. */
  tag: string;
  id: string;
  /** The id of the account's role grant. */
  grantId: string;
  email: string;
  password: string;
  role: SeedRole;
  scopeType: SeedScopeType;
  scopeId: string;
}

export interface SeedPlan {
  schema: string;
  size: SeedSize;
  organization: { id: string; name: string };
  schoolYear: { id: string; name: string; startsOn: string; endsOn: string };
  groups: { id: string; name: string }[];
  families: { id: string; name: string; groupId: string; membershipId: string }[];
  parents: {
    id: string;
    familyId: string;
    name: string;
    accountId: string | null;
    contactEmail: string;
    contactPhone: string | null;
    locality: string;
    optionalProfile: string | null;
    consent: boolean;
  }[];
  children: { id: string; familyId: string; name: string }[];
  accounts: SeedAccount[];
  events: {
    id: string;
    groupId: string;
    title: string;
    location: string;
    coordinator: string | null;
    startsAtHours: number;
    endsAtHours: number;
    allergenNote: string | null;
    supplyNote: string | null;
    foodNote: string | null;
  }[];
  tasks: {
    id: string;
    groupId: string;
    eventId: string | null;
    title: string;
    capacity: number;
    startsAtHours: number;
    endsAtHours: number;
    location: string;
  }[];
  assignments: {
    id: string;
    taskId: string;
    familyId: string;
    parentId: string | null;
    source: "parent_sign_up" | "admin_assign";
  }[];
}

const SURNAMES = [
  "Szabó",
  "Kiss",
  "Horváth",
  "Varga",
  "Molnár",
  "Németh",
  "Farkas",
  "Balogh",
  "Papp",
  "Takács",
  "Juhász",
  "Lakatos",
  "Mészáros",
  "Oláh",
  "Simon",
  "Rácz",
  "Fekete",
  "Szilágyi",
  "Török",
  "Fehér",
  "Gál",
  "Kocsis",
  "Pintér",
  "Fodor",
  "Orsós",
  "Sipos",
  "Magyar",
  "Lukács",
  "Gulyás",
  "Bíró",
] as const;
const FEMALE_NAMES = [
  "Anna",
  "Katalin",
  "Éva",
  "Zsuzsanna",
  "Judit",
  "Ildikó",
  "Mária",
  "Erika",
  "Andrea",
  "Nóra",
  "Réka",
  "Eszter",
  "Dóra",
  "Lilla",
  "Petra",
  "Kinga",
  "Orsolya",
  "Viktória",
  "Bernadett",
  "Csilla",
  "Szilvia",
  "Tímea",
  "Anikó",
  "Beáta",
  "Edina",
  "Gabriella",
  "Hajnalka",
  "Ivett",
  "Klára",
  "Lívia",
] as const;
const MALE_NAMES = [
  "Péter",
  "László",
  "István",
  "Zoltán",
  "Gábor",
  "Attila",
  "Tamás",
  "András",
  "Balázs",
  "Csaba",
  "Dániel",
  "Ferenc",
  "György",
  "Imre",
  "János",
  "Károly",
  "Lajos",
  "Márk",
  "Norbert",
  "Olivér",
  "Pál",
  "Richárd",
  "Sándor",
  "Tibor",
  "Viktor",
  "Ádám",
  "Bence",
  "Dávid",
  "Endre",
  "Gergely",
] as const;
const CHILD_NAMES = [
  "Bori",
  "Máté",
  "Luca",
  "Marcell",
  "Hanna",
  "Levente",
  "Zsófia",
  "Bálint",
  "Lili",
  "Dominik",
  "Emma",
  "Barnabás",
  "Napsugár",
  "Botond",
  "Villő",
  "Kristóf",
  "Boglárka",
  "Milán",
  "Panna",
  "Zalán",
  "Fanni",
  "Benedek",
  "Csenge",
  "Domonkos",
  "Enikő",
  "Gergő",
  "Hajna",
  "Iván",
  "Janka",
  "Kende",
  "Léna",
  "Mihály",
  "Nelli",
  "Oszkár",
  "Pálma",
  "Réka",
  "Soma",
  "Tünde",
  "Vince",
  "Zsombor",
] as const;
const GROUP_NAMES = ["Katica", "Süni", "Pillangó"] as const;
const LOCALITIES = ["Pécs", "Mohács", "Komló", "Szigetvár"] as const;
/** Example phone numbers that scripts/verification/privacy-allowlist.json already allows. */
const PHONES = [
  "+36 30 555 1212",
  "+36 20 555 1212",
  "+36 30 111 2222",
  "+36 30 777 1010",
] as const;

/** The address tags of the staff accounts every seeded schema has; the parents' tags are `parent-<family number>`. */
export const SEED_STAFF_TAGS = {
  superAdmin: "super-admin",
  groupAdmin1: "group-admin-1",
  groupAdmin2: "group-admin-2",
  teacher1: "teacher-1",
} as const;

const pick = <T>(list: readonly T[], index: number): T => list[index % list.length]!;

/**
 * Builds the plan of a set for a schema. The plan holds ids, names and offsets only; the writer turns it into rows.
 * The same schema and size always give the same plan.
 */
export function buildSeedPlan(schema: string, size: SeedSize): SeedPlan {
  const shape = SEED_SHAPES[size];
  const id = (key: string) => seedId(schema, key);
  const organization = { id: id("organization"), name: "Tesztiskola Waldorf Óvoda" };
  const schoolYear = {
    id: id("school-year"),
    name: "2026/2027",
    startsOn: "2026-09-01",
    endsOn: "2027-06-30",
  };
  const groups = Array.from({ length: shape.groups }, (_, g) => ({
    id: id(`group:${g + 1}`),
    name: pick(GROUP_NAMES, g),
  }));

  const families: SeedPlan["families"] = [];
  const parents: SeedPlan["parents"] = [];
  const children: SeedPlan["children"] = [];
  const accounts: SeedAccount[] = [];

  const account = (
    key: string,
    tag: string,
    role: SeedRole,
    scopeType: SeedScopeType,
    scopeId: string,
  ): SeedAccount => ({
    key,
    tag,
    id: id(`account:${tag}`),
    grantId: id(`grant:${tag}`),
    email: seedEmail(schema, tag),
    password: SEED_PASSWORDS[role],
    role,
    scopeType,
    scopeId,
  });

  accounts.push(
    account(
      "super-admin",
      SEED_STAFF_TAGS.superAdmin,
      "super_admin",
      "organization",
      organization.id,
    ),
  );
  for (let g = 0; g < Math.min(2, groups.length); g++) {
    accounts.push(
      account(
        `group-admin-${g + 1}`,
        `group-admin-${g + 1}`,
        "group_admin",
        "group",
        groups[g]!.id,
      ),
    );
  }
  accounts.push(
    account("teacher-1", SEED_STAFF_TAGS.teacher1, "kindergarten_teacher", "group", groups[0]!.id),
  );

  for (let n = 1; n <= shape.families; n++) {
    const index = n - 1;
    const surname = pick(SURNAMES, index);
    const group = groups[index % groups.length]!;
    const family = {
      id: id(`family:${n}`),
      name: `${surname} család`,
      groupId: group.id,
      membershipId: id(`membership:${n}`),
    };
    families.push(family);

    const parentAccount = account(`parent-${n}`, `parent-${n}`, "parent", "family", family.id);
    accounts.push(parentAccount);
    for (const [slot, given] of [
      [1, pick(FEMALE_NAMES, index)],
      [2, pick(MALE_NAMES, index)],
    ] as const) {
      const first = slot === 1;
      parents.push({
        id: id(`parent:${n}:${slot}`),
        familyId: family.id,
        name: `${surname} ${given}`,
        accountId: first ? parentAccount.id : null,
        contactEmail: `csalad${n}.szulo${slot}@example.test`,
        contactPhone: first || n % 2 === 0 ? pick(PHONES, index + slot) : null,
        locality: pick(LOCALITIES, index),
        optionalProfile: n === 1 && first ? "Szívesen sütök és kertészkedem." : null,
        consent: n === 1 && first,
      });
    }
    const childCount = n % 3 === 0 ? 2 : 1;
    for (let c = 1; c <= childCount; c++) {
      children.push({
        id: id(`child:${n}:${c}`),
        familyId: family.id,
        name: `${surname} ${pick(CHILD_NAMES, index * 2 + c)}`,
      });
    }
  }

  const events: SeedPlan["events"] = [];
  const tasks: SeedPlan["tasks"] = [];
  const assignments: SeedPlan["assignments"] = [];
  const EVENT_TITLES = ["Őszi vásár", "Közös kertrendezés", "Mikulás-délután"] as const;
  const EVENT_PLACES = ["Tornaterem", "Kert", "Aula"] as const;
  const hours = (day: number, hour: number) => day * 24 + hour;

  groups.forEach((group, g) => {
    const eventId = id(`event:${g + 1}`);
    const eventDay = 10 + 2 * g;
    events.push({
      id: eventId,
      groupId: group.id,
      title: pick(EVENT_TITLES, g),
      location: pick(EVENT_PLACES, g),
      coordinator: "Tóth Mária",
      startsAtHours: hours(eventDay, 14),
      endsAtHours: hours(eventDay, 18),
      allergenNote: g === 0 ? "mogyoró, tej" : null,
      supplyNote: g === 0 ? "terítők, tálcák" : null,
      foodNote: g === 0 ? "házi sütemény" : null,
    });
    const baking = id(`task:${g + 1}:1`);
    const decorating = id(`task:${g + 1}:2`);
    const cleaning = id(`task:${g + 1}:3`);
    tasks.push(
      {
        id: baking,
        groupId: group.id,
        eventId,
        title: "Sütés",
        capacity: 3,
        startsAtHours: hours(eventDay, 12),
        endsAtHours: hours(eventDay, 14),
        location: "Konyha",
      },
      {
        id: decorating,
        groupId: group.id,
        eventId,
        title: "Díszítés",
        capacity: 2,
        startsAtHours: hours(eventDay, 10),
        endsAtHours: hours(eventDay, 12),
        location: pick(EVENT_PLACES, g),
      },
      {
        id: cleaning,
        groupId: group.id,
        eventId: null,
        title: "Takarítás",
        capacity: 2,
        startsAtHours: hours(7 + g, 16),
        endsAtHours: hours(7 + g, 18),
        location: "Csoportszoba",
      },
    );
    // The families of the group, in order: two are placed by an admin on the baking task, the third signs up
    // for the decorating task itself, and the first one also holds the cleaning task. No task is over capacity.
    const members = families.filter((family) => family.groupId === group.id);
    const place = (
      task: string,
      slot: number,
      source: "parent_sign_up" | "admin_assign",
      member: (typeof members)[number] | undefined,
    ) => {
      if (!member) return;
      const number = families.indexOf(member) + 1;
      assignments.push({
        id: id(`assignment:${task}:${slot}`),
        taskId: task,
        familyId: member.id,
        parentId: source === "parent_sign_up" ? id(`parent:${number}:1`) : null,
        source,
      });
    };
    place(baking, 1, "admin_assign", members[0]);
    place(baking, 2, "admin_assign", members[1]);
    place(decorating, 1, "parent_sign_up", members[2]);
    place(cleaning, 1, "admin_assign", members[0]);
  });

  return {
    schema,
    size,
    organization,
    schoolYear,
    groups,
    families,
    parents,
    children,
    accounts,
    events,
    tasks,
    assignments,
  };
}

/** The accounts of a set, for tests that sign in as one of them. */
export function seedAccounts(schema: string, size: SeedSize = "small"): SeedAccount[] {
  return buildSeedPlan(schema, size).accounts;
}

/** One account of a set by its address tag (`super-admin`, `group-admin-1`, `teacher-1`, `parent-3`, ...). */
export function seedAccount(schema: string, tag: string, size: SeedSize = "small"): SeedAccount {
  const found = seedAccounts(schema, size).find((entry) => entry.tag === tag);
  if (!found) throw new Error(`No seeded account with the tag ${tag}.`);
  return found;
}

/** Counts of a plan, safe to print: no names, addresses or passwords. */
export function describePlan(plan: SeedPlan): Record<string, number> {
  return {
    groups: plan.groups.length,
    families: plan.families.length,
    parents: plan.parents.length,
    children: plan.children.length,
    accounts: plan.accounts.length,
    events: plan.events.length,
    tasks: plan.tasks.length,
    assignments: plan.assignments.length,
  };
}
