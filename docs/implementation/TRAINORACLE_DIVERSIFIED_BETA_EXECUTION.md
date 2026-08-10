# TrainOracle diversified beta execution

## Product promise

TrainOracle is a record-first training diary. A person should be able to write
today's record quickly, return to it with pleasure, and only open detailed
training information when it is useful.

The beta experience combines four layers without forcing all of them on a
newcomer:

1. A simple diary for today's record.
2. A plan that the athlete explicitly selects and saves.
3. A diary they can decorate without risking their journal data.
4. Detailed training and analysis views that are opt-in.

The service operator decides product rules and whether a feature is public.
User-facing copy calls people athletes, coaches/supporters, and guardians; it
does not call anyone an "Owner".

## Non-negotiable beta boundaries

- Automatic prescription, medical clearance, and automatic active-plan changes
  remain unavailable.
- A coach change is a proposal until the athlete confirms it.
- A private memo remains excluded from sharing, analysis, plans, and logs.
- Unknown or stale athlete records do not become a numeric pace target.
- A failure closes only the affected feature; local journal records remain
  usable.
- The first 200-person beta is free. Billing, advertising, and direct Garmin
  connection are later work, not hidden beta scope.

## Delivery order

| Order | Deliverable | Why it comes now | Completion evidence |
| --- | --- | --- | --- |
| 0 | Record-first home | A returning athlete can see the last local diary entry before optional services. | PR #195 merged; mobile browser and main CI pass. |
| 1 | Plan creation and save reliability | A generated plan is useless unless selection, retry, reload, and archive are honest. | Current-main reproduction, failing test, focused browser flow, and save-failure/retry/rollback tests in one PR. |
| 2 | Simple entry and revisit | New and returning athletes have a clear path: record today, see recent diary, then open the calendar. | 3 primary choices at most, 320px screen evidence, no guilt copy. |
| 3 | Diary reader and decoration | The same real diary page can be read, decorated, reloaded, and undone safely. | Dated decoration storage round-trip; journal bytes unchanged on decoration failure. |
| 4 | Plan calendar and two-a-day clarity | A dated plan should look followable, with actual AM/PM sessions instead of opaque Day 1/Day 2 labels. | Chosen date survives selection/retry/reload; two sessions render as two named slots. |
| 5 | Advanced training detail | Experienced athletes can expand structured sets, repetitions, recoveries, anchors, freshness, and source. | Missing or stale evidence displays an honest missing/RPE state, never invented pace. |
| 6 | Account, sync, and sharing | Sync makes existing local journals safer without exposing private memo text. | Authorization, deletion, merge preview, private-memo exclusion, and athlete-to-athlete isolation tests. |

Orders 1 through 6 are separate pull requests unless the table explicitly says
two components must move together. In particular, a PM high-intensity generator
change and its save gate must be reviewed in the same pull request.

## Current-main reconciliation rule

This repository contains historical, unmerged branches that address parts of
these goals. They are evidence, not merge candidates. Before reusing one:

1. Reproduce the user-visible problem on current `origin/main`.
2. Pin that behaviour with a focused test.
3. Port only the smallest current-main-compatible change.
4. Verify the saved, reloaded, and failure states in the actual browser.

No stale branch is merged merely because its title sounds relevant.

## First implementation slice: plan reliability

The next code pull request is deliberately narrow. It verifies the existing
seven-question plan intake, candidate selection, and active-plan persistence
as one journey.

### Questions to answer from current main

- Does selecting `two sessions a day` make the second rendered session a named
  PM session rather than an unexplained endurance-only fallback?
- Does the selected training-time preference survive generation, selection,
  save retry, reload, and next-frame archive?
- If the first save fails, does the person stay on the same candidate, date,
  and selection rather than being sent back or shown a success state?
- Does a failed archive or progress write keep the active plan and its prior
  state visible?

### Required failure cases

- double-clicking a candidate;
- local storage quota/write failure;
- a start date cleared or changed just before selection;
- reloading after a successful save;
- archive failure while preparing a next frame;
- partial numeric input in detailed training fields.

The implementation changes only behaviour that a failing current-main test
proves. It does not activate automatic prescription or replace athlete
confirmation.

### Current-main audit: 2026-08-10

The current implementation was exercised before changing it:

- 20 focused plan contracts passed, including candidate selection, failed-save
  retry, chosen-date retention, reload, failed archive, and failed progress
  write.
- The narrow mobile browser flow passed for both a dated two-session preview
  and a failed-save retry followed by reload.
- A second session is intentionally a separately named recovery/easy session
  beside the selected quality session. It is not an automatically generated
  second high-intensity session.
- The second plan candidate intentionally omits the selected high-intensity
  purpose. It is a conservative alternative, not a broken duplicate. The next
  UI slice must state this contrast more plainly before an athlete chooses.

No plan-engine code is changed solely because an older branch contains a
similar change. The next change starts with a visual/wording regression test
for the candidate contrast, then changes only that candidate surface.

## Experience rules by audience

| Audience | Always visible | Only when requested |
| --- | --- | --- |
| New or middle-school athlete | today's record, recent diary, up to three next actions | training notation, pace/source detail, coach workflow |
| Returning athlete | a neutral restart path and recent diary | streak/reward details |
| Experienced athlete | plan date, session name, clear AM/PM labels | set/repetition/recovery/anchor/source panels |
| Coach-connected athlete | proposal status and athlete confirmation | comparison history |
| Privacy-sensitive athlete | clear private-memo exclusion | sync and sharing controls |

## Quality gates for every implementation PR

1. A failing focused test exists before changing runtime behaviour.
2. Unit, type, build, and relevant browser tests pass.
3. At 320px, no horizontal overflow, hidden action, or sub-44px touch target
   is introduced.
4. Private memo, D9, plan authority, and account boundaries are searched and
   tested when a change can touch them.
5. A real browser path covers happy path plus the relevant failure/retry path.
6. The PR description states what remains unavailable and names the exact
   branch/head SHA.

## Deferred decisions

These need a later product decision before runtime activation:

- automated numeric prescription;
- activating the 30 training templates for athletes;
- an integrated fatigue score beyond the experimental display;
- direct Garmin integration;
- coach credential verification;
- payment, subscription, or advertising;
- any wider Formation safety boundary.
