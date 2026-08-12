# type-check finding — code-generation

**Timestamp**: 2026-08-12T12:35:35Z
**Fire id**: 3dae315c
**Output path**: /Users/dev/Development/waldorf-community-task-manager/src/application/admin-facade.ts
**Pass**: false

## Findings

```json
{
  "pass": false,
  "errors": [
    {
      "file": "src/application/admin-facade.ts",
      "line": 349,
      "column": 39,
      "message": "Type 'Promise<ApplicationResult<Readonly<{ idempotencyKey: string; expectedVersion: number; }>>>' is not assignable to type 'Promise<ApplicationResult<T>>'.\n  Type 'ApplicationResult<Readonly<{ idempotencyKey: string; expectedVersion: number; }>>' is not assignable to type 'ApplicationResult<T>'.\n  Type 'Readonly<{ code: string; presentationCode: PresentationCode; focusTarget: string; announcement: AnnouncementMode; evidenceId?: string | undefined; }> & { ...; }' is not assignable to type 'ApplicationResult<T>'.\n  Type 'Readonly<{ code: string; presentationCode: import(\"/Users/dev/Development/waldorf-community-task-manager/src/application/contracts\").PresentationCode; focusTarget: string; announcement: import(\"/Users/dev/Development/waldorf-community-task-manager/src/application/contracts\").AnnouncementMode; evi...' is not assignable to type 'Readonly<{ code: string; presentationCode: import(\"/Users/dev/Development/waldorf-community-task-manager/src/application/contracts\").PresentationCode; focusTarget: string; announcement: import(\"/Users/dev/Development/waldorf-community-task-manager/src/application/contracts\").AnnouncementMode; evi...'. Two different types with this name exist, but they are unrelated.\n  Type 'Readonly<{ code: string; presentationCode: PresentationCode; focusTarget: string; announcement: AnnouncementMode; evidenceId?: string | undefined; }> & { ...; }' is not assignable to type '{ state: \"empty\"; data?: Readonly<T> | undefined; }'.\n  Types of property 'data' are incompatible.\n  Type 'Readonly<Readonly<{ idempotencyKey: string; expectedVersion: number; }>> | undefined' is not assignable to type 'Readonly<T> | undefined'.\n  Type 'Readonly<Readonly<{ idempotencyKey: string; expectedVersion: number; }>>' is not assignable to type 'Readonly<T>'."
    }
  ],
  "findings_count": 1
}
```
