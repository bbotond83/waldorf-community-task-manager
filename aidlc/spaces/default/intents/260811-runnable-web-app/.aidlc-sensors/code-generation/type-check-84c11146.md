# type-check finding — code-generation

**Timestamp**: 2026-08-12T12:59:26Z
**Fire id**: 84c11146
**Output path**: /Users/dev/Development/waldorf-community-task-manager/src/admin-core/synthetic-admin.ts
**Pass**: false

## Findings

```json
{
  "pass": false,
  "errors": [
    {
      "file": "src/admin-core/synthetic-admin.ts",
      "line": 169,
      "column": 91,
      "message": "Type '{ state: \"empty\"; } | { state: \"denied\"; } | { state: \"conflict\"; code?: string | undefined; } | { state: \"invalidated\"; code?: string | undefined; } | { state: \"recovery\"; data: Readonly<{ id: string; title: string; state: string; version?: number | undefined; }>; }' is not assignable to type 'DomainOutcome<Readonly<{ completed: true; }>>'.\n  Type '{ state: \"recovery\"; data: Readonly<{ id: string; title: string; state: string; version?: number | undefined; }>; }' is not assignable to type 'DomainOutcome<Readonly<{ completed: true; }>>'.\n  Type '{ state: \"recovery\"; data: Readonly<{ id: string; title: string; state: string; version?: number | undefined; }>; }' is not assignable to type '{ state: \"recovery\"; data: Readonly<{ completed: true; }>; }'.\n  Types of property 'data' are incompatible.\n  Property 'completed' is missing in type 'Readonly<{ id: string; title: string; state: string; version?: number | undefined; }>' but required in type 'Readonly<{ completed: true; }>'."
    },
    {
      "file": "src/admin-core/synthetic-admin.ts",
      "line": 204,
      "column": 100,
      "message": "'task.version' is possibly 'undefined'."
    }
  ],
  "findings_count": 2
}
```
