# TrainOracle Design System

## 1. Atmosphere & Identity

TrainOracle feels like a coach's control room for serious training work: calm, dense, accountable, and easy to scan every day. The signature is a document-first command surface that connects safety, evidence, and planning without decorative noise.

## 2. Color

The SPEC dashboard consumes `design-v3/tokens/tokens.css`. The hosted journal app keeps its established root `colors_and_type.css` and `colors_and_type_journal.css` sources until token consolidation is explicitly approved. Both surfaces use the same semantic names below; UI files consume those names instead of adding raw colors.

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

### App Shell
- Structure: one centered training surface with a fixed four-item bottom navigation.
- Width: fills the viewport up to 520px; desktop visitors see the same real app unless `?workspace=1` is present.
- Tokens: consumes the root journal token files through `app/src/main.tsx`; no duplicate token declarations in app components.
- Component tokens: `--app-frame-canvas`, `--app-shell-max-width`, `--app-tab-height`, `--app-date-header-height`, `--app-touch-min`, `--app-action-height`, `--app-choice-height`, `--app-plan-mark-size`, `--app-dialog-max-width`, `--fs-app-title`, and `--fs-app-section-title`.
- Primary navigation: Home, Plan, Record, Trends. Guide remains a secondary route from Home and first-visit examples.
- States: first visit, empty journal, populated journal, plan intake, plan candidates, active plan, entry form, trends, guide.
- Compact-height rule: at widths up to 340px and heights up to 650px, first-visit vertical spacing may tighten while both primary actions retain their full touch height.
- Narrow plan rules: up to 340px the points strip may stack; up to 380px active-plan status moves below its session text and progress actions use two columns.
- Accessibility: the main scroll region and bottom navigation remain distinct landmarks.

### Primary Action
- Structure: icon, short command label, optional factual helper text.
- Surface: `--ink` background with `--bg` text; square corners and no shadow.
- States: default, pressed, focus-visible, disabled.
- Accessibility: minimum 44px touch height and a complete accessible name.

### Choice Row
- Structure: icon, one-line choice, one-line consequence, trailing chevron.
- Surface: `--surface` with `--ink`/`--hair` separators.
- States: default, pressed, focus-visible.
- Accessibility: each row is an independent button because onboarding choices are transient navigation, not stored form values.

### Fact Receipt
- Structure: saved-state heading, one current local fact, optional secondary saved fact, optional destination action.
- Variants: pain, mood, distance, generic local save, review-required.
- Surface: `--ink` with `--bg` text; review-required uses the existing review copy and remains dismissible.
- Accessibility: `status` for ordinary receipts and `alert` only for review-required content.
- Content rule: never invent a score, threshold, readiness, diagnosis, safety clearance, or plan output.

### Service Pending Panel
- Structure: service name, plain status, honest scope explanation, journal action, back and skip controls.
- Surface: borders-only using `--surface` and `--line`.
- Accessibility: no waitlist, request, profile, or identity input is present.

### Plan Intake Step
- Structure: one decision question, contextual help trigger, two to four full-width Choice Rows, progress label, back action.
- Surface: unframed page band using `--surface`, `--line`, and existing action tokens.
- States: goal, experience, current-risk check, non-selectable plan-shape preview, training focus, available days, frame length, training time, session count.
- Preview rule: after the user explicitly chooses an event, answers the competition division question when applicable, answers the experience question, and gives a clear current-risk answer, the preview appears showing only the selected direction and the future A/B comparison shape. Label it `계획 형태 미리보기`, state that it is not a plan, list every remaining required choice, and persist nothing. Review-required, D9 ACTIVE, and D9 UNKNOWN states show no preview.
- Content rule: the training-focus step shows recovery, base, LT, VO2, speed-endurance, and short acceleration intentions in plain Korean. It states what the answer changes in the generator and discloses important limits such as no personal-pace calculation.
- Accessibility: one question per screen; current selection is exposed with `aria-pressed`; the preview has no selection control or generated-plan semantics; no hidden required fields.

### Plan Candidate Comparison
- Structure: compact A/B summary before source/confidence and date details, candidate name, factual training/easy/quality/rest day counts, ordered session list, select action.
- Variants: `BALANCED`, `CONSERVATIVE`.
- Surface: candidates are adjacent bordered sections, not cards inside a card.
- Disclosure rule: candidate A's schedule is expanded initially and B's is collapsed. One local expanded-candidate ID allows expanding either schedule, collapses the other, and allows both to be collapsed without changing either candidate's data.
- Content rule: each training day shows total duration, RPE range, planned training intention, and an execution disclosure. The public beta may show a selected LT/VO2/speed-endurance/short-acceleration *intention*, but never presents it as a measured physiological state. Sparse-data candidates never invent exact pace, interval distance, repetition count, recovery duration, readiness, medical clearance, or training history. Exact numeric sessions appear only after a reviewed source-backed template and athlete-specific gate are active.
- Accessibility: each candidate has a heading, a complete difference description, one unique selection button, and a semantic schedule button with an honest accessible name plus `aria-expanded`/`aria-controls`.

### Context Help Trigger
- Structure: the existing 44px `TermHelp` trigger immediately follows the question or term it explains.
- Surface: 14px visible question mark with the existing border-only Popover.
- Content rule: explain the concrete consequence first, then boundaries or exclusions. Help text never changes plan or safety state.
- Accessibility: the accessible name uses the visible concept followed by `설명 보기` or `설명 닫기`; `aria-expanded` exposes state.

### Plan Session Prescription
- Structure: session name, factual numeric prescription, intent label, and native `details` execution disclosure.
- Intent states: recovery, `BASE(기초 지구력)`, LT, VO2, speed endurance, short acceleration, and mixed intent.
- Content rule: current public beta shows only generator-owned duration and RPE values. The selected intent is a planning label, not a physiological measurement or a medical/safety judgment. Unknown pace, repetitions, distance, recovery, and exact numeric session structure remain unassigned until the reviewed template and athlete-specific gate are active.
- Accessibility: execution guidance is available without hover and remains readable at 320px.

### Training Notation Reader
- Structure: one locally held text input, a parse action, an unframed fact list, and a boundary disclosure.
- Surface: uses the existing plan page band, `--surface`, `--line`, `--hair`, `--sans`, and `--mono` tokens; no card nesting, shadow, or decorative treatment.
- Content rule: show only notation-derived set, repetition, distance or duration, and recovery facts. State clearly that the reader does not calculate a personal pace, create a plan, activate a draft template, persist the input, or make a safety judgment.
- Accessibility: input has a visible label, parse errors use `alert`, result facts are in an announced region, and the boundary disclosure uses native `details`.

### Active Plan Timeline
- Structure: frame identity, source/confidence state, ordered day rows, one progress action per planned session, next-frame continuity note.
- Progress states: planned, completed, rested, skipped, pain check-in.
- Safety: progress never clears a Safety Gate state and never grants a training-load reward.
- Accessibility: state is always text plus icon; color is secondary.

### Oracle Points Strip
- Structure: current non-economic point total, safe recording continuity, one plain next-action sentence.
- Earn sources: one daily visit and one eligible journal day; rest and pain/injury records count.
- Forbidden meaning: distance, pace, load, plan compliance, safety clearance, consent, money, ranking, or coach authority.
- Accessibility: no loss animation, shame copy, countdown pressure, or color-only status.

### Journal Confirmation Surface
- Structure: one fixed, border-only panel with a factual consequence, Cancel, and one explicit destructive action.
- Surface: `--bg`, `--ink`, `--hair`, and the existing error token; no shadow, glow, gradient, or nested card.
- Scope: reversible journal deletion uses this surface; safe restoration remains a direct action, while permanent deletion keeps its separate two-step confirmation.
- Accessibility: `alertdialog`, labelled title and description, Cancel receives initial focus, Tab remains inside, Escape and backdrop cancel, cancellation returns focus to the invoking control, and confirmed deletion moves focus to Undo.
- Touch: every action is at least `--app-touch-min` and the panel must fit a 320px viewport without horizontal overflow.

## 6. Motion & Interaction

The dashboard is mostly static. Interactions are limited to native links and `details` disclosure rows. Hover and focus states use color and underline changes only. Do not animate layout. Respect reduced motion by having no required motion.

## 7. Depth & Surface

Strategy: borders-only. Use `--hair`, `--line`, and tonal shifts from `--surface` or `--surface-2`. No shadows, no glow, no decorative gradients, no nested cards.
