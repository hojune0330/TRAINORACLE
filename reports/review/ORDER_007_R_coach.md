# ORDER_007_R_coach.md

review_id: ORDER_007_R_coach
persona: 입시·전문 코치, 실제 지도 데이터 품질 검토
mode: review_only_no_fix
result: S1 없음, S2 1건, S3 3건

## 확인 범위

- 코드 정독: `app/src/screens/LogEntry.tsx`, `app/src/screens/Home.tsx`, `app/src/screens/Trends.tsx`, `app/src/domain/aggregates.ts`
- 스펙 대조: `ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT.md`, `JOURNAL_DELIGHT_AND_DECORATION_SPEC.md`

## 발견사항

```yaml
finding:
  id: R-coach-001
  severity: S2
  evidence: "app/src/screens/LogEntry.tsx:403, app/src/screens/LogEntry.tsx:416, app/src/screens/LogEntry.tsx:432, app/src/screens/LogEntry.tsx:353, app/src/screens/LogEntry.tsx:357"
  description: "경기 직전 긴장도, 컨디션, 목표 페이스, 전략, 혼잣말은 코치에게 중요한 사전 맥락이지만 현재 저장 대상이 아니다. 화면에는 입력 표면이 있으나 `RaceEntry` 저장은 stage/record/rank/result/memo뿐이다."
  suggested_direction: "경기 전 입력을 저장 스키마로 승격하거나, 지금 단계에서는 데모 표면임을 분명히 한다."
  verified_how: "폼 렌더링과 persist 객체 대조"
```

```yaml
finding:
  id: R-coach-002
  severity: S3
  evidence: "app/src/domain/aggregates.ts:22, app/src/domain/aggregates.ts:24, app/src/screens/Trends.tsx:27, app/src/screens/Trends.tsx:31"
  description: "`parseFloat` 기반 거리 파싱은 `8km`, `8abc` 같은 값을 8로 받아들인다. 훈련 지도용 주간 거리 합계가 입력 실수에 관대하게 왜곡될 수 있다."
  suggested_direction: "숫자 필드는 저장 전 strict numeric parse를 적용하고, 단위는 UI 라벨로만 처리한다."
  verified_how: "집계 함수 정독"
```

```yaml
finding:
  id: R-coach-003
  severity: S3
  evidence: "app/src/screens/Trends.tsx:19, app/src/screens/Trends.tsx:21, app/src/screens/Home.tsx:218, app/src/domain/dates.ts:51"
  description: "주간 집계가 월요일 시작으로 고정돼 있다. 현장 팀이 대회 주기나 9.5일 사이클 기준으로 보려면, 현재 주간 숫자가 코치 관행과 다를 수 있다."
  suggested_direction: "초기에는 월요일 기준을 유지하되, 코치/팀 설정 또는 microcycle 기준 보기로 확장할 수 있게 명시한다."
  verified_how: "날짜 집계 코드 정독"
```

```yaml
finding:
  id: R-coach-004
  severity: S3
  evidence: "app/src/screens/Home.tsx:299, app/src/screens/Home.tsx:302, app/src/screens/LogEntry.tsx:285, app/src/screens/LogEntry.tsx:292"
  description: "저녁 일지의 체중/안정시 HR은 비워둘 수 있지만 홈 요약 문자열은 빈 값에도 `체중 kg · 안정시 HR` 형태가 될 수 있다. 코치가 빠르게 스캔할 때 기록 누락과 실제 값 0을 구분하기 어렵다."
  suggested_direction: "비어 있는 optional 필드는 요약에서 생략하고, 기록 없음 상태를 별도 라벨로 보여준다."
  verified_how: "요약 문자열 함수 정독"
```

