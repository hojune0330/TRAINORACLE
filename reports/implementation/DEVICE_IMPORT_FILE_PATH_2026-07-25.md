# 기기 데이터 가져오기 — 파일 업로드 경로 출하 보고 (IMP-2 / IMP-4 일부)

```yaml
source_model: FABLE
work_id: FABLE-DEVICE-IMPORT-FILE-2026-07-25
owner_directive: "가민 훕 같은 쌓인 데이터를 가져오는 서비스도 구현할 준비하고
  구현중임을 알리자"
status: SHIPPED
branch: fable/device-import
supersedes_in_part: reports/implementation/DEVICE_DATA_IMPORT_PREP_2026-07-24.md
companion: reports/implementation/DEVICE_IMPORT_FEASIBILITY_2026-07-25.md
```

## 1. 무엇이 출하되었나

**워치에서 내보낸 TCX/GPX 파일을 이 기기 일지로 옮기는 경로가 지금 동작한다.**
승인·계약·시크릿 없이 동작하는 유일한 경로라서 먼저 만들었다(§2).

| 항목 | 상태 |
|---|---|
| TCX 파서 (다중 랩 합산, Garmin Connect 내보내기 형식) | 동작 |
| GPX 파서 (트랙포인트 haversine 거리 + 타임스탬프 구간) | 동작 |
| 초안 → 사용자 확인 → 저장 3단계 화면 | 동작 |
| 중복 감지 (같은 날 · 거리 0.2km 이내, 없으면 시간 2분 이내) | 동작 |
| 출처 배지 "가져옴" (일지 목록 · 일지 상세) | 동작 |
| 가져온 값의 분석 격리 (통계·추이·훈련계획 제외) | 동작 · 테스트로 잠금 |
| Garmin / Strava / WHOOP OAuth 자동 연동 | **미구현 — 오너 결정 대기** |
| FIT 파일 | **미지원 — 결정 근거는 PREP 문서 §5.1** |

## 2. 왜 OAuth가 아니라 파일이 1차인가

동반 문서(`DEVICE_IMPORT_FEASIBILITY_2026-07-25.md`)의 조사 결과 요약:

- **Garmin Activity API**: `developer.garmin.com/gc-developer-program/activity-api/`
  — 기업(business) 신청·승인 절차를 거쳐야 접근 가능. 개인 개발자가 즉시
  키를 받는 구조가 아니다.
- **Strava API (2026)**: 개발자 구독 + 인증 앱 athlete 10명 한도 + 중개
  서비스 금지 조항. 오너 명의 계정·구독 결정이 선행되어야 한다.
- **WHOOP API**: 앱 등록에 WHOOP 기기 멤버십이 필요하다.
- **공통 기술 제약**: OAuth 2.0 authorization-code 교환에는 client secret이
  필요한데, 정적 SPA에는 시크릿을 둘 수 없다. 서버(예: Supabase Edge
  Function) 도입이 전제된다.

즉 자동 연동 착수를 막는 것은 코드 난이도가 아니라 **사람 명의의 계정 등록·
구독·승인**이다. 그래서 "지금 되는 것"을 먼저 출하했다.

## 3. 안전 경계 — 가져온 값은 분석에 들어가지 않는다

이 기능의 핵심 위험은 *파일에서 온 숫자가 사용자가 직접 확인한 숫자처럼
통계에 섞이는 것*이다. 기존 provenance 구조로 막았다.

```
distanceKm / durationMin / avgPace
  → DERIVED, derivedFrom: ["import:activity-file"], derivationRuleId: "import:tcx"
rpe → MISSING (파일에 없음. 사용자가 채울 몫. 0으로 채우지 않는다)
```

`REGISTERED_DERIVATION_RULE_IDS`가 비어 있으므로 DERIVED는 분석에서 제외된다.
여기에 **이중 차단**을 더했다: 나중에 누군가 `import:tcx`를 파생 규칙으로
등록해도, `derivedFrom`에 외부 가져오기 토큰이 섞인 값은
`isEligibleForAnalysis`가 여전히 거부한다.

일지에서는 그대로 보이고, 화면에는 "가져옴" 배지가 붙는다. 사용자가 RPE·
메모를 직접 채우면 그 필드는 EXPLICIT이 되어 정상적으로 분석에 쓰인다.

### 3.1 수정한 실제 버그

작업 중 발견: 초기 구현은 `derivedFrom: ["import-file"]`을 썼는데
`isValidEntryFieldProvenance`가 모든 `derivedFrom` 토큰이 **해당 일지 종류의
필드명**이기를 요구했다. 결과적으로 **가져오기 저장이 100% 실패**했고,
화면에는 실패가 보이지 않았을 것이다. 임시 프로브 테스트로 `ok:false`를
재현해 원인을 확정한 뒤, 외부 출처 토큰을 명시적으로 도입해 고쳤다:

- `EXTERNAL_DERIVATION_INPUTS = ["import:activity-file"]` — 파생 *입력*으로만
  허용되고, 분석 자격은 절대 얻지 못하는 토큰.
- 이 토큰이 섞인 값은 `isEligibleForAnalysis`에서 별도로 차단(§3의 이중 차단).

## 4. 사용자에게 보이는 정직성

- **기기 내 처리 명시**: "고른 파일은 서버로 올라가지 않아요."
- **fail-visible**: 날짜·기록을 읽지 못한 활동 수를 숨기지 않고 표시한다.
  "없는 값을 채워 넣지 않으려고 일부러 건너뛰어요."
- **무단 저장 없음**: 고른 것만 저장된다. 중복 의심 항목은 **기본 해제**로
  두어 사용자가 켜야 저장된다. 자동 병합은 하지 않는다.
- **자동 연동 카피 수정**: 계정 화면의 기존 티저는 Garmin/WHOOP/Strava 자동
  연동을 "곧 가져올 수 있어요"로 표현했으나, §2 조사 결과 시점을 약속할 수
  없다. 지금 되는 파일 경로만 약속하고, 자동 연동은 "각 서비스의 승인·계약
  조건 때문에 아직 시점을 약속할 수 없어요 · 연동은 언제나 읽기 전용"으로
  고쳤다.

## 5. 변경 파일

새로 만든 것:
- `app/src/domain/import/activity-file.ts` — TCX/GPX 파서 (DOMParser, 외부 의존 0)
- `app/src/domain/import/import-draft.ts` — 초안 변환·중복 감지·확인 저장
- `app/src/screens/ImportActivities.tsx` — 3단계 화면 (고르기 → 확인 → 저장)
- `app/src/domain/import/activity-file.contract.test.ts` (7)
- `app/src/domain/import/import-draft.contract.test.ts` (11)
- `app/src/screens/ImportActivities.contract.test.tsx` (9)
- `app/e2e/device-import.spec.ts` (4 × 4 프로젝트)

고친 것:
- `app/src/domain/field-provenance.ts` — 외부 출처 토큰 도입(§3.1),
  분석 이중 차단, `isImportedField` / `hasImportedField` 배지 헬퍼
- `app/src/AppShell.tsx` — `importOpen` 라우팅
- `app/src/screens/log-entry/EntryChooser.tsx`, `LogEntry.tsx` —
  "워치 기록 불러오기" 진입점
- `app/src/screens/LogDetail.tsx`, `app/src/screens/home/DeviceJournal.tsx` —
  "가져옴" 배지
- `app/src/screens/Account.tsx` — 정직한 카피 + 지금 되는 경로로 연결

## 6. 검증 (2026-07-25 실행)

```
npm test              24 files / 162 tests passed   (기준선 21 / 135 → +27)
npm run typecheck     통과
npm run typecheck:e2e 통과
npm run build         통과 (vite, 6.16s)
npx playwright test   107 passed / 21 skipped, 회귀 없음
```

가져오기 관련 신규 테스트 27개(계약 18 + 화면 9) + e2e 4개.

## 7. 오너 결정 대기 항목

`DEVICE_IMPORT_FEASIBILITY_2026-07-25.md`의 D-1 ~ D-6. 특히:

- **D-1** Garmin 기업 신청을 진행할지
- **D-2** Strava 개발자 구독 + 10명 한도 수용 여부
- **D-5** Strava의 중개 서비스 금지 조항 vs 기존 문서의 Terra 언급 충돌
- **D-6** 가져온 값을 (사용자 확인 후) 분석에 넣을지 — 현재는 전면 제외
