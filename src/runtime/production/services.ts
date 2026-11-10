import {
  AdminApplicationFacade,
  AuthorizationContract,
  FacadePipeline,
  ParentApplicationFacade,
  RotaApplicationFacade,
  TeacherApplicationFacade,
  WorkingGroupApplicationFacade,
} from "../../application/index.ts";
import {
  classifyDataFailure,
  createAdminPort,
  createParentPort,
  createRotaPort,
  createTeacherPort,
  createVersionPort,
  createWorkingGroupPort,
} from "../../data/index.ts";
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
  workingGroups: WorkingGroupApplicationFacade;
  /** The school calendar and the rota (U2); the screens that use it come after the owner's design approval. */
  rota: RotaApplicationFacade;
}>;

export interface ProductionServices {
  forRequest(accessToken: string): RequestServices;
}

export function createProductionServices(database: DatabaseClient): ProductionServices {
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
        admin: new AdminApplicationFacade(pipeline, createAdminPort(asPerson)),
        teacher: new TeacherApplicationFacade(pipeline, createTeacherPort(asPerson)),
        workingGroups: new WorkingGroupApplicationFacade(
          pipeline,
          createWorkingGroupPort(asPerson),
        ),
        rota: new RotaApplicationFacade(pipeline, createRotaPort(asPerson)),
      });
    },
  };
}
