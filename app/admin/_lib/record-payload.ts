import type {
  AdminParentPayload,
  AdminRecordPayload,
  AdminTaskPayload,
} from "../../../src/application/admin-payloads.ts";
import { budapestLocalToIso } from "../../../src/application/budapest-time.ts";

/**
 * Reads the extended admin forms (BR32.7) into the typed payloads of `admin-payloads.ts`. Every rule the
 * database checks is checked here first with a Hungarian message tied to the field that caused it, so a
 * person is told which field to fix before anything is sent. The database still has the last word.
 */
export type FormErrors = Record<string, string>;

export const MAX_PARENTS = 10;
const TEXT_MAX = 200;

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const PHONE = /^[0-9 +-]{6,20}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

function text(formData: FormData, field: string): string {
  const value = formData.get(field);
  return typeof value === "string" ? value.trim() : "";
}

/** The field names of the parent block with this number; the forms and this reader share them. */
export function parentField(index: number, field: string): string {
  return `parent-${index}-${field}`;
}

/** The parent blocks of a family form. A block with nothing in it is skipped; a half-filled one is an error. */
export function parseParents(formData: FormData): {
  parents: AdminParentPayload[];
  errors: FormErrors;
} {
  const parents: AdminParentPayload[] = [];
  const errors: FormErrors = {};
  for (let index = 0; index < MAX_PARENTS; index += 1) {
    if (!formData.has(parentField(index, "name"))) break;
    const field = (name: string) => text(formData, parentField(index, name));
    const id = field("id");
    const name = field("name");
    const email = field("email").toLowerCase();
    const phone = field("phone");
    const locality = field("locality");
    const profile = field("profile");
    const consent = formData.has(parentField(index, "consent"));
    if (id === "" && !name && !email && !phone && !locality && !profile) continue;

    if (!name) errors[parentField(index, "name")] = "A szülő nevének megadása kötelező.";
    else if (name.length > TEXT_MAX) {
      errors[parentField(index, "name")] = "A szülő neve legfeljebb 200 karakter lehet.";
    }
    if (email && (email.length > 254 || !EMAIL.test(email))) {
      errors[parentField(index, "email")] = "Adjon meg érvényes e-mail-címet.";
    }
    if (phone && !PHONE.test(phone)) {
      errors[parentField(index, "phone")] =
        "A telefonszám 6–20 karakter lehet, és csak számjegyet, szóközt, + és - jelet tartalmazhat.";
    }
    if (locality.length > 100) {
      errors[parentField(index, "locality")] = "A település legfeljebb 100 karakter lehet.";
    }
    if (profile.length > 500) {
      errors[parentField(index, "profile")] = "A bemutatkozás legfeljebb 500 karakter lehet.";
    } else if (profile && !consent) {
      errors[parentField(index, "profile")] =
        "A bemutatkozás csak hozzájárulással menthető: jelölje be a hozzájárulást, vagy hagyja üresen a mezőt.";
    }

    const version = Number(field("version"));
    const existing = id !== "";
    parents.push({
      ...(existing ? { id, expectedVersion: Number.isInteger(version) ? version : 0 } : {}),
      displayName: name,
      // A stored parent always sends all three contact fields, so a cleared field is cleared in the
      // database; a new parent sends only what was filled in.
      ...(existing || email ? { email } : {}),
      ...(existing || phone ? { phone } : {}),
      ...(existing || locality ? { locality } : {}),
      ...(existing || profile ? { optionalProfile: profile } : {}),
      optionalProfileConsent: consent,
    });
  }
  return { parents, errors };
}

/** The fields of a record form beyond the title, by the kind of record. `extended` marks the real-data forms. */
export function parseRecordExtras(
  kind: string,
  formData: FormData,
  creating: boolean,
): { payload: Partial<AdminRecordPayload>; errors: FormErrors } {
  const errors: FormErrors = {};
  if (text(formData, "extended") !== "1") return { payload: {}, errors };
  const payload: { -readonly [K in keyof AdminRecordPayload]?: AdminRecordPayload[K] } = {};

  if (kind === "group") {
    const schoolYearId = text(formData, "schoolYearId");
    if (schoolYearId) payload.schoolYearId = schoolYearId;
    else if (creating) errors.schoolYearId = "Válassza ki a nevelési évet.";
    const description = text(formData, "description");
    if (!description) errors.description = "A leírás megadása kötelező.";
    else if (description.length > 1000)
      errors.description = "A leírás legfeljebb 1000 karakter lehet.";
    else payload.description = description;
  }
  if (kind === "school-year") {
    const startsOn = text(formData, "startsOn");
    const endsOn = text(formData, "endsOn");
    if (!startsOn) errors.startsOn = "A kezdő dátum megadása kötelező.";
    else if (!DAY.test(startsOn)) errors.startsOn = "Adjon meg érvényes kezdő dátumot.";
    if (!endsOn) errors.endsOn = "A záró dátum megadása kötelező.";
    else if (!DAY.test(endsOn)) errors.endsOn = "Adjon meg érvényes záró dátumot.";
    if (!errors.startsOn && !errors.endsOn && endsOn < startsOn) {
      errors.endsOn = "A záró dátum nem lehet korábbi a kezdő dátumnál.";
    }
    if (startsOn) payload.startsOn = startsOn;
    if (endsOn) payload.endsOn = endsOn;
  }
  if (kind === "child") {
    const familyId = text(formData, "familyId");
    if (familyId) payload.familyId = familyId;
    else if (creating) errors.familyId = "Válassza ki a családot.";
  }
  if (kind === "family") {
    const parsed = parseParents(formData);
    Object.assign(errors, parsed.errors);
    payload.parents = parsed.parents;
  }
  return { payload, errors };
}

const TASK_STATUSES = ["open", "closed", "cancelled"] as const;
const EVENT_STATUSES = ["planned", "cancelled"] as const;

/** The fields of a task or event form beyond the title. `extended` marks the real-data forms. */
export function parseTaskExtras(
  kind: "task" | "event",
  formData: FormData,
  creating: boolean,
): { payload: Partial<AdminTaskPayload>; errors: FormErrors } {
  const errors: FormErrors = {};
  if (text(formData, "extended") !== "1") return { payload: {}, errors };
  const payload: { -readonly [K in keyof AdminTaskPayload]?: AdminTaskPayload[K] } = {};

  const groupId = text(formData, "groupId");
  if (groupId) payload.groupId = groupId;
  else if (creating) errors.groupId = "Válassza ki a munkacsoportot.";

  const startsAt = readInstant(formData, "startsAt", "kezdési időpont", errors);
  const endsAt = readInstant(formData, "endsAt", "befejezési időpont", errors, startsAt);
  if (startsAt) payload.startsAt = startsAt;
  if (endsAt) payload.endsAt = endsAt;

  const location = text(formData, "location");
  if (location.length > TEXT_MAX) errors.location = "A helyszín legfeljebb 200 karakter lehet.";
  if (location || kind === "event") payload.location = location;
  else if (creating) errors.location = "A helyszín megadása kötelező.";

  const status = text(formData, "status");
  if (status) {
    const allowed: readonly string[] = kind === "task" ? TASK_STATUSES : EVENT_STATUSES;
    if (allowed.includes(status)) payload.status = status;
    else errors.status = "Érvénytelen állapot.";
  }

  if (kind === "event") {
    const coordinator = text(formData, "coordinatorName");
    if (coordinator.length > TEXT_MAX) {
      errors.coordinatorName = "A koordinátor neve legfeljebb 200 karakter lehet.";
    }
    payload.coordinatorName = coordinator;
  } else {
    const eventId = text(formData, "eventId");
    if (eventId) payload.eventId = eventId;
    const category = text(formData, "category");
    if (category.length > 100) errors.category = "A kategória legfeljebb 100 karakter lehet.";
    else if (category) payload.category = category;
    const capacityText = text(formData, "capacity");
    const capacity = Number(capacityText);
    if (!capacityText) {
      if (creating) errors.capacity = "A férőhelyek számának megadása kötelező.";
    } else if (!Number.isInteger(capacity) || capacity < 1 || capacity > 50) {
      errors.capacity = "A férőhelyek száma 1 és 50 közötti egész szám lehet.";
    } else {
      payload.capacity = capacity;
    }
  }
  return { payload, errors };
}

function readInstant(
  formData: FormData,
  field: "startsAt" | "endsAt",
  name: string,
  errors: FormErrors,
  notBefore?: string,
): string | undefined {
  const value = text(formData, field);
  if (!value) {
    if (formData.has(field) && text(formData, "id") === "new") {
      errors[field] = `A ${name} megadása kötelező.`;
    }
    return undefined;
  }
  const instant = budapestLocalToIso(value);
  if (!instant) {
    errors[field] = `Adjon meg érvényes dátumot és időt (${name}).`;
    return undefined;
  }
  if (notBefore && instant < notBefore) {
    errors[field] = "A befejezés nem lehet korábbi a kezdésnél.";
    return undefined;
  }
  return instant;
}
