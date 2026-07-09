# TrainOracle Dashboard Design-System and Functional Integrity Gate Review

recommendation: REJECT

## originalIntent

Verify the static dashboard at `dashboard/index.html` from the coach/user perspective. The dashboard should expose SPEC status, runtime evidence, Wave D patches, issue registry, and the D9 -> RVE -> Safety Gate -> Plan Generator chain. It must be a real DOM/SVG implementation using `design-v3` tokens and the root `DESIGN.md`, avoid fake screenshot UI, avoid issue-closure/draft-promotion/runtime-evidence overclaims, and remain responsive.

## desiredOutcome

Approve only if:

- The shipped artifact is real DOM/SVG/table/link content, not a pasted mock screenshot.
- The expected dashboard sections are present and readable.
- Safety claims are scoped correctly: no issue closure, no canonical promotion, no invented runtime evidence.
- Wide SVG/table content is horizontally contained inside local wrappers without page-level overflow.
- Design-system usage follows `DESIGN.md` and `design-v3/tokens/tokens.css`.
- Review artifacts include supported QA/review evidence, including the required overfit/slop and programming-perspective checks.

## checked artifact paths

- `DESIGN.md`
- `dashboard/index.html`
- `design-v3/tokens/tokens.css`
- `README.md`
- `screenshots/dashboard/mobile-375.png`
- `screenshots/dashboard/tablet-768.png`
- `screenshots/dashboard/desktop-1280.png`
- `.omo/evidence/trainoracle-dashboard-visual-qa.txt`
- `runtime-evidence/d9-evaluator/d9-vitest-run-2026-07-09.log`
- `runtime-evidence/impl-skeleton/impl-vitest-run-2026-07-09.log`
- `.github/workflows/ci.yml`
- `SPEC_WAVED_BINDING_PATCH_REPORT.md`
- `SPEC_SOURCE_ACCEPTANCE_DECISION_ROUND1.md`
- `SPEC_SOURCE_ACCEPTANCE_DECISION_ROUND2.md`
- `SPEC_WORK_STATUS.md`
- `.omo/evidence/trainoracle-dashboard-visual-fidelity-cjk-precision-gate-review.md`

Consulted review skills/references:

- `omo:remove-ai-slops`
- `omo:programming`
- `omo:frontend`
- `omo:frontend/references/design/README.md`
- `omo:frontend/references/perfection/README.md`

## userOutcomeReview

Direct source review confirms the core dashboard implementation is real DOM/SVG:

- `dashboard/index.html:8` imports `../design-v3/tokens/tokens.css`.
- `dashboard/index.html:10-383` defines local spacing/layout on top of token variables.
- `dashboard/index.html:449-521` implements the safety chain as inline SVG text/paths/rects.
- `dashboard/index.html:575-605` and `dashboard/index.html:647-677` implement native tables.
- `dashboard/index.html:693-720` implements native `details` issue registry groups.
- Static image/mock shell was not found; independent Chrome CDP scan reported `imgCount: 0`.

The required dashboard feature areas are present:

- Project snapshot and SPEC board: `dashboard/index.html:404-437`, `dashboard/index.html:567-607`
- D9 -> RVE -> Safety Gate -> Plan Generator chain: `dashboard/index.html:439-529`
- Runtime evidence board: `dashboard/index.html:609-637`
- Wave D patch table: `dashboard/index.html:639-680`
- Issue registry: `dashboard/index.html:682-723`
- Next gates: `dashboard/index.html:725-750`

Safety claims are mostly correct and supported:

- Dashboard states issues remain open: `dashboard/index.html:399`, `dashboard/index.html:735-737`, `dashboard/index.html:755`.
- Runtime evidence labels match logs: D9 log has 11 passed tests; impl skeleton log has 7 passed tests.
- Wave D report explicitly says it is not promotion/evidence/closure and keeps all three target issues OPEN: `SPEC_WAVED_BINDING_PATCH_REPORT.md:21-23`, `SPEC_WAVED_BINDING_PATCH_REPORT.md:44-46`, `SPEC_WAVED_BINDING_PATCH_REPORT.md:64-75`.
- README warns that upload/status is not canonical promotion, runtime evidence, or issue closure: `README.md:43`, `README.md:50`.

Responsive containment is partially supported:

- `dashboard/index.html:232-243` gives the SVG a local horizontal scroll wrapper.
- `dashboard/index.html:252-263` gives tables a local horizontal scroll wrapper and `min-width`.
- Independent Chrome CDP metrics found no page-level horizontal overflow and confirmed local scroll containment:
  - mobile 375: `scrollWidth=375`, `clientWidth=375`, chain wrapper `349/1180`, table wrappers `349/973` and `349/760`
  - tablet 768: `scrollWidth=753`, `clientWidth=753`, chain wrapper `719/1180`, table wrappers `719/902` and `719/760`
  - desktop 1280: `scrollWidth=1265`, `clientWidth=1265`, wrappers fit at `1231/1231`

However, the desktop source-card layout has a visible text overflow outside the allowed scroll wrappers, so the user-visible dashboard is not ready to approve.

## blockers

1. Desktop source-decision card heading overflows its card.

   Evidence:

   - Four-column source-card grid is used at desktop: `dashboard/index.html:141-143`, `dashboard/index.html:539`.
   - Long heading text is rendered as a plain `.panel h3`: `dashboard/index.html:548`.
   - Independent Chrome CDP scan at desktop width found:
     - text: `RULE_VALIDATION_ENGINE_CONTRACT.md`
     - `scrollWidth=307`
     - `clientWidth=262`
     - `overX=45`
     - `overflowX=visible`
   - The overflow is not inside `.chain-wrap` or `.table-wrap`; it is ordinary card heading content. This violates the responsive/no-overlap requirement.

2. Required final-gate review artifacts are incomplete.

   Evidence gaps:

   - No scoped dashboard code-review report was provided or found that explicitly covers the required `remove-ai-slops` overfit/slop pass and `programming` criteria.
   - No original executor evidence packet, changed-files list, or diff packet was provided in the request beyond artifact paths.
   - No notepad path was provided.
   - `.omo/evidence/trainoracle-dashboard-visual-qa.txt` exists and is useful, but it is a prose visual QA note, not a full manual QA matrix or scoped code review report; it also missed the desktop heading overflow.

## remove-ai-slops direct pass

No test changes were present in this dashboard review scope, so deletion-only tests, tests that merely verify a requested removal, tautological tests, implementation-mirroring tests, and unnecessary production extraction/parsing/normalization were not found in the inspected diff surface.

The production implementation is mostly straightforward static HTML/CSS and does not introduce fake parsing layers or speculative abstractions. The unresolved slop/false-confidence issue is evidence quality: the existing visual QA relies on page-level overflow metrics and screenshots but misses per-element overflow in ordinary card text.

## programming direct pass

No `.py`, `.pyi`, `.rs`, `.ts`, `.tsx`, `.mts`, `.cts`, or `.go` files were in the dashboard inspection set. The `programming` skill was consulted as required, but no language-specific source rule applied to the inspected HTML/CSS/Markdown scope.

The missing scoped report coverage remains a gate blocker because the required final review report coverage is absent/unsupported.

## exact evidence gaps

- Missing scoped dashboard code review report with explicit `remove-ai-slops` and `programming` coverage.
- Missing executor change packet/diff summary in the review input.
- Missing notepad path.
- Missing full manual QA matrix beyond the visual QA note.
- Existing QA did not include a per-element overflow scan; the independent Chrome CDP scan found desktop `.panel h3` overflow.

## final decision

REJECT
