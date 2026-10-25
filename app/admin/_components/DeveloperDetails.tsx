import type { ReactNode } from "react";

/**
 * Technical material for developers and tests (version numbers, correlation ids). It sits in one collapsed section at the bottom of a page, so normal screens show
 * no technical text. The fields inside keep their names and test ids; the section only hides
 * them until it is opened.
 */
export function DeveloperDetails({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <details className="developer-details" data-testid="developer-details">
      <summary data-testid="developer-details-toggle">Fejlesztői részletek</summary>
      <div className="developer-details-body">{children}</div>
    </details>
  );
}
