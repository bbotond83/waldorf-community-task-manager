import type { Scope } from "../access/index.ts";
import type {
  ApplicationResult,
  SessionContext,
  WorkingGroupItem,
  WorkingGroupListModel,
} from "./contracts.ts";
import type { DomainOutcome, FacadePipeline } from "./facade-pipeline.ts";

export interface WorkingGroupApplicationPort {
  list(): Promise<DomainOutcome<{ items: readonly WorkingGroupItem[] }>>;
}

/** The working-group list every role reads (BR2.3); each caller names the scope of a right it holds. */
export class WorkingGroupApplicationFacade {
  private readonly pipeline: FacadePipeline;
  private readonly domain: WorkingGroupApplicationPort;

  constructor(pipeline: FacadePipeline, domain: WorkingGroupApplicationPort) {
    this.pipeline = pipeline;
    this.domain = domain;
  }

  list(session: SessionContext, scope: Scope): Promise<ApplicationResult<WorkingGroupListModel>> {
    return this.pipeline.invoke<WorkingGroupListModel>({
      session,
      matrixRowId: "AUTH-WORKING-GROUPS",
      action: "read",
      resource: "working_group",
      scope,
      invoke: () => this.domain.list(),
      project: (model) => Object.freeze({ items: Object.freeze([...model.items]) }),
    });
  }
}
