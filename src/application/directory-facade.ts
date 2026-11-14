import type { Scope } from "../access/index.ts";
import type {
  ApplicationResult,
  DirectoryModel,
  OwnProfileModel,
  ProfileFields,
  RemovedParentModel,
  SessionContext,
  VersionModel,
} from "./contracts.ts";
import type { DomainOutcome, FacadePipeline } from "./facade-pipeline.ts";
import { validateMutationContext } from "./validation.ts";

/** The database answers behind the directory, the parent's own profile and the removal of a parent (U3). */
export interface DirectoryApplicationPort {
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
  removeParent(input: {
    idempotencyKey: string;
    parentId: string;
    expectedVersion: number;
  }): Promise<DomainOutcome<RemovedParentModel>>;
}

type Command = Readonly<{ idempotencyKey: string; expectedVersion: number }>;

/**
 * The parent directory (every signed-in role reads it; the database decides which fields come back), the parent's
 * own details and sharing choice (the parent themself only), and the removal of a parent (a super admin only). The
 * rows of the authorization matrix are the ones the access policy already holds for each.
 */
export class DirectoryApplicationFacade {
  private readonly pipeline: FacadePipeline;
  private readonly domain: DirectoryApplicationPort;

  constructor(pipeline: FacadePipeline, domain: DirectoryApplicationPort) {
    this.pipeline = pipeline;
    this.domain = domain;
  }

  list(session: SessionContext, scope: Scope): Promise<ApplicationResult<DirectoryModel>> {
    return this.pipeline.invoke<DirectoryModel>({
      session,
      matrixRowId: "AUTH-DIRECTORY",
      action: "read",
      resource: "directory",
      scope,
      invoke: () => this.domain.list(),
      project: (model) => Object.freeze({ families: Object.freeze([...model.families]) }),
    });
  }

  ownProfile(
    session: SessionContext,
    scope: Scope,
    parentId: string,
  ): Promise<ApplicationResult<OwnProfileModel>> {
    return this.pipeline.invoke<OwnProfileModel>({
      session,
      matrixRowId: "AUTH-PARENT-ACCOUNT",
      action: "read",
      resource: "own_profile",
      scope,
      invoke: async () => {
        const profile = await this.domain.ownProfile(parentId);
        return profile ? { state: "success", data: profile } : { state: "denied" };
      },
      project: (model) => Object.freeze({ ...model }),
    });
  }

  setSharing(
    session: SessionContext,
    input: Command & { scope: Scope; parentId: string; sharing: boolean },
  ): Promise<ApplicationResult<VersionModel>> {
    return this.command(session, input, "own_profile", (context) =>
      this.domain.setSharing({
        ...context,
        parentId: input.parentId,
        sharing: input.sharing,
      }),
    );
  }

  updateOwnProfile(
    session: SessionContext,
    input: Command & { scope: Scope; parentId: string; fields: ProfileFields },
  ): Promise<ApplicationResult<VersionModel>> {
    return this.command(session, input, "own_profile", (context) =>
      this.domain.updateOwnProfile({ ...context, parentId: input.parentId, fields: input.fields }),
    );
  }

  /** The person's account id comes back so the server can end the sign-in after the commit (BR36.3). */
  removeParent(
    session: SessionContext,
    input: Command & { scope: Scope; parentId: string },
  ): Promise<ApplicationResult<RemovedParentModel>> {
    return this.pipeline.invoke<RemovedParentModel>({
      session,
      matrixRowId: "AUTH-SUPER-ADMIN",
      action: "delete",
      resource: "record",
      scope: input.scope,
      idempotencyKey: input.idempotencyKey,
      validate: () => validateContext(input),
      invoke: () =>
        this.domain.removeParent({
          idempotencyKey: input.idempotencyKey,
          parentId: input.parentId,
          expectedVersion: input.expectedVersion,
        }),
      project: (model) => Object.freeze({ ...model }),
    });
  }

  private command(
    session: SessionContext,
    input: Command & { scope: Scope },
    resource: "own_profile",
    run: (context: Command) => Promise<DomainOutcome<VersionModel>>,
  ): Promise<ApplicationResult<VersionModel>> {
    return this.pipeline.invoke<VersionModel>({
      session,
      matrixRowId: "AUTH-PARENT-ACCOUNT",
      action: "update",
      resource,
      scope: input.scope,
      idempotencyKey: input.idempotencyKey,
      validate: () => validateContext(input),
      invoke: () =>
        run({ idempotencyKey: input.idempotencyKey, expectedVersion: input.expectedVersion }),
      project: (model) => Object.freeze({ ...model }),
    });
  }
}

function validateContext(input: Command) {
  const checked = validateMutationContext(input);
  return checked.state === "validation" ? checked : undefined;
}
