# 담당 D 독립 검수: 화면 수명·뒤로가기·갱신

- 대상 저장소: `TRAINORACLE-oracle-exploration-20260921`의 현재 dirty 작업.
- 검수 범위: P16~P20, `ExecutionReview`, `HomeCoachingSummary`, `JournalOriginalPlan`, `useReaderDialog`, `Home`/`AppShell` 연결과 사실 투영.
- 제품 코드·기존 테스트·스펙·설정은 수정하지 않았다. 전체 스위트와 기존 테스트는 실행하지 않았다. 다른 검수자 보고서는 읽지 않았다.
- 선행 원문: `AGENTS.md`, `PRODUCT_NORTH_STAR.md`, `docs/UX_UI_VISUAL_STANDARD.md`, `PLAN_EXECUTION_DEVIATION_AND_REPLAN_CONTRACT.md`, `PLAN_JOURNAL_LINKAGE_CONTRACT.md`, `PLAN_CYCLE_RESPONSE_AND_ADAPTATION_CONTRACT.md`, 관련 일지/개인정보 계약.
- 신규 수행 비교 계약은 `DRAFT_FOR_REVIEW`, `runtime_authority: false`다. 기존 완료/시간대 표시는 실제 구간 일치 증거가 아니며, 미채택 재설계 정책을 현재 코드 결함으로 보지 않았다.

## 요약

- **P3 · P19 · `CONFIRMED_CODE`**: 읽는 중 연결 기록이 없어지면 선택이 해제되지만, 원래 열기 버튼이 사라진 경우 포커스를 보낼 대체 지점이 없다. 브라우저의 실제 포커스 결과는 실행하지 않아 `NOT_TESTED`다.
- **P3 · P20 · `CONFIRMED_CODE`**: 홈 코칭의 날짜 기준은 `useMemo` 안에서 계산되고 시각/가시성 갱신이 의존성에 없다. 자정을 넘긴 열린 화면은 관련 이벤트로 재계산되기 전까지 날짜 필터 결과가 오래될 수 있다. 실제 자정 전환은 `NOT_TESTED`다.
- **P16, P17, P18**: 정적 경로에서 결함은 확인하지 못했다(`NO_FINDING`, 정적 한정). 브라우저 상호작용은 모두 `NOT_TESTED`이며 PASS로 판정하지 않았다.

## 페르소나별

### P16 브라우저 뒤로가기를 반복하는 사용자

- **전제:** 합성 계획 링크가 있는 일지 하나를 홈 코칭에서 연다.
- **정상 경로(기대):** 브라우저 뒤로가기 한 번으로 읽기 창만 닫고 홈의 기존 문맥으로 돌아온다.
- **공격 경로:** 창을 연 상태에서 뒤로가기를 빠르게 반복하고, 다시 열어 뒤로가기·Escape·닫기 버튼을 섞는다. 고스트 기록, 창 재개방, 의도치 않은 문서 이탈 여부를 확인한다.
- **결과:** `NO_FINDING`(정적 한정). reader별 history 표식을 넣고 pop 시 표식이 달라지면 닫으며, 닫기 동작은 해당 표식에서 `history.back()`을 요청한다. 반복 입력에서 브라우저가 실제로 한 단계씩 소비하는지는 `NOT_TESTED`다.
- **증거:** `app/src/hooks/useReaderDialog.ts:23-43,47-53`; `app/src/screens/plan-review/ExecutionReview.tsx:97-106`.
- **미실행 재현:** 격리된 새 브라우저 컨텍스트에서 합성 계획·일지를 주입하고 `http://127.0.0.1:4194/?app=1`을 연다. 코칭 항목을 열어 `page.goBack()` 한 번 후 앱/초점/스크롤을 확인하고, 재개방 후 빠른 연속 `goBack()` 및 Escape/닫기 조합을 반복한다.

### P17 이유를 읽다가 앞뒤로 복귀하는 사용자

- **전제:** 홈의 특정 기록을 열어 `이유` 탭에서 설명·근거를 확인한다.
- **정상 경로(기대):** 요약·계획/기록·이유 사이를 왕복해도 선택 기록과 각 페이지의 읽던 스크롤이 유지된다.
- **공격 경로:** 이유 페이지를 스크롤하고 근거 disclosure를 연 뒤 탭·좌우 버튼·스와이프를 왕복한다. 현재 기록·페이지·스크롤·포커스가 서로 어긋나는지 확인한다.
- **결과:** `NO_FINDING`(정적 한정). 선택 ID는 홈 요약에 남고, reader는 각 페이지의 `scrollTop`을 저장·복구한다. 페이지 전환 시 패널이 교체되므로 내부 `<details>` 펼침 상태는 보존되지 않는 구조지만, 원문 계약에 그 보존 요구는 없어 결함으로 판정하지 않았다. 실제 상호작용은 `NOT_TESTED`다.
- **증거:** `app/src/screens/home/HomeCoachingSummary.tsx:15-30`; `app/src/screens/plan-review/ExecutionReview.tsx:82-92,109-128`.
- **미실행 재현:** 합성 일지 reader의 `이유` 탭에서 세로로 이동하고 `아직 판단하지 않은 내용`을 펼친다. `요약`→`계획·기록`→`이유`를 탭·좌우 버튼으로 왕복한 뒤 페이지별 스크롤, 선택 기록, 포커스를 기록한다. 스와이프와 선택 텍스트 상태도 별도로 반복한다.

### P18 다른 화면에서 일지를 편집한 사용자

- **전제:** 홈 코칭 reader가 열려 있고 연결 일지가 다른 화면/탭에서 편집된다.
- **정상 경로(기대):** 같은 일지 ID의 직접 입력 사실이 바뀌면 화면이 새 사실을 읽되 읽던 페이지와 스크롤을 불필요하게 초기화하지 않는다.
- **공격 경로:** 다른 탭에서 동일 ID의 결과·거리·RPE를 바꿔 `storage` 이벤트를 발생시킨다. 별도로 메모만 바꾸어 구조화 사실 투영이 흔들리지 않는지 확인한다.
- **결과:** `NO_FINDING`(정적 한정). 홈은 journal 변경·계정 변경·`storage` 이벤트로 revision을 올리고, 코칭 요약은 revision 의존으로 자료를 다시 읽는다. 같은 ID가 남으면 선택은 유지되며, 사실 투영 함수는 구조화 필드만 사용한다. 실제 cross-tab 반영과 포커스/스크롤은 `NOT_TESTED`다.
- **증거:** `app/src/screens/Home.tsx:47-63`; `app/src/screens/home/HomeCoachingSummary.tsx:18-30`; `app/src/domain/journal-local-storage.ts:30-35`; `app/src/domain/plan-execution-review.ts:36-37,65-100`.
- **미실행 재현:** 동일 출처의 두 테스트 페이지를 연다. 1번에서 reader의 이유 탭과 스크롤을 기록하고, 2번에서 합성 `trainoracle.journal.v1` 항목의 같은 ID·링크를 유지한 채 구조화 거리/RPE를 수정해 저장한다. 1번에서 값 갱신과 탭/스크롤/초점 보존을 확인한다. 이어 메모만 바꾸어 사실 투영이 바뀌지 않는지 확인한다.

### P19 읽던 기록을 삭제한 사용자

- **전제:** 홈 코칭에서 특정 기록의 reader가 열려 있고 그 합성 기록이 다른 동일 출처 탭에서 삭제된다.
- **정상 경로(기대):** 삭제된 기록은 reader와 목록에서 제거되고, 포커스는 남아 있는 코칭 제목·상태 또는 인접한 의미 있는 위치로 이동한다.
- **공격 경로:** reader 내부에 포커스를 둔 채 다른 탭에서 해당 journal 항목을 제거하고 `storage` 갱신을 발생시킨다. 삭제 전 요약의 잔류·reader 오픈 상태·삭제된 버튼으로의 포커스 복귀를 확인한다.
- **결과:** **P3 · `CONFIRMED_CODE`**. 기록이 선택 결과에서 사라지면 선택을 지워 reader를 닫는 경로는 있다. 그러나 열기 버튼도 목록 갱신으로 사라지면 dialog 정리 코드는 연결된 opener에만 focus를 돌리고 대체 focus target은 지정하지 않는다. 구체적인 브라우저 active element는 `NOT_TESTED`다.
- **증거:** `app/src/screens/home/HomeCoachingSummary.tsx:25-30,37-45`; `app/src/screens/Home.tsx:47-60`; `app/src/hooks/useReaderDialog.ts:35-43`(특히 opener 연결 여부 검사).
- **미실행 재현:** 격리 컨텍스트에 합성 연결 기록 하나만 주입한다. reader를 열고 탭 버튼에 포커스를 둔 다음, 두 번째 동일 출처 페이지에서 그 ID의 항목을 지운다. reader가 닫힌 뒤 `document.activeElement`, 코칭 상태/제목, 뒤로가기 결과를 확인한다.
- **수정 방향(미실행):** 선택 기록이 사라져 reader를 닫을 때, opener가 DOM에 없으면 남아 있는 코칭 섹션 제목이나 갱신된 상태 메시지 등 안정적인 대체 대상으로 포커스를 명시적으로 이동한다. 실제 포커스 이동은 dialog 정리 이후에 수행해야 한다.

### P20 자정을 넘겨 앱을 켜둔 사용자

- **전제:** `Asia/Seoul` 기준 자정 직전에 홈이 열린 상태이며, 다음 날짜의 합성 계획 연결 일지가 저장되어 있다.
- **정상 경로(기대):** 날짜가 바뀐 뒤 현재 날짜 조건에 맞는 항목이 다음 유효한 렌더에서 코칭 목록에 반영된다.
- **공격 경로:** 저장/계정 이벤트 없이 열린 화면을 자정 너머까지 둔다. 미래 날짜 항목이 계속 숨겨지는지, 이전 날짜 경계가 남는지 확인한다.
- **결과:** **P3 · `CONFIRMED_CODE`**. `todayISO()`와 날짜 필터 입력은 코칭 `useMemo` 안에서 산출되며 의존성은 revision, evidence reader, visible count뿐이다. 시각 경계나 페이지 가시성에 따른 무효화가 없으므로 이벤트가 없으면 memo 결과는 자정만으로 다시 계산되지 않는다. 실제 날짜 전환은 `NOT_TESTED`다.
- **증거:** `app/src/screens/home/HomeCoachingSummary.tsx:18-24`; `app/src/domain/plan-execution-review.ts:127-140`(미래 날짜 제외 및 결과 정렬/제한).
- **미실행 재현:** 새 격리 컨텍스트의 시각을 `2026-09-29 23:59 Asia/Seoul`로 고정하고 계획 날짜 `2026-09-30`인 합성 linked journal을 주입한다. 홈 코칭이 그 항목을 아직 목록에 넣지 않은 것을 확인한 뒤, 저장/계정 이벤트 없이 시계를 `2026-09-30 00:01`로 전진한다. 새로고침 전과 관련 revision 이벤트 후 목록을 비교한다.
- **수정 방향(미실행):** 홈 코칭 날짜 기준이 바뀌는 자정에만 무효화하는 타이머를 두고, 탭 복귀/절전 후에는 현재 날짜를 재확인한다. 기존 날짜 조건은 유지하며 새로운 수치 정책은 추가하지 않는다.

## 실행 경계와 남은 불확실성

- 지정 미리보기 `http://127.0.0.1:4194/?app=1`은 로컬 HTTP 요청에서 상태 `200`을 반환했다. 이는 서버 응답 확인뿐이며 화면 렌더·접근성·사용자 흐름의 runtime 증거가 아니다.
- 합성 plan fixture에서 유효 linked-date를 산출하는 로컬 준비 단계는 성공했지만, 임시 Vite SSR 모듈 로더의 dependency scan/종료 오류로 격리 브라우저 페이지 실행에 도달하지 못했다. 따라서 P16~P20의 상호작용은 전부 `NOT_TESTED`다.
- Playwright/Vitest 및 전체 스위트는 실행하지 않았다. 실제 사용자 브라우저·프로필·저장 데이터·인증정보를 열거나 조작하지 않았고 외부 네트워크에 접근하지 않았다.
- 확정 범위는 코드의 이벤트·상태 전이와 날짜 memoization 구조다. P19의 실제 브라우저 포커스 위치, P20의 렌더링 결과, 뒤로가기 반복과 cross-tab 갱신의 실동작은 확인되지 않았다.
