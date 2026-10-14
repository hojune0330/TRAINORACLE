# Calendar and date UI delivery — 2026-10-14

## Scope and design basis

Source baseline: `38c380851dad0d0d48e8a70d19c39cb9c29b8226`.
Implemented locally; this report is not a deployment or authenticated-account receipt.

Used lean-delivery and ui-ux-pro-max. Subsequently read the complete
design-toss-card-ui SKILL.md supplied through the coordination message. After local
installation, read `C:/Users/admin/.codex/skills/design-toss-card-ui/SKILL.md` plus
all four references (cross-media, visual-references, qa, trainoracle) completely.
Existing product contracts and tokens
remain authoritative. Updated visual standard §8.8 and AGENTS guidance accordingly.

## Shared changes and coverage

- MonthCalendar: remove ruled empty cells; category-specific selection fill and
  heavier date text; today retains outline/underline independently; grouped month
  navigation; responsive native month/date jump panel with Escape/focus return.
- JournalMonthCalendar: default short record-count overview, optional full training
  classification. Actual record descriptions, private-text exclusion, day reader,
  account scope, previous/next records and return position are unchanged.
- Shared calendar consumers: journal monthly/cycle archive, recommendation preview,
  dated/adjusted plans, intake peek, full plan schedule, Oracle-linked journal,
  decoration preview, empty example. Journal consumers explicitly use journal color.
- Date rail: training identity, selected outline/fill, independent today underline.
  No date arithmetic, automatic scrolling logic or prescription changes.
- Native date/month inputs: shared radius, surface, minimum height, font and focus
  styles. Existing native pickers, labels, min/max, disabled/validation and handlers
  remain intact. Context-specific field layouts are retained, not rewritten.
- Existing category choices: reserved visual check space in both states; no added
  accessible text or changed accessible names. Disabled destination-card appearance.
- Reused existing colors, typography and radii; no new palette or font asset.

Date-field inventory included athlete records, account draft, coach support, cycle
anchor, Oracle conditions/friend comparison/record reading, quick and goal plans,
plan intake/candidates/rebuild/next variants, and file-analysis range controls.
This is shared-style coverage, not a claim of separate visual inspection of each form.

## Evidence

- Application TypeScript: passed.
- Browser-test TypeScript: passed after adding a readonly tuple annotation to the
  pre-existing category-navigation test; no runtime assertion changed.
- Visual-system contract: 13 tests passed.
- Calendar behavior/role colors/return/account-scoped position: 25 tests passed.
- Dedicated browser test: passed at 320/375/1280px; minimum 44px date hit targets,
  no document horizontal overflow, compact/detail switch, reader focus return,
  Escape and leap-day jump, morning/afternoon labels preserved.
  Also inspected 200% calendar text at 320px with reduced motion enabled; no
  horizontal overflow. This is browser text enlargement, not physical iOS testing.
- Fault injection: changed Escape comparison only in Vite's test transform.
  `calendar overview stays compact, readable and reversible without losing training slots`
  failed at the open date-input assertion; unmodified rerun passed. No fault written
  to production source.
- Existing category-navigation browser test: passed across home/journal/training/
  Oracle, including edit entry and unchanged saved-plan bytes.
- Screenshots inspected: journal 320/375, training 320, expanded date tools 320,
  actual application journal 375. Caught and corrected date/adornment width accounting.
- Initial sandbox test startup failed with Windows realpath EPERM; same focused
  tests were subsequently run outside that filesystem restriction. Initial test-only
  fixture import path was corrected before passing browser verification.

Reproduce: from app, `node e2e/run-calendar-ui.mjs`; use `--fault` for the intentional
failure. Dedicated config is separate from built-preview tests because its fixture
imports actual source modules. Synthetic data only; requests outside loopback blocked.
Captures: `.scratch/calendar-ui/after/` and `.scratch/category-check-20261014/after/`.

## Boundaries

No schema, persisted date, timezone rule, role classification, dosage, ownership,
purchase, decoration coordinates, or account service changed. No dependencies installed.
No new image assets needed for calendar controls. No source push, merge, deployment,
full CI or authenticated account/iPhone-device round trip performed for this patch.
Full-product visual conversion is not complete merely because shared primitives changed.
