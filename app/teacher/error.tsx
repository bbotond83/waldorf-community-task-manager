"use client";

import { useEffect, useRef } from "react";

export default function TeacherError({ reset }: Readonly<{ error: Error; reset: () => void }>) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), []);
  return (
    <section
      className="teacher-page teacher-state teacher-state-error"
      role="alert"
      data-testid="teacher-route-error"
    >
      <h1 ref={headingRef} tabIndex={-1}>
        Hiba történt
      </h1>
      <p>A beosztás most nem tölthető be. Próbálja meg később.</p>
      <button type="button" onClick={reset} data-testid="teacher-route-error-retry-button">
        Újrapróbálás
      </button>
    </section>
  );
}
