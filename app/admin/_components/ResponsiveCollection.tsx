import Link from "next/link";
import type { AdminItemModel } from "../../../src/application/index.ts";
import { statusDisplay } from "../../../src/application/status-labels.ts";
import { StatusBadge } from "../../../src/runtime/StatusBadge.tsx";
import { LIST_RETURN_PARAMETER } from "./AdminBackLink.tsx";

/**
 * Each item is one link (title and Hungarian state) that opens the item anywhere on the card.
 * With `returnQuery` (the list's search and status filter) the link carries it, so the detail
 * page's back link can return to the same filtered list.
 */
export function ResponsiveCollection({
  items,
  basePath,
  testId,
  returnQuery = "",
}: Readonly<{
  items: readonly AdminItemModel[];
  basePath: string;
  testId: string;
  returnQuery?: string;
}>) {
  return (
    <ul className="admin-collection" data-testid={testId}>
      {items.map((item) => (
        <li className="admin-card" key={item.id} data-testid={`${testId}-item-${item.id}`}>
          <Link
            className="admin-card-link"
            href={`${basePath}/${encodeURIComponent(item.id)}${
              returnQuery ? `?${LIST_RETURN_PARAMETER}=${encodeURIComponent(returnQuery)}` : ""
            }`}
            data-testid={`${testId}-open-${item.id}`}
          >
            <strong>{item.title}</strong>{" "}
            <StatusBadge className="admin-state-badge" {...statusDisplay(item.state)} />
          </Link>
        </li>
      ))}
    </ul>
  );
}
