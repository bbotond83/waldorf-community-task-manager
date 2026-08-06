# type-check finding — code-generation

**Timestamp**: 2026-08-06T11:21:38Z
**Fire id**: 0a9f03d9
**Output path**: /Users/dev/Development/waldorf-community-task-manager/src/coordination/coordination-service.test.ts
**Pass**: false

## Findings

```json
{
  "pass": false,
  "errors": [
    {
      "file": "src/coordination/coordination-service.test.ts",
      "line": 11,
      "column": 482,
      "message": "Property 'state' does not exist on type 'AuthorizationDecision | SwapRequest'.\n  Property 'state' does not exist on type 'AuthorizationDecision'."
    },
    {
      "file": "src/coordination/coordination-service.test.ts",
      "line": 12,
      "column": 450,
      "message": "Property 'state' does not exist on type 'AuthorizationDecision | SwapRequest'.\n  Property 'state' does not exist on type 'AuthorizationDecision'."
    }
  ],
  "findings_count": 2
}
```
