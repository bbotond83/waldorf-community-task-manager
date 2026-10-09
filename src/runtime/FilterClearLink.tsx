"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useTransition, type MouseEvent, type ReactNode } from "react";

/**
 * Empties every field of a filter form (text and date inputs, dropdowns back to their empty first
 * choice) so a value that was typed but never submitted cannot survive a clear.
 */
export function emptyFilterFields(form: HTMLFormElement): void {
  for (const element of Array.from(form.elements)) {
    if (element instanceof HTMLSelectElement) {
      const empty = Array.from(element.options).findIndex((option) => option.value === "");
      element.selectedIndex = empty >= 0 ? empty : 0;
    } else if (
      element instanceof HTMLInputElement &&
      !["hidden", "submit", "button", "reset", "checkbox", "radio"].includes(element.type)
    ) {
      element.value = "";
    }
  }
}

/** Moves focus to the page heading, the app's usual starting point after a page change. */
export function focusPageHeading(): void {
  const heading = document.querySelector<HTMLElement>("main h1") ?? document.querySelector("h1");
  if (!heading) return;
  if (!heading.hasAttribute("tabindex")) heading.setAttribute("tabindex", "-1");
  heading.focus();
}

/**
 * "Szűrők törlése". Without scripts it is a plain link to the unfiltered address. With scripts it
 * also empties the filter form's fields right away, goes to that address and moves focus to the
 * page heading, so the person never sees a stale value or loses their place.
 */
export function FilterClearLink({
  href,
  children,
  className,
  testId,
  formSelector,
}: Readonly<{
  href: string;
  children: ReactNode;
  className?: string;
  testId?: string;
  /** The form to empty; without it the form that holds the link. */
  formSelector?: string;
}>) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending) focusPageHeading();
    wasPending.current = pending;
  }, [pending]);

  function onClick(event: MouseEvent<HTMLAnchorElement>) {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    const form = formSelector
      ? document.querySelector(formSelector)
      : event.currentTarget.closest("form");
    if (form instanceof HTMLFormElement) emptyFilterFields(form);
    event.preventDefault();
    startTransition(() => router.push(href));
    focusPageHeading();
  }

  return (
    <Link href={href} className={className} data-testid={testId} onClick={onClick}>
      {children}
    </Link>
  );
}
