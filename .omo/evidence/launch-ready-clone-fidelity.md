# TrainOracle launch-ready clone/design-system fidelity review

Date: 2026-07-23
Review mode: independent, read-only product/source inspection
Recommendation: **REQUEST_CHANGES**

## Executive verdict

The implementation is a real React app, not a screenshot fake. It has a coherent live component tree, shared app chrome, semantic landmarks, Lucide SVG icons, and generally adequate touch sizing. Desktop also defaults to the real journal app as required by `DESIGN.md`.

Approval is blocked by three product/design-system defects and one evidence defect: mobile Korean text breaks inside words and particles, the welcome guide action is covered by the fixed bottom navigation, styling is not rigorously token-driven, and the supplied `.png` evidence is actually JPEG while the prior success report provides no supporting artifact paths.

## S1 / CRITICAL

No S1 findings.

## S2 / HIGH

### S2-1 — Korean prose and headings break inside semantic units

The failure is visible in every supplied mobile state:

- `01-mobile-welcome.png` (375×667): `아픈 날 / 의 기록…` and `기준으 / 로 볼 수 있어요`.
- `02-mobile-context.png` (375×667): `이 선택은 저 / 장하지 않아요`.
- `03-mobile-plan-pending.png` (375×667): `개인정보를 받 / 지 않아요`.

Fresh production-DOM measurement reproduced those exact rendered lines. At the 320×568 responsive viewport, the welcome heading additionally renders as `오늘의 훈련을 기 / 록해볼까요?`, the welcome copy splits `변 / 화를`, and the context heading splits `때문 / 에`.

The copy and title rules use `text-wrap` but provide no Korean word/phrase-preserving behavior: `app/src/styles/app.css:180-199`. The affected text is authored at `app/src/screens/home/FirstPage.tsx:77-79`, `app/src/screens/home/FirstPage.tsx:105-110`, and `app/src/screens/home/FirstPage.tsx:128-134`.

This is blocking because the product is Korean-first and the narrow responsive state claimed as passing visibly breaks words.

### S2-2 — The mobile welcome guide action is covered by the bottom navigation

`app/src/screens/home/FirstPage.tsx:148-150` renders `쌓인 기록 예시 보기`, but it is absent from the visible mobile welcome frame in `01-mobile-welcome.png`.

Fresh 375×667 production geometry:

- guide button: y=594–638, height=44px
- fixed tab bar: y=610–667
- covered portion: 28px
- initially unobscured portion: only 16px

The overlap comes from the fixed tab bar at `app/src/styles/app.css:68-80`, viewport-sized first-visit section at `app/src/styles/app.css:109-116`, centered welcome content at `app/src/styles/app.css:147-156`, scroll-region padding at `app/src/AppShell.tsx:99-105`, and additional home padding at `app/src/screens/Home.tsx:49-53`.

This violates the 44px touch-affordance contract in `DESIGN.md:83-87` at the actual initial viewport and is blocking.

### S2-3 — The app shell is not rigorously token-driven

`DESIGN.md:9` names `design-v3/tokens/tokens.css` as the product token source, but `app/src/main.tsx:5-8` imports two different root token files. The new onboarding CSS then bypasses the available spacing and type tokens entirely:

- no `var(--space-*)` use in the reviewed app-shell/onboarding files despite the contract at `DESIGN.md:41-53`;
- one-off spacing and geometry such as `78px 20px 28px`, `22px`, `14px`, `13px 15px`, `68px`, and `72px` throughout `app/src/styles/app.css:147-350`;
- undeclared type sizes such as 26px and 13.5px at `app/src/styles/app.css:180-199`, which do not map to the scale in `DESIGN.md:27-39`;
- raw colors at `app/src/styles/app.css:5`, `app/src/styles/app.css:57`, and `app/src/App.tsx:23-28`.

Color usage within the product surface is mostly semantic, but the spacing/typography layer is still a screen-specific composition rather than a rigorous token implementation. This is blocking under the clone/design-system fidelity gate.

### S2-4 — Evidence integrity and prior success output are insufficient

All four supplied files have JPEG/JFIF signatures despite `.png` extensions:

- `.omo/evidence/launch-ready-2026-07-23/01-mobile-welcome.png`
- `.omo/evidence/launch-ready-2026-07-23/02-mobile-context.png`
- `.omo/evidence/launch-ready-2026-07-23/03-mobile-plan-pending.png`
- `.omo/evidence/launch-ready-2026-07-23/04-desktop-welcome.png`

They decode and can be visually inspected, but they cannot support a strict PNG alpha or trustworthy pixel-diff gate. The prior report claims unit, type, build, browser, 320px, and touch passes at `reports/implementation/LAUNCH_READY_IMPLEMENTATION_REPORT_2026-07-23.md:61-72` without linking any logs, traces, screenshots, or result artifacts. No capture script references the four launch-ready files.

The unlinked `320px PASS` is directly contradicted by the live production render described in S2-1. Misleading success output without artifact paths is an approval blocker.

## S3 / MEDIUM

### S3-1 — The shell always carries 184px of avoidable internal scroll range

Fresh production measurements:

- 375×667: scroll region 667px client height, 851px scroll height, 184px maximum scroll.
- 1330×900: scroll region 900px client height, 1084px scroll height, 184px maximum scroll.

The fixed tab bar is removed from flow, while the scroll region reserves 62px (`app/src/AppShell.tsx:99-105`), Home adds another 90px (`app/src/screens/Home.tsx:49-53`), and the nested first-visit section independently claims a viewport-derived minimum height (`app/src/styles/app.css:109-116`). This explains the persistent scrollbars in all four screenshots and leaves a blank tail after useful content.

The scroll is functional and context/plan screens align correctly after `scrollIntoView` (`app/src/screens/home/FirstPage.tsx:36-43`), so this is medium rather than high after separating the concrete welcome overlap in S2-2.

## S4 / LOW

No S4 findings.

## Verified strengths

- Real UI: `AppShell`, `Home`, `FirstPage`, `TabBar`, and `SavedToast` render live DOM controls; no raster screenshot, canvas, or `background-image` substitutes the reviewed screens.
- Reuse: shared `TabBar`/toast primitives live in `app/src/components/AppChrome.tsx`; first-visit states reuse `FirstVisitFrame`, `BackButton`, primary/secondary actions, and choice-row styling.
- Hierarchy: the screenshots consistently present a clear label → heading → explanation → primary action sequence.
- Touch sizing: skip/back controls are 44px high, primary/secondary actions 52px, choice rows 68px, and tab buttons 56px (`app/src/styles/app.css:118-145`, `app/src/styles/app.css:236-253`, `app/src/styles/app.css:268-314`, `app/src/styles/app.css:82-95`). The welcome guide overlap is the exception.
- Context and pending screenshots show no other clipping or control collisions.
- Desktop default: `app/src/App.tsx:15-18` and `app/src/AppShell.tsx:122-125` correctly route normal desktop visits to the real app, reserving the frame workspace for `?workspace=1`. `04-desktop-welcome.png` is a credible usable narrow journal app, with all welcome actions visible. Its 520px centered framing and wide gutters match `DESIGN.md:77-81`, so the mobile-like desktop width is not independently blocking.

## Evidence inspected

- `DESIGN.md`
- Full current source/diff for the app shell, first-visit flow, app chrome, launch tests, styles, token imports, related touch changes, and implementation report
- `design-v3/tokens/tokens.css`
- `colors_and_type.css`
- `colors_and_type_journal.css`
- `.omo/evidence/launch-ready-2026-07-23/01-mobile-welcome.png`
- `.omo/evidence/launch-ready-2026-07-23/02-mobile-context.png`
- `.omo/evidence/launch-ready-2026-07-23/03-mobile-plan-pending.png`
- `.omo/evidence/launch-ready-2026-07-23/04-desktop-welcome.png`
- Existing production build (`app/dist`, built 2026-07-23 23:13:37 +0900) inspected live at 375×667, 320×568, and 1330×900
- `reports/implementation/LAUNCH_READY_IMPLEMENTATION_REPORT_2026-07-23.md`

## Blockers before approval

1. Eliminate unnatural Korean word/particle breaks at 375px and 320px across welcome, context, and pending states.
2. Ensure the mobile welcome guide action has a fully visible and operable 44×44px minimum target above the fixed navigation at initial load.
3. Reconcile the canonical token source and replace onboarding/app-shell one-off spacing, typography, and raw color values with documented tokens.
4. Replace the mislabeled JPEG evidence with valid fresh PNG captures and provide artifact paths for every claimed browser, 320px, touch, build, type, and test pass.
