# ORDER_007_R_safety.md

review_id: ORDER_007_R_safety
persona: 스포츠의학 안전 심사자
mode: review_only_no_fix
result: S1 없음, S2 3건, S3 1건

## 확인 범위

- 코드 정독: `app/src/safety/memo-safety.ts`, `app/src/screens/LogEntry.tsx`, `app/src/screens/Home.tsx`
- 스펙 대조: `DAILY_LOG_AND_CHECKIN_SPEC.md`, `MEDIA_AND_TRANSIENT_CAPTURE_SPEC.md`, `ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT.md`

## 발견사항

```yaml
finding:
  id: R-safety-001
  severity: S2
  evidence: "app/src/safety/memo-safety.ts:33, app/src/safety/memo-safety.ts:44, app/src/screens/LogEntry.tsx:9, app/src/screens/LogEntry.tsx:95, app/src/screens/LogEntry.tsx:240, app/src/screens/LogEntry.tsx:353, specs/reconstruct/DAILY_LOG_AND_CHECKIN_SPEC.md:389"
  description: "`assessMemoTransient`는 D9 평가 실패 시 UNKNOWN fail-safe를 반환하지만, 현재 저장 흐름은 해당 함수를 호출하지 않는다. 따라서 자유 텍스트가 위험을 올릴 수 있다는 스펙 불변식이 앱 작성 흐름에는 아직 연결되지 않았다."
  suggested_direction: "저장 자체는 막지 않되, free-text 저장 전에 transient 평가를 실행해 non-sensitive reason code/review state만 연결한다."
  verified_how: "안전 래퍼와 세 저장 경로 코드 대조"
```

```yaml
finding:
  id: R-safety-002
  severity: S2
  evidence: "app/src/screens/LogEntry.tsx:573, app/src/screens/LogEntry.tsx:596, specs/reconstruct/ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT.md:523, specs/reconstruct/ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT.md:528"
  description: "통증 4 이상 배너는 '코치 확인 전까지 고강도 훈련 계획이 보류됩니다'라고 말한다. 그러나 현재 앱 화면은 표시용이고 실제 Plan Safety Gate/Plan Generator 차단 연결은 보이지 않는다. 안전 문구가 실제 실행 능력을 앞설 수 있다."
  suggested_direction: "게이트 연결 전까지는 '리뷰 대상입니다'로 낮추고, 실제 계획 생성 단계가 붙을 때 block/review 상태를 연결한다."
  verified_how: "UI 문구와 분석/게이트 표시 권한 스펙 대조"
```

```yaml
finding:
  id: R-safety-003
  severity: S2
  evidence: "app/src/screens/LogEntry.tsx:207, app/src/screens/LogEntry.tsx:218, specs/reconstruct/MEDIA_AND_TRANSIENT_CAPTURE_SPEC.md:263, specs/reconstruct/MEDIA_AND_TRANSIENT_CAPTURE_SPEC.md:291"
  description: "음성 메모 표면은 자동 변환을 암시하지만, MEDIA 스펙이 요구하는 transcript-before-D9 precheck, insufficient_source, D9_UNKNOWN fail-safe 경로는 구현 표면에서 확인되지 않는다."
  suggested_direction: "음성 기능은 구현 전 비활성화하거나, 로컬 전사 실패/평가 실패 상태를 안전하게 보여주는 흐름을 먼저 만든다."
  verified_how: "UI 코드와 MEDIA voice memo 계약 대조"
```

```yaml
finding:
  id: R-safety-004
  severity: S3
  evidence: "app/src/screens/Home.tsx:224, app/src/screens/Home.tsx:233, specs/reconstruct/JOURNAL_DELIGHT_AND_DECORATION_SPEC.md:177, specs/reconstruct/JOURNAL_DELIGHT_AND_DECORATION_SPEC.md:195"
  description: "`N일만 더 쓰면 한 주가 채워져요`는 훈련량 보상은 아니지만, 휴식/부상일도 기록일이라는 문구가 붙지 않으면 매일 해야 한다는 압박으로 읽힐 수 있다."
  suggested_direction: "넛지 문구에 '쉬는 날도, 아픈 날도 기록일'이라는 안전 문장을 포함한다."
  verified_how: "동기 문구와 safe streak 스펙 대조"
```

