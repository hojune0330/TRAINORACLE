# CALENDAR_GUIDANCE_REVIEW_2026-09-29.md

```yaml
doc_id: trainoracle-calendar-guidance-review-20260929
title: 달력 자동 위치와 반응성 개선 종합 검토
status: REVIEW_COMPLETE_IMPLEMENTATION_NOT_STARTED
source_commit: 3e659d45e2ae337a5fa499cf63f0b855555bd895
review_model: gpt-6-luna
review_reasoning_effort: max
independent_passes: 6
simulated_personas: 30
real_user_participants: 0
app_runtime_changed: false
deployment_performed: false
canonical_promotion_allowed: false
```

## 1. 결론

**최근 기록에 맞춰 시작하는 개선은 필요하다. 다만 위치 복원·데이터 준비 상태를 먼저 고쳐야 한다.**
로컬 앱에서 오래된 기록이 있어도 빈 현재 월을 먼저 그리는 동작을 재현했다. 독립 리뷰 후
탭 복귀 초기화, 리더에서 날짜를 넘긴 후 선택일/포커스 불일치, 원문에서 browser Back 미복귀도
추가 확인했다. 이 기반을 그대로 둔 채 자동 스크롤·모션만 넣는 안은 채택하지 않는다.

권장 순서: 읽기 상태·탐색 컨텍스트 → Back/탭/작성 복귀 → 화면별 첫 날짜 → 빈 예시 →
즉시 선택 반응/선택적 스와이프 → 통합 화면 검수. 일정·주기·훈련량·안전 판정은 바꾸지 않는다.

[보완된 상세 계획 v0.2](../plans/CALENDAR_GUIDED_CONTEXT_AND_MOTION_PLAN_2026-09-29.md).

## 2. 실제 확인한 문제

현재 UI 관측은 `http://127.0.0.1:4194/?app=1&uitest=1`의 새 익명 Chrome headless context에서 했다.
날짜는 2026-09-29로 고정했고 기록은 2025-08-18의 합성 훈련 한 건이다. 외부 네트워크는
차단하고 react-scan/react-grab 개발 계측 모듈만 비활성화했다. 로그인·실제 사용자 기록은 사용하지 않았다.

| 항목 | 실측 결과 | 보완 |
|---|---|---|
| 과거 기록만 있는 첫 진입 | 2025-08-18 기록이 존재하나 2026년 9월의 빈 달력 표시 | 첫 진입은 최근 실제 기록 날짜/월로 |
| 같은 날짜 리더 열기/닫기 | 2025-08 월과 8월18일 포커스 복원 정상 | 기존 동작 보존 |
| 리더에서 다음 날짜로 이동 후 닫기 | 선택일은 8월19일, 포커스는 8월18일 | 현재 선택일 우선 focus 복원, 없으면 월 제목 |
| 일지→홈→일지 | 과거 월을 골랐어도 현재 2026년 9월로 초기화 | 계정/탭 범위의 탐색 위치 유지 |
| 달력→원문 일지→browser Back | 달력 0개, 전체 원문 리더 1개가 계속 남음 | 원문 reader history와 동일한 close 계약 연결 |

두 폭 375/320px에서 같은 결과였다. 이는 Android 기기에서 직접 Back을 눌렀다는 증거는 아니다.
PC Chrome의 browser Back과 해당 소스 경로를 확인했으므로 모바일 실기기는 후속으로 남긴다.
초기 월 정책은 기존 의도된 동작이지만 이번 요구에 맞춰 바꾸는 UX 문제다. 리더 Back 미복귀는
독립 리뷰의 소스 의심을 부모가 추가 재현한 기능 결함이다. 모든 P1/P0 의견을 같은 확정 결함으로
합산하지 않는다.

추가 실측:

- 375px: 날짜 버튼 최소 51×64px, 페이지 가로 넘침 없음.
- 320px: 날짜 버튼 최소 44.28125×64px, 페이지 가로 넘침 없음.
- 네 조합 모두 탐색 전후 `trainoracle.journal.v1` 내용 동일.
- 200% 글자 확대, 실제 VoiceOver/TalkBack, 저사양 성능, 계정 hydrate 실측은 하지 않았다.

실행 도구: [capture-current-calendar.mjs](calendar-guidance-luna30-20260929/capture-current-calendar.mjs)  
전체 JSON: [observations.json](calendar-guidance-luna30-20260929/baseline/observations.json)  
스크린샷: [375px 과거 기록 첫 화면](calendar-guidance-luna30-20260929/baseline/old-record-375.png),
[320px 빈 화면](calendar-guidance-luna30-20260929/baseline/empty-320.png),
[원문 Back 이후](calendar-guidance-luna30-20260929/baseline/original-reader-back-375.png).

## 3. 독립 Luna max 리뷰

각 작업자는 새 컨텍스트에서 계획과 자기 범위 소스를 읽었다. 원본 보고서는 합의된 최종안으로
고쳐 쓰지 않고 그대로 보존한다. 계획 파일은 검토 과정에 보완되었으므로 원본 리뷰의 계획
줄번호는 당시 스냅샷을 가리킨다. 현재 채택안은 v0.2의 절 제목과 아래 결정표를 우선한다.
소스 파일 줄은 기준 커밋을 따른다. 보고서의 부모 제공 baseline은 실제 사용자 제공 데이터가 아니라
이번 부모 작업자가 실행한 합성 관측이다.

| 패스 | 가상 관점 | 핵심 지적 | 원본 |
|---|---|---|---|
| A | 신규, 1년 만의 복귀, 드문 기록, 하루 여러 기록, 과거 자료 가져오기 | 기록일≠수정일, 날짜 상태 소유권, 로드 실패≠빈 계정 | [A-history-empty](calendar-guidance-luna30-20260929/A-history-empty.md) |
| B | 휴식일, 오전/오후, 미래 후보, 종료 계획, 9.5일 보기 | 종료일 범위, 후보 ID, 음수 주기 index, 미입력 날짜 | [B-plans-cycles](calendar-guidance-luna30-20260929/B-plans-cycles.md) |
| C | 공용기기, 느린 서버, 오프라인, 삭제/복구, 동기화 중 읽기 | ownership certainty, sync 상태 분리, A→B→A 복귀, unbound 기록 | [C-data-ownership](calendar-guidance-luna30-20260929/C-data-ownership.md) |
| D | 화면읽기, 키보드, 작은 화면/확대, 모션 민감, 정밀 터치 어려움 | 중복 낭독, 포커스 fallback, 실제 터치 크기, JS 모션 설정 | [D-accessibility](calendar-guidance-luna30-20260929/D-accessibility.md) |
| E | iPhone, Android Back, 연타, 작성 취소/저장, 용어집·탭 왕복 | 전체 리더 Back, 작성 원점, 탭 복귀, 가장자리 제스처 | [E-navigation-gestures](calendar-guidance-luna30-20260929/E-navigation-gestures.md) |
| F | 게임 좋아하는 청소년, 엘리트, 계획만 사용, 1만 기록/저사양, 통증 후 복귀 | 이중 달력 밀도, 렌더 재파싱, 날짜별 전체 검색, 점수 압박 | [F-product-performance](calendar-guidance-luna30-20260929/F-product-performance.md) |

총 30개 가상 관점이고 실사용자 30명 인터뷰가 아니다. 각 관점 최소 2개 공격 순서,
원본 합계 61개 순서 제안을 남겼다(B는 11개, 나머지 각 10개). 이 순서들이 앱에서
모두 실행·통과했다는 뜻이 아니다. 아래 모델·브라우저 실행은 별도 증거다.

사용된 실제 작업자 식별자:

| 패스 | agent_id |
|---|---|
| A | 01a0ed36-e4e4-7ba0-99e1-14f97ea44c9d |
| B | 01a0ed36-e68b-7712-a111-3b77ebd9752a |
| C | 01a0ed36-e9fa-7452-9b7f-07c290dcadab |
| D | 01a0ed36-ebc9-7df2-884a-a737266ff221 |
| E | 01a0ed36-edd2-70a1-86ab-439eac582057 |
| F | 01a0ed36-ef6e-7dc1-8426-88e777665d05 |

## 4. 반영 판단

| 지적 | 판단 | 후속 코드 범위 |
|---|---|---|
| LOADING/ERROR와 empty가 같은 배열 | 채택. READY-empty 전제에 owner/read certainty 포함 | useCalendarEntries, JournalArchive, account projection 읽기 adapter |
| sync의 PENDING/CONFLICT가 readiness에 사라질 수 있음 | 채택. 두 축을 보존 | 기존 저장 안내와 달력 입력 타입 |
| 최근 월만 바꾸면 날짜/Back은 잃음 | 채택. 단일 context, 기존 history 확장 | AppShell, JournalMonthCalendar, useReaderDialog |
| 종료 계획이 첫날로 감 | 계획 기본값은 종료일로 보완. 현재 실제 지원 범위/마지막 쉬는 날 보존 | PlanSchedulePreview 및 7개 호출부 |
| cycle inverse 함수·음수 처리 누락 | 채택. 기존 window 기준 역탐색, 앵커 변경 금지 | training-cycle-window의 표시용 보조 함수/테스트 |
| 빈 달력과 예시 달력 두 개 | 채택하지 않음. 짧은 예시 한 개, 선택적 확대 | 빈 상태 레이아웃 |
| 날짜 탭 뒤 상세 버튼을 또 누르게 함 | 일괄 반영하지 않음. 자동 선택은 리더를 안 열고, 명시적 탭은 1회로 하루 상세 | 한 번의 동작·프라이버시 경계 동시 유지 |
| 계정에 연결 안 된 기기 기록 | 자동 첫 위치에서는 현재 계정 기록과 분리. 기존 열람 권한은 별도 결정 | 소유권 표시만, 자동 계정 귀속 금지 |
| O(날짜 수×이력 수) 필터/렌더마다 JSON parse | 채택. 안정 snapshot/revision 및 공유 날짜 index를 A단계 선행 작업으로 | 기존 store subscribe/요약 helpers, 원문은 지연 읽기 |
| 200%/SR/실기기 미검증 | 실제 미완료 관문으로 유지 | 구현 후 기기/접근성 검사 |

F의 배열 방문 수는 소스 상한 계산이다. 1만 건에서 실제 느리다는 시간 측정이 아니므로
"성능 장애 확인"으로 보고하지 않는다. C의 같은 계정 역순 응답도 현행 동기 hook의
재현 결함이 아니다. 새 비동기 adapter를 만들 경우의 방어조건이고 기존 service 직렬화를 재사용한다.

용어집 포커스 복원은 이번 달력에서 왕복하는 경로만 통합 관문에 넣는다. 전체 라우터 교체나
모든 화면 전면 재설계를 끼워 넣지 않는다. 월 스와이프는 선택 편의로 두며 iOS 가장자리 Back,
수직 스크롤, 입력 중, 다중 터치, pointercancel을 침범하지 않는 경우에만 활성화한다.

## 5. 실행한 공격과 한계

### 5.1 설계 모델

[실행 스크립트](calendar-guidance-luna30-20260929/check-calendar-context-model.mjs),
[모델](calendar-guidance-luna30-20260929/calendar-context-model.mjs),
[실행 결과](calendar-guidance-luna30-20260929/model-evidence.json).

- 이름 있는 19사례 통과. 저장일/실제일 역전, 미래/삭제/예시 제외, 계획 첫/오늘/끝,
  수동 선택 보존, 계정 epoch, 오류/오프라인, 늦은 응답, 예시 컨텍스트 분리를 다룸.
- seed 20260929, 101, 8675309, 429496729. 각 250순서×50전이, 총 1,000순서/50,000전이.
- 4종 결함 주입이 각각 단언 실패를 일으킴: owner guard 제거, refresh 재점프,
  오류를 empty로 변환, 같은 owner의 이전 generation 수용.
- 초기 모델 17사례 PASS 뒤 추가 탐침에서 같은 owner의 오래된 응답이 최신 배열을 지우는
  실패를 확인했다. generation guard와 회귀 사례를 추가한 결과가 현재 19사례다.
- 예시 중 데이터가 도착하면 무조건 예시를 닫는 탐침도 검토했으나, 사용자 문맥을 빼앗는
  기대값이라 채택하지 않았다. 대신 예시 context 고정과 명시적 나가기를 시험한다.

이 모델은 앱이 import하지 않는 검토용 모듈이다. 모델의 쓰기 0은 앱의 저장 안전성 증거가
아니다. React, 실계정, 실제 네트워크, 주기 역함수, 성능은 제외했다. 구현 후 동일 사례를
실제 adapter/component/e2e로 옮겨야 한다.

### 5.2 현재 앱 제한 랜덤 탐색

[실행 스크립트](calendar-guidance-luna30-20260929/random-current-calendar.mjs),
[80개 동작의 전체 순서](calendar-guidance-luna30-20260929/browser-random-evidence.json).

- 375px/기본 동작 seed 9029, 320px/OS reduced-motion seed 1701. 각 40동작.
- 이전/다음 달, 오늘, 임의 날짜 열기/Escape, 키보드 화살표, 월 버튼 더블클릭,
  리더의 다음 날짜/닫기를 섞음. 날짜·계획 저장값 불변과 가로 넘침 없음을 확인.
- 초기 시험 도구가 그리드 준비 전에 날짜 개수를 읽어 NaN으로 실패했다. 앱 결함으로
  집계하지 않았다. 그리드 대기와 날짜 수 하한 단언을 추가해 다시 실행한 결과가 80동작 PASS다.
- 이 범위에 원문 리더 Back은 포함되지 않는다. 별도 집중 탐침에서는 미복귀를 확인했으므로
  "전체 탐색 문제 없음"이라고 결론 내리지 않는다. 실제 스와이프/모바일 하드웨어는 미실행.

## 6. 스펙·실행 경계

- 기존 UX 표준의 44px/200~350ms/줄인 모션을 지키며 첫 위치/중단/Back 계약을 추가할 계획이다.
- 기존 달력 계획의 "일지 현재 월부터"는 다음 구현 시 변경 이력을 남기고 대체한다.
- 9.5일 mapping 초안, 처방 승인, 계정 동기화 권한, D9 상태를 이 리뷰로 승격하지 않는다.
- 새 데이터 동기화 엔진, DB 변경, 외부 캘린더 OAuth는 필요하지 않다.
- 이번은 계획/검토 도구/합성 증거 추가다. 전체 앱 테스트·빌드·CI·배포는 수행하지 않았다.
  대상이 런타임 변경이 아니므로 lean-ci 기준으로 전체 회귀를 반복하지 않았다.

## 7. 인수인계

다음 작업자는 상세 계획 §7의 선행 문서 패치를 하고 §9 A부터 시작한다.
순서대로 A 준비/인덱스, B 일지·주기/복귀, C 계획 호출부, D 예시·반응, E 통합 검수를 수행한다.
임의로 새 서버를 만들거나 날짜 자동 이동을 계획 자동 수정으로 연결하지 않는다.
구현되기 전의 보고서/모델 PASS를 실제 새 기능 배포 근거로 재사용하지 않는다.

완료된 검토: 현재 코드 대조, 공식 UX 자료 참고, 독립 6패스/30관점, 제한 브라우저 관측,
무작위 모델/현재 UI 탐색, v0.2 계획 보완. 남은 일: 실제 구현과 구현 후 검수/요청된 배포.

[DRAFT_COMPLETE]
