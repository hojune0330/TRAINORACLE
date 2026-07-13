# ORDER_007_R_motivation.md

review_id: ORDER_007_R_motivation
persona: 스포츠 심리 전문가
mode: review_only_no_fix
result: S1 없음, S2 없음, S3 3건, S4 1건

## 확인 범위

- 코드 정독: `app/src/screens/Home.tsx`, `app/src/screens/Trends.tsx`, `app/src/screens/LogEntry.tsx`
- 스펙 대조: `JOURNAL_DELIGHT_AND_DECORATION_SPEC.md`

## 발견사항

```yaml
finding:
  id: R-motivation-001
  severity: S3
  evidence: "app/src/screens/Home.tsx:224, app/src/screens/Home.tsx:233, specs/reconstruct/JOURNAL_DELIGHT_AND_DECORATION_SPEC.md:177, specs/reconstruct/JOURNAL_DELIGHT_AND_DECORATION_SPEC.md:190"
  description: "`N일만 더 쓰면 한 주가 채워져요`는 부드러운 넛지지만, 휴식/통증일도 인정한다는 메시지가 없으면 성실함 압박으로 읽힐 수 있다."
  suggested_direction: "`쉬는 날도 기록이면 충분해요`처럼 자기결정성과 안전을 같이 지지하는 문장으로 보강한다."
  verified_how: "문구 정독 + safe streak 계약 대조"
```

```yaml
finding:
  id: R-motivation-002
  severity: S3
  evidence: "app/src/screens/Trends.tsx:80, app/src/screens/Trends.tsx:88"
  description: "추이 빈 화면의 `일주일만 써도 첫 그래프` 문구는 목표를 낮춰주는 장점이 있지만, 시작 직후 학생에게 '매일 채워야 한다'는 기준으로 느껴질 수 있다."
  suggested_direction: "`몇 번만 적어도 흐름이 보여요`처럼 빈도 압박을 줄인 문구를 검토한다."
  verified_how: "문구 정독"
```

```yaml
finding:
  id: R-motivation-003
  severity: S3
  evidence: "app/src/screens/LogEntry.tsx:573, app/src/screens/LogEntry.tsx:596"
  description: "통증 배너 문구는 안전 메시지로 필요하지만, 실제 게이트 연결 전에는 '내가 큰일을 만들었다'는 불안을 줄 수 있다."
  suggested_direction: "불안을 낮추기 위해 `기록한 건 잘한 일`을 먼저 말하고, 그 다음 지도자/보호자 상담을 안내한다."
  verified_how: "문구 정독"
```

```yaml
finding:
  id: R-motivation-004
  severity: S4
  evidence: "app/src/screens/Home.tsx:55, app/src/screens/Home.tsx:64, app/src/screens/Home.tsx:67"
  description: "첫 화면의 '첫 페이지' 문구는 자율성과 소유감을 준다. 일지 앱으로 들어오게 만드는 방향은 적절하다."
  suggested_direction: "이 톤을 유지하고, 기록이 훈련 성과가 아니라 자기 이해라는 점을 계속 강조한다."
  verified_how: "문구 정독"
```

