## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-21T16:54:01Z
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u7-swaps-and-duty-changes/nfr-requirements/security-requirements.md > Data Protection (NFR1.3, NFR10.1) and Audit | The reason is free text of up to 500 characters. BR77.3 clears the person ids on ended requests when a parent or family is removed, but the reason text itself stays. A parent can type a name or phone number into it. It is then stored on the request and copied into the email and notice sent to the other family (NFR10.1 says "nothing else" yet includes the reason). No requirement covers how long the reason is kept or what happens to it on removal. The "korábbi tag" outcome can leak through the reason. | Add a requirement for the removal pair (C16). Either clear or blank the reason on ended requests of a removed person or family, or state explicitly that it is kept and why. Add a screen hint that the reason must not contain contact details. Reword NFR10.1 so the free-text reason is named as the one exception. Add a test for it. | New |
| R-02 | Major | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u7-swaps-and-duty-changes/nfr-requirements/security-requirements.md > Authorization Requirements and Threat Considerations | BR77.1 promises that a repeated click with the same idempotency key returns the stored result. No security requirement says how the key is scoped. If it is not bound to the caller and the command, one parent could replay another parent's key and read the stored result. That result can carry the other family's duties and the reason. A reused key with different inputs is also unaddressed. | Add a requirement that the stored result is looked up by account, command and key together. A key reused by another account or with a different payload must give the denied or conflict refusal and never the stored result. Add a database test for it. | New |
| R-03 | Minor | security-requirements.md > Threat Considerations | No control limits how many proposals one family can send or how many emails they cause. NFR4.3 only covers rate limiting of denied attempts. A parent can flood other families with swap_requested notices. | Add a cap on open proposals per family or per day, or record why it is accepted for a small community. | New |
| R-04 | Minor | security-requirements.md > NFR3.3 | BR70.2 requires the reverse caller to be allowed on both places. NFR3.3's pass criterion mentions only a rota duty and a manual duty. A reversal across a rota duty and a manual duty of another group is not tested. | Add a mixed-duty reversal case to NFR3.3's test, for a group admin who reaches only one of the two. | New |
| R-05 | Minor | security-requirements.md > NFR3.2 and BR71.1 | The same-denied-refusal rule covers callers outside the request. Proposal refusals such as DUTY_ALREADY_ASSIGNED and REQUEST_DUPLICATE tell the proposer something about the other family's duties and requests. | Confirm that this level of disclosure is accepted, or limit it to what swap_candidates already shows. | New |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| none declared | n/a | I read security-requirements.md against rules.md only. I did not run sensors or inspect the companion NFR files or the contract summary. |

### Summary

The security requirements follow the business rules closely. Authorization, the retired and internal grants, audit and the threat table are measurable and testable. Two gaps are worth weighing before approval: the free-text reason, which outlives removal and goes into emails, and the idempotency key, which has no caller binding. Both are two-sentence additions and neither blocks approval.
