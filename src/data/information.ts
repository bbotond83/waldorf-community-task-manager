import type {
  DomainOutcome,
  InfoChangeModel,
  InfoSectionItem,
  InfoSectionsModel,
  InformationApplicationPort,
} from "../application/index.ts";
import type { DatabaseClient } from "../runtime/database/client.ts";
import { DataGateway, type Envelope } from "./gateway.ts";
import { toOutcome } from "./results.ts";
import { asRows, flag, integer, isUuid, optionalText, text, type Row } from "./values.ts";

function toSection(row: Row): InfoSectionItem {
  const owner = optionalText(row, "owning_group_name");
  const months = Array.isArray(row.season_months)
    ? Object.freeze(row.season_months.filter((m): m is number => typeof m === "number"))
    : undefined;
  return Object.freeze({
    id: text(row, "id"),
    key: text(row, "key"),
    title: text(row, "title"),
    body: text(row, "body"),
    position: integer(row, "position"),
    hidden: flag(row, "hidden"),
    version: integer(row, "version"),
    canEditText: flag(row, "can_edit_text"),
    canEditAll: flag(row, "can_edit_all"),
    ...(owner ? { owningGroupName: owner } : {}),
    ...(months ? { seasonMonths: months } : {}),
  });
}

function toSections(envelope: Envelope): InfoSectionsModel {
  return Object.freeze({
    canManage: envelope.can_manage === true,
    ownerGroupNames: Object.freeze(
      Array.isArray(envelope.owner_group_names)
        ? envelope.owner_group_names.filter((n): n is string => typeof n === "string")
        : [],
    ),
    items: Object.freeze(asRows(envelope.items).map(toSection)),
  });
}

function toChange(envelope: Envelope): InfoChangeModel {
  return Object.freeze({
    id: typeof envelope.reference === "string" ? envelope.reference : null,
    version:
      typeof envelope.version === "number" && Number.isInteger(envelope.version)
        ? envelope.version
        : null,
  });
}

/**
 * The database's information-page reads and commands (U8): one function call per page and per command, with the
 * idempotency key and the version the editor saw. A section address that is not an identifier names nothing and reads
 * as denied without asking the database.
 */
export function createInformationPort(database: DatabaseClient): InformationApplicationPort {
  const gateway = new DataGateway(database);
  const DENIED: DomainOutcome<never> = { state: "denied" };
  const change = async (
    name: string,
    args: Readonly<Record<string, unknown>>,
    key: string,
  ): Promise<DomainOutcome<InfoChangeModel>> =>
    toOutcome(await gateway.call(name, args, key), toChange);
  return {
    async list() {
      return toOutcome(await gateway.call("info_sections_list", {}), toSections);
    },
    async update(input) {
      if (!isUuid(input.sectionId)) return DENIED;
      return change(
        "info_section_update",
        {
          p_idempotency_key: input.idempotencyKey,
          p_section_id: input.sectionId,
          p_title: input.title,
          p_body: input.body,
          p_owning_group_name: input.owningGroupName ?? null,
          p_season_months: input.seasonMonths ? [...input.seasonMonths] : null,
          p_position: input.position,
          p_expected_version: input.expectedVersion,
        },
        input.idempotencyKey,
      );
    },
    create: (input) =>
      change(
        "info_section_create",
        {
          p_idempotency_key: input.idempotencyKey,
          p_title: input.title,
          p_body: input.body,
          p_owning_group_name: input.owningGroupName ?? null,
          p_season_months: input.seasonMonths ? [...input.seasonMonths] : null,
          p_position: input.position,
        },
        input.idempotencyKey,
      ),
    async setHidden({ idempotencyKey, sectionId, hidden, expectedVersion }) {
      if (!isUuid(sectionId)) return DENIED;
      return change(
        "info_section_set_hidden",
        {
          p_idempotency_key: idempotencyKey,
          p_section_id: sectionId,
          p_hidden: hidden,
          p_expected_version: expectedVersion,
        },
        idempotencyKey,
      );
    },
  };
}
