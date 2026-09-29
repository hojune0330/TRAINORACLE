# 담당 C 독립 검수: 화면·접근성·제스처

검수일: 2026-09-29  
대상: 지정 저장소의 현재 dirty 작업 포함, 계획-실제 수행 코칭 읽기 화면  
범위: P11–P15. 제품 코드·기존 테스트·스펙·설정은 수정하지 않음. 전체 테스트 스위트 미실행.

## 요약

- P2 결함 1건: 선택되지 않은 두 탭의 `aria-controls`가 가리키는 탭 패널이 초기 DOM에 없어 접근성 관계가 끊긴다. **브라우저 DOM에서 재현 확인**. 실제 스크린리더 발화는 실행하지 않았다.
- 320×667 기본 화면은 가로 넘침이 없고 하단 다음 행동 버튼이 화면 안에 있었다. 합성 저장값은 읽기 전후 동일했고 페이지 오류도 없었다.
- 큰 글자·혼합 제스처·빠른 연타의 후속 Playwright 실행은 마지막 `다음 내용` locator가 disabled 상태에서 click timeout으로 실패해 최종 결과를 출력하지 못했다. 아래 시나리오는 `NOT_TESTED`로 구분한다.

## P11 — 320px 작은 전화

- **전제:** 뷰포트 320×667, 빈 격리 브라우저 context에 합성 active plan과 계획에 명시 연결된 일부 수행 journal을 넣었다.
- **정상 경로:** `http://127.0.0.1:4194/?app=1&uitest=1`에서 `일부만 한 훈련`을 열어 요약과 다음 행동을 확인.
- **공격 경로:** 320px 폭에서 dialog/body의 가로 넘침과 하단 주요 행동이 화면 밖으로 밀리는지 확인.
- **결과:** `NO_FINDING` (이 기본 글자 크기·요약 경로 한정). dialog와 본문은 각각 `320/320px`; 첫 `일지 확인` 버튼은 y=606.5, 높이 48.5, 하단 655px로 667px 화면 안에 있었다. 긴 원래 처방·긴 수행 목록까지 확인한 결과는 아니다.
- **증거:** `CONFIRMED_RUNTIME`, 격리 Playwright에서 합성 자료로 직접 측정. 저장값 전후 동일, page error 0건. 화면 캡처는 생성하지 않았다.

## P12 — 글자 200% 저시력 사용자

- **전제:** 320px 화면에서 본문 글자를 200%로 키운다고 가정.
- **정상 경로:** 코칭 reader를 열고 요약·계획/기록·이유를 읽는 경로.
- **공격 경로:** 확대된 글자와 긴 실제 구성/라벨이 겹치거나 가로로 잘리는지 확인하려 했다.
- **결과:** `NOT_TESTED`. 첫 시도에서 `html`의 기본 글자 크기만 200%로 바꿨으나, 탭 글자는 14.5px로 유지되어 유효한 200% 글자 시험이 아니었다. 후속 실행은 `다음 내용` locator가 disabled 상태에서 click timeout으로 끝나 최종 관찰 결과를 회수하지 못했다. 이 persona에 PASS 또는 무결함 판정을 내리지 않는다.
- **증거:** 첫 실행의 computed style 관찰은 시도한 스케일링이 실패했음을 확인할 뿐, 200% 합격 근거가 아니다. 다음에는 브라우저 텍스트 확대와 동일한 유효 레이아웃 폭·실제 rem/px 혼합을 재현해야 한다.

## P13 — 키보드·스크린리더 사용자

- **전제:** 이름 있는 dialog와 세 개 탭으로 요약·계획/기록·이유를 탐색.
- **정상 경로:** 합성 연결 일지로 reader를 열어 초기 탭과 탭 목록의 접근성 ID 관계를 읽음.
- **공격 경로:** 초기 상태에서 각 `role="tab"`의 `aria-controls`가 실제 탭 패널을 가리키는지 검사.
- **결과:** **[P2] `CONFIRMED_RUNTIME` / `CONFIRMED_CODE`**. `요약` 패널 대상은 존재하지만 `계획·기록` 및 `이유`의 대상은 초기 DOM에 없다. 구현은 세 탭 모두에 `aria-controls`를 부여하면서 선택된 탭 패널만 렌더한다. 비활성 탭을 선택하기 전까지 두 IDREF가 dangling 상태다. 이로 인해 보조기술이 연결된 패널 관계를 제공하지 못할 수 있다. 실제 NVDA/VoiceOver 발화와 키보드 전체 경로는 `NOT_TESTED`.
- **증거:** 격리 브라우저 DOM 조회와 아래 재현 절차 결과, [ExecutionReview.tsx](../../../app/src/screens/plan-review/ExecutionReview.tsx:109) 110–117행 및 123–129행의 정적 확인. 조회값은 요약 `true`, 계획·기록 `false`, 이유 `false`.
- **재현:** 새 격리 Chromium context에서 viewport 320×667 설정 → `stateFixture()`와 `createPlannedSessionLogDraft(...)`로 합성 연결 journal을 `trainoracle.plan-beta.v1`/`trainoracle.journal.v1`에 주입 → 지정 URL에서 `일부만 한 훈련` 버튼 클릭 → dialog 안 `[role="tab"]` 각각의 `aria-controls` 값을 `document.getElementById(...)`로 조회. 관찰값은 요약 `true`, 계획·기록 `false`, 이유 `false`.
- **근거 줄:** [ExecutionReview.tsx](../../../app/src/screens/plan-review/ExecutionReview.tsx:109) 110–117행에서 모든 탭에 패널 ID를 지정하고, 123–129행에서 현재 선택된 패널 하나만 렌더한다.
- **수정 방향(미수행):** 세 개의 `tabpanel` 요소와 ID를 DOM에 유지하고 비활성 패널만 `hidden` 처리해 각 `aria-controls`/`aria-labelledby` 쌍을 유효하게 유지한다. 수정 및 재검증은 하지 않았다.

## P14 — 좌우·세로 스와이프 혼합 사용자

- **전제:** 본문 세로 스크롤 중 좌우 페이지 넘김을 섞고, 조작 가능한 요소 근처에서도 터치.
- **정상 경로:** reader 본문에서 좌우 넘김으로 탭 내용을 이동.
- **공격 경로:** 세로 우세 대각선 스와이프, 단일 손가락 임계값 미만, 버튼/summary에서 시작하는 스와이프, 다중 접촉.
- **결과:** 상호작용 코드는 `CONFIRMED_CODE`이나 런타임 제스처 시나리오는 `NOT_TESTED`. `useJournalPageTurn.ts` 58–88행은 접촉 수·방향 의도를 구분하고, 90–112행은 56px 및 방향비 기준으로 넘김을 결정하며, 129–141행은 버튼/링크/summary 등에서 시작한 이동을 막는다. 실제 터치 입력에서 스크롤과 전환이 공존하는지는 판정하지 않았다.
- **증거/재현 상태:** `useJournalPageTurn.ts` 58–112행, 129–141행 정적 확인은 `CONFIRMED_CODE`. 후속 격리 실행은 mixed swipe 입력을 보낸 뒤 disabled인 `다음 내용` locator click에서 timeout되어 중간 제스처 관찰을 회수하지 못했다. 해당 런타임은 `NOT_TESTED`. 기존 `app/e2e/execution-review.spec.ts`의 synthetic touch dispatch 코드는 참고만 했고 실행 PASS 근거로 사용하지 않았다.

## P15 — 줄인 모션·빠른 연타 사용자

- **전제:** `prefers-reduced-motion: reduce` 사용자, 이전/다음 버튼을 연달아 누르는 사용자.
- **정상 경로:** 요약에서 다음 탭으로 이동하고 다시 이전 탭으로 복귀.
- **공격 경로:** reduce 상태에서 연속 페이지 변경 후 경계 버튼을 반복 입력.
- **결과:** 감소 모션은 `CONFIRMED_CODE`: [app.css](../../../app/src/styles/app.css:714) 714–725행의 단계 애니메이션을 2364–2370행에서 reduce일 때 끈다. dialog 진입 애니메이션은 [plan-day-reader.css](../../../app/src/styles/plan-day-reader.css:55) 55–57행에서 `no-preference`일 때만 적용한다. 후속 실행은 disabled `다음 내용` locator click timeout으로 끝나 reduce 상태 및 연타 관련 최종 결과를 출력하지 못했다. 해당 런타임은 `NOT_TESTED`; 이를 PASS라고 하지 않는다.
- **증거:** CSS 정적 확인만 `CONFIRMED_CODE`. reduce 설정 및 빠른 연타의 런타임 동작은 위 locator timeout으로 검증되지 않아 `NOT_TESTED`.

## 짧은 장점·범위 경계

- 요약에 실제 기록/계획 구분과 계획 미변경 안내가 있고, 전체 화면에서도 탭으로 기록·이유에 직접 이동한다: [ExecutionReview.tsx](../../../app/src/screens/plan-review/ExecutionReview.tsx:33) 33–38행, 109–129행.
- 사실 투영은 완료+시간대를 구간 일치로 승격하지 않고, 직접 입력된 구조화 거리·시간·페이스만 읽으며 구간 대응은 미확인으로 남긴다: [plan-execution-review.ts](../../../app/src/domain/plan-execution-review.ts:62) 62–64행, 65–100행. 이는 현재 읽기 전용 비교 범위 확인이며 미구현 재설계 엔진의 결함 판정이 아니다.
- 후속 합성 Playwright 실행은 disabled `다음 내용` locator click timeout으로 실패해 최종 요약을 출력하지 않았다. 따라서 큰 글자·혼합 제스처·빠른 연타의 런타임 판정은 미검증이며, 전체 스위트·앱 테스트·실제 사용자 브라우저·스크린리더는 사용하지 않았다.
- PID 24368은 사용자가 전달한 읽기 전용 부모 확인에서 `Codex/runtimes/cua_node` 경로로 식별됐다. 이 검수에서 생성한 runner라는 증거는 없다. 앞서 보낸 `Stop-Process` 요청은 도구에서 거부되어 실제 프로세스 종료는 없었다. runner 귀속을 정정하며, 해당 PID는 종료하지 않는다.
