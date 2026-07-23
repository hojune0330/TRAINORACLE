# Independent Athlete UX and Safety Code Review

Date: 2026-07-23
Goal: Review the launch-ready first-visit experience as a youth/middle-distance athlete for clarity, motivation without pressure, privacy honesty, plan-function honesty, save-feedback truthfulness, and likely dead ends.

## Decision

- `codeQualityStatus`: **BLOCK**
- `recommendation`: **REQUEST_CHANGES**
- Blocking issues were found. This is not a no-blocking-issue review.

## Review scope and evidence

Required visual evidence inspected:

- `.omo/evidence/launch-ready-2026-07-23/01-mobile-welcome.png`
- `.omo/evidence/launch-ready-2026-07-23/02-mobile-context.png`
- `.omo/evidence/launch-ready-2026-07-23/03-mobile-plan-pending.png`
- `.omo/evidence/launch-ready-2026-07-23/04-desktop-welcome.png`

Required source inspected:

- `app/src/screens/home/FirstPage.tsx`
- `app/src/components/AppChrome.tsx`
- `app/src/AppShell.tsx`
- `app/src/domain/save-receipt.ts`

Flow verification also followed the required files into `Home.tsx`, `Guide.tsx`, `journal-store.ts`, the three save forms, and the relevant unit/E2E tests. The working-tree diff and untracked launch-ready files were inspected; the branch contains 21 modified tracked files plus new onboarding, receipt, E2E, and evidence files.

`omo ulw-loop status --json` was unavailable because the `omo` command is not installed on PATH, and `.omo/ulw-loop` does not exist in this worktree. Per the fallback rule, this report is stored directly under `.omo/evidence/`. No review notepad path was supplied.

## Skill-perspective check

The `omo:programming` TypeScript perspective and `omo:remove-ai-slops` perspective were loaded and applied before judging tests and maintainability.

- `programming`: **violated** by the red project unit suite and by implementation-mirroring CSS tests described below.
- `remove-ai-slops`: **violated** by those implementation-mirroring tests and the missing edge behavior lock around receipt identity. The new receipt unit tests are otherwise useful behavioral tests: they are not deletion-only, tautological, or constant-mirroring.
- No unnecessary extraction, parsing, or normalization was found in `save-receipt.ts`: it reuses the existing decimal parser and provenance boundary to avoid claiming an unparseable or non-explicit distance.
- No scoped production file exceeds the 250-pure-LOC ceiling: `FirstPage.tsx` 187, `AppChrome.tsx` 131, `AppShell.tsx` 117, and `save-receipt.ts` 29 pure LOC.

## Findings

### S1 / CRITICAL

None.

### S2 / HIGH

#### 1. The checked-in unit suite is red, so launch-readiness evidence is not valid

`FirstPage` calls `frameRef.current?.scrollIntoView(...)`, but optional chaining only guards a missing element, not a missing method. JSDOM does not provide this method in the current test setup, so both context-transition tests crash before their assertions.

- `app/src/screens/home/FirstPage.tsx:40-43`
- `app/src/screens/home/FirstPage.contract.test.tsx:9-35`
- `.github/workflows/ci.yml:76-78` runs `npm test`, so this is a CI blocker.

Independent result:

```text
npm.cmd test
Test Files  1 failed | 14 passed (15)
Tests       2 failed | 91 passed (93)
TypeError: frameRef.current?.scrollIntoView is not a function
```

The real-browser E2E passing does not make a red required unit gate acceptable. The branch cannot claim all verification green.

#### 2. First-use privacy wording overpromises confidentiality for sensitive youth data

The welcome screen says only “이 기기에 저장,” while the plan screen broadly says no personal information is collected. Following the visible Guide destination reaches the absolute promise “아무도 못 봐요.” In reality, the journal is browser-profile local storage: another person using the same browser profile can see it, and browser-data clearing/private-session behavior can remove it. The app records pain, mood, weight, resting heart rate, and free text, so this distinction matters for a young athlete.

- `app/src/screens/home/FirstPage.tsx:107-110` — “개인정보를 받지 않아요” is not explicitly limited to the unavailable plan-request feature.
- `app/src/screens/home/FirstPage.tsx:128-133` — first-use disclosure says “이 기기에 저장” without explaining browser/profile scope, shared-device access, or deletion risk.
- `app/src/AppShell.tsx:70-75,94-95` — the welcome/Guide actions route directly to the Guide.
- `app/src/screens/Guide.tsx:258-260` — “이 기기(브라우저)” is accurate, but “아무도 못 봐요” is an indefensible absolute.
- Screenshot evidence: `01-mobile-welcome.png`, `03-mobile-plan-pending.png`, and `04-desktop-welcome.png`.

This is a release-blocking trust issue for a youth-facing product, not merely copy polish.

#### 3. The save receipt can describe a different entry from the one just saved

After a successful save, `AppShell` does not receive the saved entry. It re-reads all storage and asks for the entry with the greatest `savedAt` value:

- `app/src/AppShell.tsx:39-43`
- `app/src/domain/journal-store.ts:126-130`

If an older stored entry has a future timestamp because the device clock was previously wrong, the next save can show that older entry’s pain, mood, or distance receipt. The clean-storage E2E at `app/e2e/launch-ready.spec.ts:30-46` cannot catch this. This directly violates the requested save-feedback truthfulness: the toast must be derived from the exact successful write, not a post-hoc “most recent” guess.

### S3 / MEDIUM

#### 4. “One quick choice” and skip are session-only; a reload asks again until the athlete writes

The context screen says the athlete chooses once, and both “건너뛰기” and “그냥 둘러볼래요” appear to dismiss onboarding. The dismissal only updates React state. On the next reload, an empty journal initializes onboarding again from `localOnlyCount() === 0`.

- `app/src/screens/home/FirstPage.tsx:66-79,184-187`
- `app/src/AppShell.tsx:34-43,74-75`
- `app/src/screens/home/FirstPage.contract.test.tsx:37-48` checks only that a callback fired, not that dismissal survives a reload.

For a hesitant or injured athlete who does not want to log yet, repetition turns an otherwise low-pressure welcome into a soft nag.

#### 5. Part of the motion suite mirrors CSS implementation instead of user-observable behavior

`Motion.contract.test.tsx` reads the stylesheet as text and pins selectors, exact timing strings, keyframe tokens, and implementation structure. These tests can fail on a behavior-preserving refactor and can remain green without proving the rendered athlete experience.

- `app/src/components/Motion.contract.test.tsx:31-72`

This violates both required skill perspectives. It is MEDIUM because it adds maintenance burden and false confidence, not because it caused the current runtime behavior to fail.

### S4 / LOW

#### 6. The plan-choice helper can sound like athlete-readiness scoring

The choice “훈련 계획이 궁금해요” is described as “현재 준비 상태를 확인해요.” A middle-distance athlete can reasonably read that as personal readiness, but the destination only reports that the service itself is preparing.

- `app/src/screens/home/FirstPage.tsx:60-63`
- Screenshot evidence: `02-mobile-context.png` and `03-mobile-plan-pending.png`.

The destination is commendably honest; the preceding helper should identify whose readiness it means.

#### 7. Desktop is usable but presents as a phone mockup rather than a desktop experience

`04-desktop-welcome.png` shows a clear, readable 520px journal column, but most of the viewport is inert blank space. This is not a dead end or safety defect, but it weakens first-use confidence on desktop.

## What passed

- No navigation dead end was found in the real app flow. Context choices route to matching forms; plan has write/back/skip exits; the bottom tabs reach Home, Log, Trends, and Guide.
- Motivation is mostly non-coercive: the welcome says a short first record is enough, includes no streak, countdown, comparison, or shame language, and the Guide says missed days are acceptable.
- The plan destination clearly says the function is not available and presents no request/profile form.
- Save forms check `saveEntry(...).ok` before calling `onDone`; a failed local write keeps the entered content on screen and shows a retry-oriented error instead of a success receipt.
- `save-receipt.ts` respects explicit provenance and parseability before claiming pain, mood, or distance.
- `npm.cmd run typecheck`: PASS.
- `npm.cmd run typecheck:e2e`: PASS.
- Production build: PASS.
- `npm.cmd run test:e2e -- e2e/launch-ready.spec.ts`: 13 passed, 3 intentionally skipped desktop-only assertions.
- `git diff --check`: PASS, aside from non-failing LF/CRLF conversion warnings.
- Lint: N/A; no lint script is configured in `app/package.json`.
- Static/security scan: N/A for this scoped review; no project scanner was configured or claimed.

## Blockers before approval

1. Restore a green required unit suite for the onboarding transitions; `npm test` must pass in the checked-in environment.
2. Replace the absolute/ambiguous privacy promises with first-use browser/profile-local disclosure that is honest about shared access and deletion/backup risk, and clearly limit the “no personal information” statement to the unavailable plan-request path.
3. Generate the receipt from the exact entry whose write succeeded, with a regression test that distinguishes it from a pre-existing entry with a later `savedAt`.

## Final recommendation

**REQUEST_CHANGES.** The browser flow and plan-pending UI are promising, but the red required test gate, youth privacy overclaim, and non-identical save receipt source are blocking.
