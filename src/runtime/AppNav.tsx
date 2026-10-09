"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import type { NavigationItem } from "../application/index.ts";

const NOTIFICATION_PARAMETER = "ertesites";
const NOTIFICATION_LIST_HREF = "/szulo/ertesitesek";
const TASK_PAGE = /^\/szulo\/feladatok\/[^/]+$/;

/**
 * The page a menu item stands for: the item whose address is the current path or, failing that,
 * the longest item address that contains the current path (so a detail page keeps its section
 * marked). The dashboard address "/admin" only matches itself.
 *
 * A task page opened from a notification (`openedFromNotification`) stands for the notification
 * list instead, so "Értesítések" stays the current item while the parent reads the task.
 */
export function currentNavigationId(
  items: readonly NavigationItem[],
  pathname: string | null,
  openedFromNotification = false,
): string | undefined {
  if (!pathname) return undefined;
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (openedFromNotification && TASK_PAGE.test(path)) {
    const list = items.find((item) => item.href === NOTIFICATION_LIST_HREF);
    if (list) return list.id;
  }
  const exact = items.find((item) => item.href === path);
  if (exact) return exact.id;
  return items
    .filter((item) => item.href !== "/admin" && path.startsWith(`${item.href}/`))
    .sort((first, second) => second.href.length - first.href.length)[0]?.id;
}

export function AppNav({ items }: Readonly<{ items: readonly NavigationItem[] }>) {
  // Reading the address parameters needs a Suspense boundary; until they are known the menu
  // renders from the path alone.
  return (
    <Suspense fallback={<NavigationPanel items={items} openedFromNotification={false} />}>
      <SearchAwareNavigation items={items} />
    </Suspense>
  );
}

function SearchAwareNavigation({ items }: Readonly<{ items: readonly NavigationItem[] }>) {
  const searchParams = useSearchParams();
  const openedFromNotification = Boolean(searchParams?.get(NOTIFICATION_PARAMETER));
  return <NavigationPanel items={items} openedFromNotification={openedFromNotification} />;
}

function NavigationPanel({
  items,
  openedFromNotification,
}: Readonly<{ items: readonly NavigationItem[]; openedFromNotification: boolean }>) {
  const pathname = usePathname();
  const currentId = currentNavigationId(items, pathname, openedFromNotification);
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
