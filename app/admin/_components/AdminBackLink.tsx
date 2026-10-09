import Link from "next/link";

/** The admin lists a detail page or a "new" form can lead back to, with the link wording. */
export const ADMIN_LIST_LINKS = Object.freeze({
  records: { href: "/admin/nyilvantartasok", label: "Vissza a nyilvántartásokhoz" },
  tasks: { href: "/admin/feladatok", label: "Vissza a feladatokhoz és eseményekhez" },
  approvals: { href: "/admin/jovahagyasok", label: "Vissza a jóváhagyásokhoz" },
  archive: { href: "/admin/archivum", label: "Vissza az archívumhoz" },
} as const);

export type AdminListLinkKind = keyof typeof ADMIN_LIST_LINKS;

/** The address parameter that carries the list's filter to a detail page. */
export const LIST_RETURN_PARAMETER = "vissza";

const RETURN_KEYS = ["q", "state"] as const;
const RETURN_MAX_LENGTH = 120;

/**
 * The query a list passes to its detail pages so the back link restores the search and the
 * status filter. Only the known keys of non-empty values are kept; an empty filter gives "".
 */
export function listReturnQuery(filter: Readonly<{ q?: string; state?: string }>): string {
  const params = new URLSearchParams();
  for (const key of RETURN_KEYS) {
    const value = filter[key];
    if (value) params.set(key, value.slice(0, RETURN_MAX_LENGTH));
  }
  return params.toString();
}

function sanitizedReturnQuery(raw: string | undefined): string {
  if (!raw) return "";
  const source = new URLSearchParams(raw);
  return listReturnQuery({ q: source.get("q") ?? "", state: source.get("state") ?? "" });
}

/** The back link of an admin detail page or "new" form, worded for the list it returns to. */
export function AdminBackLink({
  list,
  returnQuery,
  testId = "admin-back-link",
}: Readonly<{ list: AdminListLinkKind; returnQuery?: string; testId?: string }>) {
  const { href, label } = ADMIN_LIST_LINKS[list];
  const query = sanitizedReturnQuery(returnQuery);
  return (
    <Link className="admin-back-link" href={query ? `${href}?${query}` : href} data-testid={testId}>
      {label}
    </Link>
  );
}
