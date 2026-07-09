# TrainOracle Dashboard Code Review

Date: 2026-07-09
Reviewer role: code quality reviewer, read-only for product changes
Goal: Review current unstaged dashboard changes for correctness and safety, focusing on false claims, issue closures, canonical promotion, misleading runtime evidence, broken local links, and obvious HTML/CSS problems.
Notepad path: not provided in request.

## Skill Perspective Check

- remove-ai-slops: loaded and applied as a review lens. No deletion-only tests, tautological tests, requested-removal-only tests, implementation-constant mirror tests, or unnecessary production parsing/extraction/normalization were found in the dashboard diff. No tests were added or changed by this dashboard work.
- programming: loaded and applied as a review lens. The reviewed dashboard files are static HTML/CSS/Markdown, not .py/.ts/.tsx/.go/.rs source changes. The perspective does not identify untyped escape hatches or brittle prompt tests in the changed files. The false CI metric below is a claim-accuracy problem, not a typed-code violation.

## Reviewed Scope

- DESIGN.md
- dashboard/index.html
- README.md dashboard link
- .omo/evidence/trainoracle-dashboard-visual-qa.txt
- screenshots/dashboard/mobile-375.png
- screenshots/dashboard/tablet-768.png
- screenshots/dashboard/desktop-1280.png

## Verification Performed

- `git status --short`: README.md modified; DESIGN.md, dashboard/, screenshots/dashboard/, and visual QA evidence are untracked.
- `git diff --check`: PASS, with only the README LF-to-CRLF warning.
- README dashboard link exists locally.
- Dashboard href check: 27 href attributes inspected, including the stylesheet; 0 missing local targets.
- Runtime log inspection:
  - runtime-evidence/d9-evaluator/d9-vitest-run-2026-07-09.log lines 16-17 show 1 file passed and 11 tests passed.
  - runtime-evidence/impl-skeleton/impl-vitest-run-2026-07-09.log lines 12-13 show 1 file passed and 7 tests passed.
- Source acceptance decisions inspected:
  - SPEC_SOURCE_ACCEPTANCE_DECISION_ROUND1.md lines 23-36 accept Safety Gate and RVE as working sources only, with no canonical promotion or issue closure.
  - SPEC_SOURCE_ACCEPTANCE_DECISION_ROUND2.md lines 30-33 and 79-83 accept Physio Source Trust and Daily Log as working sources only, with no canonical promotion, issue closure, runtime evidence claim, or upload permission change.
- Wave D report inspected:
  - SPEC_WAVED_BINDING_PATCH_REPORT.md lines 42-46 keep all three target issues OPEN.
  - lines 64-72 explicitly make no issue closure, count-change, runtime-evidence, or canonical-promotion claim.
- Spec metadata counts checked against dashboard rows; no count mismatch found for the listed spec open/blocking counts.
- CSS token sanity check: all CSS variables used by dashboard/index.html are defined locally or in design-v3/tokens/tokens.css.
- Screenshot artifacts opened at 375, 768, and 1280 widths; no obvious clipping, broken layout, or page-level overflow visible.
- Live Playwright rerun was not performed because `require('playwright')` is not resolvable from the repo root.

## Findings

### CRITICAL

None.

### HIGH

None.

### MEDIUM

1. `dashboard/index.html:433` overstates GitHub Actions topology as `2 jobs`.

   Evidence: `.github/workflows/ci.yml:10-44` defines a single job named `contract-tests`; that one job installs and runs both the D9 evaluator suite and the impl skeleton suite. The dashboard's "2 jobs" metric is therefore false if read as GitHub Actions jobs. This is not a runtime pass-count problem, but it is a dashboard claim accuracy problem.

   Concrete patch recommendation:

   ```diff
   -          <div class="metric"><strong>2</strong><span class="chip info">jobs</span></div>
   -          <p class="caption">D9 evaluator와 impl skeleton을 PR마다 실행하도록 구성.</p>
   +          <div class="metric"><strong>2</strong><span class="chip info">suites</span></div>
   +          <p class="caption">D9 evaluator와 impl skeleton을 하나의 GitHub Actions job에서 PR마다 실행하도록 구성.</p>
   ```

   Alternative if the intended metric is workflow jobs:

   ```diff
   -          <div class="metric"><strong>2</strong><span class="chip info">jobs</span></div>
   +          <div class="metric"><strong>1</strong><span class="chip info">job</span></div>
   ```

### LOW

1. `dashboard/index.html:398` abbreviates the current branch as `dashboard-status`.

   Evidence: `git branch --show-current` returns `codex/dashboard-status`; the visual QA evidence file also records `Branch: codex/dashboard-status` at `.omo/evidence/trainoracle-dashboard-visual-qa.txt:3`. This is a minor precision issue, not a safety claim.

   Concrete patch recommendation:

   ```diff
   -        <span class="chip info">branch dashboard-status</span>
   +        <span class="chip info">branch codex/dashboard-status</span>
   ```

## Non-Findings

- No dashboard or DESIGN.md claim was found that closes an issue.
- No dashboard or DESIGN.md claim was found that promotes a draft/source document to canonical status.
- Runtime evidence links resolve locally and the referenced logs contain the claimed 11/11 and 7/7 pass counts.
- The dashboard distinguishes self-check/Markdown PASS from runtime evidence at `dashboard/index.html:615`.
- Local links are not broken.
- Korean text and heading tags are valid when read as UTF-8; earlier mojibake was a PowerShell default-decoding artifact.

## Status

codeQualityStatus: WATCH
recommendation: REQUEST_CHANGES
blockers:
- Fix the inaccurate `2 jobs` dashboard metric before approval.

