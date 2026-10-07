# Luna Max Independent Persona Review

Date: 2026-10-07
Scope: current dirty source for the home, plan, quick-record, calendar, Oracle, pace, memo, and exercise-log journeys. This is an independent source review; only this report is edited.

## Evidence Boundary

- **Source-simulated, not user-tested.** The 24 personas below are synthetic. Seeded action traces were checked against visible controls and source guards; they were not played through a browser or represented as application execution.
- No external model call or shared-browser session was used. The pre-existing screenshots under `reports/review/evidence/cross-screen-clutter-20261007/` predate the current UI changes. In particular, `quick-effort-and-pain-375.png` shows the prior combined RPE/pain screen, and `log-entry-375.png` shows prior copy. They cannot verify the new question sequence. The earlier plan screenshot also predates metadata moving below the calendar.
- Focused Vitest could not collect tests. Both the initial focused run and a single-worker retry failed before collection with `EPERM` while Vite resolved `app/src/test/setup.ts` (0 tests executed). This is a test-environment failure, not a passing result or a product finding.
- Read `AGENTS.md`, `PRODUCT_NORTH_STAR.md`, `docs/UX_UI_VISUAL_STANDARD.md`, and the active/reconstruct recording, recovery, calendar-role, Oracle-reading, plan-journal, pace-tool, and workout-memo contracts. The review preserves the read-only Oracle boundary, source/date provenance, AM/PM distinction, explicit record save, and immutable prescription boundary.

## Findings

### P2 - Home can label an incomplete personal-data read as a normal example

**Evidence:** source trace in `app/src/AppShell.tsx:638`, `:640`, `:647`, and `:649-654`; label wiring at `:892`.

The personal-candidate builder excludes journal-dependent topics when `oracleHistory.journalReadComplete` is false (`:640`), but `homeSourceUnavailable` only checks the calendar and athlete-record snapshots (`:647`). With those two snapshots `READY`, a non-empty local journal still being read, and no athlete-record candidate, `homeCandidates` is empty while `homeSourceUnavailable` is false. The fallback then renders the example answer and the new label “오라클 결과 예시 보기” instead of the unavailable state. The content is explicitly an example, so it does not claim personalization; the regression is that the home conceals that the personal result is not yet available and routes the user into the example path.

**Repro:** set calendar and athlete-record snapshots to `READY`; hold `journalReadComplete=false`; provide no level candidate. Open Home. Expected: “오라클 기록 상태” / unavailable preview and a route to inspect status. Actual by source: example preview and example route.

**Fix:** include journal-read completeness in the same availability predicate used for the preview label, kind, and click route. Add a focused test for `READY` snapshots plus incomplete journal read, alongside the personal/example/fully-unavailable cases.

### P2 - Restored quick-record draft can reopen on a different active question

**Evidence:** persisted generic step and values at `app/src/screens/log-entry/QuickSessionForm.tsx:119-127` and `:147-154`; transient question state at `:369-372`; question rendering at `:421`, `:439`, `:446`, and `:458`.

`activityQuestion` and `effortQuestion` control which single question is shown, but neither is part of the draft payload. Restoration guesses the activity question from whether the outcome was performed, and the effort question from `effortAnswered`. Those guesses are wrong after a user explicitly backs up to edit an already-answered item.

**Repro A:** choose “운동을 마쳤어요” -> AM -> RPE 6 -> pain; back to RPE, then back to the outcome question; leave and restore the draft. The stored step is still `activity` with a performed outcome, so initialization selects `slot`, not the outcome question the user had reopened.

**Repro B:** from the pain question, back to RPE and leave before selecting a replacement value. The stored step is `effort` and `effortAnswered=true`, so initialization selects `pain`, not RPE. Existing answers remain in the draft, but the user’s intended edit point is silently lost. Current QuickSessionForm tests cover back/edit in one mount but not draft restoration after a sub-question edit.

**Fix:** preserve the current schema by restoring the earliest question represented by the stored generic step (`activity` -> outcome; `effort` -> RPE) while retaining existing answers, or obtain separate approval for a versioned draft field that stores the active sub-question. Add unmount/remount tests for both repros and for save-failure retry.

### P3 - The moved Oracle resume action is harder to discover by its new tab name

**Evidence:** section names at `app/src/screens/Trends.tsx:42-46`; library-only disclosures at `:198-201`.

Examples and saved-interest/resume remain reachable, and the analysis-detail menu still exists in the training view. However, “관심 주제·기록할 요일” is now behind both the “읽을거리” tab and a separate collapsed disclosure. A novice looking for previously saved interests can reasonably treat this as reading content rather than a resume/personalization control.

**Fix:** keep the requested library destination but make its tab label signal both roles (for example, “읽을거리·관심 주제”) and give the resume disclosure an always-visible, action-oriented preview. Add an exploration test that verifies the saved-interest path is discoverable from the library tab without opening the topic examples first.

## Cross-Screen Route Check

- Home’s Oracle card continues to route personal candidates to their personal topic, examples to the example topic, and unavailable sources to the training/analysis surface; the incomplete-read predicate gap above is the exception.
- The Oracle “내 훈련 / 러닝 취향 / 읽을거리” section tabs remain present. Analysis routes for summary, distance, mix, monthly, and files are still reachable from the training detail disclosure. Imported-only and empty states still have explicit source/record actions in source.
- Plan preview retains an explicit start action and schedule/alternative controls. The incomplete-workout notice keeps its brief caution visible while details remain expandable. Metadata now follows the calendar as requested; the old screenshot is not current visual evidence.
- Quick record keeps explicit review/save, separate outcome, slot, exertion, and body-state questions, and preserves the existing record fields in the save call. The question-specific back state is not preserved on restoration (P2 above).
- Existing source still exposes the calendar journal entry, Oracle topic routes, pace calculator header action, and memo/exercise paths. No source-confirmed lost route was found in the reviewed current diff beyond the resume discoverability concern. No prescription or safety policy is changed by this review.

## Synthetic Persona Matrix And Seeded Traces

**Trace method:** each hexadecimal seed initializes xorshift32 (`x ^= x << 13; x ^= x >>> 17; x ^= x << 5`). It selects among valid source-state choices for home source, plan inspection, outcome, AM/PM, RPE/unknown, pain answer, optional exercise, save result, continuation route, and access constraint. This generates reproducible scenario scripts only; each trace was statically checked against current source and is not an app/browser run. “Plan check” means inspect the candidate/calendar; it does not imply starting or changing a plan. “Unknown date” describes existing evidence, never a newly invented date.

| # / seed | Synthetic reading/fatigue and experience | Data, slot, exercise, and access constraint | Seeded source trace |
|---|---|---|---|
| 01 / `071001` | Grade 6 reading stamina; tired; novice | Personal data; AM; partial; strength; knee pain; keyboard | Home personal -> record partial -> AM -> RPE unknown -> knee -> strength -> review/save -> Oracle library/resume -> pace |
| 02 / `072EF0` | Grade 8; fresh; novice | Empty; AM; plyometric; 320 px | Home empty -> plan check -> done -> AM -> RPE 9 -> no pain -> plyometric -> save -> library/resume -> pace |
| 03 / `074DDF` | Grade 7; moderate fatigue; experienced | Imported-only; PM; strength; keyboard | Home imported-only -> plan check -> done -> PM -> RPE unknown -> knee -> strength -> save -> calendar -> Oracle personal -> memo |
| 04 / `076CCE` | Grade 6; tired; novice | Unknown-date evidence; PM; partial; plyometric; keyboard | Home unknown-date -> plan check -> partial -> PM -> RPE 5 -> calf -> plyometric -> save -> library/resume -> pace |
| 05 / `078BBD` | Grade 8; tired; experienced | Imported-only; rest outcome; touch | Home imported-only -> rest -> review/save -> calendar -> Oracle personal -> memo |
| 06 / `07AAAC` | Grade 6; low reading confidence; novice | Example; skip outcome; keyboard | Home example -> skip -> review/save -> library/resume -> pace |
| 07 / `07C99B` | Grade 8; fresh; experienced | Example; AM; knee pain; 320 px | Home example -> plan check -> done -> AM -> RPE 9 -> knee -> review/save -> plan/calendar/record/Oracle |
| 08 / `07E88A` | Grade 7; tired; novice | Imported-only; AM; intervals; 200% text | Home imported-only -> plan check -> partial -> AM -> RPE 5 -> no pain -> intervals -> save -> calendar/library/pace |
| 09 / `080779` | Grade 8; fresh; experienced | Personal; skip; 200% text | Home personal -> plan check -> skip -> review/save -> calendar -> Oracle personal -> memo |
| 10 / `082668` | Grade 6; tired; novice | Personal; rest; keyboard | Home personal -> plan check -> rest -> review/save -> library/resume -> pace |
| 11 / `084557` | Grade 7; moderate fatigue; experienced | Empty; AM; plyometric; calf pain; 320 px | Home empty -> plan check -> partial -> AM -> RPE 3 -> calf -> plyometric -> save -> calendar -> Oracle personal -> memo |
| 12 / `086446` | Grade 8; tired; experienced | Unavailable; AM; strength; keyboard | Home unavailable -> plan check -> done -> AM -> RPE 5 -> no pain -> strength -> save -> library/resume -> pace |
| 13 / `088335` | Grade 6; low reading confidence; novice | Unavailable; skip; touch | Home unavailable -> skip -> review/save -> calendar -> Oracle personal -> memo |
| 14 / `08A224` | Grade 7; high fatigue; novice | Unavailable; rest; fatigue | Home unavailable -> rest -> review/save -> library/resume -> pace |
| 15 / `08C113` | Grade 8; moderate fatigue; experienced | Empty; PM; intervals; calf pain; touch | Home empty -> plan check -> partial -> PM -> RPE unknown -> calf -> intervals -> save -> plan/calendar/record/Oracle |
| 16 / `08E002` | Grade 7; tired; novice | Unavailable; PM; intervals; knee pain; touch | Home unavailable -> plan check -> done -> PM -> RPE 5 -> knee -> intervals -> save -> calendar/library/pace |
| 17 / `08FEF1` | Grade 8; moderate fatigue; experienced | Personal; PM; strength; no pain; save failure; 320 px | Home personal -> partial -> PM -> RPE 3 -> no pain -> strength -> review -> failed save/retry -> plan/calendar/record/Oracle |
| 18 / `091DE0` | Grade 6; low reading confidence; novice | Personal; skip; 320 px | Home personal -> plan check -> skip -> review/save -> calendar/library/pace |
| 19 / `093CCF` | Grade 8; tired; novice | Example; PM; intervals; knee pain; save failure; keyboard | Home example -> plan check -> partial -> PM -> RPE 7 -> knee -> intervals -> failed save/retry -> calendar/library/pace |
| 20 / `095BBE` | Grade 7; tired; novice | Imported-only; PM; easy run; save failure; touch | Home imported-only -> plan check -> done -> PM -> RPE unknown -> no pain -> easy run -> failed save/retry -> library/resume -> pace |
| 21 / `097AAD` | Grade 6; low reading confidence; tired | Example; skip; 200% text | Home example -> skip -> review/save -> plan/calendar/record/Oracle |
| 22 / `09999C` | Grade 8; fresh; experienced | Unknown-date evidence; rest; save failure; 200% text | Home unknown-date -> plan check -> rest -> failed save/retry -> plan/calendar/record/Oracle |
| 23 / `09B88B` | Grade 7; tired; novice | Imported-only; AM; partial; RPE unknown; no pain; save failure; 200% text | Home imported-only -> plan check -> partial -> AM -> RPE unknown -> no pain -> review -> failed save/retry -> library/resume -> pace |
| 24 / `09D77A` | Grade 8; moderate fatigue; experienced | Unknown-date evidence; PM; intervals; knee pain; keyboard | Home unknown-date -> plan check -> done -> PM -> RPE 7 -> knee -> intervals -> save -> calendar -> Oracle personal -> memo |

## Focused Verification

- Static source trace: completed for the changes listed in scope; findings above are source-level defects/risks, not measured task completion.
- Vitest: **not verified**. Vite failed before collection with `EPERM` resolving `app/src/test/setup.ts`; both attempts reported 0 tests executed.
- Browser, actual-user, deployed, and account behavior: not tested or claimed.

## Resolution Update - QuickSession Restored Question P2

Date: 2026-10-07

- Added optional `activeQuestion` presentation state (`outcome | slot | rpe | pain`) to quick form drafts. Older strict-schema payloads without it remain valid. The field is not copied into journal entries and does not affect training, dose, or save semantics.
- New drafts restore the exact question after a backwards edit. Legacy drafts without the field infer the earliest unanswered question from the saved outcome, slot, RPE, and pain answers (for example, a completed activity with no slot resumes at slot; answered RPE with unanswered pain resumes at pain). Existing answers remain selected and unchanged; inference does not rewrite the legacy payload on mount.
- Added buffer-backed component unmount/remount coverage for edited RPE and outcome questions, retained AM/outcome/RPE/pain answers, both legacy-stage fallbacks, and schema roundtrip coverage.
- Focused Vitest: **3 files passed, 51 tests passed** (`FormInputAutosave.test.tsx`, `form-input-draft.test.ts`, and `QuickSessionForm.contract.test.tsx`), using the bundled Node runtime and scoped escalation after the sandbox-only `EPERM` encountered in the earlier review.

## Coordinator Resolution And Evidence Update

Date: 2026-10-07

- The parent dispatched three `gpt-6-luna` workers with `max` reasoning: two implementation areas and this independent source review. The earlier statement about no external model call refers to this review worker not invoking an additional external service. It does not mean the parent simulated a Luna worker.
- Home incomplete-read P2 fixed: `journalReadComplete` participates in the source-unavailable predicate. Label, preview kind, and route now agree. A focused regression test failed when this guard was temporarily removed, then passed after restoration. An independently eligible race-record result remains usable.
- Interest discoverability P3 fixed: the tab is `읽을거리·관심`, with `내 관심 주제·기록할 요일` as the explicit disclosure. The exploration test follows this named route without requiring the examples disclosure.
- The parent separately ran real component fixtures in an isolated browser at 320px, 375px, desktop, and reduced motion. These browser checks are not the 24 persona traces and do not establish real-user fatigue or production account behavior.
- Browser text-enlargement review found and fixed a further defect: two-digit calendar dates could wrap between digits. Dates now stay on one line while adornments can wrap. The focused 375px and enlarged-text rerun passed after the fix.
- Latest focused integration run: 70 tests passed, 0 failed. Type checking and the local production build passed. Earlier review-time EPERM results above are retained as chronology, not the final verification state.
- Final coverage, screenshots, limits, and C01~C18 status: [implementation review](UX_CLARITY_IMPLEMENTATION_REVIEW_2026-10-07.md).
