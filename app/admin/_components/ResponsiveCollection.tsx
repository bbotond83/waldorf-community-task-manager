import Link from "next/link";
import type { AdminItemModel } from "../../../src/application/index.ts";
import { statusLabel } from "../../../src/application/status-labels.ts";

/** Each item is one link (title and Hungarian state) that opens the item anywhere on the card. */
export function ResponsiveCollection({
  items,
  basePath,
  testId,
}: Readonly<{ items: readonly AdminItemModel[]; basePath: string; testId: string }>) {
  return (
    <ul className="admin-collection" data-testid={testId}>
      {items.map((item) => (
        <li className="admin-card" key={item.id} data-testid={`${testId}-item-${item.id}`}>
          <Link
            className="admin-card-link"
            href={`${basePath}/${encodeURIComponent(item.id)}`}
            data-testid={`${testId}-open-${item.id}`}
          >
            <strong>{item.title}</strong>{" "}
            <span className="admin-state-badge">{statusLabel(item.state)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
