"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function FocusedStateSection({
  id,
  testId,
  focusTarget,
  children,
}: Readonly<{ id: string; testId: string; focusTarget?: string; children: ReactNode }>) {
  const sectionRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const target = focusTarget ? document.querySelector<HTMLElement>(focusTarget) : null;
    (target ?? sectionRef.current)?.focus();
  }, [focusTarget]);
  return (
    <section
      ref={sectionRef}
      id={id}
      className="teacher-state teacher-state-error"
      role="alert"
      aria-live="assertive"
      tabIndex={-1}
      data-testid={testId}
    >
      {children}
    </section>
  );
}
