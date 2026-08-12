# type-check finding — code-generation

**Timestamp**: 2026-08-12T12:37:06Z
**Fire id**: 87d10144
**Output path**: /Users/dev/Development/waldorf-community-task-manager/src/application/results.ts
**Pass**: false

## Findings

```json
{
  "pass": false,
  "errors": [
    {
      "file": "src/application/results.ts",
      "line": 28,
      "column": 3,
      "message": "Type '{ code: string; presentationCode: PresentationCode; focusTarget: string; announcement: AnnouncementMode; state: string; data: T; }' is not assignable to type 'never'."
    },
    {
      "file": "src/application/results.ts",
      "line": 54,
      "column": 3,
      "message": "Type '{ code: string; presentationCode: PresentationCode; focusTarget: string; announcement: AnnouncementMode; state: string; }' is not assignable to type 'never'."
    },
    {
      "file": "src/application/results.ts",
      "line": 68,
      "column": 3,
      "message": "Type '{ code: string; presentationCode: PresentationCode; focusTarget: string; announcement: AnnouncementMode; state: string; }' is not assignable to type 'never'."
    },
    {
      "file": "src/application/results.ts",
      "line": 77,
      "column": 3,
      "message": "Type '{ code: string; presentationCode: PresentationCode; focusTarget: string; announcement: AnnouncementMode; state: string; }' is not assignable to type 'never'."
    }
  ],
  "findings_count": 4
}
```
