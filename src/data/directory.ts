import type {
  DirectoryFamily,
  DirectoryModel,
  DirectoryParent,
  DomainOutcome,
  OwnProfileModel,
  ParentInput,
  ProfileFields,
  RemovedParentModel,
  VersionModel,
} from "../application/index.ts";
import type { DatabaseClient } from "../runtime/database/client.ts";
import { DataGateway, type Envelope } from "./gateway.ts";
import { removeParentRecord } from "./removal.ts";
import { toOutcome } from "./results.ts";
import { asRows, flag, integer, optionalText, text, type Row } from "./values.ts";

/**
 * The parent directory and the parents' own profile (U3: BR30 to BR32, BR35, BR36). The database decides who sees
 * which field (`directory_list`); this adapter only carries what came back, so a field the viewer may not see is
 * simply absent from the model and cannot be shown by a screen. Every change is one named database function with
 * the idempotency key and the version the screen saw.
 */
export type {
  DirectoryFamily,
  DirectoryModel,
  DirectoryParent,
  OwnProfileModel,
  ParentInput,
  ProfileFields,
  RemovedParentModel,
  VersionModel,
} from "../application/index.ts";

export interface DirectoryPort {
  list(): Promise<DomainOutcome<DirectoryModel>>;
  ownProfile(parentId: string): Promise<OwnProfileModel | undefined>;
  setSharing(input: {
    idempotencyKey: string;
    parentId: string;
    expectedVersion: number;
    sharing: boolean;
  }): Promise<DomainOutcome<VersionModel>>;
  updateOwnProfile(input: {
    idempotencyKey: string;
    parentId: string;
    expectedVersion: number;
    fields: ProfileFields;
  }): Promise<DomainOutcome<VersionModel>>;
  addFamily(input: {
    idempotencyKey: string;
    displayName: string;
    parents: readonly ParentInput[];
    children?: readonly string[];
  }): Promise<DomainOutcome<VersionModel>>;
  addParent(input: {
    idempotencyKey: string;
    familyId: string;
    expectedVersion: number;
    parent: ParentInput;
  }): Promise<DomainOutcome<VersionModel>>;
  editParent(input: {
    idempotencyKey: string;
    parentId: string;
    expectedVersion: number;
    fields: Readonly<{ displayName?: string; email?: string; phone?: string | null }>;
  }): Promise<DomainOutcome<VersionModel>>;
  removeParent(input: {
    idempotencyKey: string;
    parentId: string;
    expectedVersion: number;
  }): Promise<DomainOutcome<RemovedParentModel>>;
}

function optionalFlag(row: Row, key: string): boolean | undefined {
  return row[key] === undefined || row[key] === null ? undefined : flag(row, key);
}

function toParent(row: Row): DirectoryParent {
  const email = optionalText(row, "email");
  const phone = optionalText(row, "phone");
  const residence = optionalText(row, "residence");
  const occupation = optionalText(row, "occupation");
  const hobby = optionalText(row, "hobby");
  const howISupport = optionalText(row, "how_i_support");
  const sharingConsent = optionalFlag(row, "sharing_consent");
  const hasAccount = optionalFlag(row, "has_account");
  return Object.freeze({
    id: text(row, "id"),
    fullName: text(row, "full_name"),
    isSelf: row.is_self === true,
    ...(email ? { email } : {}),
    ...(phone ? { phone } : {}),
    ...(residence ? { residence } : {}),
    ...(occupation ? { occupation } : {}),
    ...(hobby ? { hobby } : {}),
    ...(howISupport ? { howISupport } : {}),
    ...(sharingConsent === undefined ? {} : { sharingConsent }),
    ...(hasAccount === undefined ? {} : { hasAccount }),
  });
}

function toFamily(row: Row): DirectoryFamily {
  const children = row.children === undefined ? undefined : asRows(row.children);
  return Object.freeze({
    familyId: text(row, "family_id"),
    familyName: text(row, "family_name"),
    isOwnFamily: row.is_own_family === true,
    parents: Object.freeze(asRows(row.parents).map(toParent)),
    ...(children ? { children: Object.freeze(children.map((child) => text(child, "name"))) } : {}),
  });
}

function versionOf(envelope: Envelope): VersionModel {
  const raw = envelope.version ?? envelope.family_version;
  return Object.freeze({
    id: envelope.reference,
    version: typeof raw === "number" && Number.isInteger(raw) ? raw : null,
  });
}

const parentBody = (parent: ParentInput) => ({
  display_name: parent.displayName,
  email: parent.email,
  ...(parent.phone ? { phone: parent.phone } : {}),
});

export function createDirectoryPort(database: DatabaseClient): DirectoryPort {
  const gateway = new DataGateway(database);
  const command = async (
    name: string,
    args: Readonly<Record<string, unknown>>,
    key: string,
  ): Promise<DomainOutcome<VersionModel>> =>
    toOutcome(await gateway.call(name, args, key), versionOf);
  return {
    async list() {
      const envelope = await gateway.call("directory_list", {});
      const outcome = toOutcome(envelope, (current) => asRows(current.items).map(toFamily));
      if (outcome.state !== "success") return outcome as DomainOutcome<DirectoryModel>;
      return outcome.data.length
        ? { state: "success", data: Object.freeze({ families: Object.freeze(outcome.data) }) }
        : { state: "empty" };
    },
    async ownProfile(parentId) {
      const rows = asRows(
        await gateway.select("profile.own", (client) =>
          client
            .from("parent_profiles")
            .select(
              "parent_id,version,email_on_record,phone,residence,occupation,hobby,how_i_support,sharing_consent",
            )
            .eq("parent_id", parentId)
            .limit(1),
        ),
      );
      const row = rows[0];
      // A parent who never opened the profile has no row yet: the first save creates it at version 1.
      if (!row) return Object.freeze({ parentId, version: 1, sharingConsent: false });
      const email = optionalText(row, "email_on_record");
      const phone = optionalText(row, "phone");
      const residence = optionalText(row, "residence");
      const occupation = optionalText(row, "occupation");
      const hobby = optionalText(row, "hobby");
      const howISupport = optionalText(row, "how_i_support");
      return Object.freeze({
        parentId,
        version: integer(row, "version"),
        sharingConsent: flag(row, "sharing_consent"),
        ...(email ? { email } : {}),
        ...(phone ? { phone } : {}),
        ...(residence ? { residence } : {}),
        ...(occupation ? { occupation } : {}),
        ...(hobby ? { hobby } : {}),
        ...(howISupport ? { howISupport } : {}),
      });
    },
    setSharing: ({ idempotencyKey, parentId, expectedVersion, sharing }) =>
      command(
        "profile_set_sharing",
        {
          p_idempotency_key: idempotencyKey,
          p_parent_id: parentId,
          p_expected_version: expectedVersion,
          p_sharing: sharing,
        },
        idempotencyKey,
      ),
    updateOwnProfile: ({ idempotencyKey, parentId, expectedVersion, fields }) =>
      command(
        "profile_update_own",
        {
          p_idempotency_key: idempotencyKey,
          p_parent_id: parentId,
          p_expected_version: expectedVersion,
          p_fields: fields,
        },
        idempotencyKey,
      ),
    addFamily: ({ idempotencyKey, displayName, parents, children }) =>
      command(
        "family_add",
        {
          p_idempotency_key: idempotencyKey,
          p_family: {
            display_name: displayName,
            parents: parents.map(parentBody),
            children: (children ?? []).map((name) => ({ display_name: name })),
          },
        },
        idempotencyKey,
      ),
    addParent: ({ idempotencyKey, familyId, expectedVersion, parent }) =>
      command(
        "parent_add",
        {
          p_idempotency_key: idempotencyKey,
          p_family_id: familyId,
          p_expected_version: expectedVersion,
          p_parent: parentBody(parent),
        },
        idempotencyKey,
      ),
    editParent: ({ idempotencyKey, parentId, expectedVersion, fields }) =>
      command(
        "parent_edit",
        {
          p_idempotency_key: idempotencyKey,
          p_parent_id: parentId,
          p_expected_version: expectedVersion,
          p_fields: {
            ...(fields.displayName === undefined ? {} : { display_name: fields.displayName }),
            ...(fields.email === undefined ? {} : { email: fields.email }),
            ...(fields.phone === undefined ? {} : { phone: fields.phone }),
          },
        },
        idempotencyKey,
      ),
    async removeParent({ idempotencyKey, parentId, expectedVersion }) {
      const outcome = await removeParentRecord(gateway, {
        idempotencyKey,
        id: parentId,
        expectedVersion,
      });
      if (outcome.state !== "success" && outcome.state !== "recovery") return outcome;
      return { state: outcome.state, data: Object.freeze({ parentId, removal: outcome.data }) };
    },
  };
}
