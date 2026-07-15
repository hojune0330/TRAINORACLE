# Data Provenance Runtime Adoption Decision

```yaml
decision_id: TO-DECISION-DATA-PROVENANCE-RUNTIME-2026-07-14-001
status: OWNER_ADOPTED_RUNTIME_IMPLEMENTATION_UNMERGED
owner_direction: "G0 저장 방식 A를 지금 채택한다."
scope:
  applies_to: new device-local journal writes
  metadata_field: fieldProvenance
  states: [EXPLICIT, DERIVED, MISSING]
  legacy_read_rule: "fieldProvenance가 없는 기존 기록은 그대로 읽되 LEGACY_MISSING_PROVENANCE로 해석한다."
  analysis_rule: "EXPLICIT만 기본 분석 대상이다. MISSING, legacy, invalid, unknown-rule, nested, incomplete DERIVED는 제외한다."
  privacy_rule: "출처 메타데이터에는 필드 이름만 남기며 메모, 증상 서술, 원문은 넣지 않는다."
  race_self_checks: "현재 표시 전용이며 통계나 훈련계획 입력으로 승격하지 않는다."
```

## What Is Implemented Here

- 훈련 후, 저녁 체크인, 경기 화면은 값마다 `EXPLICIT` 또는 `MISSING`을 함께 저장한다.
- 현재 허가된 파생 규칙 목록은 비어 있다. 따라서 앱은 `DERIVED`를 분석에 쓰지 않는다.
- 출처 메타데이터가 없거나 잘못되어도 기존 기록은 일지에서 볼 수 있다. 다만 분석, 추이, 미래 Formation 입력에서는 제외한다.
- 분석 사본에는 메모, 메모 목적, 원문 텍스트가 들어가지 않는다.

## Default-Off And Rollback Evidence

- 기본 차단: 출처가 없으면 분석 대상이 아니다. `MISSING`도 분석 대상이 아니다.
- 파생 차단: 등록된 규칙이 없으므로 모든 `DERIVED` 값이 분석에서 제외된다.
- 부분 기록: 비어 있는 값이 있어도 저장할 수 있으며, 직접 입력한 값만 분석 사본에 남는다.
- 복구 연습: `journal-provenance.contract.test.ts`는 기존 저장소 스냅샷을 복원한 뒤 원래 기록이 그대로 보이고 분석에는 다시 들어가지 않는지 확인한다.

## Still Deliberately Closed

1. 파생 규칙 ID의 승인과 사용자 화면 작성은 별도 결정 없이는 열지 않는다.
2. imported 또는 demo 데이터의 별도 출처 라벨은 아직 채택하지 않는다.
3. 이 결정은 Formation 실행, 자동 처방, 코치 공유, 서버 전송을 열지 않는다.
4. 이 변경은 병합 전까지 `origin/main`의 런타임 상태를 바꾸지 않는다.
