# Infrastructure Design Questions: U2 Identity and access

U2 uses the local stack from U1 (database, sign-in service, mail catcher) and adds configuration, a way to send invitation emails, and tests that read mail. No hosted infrastructure is created and no deployment workflow is added. Most choices are already fixed by the functional design and the quality targets; these three remain.

## Q1. How does the app send the invitation email?

A. Over SMTP to the stack's mail server with a small, exactly pinned SMTP library; the server address, port and sender come from settings (locally the mail catcher; a real provider is configured later and is out of scope).
B. Through the sign-in service's own invitation email, accepting that its link cannot carry the app's own token (this would change the functional design).
C. Not yet defined.
D. Not applicable.
X. Other (please specify)

[Answer]: A. Over SMTP to the stack's mail server with a small, exactly pinned SMTP library; the server address, port and sender come from settings (locally the mail catcher; a real provider is configured later and is out of scope).

## Q2. Where do the links in emails get the app's public address?

A. A required setting `APP_PUBLIC_URL` (locally `http://127.0.0.1:3000`, validated like the other addresses: loopback for http, https otherwise), used for invitation links and given to the sign-in service as its site address for recovery links.
B. Taken from the incoming request's host header on every request (no setting, but it can be forged by a caller).
C. Not yet defined.
D. Not applicable.
X. Other (please specify)

[Answer]: A. A required setting `APP_PUBLIC_URL` (locally `http://127.0.0.1:3000`, validated like the other addresses: loopback for http, https otherwise), used for invitation links and given to the sign-in service as its site address for recovery links.

## Q3. How is the secure-cookie flag over https tested locally?

A. A unit test of the function that builds the cookie options for an http and an https address, plus a production-mode start smoke that checks the flags returned by the sign-in route; no local https server.
B. Run the app behind a local https proxy with a throw-away certificate in the browser test.
C. Not yet defined.
D. Not applicable.
X. Other (please specify)

[Answer]: A. A unit test of the function that builds the cookie options for an http and an https address, plus a production-mode start smoke that checks the flags returned by the sign-in route; no local https server.

## Consolidated Summary Confirmation

- Invitation email: sent over SMTP to the stack's mail server with a small, exactly pinned library; settings for server, port and sender.
- Public address: a required `APP_PUBLIC_URL` setting, validated, also given to the sign-in service for recovery links.
- Secure cookie test: a unit test of the cookie options for http and https plus a production-mode smoke of the sign-in route's flags; no local https server.

Does this all look correct before I generate the artifacts?

Looks correct
Request changes

[Answer]: Looks correct
