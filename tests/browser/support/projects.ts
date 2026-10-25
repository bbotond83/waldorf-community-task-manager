/**
 * Which database schema and which server port each browser project owns. A browser project never shares a schema
 * with another one, so the three browsers can be run one after the other (or one at a time) without touching each
 * other's data (NFR3.20, NFR2.33). The schemas are the worker schemas the database tests use; the browser phase runs
 * after them, never at the same time.
 */
export const BROWSER_PROJECTS = [
  { name: "chromium", schema: "worker_1", portOffset: 0 },
  { name: "firefox", schema: "worker_2", portOffset: 1 },
  { name: "mobile-chrome", schema: "worker_3", portOffset: 2 },
] as const;

export type BrowserProjectName = (typeof BROWSER_PROJECTS)[number]["name"];

/** The schema of a browser project; an unknown project name is a configuration error, never a silent default. */
export function schemaForProject(projectName: string): string {
  const project = BROWSER_PROJECTS.find((entry) => entry.name === projectName);
  if (!project) throw new Error(`BROWSER_PROJECT_UNKNOWN: no schema is mapped to "${projectName}"`);
  return project.schema;
}
