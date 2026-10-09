import type { ReactNode } from "react";
import type { StatusIconKey, StatusSymbol } from "../application/status-labels.ts";

/**
 * Vector drawings of the status symbols (16 by 16, `currentColor`). The same keys also exist as
 * plain characters (`STATUS_ICON_CHARACTERS`) for native dropdown options.
 */
const ICON_SHAPES: Readonly<Record<StatusIconKey, ReactNode>> = {
  check: <path d="M3 8.5l3.2 3.2L13 4.8" />,
  cross: <path d="M4 4l8 8M12 4l-8 8" />,
  clock: (
    <>
      <circle cx="8" cy="8" r="5.5" />
      <path d="M8 4.8V8l2.4 1.4" />
    </>
  ),
  dot: <circle cx="8" cy="8" r="4" fill="currentColor" stroke="none" />,
  ring: <circle cx="8" cy="8" r="4.5" />,
  half: (
    <>
      <circle cx="8" cy="8" r="5.5" />
      <path d="M8 2.5a5.5 5.5 0 0 1 0 11z" fill="currentColor" />
    </>
  ),
  square: <rect x="3.5" y="3.5" width="9" height="9" rx="1" fill="currentColor" stroke="none" />,
  diamond: <path d="M8 2.2L13.8 8 8 13.8 2.2 8z" fill="currentColor" stroke="none" />,
  calendar: (
    <>
      <rect x="2.5" y="3.5" width="11" height="10" rx="1.5" />
      <path d="M2.5 6.8h11M5.5 2v3M10.5 2v3" />
    </>
  ),
  pencil: <path d="M3 13l.8-3L10.6 3.2a1.4 1.4 0 0 1 2 0l.2.2a1.4 1.4 0 0 1 0 2L6 12.2z" />,
  arrow: <path d="M2.5 8h10.5M9.3 4.5L12.8 8l-3.5 3.5" />,
  retry: <path d="M13 8a5 5 0 1 1-1.6-3.7M13 2.6v3h-3" />,
  undo: <path d="M3 8a5 5 0 1 0 1.6-3.7M3 2.6v3h3" />,
  warning: <path d="M8 2.6L14 13H2zM8 6.6v3M8 11.3v.01" />,
  block: (
    <>
      <circle cx="8" cy="8" r="5.5" />
      <path d="M4.1 11.9l7.8-7.8" />
    </>
  ),
  pause: <path d="M6 3.5v9M10 3.5v9" />,
  unknown: (
    <>
      <circle cx="8" cy="8" r="5.5" />
      <path d="M6.3 6.4a1.8 1.8 0 1 1 2.7 1.5c-.7.4-1 .8-1 1.5M8 11.4v.01" />
    </>
  ),
};

type Tone = "positive" | "negative" | "pending" | "neutral";

/** The icon colour (never the word's colour) follows the meaning: done, failed, waiting. */
function toneOf(icon: StatusIconKey): Tone {
  if (icon === "check") return "positive";
  if (icon === "cross" || icon === "block" || icon === "warning") return "negative";
  if (
    icon === "clock" ||
    icon === "half" ||
    icon === "retry" ||
    icon === "undo" ||
    icon === "pause"
  )
    return "pending";
  return "neutral";
}

/**
 * A status as its own item: a small vector icon before the word. The icon is decoration only
 * (`aria-hidden`), so assistive technology reads exactly the word and the accessible name of a
 * link or row that holds the badge does not change.
 */
export function StatusBadge({
  label,
  symbol,
  as: Tag = "span",
  className = "",
  testId,
}: Readonly<{
  label: string;
  symbol: StatusSymbol | null;
  as?: "span" | "strong";
  className?: string;
  testId?: string;
}>) {
  return (
    <Tag className={`status-badge ${className}`.trim()} data-testid={testId}>
      {symbol && (
        <svg
          className={`status-badge-icon status-badge-icon-${toneOf(symbol.icon)}`}
          data-status-icon={symbol.icon}
          viewBox="0 0 16 16"
          aria-hidden="true"
          focusable="false"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {ICON_SHAPES[symbol.icon]}
        </svg>
      )}
      {label}
    </Tag>
  );
}
