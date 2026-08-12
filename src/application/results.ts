import type {
  AnnouncementMode,
  ApplicationResult,
  PresentationCode,
  RetryMetadata,
} from "./contracts.ts";

type ResultOptions = Readonly<{
  code: string;
  presentationCode: PresentationCode;
  focusTarget?: string;
  announcement?: AnnouncementMode;
}>;

function base(options: ResultOptions) {
  return {
    code: options.code,
    presentationCode: options.presentationCode,
    focusTarget: options.focusTarget ?? "#fo-tartalom",
    announcement: options.announcement ?? "polite",
  } as const;
}

export function success<T>(
  data: T,
  code = "SUCCESS",
): Extract<ApplicationResult<T>, { state: "success" }> {
  return { state: "success", data, ...base({ code, presentationCode: "APP-SUCCESS" }) };
}

export function empty<T = never>(
  code = "EMPTY",
): Extract<ApplicationResult<T>, { state: "empty" }> {
  return { state: "empty", ...base({ code, presentationCode: "APP-EMPTY" }) };
}

export function validation<T = never>(
  fieldErrors: Readonly<Record<string, string>>,
  code = "VALIDATION_FAILED",
): Extract<ApplicationResult<T>, { state: "validation" }> {
  return {
    state: "validation",
    fieldErrors: Object.freeze({ ...fieldErrors }),
    ...base({
      code,
      presentationCode: "APP-VALIDATION",
      focusTarget: "#hibajelzes",
      announcement: "assertive",
    }),
  };
}

export function denied<T = never>(
  code = "AUTHORIZATION_DENIED",
): Extract<ApplicationResult<T>, { state: "denied" }> {
  return {
    state: "denied",
    ...base({
      code,
      presentationCode: "APP-DENIED",
      focusTarget: "#hozzaferes-megtagadva",
      announcement: "assertive",
    }),
  };
}

export function conflict<T = never>(
  code = "STATE_CONFLICT",
): Extract<ApplicationResult<T>, { state: "conflict" }> {
  return {
    state: "conflict",
    ...base({ code, presentationCode: "APP-CONFLICT", announcement: "assertive" }),
  };
}

export function invalidated<T = never>(
  code = "STATE_INVALIDATED",
): Extract<ApplicationResult<T>, { state: "invalidated" }> {
  return {
    state: "invalidated",
    ...base({ code, presentationCode: "APP-INVALIDATED", announcement: "assertive" }),
  };
}

export function retryableFailure<T = never>(
  retry: RetryMetadata,
  code = "DEPENDENCY_RETRYABLE",
): Extract<ApplicationResult<T>, { state: "dependency-failure-retryable" }> {
  return {
    state: "dependency-failure-retryable",
    retry: Object.freeze({ ...retry }),
    ...base({ code, presentationCode: "APP-DEPENDENCY-RETRYABLE", announcement: "assertive" }),
  };
}

export function terminalFailure<T = never>(
  code = "DEPENDENCY_TERMINAL",
): Extract<ApplicationResult<T>, { state: "dependency-failure-terminal" }> {
  return {
    state: "dependency-failure-terminal",
    ...base({ code, presentationCode: "APP-DEPENDENCY-TERMINAL", announcement: "assertive" }),
  };
}

export function mapUnexpectedFailure<T>(
  error: unknown,
  retry: RetryMetadata,
  classifier: (error: unknown) => "retryable" | "terminal" = () => "terminal",
): ApplicationResult<T> {
  return classifier(error) === "retryable"
    ? retryableFailure(retry)
    : terminalFailure("UNEXPECTED_DEPENDENCY_FAILURE");
}
