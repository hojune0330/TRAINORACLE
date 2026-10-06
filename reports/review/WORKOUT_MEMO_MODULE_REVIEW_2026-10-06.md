# Workout Memo Follow-Up Review

Date: 2026-10-06
Scope: plain-language replacements, compact layout, modular extension readiness.
Status: implemented and locally verified.
Deployment: not requested in this follow-up; no push or production write.

## Findings and Changes

| Finding | Change |
| --- | --- |
| RP/RPE/Build-up/Walk/Jog require prior knowledge | Plain wording derived from structured targets/recovery, keeping familiar distance and pace notation. |
| An effort cue may contain a stop qualifier | Plain formatting replaces only the matched RPE phrase and preserves other cue text. Existing coach style is unchanged. |
| Fractional repeats or invalid recovery can produce plausible output | Reject invalid counts/numbers and malformed support before exporting. |
| Rest title could follow an inconsistent session role | The REST prescription explicitly determines its memo title. |
| Zero stored strides still show a strides line | Preserve the stored preparation without adding a zero-repetition acceleration task. |
| Short memo risks omitting preparation/recovery/safety | Compact changes spacing/emphasis only. All content is retained. |
| Layout changes can reuse a stale exported PNG | Include layout in the export cache/invalidation key. |
| Adjusted/mixed sequences can carry corrupt repetition or target values | Reuse the established sequence parsers and reject nonfinite calculated targets before creating a memo. |
| Large text on a narrow compact row breaks phrases excessively | Preserve word boundaries and use stacked labels/values at 340px and below. |
| Future decoration could fork the data or obscure targets | Separate snapshot, layout, read-only sheet and export. Specify a separate decorative rail, not an overlapping editor. |

## Product Shape

- Both modes are visible at entry: `쉽게 보기` (Full) and `간단하게 보기`
  (Compact). One click both selects the mode and opens the paper.
- No preliminary memo-opening action, extra question or navigation layer.
- Paper swatches and Copy / Save / Share keep their existing behavior.
- Source basis and planned/historical state remain visible in both layouts.
- No new prescription, new storage, online mutation, point reward or AI generation.

## Extension Readiness

The current tool has two implemented layouts. Decorated memo is a prepared next
extension, not a shipped editor or visible placeholder. Reuse the registered
presentation, `WorkoutMemoSheet` and PNG output; retain all prescription content.

The contract specifies catalog ownership/license checking, a nonoverlapping
ornament rail, safe fallback, private-data exclusion and export parity. It does
not authorize changing diary decoration purchases, points or storage contracts.

## Verification

- TypeScript: exit 0.
- Six focused files: 78 tests passed, exit 0. Includes shared coach notation,
  native training reader, historical diary reader and calculator navigation.
- Browser: 18 layout/color/viewport combinations across 320, 375 and 1024px;
  no horizontal overflow and no page errors.
- Both layouts: 200% text check passed; reduced motion respected; keyboard layout
  switching, copy, native reader Back and calculator return checked.
- Actual full and compact PNG downloads inspected. Full: 1080 x 1530px; compact:
  1080 x 1062px. Self-hosted Pretendard loaded; no clipped safety or recovery text.
- Synthetic example at 375px: full paper height 718.94px, compact 566.98px,
  approximately 21% shorter without removing prescription content. This is one
  example, not an assertion about every possible workout.
- Defect injection: temporarily removed compact-layout warnings in the real
  presentation function. The named compact-content preservation test failed with
  the four missing stop conditions shown in the diff (exit 1). Restored the exact
  original function immediately.
- Final memo recheck after the adjusted-sequence guard: 2 files, 27 tests passed,
  exit 0. These tests overlap the earlier 78; do not add the run counts together.

Evidence: `evidence/workout-memo-20261006/browser-result.json`, both layout
screenshots and `exported-workout-memo-yellow[-compact].png`.

No full-suite, remote CI, new production build or deployment was run for this
isolated follow-up. Real mobile share-sheet testing remains outstanding.

Local preview: http://127.0.0.1:4466/e2e/fixtures/workout-memo.html

## Follow-Up: Direct Entry Controls

The previous controls were inside a closed disclosure and labeled Full / Compact,
so users could not immediately find the compact view. Replaced the disclosure
entry with two permanently visible controls. The paper is opened by the selected
control and can be collapsed independently; collapse cancels a pending PNG export.

- Focused UI tests: 13 passed, exit 0, including direct compact entry, reopening,
  pending-export cancellation, scope invalidation and existing export actions.
- TypeScript: exit 0.
- Browser: direct one-click entry verified before opening; 18 viewport/layout/
  paper cases passed with text enlargement, keyboard switching, downloads and Back.
- `memo-entry-320.png` directly inspected: both choice labels visible with no
  prerequisite action. Updated `browser-result.json` records direct entry.
- The old local server had stopped. Restarted Vite on loopback port 4466 and
  repeated the browser checks successfully. No production deployment or account write.
