import {
  AdminApplicationFacade,
  AuthorizationContract,
  DirectoryApplicationFacade,
  ChecklistApplicationFacade,
  EventApplicationFacade,
  LibraryApplicationFacade,
  RecurringApplicationFacade,
  TodoApplicationFacade,
  AnimalCareApplicationFacade,
  InformationApplicationFacade,
  FacadePipeline,
  ParentApplicationFacade,
  RotaApplicationFacade,
  TeacherApplicationFacade,
  WorkingGroupApplicationFacade,
} from "../../application/index.ts";
import {
  classifyDataFailure,
  createAdminPort,
  createDirectoryPort,
  createChecklistPort,
  createEventPort,
  createLibraryPort,
  createParentPort,
  createRecurringPort,
  createTodoPort,
  createAnimalCarePort,
  createInformationPort,
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
  /** The parent directory, the parent's own profile and the removal of a parent (U3). */
  directory: DirectoryApplicationFacade;
  /** Event pages, sign-ups, food offers, notices and roles (U10); the screens come after the owner's design approval. */
  events: EventApplicationFacade;
  /** Event checklists, claims, done marks and templates (U11); the screens come after the owner's design approval. */
  checklists: ChecklistApplicationFacade;
  /** The lending library: list, book pages, borrowing, returning and watches (U13). */
  library: LibraryApplicationFacade;
  /** Recurring duties: group pages, my duties, the bottle line, marking done and the schedules (U9). */
  recurring: RecurringApplicationFacade;
  /** The community to-do list, a task's page, claiming and finishing tasks, and My tasks (U12). */
  todo: TodoApplicationFacade;
  /** Animal-care slots: the sign-up page, the fair share, giving up and the year's settings (U8). */
  animalCare: AnimalCareApplicationFacade;
  /** The information page and its editing (U8). */
  information: InformationApplicationFacade;
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
        directory: new DirectoryApplicationFacade(pipeline, createDirectoryPort(asPerson)),
        events: new EventApplicationFacade(pipeline, createEventPort(asPerson)),
        checklists: new ChecklistApplicationFacade(pipeline, createChecklistPort(asPerson)),
        library: new LibraryApplicationFacade(pipeline, createLibraryPort(asPerson)),
        recurring: new RecurringApplicationFacade(pipeline, createRecurringPort(asPerson)),
        todo: new TodoApplicationFacade(pipeline, createTodoPort(asPerson)),
        animalCare: new AnimalCareApplicationFacade(pipeline, createAnimalCarePort(asPerson)),
        information: new InformationApplicationFacade(pipeline, createInformationPort(asPerson)),
      });
    },
  };
}
