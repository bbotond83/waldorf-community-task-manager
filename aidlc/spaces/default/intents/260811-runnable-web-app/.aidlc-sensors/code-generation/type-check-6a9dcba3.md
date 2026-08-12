# type-check finding — code-generation

**Timestamp**: 2026-08-12T12:37:09Z
**Fire id**: 6a9dcba3
**Output path**: /Users/dev/Development/waldorf-community-task-manager/src/application/parent-facade.ts
**Pass**: false

## Findings

```json
{
  "pass": false,
  "errors": [
    {
      "file": "src/application/parent-facade.ts",
      "line": 78,
      "column": 41,
      "message": "Type 'Promise<ApplicationResult<Readonly<{ idempotencyKey: string; expectedVersion: number; }>>>' is not assignable to type 'Promise<ApplicationResult<Readonly<{ id: string; state: \"assigned\" | \"swap-pending\" | \"cancellation-pending\"; version: number; }>>>'.\n  Type 'ApplicationResult<Readonly<{ idempotencyKey: string; expectedVersion: number; }>>' is not assignable to type 'ApplicationResult<Readonly<{ id: string; state: \"assigned\" | \"swap-pending\" | \"cancellation-pending\"; version: number; }>>'.\n  Type 'Readonly<{ code: string; presentationCode: PresentationCode; focusTarget: string; announcement: AnnouncementMode; evidenceId?: string | undefined; }> & { ...; }' is not assignable to type 'ApplicationResult<Readonly<{ id: string; state: \"assigned\" | \"swap-pending\" | \"cancellation-pending\"; version: number; }>>'.\n  Type 'Readonly<{ code: string; presentationCode: import(\"/Users/dev/Development/waldorf-community-task-manager/src/application/contracts\").PresentationCode; focusTarget: string; announcement: import(\"/Users/dev/Development/waldorf-community-task-manager/src/application/contracts\").AnnouncementMode; evi...' is not assignable to type 'Readonly<{ code: string; presentationCode: import(\"/Users/dev/Development/waldorf-community-task-manager/src/application/contracts\").PresentationCode; focusTarget: string; announcement: import(\"/Users/dev/Development/waldorf-community-task-manager/src/application/contracts\").AnnouncementMode; evi...'. Two different types with this name exist, but they are unrelated.\n  Type 'Readonly<{ code: string; presentationCode: PresentationCode; focusTarget: string; announcement: AnnouncementMode; evidenceId?: string | undefined; }> & { ...; }' is not assignable to type '{ state: \"success\" | \"recovery\"; data: Readonly<{ id: string; state: \"assigned\" | \"swap-pending\" | \"cancellation-pending\"; version: number; }>; }'.\n  Types of property 'data' are incompatible.\n  Type 'Readonly<{ idempotencyKey: string; expectedVersion: number; }>' is missing the following properties from type 'Readonly<{ id: string; state: \"assigned\" | \"swap-pending\" | \"cancellation-pending\"; version: number; }>': id, state, version"
    },
    {
      "file": "src/application/parent-facade.ts",
      "line": 221,
      "column": 41,
      "message": "Type 'Promise<ApplicationResult<Readonly<{ idempotencyKey: string; expectedVersion: number; }>>>' is not assignable to type 'Promise<ApplicationResult<Readonly<{ id: string; state: \"pending\" | \"approved\"; }>>>'.\n  Type 'ApplicationResult<Readonly<{ idempotencyKey: string; expectedVersion: number; }>>' is not assignable to type 'ApplicationResult<Readonly<{ id: string; state: \"pending\" | \"approved\"; }>>'.\n  Type 'Readonly<{ code: string; presentationCode: PresentationCode; focusTarget: string; announcement: AnnouncementMode; evidenceId?: string | undefined; }> & { ...; }' is not assignable to type 'ApplicationResult<Readonly<{ id: string; state: \"pending\" | \"approved\"; }>>'.\n  Type 'Readonly<{ code: string; presentationCode: import(\"/Users/dev/Development/waldorf-community-task-manager/src/application/contracts\").PresentationCode; focusTarget: string; announcement: import(\"/Users/dev/Development/waldorf-community-task-manager/src/application/contracts\").AnnouncementMode; evi...' is not assignable to type 'Readonly<{ code: string; presentationCode: import(\"/Users/dev/Development/waldorf-community-task-manager/src/application/contracts\").PresentationCode; focusTarget: string; announcement: import(\"/Users/dev/Development/waldorf-community-task-manager/src/application/contracts\").AnnouncementMode; evi...'. Two different types with this name exist, but they are unrelated.\n  Type 'Readonly<{ code: string; presentationCode: PresentationCode; focusTarget: string; announcement: AnnouncementMode; evidenceId?: string | undefined; }> & { ...; }' is not assignable to type '{ state: \"success\" | \"recovery\"; data: Readonly<{ id: string; state: \"pending\" | \"approved\"; }>; }'.\n  Types of property 'data' are incompatible.\n  Type 'Readonly<{ idempotencyKey: string; expectedVersion: number; }>' is missing the following properties from type 'Readonly<{ id: string; state: \"pending\" | \"approved\"; }>': id, state"
    }
  ],
  "findings_count": 2
}
```
