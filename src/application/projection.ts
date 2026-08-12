import type { AuthorizedContext } from "./contracts.ts";

const FORBIDDEN_PROPERTY_NAMES = new Set([
  "email",
  "phone",
  "locality",
  "residence",
  "optionalprofile",
  "protectedreason",
  "unrelatedfamily",
  "rawproviderresponse",
  "secret",
  "token",
]);

export class UnsafeProjectionError extends Error {}

export function projectAllowlisted<
  TSource extends Readonly<Record<string, unknown>>,
  const TKeys extends readonly (keyof TSource)[],
>(
  _authorized: AuthorizedContext,
  source: TSource,
  allowedKeys: TKeys,
): Readonly<Pick<TSource, TKeys[number]>> {
  const projected: Partial<Pick<TSource, TKeys[number]>> = {};
  for (const key of allowedKeys) {
    assertSafeProperty(String(key));
    projected[key] = source[key];
  }
  assertNoForbiddenProperties(projected);
  return Object.freeze(projected as Pick<TSource, TKeys[number]>);
}

export function assertNoForbiddenProperties(value: unknown): void {
  if (!value || typeof value !== "object") return;
  for (const [key, nested] of Object.entries(value)) {
    assertSafeProperty(key);
    if (Array.isArray(nested)) nested.forEach(assertNoForbiddenProperties);
    else assertNoForbiddenProperties(nested);
  }
}

function assertSafeProperty(key: string): void {
  const normalized = key.replaceAll(/[-_]/g, "").toLowerCase();
  if (FORBIDDEN_PROPERTY_NAMES.has(normalized)) {
    throw new UnsafeProjectionError("A tiltott mező nem része az alkalmazási nézetnek.");
  }
}
