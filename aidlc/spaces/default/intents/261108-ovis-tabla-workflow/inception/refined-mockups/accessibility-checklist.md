# Accessibility Checklist

Target: WCAG 2.1 AA for every screen in `mockups.md`, consistent with `requirements.md` (NFR7, NFR8), `stories.md` and `team-practices.md`, where serious or critical automated violations block delivery.

## Applies to Every Screen

- [ ] `lang="hu"`, one h1, headings in order, a skip link.
- [ ] Every function works by keyboard, with the visible Focus Blue ring.
- [ ] Every touch target is at least 44px, including the bottom bar.
- [ ] Text contrast at least 4.5:1, controls at least 3:1, using the `DESIGN.md` colours.
- [ ] Status is never colour alone: always an icon and a word.
- [ ] Labels above fields; errors named in text beside the field, `role="alert"`.
- [ ] Results of an action are announced in a status region; focus doesn't jump.
- [ ] Works at 200% zoom and at phone width with no sideways page scroll.
- [ ] `prefers-reduced-motion` is respected.

## Screen-Specific Checks

- [ ] **Bottom bar:** a `nav` with a name; the current item has `aria-current="page"`; content is not hidden behind it.
- [ ] **Rota table:** real table markup with a caption and header cells; the phone card list reads in the same order.
- [ ] **Slot row:** button names include the day and time.
- [ ] **Weekend pick:** fieldset and legend, native radios, reasons in text.
- [ ] **Checklist:** tasks grouped under real headings; the done state is in words.
- [ ] **Food sign-up:** allergen tick boxes are native and labelled; offers state allergens in words.
- [ ] **Accordions:** native `details` and `summary`; a link to a section opens it.
- [ ] **Sharing tick box:** the explanation is tied to the box with `aria-describedby`.
- [ ] **Directory:** hidden fields are absent, not visually hidden, so that screen readers and page source reveal nothing.

## Verification

Automated accessibility checks run in the critical browser flow. Keyboard and screen-reader checks are part of the owner's review of each piece.
