# Build-vs-Buy Assessment

## Decision Context

This assessment consumes the approved [intent statement](../intent-capture/intent-statement.md). The primary alternative is the existing Excel workflow, and the first deployment is multiple groups with up to 30 families. [Q1] [Q2]

Generic services can reduce time-to-value for self-service signups and reminders. SignUpGenius and VolunteerSignup directly address volunteer signup and reminder workflows, while TeamSnap covers parent-facing schedules, availability, assignments, and communication. [market-1] [market-2] [market-3]

## Evaluation

| Factor | Build tailored MVP | Buy generic SaaS | Assessment |
| --- | --- | --- | --- |
| Hungarian parent experience | Can be designed as a core outcome | Varies by vendor and plan | Favors build |
| Role-based privacy | Can enforce the approved admin-only contact rule and staff restrictions | Requires validating vendor roles and data-sharing behavior | Favors build |
| Family-owned assignments | Native to the proposed domain model | May need workarounds or custom fields | Favors build |
| Signup and reminder speed | Requires delivery effort | Available immediately in category products | Favors buy |
| Local rollout scale | Tailored support cost is manageable at up to 30 families | Low setup burden | Neutral |
| Long-term scope | Bounded MVP can avoid commodity expansion | Broad vendor functionality may exceed needs | Favors build if scope stays bounded |

## Recommendation

Proceed with a tailored MVP, subject to later feasibility validation. The confirmed rationale is that Hungarian-language interaction, role-based privacy, and family-owned assignment ownership are required together. Those are central product constraints rather than optional customizations. [Q3]

Do not build commodity breadth merely to match SaaS products. Reassess buying or partnering if the later solution cannot preserve the required privacy model or if a vendor demonstrably supports the full combined requirement set at acceptable cost and governance terms.

## Sources

- [intent] `../intent-capture/intent-statement.md`
- [Q1]–[Q3] `market-research-questions.md`
- [market-1] https://www.signupgenius.com/features/
- [market-2] https://www.volunteersignup.org/ and https://volunteersignup.org/help
- [market-3] https://www.teamsnap.com/teams/features
