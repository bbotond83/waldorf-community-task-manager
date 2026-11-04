---
name: Waldorf közösségi feladatkezelő
colors:
  background: "#f8f0e3"
  surface: "#fffaf1"
  text: "#2b2118"
  muted: "#62564a"
  primary: "#98452f"
  primary-dark: "#6f2f1f"
  accent-ochre: "#a8661a"
  success: "#2f6b3a"
  success-bg: "#e8f3e6"
  info-bg: "#f5ecd9"
  danger-bg: "#fbe9e3"
  read-bg: "#ebe6de"
  read-text: "#5a5044"
  focus: "#1f4e79"
  border: "#d9c4a9"
  border-strong: "#8a7762"
---

# Design System: Waldorf közösségi feladatkezelő

Source of truth: `app/globals.css`. This file describes that stylesheet in words so design tools (Google Stitch) and coding agents produce screens that match the running app. If the two ever disagree, the CSS wins; update this file.

## 1. Visual Theme & Atmosphere

A warm, calm, handmade-feeling interface for a school community: cream paper, terracotta and ochre accents, soft shadows, generously rounded shapes. It should feel welcoming to parents and teachers, never corporate or "techy". Content is plain and readable first; decoration is minimal (one soft terracotta glow in the top-left of the page, otherwise flat surfaces).

Audience: parents, teachers and school administrators of a Waldorf school, many of them not technical. All user-facing copy is Hungarian (`lang="hu"`); keep labels short and friendly. Code identifiers stay English.

## 2. Color Palette & Roles

### Primary Foundation

- **Parchment** `#f8f0e3` (`--color-background`): page background, with a faint terracotta radial glow at the top-left.
- **Cream Surface** `#fffaf1` (`--color-surface`): cards, panels, tables, inputs.
- **Warm Ink** `#2b2118` (`--color-text`): body text.

### Accent & Interactive

- **Terracotta** `#98452f` (`--color-primary`): primary buttons, hover borders, "negative" status icons, blocked-panel edge.
- **Deep Terracotta** `#6f2f1f` (`--color-primary-dark`): button hover/pressed, links, headings on cards, eyebrow labels.
- **Ochre** `#a8661a` (`--color-accent-ochre`): "pending / waiting" status icons only.
- **Focus Blue** `#1f4e79` (`--color-focus`): keyboard focus ring only (3px outline, 3px offset). The one cool colour; never use it for decoration.

### Typography & Text Hierarchy

- **Muted Brown** `#62564a`: secondary text, summaries, hints.
- **Read Text** `#5a5044` on **Read Surface** `#ebe6de`: already-read notifications (visibly quieter than unread).

### Functional States

- **Success** `#2f6b3a` on `#e8f3e6`: confirmations, success panels (0.35rem left border in success green).
- **Danger Wash** `#fbe9e3`: errors and blocked states (0.35rem left border in terracotta), also the pressed state of cards.
- **Info Wash** `#f5ecd9`: hover background of cards, secondary-button hover, empty image placeholders.
- **Border** `#d9c4a9` for ordinary dividers; **Border Strong** `#8a7762` where a control needs a clearer edge.

Rule: status is never conveyed by colour alone. Statuses always pair an icon with a word (see Status Badge).

## 3. Typography Rules

### Hierarchy & Weights

- Fonts: two families, both **self-hosted** (files in `app/fonts/`, loaded in `app/layout.tsx` with `next/font/local`, licences beside them). Nothing is fetched from a font service, so there is no third-party request and the Content-Security-Policy keeps `font-src 'self'`.
  - **Vollkorn** (serif) for headings: weights 600 to 700 are used. Named value `--font-heading`.
  - **Karla** (sans-serif) for body text, labels and controls: weights 400, 600 and 700 are used. Named value `--font-body`.
  - Both are variable fonts, one `latin` file and one `latin-ext` file each; the `latin-ext` file carries the Hungarian letters ő and ű, and the browser fetches a file only when a character needs it. Text shows in a system serif or sans-serif while a font loads (`font-display: swap`).
  - Stitch project `projects/14373287019289018119` is the design reference for the restyle.
- Named type sizes in `:root`: `--text-headline-xl` (page title), `--text-headline-lg`, `--text-headline-md`, `--text-headline-sm`, `--text-body`, `--text-label`, `--text-eyebrow`.
- **Page title (h1)**: Vollkorn 700, `clamp(2rem, 5vw, 3.5rem)`, line-height 1.08.
- **Section titles (h2, h3)**: Vollkorn 600, line-height 1.2; h2 is 1.5rem.
- **Card title**: about 1.35rem, weight 750, Deep Terracotta.
- **Eyebrow**: Karla 700, 0.82rem, uppercase, 0.08em letter-spacing, Deep Terracotta; sits above a title.
- **Labels and buttons**: Karla 600.
- **Body**: Karla 400, 1rem, line-height 1.55.
- Headings and paragraphs hyphenate and wrap long Hungarian words (`hyphens: auto`); never truncate with ellipsis.

### Spacing Principles

Use rem steps: 0.35, 0.5, 0.75, 1, 1.25, 2. Vertical page padding scales with `clamp(3rem, 8vw, 7rem)`.

## 4. Component Stylings

### Buttons & Links

- **Primary**: pill shape (radius 999px), Terracotta fill, white text, padding 0.75rem 1.1rem, **minimum height 44px**. Hover/active: Deep Terracotta. Active nudges down 1px.
- **Secondary**: same size and shape, transparent fill, Deep Terracotta text, 1px inset Terracotta outline (drawn inside so heights match). Hover: Info Wash fill. Use for the quieter action beside a primary (for example "Szűrők törlése" next to "Szűrés").
- Every button, link and summary is at least 44px tall.
- Links: Deep Terracotta, underline offset 0.18em.

### Cards & Domain-Specific Containers

- Radius `1rem` (`--radius`), 1px Border, Cream Surface, soft shadow (`--shadow`, `0 12px 36px` warm brown at 8% opacity; `--shadow-hover`, `0 16px 40px` at 12%, on hover).
- Clickable cards (profile, parent, admin, teacher cards): hover raises 2px with a Terracotta border, Info Wash fill and the stronger shadow; pressed returns to level with Danger Wash. Whole card is the hit target.
- Parent task cards: resting soft shadow, title in the heading font (1.25rem), date in muted body text, and the status as a pill with its icon (green wash for done, dark terracotta text with an ochre icon on Info Wash for waiting, terracotta on Danger Wash for failed or blocked). On screens 36rem and wider the pill sits at the top right beside the title; on a phone it sits under the date.
- Profile selector card: min height 7.5rem, padding 1.25rem, name then one-line summary.
- Notification cards: unread uses the normal surface; read uses Read Surface and Read Text with a "read" state label.
- Blocked / success panels: tinted wash with a 0.35rem coloured left border.

### Navigation

- Site header with brand mark (round logo, 44px minimum hit area) and a collapsible navigation panel (`details/summary`) with pill-shaped nav buttons (cream fill, strong sand border, bold Deep Terracotta text, 44px tall); the current page is marked with `aria-current="page"` and styled as selected.
- A "skip to content" link appears at top-left on keyboard focus.

### Inputs & Forms

- Labels above fields; fields on Cream Surface with 1px Border; help text in Muted Brown (`form-hint`).
- Errors: `aria-invalid` fields get a clear Terracotta border and the message appears with `role="alert"` next to the field. Never rely on colour only.
- Filter forms group fields in a fieldset with a legend and place primary + secondary buttons together.

### Domain-Specific Components

- **Status Badge**: small icon (1.05em) + word. Positive = Success green, negative = Terracotta, pending = Ochre.
- **Teacher schedule** (`/teacher/schedule`): the filter is a cream panel with a Vollkorn legend and 44px controls. The table sits in a cream panel (`--radius`, resting shadow) with a Vollkorn caption, a header row of muted Karla capitals on Info Wash, sand dividers, a Vollkorn row link that covers the whole row, and the status as the shared pill (never broken over two lines). Below 44rem the table is replaced by cream cards (Vollkorn title, muted labels above values, the same pill). The detail page is the task detail panel (rows with a label above each value) under a 44px back link and a Vollkorn `--text-headline-lg` title.
- **Admin approvals** (`/admin/jovahagyasok`): the list uses the same filter panel and cream cards as the other admin lists (Vollkorn title, state as the shared pill beside it from 36rem), with quiet outlined pill pager items of at least 44px. The detail page shows the request in a cream panel (Vollkorn title, state pill, muted explanation) and the decision form as a second cream panel with 44px radio rows and the standard primary pill button. The outcome follows the notice rules above: a Success Wash status message after a decision, and a Danger Wash alert with the Terracotta bar when the decision is refused. The message, success link (outlined pill), back link and pager rules are shared by every admin list and form.
- **Import stepper**: numbered steps with completed state; collapses to one column below 44rem.
- **Task detail panel** (`dl`): the time, place and status of a task read as one cream panel (`--radius`, 1px Border, resting shadow) of rows, one under the other on every screen size. Each row has a small muted Karla label above a larger value, with thin sand dividers between rows and no card inside the card. The status shows as the same pill as on the task list (icon and word). The page title is Vollkorn at `--text-headline-lg`; the back link is a quiet underlined text link, 44px tall.
- **Cancellation request page** (`/szulo/feladatok/[id]/lemondas`): same header as the task detail page (the 44px `parent-back-link` above a Vollkorn `--text-headline-lg` title) and the shared cream form panel. The reason field is at least 7rem tall with a 0.75rem radius; the submit button is the standard primary pill (calm, not red). After a real request the green status confirmation and the Info Wash pending notice appear, followed by an outlined pill link back to the task. A task the family has no place in shows a quiet Info Wash notice with a Focus Blue bar. The swap request page uses the same form and notice rules.
- **Signup confirmation and notices** (task detail page and the other parent forms): the form is a cream panel. A confirmation is a Success Wash panel with a 0.35rem Success green left bar and a bold Vollkorn message; an error keeps the Danger Wash with the Terracotta bar; a notice (task full, not eligible, request waiting) is the Info Wash with a 0.35rem Focus Blue bar. The permitted allergen information is an Info Wash callout with an Ochre bar and a Vollkorn heading. The follow-up actions (swap, cancellation) are outlined pill buttons in Deep Terracotta, 44px tall, that wrap on a phone. A send in progress turns the button Muted Brown with a busy cursor.

## 5. Layout Principles

### Grid & Structure

- Content column: `min(72rem, 100% - 2rem)`, centred. Narrow single-purpose panels (sign-in, errors) max 48rem.
- Card grids: `repeat(auto-fit, minmax(min(100%, 15rem), 1fr))` with 1rem gaps.

### Whitespace Strategy

Generous. One idea per panel; do not put a card inside a card.

### Alignment & Visual Balance

Left-aligned text everywhere (including tables). Titles and actions align to the content column edge, not centred, except the sign-in panels.

### Responsive Behavior & Touch

- Mobile first; the main breakpoint is `max-width: 44rem`, with an extra tightening at `max-width: 20rem`.
- Touch targets at least 44px. Tables become card lists on phones.
- Honour `prefers-reduced-motion`: remove the card lift and transitions.
- No horizontal page scroll; only table wrappers may scroll sideways.

## 6. Design System Notes for Stitch Generation

### Language to Use

Describe the look as "warm, calm, paper-like, handmade, rounded, terracotta on cream". Avoid "sleek", "futuristic", "neon", "glassmorphism", gradients other than the single soft page glow, and dark mode (the app is light only: `color-scheme: light`).

### Color References

Always use the hex values above. Do not introduce new accent hues; extra colours belong to the status set only (green success, ochre pending, terracotta negative).

### Component Prompts

- "Pill-shaped terracotta primary button, 44px tall, white text."
- "Cream card with 1rem radius, thin sand border and a soft warm shadow; title in deep terracotta."
- "Status shown as a small icon followed by the Hungarian word, never colour alone."

### Incremental Iteration

Change one screen or one component at a time. Keep Hungarian placeholder copy and made-up sample names (never real family or student data). Every generated screen must stay readable at 320px width and keep a visible keyboard focus ring.
