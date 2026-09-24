# Units Generation Questions

## Q1 — Unit Boundaries

How should construction units be bounded?

- A. By domain module and user-facing surface. *(Recommended)*
- B. By deployment service.
- C. By individual requirement.
- X. Other (please specify)

[Answer]: A — By domain module and user-facing surface.

## Q2 — Granularity

Which unit granularity should apply?

- A. Fine-grained, independently testable units with explicit contracts. *(Recommended)*
- B. Coarse feature packages.
- C. One monolithic unit.
- X. Other (please specify)

[Answer]: A — Fine-grained, independently testable units with explicit contracts.

## Q3 — Parallelism

How should the DAG represent independent work?

- A. Expose all valid parallel branches; Delivery Planning chooses execution economics. *(Recommended)*
- B. Force a serial topology.
- C. Leave dependencies unspecified.
- X. Other (please specify)

[Answer]: A — Expose all valid parallel branches; Delivery Planning chooses execution economics.
