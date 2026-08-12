# type-check finding — code-generation

**Timestamp**: 2026-08-12T13:47:50Z
**Fire id**: 85bb7ceb
**Output path**: /Users/dev/Development/waldorf-community-task-manager/src/staff-web/synthetic-staff.test.ts
**Pass**: false

## Findings

```json
{
  "pass": false,
  "errors": [
    {
      "file": "src/staff-web/synthetic-staff.test.ts",
      "line": 17,
      "column": 7,
      "message": "Type 'Readonly<{ subjectId: \"staff-local\"; authorizationVersion: 1; roles: string[]; scopes: (Readonly<{ id: string; type: \"group\"; organizationId: string; }> | Readonly<{ id: string; type: \"group\"; organizationId: string; }>)[]; runtimeMode: \"synthetic\"; isSynthetic: true; }>' is not assignable to type 'Readonly<{ subjectId: string; authorizationVersion: number; roles: readonly Role[]; scopes: readonly Scope[]; runtimeMode: RuntimeMode; isSynthetic: boolean; }>'.\n  Types of property 'roles' are incompatible.\n  Type 'string[]' is not assignable to type 'readonly Role[]'.\n  Type 'string' is not assignable to type 'Role'."
    }
  ],
  "findings_count": 1
}
```
