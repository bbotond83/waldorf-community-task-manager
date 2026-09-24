# Business Logic Model

## Import Workflow

Upload validates supported workbook/hash, maps all 17 sheets using the approved register, and creates a deterministic preview. An authorized administrator resolves aliases, spelling, multi-person, and family conflicts. Immutable preview hash and mapping version bind atomic commit; retries report changed/already-imported rows without duplicates.

## Recovery

A confirmed post-commit defect freezes the run, creates redacted audit evidence, and presents authorized rollback/recovery choices. Recovery restores verified service within one hour.
