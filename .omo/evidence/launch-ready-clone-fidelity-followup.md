# TrainOracle clone/design-system fidelity follow-up

Date: 2026-07-23
Review mode: independent, read-only recheck of the two remaining blockers
Recommendation: **APPROVE**

## Scope

This follow-up rechecked only:

1. Launch UI token fidelity.
2. Visual evidence and verification-report integrity.

The earlier Korean wrapping, navigation overlap, viewport scrolling, touch-target, and desktop-default findings were not reopened. No application or design files were modified during this review.

## Resolved blocker 1 — launch UI token fidelity

**Resolved.**

- `colors_and_type.css:121-130` defines the shared launch tokens for the frame canvas, shell width, tab/date-header heights, minimum touch/action/choice sizes, plan mark, and launch title sizes.
- `DESIGN.md:77-83` documents the hosted journal token source and the app-shell component-token contract.
- `app/src/AppShell.tsx:107-111` consumes `--app-shell-max-width` for the live application shell.
- `app/src/styles/app.css:5` consumes `--app-frame-canvas`.
- `app/src/styles/app.css:55-57` maps focus styling to the semantic `--info` token.
- `app/src/styles/app.css:60-388` consumes the shared color, border, spacing, typography, shell, and touch-dimension tokens throughout the launch shell and first-visit UI.

The scoped launch surface no longer carries the raw frame/focus colors or one-off launch dimensions and type sizes that caused the original blocker. Pre-existing workspace-only and print-only declarations are unrelated to this launch diff and were not treated as launch-token regressions.

## Resolved blocker 2 — evidence integrity

**Resolved.**

- All five current captures have valid JPEG/JFIF signatures and matching `.jpg` extensions.
- Their verified dimensions are:
  - `01-mobile-welcome.jpg`: 375×667
  - `02-mobile-context.jpg`: 375×667
  - `03-mobile-plan-pending.jpg`: 375×667
  - `04-desktop-welcome.jpg`: 1330×900
  - `05-narrow-welcome.jpg`: 320×568
- The captures are newer than the tokenized source and current production build.
- `reports/implementation/LAUNCH_READY_IMPLEMENTATION_REPORT_2026-07-23.md:81-92` links all five current screenshots and the independent review artifacts.
- The desktop evidence label is correctly recorded as 1330×900 at report line 84.
- The report identifies GitHub Actions as the final raw execution evidence at lines 94 and 108.
- `.github/workflows/ci.yml:59-114` defines the app unit-test, typecheck, production-build, and Playwright browser jobs.

## Evidence inspected

- `DESIGN.md`
- `colors_and_type.css`
- `app/src/AppShell.tsx`
- `app/src/styles/app.css`
- `.github/workflows/ci.yml`
- `reports/implementation/LAUNCH_READY_IMPLEMENTATION_REPORT_2026-07-23.md`
- `.omo/evidence/launch-ready-2026-07-23/README.md`
- `.omo/evidence/launch-ready-2026-07-23/01-mobile-welcome.jpg`
- `.omo/evidence/launch-ready-2026-07-23/02-mobile-context.jpg`
- `.omo/evidence/launch-ready-2026-07-23/03-mobile-plan-pending.jpg`
- `.omo/evidence/launch-ready-2026-07-23/04-desktop-welcome.jpg`
- `.omo/evidence/launch-ready-2026-07-23/05-narrow-welcome.jpg`
- `.omo/evidence/launch-ready-athlete-ux-safety-code-review.md`
- `.omo/evidence/launch-ready-athlete-ux-safety-followup-code-review.md`
- `.omo/evidence/launch-ready-privacy-scope-recheck-code-review.md`
- `.omo/evidence/launch-ready-clone-fidelity.md`

## Final verdict

No CRITICAL or HIGH blocker remains in the rechecked token or evidence scope.

**APPROVE**
