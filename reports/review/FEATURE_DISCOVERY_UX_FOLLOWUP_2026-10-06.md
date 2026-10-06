# Feature Discovery and Youth Fatigue - Second Pass

Date: 2026-10-06
Status: implementation candidate; owner walkthrough and real youth usability validation pending.

## Decision

The owner rejected treating release or automated checks as usability completion. The first progressive-choice pass folded some functional entry points together with explanatory text. This pass keeps named functions discoverable, reduces repeated copy, and repairs actual transitions. It does not remove features to manufacture a short first screen.

Use one prominent next action per task. Secondary tools retain short, recognizable names and a reachable destination. Help can fold; saving state, errors, consent, safety checks and precise prescription information must not become invisible. Additional taps are justified only when they separate meaningful decisions, not when they merely unlock another disclosure.

## Independent Review

Two independent gpt-6-luna agents at max reasoning reviewed different scopes:

- `LUNA_FEATURE_REACHABILITY_2026-10-06.md`: 12 synthetic intent paths, source inspection only; six discoverability findings.
- `LUNA_YOUTH_PLAN_FATIGUE_2026-10-06.md`: 12 synthetic intent paths; form code changes and 51 focused unit checks. Other plan/journal paths were static inspection.

These 24 synthetic paths are not 24 users, 24 executed end-to-end journeys, or evidence of adolescent comprehension. Earlier persona totals are not combined into a claimed usability success rate.

## Findings and Changes

| Finding | Change | Boundary |
|---|---|---|
| Functional buttons were hidden with help text | Distinguish action disclosures from help; show short contents previews; Mari's three analysis links remain outside help | No destination or safety gate removed |
| Profile, friends and saved race records were difficult to discover | More exposes running profile, saved race record management, temporary record reading and watch file import by name; profile directly exposes friend comparison | Temporary calculation and saved records remain separate; no consent bypass |
| Article and destination labels differed | Reuse `훈련법 읽기`; label Oracle articles separately; library heading matches destination; sharing article CTA names its actual settings destination | No misleading direct-share claim |
| First record action looked secondary | Full-width prominent first-record button; descriptions and example metrics fold with named summaries | Real empty state is not a fabricated result |
| Actual time, goal and pace could be confused | Short actual/goal/no-record descriptions; event-specific whole-time heading; no fake preselection | No record formula or parsing change |
| Correcting an event required choosing the same basis again | Return directly to numeric input with time/date retained | Explicit submit remains required |
| Folded date concealed entered state or errors | Summary includes entered date; errors open and focus date; disabled submit protects date too | Unknown dates remain unknown |
| Question count looked like overall completion | Stage identified as training conditions, not total process progress | No safety question skipped |
| Fixed 9.5-day journal grouping looked like the actual plan | Name the tab `기록 묶음`; identify its fixed grouping separately inside the view | Grouping math/storage unchanged |
| Plan journal action was inside record details | Direct `이 훈련 일지 쓰기` next to session prescription | Completed journal does not auto-complete plan progress |
| Enlarged calendar reader intercepted journal clicks | Close reader/history before leaving to journal | Original plan stays mounted and its state is retained |
| Return after journal lost enlarged session or keyboard focus | Reopen the correct date/AM-PM record section; restore selected date focus when closing | No forced scroll while typing; normal reader opener behavior retained |

## Function Reachability Map

| Function | Named path after change |
|---|---|
| Record an exercise | Home primary action or bottom Record tab |
| Get a plan | Bottom Training -> event -> record choice -> training conditions -> explicit start |
| Record a planned session | Plan date -> direct journal action -> save -> same date/session |
| Change a workout | Existing plan edit actions retained with their eligibility restrictions |
| Calendar and journal detail | Journal month/date; plan date/enlarged session; record grouping remains separate |
| Pace calculator | More direct row; Oracle header shortcut; contextual existing entries retained |
| Save/edit race records | More `경기 기록 추가·수정` -> existing record manager -> Back returns to More |
| Temporary record comparison | More `최고기록으로 풀이하기`, explicitly described as not saved |
| Running profile | More direct row or Oracle Running Preference section |
| Friend comparison | Running profile direct button; existing method and consent chooser remains |
| Oracle articles and training articles | Separately named More rows and existing Oracle section |
| Import watch file | More direct row or recording chooser; device support remains a separate status link |
| Decoration, backup, restore, trash | Existing named More entries retained |
| Public account profile | Existing account route remains conditional; not confused with preference profile or activated by this release |
| Workout memo | Existing `간단히 / 자세히` and subordinate presentation options retained |

## Executed Evidence

Main agent used disposable browser contexts and synthetic local records. Browser requests outside 127.0.0.1 were blocked. No real athlete journal, account credentials or production account write was used.

- Final `feature-discovery-journey.spec.ts`: 3/3 passed in `evidence/discovery-20261006/browser-verified`. Named tools, native Back to More, import return, profile/friend chooser, article headings, primary record action, plan creation, journal save, exact session return, no automatic completion and date focus.
- Widths: 320 and 375 pixels for discovery; 375 for plan/journal linkage. Reduced motion on discovery cases.
- Visible text doubled in Oracle using computed CSS font sizes. Horizontal overflow checked and screenshot inspected. This is not OS text scaling, browser zoom certification, or all-screen accessibility certification.
- Three existing narrow-phone journeys passed earlier in this pass: Oracle seeded section/back navigation, record-free plan start/re-entry, short journal/save/calendar. No claim that these cover every path.
- Final navigation and calendar component run: 26/26 passed after the focus fix. Large lazy-module transform is preloaded outside the unit interaction timeout; actual load remains covered by browser journeys.
- Final app TypeScript check passed after the focus fix; diff whitespace check passed. Release build/publication are tracked separately in the deployment receipt.
- Other focused passing evidence from bounded earlier runs: profile, home, Trends, More, JournalArchive and form contracts. Agent form evidence: 51/51; deliberate navigation defect injection failed as expected before restoration.
- Earlier failures remain recorded: actual dialog interception, missing returned reader and missing date focus were repaired; stale legacy selectors, lazy-transform timing, sandbox file access and missing sandbox media path were not counted as passing product checks.

Screenshots directly inspected: 320px More, profile actions, enlarged Oracle text, and 375px plan reader. More remains a scrollable function directory. Normal use does not require reading it all; making this directory shorter by removing named tools would reverse the requested correction.

## Remaining Usability Questions

1. Does a first-time teenager distinguish actual race time, target time and pace without coaching?
2. Can the user find a previously built feature by its short name without guessing which help disclosure contains it?
3. Does plan activation look distinct from reviewing a proposal? Is journal saving distinct from completing the plan?
4. Does a user with a plan and records have a clearer first screen than the synthetic empty-state examples?
5. Are technical labels in detailed prescription and preference scoring still tiring even though navigation is shorter?
6. On a real phone, do the keyboard, large system text and repeated Back preserve the current task?

These are open questions, not passed findings. No universal maximum tap count or claimed comprehension score is invented.

## Owner Walkthrough

Start with one task: make a plan, inspect one session, write a short journal, and find it again. Do not explain the intended button in advance. Record where the owner hesitates, rereads, asks what a term means, opens the wrong place, or goes back. Then test finding one existing tool from a fresh screen. Fix observed friction before declaring this direction accepted.

Actual youth evaluation is still pending. Obtain appropriate permission, avoid sensitive personal records, and use synthetic examples. A successful owner test alone is not a middle-school usability study.

## Release Boundaries

This is a usability candidate, not product completion. Publication status belongs in the deployment receipt. Existing account/backend hold stays unchanged; real authenticated save/reopen is not verified by guest browser tests. No full regression suite or outdated legacy suite refresh is claimed. Training calculations, intensity, volume, schedule math, consent and account rules are unchanged.
