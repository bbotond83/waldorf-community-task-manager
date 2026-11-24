import type { Scope } from "../access/index.ts";
import type {
  ApplicationResult,
  AuthorizationMatrixRowId,
  InfoChangeModel,
  InfoSectionsModel,
  SessionContext,
} from "./contracts.ts";
import type { DomainOutcome, FacadePipeline } from "./facade-pipeline.ts";
import { validateIdempotencyKey, validateMutationContext } from "./validation.ts";

type Outcome<T> = Promise<DomainOutcome<T>>;
type Key = { idempotencyKey: string };

/** The fields of a section a form sends. A new section carries no id and no version. */
export type InfoSectionInput = Key & {
  sectionId?: string;
  expectedVersion?: number;
  title: string;
  body: string;
  owningGroupName?: string;
  seasonMonths?: readonly number[];
  position: number;
};

/** One database function per method (U8). */
export interface InformationApplicationPort {
  list(): Outcome<InfoSectionsModel>;
  update(
    input: InfoSectionInput & { sectionId: string; expectedVersion: number },
  ): Outcome<InfoChangeModel>;
  create(input: InfoSectionInput): Outcome<InfoChangeModel>;
  setHidden(
    input: Key & { sectionId: string; hidden: boolean; expectedVersion: number },
  ): Outcome<InfoChangeModel>;
}

type Command<T> = Readonly<{ scope: Scope }> & T;

/**
 * The information page (BR86, BR87). Every signed-in role reads the visible sections; a coordinator changes the text of
 * their group's sections and a super admin everything, adds sections and hides or restores them. The database decides
 * which fields a caller may change and repeats every check.
 */
export class InformationApplicationFacade {
  private readonly pipeline: FacadePipeline;
  private readonly domain: InformationApplicationPort;

  constructor(pipeline: FacadePipeline, domain: InformationApplicationPort) {
    this.pipeline = pipeline;
    this.domain = domain;
  }

  /** The visible sections in order; a super admin also gets the hidden ones, marked. */
  list(session: SessionContext, scope: Scope): Promise<ApplicationResult<InfoSectionsModel>> {
    return this.pipeline.invoke<InfoSectionsModel>({
      session,
      matrixRowId: "AUTH-INFO",
      action: "read",
      resource: "info",
      scope,
      invoke: () => this.domain.list(),
      project: (model) => Object.freeze(model) as Readonly<InfoSectionsModel>,
    });
  }

  /** Changes a section; the input carries the version the screen saw. */
  update(
    session: SessionContext,
    input: Command<InfoSectionInput & { sectionId: string; expectedVersion: number }>,
  ) {
    return this.command(session, input, "update", () => this.domain.update(withoutScope(input)));
  }

  /** Adds a section (a super admin's act). */
  create(session: SessionContext, input: Command<InfoSectionInput>) {
    return this.command(session, input, "create", () => this.domain.create(withoutScope(input)));
  }

  /** Hides or restores a section (a super admin's act). */
  setHidden(
    session: SessionContext,
    input: Command<Key & { sectionId: string; hidden: boolean; expectedVersion: number }>,
  ) {
    return this.command(session, input, "manage", () => this.domain.setHidden(withoutScope(input)));
  }

  private command(
    session: SessionContext,
    input: Command<Key & { expectedVersion?: number }>,
    action: "create" | "update" | "manage",
    run: () => Outcome<InfoChangeModel>,
  ): Promise<ApplicationResult<InfoChangeModel>> {
    const matrixRowId: AuthorizationMatrixRowId = "AUTH-INFO-EDIT";
    return this.pipeline.invoke<InfoChangeModel>({
      session,
      matrixRowId,
      action,
      resource: "info_section",
      scope: input.scope,
      idempotencyKey: input.idempotencyKey,
      validate: () => keyCheck(input),
      invoke: run,
      project: (model) => Object.freeze({ ...model }),
    });
  }
}

function withoutScope<T extends { scope: Scope }>(input: T): Omit<T, "scope"> {
  const rest: Partial<T> = { ...input };
  delete rest.scope;
  return rest as Omit<T, "scope">;
}

function keyCheck(input: Key & { expectedVersion?: number }) {
  if (input.expectedVersion === undefined) return validateIdempotencyKey(input.idempotencyKey);
  const checked = validateMutationContext({
    idempotencyKey: input.idempotencyKey,
    expectedVersion: input.expectedVersion,
  });
  return checked.state === "validation" ? checked : undefined;
}
