# PLAN_JOURNAL_LINKAGE_V1_IMPLEMENTATION_2026-08-28.md

## 1. Result

TrainOracle now has a production-bound V1 path from one visible non-rest plan session to one post-session journal. The athlete must select `이 훈련 일지 쓰기` on the exact day and AM/PM session. No date matching, title matching, memo analysis, or energy-system inference creates the link.

## 2. Implemented Boundary

- derives opaque `planVersionId`, `candidateFingerprint`, `sessionContentFingerprint`, and `plannedSessionId` values;
- binds day, AM/PM slot, planned date, role, and planned energy intent into the immutable identity;
- rejects a session that is absent from the stored active plan;
- routes the athlete back to the plan tab after saving or leaving the linked journal;
- keeps the actual journal energy field empty until the athlete selects it;
- allows one visible journal result per `plannedSessionId` on one device;
- preserves the link through structured safe export and authenticated sync payloads;
- prevents journal edits from adding, removing, or replacing the link;
- keeps progress marks, planned intent, and performed journal facts separate.

## 3. Privacy And Safety

The link contains no raw candidate ID, memo, symptom clause, free text, name, email, phone number, or medical narrative. Private memo policy remains independent. Public profile and friend-sharing payloads receive no new access.

The implementation does not mark a plan session complete after journal save, does not copy planned energy intent into actual classification, and does not adjust intensity, volume, or frequency.

## 4. Verification

| Check | Result |
|---|---:|
| New focused linkage/UI/state tests | 16 PASS |
| Full app unit tests, default timezone | 1,737 PASS |
| Full app unit tests, KST | 1,737 PASS |
| Hosted release environment tests | 11 PASS |
| Linked plan-to-journal browser flow, desktop/mobile/320px | 3 PASS |
| App TypeScript | PASS |
| Browser-test TypeScript | PASS |
| Production build | PASS |
| Git diff whitespace check | PASS |

The existing error-boundary tests intentionally print render failures while passing. They are expected test fixtures, not runtime failures.

The focused browser flow was run against a freshly started production preview on an isolated port. This avoids reusing an older local preview process and verifies the built artifact that contains the linkage change.

## 5. Remaining Boundaries

- Exact local-civil 9.5-day attribution remains open until timezone, tzdb, resolved occurrence instant, and DST policy exist.
- Historical plan archives still need full immutable session snapshots.
- Cross-device duplicate-link conflict handling requires server merge and tombstone tests.
- `OI-ESA-PLAN-JOURNAL-LINKAGE-001` is not closed by this implementation report.

## 6. Source Contract

The narrow V1 rules are recorded in `specs/reconstruct/PLAN_JOURNAL_LINKAGE_CONTRACT.md` as `DRAFT_FOR_REVIEW`. That draft is not canonical promotion or independent runtime authority.
