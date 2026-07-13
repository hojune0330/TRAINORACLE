# ORDER_007_R_SUMMARY.md

review_id: ORDER_007_R_SUMMARY
mode: review_only_no_fix
branch: codex/work-order-007-taskr
scope: ORDER_007 Task R

## 결론

S1 치명 이슈는 발견하지 못했다. 다만 S2 중대 이슈가 여러 페르소나에서 반복된다. 핵심은 세 가지다.

1. 자유 텍스트/음성 메모가 D9 transient 평가 경로에 아직 붙지 않았다.
2. 현재 앱 UI 일부가 실제 저장/차단 능력보다 앞선 표현을 한다.
3. 접근성, export privacy, SSO 현실 상태 정리가 다음 로드맵에 들어가야 한다.

## 집계

| persona | S1 | S2 | S3 | S4 |
|---|---:|---:|---:|---:|
| student | 0 | 1 | 2 | 1 |
| parent | 0 | 2 | 2 | 0 |
| coach | 0 | 1 | 3 | 0 |
| safety | 0 | 3 | 1 | 0 |
| privacy | 0 | 3 | 1 | 0 |
| frontend | 0 | 0 | 5 | 0 |
| a11y | 0 | 3 | 2 | 0 |
| motivation | 0 | 0 | 3 | 1 |
| total | 0 | 13 | 19 | 2 |

## S1 전체 목록

없음.

## S2 전체 목록

| id | 요약 | 증거 |
|---|---|---|
| R-student-001 | 음성 메모 버튼이 자동 변환을 약속하지만 실제 동작/실패 상태가 없다. | `app/src/screens/LogEntry.tsx:207`, `app/src/screens/LogEntry.tsx:218`, `specs/reconstruct/MEDIA_AND_TRANSIENT_CAPTURE_SPEC.md:224` |
| R-parent-001 | 미성년자/보호자 동의 흐름 미해결 상태에서 체중·심박·통증 입력을 받는다. | `app/src/screens/LogEntry.tsx:285`, `app/src/screens/LogEntry.tsx:298`, `specs/reconstruct/FEDERATED_ACCOUNT_SSO_CONTRACT.md:303` |
| R-parent-002 | JSON export가 raw memo/note를 포함한다. | `app/src/domain/journal-store.ts:113`, `app/src/screens/Home.tsx:238` |
| R-coach-001 | 경기 직전 긴장도/전략 입력 표면이 저장되지 않는다. | `app/src/screens/LogEntry.tsx:403`, `app/src/screens/LogEntry.tsx:353` |
| R-safety-001 | `assessMemoTransient`가 저장 흐름에 연결되지 않았다. | `app/src/safety/memo-safety.ts:33`, `app/src/screens/LogEntry.tsx:95`, `specs/reconstruct/DAILY_LOG_AND_CHECKIN_SPEC.md:389` |
| R-safety-002 | 통증 배너가 실제 gate 연결 전부터 계획 보류를 단정한다. | `app/src/screens/LogEntry.tsx:573`, `app/src/screens/LogEntry.tsx:596` |
| R-safety-003 | 음성 메모 경로가 MEDIA D9 precheck/fail-safe 계약에 연결되지 않았다. | `app/src/screens/LogEntry.tsx:207`, `specs/reconstruct/MEDIA_AND_TRANSIENT_CAPTURE_SPEC.md:263` |
| R-privacy-001 | raw memo/note export는 민감 텍스트 이동 경로가 된다. | `app/src/domain/journal-store.ts:21`, `app/src/domain/journal-store.ts:113` |
| R-privacy-002 | localStorage JSON shape 검증 없이 렌더링 경로로 들어간다. | `app/src/domain/journal-store.ts:70`, `app/src/domain/journal-store.ts:77` |
| R-privacy-003 | AthleteTime SSO는 제품 결정과 기술 현실 문서가 다르게 읽힐 수 있다. | `ACCOUNT_FEDERATION_DECISION.md:62`, `LAUNCH_BACKEND_AND_ACCOUNT_PLAN.md:107`, `specs/reconstruct/FEDERATED_ACCOUNT_SSO_CONTRACT.md:303` |
| R-a11y-001 | BodyDiagram SVG 핫스팟은 키보드/스크린리더 조작 경로가 없다. | `app/src/screens/LogEntry.tsx:522`, `app/src/screens/LogEntry.tsx:538` |
| R-a11y-002 | 홈 최근 일지 항목이 클릭 가능한 div다. | `app/src/screens/Home.tsx:321`, `app/src/screens/Home.tsx:323` |
| R-a11y-003 | Trends 차트가 색/title 위주라 대체 텍스트/표가 부족하다. | `app/src/screens/Trends.tsx:116`, `app/src/screens/Trends.tsx:139` |

## 중복 지적된 항목

- 음성/자유 텍스트 안전 경로: student, safety, privacy에서 반복.
- raw memo/note export와 sync memo policy: parent, privacy에서 반복.
- 경기 직전 입력 미저장: student, coach, frontend에서 반복.
- streak/기록일 넛지와 휴식/부상일 표현 부족: student, safety, motivation에서 반복.
- 접근성 키보드/스크린리더 문제: a11y가 직접 지적했고, student 첫 방문 사용성에도 영향.

## 권고 충돌

- 일지 진입 장벽을 낮추려면 free text/voice 입력이 매력적이다. 반면 safety/privacy 관점에서는 raw text 평가, redaction, export, sync 정책이 먼저 명확해야 한다.
- 코치 관점에서는 경기 전 심리·전략 필드가 저장될수록 좋다. privacy/motivation 관점에서는 민감 문구와 자기압박 문구가 늘어날 수 있으므로 필드별 저장/공유 범위가 필요하다.
- 홈의 `N일만 더` 넛지는 재방문에 좋지만, 안전/심리 관점에서는 휴식일 인정 문구가 붙어야 한다.

## 리뷰하지 못한 것

- 실제 스크린리더, 키보드 E2E, 모바일 터치 실측은 실행하지 않았다. 접근성 보고서는 코드 기준 판단이다.
- GitHub Pages는 HEAD 200만 확인했다. JS 상호작용은 로컬 코드 기준으로 판단했다.
- SSO/AthleteTime 실제 OAuth 엔드포인트 동작은 확인하지 않았다. 현 repo 문서와 open issue 기준으로 판단했다.

## 다음 발주 후보

1. P1: free text/voice memo D9 transient assessment 연결 설계. 저장은 허용하되 reason code/review state만 남기는 방향.
2. P1: 접근성 패치. BodyDiagram, 최근 일지 리스트, Trends 차트 대체 텍스트/표.
3. P1: export privacy. raw 포함/제외 선택과 보호자/선수용 경고.
4. P2: Race pre-stage 저장 여부 결정. 저장하지 않을 UI라면 비활성화, 저장할 UI라면 스키마 확장.
5. P2: SSO 문서 상태 정렬. "제품 결정"과 "AthleteTime 구현 선행조건"을 한눈에 분리.
6. P3: final marker 자동화 혼동 제거. metadata 내 `[DRAFT_COMPLETE]` literal을 boolean으로 바꾸는 문서 정리 작업.

