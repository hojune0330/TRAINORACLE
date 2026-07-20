# Formation Coach Ruleset Fixtures

```yaml
fixture_pack_id: TO-WO012-COACH-RULESET-2026-07-20
status: OWNER_RESPONSES_RECORDED_PENDING_INDEPENDENT_REVIEW
owner_direction_recorded: true
fixture_count: 30
ruleset_accepted: false
runtime_authority: false
```

These fixtures preserve recorded owner direction for independent review. They are
not executed evidence, qualified acceptance, physiological validation, implementation
authority, or runtime authority.

| ID | Scenario | Pending-review expected result |
|---|---|---|
| CR-01 | version, owner, or frame missing | Reject the registry; all three gates are required. |
| CR-02 | 9.5 days described as scientifically optimal | Reject the claim; retain pilot heuristic only. |
| CR-03 | roughly 72 hours described as clearance | Reject the claim; retain placement heuristic only. |
| CR-04 | planned MAIN count is one or four | Default 2-3 MAIN; inspect current + immediate prior + next; maximum 3 frames, otherwise retain default; return `NEEDS_REVIEW_WITH_REASON`, never automatic execution. |
| CR-05 | planned MAIN count is two | Count is permitted only with placement and recovery review. |
| CR-06 | planned MAIN count is three | Count is permitted only with placement and recovery review. |
| CR-07 | completed competition on a competition day | Preserve separate competition records; one MAIN placement per competition day with a visible text marker; not a star-only marker. The canonical day-boundary definition remains open. |
| CR-08 | competition parent and components coexist | Count one contribution; never double count. |
| CR-09 | completed SUB, LD, or TEST | Contribution is zero; classification check recommended. |
| CR-10 | duplicate adapter result and separate same-day session | De-dupe repeated record only; distinct same-day sessions protected; review recommended. |
| CR-11 | planned and completed record share session identity | Keep views separate; do not sum. |
| CR-12 | a MAIN was missed | Keep planned fact; no automatic catch-up. |
| CR-13 | multiple MAIN become compressed after miss | Reject compression; no double count or automatic catch-up. |
| CR-14 | composite parent plus leaves | Preserve identity and reject double count. |
| CR-15 | whole-session RPE is split to components | Reject the split. |
| CR-16 | plyometric component appears between MAIN | Mandatory added-check prompt only for explicit strong or high classification only; no RPE or free-text inference; no threshold inferred. |
| CR-17 | required fact is stale, missing, or legacy | Request current provenance; do not infer. |
| CR-18 | private memo changes while other facts match | private memo remains excluded; one-tap acknowledgement creates no signal and cannot change exclusion. |
| CR-19 | active or unknown safety state | Block; first show rationale and a conservative alternative; second, separate surface creates a request or draft only; never bypass safety. |
| CR-20 | taper interaction begins | Show conservative rest; two-step taper request only, with no automatic plan change. |
| CR-21 | recovery adjustment is requested | After two steps, user chooses coach review or self-confirmed adjustment draft; no automatic execution or actual-plan change. |
| CR-22 | increase is requested | After two steps, user chooses coach review or self-confirmed adjustment draft; no automatic execution or actual-plan change. |
| CR-23 | fixed competition collides with flexible MAIN | Preserve fixed competition; request review for the flexible MAIN. |
| CR-24 | re-anchor is considered | Offer a guided disposition selector; no accidental one-click schedule mutation. |
| CR-25 | predecessor MAIN was missed at successor start | No carry-over and no successor debt. |
| CR-26 | exposure occurs exactly at frame start | Start-inclusive: current named frame only. |
| CR-27 | exposure occurs exactly at frame end | End-exclusive: contiguous successor only. |
| CR-28 | DST fold or gap lacks explicit resolution | Reject frame; no guessed instant. |
| CR-29 | rules conflict | priority: safety > fixed competition > recovery/high-plyo > coach > macro 2-3-frame > user convenience; unresolved conflict remains review-only. |
| CR-30 | unauthorized view/edit or authorized correction | Deny unauthorized access; explicit sharing and append-only auditable correction only. |

## Trace

- `WO012-T01`: CR-01 through CR-06, CR-10, CR-14 through CR-17, CR-20 through CR-22, CR-24, CR-28, and CR-29.
- `WO012-T02`: CR-07 through CR-09, CR-11 through CR-13, CR-23, and CR-25 through CR-27.
- `WO012-T03`: CR-18, CR-19, and CR-30.

[OWNER_RESPONSES_RECORDED_PENDING_INDEPENDENT_REVIEW]
