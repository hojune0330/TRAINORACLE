# Progressive Choice UX - Integration Review

Date: 2026-10-06

Follow-up: the owner correctly challenged discoverability and youth fatigue after this first pass. See `FEATURE_DISCOVERY_UX_FOLLOWUP_2026-10-06.md` for reopened findings and additional fixes. Publication and synthetic checks do not establish completed usability validation.

## Scope and decision

One clear next action, with secondary information available on demand. This is guided choice, not removal of user agency. Exact workout instructions, safety notices, pending/failed saves, source exclusions, explicit plan activation, and account boundaries remain visible and unchanged.

This change does not alter training formulas, intensity, volume, calendar dates, prescriptions, stored journal content, or account eligibility. The related feature before this change, acknowledged general plan previews for users reporting pain, remains read-only and is not medical clearance.

## Shipped-code changes

| Surface | Before | Revised behavior |
|---|---|---|
| Home | Oracle examples competed with first record/today's workout | Record/today first; Oracle details open on demand |
| Plan entry | Event, record kind, time and date shown together | Event -> basis -> numeric input only when needed; no-record choice advances immediately |
| Plan result | Start, alternative plan, schedule and prescription actions competed | Calendar and explicit start first; optional changes grouped |
| Oracle training | Two menu rows and several empty-result areas | Three top-level destinations; detailed metrics/topics open on demand |
| Oracle profile | Optional context and manager actions competed with three questions | First three-question action/result direct; context and Mari's other readings folded |
| Journal/calendar | Latest and nearest could go to the same date; monthly summaries repeated | Duplicate shortcut omitted; monthly summary optional; date reader remains intact |
| Plan continuity | Review, adaptation and another next-plan action appeared separately | A next-cycle section groups them; starting remains explicit |
| Safety recheck | A repeated blocked result could look like a reset | Explains that rechecking did not remove existing review requirements; selections retained |
| Plan -> journal -> plan | Return could lose the selected training marker | Original date and AM/PM link restored after saving, without auto-completing the plan |

The plan entry now uses the actual question as its only visible heading. Existing design tokens, touch target sizes, motion preferences and fonts are reused. Optional dev diagnostics require `?devtools=1`; they no longer cover the mobile navigation during normal local use.

## Independent review evidence

Two independently dispatched `gpt-6-luna` agents at `max` reasoning reviewed separate surfaces:

- Home/Oracle: 16 fictional personas, 69 static logical actions. See `LUNA_ORACLE_UX_2026-10-06.md`.
- Plan/journal/calendar: 16 fictional personas, 88 static logical actions. See `LUNA_PLAN_JOURNAL_UX_2026-10-06.md`.

Total: 32 synthetic personas, 157 static logical actions. These are not 32 observed people, a usability success rate, or 157 executed browser events. The agents did not perform browser journeys. The main agent separately executed the runtime checks below.

## Focused execution evidence

| Check | Result |
|---|---|
| Home, Trends, JournalArchive, recommendation contracts | 35 passed |
| Entry form contracts | 45 passed by the implementation agent |
| Safety preview, candidate and active-adaptation contracts | 15 passed |
| OracleProfileExperience contracts | 21 passed after correcting a native-details visibility assertion |
| AppShell navigation contracts | 8 passed; V1 fallback test now explicitly selects V1, lazy-load timeout separated from assertions |
| TypeScript | Passed after the plan/journal return-link correction |
| Browser: Oracle random sections and plan creation/start/re-entry | 8 passed in `evidence/progressive-choice-20261006/plan-oracle-verified` |
| Browser: record/save/calendar/monthly summary | 4 passed in `evidence/progressive-choice-20261006/browser-verified` |
| Browser: existing plan -> journal -> original session -> explicit progress -> cycle review | 1 passed in `evidence/progressive-choice-20261006/linkage-fixed` |

The 12 new browser journeys use four disposable profiles (320px, 375px, 390px with reduced motion, 1280px), seeded Oracle section changes, and synthetic local records only. They block external requests. Journal and plan assertions check stored state; completing a journal does not automatically mark a plan session completed. Browser data is not a real authenticated account round trip.

The 12 results came from bounded runs, not one all-green full-suite run: four journal journeys passed in the earlier batch; Oracle labels were corrected and all eight Oracle/plan journeys passed in the later batch. The separate plan/journal test initially reproduced a real return-marker failure; the corrected run passed. Initial Profile cold-entry failure (`accountBlocked` initialization order) and a local diagnostic overlay intercepting taps were also corrected. Earlier failed traces remain in the local evidence directory.

## Limitations and deliberate deferrals

- No full regression suite, real-user study, timing benchmark, or production-account write was performed.
- Existing broad skipped calendar tests were not counted as passing or all rewritten. Narrow current-flow browser coverage was added instead.
- Full 200% text scaling and all assistive-technology combinations were not newly certified by this pass.
- This UX release retains the existing account/backend hold; it does not claim to enable online account saving.
- The final heading-only cleanup follows the tests above. Build checks JSX compilation; no extra full test run is justified for that text/layout change.

## Release tracking

Manual release uses the exact committed source, retains existing public configuration and account/backend hold, and preserves preview paths. Publication is only confirmed by the matching Pages build receipt; creating a local package is not publication. Final source/Pages SHAs and status are recorded in the published `trainoracle-deploy-receipt.json` and the task's deployment report.
