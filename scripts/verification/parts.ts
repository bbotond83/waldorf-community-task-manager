/**
 * How the verification pipeline is split into parts that CI runs at the same time. `npm run verify:local` without
 * VERIFY_PART still runs every step in order on one machine. With VERIFY_PART, one part runs its steps and records
 * what it did; `combine` then checks that every part passed on the same commit before the evidence report is built.
 */
export const PART_NAMES = ["checks", "database-shuffled", "browser"] as const;
export type PartName = (typeof PART_NAMES)[number];
export type VerifyMode = "all" | "combine" | PartName;

export type Command = { key: string; args: readonly string[] };
export type StepResult = {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  log: string;
};
export type PartResult = {
  id: string;
  gitSha: string;
  browserProjects: string[];
  steps: Record<string, StepResult>;
};

/** Steps with a part of their own. Every other step, including any added later, belongs to `checks`. */
const SEPARATE_STEPS: readonly string[] = ["database-shuffled", "browser"];

export function verifyMode(value: string | undefined): VerifyMode {
  if (!value) return "all";
  if (value === "combine" || (PART_NAMES as readonly string[]).includes(value))
    return value as VerifyMode;
  throw new Error(`VERIFY_PART_UNKNOWN: "${value}"`);
}

export function partId(part: PartName, browserProjects: readonly string[]): string {
  return part === "browser" ? `browser-${browserProjects[0]}` : part;
}

/** The steps one part runs, in order. A part runs on a fresh machine, so it prepares its own database and build. */
export function planPart(
  commands: readonly Command[],
  part: PartName,
  browserProjects: readonly string[],
  schemaFor: (project: string) => string,
): Command[] {
  const pick = (...keys: string[]) =>
    keys.map((key) => {
      const command = commands.find((entry) => entry.key === key);
      if (!command) throw new Error(`VERIFY_PART_STEP_MISSING: ${key}`);
      return command;
    });
  if (part === "checks") return commands.filter(({ key }) => !SEPARATE_STEPS.includes(key));
  if (part === "database-shuffled")
    return pick("toolchain", "database-migrate", "database-shuffled");
  if (browserProjects.length !== 1)
    throw new Error("VERIFY_PART_BROWSER: set VERIFY_BROWSER_PROJECTS to exactly one project");
  // The browser specs reset and seed their project's schema, which therefore has to exist already.
  return [
    ...pick("toolchain", "database-migrate"),
    {
      key: "database-migrate-worker",
      args: ["run", "db:migrate", "--", "--schema", schemaFor(browserProjects[0]!)],
    },
    ...pick("build", "browser"),
  ];
}

export type Combined = {
  steps: Map<string, StepResult>;
  /** The browser step of every browser part, in project order. */
  browserRuns: StepResult[];
};

/**
 * Joins the results of the parts. It refuses unless there is exactly one result for `checks`, for the shuffled run
 * and for each browser project, all from the tested commit, each holding every step its part has to run.
 */
export function combineParts(input: {
  results: readonly PartResult[];
  commands: readonly Command[];
  gitSha: string;
  allBrowserProjects: readonly string[];
  schemaFor: (project: string) => string;
}): Combined {
  const expected: [PartName, string[]][] = [
    ["checks", []],
    ["database-shuffled", []],
    ...input.allBrowserProjects.map((name): [PartName, string[]] => ["browser", [name]]),
  ];
  const expectedIds = expected.map(([part, projects]) => partId(part, projects));
  const foundIds = input.results.map(({ id }) => id).sort();
  if (foundIds.join() !== [...expectedIds].sort().join())
    throw new Error(
      `VERIFY_PARTS_INCOMPLETE: expected ${expectedIds.join(", ")}; found ${foundIds.join(", ") || "none"}`,
    );
  const steps = new Map<string, StepResult>();
  const browserRuns: StepResult[] = [];
  for (const [part, projects] of expected) {
    const id = partId(part, projects);
    const result = input.results.find((entry) => entry.id === id)!;
    if (result.gitSha !== input.gitSha)
      throw new Error(`VERIFY_PART_SHA: ${id} tested a different commit`);
    if (part === "browser" && result.browserProjects.join() !== projects.join())
      throw new Error(`VERIFY_PART_BROWSER: ${id} ran ${result.browserProjects.join(", ")}`);
    for (const { key } of planPart(input.commands, part, projects, input.schemaFor)) {
      const row = result.steps[key];
      if (!row) throw new Error(`VERIFY_PART_STEP_MISSING: ${id} has no result for ${key}`);
      if (key === "browser") browserRuns.push(row);
      // A step that several parts repeat to prepare themselves is reported from the first of them.
      else if (!steps.has(key)) steps.set(key, row);
    }
  }
  return { steps, browserRuns };
}

/** One row for the browser phase that ran as separate parts. */
export function mergeBrowserRuns(runs: readonly StepResult[], log: string): StepResult {
  return {
    startedAt: runs.map(({ startedAt }) => startedAt).sort()[0]!,
    finishedAt: runs
      .map(({ finishedAt }) => finishedAt)
      .sort()
      .at(-1)!,
    durationMs: runs.reduce((sum, row) => sum + row.durationMs, 0),
    log,
  };
}
