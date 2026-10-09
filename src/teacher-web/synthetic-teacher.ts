import type { Scope } from "../access/index.ts";
import {
  FacadePipeline,
  TeacherApplicationFacade,
  type AuthorizationContract,
  type DomainOutcome,
} from "../application/index.ts";
import {
  isTrackingSource,
  matchesTrackingScope,
  type TrackingSourceRecord,
  type TeacherScheduleRepository,
} from "../teacher-tracking/index.ts";
import {
  createSyntheticTeacherRepository,
  TEACHER_FIXTURE_VERSION,
  type TeacherFixtureScenario,
} from "./synthetic-teacher-repository.ts";
class SyntheticTeacherDependencyError extends Error {
  readonly classification: "retryable" | "terminal";
  constructor(classification: "retryable" | "terminal") {
    super("Synthetic teacher dependency failure");
    this.classification = classification;
  }
}
export class SyntheticTeacherScheduleAdapter {
  readonly fixtureVersion = TEACHER_FIXTURE_VERSION;
  private readonly repository: TeacherScheduleRepository;
  private readonly scenario: TeacherFixtureScenario;
  constructor(
    repository: TeacherScheduleRepository = createSyntheticTeacherRepository().repository,
    scenario: TeacherFixtureScenario = "ready",
  ) {
    this.repository = repository;
    this.scenario = scenario;
  }
  async getSchedule(input: {
    actorId: string;
    groupScope: Scope;
    from: string;
    to: string;
  }): Promise<DomainOutcome<{ entries: readonly TrackingSourceRecord[] }>> {
    if (this.scenario === "retryable" || this.scenario === "terminal")
      throw new SyntheticTeacherDependencyError(this.scenario);
    if (this.scenario === "denied") return { state: "denied" };
    if (this.scenario === "empty") return { state: "empty" };
    const entries = await this.repository.readCurrent(input);
    if (!Array.isArray(entries) || !entries.every(isTrackingSource))
      throw new Error("Invalid tracking source");
    if (!entries.every((row) => matchesTrackingScope(row, input.groupScope)))
      return { state: "denied" };
    if (new Set(entries.map((row) => row.id)).size !== entries.length)
      throw new Error("Duplicate tracking identity");
    return entries.length
      ? { state: "success", data: Object.freeze({ entries: Object.freeze([...entries]) }) }
      : { state: "empty" };
  }
}
export function createSyntheticTeacherFacade(
  authorization: AuthorizationContract,
  scenario: TeacherFixtureScenario = "ready",
  repository: TeacherScheduleRepository = createSyntheticTeacherRepository().repository,
): TeacherApplicationFacade {
  const classifier = (error: unknown): "retryable" | "terminal" =>
    error instanceof SyntheticTeacherDependencyError ? error.classification : "terminal";
  return new TeacherApplicationFacade(
    new FacadePipeline(authorization, classifier),
    new SyntheticTeacherScheduleAdapter(repository, scenario),
  );
}
