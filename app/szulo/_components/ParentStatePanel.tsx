import type { ApplicationResult } from "../../../src/application/index.ts";

export function ParentStatePanel<T>({
  result,
  emptyMessage,
  testId,
  children,
}: Readonly<{
  result: ApplicationResult<T>;
  emptyMessage: string;
  testId: string;
  children: (data: T) => React.ReactNode;
}>) {
  if (result.state === "success" || result.state === "recovery") {
    return <div data-testid={testId}>{children(result.data)}</div>;
  }
  const messages: Partial<Record<typeof result.state, string>> = {
    empty: emptyMessage,
    denied: "A kért tartalom nem érhető el.",
    invalidated: "A jogosultság vagy az adat időközben megváltozott.",
    "dependency-failure-retryable": "Átmeneti hiba történt. Próbálja újra.",
    "dependency-failure-terminal": "Hiba történt.",
    conflict: "Az aktuális állapot miatt a tartalom nem használható.",
  };
  const message = messages[result.state] ?? "Betöltés folyamatban";
  const isError = [
    "denied",
    "invalidated",
    "dependency-failure-retryable",
    "dependency-failure-terminal",
    "conflict",
  ].includes(result.state);
  return (
    <section
      id={isError ? "hozzaferes-megtagadva" : undefined}
      className="parent-state"
      role={isError ? "alert" : "status"}
      aria-live={isError ? "assertive" : "polite"}
      tabIndex={-1}
      data-testid={`${testId}-${result.state}`}
    >
      <h2>{isError ? "Hiba történt" : "Nincs megjeleníthető elem"}</h2>
      <p>{message}</p>
    </section>
  );
}
