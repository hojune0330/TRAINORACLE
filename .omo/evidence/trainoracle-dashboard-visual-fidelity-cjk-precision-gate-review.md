# TrainOracle Dashboard Visual Fidelity and CJK Precision Gate Review

recommendation: REJECT

## originalIntent

Review the static TrainOracle dashboard from the user's perspective. The dashboard should be readable in Korean, dense but calm, free of incoherent UI overlap, free of page-level horizontal overflow, and free of clipped CJK text. Oversized SVG and table content may horizontally scroll only inside deliberate wrappers.

## desiredOutcome

Approve only if the provided screenshots and source show:

- Korean headings/body text are readable and not clipped.
- No incoherent overlap.
- No page-level horizontal overflow at 375, 768, or 1280 px.
- Long SVG/table content is clipped only inside `.chain-wrap` or `.table-wrap`.
- Dashboard density and hierarchy fit an operational SPEC dashboard.
- No emoji/icon slop, decorative gradients, or harmful CJK wrapping.
- Required final-gate artifacts and review coverage are present and supported.

## checked artifact paths

- `D:/admin/Documents/트레인 오라클 진도/dashboard/index.html`
- `D:/admin/Documents/트레인 오라클 진도/DESIGN.md`
- `D:/admin/Documents/트레인 오라클 진도/design-v3/tokens/tokens.css`
- `D:/admin/Documents/트레인 오라클 진도/screenshots/dashboard/mobile-375.png`
- `D:/admin/Documents/트레인 오라클 진도/screenshots/dashboard/tablet-768.png`
- `D:/admin/Documents/트레인 오라클 진도/screenshots/dashboard/desktop-1280.png`
- `D:/admin/Documents/트레인 오라클 진도/.omo/evidence/trainoracle-dashboard-visual-qa.txt`

Consulted skills:

- `omo:remove-ai-slops`
- `omo:programming`
- `omo:frontend`
- `omo:frontend/references/design/README.md`
- `omo:frontend/references/design/redesign-skill.md`
- `omo:frontend/references/perfection/README.md`

## userOutcomeReview

The Korean user-facing text renders correctly in the supplied screenshots and in a strict UTF-8/browser read. Independent browser text samples returned:

- `스펙, 런타임 증거, 남은 이슈를 한눈에 보는 현황판`
- `현재 결론`
- `실제 실행 증거`

Independent browser metrics matched the supplied page-level overflow claim:

| viewport | scrollWidth | clientWidth | page overflow | local long-content wrappers |
|---|---:|---:|---|---|
| 375 | 375 | 375 | none | table wrappers and chain wrapper overflow internally |
| 768 | 768 | 768 | none | table wrappers and chain wrapper overflow internally |
| 1280 | 1280 | 1280 | none | wrappers fit or contain their own content |

Visual density, color restraint, typography hierarchy, and dashboard structure are broadly aligned with `DESIGN.md`: calm operational layout, semantic status chips, borders-only dashboard surfaces, no visible emoji icons, and no decorative gradients in the dashboard page itself.

However, the shipped desktop artifact does not satisfy the no-overlap requirement. At 1280 px, source-card heading text overflows outside its panel and visibly collides with the next card area. This is not inside an allowed scroll wrapper.

## blockers

1. Visible desktop card-heading overflow violates the user's no-overlap criterion.

   Evidence:

   - Source card grid is four columns at desktop: `dashboard/index.html:141` and `dashboard/index.html:539`.
   - Long headings are plain `h3` text without wrapping/overflow protection: `dashboard/index.html:548` and `dashboard/index.html:560`.
   - Browser DOM overflow scan at 1280 px:
     - `RULE_VALIDATION_ENGINE_CONTRACT.md`: `overX=54`, `overflowX=visible`, rect `x=349 y=1130 w=266 h=20`.
     - `DAILY_LOG_AND_CHECKIN_SPEC.md`: `overX=7`, `overflowX=visible`, rect `x=981 y=1130 w=266 h=20`.
   - Zoomed desktop crop confirms `RULE_VALIDATION_ENGINE_CONTRACT.md` runs out of its card and collides with the next card's left edge.

   This fails check 2. The allowed exception covers long SVG/table content inside deliberate scroll wrappers only, not card headings.

2. Required gate artifacts and report coverage are missing or insufficient.

   Evidence gaps:

   - No original executor diff/change packet was provided in the review request.
   - No changed-files list was provided beyond the files to inspect.
   - No scoped code review report was provided for this dashboard visual change.
   - No code review report explicitly covers the required `remove-ai-slops` overfit/slop pass and `programming` criteria for this scope.
   - No notepad path was provided.
   - `.omo/evidence/trainoracle-dashboard-visual-qa.txt` exists and records screenshot/browser checks, but it is not a final code review report, does not contain the required slop/programming coverage, and missed the per-element desktop text overflow above.

## remove-ai-slops direct pass

No production test diff was present in this visual review scope, so deletion-only tests, tests that merely verify removal, tautological tests, implementation-mirroring tests, and unnecessary production extraction/parsing/normalization were not directly present in the inspected source.

The existing visual QA artifact is nevertheless incomplete from a false-confidence standpoint: it reports no clipping/overflow from page-level metrics and screenshots, but does not perform or disclose per-element overflow checks. The direct browser scan found a visible overflow blocker. This makes the existing evidence insufficient for approval.

## programming direct pass

No `.py`, `.pyi`, `.rs`, `.ts`, `.tsx`, `.mts`, `.cts`, or `.go` files were in the user's inspection set. The `programming` skill was consulted as required by the gate, but no language-specific source rule applied to the inspected HTML/CSS/Markdown scope. The missing scoped report coverage remains a blocker under the final-gate instructions.

## exact evidence gaps

- Missing scoped code review report with explicit `remove-ai-slops` and `programming` coverage.
- Missing executor evidence packet and changed-files/diff summary for the dashboard branch.
- Missing notepad path.
- Missing manual QA matrix beyond a prose visual QA note.
- Existing QA did not include a per-element overflow scan, which would have found the desktop source-card heading overflow.

## final decision

REJECT
