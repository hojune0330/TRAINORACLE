# TrainOracle Design System

## 1. Atmosphere & Identity

TrainOracle feels like a coach's control room for serious training work: calm, dense, accountable, and easy to scan every day. The signature is a document-first command surface that connects safety, evidence, and planning without decorative noise.

## 2. Color

The dashboard consumes `design-v3/tokens/tokens.css` as the product token source. Use semantic token names instead of raw colors in UI files.

| Role | Token | Usage |
|------|-------|-------|
| Background | `--bg` | Page background |
| Primary surface | `--surface` | Main panels, cards, tables |
| Secondary surface | `--surface-2` | Subtle sections and callouts |
| Primary text | `--ink` | Main headings and table text |
| Secondary text | `--ink-3` | Captions, metadata, explanations |
| Hairline | `--hair` | Soft separators |
| Strong line | `--line` | Panel borders and chart rails |
| Brand | `--brand` | Confirmed chain and accepted source accents |
| Success | `--ok` | PASS, accepted, cleared |
| Warning | `--warn` | UNKNOWN, review required, open-but-not-blocking |
| Error | `--err` | ACTIVE, blocked, canonical blockers |
| Info | `--info` | Runtime evidence and implementation status |
| Uncertainty | `--unc` | Reconstructed, unverified, review-only states |

## 3. Typography

| Level | Size | Weight | Line Height | Usage |
|-------|------|--------|-------------|-------|
| Page title | 32px | 700 | 1.15 | Dashboard title only |
| Section title | 20px | 700 | 1.25 | Major panels |
| Subsection title | 15px | 700 | 1.35 | Cards and grouped rows |
| Body | 14px | 400 | 1.55 | Default text |
| Small | 12px | 500 | 1.45 | Captions and helper text |
| Label | 10.5px | 700 | 1.3 | Uppercase metadata |
| Mono | 12px | 600 | 1.35 | Counts, IDs, hashes, paths |

Primary font: `var(--sans)`. Mono font: `var(--mono)`. UI surfaces do not use handwriting or serif styles.

## 4. Spacing & Layout

Base unit is 4px. Dashboard CSS may define local spacing aliases only as multiples of 4px.

| Token | Value | Usage |
|-------|-------|-------|
| `--space-1` | 4px | Tight inline spacing |
| `--space-2` | 8px | Compact cell padding |
| `--space-3` | 12px | Badges and small cards |
| `--space-4` | 16px | Standard panel padding |
| `--space-5` | 20px | Section gaps |
| `--space-6` | 24px | Page and grid gaps |
| `--space-8` | 32px | Major page rhythm |

Max content width is 1440px. Breakpoints: single column under 760px, two columns at 760px, dashboard grid at 1120px.

## 5. Components

### Status Chip
- Structure: inline text label with semantic class.
- Variants: `ok`, `warn`, `err`, `info`, `unc`.
- Spacing: `--space-1` vertical and `--space-2` horizontal.
- States: static display only.
- Accessibility: text label must carry the meaning; color is secondary.

### Evidence Card
- Structure: title, metric, status chip, path link, short note.
- Variants: runtime evidence, source decision, target patch.
- Spacing: `--space-4`.
- Accessibility: linked paths use real anchors.

### Issue Registry
- Structure: grouped table with document, count, blocker count, referenced issue IDs.
- Spacing: table cells use `--space-3`.
- Accessibility: native table with visible headers.

## 6. Motion & Interaction

The dashboard is mostly static. Interactions are limited to native links and `details` disclosure rows. Hover and focus states use color and underline changes only. Do not animate layout. Respect reduced motion by having no required motion.

## 7. Depth & Surface

Strategy: borders-only. Use `--hair`, `--line`, and tonal shifts from `--surface` or `--surface-2`. No shadows, no glow, no decorative gradients, no nested cards.
