/**
 * The seed module (U5): the data, the deterministic ids, the sign-in accounts and the writer of the seed. Used by the
 * `db:seed` and `db:reset` commands and by database and browser tests. The production runtime never imports it and the
 * browser bundle never contains it (NFR1.64, NFR1.66); tests prove both.
 *
 * Two rules hold for everything the seed and the reset do:
 *
 * - The database is reached only through the owner connection of `DATABASE_URL` (`connectLocalStack` in
 *   `local-guard.ts`, after the loopback and identity checks). The data service connection that the application and
 *   its tests use is never used to write the seed or to truncate; the sign-in service is called only to create and
 *   remove sign-in users (`accounts.ts`).
 * - The address of a seeded sign-in user is `<schema>.<tag>@example.test`, the same namespace `db:worker` uses
 *   (`workerAccountEmail` in `worker.ts`), so a reset or a worker reset of one schema removes exactly the accounts
 *   with its prefix and no other schema's.
 */
export * from "./accounts.ts";
export * from "./data.ts";
export * from "./ids.ts";
export * from "./write.ts";
