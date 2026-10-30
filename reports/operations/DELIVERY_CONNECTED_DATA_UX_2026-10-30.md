# Connected records: reference-to-interface acceptance

Date: 2026-10-30. PR: #374. Candidate acceptance is recorded separately below.

## Sources and observation boundaries

| Official source | Observed evidence | Adopted principle |
| --- | --- | --- |
| [Apple Fitness summary](https://support.apple.com/ko-kr/guide/iphone/iph4c34a8a95/ios) | Coordinator/Aside read official page and published summary image. Page OS selector observed; native app was not run. | Large meaningful value and unit, summary then individual activity. |
| [Apple Health data sources](https://support.apple.com/en-us/108779) | Coordinator read official source/access and manual-entry images; published 2026-09-14. | Keep source, permission and saved state distinct; date/value confirmation. |
| [Apple HIG feedback](https://developer.apple.com/design/human-interface-guidelines/feedback) | Aside read public document. | Put status near affected content; give a reason and next action; never rely on color alone. |
| [Garmin Connect product](https://www.garmin.com.sg/products/apps/garmin-connect-mobile/) | Root fetched official page and directly viewed its published Screen-1/Screen-2 images. | Primary activity values first; optional detail after the summary. |
| [Garmin summary/detail timing](https://support.garmin.com/en-US/?faq=Gc9fLgVllX6K8Kv8kT6X96) | Provider directly read official summary/detail examples. | Summary state does not prove detail synchronization; preserve explicit confirmation. |
| [Garmin activity editing](https://support.garmin.com/en-US/?faq=aNGg6LTaoT4X7fyCnIuQW6) | Aside read official navigation and export-original distinction. | Identify the individual activity and retain its source. |

Garmin published images have no verified current app build. These observations
are public-document/image research, not native-app reverse engineering or a
logged-in Apple/Garmin journey. No supported REA browser capture was executed by
root. Aside reported no exposed REA capture tool in its session. Product source
inspection and direct local-browser observations are recorded separately.

The Apple/Garmin sources do not establish an equivalent multi-record file-import
flow. Our selection, explicit-save and ownership rules remain the authority.
Android back-to-save, Apple source-priority automatic merging, vendor logos,
fonts, rings, sensor charts and private assets are not adopted.

## Applied mapping

| Principle | Product component and behavior | Acceptance evidence |
| --- | --- | --- |
| Value before explanation | `ImportedActivityFacts`: distance/time metrics, exact time meaning, missing values and source below. User-confirmed meaning is separate from original. | Fact contracts; local review at 375px; final independent review pending. |
| Recognizable selected row | `ReviewStage`: native checkbox, stable header, selection text and border, selected count and explicit N-record save. | Prior G1 selection/focus evidence remains scoped to its candidate; refreshed visual evidence pending. |
| Know the current step | `ImportActivities`: file selection / review / result, current-step semantics, heading focus at entry. | Direct local first-entry focus observed; final mobile review pending. |
| Preserve work while editing | Unchanged record choices retain matching source observation, candidate kind, savedAt and account write base; changed choices require re-selection with a reason. | Focused orchestration tests in `account-import-screens.contract.test.tsx`. |
| Honest pending/error recovery | `SavedStage`: unknown acknowledgment, exact retry, conflict-driven fresh read-only review. Prior result remains on review-load failure. | Focused account screen contracts; synthetic account browser evidence remains separate from live account success. |
| Exact individual destination | Only acknowledged ID/date pairs create links. Same-day links display distinct confirmed-journal numbers. | Exact-journal browser case and fact/accessibility contract; numbers identify result links, not original file row order. |
| Clear analysis scope | Action says “전체 가져온 기록 분석”; existing eligible confirmed-data gate retained. | Batch-confirmation contracts and file-analysis browser flow. |

Existing Pretendard, teal/ivory, AppHeading, next-action and space/radius/type
tokens are retained. New CSS is scoped to the import flow; no new global palette,
automatic saving or provider activation. The metric role is 1.5rem, and native
form controls retain a 44px minimum target. The save area remains in flow so it
cannot cover the last record or explanation.

## Review status

The three focused UI suites passed 57 cases (26 account-screen and 31 other
cases); app/E2E TypeScript passed. The added behavior cases cover valid REUSE and
ATTACH choice retention, candidate kind/base changes, no implicit write, and
failed/successful read-only re-review. A test expectation initially omitted the
existing save-time refresh; it now counts the two new review reads relative to
the state before re-review. A sandbox temporary-file rename error ran no tests;
the successful run is separate from that infrastructure failure.

Root directly observed 375px and 320px review, distinct selected/unselected rows,
the count/explicit-save update, preserved checkbox focus, 44px-or-larger choice
headers, and no horizontal overflow. The 320px observation found misaligned
metric values under a wrapped time label; flex label sizing was applied to align
values without hiding the time meaning. Root reloaded and directly observed the
final 320px result: the two first-row values share top 415.42px and the second-row
values share top 794.67px, with no horizontal overflow. Independent visual recheck
remains separate. First-entry heading focus was directly observed.

Actual app with synthetic authentication/HTTP passed two targeted browser cases
(36.7 seconds, no retries): exact journal among two same-day records, and pending
ACK exclusion through a validated retry. Root viewed `import-pending-320.png`
and `import-confirmed-375.png`: readable values, one primary next action, honest
pending explanation and distinct confirmed-journal link; no clipped content.
The local original artifacts are retained outside Playwright's cleanup tree in
`tools/rea-aside/ux-candidate-evidence-20261030` at the workspace root. These are
synthetic account screenshots, not personal account or phone observations.

Provider peer review is bound to the product hashes in the candidate manifest,
with no unresolved findings in that contract scope. Aside independently accepted
the observed 320/375/430px hierarchy, selection feedback, 200% DOM text enlargement
and the three synthetic account screenshots. This is not native browser zoom,
Dynamic Type, live-account execution or a whole-application accessibility audit.

Aside found two remaining concrete problems: valid empty TCX was labelled as an
unreadable file, and internal Back lost the More opener/scroll while native Back
restored them. The first now distinguishes recognized empty input from INVALID_FILE.
Internal Back now consumes the existing browser-back layer before restoring the
parent. Shared routing, storage and parser contracts were not rewritten. Aside
reloaded and confirmed empty/malformed distinction and exact opener/scroll restore
at 320px (622px) and 375px (536px). No mandatory UX finding remained in its observed
scope. A separate nonblocking keyboard-focus improvement moves focus to the result
region; its focused contract checks Enter, no write for exclusion, and the next Tab.

Five focused cases passed for those boundaries (16 seconds). The initial CI then
found an unsupported `exact` option in the new Testing Library test; that option
was removed without a product change. The final candidate must still pass required
CI. The product acceptance binds to `ImportActivities` SHA256
`710EA735E8299A5F05E7A16BE848CF850549B08EB924A61F50DB0815965610F9`
and CSS `AD725CFF73283033BEA1A0072EF7FB1D520F1A130F8A5395B25DBB7425DCF9F5`.

Conflict/partial-save/account-switch screens were not directly exercised by Aside;
their focused contract and peer code evidence remain separately identified.
Required CI, G3, normal merge and account-OFF Pages publication are separate gates.
This report is not a merge or deployment receipt.

Operational evidence uses synthetic records and de-identified stage outcomes.
No raw health values, tokens, personal activity IDs, routes or private screenshots
are collected for this report. Actual personal integration has not been proven.
