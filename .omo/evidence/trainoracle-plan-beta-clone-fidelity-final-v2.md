# TrainOracle Plan Beta — Clone / Design-System Fidelity Final v2

**Verdict:** PASS

**Recommendation:** APPROVE

**Review date:** 2026-07-24
**Worktree:** `D:\admin\Documents\TRAINORACLE-plan-beta`
**Current visual evidence:** `.omo/evidence/plan-beta-2026-07-24`

No product files were edited during this review. This report is based only on the current source bytes and the latest 42 PNG bytes.

## Final recommendation

APPROVE. The previous HIGH token-compliance blocker is resolved, the superseded incomplete first-context captures have been replaced, and no CRITICAL, HIGH, MEDIUM, or LOW blocker remains.

The current implementation is a live, reusable React design-system surface rather than a screenshot fake or one-off hardcoded clone. The latest production-preview evidence is complete across all 14 states and all three required viewport sizes.

## Findings by severity

### CRITICAL

None.

### HIGH

None.

### MEDIUM

None.

### LOW

None.

## Resolved findings

### Previous HIGH — Home Plan entry used one-off inline spacing

Resolved.

- `app/src/screens/Home.tsx:161-170` now renders the Plan entry through the semantic `.home-plan-entry` class; the former inline `padding: "10px 20px 0"` is absent.
- `app/src/styles/app.css:75-77` defines `padding: var(--space-3) var(--space-5) 0`.
- Both spacing values map to the 4px token scale in `DESIGN.md`; there is no duplicate literal or off-grid 10px value in this entry layout.

### Superseded evidence issue — incomplete first-context transition captures

Resolved in the current bytes.

- `13-first-context-desktop.png` SHA-256: `a5b90c30787290b9ed6bf2053248a28402e3e4bf98fae01eb169709b1585d516`
- `13-first-context-mobile.png` SHA-256: `7d620ecf2d1bf01908ad6d1e9255947c218980aebb25c0f6651ac515548c7886`
- `13-first-context-narrow.png` SHA-256: `f8be92225c0a1c669e7749118869ec6f1d72107e4cb6b98454353e066e7b9c8b`

All three current images show the complete heading, explanatory copy, four icon-led choices, helper text, back/skip controls, and unobstructed bottom navigation. The earlier blank transition frames are not used for this verdict.

## Evidence integrity

Independent byte inspection agrees with both current audit files:

| Check | Result |
|---|---|
| PNG count | 42 |
| `1330x900` | 14 |
| `393x852` | 14 |
| `320x568` | 14 |
| PNG signatures | 42 valid |
| Duplicate SHA-256 payload groups | 0 |
| Capture surface | `vite-production-preview` |
| Latest rendered source mtime | `2026-07-24T00:13:00.598Z` |
| Oldest retained PNG mtime | `2026-07-24T00:14:44.341Z` |
| Replacement state-13 mtimes | `2026-07-24T00:20:40.993Z`–`00:20:44.409Z` |
| Audit generation time | `2026-07-24T00:21:19.846Z` |
| All PNGs newer than rendered sources | true |
| React Scan / React Grab production overlays | absent |

The current `png-audit-final.json` and `png-audit-final-v3.json` agree with the files on disk.

## Original-resolution visual review

Every current PNG was opened at original resolution.

| State | Viewports | Result |
|---|---|---|
| 01 first visit | desktop/mobile/narrow | PASS — both primary actions remain fully visible and reachable; privacy, safety, and points helpers are complete. |
| 02 goal | desktop/mobile/narrow | PASS — hierarchy, choice geometry, progress, and fixed navigation are coherent. |
| 03 experience | desktop/mobile/narrow | PASS — title, helper, and three choices wrap without clipping or orphaned glyphs. |
| 04 available days | desktop/mobile/narrow | PASS — the narrow title uses a natural two-line break; choice rows remain intact. |
| 05 frame length | desktop/mobile/narrow | PASS — all three frame choices and explanatory copy remain readable. |
| 06 current safety check | desktop/mobile/narrow | PASS — the long risk option wraps as a semantic phrase without clipping or overflow. |
| 07 blocked | desktop/mobile/narrow | PASS — safety stop, record action, retry action, and bottom navigation remain reachable. |
| 08 candidates top | desktop/mobile/narrow | PASS — source/confidence disclosure and the first candidate render with correct hierarchy. |
| 08b candidates middle | desktop/mobile/narrow | PASS — the first selection action and second candidate boundary visibly establish a distinct middle scroll state. |
| 09 candidates bottom | desktop/mobile/narrow | PASS — the second candidate payload and terminal selection action remain above navigation. |
| 10 active top | desktop/mobile/narrow | PASS — local-storage/safety copy wraps naturally; narrow actions use the intended two-column geometry. |
| 11 active middle | desktop/mobile/narrow | PASS — distinct mid-list sessions and progress controls are visible without horizontal overflow. |
| 12 active bottom | desktop/mobile/narrow | PASS — continuity copy and next-frame action remain complete and reachable above navigation. |
| 13 first-context chooser | desktop/mobile/narrow | PASS — all four choices, labels, helpers, and icons are fully composited and unobstructed. |

### Typography roles

- Korean helper prose uses the sans body role, including `app/src/styles/app.css:256-260`, `app/src/styles/app.css:362-370`, and `app/src/styles/plan-beta.css:376-382`.
- Compact labels and quantitative values alone use the mono role.
- `app/src/styles/plan-beta.css:384-388` narrows mono typography to `.plan-session-metric`.
- The current screenshots visibly distinguish display headings, body/helper copy, and mono metadata.

### Intrinsic geometry and overflow

- `app/src/styles/plan-beta.css:348-355` uses `max-content minmax(0, 1fr)` for session rows.
- `app/src/styles/plan-beta.css:413-415` adds the intrinsic status column at wider widths.
- `app/src/styles/plan-beta.css:498-509` moves status below text and switches actions to two columns at narrow widths.
- Only the documented responsive breakpoints use raw pixel values in `plan-beta.css`; colors, spacing, typography, borders, and touch geometry use tokens.
- No reviewed screenshot shows horizontal scrolling, right-edge clipping, missing descenders, tofu glyphs, or content trapped behind navigation at its terminal scroll position.

### Scroll-state and payload distinction

- Candidate captures 08, 08b, and 09 are visually distinct top, middle, and bottom states.
- Active-plan captures 10, 11, and 12 are visually distinct top, middle, and bottom states.
- All 42 SHA-256 payloads are unique.
- Candidate variants contain different live session structures; they are not repeated screenshot payloads.

### Touch and navigation reachability

- The fixed four-item navigation remains visible and unobstructed at all viewports.
- Choice rows, primary actions, Plan selection actions, progress controls, back/skip controls, and continuation actions remain reachable.
- The narrow active-plan action grid retains practical touch geometry while avoiding horizontal compression.
- Terminal actions in states 07, 09, 12, and 13 are visibly above the navigation boundary.

## Design-system and implementation integrity

### Real component tree

PASS.

- `app/src/AppShell.tsx` routes the live Home, Plan, Record, Trends, and secondary Guide surfaces.
- `app/src/screens/PlanBeta.tsx` renders intake, candidate, blocked, and active states from React state and domain results.
- `app/src/screens/plan-beta/PlanIntake.tsx` reuses the Choice primitive.
- `app/src/screens/plan-beta/PlanCandidates.tsx` reuses candidate/session structures.
- `app/src/screens/plan-beta/ActivePlan.tsx` renders live session rows and progress actions.
- Source inspection found no raster screenshot, `<img>` clone, canvas substitute, `background-image`, or encoded image payload standing in for the reviewed interface.

### Token-driven styling

PASS.

- `app/src/styles/plan-beta.css` contains no raw hex, RGB, HSL, gradient, shadow, or background-image declaration.
- Spacing, colors, typography, borders, action sizes, and choice sizes resolve through the documented token layer.
- The fixed Home-to-Plan entry now uses `--space-3` and `--space-5`.
- The surface remains consistent with the `DESIGN.md` borders-only depth contract.

### Layer and layout structure

PASS.

- The DOM hierarchy follows the documented app shell, intake, candidate comparison, active timeline, safety stop, and points-strip primitives.
- Adjacent bordered sections are used instead of nested decorative cards.
- Responsive changes preserve content order and interaction meaning rather than replacing the interface with viewport-specific one-off compositions.

## Truthful source and safety copy

PASS.

- Plan generation supports the disclosed profile-only path and structured recent-journal context path.
- Current risk and recent structured journal risk route through the safety evaluation before candidate creation.
- Invalid/future journal dates are not labeled as recent context.
- Candidate copy discloses limited confidence and does not claim exact pace, readiness, medical clearance, or diagnosis.
- Private memo prose is not represented as a prescription input.
- Active-plan copy truthfully describes browser-local persistence, non-medical status, missed-day handling, and the absence of automatic intensity progression.
- Progress actions do not award load/compliance points or clear a safety stop.

## Verification

- `npm.cmd run typecheck`: PASS.
- Focused Vitest run: PASS — 3 files, 19 tests.
- Current production build artifacts exist for the reviewed source state.
- Current screenshots identify the capture surface as Vite production preview.

## Evidence inspected

- `DESIGN.md`
- Current Git worktree status and full relevant diff
- `app/src/screens/Home.tsx`
- `app/src/styles/app.css`
- `app/src/styles/plan-beta.css`
- `app/src/AppShell.tsx`
- `app/src/screens/PlanBeta.tsx`
- `app/src/screens/home/FirstPage.tsx`
- `app/src/screens/plan-beta/PlanIntake.tsx`
- `app/src/screens/plan-beta/PlanCandidates.tsx`
- `app/src/screens/plan-beta/ActivePlan.tsx`
- `app/src/domain/plan-beta-flow.ts`
- `impl/src/plan-generator/*`
- `.omo/evidence/plan-beta-2026-07-24/png-audit-final.json`
- `.omo/evidence/plan-beta-2026-07-24/png-audit-final-v3.json`
- All 42 current PNG files in `.omo/evidence/plan-beta-2026-07-24`

## Blockers

None.

## Final

**PASS / APPROVE**
