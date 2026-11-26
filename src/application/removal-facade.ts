import type { Scope } from "../access/index.ts";
import type {
  ApplicationResult,
  FlaggedItemListModel,
  RemovalPreviewModel,
  RemovalSubjectModel,
  SessionContext,
} from "./contracts.ts";
import type { DomainOutcome, FacadePipeline } from "./facade-pipeline.ts";

/** The database answers behind the two reads of a removal (U14). */
export interface RemovalApplicationPort {
  preview(subject: RemovalSubjectModel): Promise<DomainOutcome<RemovalPreviewModel>>;
  flaggedItems(subject: RemovalSubjectModel): Promise<DomainOutcome<FlaggedItemListModel>>;
}

/**
 * What a removal would do, and what it left for an administrator. Both are a super admin's alone, and the database
 * checks it again (BR200.1). The removal commands stay where they were: a parent in the directory facade, a family in
 * the admin facade, where it is the archive of a family record.
 */
export class RemovalApplicationFacade {
  private readonly pipeline: FacadePipeline;
  private readonly domain: RemovalApplicationPort;

  constructor(pipeline: FacadePipeline, domain: RemovalApplicationPort) {
    this.pipeline = pipeline;
    this.domain = domain;
  }

  preview(
    session: SessionContext,
    scope: Scope,
    subject: RemovalSubjectModel,
  ): Promise<ApplicationResult<RemovalPreviewModel>> {
    return this.read(session, scope, () => this.domain.preview(subject));
  }

  flaggedItems(
    session: SessionContext,
    scope: Scope,
    subject: RemovalSubjectModel,
  ): Promise<ApplicationResult<FlaggedItemListModel>> {
    return this.read(session, scope, () => this.domain.flaggedItems(subject));
  }

  private read<T>(
    session: SessionContext,
    scope: Scope,
    invoke: () => Promise<DomainOutcome<T>>,
  ): Promise<ApplicationResult<T>> {
    return this.pipeline.invoke<T>({
      session,
      matrixRowId: "AUTH-SUPER-ADMIN",
      action: "read",
      resource: "removal",
      scope,
      invoke,
      project: (model) => model,
    });
  }
}
