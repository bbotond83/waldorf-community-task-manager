# type-check finding — code-generation

**Timestamp**: 2026-08-12T13:26:47Z
**Fire id**: 0d70a898
**Output path**: /Users/dev/Development/waldorf-community-task-manager/src/parent-web/synthetic-parent.test.ts
**Pass**: false

## Findings

```json
{
  "pass": false,
  "errors": [
    {
      "file": "src/parent-web/synthetic-parent.test.ts",
      "line": 16,
      "column": 7,
      "message": "Type 'Readonly<{ subjectId: \"parent-local\"; authorizationVersion: 1; roles: string[]; scopes: Scope[]; runtimeMode: \"synthetic\"; isSynthetic: true; }>' is not assignable to type 'Readonly<{ subjectId: string; authorizationVersion: number; roles: readonly Role[]; scopes: readonly Scope[]; runtimeMode: RuntimeMode; isSynthetic: boolean; }>'.\n  Types of property 'roles' are incompatible.\n  Type 'string[]' is not assignable to type 'readonly Role[]'.\n  Type 'string' is not assignable to type 'Role'."
    }
  ],
  "findings_count": 1
}
```
