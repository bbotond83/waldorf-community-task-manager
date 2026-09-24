# Application Design Memory

## Interpretations

- 2026-08-12T09:52:03Z — Treated the existing modules as the domain/application core and added delivery-facing façades rather than replacing them; CodeKB shows healthy module logic but missing composition and browser boundaries.
- 2026-08-12T09:52:03Z — Treated Vercel/Supabase as future adapter targets and synthetic mode as the only locally required runtime composition; current requirements prohibit deployment and false real-target claims.

## Deviations

- 2026-08-12T09:52:03Z — Did not ask the settled architectural questions again; the prior approved application design, current requirements, real exports, and user correction resolve them without ambiguity.

## Tradeoffs

- 2026-08-12T09:52:03Z — Added a uniform application-result and authorized-screen-model boundary rather than rewriting heterogeneous domain APIs; this contains delivery complexity and preserves existing tests at the cost of explicit mapping code.

## Open questions

- 2026-08-12T09:52:03Z — Concrete Next.js version and UI styling implementation remain reversible construction choices constrained by Node 24/npm 11, Vercel compatibility, accessibility, and quality gates.
