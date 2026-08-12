import type { ReactNode } from "react";
import type { ApplicationResult } from "../../../src/application/index.ts";

type AsyncStatePanelProps<T> = Readonly<{
  result: ApplicationResult<T>;
  testId: string;
  emptyMessage: string;
  children: (data: T) => ReactNode;
}>;

export function AsyncStatePanel<T>({
  result,
  testId,
  emptyMessage,
  children,
}: AsyncStatePanelProps<T>) {
  switch (result.state) {
    case "success":
    case "recovery":
      return <div data-testid={testId}>{children(result.data)}</div>;
    case "empty":
      return <p data-testid={`${testId}-empty`}>{emptyMessage}</p>;
    case "loading":
    case "initial":
    case "pending":
      return <p data-testid={`${testId}-loading`}>Betöltés folyamatban</p>;
    case "validation":
      return <p data-testid={`${testId}-validation`}>Ellenőrizze a megadott adatokat.</p>;
    case "denied":
      return <p data-testid={`${testId}-denied`}>Nincs jogosultság</p>;
    case "conflict":
      return <p data-testid={`${testId}-conflict`}>Az adatok időközben megváltoztak.</p>;
    case "invalidated":
      return <p data-testid={`${testId}-invalidated`}>A művelet már nem érvényes.</p>;
    case "dependency-failure-retryable":
      return (
        <p data-testid={`${testId}-retryable`}>Átmeneti hiba történt. A művelet újrapróbálható.</p>
      );
    case "dependency-failure-terminal":
      return <p data-testid={`${testId}-terminal`}>Hiba történt. A művelet nem ismételhető meg.</p>;
  }
}
