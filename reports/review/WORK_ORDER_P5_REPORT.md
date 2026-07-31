# WORK ORDER P5 구현 보고

## 1. 실행 경계

- 기준 main: `8862d7e86dd7cf35975b00e5cf9d2ae3c1f68d1d`
- 작업 head: `RECORDED_IN_GITHUB_RECEIPT`
- 실행 모델: `gpt-5.6-sol`
- 추론 강도: `ultra`
- 최신 Owner 지시가 이전 Terra XHigh 실행 문구를 대체한다.
- 이 작업은 일지의 설명 통계를 표시한다. 계획 후보 생성, 개인 처방, 준비도 판정,
  D9 또는 Safety Gate 변경 권한은 없다.

## 2. 실제 변경 범위

### 도메인

- `app/src/domain/journal-observation.ts`
- `app/src/domain/trend-analysis.ts`
- `app/src/domain/weekly-distance.ts`

### 기존 Trends 확장

- `app/src/screens/Trends.tsx`
- `app/src/screens/trends/MonthlyTrendBars.tsx`
- `app/src/screens/trends/MonthlyTrendSection.tsx`
- `app/src/screens/trends/WeeklyDistanceSection.tsx`
- `app/src/screens/trends/trend-display.ts`

### 계약 및 브라우저 검증

- `app/src/domain/journal-observation.contract.test.ts`
- `app/src/domain/trend-analysis.contract.test.ts`
- `app/src/domain/weekly-distance.contract.test.ts`
- `app/src/screens/trends/TrendsProvenance.contract.test.tsx`
- `app/src/screens/trends/TrendsSafeAccessibility.contract.test.tsx`
- `app/e2e/p5-provenance-trends.spec.ts`
- 기존 Trends를 확인하는 브라우저 계약 5개

별도 `records` 화면은 만들지 않았다. `PlanBeta`, plan domain, `impl/`, `specs/`는
기준 main과 비교해 변경이 없다.

## 3. Privacy-safe projection

전체 `JournalEntry`를 집계 함수에 넘기지 않는다. 먼저 허용된 구조화 값만
`StructuredJournalObservation`으로 투영한다.

| 구분 | 필드 | 처리 |
|---|---|---|
| 허용 | `sourceRef`, `loggedOn` | 출처와 로컬 달력 날짜 보존 |
| 허용 | `distanceKm`, `durationMin`, `secondsPerKm`, `rpe` | 세션 수치 |
| 허용 | `mood`, `painMax` | 일일 체크인의 구조화 수치 |
| 허용 | `painSourceLevels` | 통증 최대값 검증용 숫자만 보존 |
| 허용 | `fieldProvenance`, `derivationRefs` | 직접값과 등록 파생값 감사 |
| 제외 | `memo`, `note`, `memoPurpose` | 읽거나 복사하거나 조건으로 사용하지 않음 |
| 제외 | `record`, `result`, `symptom`, `quote`, `summary` | projection 키로 생성하지 않음 |
| 제외 | 통증 부위 이름 | 최대값 산출 뒤 분석 객체에 보존하지 않음 |
| 제외 | 임의 자유서술 | 집계, DOM, 접근성 이름, 로그에 사용하지 않음 |

구조화 필드는 같고 개인 메모의 원문, 목적, 길이만 다른 두 입력의 projection과
aggregate 직렬화 결과가 byte-identical임을 계약 테스트로 고정했다. 메모만 있는
일지는 observation 자체를 만들지 않는다. 명령처럼 보이는 메모 문자열도 데이터로
읽지 않는다.

## 4. Provenance와 적격성

| 상태 | 결과 |
|---|---|
| 유효한 `EXPLICIT` | 직접 집계 |
| 등록되고 완전한 `DERIVED` | 수식과 입력을 다시 확인한 뒤 집계 |
| `MISSING` | 제외, 0으로 대체하지 않음 |
| `LEGACY_MISSING_PROVENANCE` | 제외 |
| imported/demo 또는 `SOURCE_NOT_VERIFIED` | 제외 |
| 불완전하거나 위조된 `DERIVED` | 제외 |
| `STALE` / `CONFLICTING` | 상태를 숨기지 않고 `확인 필요`와 불확실성 텍스트 표시 |

페이스 파생값은 다음 조건을 모두 만족해야 한다.

1. 거리와 시간이 유한한 양수다.
2. 거리와 시간 provenance가 모두 `EXPLICIT`이다.
3. `secondsPerKm = round(durationMin * 60 / distanceKm)`가 정확히 일치한다.
4. `derivedFrom`과 `JOURNAL_DISTANCE_DURATION_TO_SECONDS_PER_KM_V1`이 정확하다.

따라서 참조 문자열만 흉내 내거나, 입력을 비우거나, 수식과 다른 페이스를 넣은
파생값은 집계되지 않는다.

통증은 부위별 `EXPLICIT` 숫자의 최대값을
`JOURNAL_EXPLICIT_PAIN_PARTS_TO_MAX_V1` 등록 파생값으로 만든다. 원문 요구의
4개월 기분·통증 표시를 지원하되, 통증 부위 이름이나 자유서술은 분석 객체에
남기지 않는다.

## 5. 손검산 결과

`today = 2026-07-27`, 4개월, 기록 초 단위 fixture 결과는 다음과 같다.

| 월 | 상태 | n | 중앙값 | 최소/최대 |
|---|---|---:|---:|---|
| 2026-04 | DATA | 1 | 1170 | 1170/1170 |
| 2026-05 | MISSING | 없음 | 수치 키 없음 | 없음 |
| 2026-06 | DATA | 2 | 1133 | 1124/1142 |
| 2026-07 | DATA | 1 | 1160 | 1160/1160 |

5월은 0, 이전값, 다음값 또는 보간값으로 채우지 않는다. 월별 DATA에는 표본 수,
범위, 출처가 있고 MISSING에는 numeric key가 없다.

## 6. 화면 결과

- 최근 4주 거리는 합계, 집계 사용 수, 집계 제외 수, 누락 주를 표시한다.
- 기존 `distanceRampBalance`와 `BalanceMarker` 연결을 Trends에서 제거했다.
- `기준: 데모`, `과다`, 준비도·위험·향상·다음 강도 판단을 표시하지 않는다.
- 최근 4개월은 거리, 페이스, 기분, 통증을 전환할 수 있다.
- 모든 차트에는 표 형식 대안이 있다.
- 빈 월과 빈 주는 선이나 0 막대가 아니라 `없음`으로 표시된다.
- 출처 ID가 길어도 줄바꿈되며, `STALE`과 `CONFLICTING`은 색상 외 텍스트로
  구분한다.

화면 증거:

- `.omo/evidence/task-8-p5-trends-393x852.png`
- `.omo/evidence/task-8-p5-trends-sources-393x852.png`
- `.omo/evidence/task-8-p5-trends-320x568.png`
- `.omo/evidence/task-8-p5-trends-1440x900.png`

393px, 320px, 1440px 모두 `scrollWidth = innerWidth`, 개인 메모 노출 0,
콘솔 오류 0이었다. 320px에서 네 항목 버튼은 각각 69x44px였다.

## 7. 회귀 및 적대 검증

- P5 집중 계약: 5 files, 19 tests 통과
- 앱 전체 단위 테스트: 53 files, 442 tests 통과
- 앱 타입 검사와 E2E 타입 검사 통과
- 앱 프로덕션 빌드: 1814 modules 통과
- 처방 엔진: 10 files, 107 tests와 타입 검사 통과
- P5 + launch browser: 33 passed, 3 viewport 조건부 skipped
- 전체 Playwright: 212 발견, 177 passed, 35 viewport 조건부 skipped, 실패 0
- `git diff --check` 통과
- 새 제품 파일은 모두 250줄 이하
- `as any`, `@ts-ignore`, `@ts-expect-error` 추가 0건

적대 테스트는 LEGACY, MISSING, unverified import, incomplete DERIVED, 위조
페이스 공식, 잘못된 숫자, 빈 월, 메모 명령문, 긴 출처 ID, 320px, reduced motion,
STALE/CONFLICTING 표시를 직접 확인한다.

기본 병렬 `npm test`가 Windows에서 한 차례 종료되지 않아 해당 작업의 PID 트리를
종료했다. 성공 증거는 이를 통과로 오인하지 않고, 종료가 보장된 단일 worker
전체 실행 442/442로 다시 취득했다.

## 8. 닫혀 있는 경계

- 분석값은 PlanBeta 후보를 생성하거나 순서를 바꾸지 않는다.
- 분석값은 plan state/query로 전달되지 않는다.
- 분석값은 D9나 Safety Gate를 해제하지 않는다.
- 현재 결과는 과학적 최적성, 부상 위험, 회복 완료, 다음 훈련 강도의 판단이 아니다.
- 처방 근거로 채택하려면 별도 Owner 결정과 안전 계약이 필요하다.
