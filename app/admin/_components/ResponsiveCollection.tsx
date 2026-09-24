import Link from "next/link";
import type { AdminItemModel } from "../../../src/application/index.ts";

export function ResponsiveCollection({
  items,
  basePath,
  testId,
}: Readonly<{ items: readonly AdminItemModel[]; basePath: string; testId: string }>) {
  return (
    <ul className="admin-collection" data-testid={testId}>
      {items.map((item) => (
        <li className="admin-card" key={item.id} data-testid={`${testId}-item-${item.id}`}>
          <div>
            <strong>{item.title}</strong>
            <span className="admin-state-badge">{item.state}</span>
          </div>
          <Link
            href={`${basePath}/${encodeURIComponent(item.id)}`}
            data-testid={`${testId}-open-${item.id}`}
          >
            Részletek
          </Link>
        </li>
      ))}
    </ul>
  );
}
