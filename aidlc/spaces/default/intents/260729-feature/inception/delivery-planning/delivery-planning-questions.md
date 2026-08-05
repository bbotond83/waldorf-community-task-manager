# Delivery Planning Questions

## Q1 — Sequencing Heuristic

Which economic sequencing heuristic should guide Bolts?

- A. Walking-skeleton-first, then risk/value hybrid. *(Recommended)*
- B. Value-first only.
- C. Risk-first only.
- X. Other (please specify)

[Answer]: A — Walking-skeleton-first, then risk/value hybrid.

## Q2 — Bolt Shape

How should units be grouped into Bolts?

- A. Thin end-to-end slices spanning dependent units. *(Recommended)*
- B. One unit per Bolt.
- C. Bundle all related units into large Bolts.
- X. Other (please specify)

[Answer]: A — Thin end-to-end slices spanning dependent units.

## Q3 — Construction Parallelism

Can independent Bolts run in parallel after prerequisites are met?

- A. Yes, where the dependency DAG permits and integration contracts are stable. *(Recommended)*
- B. No, run all Bolts serially.
- C. Decide ad hoc during Construction.
- X. Other (please specify)

[Answer]: A — Yes, where the dependency DAG permits and integration contracts are stable.
