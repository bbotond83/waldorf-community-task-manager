# Access Foundation Functional Design Questions

## Q1 — Revocation Session Behavior

When a role or scope is revoked, how should active sessions behave?

- A. Deny the next protected request and force reauthorization without waiting for token expiry. *(Recommended)*
- B. Allow access until token expiry.
- C. Require manual sign-out only.
- X. Other (please specify)

[Answer]: A — Deny the next protected request and force reauthorization without waiting for token expiry.

## Q2 — Authorization Denial

How should protected UI/API denials be represented?

- A. Return a generic Hungarian denial without protected-field existence details and emit redacted audit evidence. *(Recommended)*
- B. Reveal why the resource is protected.
- C. Redirect silently.
- X. Other (please specify)

[Answer]: A — Return a generic Hungarian denial without protected-field existence details and emit redacted audit evidence.
