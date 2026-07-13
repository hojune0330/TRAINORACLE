# ORDER_007_R_frontend.md

review_id: ORDER_007_R_frontend
persona: 프론트엔드 코드 품질 엔지니어
mode: review_only_no_fix
result: S1 없음, S2 없음, S3 5건

## 확인 범위

- 코드 정독: `app/src/domain/journal-store.ts`, `app/src/domain/aggregates.ts`, `app/src/screens/Home.tsx`, `app/src/screens/Trends.tsx`, `app/src/screens/LogEntry.tsx`
- 문서 품질 대조: `SPEC_FILE_TRUTH_GUARD.md`, reconstruct spec final marker usage

## 발견사항

```yaml
finding:
  id: R-frontend-001
  severity: S3
  evidence: "app/src/domain/journal-store.ts:70, app/src/domain/journal-store.ts:77"
  description: "`loadEntries`가 schema 검증 없이 JSON 배열을 `JournalEntry[]`로 캐스팅한다. 버전 마이그레이션, 손상 데이터, 알 수 없는 kind가 모두 downstream 렌더링으로 넘어갈 수 있다."
  suggested_direction: "kind별 parser/migration 레이어를 두고, invalid entry는 격리하거나 복구 가능한 상태로 표시한다."
  verified_how: "저장소 코드 정독"
```

```yaml
finding:
  id: R-frontend-002
  severity: S3
  evidence: "app/src/domain/aggregates.ts:22, app/src/domain/aggregates.ts:24, app/src/screens/Trends.tsx:29, app/src/screens/Trends.tsx:41"
  description: "거리 집계가 `parseFloat`에 의존한다. 숫자로 시작하는 잘못된 문자열이 일부 정상 값으로 계산될 수 있다."
  suggested_direction: "strict decimal parser를 사용하고 저장 전 검증 오류를 UI에서 바로 보여준다."
  verified_how: "집계 코드 정독"
```

```yaml
finding:
  id: R-frontend-003
  severity: S3
  evidence: "app/src/screens/Home.tsx:22, app/src/screens/Home.tsx:23, app/src/screens/Home.tsx:305, app/src/screens/Home.tsx:306, app/src/screens/Trends.tsx:14, app/src/screens/Trends.tsx:15"
  description: "Home/Trends/MyDeviceJournal은 localStorage를 mount 시점에만 읽는다. AppShell의 저장 후 이동으로 일반 저장 루프는 대체로 갱신되지만, 다른 탭·export/import·storage event·삭제 후 외부 변경에는 반응성이 없다."
  suggested_direction: "journal-store에 revision/subscription 계층을 두거나, route 진입마다 명시적으로 재조회한다."
  verified_how: "React hook 사용 경로 정독"
```

```yaml
finding:
  id: R-frontend-004
  severity: S3
  evidence: "app/src/screens/LogEntry.tsx:403, app/src/screens/LogEntry.tsx:419, app/src/screens/LogEntry.tsx:432, app/src/screens/LogEntry.tsx:435"
  description: "Race pre-stage UI 일부는 controlled input이 아니다. 사용자가 누르거나 적는 값이 화면 state와 저장 model에 연결되지 않아 컴포넌트 신뢰도가 떨어진다."
  suggested_direction: "저장 전까지는 비활성 예시 처리하거나, state와 JournalEntry 확장을 함께 적용한다."
  verified_how: "폼 control 여부 정독"
```

```yaml
finding:
  id: R-frontend-005
  severity: S3
  evidence: "SPEC_FILE_TRUTH_GUARD.md:21, specs/reconstruct/DAILY_LOG_AND_CHECKIN_SPEC.md:29, specs/reconstruct/DAILY_LOG_AND_CHECKIN_SPEC.md:656, specs/reconstruct/PLAN_SAFETY_GATE_SPEC.md:29, specs/reconstruct/PLAN_SAFETY_GATE_SPEC.md:537"
  description: "일부 reconstruct 문서는 metadata 안에 `final_marker_required: \"[DRAFT_COMPLETE]\"`를 두고 마지막 줄에도 `[DRAFT_COMPLETE]`를 둔다. 실제 '마커 뒤 텍스트' 위반은 아니지만, 단순 grep 자동화는 중복 마커로 오판할 수 있다."
  suggested_direction: "metadata는 `final_marker_required: true`처럼 바꿔 자동화가 실제 final marker와 정책 문자열을 구분하게 한다."
  verified_how: "문서 정독 + marker grep 결과 대조"
```

