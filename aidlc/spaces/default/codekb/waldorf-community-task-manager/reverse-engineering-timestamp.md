# Reverse Engineering Timestamp

## Run Record

- Date: 2026-11-08T09:51:32Z
- Commit: 4845bb7ae2a39d7587ed2c518d1924512cfbe906
- Breadth: full rescan of the repository at Standard depth, read-only. No tests, builds or programs were run.
- Coverage note: application source, database migrations and configuration were read for this run. Test files and some identity and shell components were only sampled; they are listed under `shallow.paths`. The scan's handoff states the exact split.

## Scope of Analysis

```yaml
scope_version: 1
kind: full
intent: ovis-tabla-workflow
fingerprint: 06481d2a76cbe0fafe215c416925c99c72dfbd18
analyzed:
  paths:
    - ./
  components:
    - Web Shell and Request Proxy
    - Identity Screens
    - Parent Screens
    - Teacher Screens
    - Admin Screens
    - Import Workflow Screen
    - Access Policy
    - Application Facades
    - Data Adapters
    - Identity Library
    - Workbook Parser
    - Runtime Composition
    - Platform Database Layer
    - Identity Database Layer
    - Directory Database Layer
    - Coordination Database Layer
    - Lifecycle Database Layer
    - Notifications Database Layer
    - Import Database Layer
    - Database Tooling
    - Verification Tooling
    - Test Suites
    - CI Workflow
shallow:
  paths:
    - tests/
    - scripts/verification/
    - verification/
    - qa-results/
    - source-materials/
    - HASZNALATI_UTMUTATO_HU.md
    - app/globals.css
```
