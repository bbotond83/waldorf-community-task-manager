# type-check finding — code-generation

**Timestamp**: 2026-08-12T12:32:43Z
**Fire id**: db83302a
**Output path**: /Users/dev/Development/waldorf-community-task-manager/src/application/facade-pipeline.ts
**Pass**: false

## Findings

```json
{
  "pass": false,
  "errors": [
    {
      "file": "src/application/facade-pipeline.ts",
      "line": 45,
      "column": 44,
      "message": "Type 'ApplicationResult<Readonly<{ session: Readonly<{ subjectId: string; authorizationVersion: number; roles: readonly Role[]; scopes: readonly Scope[]; runtimeMode: RuntimeMode; isSynthetic: boolean; }>; matrixRowId: AuthorizationMatrixRowId; scope: Scope; fields: readonly SensitiveFieldId[]; }>>' is not assignable to type 'ApplicationResult<T>'.\n  Type 'Readonly<{ code: string; presentationCode: PresentationCode; focusTarget: string; announcement: AnnouncementMode; evidenceId?: string | undefined; }> & { ...; }' is not assignable to type 'ApplicationResult<T>'.\n  Type 'Readonly<{ code: string; presentationCode: import(\"/Users/dev/Development/waldorf-community-task-manager/src/application/contracts\").PresentationCode; focusTarget: string; announcement: import(\"/Users/dev/Development/waldorf-community-task-manager/src/application/contracts\").AnnouncementMode; evi...' is not assignable to type 'Readonly<{ code: string; presentationCode: import(\"/Users/dev/Development/waldorf-community-task-manager/src/application/contracts\").PresentationCode; focusTarget: string; announcement: import(\"/Users/dev/Development/waldorf-community-task-manager/src/application/contracts\").AnnouncementMode; evi...'. Two different types with this name exist, but they are unrelated.\n  Type 'Readonly<{ code: string; presentationCode: PresentationCode; focusTarget: string; announcement: AnnouncementMode; evidenceId?: string | undefined; }> & { ...; }' is not assignable to type '{ state: \"empty\"; data?: Readonly<T> | undefined; }'.\n  Types of property 'data' are incompatible.\n  Type 'Readonly<Readonly<{ session: Readonly<{ subjectId: string; authorizationVersion: number; roles: readonly Role[]; scopes: readonly Scope[]; runtimeMode: RuntimeMode; isSynthetic: boolean; }>; matrixRowId: AuthorizationMatrixRowId; scope: Scope; fields: readonly SensitiveFieldId[]; }>> | undefined' is not assignable to type 'Readonly<T> | undefined'.\n  Type 'Readonly<Readonly<{ session: Readonly<{ subjectId: string; authorizationVersion: number; roles: readonly Role[]; scopes: readonly Scope[]; runtimeMode: RuntimeMode; isSynthetic: boolean; }>; matrixRowId: AuthorizationMatrixRowId; scope: Scope; fields: readonly SensitiveFieldId[]; }>>' is not assignable to type 'Readonly<T>'."
    }
  ],
  "findings_count": 1
}
```
