# WO012 코치 책임자 검토 안내

```yaml
order_id: CODEX_WORK_ORDER_012
document_role: OWNER_READABLE_WALKTHROUGH
fixture_source: specs/test-packages/FORMATION_COACH_RULESET_FIXTURES.md
fixture_count: 30
status: OWNER_RESPONSES_RECORDED_PENDING_INDEPENDENT_REVIEW
competition_direction_ref: reports/review/FORMATION_COMPETITION_RECORD_IDENTITY_OWNER_DECISION.md
ca_02_formal_decision: NOT_REVIEWED
ca_03_formal_decision: NOT_REVIEWED
owner_answers_recorded: true
ruleset_accepted: false
runtime_authority: false
marker_text_or_visual_semantics: PENDING_OWNER_RECONCILIATION
```

## 검토 경계

이 안내서는 기록된 책임자 방향을 독립 검수자에게 보여줍니다. 규칙을 실행하거나
계획을 만들거나 레지스트리를 채택하지 않으며, 9.5일과 약 72시간을 안전·생리학
보장으로 만들지 않습니다. 모든 사례는 비실행 경계를 지켜야 합니다.

MAIN 1회·4회 예외는 현재 + 바로 앞 + 바로 뒤, 최대 3개 프레임을 검토합니다. 그 외에는
2-3 MAIN 기본값과 `NEEDS_REVIEW_WITH_REASON`을 유지합니다. 강한 플라이오는 명시
`strong/high` 분류만 뜻하며 RPE·자유 서술에서 추정하지 않습니다. 보호된 상호작용은
첫 화면에서 이유와 보수적 대안을 보여주고, 둘째 별도 화면에서 검토 요청·조정 초안만
만듭니다. 실행하거나 안전을 우회하지 않습니다.

대회 관련 기록과 계획 MAIN은 분리합니다. 병합된 방향은 완료 경기 기록을 각각
보존하고, 달력 앵커 기여를 0으로 두며, 같은 현지 대회 날짜의 계획 MAIN은 0 또는
1회로 제한합니다. CR-07의 "1회"와 "별표 같은 표식"은 이 기준을 바꾸는 최종 규칙이
아니며, 책임자 정렬이 끝날 때까지 검토 대기입니다.

## Case-by-Case Direction

| ID | Recorded direction | Independent-review cue |
|---|---|---|
| CR-01 | Approve version, owner, and frame gates. | Missing gate data remains ineligible. |
| CR-02 | Approve the 9.5-day pilot heuristic. | It is not a proven optimum. |
| CR-03 | Approve roughly 72 hours as a placement heuristic. | It is not recovery clearance. |
| CR-04 | Default to 2-3 MAIN; exception is review-only. | A one/four frame returns `NEEDS_REVIEW_WITH_REASON`. |
| CR-05 | Approve two MAIN. | Review placement and recovery. |
| CR-06 | Approve three MAIN. | Review placement and recovery. |
| CR-07 | Record a revision request: one MAIN and a star-like marker. | Keep the merged local-date zero-or-one direction until owner reconciliation. |
| CR-08 | Never double count competition components. | Parent and components contribute once. |
| CR-09 | Auxiliary sessions contribute zero. | Classification check recommended. |
| CR-10 | De-dupe repeated records. | Distinct same-day sessions remain protected; review recommended. |
| CR-11 | Keep planned and completed separate. | Do not sum views. |
| CR-12 | Do not catch up missed MAIN. | A miss does not create an automatic candidate. |
| CR-13 | Do not compress MAIN after a miss. | No double count or catch-up. |
| CR-14 | Preserve composite identity. | Do not double count parent and leaves. |
| CR-15 | Keep whole-session RPE whole. | Do not allocate it to components. |
| CR-16 | Prompt for an added check on explicit strong/high plyometrics. | Never infer a threshold. |
| CR-17 | Request current provenance for stale/missing facts. | Do not infer facts. |
| CR-18 | Exclude private memo from analysis. | One-tap acknowledgement cannot create a signal or alter exclusion. |
| CR-19 | Safety interaction is two-step and request-only. | Safety cannot be bypassed. |
| CR-20 | Show conservative rest for taper. | Taper is a two-step request only. |
| CR-21 | Offer coach review or self-confirmed adjustment draft after two steps. | Never automatically execute or change the actual plan. |
| CR-22 | Offer the same two-step choice for an increase. | Never automatically execute or change the actual plan. |
| CR-23 | Preserve fixed competition. | A flexible MAIN does not displace it. |
| CR-24 | Use an easy guided re-anchor selector; never an accidental one-click schedule mutation. | Disposition must stay reviewable. |
| CR-25 | Do not carry MAIN debt across frames. | A missed predecessor remains missed. |
| CR-26 | Use start-inclusive frame membership. | Start boundary belongs to current frame. |
| CR-27 | Use end-exclusive frame membership. | End boundary belongs to successor frame. |
| CR-28 | Require an explicit DST resolution. | Never guess an instant. |
| CR-29 | Apply the recorded conflict-priority proposal. | Safety outranks convenience. |
| CR-30 | Deny unauthorized access. | Sharing is explicit; correction is auditable. |

## 검토 완료 조건

검수자는 30개 사례를 픽스처와 대조하고 우려를 독립 검수에 기록합니다. 이 기록은
계속 대기 상태이며, 런타임 권한·정본 스펙 변경·개인정보 또는 과학 전문 승인으로
간주할 수 없습니다.

[OWNER_RESPONSES_RECORDED_PENDING_INDEPENDENT_REVIEW]
