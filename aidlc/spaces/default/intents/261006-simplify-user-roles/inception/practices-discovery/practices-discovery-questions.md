# Practices Discovery Questions

## Established Context

The existing affirmed practices cover short-lived branches, green checks before merge, scope-dependent first integrated delivery, coverage thresholds, deployment prerequisites, and TypeScript/Hungarian copy conventions. Recent PR merge commits are recorded as observed behavior, not a replacement for the existing squash policy. The later human-approved and merged private CI fix establishes unsigned build evidence as the current implementation; this interview does not reopen that decision or introduce signing work.

Independent quality, developer, and security contributions have been collected. Their testing cadence gap requires one focused human choice. Existing regression, same-change testing, coverage, accessibility and validation requirements remain applicable.

## Q1: Testing Cadence

The existing rule says tests accompany the code, but does not specify whether they precede implementation. Which order should this change use?

A. Implement each testable layer, then write and run its tests before moving to the next layer (test-after; recommended default).
B. Write a failing test first, implement enough to pass, then refactor (tdd).
C. Use another explicit cadence; describe what is written before and after implementation (custom or a specified methodology).
X. Other (please specify)

[Answer]: A. Implement each testable layer, then write and run its tests before moving to the next layer (test-after).

## Interaction Mode

A. Guide me
B. I'll edit the file
C. Chat
X. Other (please specify)

[Answer]: Guide me
