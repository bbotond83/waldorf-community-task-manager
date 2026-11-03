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
- Font: the system UI stack (`ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`). No webfonts; keep it that way for speed and privacy.
- **Page title (h1)**: `clamp(2rem, 5vw, 4rem)`, line-height 1.08.
- **Card title**: about 1.35rem, weight 750, Deep Terracotta.
- **Eyebrow**: 0.82rem, weight 750, uppercase, 0.08em letter-spacing, Deep Terracotta; sits above a title.
- **Body**: base size, line-height 1.55.
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
- Radius `1rem` (`--radius`), 1px Border, Cream Surface, soft shadow (`0 12px 36px` warm brown at 12% opacity).
- Clickable cards (profile, parent, admin, teacher cards): hover raises 2px with a Terracotta border and Info Wash fill; pressed returns to level with Danger Wash. Whole card is the hit target.
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
- **Data tables (teacher)**: caption in bold, cells padded 0.85rem with a top border, inside a rounded scrollable wrapper. On narrow screens, rows turn into stacked cards.
- **Import stepper**: numbered steps with completed state; collapses to one column below 44rem.
- **Detail grids** (`dl`): term/definition pairs in two columns on wide screens, one column on phones.

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
