# type-check finding — code-generation

**Timestamp**: 2026-08-12T13:20:02Z
**Fire id**: b152120c
**Output path**: /Users/dev/Development/waldorf-community-task-manager/src/parent-web/synthetic-parent.ts
**Pass**: false

## Findings

```json
{
  "pass": false,
  "errors": [
    {
      "file": "src/parent-web/synthetic-parent.ts",
      "line": 238,
      "column": 51,
      "message": "Argument of type 'Readonly<{ isRead: true; id: \"notice-7-day\"; title: \"Egy hét múlva: Lámpás ünnep előkészítése\"; link: \"/szulo/feladatok/duty-assigned\"; timing: \"7-day\"; providerStatus: \"simulated-sent\"; } | { ...; } | { ...; }>' is not assignable to parameter of type 'Readonly<{ id: \"notice-7-day\"; title: \"Egy hét múlva: Lámpás ünnep előkészítése\"; link: \"/szulo/feladatok/duty-assigned\"; isRead: false; timing: \"7-day\"; providerStatus: \"simulated-sent\"; }> | Readonly<...> | Readonly<...>'.\n  Type 'Readonly<{ isRead: true; id: \"notice-7-day\"; title: \"Egy hét múlva: Lámpás ünnep előkészítése\"; link: \"/szulo/feladatok/duty-assigned\"; timing: \"7-day\"; providerStatus: \"simulated-sent\"; }>' is not assignable to type 'Readonly<{ id: \"notice-7-day\"; title: \"Egy hét múlva: Lámpás ünnep előkészítése\"; link: \"/szulo/feladatok/duty-assigned\"; isRead: false; timing: \"7-day\"; providerStatus: \"simulated-sent\"; }> | Readonly<...> | Readonly<...>'.\n  Type 'Readonly<{ isRead: true; id: \"notice-7-day\"; title: \"Egy hét múlva: Lámpás ünnep előkészítése\"; link: \"/szulo/feladatok/duty-assigned\"; timing: \"7-day\"; providerStatus: \"simulated-sent\"; }>' is not assignable to type 'Readonly<{ id: \"notice-stale\"; title: \"Korábbi, már nem aktuális emlékeztető\"; link: \"/szulo/ertesitesek\"; isRead: true; timing: \"stale\"; providerStatus: \"simulated-cancelled\"; }>'.\n  Types of property 'id' are incompatible.\n  Type '\"notice-7-day\"' is not assignable to type '\"notice-stale\"'."
    }
  ],
  "findings_count": 1
}
```
