# PERIODIZATION_LINEAGE_V1_IMPLEMENTATION_2026-08-28.md

## 1. Implemented Scope

- New selected plans receive an opaque periodization lineage at frame 1 of 18.
- Three consecutive plan frames form one stable V1 display group; six groups form the approximately 24-week direction.
- The visible phases follow the owner direction: frames 1-6 base, 7-11 development, 12-16 competition-specific, and 17-18 taper/peak.
- The lineage advances exactly once only when an accepted successor frame is activated.
- The predecessor position is retained in local plan history, whose bounded capacity increases from 5 to 18 summaries.
- After frame 18, the program lineage remains stable while macrocycle ordinal advances and frame position returns to 1.
- The active plan shows the current frame, group, phase, and an 18-segment direction track.

## 2. Non-Authority Boundary

The lineage has no intensity, volume, frequency, readiness, safety, medical, forecast, or efficacy field. Calendar position and phase position cannot create an adaptation proposal. Existing registered adaptation transforms remain unchanged: maintain, reduce, or change method is the default product direction, and any increase candidate still requires the separately verified PB/SB or explicit-request path.

The display describes an owner-approved planning convention, not universal biological superiority.

## 3. Verification

| Check | Result |
|---|---:|
| Lineage, schema, store, successor, adaptation and UI focused tests | 146 PASS |
| Full app unit tests, default timezone | 1,743 PASS |
| Full app unit tests, KST | 1,743 PASS |
| Hosted release environment tests | 11 PASS |
| Browser direction flow, desktop/mobile/320px/reduced-motion | 4 PASS |
| App TypeScript | PASS |
| Browser-test TypeScript | PASS |
| Production build | PASS |

The existing error-boundary and lazy-chunk tests intentionally print fixture failures while passing. They are not periodization runtime failures.

## 4. Remaining Boundaries

- Athlete timezone, tzdb, DST, and exact local-civil occurrence identity remain open.
- Plan history still stores summaries rather than full immutable session snapshots.
- Server backup, cross-device merge, tombstones, and account deletion require complete lineage lifecycle tests.
- Variable 3-6 frame mesocycles and competition-anchor phase changes require separately accepted rules.
- This V1 does not expand detailed prescriptions beyond the currently activated event/template range.

## 5. Source Draft

`specs/reconstruct/PERIODIZATION_LINEAGE_CONTRACT.md` records the narrow contract as `DRAFT_FOR_REVIEW`. It is not canonical promotion or standalone production authority.
