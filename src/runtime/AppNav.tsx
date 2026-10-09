"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavigationItem } from "../application/index.ts";

/**
 * The page a menu item stands for: the item whose address is the current path or, failing that,
 * the longest item address that contains the current path (so a detail page keeps its section
 * marked). The dashboard address "/admin" only matches itself.
 */
export function currentNavigationId(
  items: readonly NavigationItem[],
  pathname: string | null,
): string | undefined {
  if (!pathname) return undefined;
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const exact = items.find((item) => item.href === path);
  if (exact) return exact.id;
  return items
    .filter((item) => item.href !== "/admin" && path.startsWith(`${item.href}/`))
    .sort((first, second) => second.href.length - first.href.length)[0]?.id;
}

export function AppNav({ items }: Readonly<{ items: readonly NavigationItem[] }>) {
  const pathname = usePathname();
  const currentId = currentNavigationId(items, pathname);
  return (
    <details className="navigation-panel" open>
      <summary data-testid="app-shell-navigation-toggle">Navigáció</summary>
      <nav aria-label="Fő navigáció" data-testid="app-shell-navigation">
        <ul>
          {items.map((item) => (
            <li key={item.id}>
              <Link
                className="nav-button"
                href={item.href}
                aria-current={item.id === currentId ? "page" : undefined}
                data-testid={`app-shell-navigation-${item.id}`}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </details>
  );
}
