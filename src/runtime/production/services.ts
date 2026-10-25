import {
  AdminApplicationFacade,
  AuthorizationContract,
  FacadePipeline,
  ParentApplicationFacade,
  TeacherApplicationFacade,
} from "../../application/index.ts";
import {
  classifyDataFailure,
  createAdminPort,
  createParentPort,
  createTeacherPort,
  createVersionPort,
} from "../../data/index.ts";
import type { WorkbookParser } from "../../import-parser/types.ts";
import type { DatabaseClient } from "../database/client.ts";

/**
 * The application facades of one signed-in request (BR32.1, BR32.7). Every request gets its own set, built on
 * a database client that acts as that person: the parent, admin and teacher facades share one pipeline whose
 * authorization asks the database for the account's current authorization version on each call, so a role
 * change takes effect on the next request (U2 BR2.7).
 */
export type RequestServices = Readonly<{
  /** The database as the signed-in account. */
  database: DatabaseClient;
  authorization: AuthorizationContract;
  parent: ParentApplicationFacade;
  admin: AdminApplicationFacade;
  teacher: TeacherApplicationFacade;
}>;

export interface ProductionServices {
  forRequest(accessToken: string): RequestServices;
}

/**
 * What the production services are built with besides the database: the workbook parser of the import. It is
 * handed in by the composition (the only module that imports the server-only reader), so these services and
 * the adapters stay free of the spreadsheet library (BR41.2, NFR2.21).
 */
export type ProductionServiceDependencies = Readonly<{ parseWorkbook: WorkbookParser }>;

export function createProductionServices(
  database: DatabaseClient,
  dependencies: ProductionServiceDependencies,
): ProductionServices {
  return {
    forRequest(accessToken) {
      const asPerson = database.forSession(accessToken);
      const authorization = new AuthorizationContract(createVersionPort(asPerson));
      // The database keeps its own idempotency records, so the facades need no in-memory coordinator.
      const pipeline = new FacadePipeline(authorization, classifyDataFailure);
      return Object.freeze({
        database: asPerson,
        authorization,
        parent: new ParentApplicationFacade(pipeline, createParentPort(asPerson)),
        // Every admin operation has a database answer, so there is no interim port in this path (BR42.1).
        admin: new AdminApplicationFacade(
          pipeline,
          createAdminPort(asPerson, { parseWorkbook: dependencies.parseWorkbook }),
        ),
        teacher: new TeacherApplicationFacade(pipeline, createTeacherPort(asPerson)),
      });
    },
  };
}
