# Calendar Role Color: Luna Independent Review

**Date:** 2026-09-30  
**Checkout:** `TRAINORACLE-oracle-exploration-20260921`  
**Review type:** independent static source review plus inspection of parent-provided synthetic UI evidence  
**Decision:** address the P1 mixed-session representation before accepting the color work; one P2 consistency gap remains.

## Proof Boundary

- I read the repository entry instructions, Product North Star, binding visual standard, and owner-approved calendar presentation contract before inspecting implementation. The calendar mapping draft remains `DRAFT_FOR_REVIEW`; this review does not promote it.
- I inspected the current role projection and its calendar call sites. I did not run the app, tests, or browser flows in this review.
- Parent-provided evidence is reported separately from my own review. `color-implementation/evidence.json` describes a synthetic local browser run; I inspected that JSON and eight supplied PNGs, but did not execute those flows myself.
- The user reports that the parent completed 51 focused tests and 80 real local-browser actions. The 51-test result was not independently executed or verified here. The JSON records 20 journal and 20 plan actions at each of 320px and 375px, no page errors, no horizontal overflow, no clipped labels, reduced-motion animation `none`, and unchanged plan/record state while browsing.
- The requested formal review of exactly 12 personas and 24 deterministic/random attack scenarios was **not completed**. No persona or scenario count is claimed. The completed scope is the source-path review, the two findings below, and the supplied evidence inspection.
- No attached athlete photos were opened or copied. All example cases below are synthetic.

## Findings

### [P1] A mixed plyometric record can become a full neural mark and a second apparent session

**Evidence:** `app/src/domain/calendar-training-presentation.ts:33-45` combines logged exercise components with explicitly sourced `objectiveComponents`. If any component is `PLYOMETRIC`, it emits a full `tone: "neural"` mark; if the record also has an explicitly sourced `BASE` or `RECOVERY` system, it emits another full mark. `app/src/screens/JournalMonthCalendar.tsx:68-70` renders each mark as a separate calendar block. The corresponding CSS paints the complete neural block mint (`app/src/components/MonthCalendar.css:47-56`).

**Synthetic repro:** one completed AM entry contains `PLYOMETRIC` plus `RUNNING` (in `exerciseLog.components`, or explicit `intensityAssessment.objectiveComponents`) and an explicit `BASE` system. The projection yields both `오전 플라이오 포함` in mint and `오전 기본` in white for one journal entry. With no explicit system, the mixed entry still receives one full mint background even though its text says `플라이오 포함`. Thus a mixed session may be visually split into two sessions, or its whole surface may read as neural. The explicit-component addition does not resolve this grouping/whole-record-tone conflict.

**Why it matters:** this conflicts with the approved rule to identify plyometric inclusion without turning a mixed record into a neural session, and can inflate the apparent number of same-slot sessions. This is a presentation error, not a plan or safety decision.

**Minimum fix:** preserve one visual record group per `JournalEntry`. Keep the whole-entry role grounded only in its explicit whole-record source; show `플라이오 포함` as a subordinate component cue within that same group. Do not emit a second full-height session block or paint an otherwise mixed/unclassified whole record as neural. If the approved colors do not determine how that subordinate cue should be colored, leave that narrow visual choice for owner confirmation.

### [P2] Plan calendars discard actual base/recovery/plyometric role detail

**Evidence:** `CalendarJournalBadge` in `app/src/components/CalendarJournalDetails.tsx:14-21` counts race records separately but collapses every non-race record into neutral `일지 N`. Both `PlanSchedulePreview` (`app/src/screens/plan-beta/PlanSchedulePreview.tsx:503-519`) and `DatedPlanPanel` (`app/src/screens/plan-beta/DatedPlanPanel.tsx:44-52`) use that badge. By contrast, `JournalMonthCalendar` uses `journalCalendarMarks` and displays actual explicit base/recovery and plyometric information.

**Synthetic repro:** put an explicit recovery or mixed plyometric journal entry on a date with a planned main session. The plan calendar shows the colored planned mark plus `일지 1`; it does not expose the actual entry's role there. The supplied `plan-320.png` also shows the plan marks and generic journal count as separate content. This avoids falsely coloring the actual entry as planned, but loses approved actual-role detail across calendar surfaces.

**Minimum fix:** either use a corrected, one-group-per-entry actual projection in both plan calendars while retaining a clear actual-record label, or explicitly narrow the presentation contract to say that plan calendars show actual-record counts only. Do not reuse the current raw projection until the P1 grouping issue is fixed.

## Static Checks That Held

- Planned `QUALITY`/`MAIN` map to the main role color; the helper does not infer that role from energy intent. `ATP_PC` is not mapped to neural/plyometric.
- Planned `EASY + RECOVERY_INTENT`, `EASY + BASE_INTENT`, `REST/OFF`, and unknown roles remain distinct. Actual legacy/default system provenance is not used to infer base or recovery.
- Race-pre is labeled `경기 전`; skipped, rested, evening, and empty-date paths have distinct labels or remain unmarked rather than being silently converted to rest.
- Source CSS includes reduced-motion overrides, keyboard month-boundary focus restoration, forced-colors borders, and wrapping rather than fixed-width event text. The supplied screenshots show readable AM/PM labels at 320px and 375px; the parent evidence reports 44px minimum width and no clipped labels. These are source/evidence observations, not my own runtime verification.

## Changed Files

Only this review report was added. No product code, tests, existing plan, old review, evidence, commit, or remote state was changed.
