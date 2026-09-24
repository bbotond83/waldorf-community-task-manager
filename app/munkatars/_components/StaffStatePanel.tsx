import type { ReactNode } from "react";
import Link from "next/link";
import type { ApplicationResult } from "../../../src/application/index.ts";
import { FocusedStateSection } from "./FocusedStateSection.tsx";

export function StaffStatePanel<T>({
  result,
  retryHref,
  clearHref = "/munkatars/beosztas",
  testId,
  children,
}: Readonly<{
  result: ApplicationResult<T>;
  retryHref: string;
  clearHref?: string;
  testId: string;
  children: (data: T) => ReactNode;
}>) {
  if (result.state === "success" || result.state === "recovery") {
    return <div data-testid={testId}>{children(result.data)}</div>;
  }
  if (result.state === "empty") {
    return (
      <section
        className="staff-state"
        role="status"
        aria-live="polite"
        data-testid={`${testId}-empty`}
      >
        <h2>Nincs találat</h2>
        <p>A megadott szűrők mellett nincs megjeleníthető beosztás.</p>
        <Link href={clearHref} data-testid={`${testId}-clear-link`}>
          Szűrők törlése
        </Link>
      </section>
    );
  }

  const isValidation = result.state === "validation";
  const isDenied = result.state === "denied" || result.state === "invalidated";
  const isRetryable = result.state === "dependency-failure-retryable";
  const heading = isValidation
    ? "Érvénytelen szűrés"
    : isDenied
      ? "Nincs jogosultság"
      : "Hiba történt";
  const message = isValidation
    ? "A kezdő és záró dátum érvényes, legfeljebb 31 napos tartomány legyen."
    : isDenied
      ? "A kért tartalom nem érhető el."
      : isRetryable
        ? "Átmeneti hiba történt. A beosztás biztonságosan újrapróbálható."
        : "A beosztás most nem tölthető be. Próbálja meg később.";

  return (
    <FocusedStateSection
      id={isDenied ? "hozzaferes-megtagadva" : isValidation ? "hibajelzes" : "staff-hiba"}
      testId={`${testId}-${result.state}`}
    >
      <h2>{heading}</h2>
      <p>{message}</p>
      {isRetryable && (
        <Link href={retryHref} data-testid={`${testId}-retry-link`}>
          Újrapróbálás
        </Link>
      )}
    </FocusedStateSection>
  );
}
