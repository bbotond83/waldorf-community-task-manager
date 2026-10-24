/**
 * Mapping of unexpected database failures to the retryable or terminal failure the facades know, once at
 * the adapter boundary, without database text reaching a screen (BR32.4). A lost connection or a deadlock is
 * retryable; anything else is terminal. The messages here are fixed words: nothing from the database
 * (statement, row, column or key) is ever copied into an error that could be shown or logged by a caller.
 */
export class RetryableDataFailure extends Error {
  constructor() {
    super("DATA_RETRYABLE");
    this.name = "RetryableDataFailure";
  }
}

export class TerminalDataFailure extends Error {
  readonly reason: "UNEXPECTED_RESPONSE" | "UNEXPECTED_DEPENDENCY_FAILURE";

  constructor(reason: "UNEXPECTED_RESPONSE" | "UNEXPECTED_DEPENDENCY_FAILURE") {
    super(`DATA_TERMINAL:${reason}`);
    this.name = "TerminalDataFailure";
    this.reason = reason;
  }
}

/** The classifier the facade pipeline of the production composition is built with. */
export function classifyDataFailure(error: unknown): "retryable" | "terminal" {
  return error instanceof RetryableDataFailure ? "retryable" : "terminal";
}

/** A response whose shape the adapter does not know is never guessed at: it is a terminal failure. */
export function malformedResponse(): TerminalDataFailure {
  return new TerminalDataFailure("UNEXPECTED_RESPONSE");
}
