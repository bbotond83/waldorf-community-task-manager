# type-check finding — code-generation

**Timestamp**: 2026-08-12T12:37:53Z
**Fire id**: 642fbc1e
**Output path**: /Users/dev/Development/waldorf-community-task-manager/src/application/staff-facade.ts
**Pass**: false

## Findings

```json
{
  "pass": false,
  "errors": [
    {
      "file": "src/application/staff-facade.ts",
      "line": 49,
      "column": 58,
      "message": "Argument of type '(Readonly<{ code: string; presentationCode: PresentationCode; focusTarget: string; announcement: AnnouncementMode; evidenceId?: string | undefined; }> & { ...; }) | ... 7 more ... | (Readonly<...> & { ...; })' is not assignable to parameter of type '(Readonly<{ code: string; presentationCode: PresentationCode; focusTarget: string; announcement: AnnouncementMode; evidenceId?: string | undefined; }> & { ...; }) | ... 6 more ... | (Readonly<...> & { ...; })'.\n  Type 'Readonly<{ code: string; presentationCode: PresentationCode; focusTarget: string; announcement: AnnouncementMode; evidenceId?: string | undefined; }> & { ...; }' is not assignable to type '(Readonly<{ code: string; presentationCode: PresentationCode; focusTarget: string; announcement: AnnouncementMode; evidenceId?: string | undefined; }> & { ...; }) | ... 6 more ... | (Readonly<...> & { ...; })'.\n  Type 'Readonly<{ code: string; presentationCode: import(\"/Users/dev/Development/waldorf-community-task-manager/src/application/contracts\").PresentationCode; focusTarget: string; announcement: import(\"/Users/dev/Development/waldorf-community-task-manager/src/application/contracts\").AnnouncementMode; evi...' is not assignable to type 'Readonly<{ code: string; presentationCode: import(\"/Users/dev/Development/waldorf-community-task-manager/src/application/contracts\").PresentationCode; focusTarget: string; announcement: import(\"/Users/dev/Development/waldorf-community-task-manager/src/application/contracts\").AnnouncementMode; evi...'. Two different types with this name exist, but they are unrelated.\n  Type 'Readonly<{ code: string; presentationCode: PresentationCode; focusTarget: string; announcement: AnnouncementMode; evidenceId?: string | undefined; }> & { ...; }' is not assignable to type '{ state: \"dependency-failure-terminal\"; }'.\n  Types of property 'state' are incompatible.\n  Type '\"recovery\"' is not assignable to type '\"dependency-failure-terminal\"'."
    }
  ],
  "findings_count": 1
}
```
