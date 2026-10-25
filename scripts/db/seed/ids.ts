import { createHash } from "node:crypto";

/**
 * Deterministic identifiers of the seed (NFR2.31, NFR3.18). Every record and account of a seeded schema has an id that
 * is derived from the schema name and the record's key with a fixed namespace (an RFC 4122 version 5 uuid), so
 *
 * - a second seed of the same schema writes the same ids and changes nothing,
 * - a reset followed by a seed equals a fresh seed,
 * - the same key gives different ids in different schemas (the sign-in service is shared by every schema, so two schemas
 *   must never share an account id), and
 * - tests can name a record without reading the database.
 *
 * This module is used by tooling and tests only; the production runtime never imports it (NFR1.64).
 */
export const SEED_NAMESPACE = "6b1f4c0e-3a52-4d6e-9f0a-5d2c8e7a1b34";

/** A version 5 uuid of `name` in `namespace` (SHA-1, as RFC 4122 section 4.3 defines). */
export function uuidV5(name: string, namespace: string = SEED_NAMESPACE): string {
  const hash = createHash("sha1")
    .update(Buffer.from(namespace.replace(/-/g, ""), "hex"))
    .update(name, "utf8")
    .digest();
  hash[6] = (hash[6]! & 0x0f) | 0x50;
  hash[8] = (hash[8]! & 0x3f) | 0x80;
  const hex = hash.subarray(0, 16).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/** The id of the record `key` in `schema`, for example `seedId("worker_1", "family:3")`. */
export function seedId(schema: string, key: string): string {
  return uuidV5(`${schema}:${key}`);
}

/**
 * The sign-in address of the seeded account `tag` in `schema`. It starts with `<schema>.`, the prefix that
 * `db:worker` and the reset remove, so a reset of one schema never removes another schema's accounts.
 */
export function seedEmail(schema: string, tag: string): string {
  return `${schema}.${tag}@example.test`;
}
