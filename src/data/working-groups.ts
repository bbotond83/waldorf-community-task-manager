import type {
  DomainOutcome,
  FamilyNameListModel,
  WorkingGroupApplicationPort,
  WorkingGroupItem,
} from "../application/index.ts";
import type { DatabaseClient } from "../runtime/database/client.ts";
import { DataGateway } from "./gateway.ts";
import { toItemsOutcome } from "./results.ts";
import { text, type Row } from "./values.ts";

function toWorkingGroup(row: Row): WorkingGroupItem {
  return Object.freeze({
    id: text(row, "id"),
    name: text(row, "name"),
    description: text(row, "description"),
    schoolYearId: text(row, "school_year_id"),
    schoolYearName: text(row, "school_year_name"),
  });
}

/** The database's working-group list: a refusal stays a refusal, never an empty list (BR2.3). */
export function createWorkingGroupPort(database: DatabaseClient): WorkingGroupApplicationPort {
  const gateway = new DataGateway(database);
  return {
    async list() {
      const envelope = await gateway.call("working_group_list", {});
      return toItemsOutcome(envelope, (rows) => ({
        items: Object.freeze(rows.map(toWorkingGroup)),
      }));
    },
  };
}

/** Active families by id and name only, where a task needs them (BR3.10). */
export async function listFamilyNames(
  gateway: DataGateway,
): Promise<DomainOutcome<FamilyNameListModel>> {
  const envelope = await gateway.call("family_name_list", {});
  return toItemsOutcome(envelope, (rows) => ({
    items: Object.freeze(
      rows.map((row) =>
        Object.freeze({ id: text(row, "id"), displayName: text(row, "display_name") }),
      ),
    ),
  }));
}
