const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** A book address part counts only when it is a UUID; anything else is never sent to the database. */
export function isLibraryId(value: string | undefined): value is string {
  return value !== undefined && UUID.test(value);
}
