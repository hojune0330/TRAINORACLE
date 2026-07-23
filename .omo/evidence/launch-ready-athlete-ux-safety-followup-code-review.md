# Athlete UX and Safety Follow-up Code Review

Date: 2026-07-23
Scope: Read-only re-verification of only the three blockers and two MEDIUM findings from `.omo/evidence/launch-ready-athlete-ux-safety-code-review.md`.

## Decision

- `codeQualityStatus`: **BLOCK**
- `recommendation`: **REQUEST_CHANGES**
- One original HIGH blocker remains partially unresolved.

`omo ulw-loop status --json` is unavailable because `omo` is not on PATH, and this worktree has no `.omo/ulw-loop` directory. This report therefore uses the required `.omo/evidence/` fallback.

## Required skill-perspective check

The `omo:programming` TypeScript review perspective and `omo:remove-ai-slops` overfit/slop perspective were reloaded and applied.

- The exact-entry receipt regression and onboarding-state test are behavior-relevant and not deletion-only, tautological, or constant-mirroring.
- The earlier CSS-source implementation-mirroring tests remain and still violate both skill perspectives.
- No new blocker outside the original review set was considered.

## Original issue disposition

### S2 / HIGH

#### 1. Required unit suite was red — RESOLVED

`FirstPage` now checks that the browser method itself exists before calling it:

- `app/src/screens/home/FirstPage.tsx:40-43`

Independent verification:

```text
npm test
Test Files 16 passed (16)
Tests      94 passed (94)
```

The previously failing `FirstPage.contract.test.tsx` transitions now pass.

#### 2. First-use privacy wording overpromised confidentiality — PARTIALLY RESOLVED, BLOCKER REMAINS

Resolved portions:

- `app/src/screens/home/FirstPage.tsx:129` now says storage is in this browser and warns about shared devices.
- `app/src/screens/home/FirstPage.tsx:135-140` now warns about browser deletion/device changes and backup.
- `app/src/screens/Guide.tsx:258-260` now explains browser-local storage, shared-device visibility, and the different analysis treatment of private versus training notes.
- Post-fix visual evidence confirms the revised first-use disclosure in `01-mobile-welcome.jpg`, `04-desktop-welcome.jpg`, and `05-narrow-welcome.jpg`.

Unresolved portion:

- `app/src/screens/home/FirstPage.tsx:107-110` still says, without limiting the subject to the unavailable plan-request feature, “지금은 계획 요청이나 개인정보를 받지 않아요.”
- `03-mobile-plan-pending.jpg` visibly retains the same sentence.

The application does accept and store health/personal journal data through the CTA immediately below this statement. For a youth athlete, the sentence can still be understood as an app-wide no-collection promise. The original blocker explicitly required the statement to be limited to the plan-request path; that limitation was not added.

#### 3. Save receipt could describe another entry — RESOLVED

The exact successful entry now flows from each form through `LogEntry` into the receipt:

- `app/src/screens/LogEntry.tsx:13-30`
- `app/src/screens/log-entry/PostSessionForm.tsx:51-55`
- `app/src/screens/log-entry/EveningCheckin.tsx:45-49`
- `app/src/screens/log-entry/RaceForm.tsx:58-62`
- `app/src/AppShell.tsx:43-48,91-96`

`app/e2e/launch-ready.spec.ts:30-70` seeds a future-dated pain entry, saves an 8 km entry, and asserts that the receipt and real trend use the new 8 km entry. This directly distinguishes the fixed behavior from the previous bug.

### S3 / MEDIUM

#### 4. Onboarding dismissal was session-only — RESOLVED

- `app/src/domain/onboarding-state.ts:1-16` persists a dedicated dismissal flag.
- `app/src/AppShell.tsx:38-40,80-83` reads and writes that state.
- `app/src/domain/onboarding-state.test.ts:4-13` locks persistence behavior.

The transient context choice itself is still not stored; only the dismissal state is retained.

#### 5. Motion tests mirrored CSS implementation — REMAINS

`app/src/components/Motion.contract.test.tsx:1-72` still reads `app.css` as text and pins exact selectors, timing strings, keyframe token order, and implementation details. These tests remain brittle under behavior-preserving CSS refactors and do not independently prove the rendered experience.

The green 94-test count and React Doctor result do not resolve this finding; they only show that the implementation-mirroring assertions currently match the implementation.

## Final visual evidence

All five post-fix JPGs were independently opened and inspected:

- `.omo/evidence/launch-ready-2026-07-23/01-mobile-welcome.jpg`
- `.omo/evidence/launch-ready-2026-07-23/02-mobile-context.jpg`
- `.omo/evidence/launch-ready-2026-07-23/03-mobile-plan-pending.jpg`
- `.omo/evidence/launch-ready-2026-07-23/04-desktop-welcome.jpg`
- `.omo/evidence/launch-ready-2026-07-23/05-narrow-welcome.jpg`

They confirm the browser/shared-device and backup disclosures, corrected plan-feature helper text, usable narrow layout, and the still-unqualified plan-screen privacy sentence.

## Independent gates

- Vitest: **PASS**, 94/94.
- Production build and app TypeScript: **PASS**.
- Playwright: **PASS**, 87 passed / 21 intentional skips.
- E2E TypeScript: **PASS**.
- React Doctor changed scope against `origin/main`, including untracked files: **PASS**, 0 diagnostics across 25 analyzed files.
- `git diff --check`: **PASS**, with non-failing LF/CRLF conversion warnings.

## Findings by severity

- CRITICAL: none.
- HIGH: the plan-pending privacy sentence remains broader than the actual plan-only non-collection boundary.
- MEDIUM: CSS-source implementation-mirroring motion tests remain.
- LOW: not re-reviewed; outside the requested follow-up scope.

## Blocker

Limit `FirstPage.tsx:109` explicitly to the unavailable training-plan request/profile path so it cannot be read as an app-wide promise that TrainOracle accepts no personal information.

## Recommendation

**REQUEST_CHANGES.** Four of five original blocker/MEDIUM items are resolved or materially remediated, but one original HIGH privacy blocker remains.
