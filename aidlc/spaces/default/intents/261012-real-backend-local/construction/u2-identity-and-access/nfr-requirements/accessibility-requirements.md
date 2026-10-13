# Accessibility and Compatibility Requirements: U2 Identity and access

Source: NFR5 and NFR7 of the requirements, rule BR2.20.

| ID | Requirement | Check |
|---|---|---|
| NFR5.1 | The sign-in, invitation, password-reset request and new-password screens meet WCAG 2.2 AA: text contrast at least 4.5:1, controls 3:1, visible focus, keyboard-only operation | The browser flow runs the automated accessibility scan on each screen in the success and error states with no serious or critical violation |
| NFR5.2 | Every control has a visible label; every error is announced in a live region and linked to its field; the page title names the screen | Browser tests read the accessibility tree |
| NFR5.3 | All text is Hungarian, from one copy module, including every error and the neutral reset message | A test compares the rendered text with the copy module and checks no English text appears |
| NFR7.1 | The pages other than the new screens keep their markup, copy, test ids and behaviour while the old picker stays reachable (BR2.19) | The existing browser and component suites pass unchanged |
| NFR7.2 | Two people can be signed in at the same time in two browser contexts without seeing each other's data | A browser test with two contexts |
