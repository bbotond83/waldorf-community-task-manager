# Security test instructions

## Scope and commands

The redirect target is the fixed path `/`; no address from the request is used (no open redirect). Cookie handling, token renewal and the content security policy are unchanged. Run the repository scans:

```bash
export PATH=/opt/homebrew/opt/node@24/bin:$PATH && npm run verify:security
```

## Boundaries

Blocking: any high or critical dependency or code-scan finding. The last run reported 16 moderate dependency findings and none high or critical (`evidence/verify-security.log`).
