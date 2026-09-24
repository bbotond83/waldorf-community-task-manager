"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function FocusedStateSection({
  id,
  testId,
  children,
}: Readonly<{ id: string; testId: string; children: ReactNode }>) {
  const sectionRef = useRef<HTMLElement>(null);
  useEffect(() => sectionRef.current?.focus(), []);
  return (
    <section
      ref={sectionRef}
      id={id}
      className="staff-state staff-state-error"
      role="alert"
      aria-live="assertive"
      tabIndex={-1}
      data-testid={testId}
    >
      {children}
    </section>
  );
}
