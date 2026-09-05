# SESSION_METHOD_SELECTION_IMPLEMENTATION_2026-09-05.md

```yaml
doc_id: trainoracle-session-method-selection-implementation-2026-09-05
status: PARTIAL_IMPLEMENTATION_REVIEW_REQUIRED
inspected_on: 2026-09-05
base_sha: ee7a91e3edbb2da38782717ecc46ce9c18b29a69
full_product_plan_complete: false
new_exact_template_activations: 0
production_deployment: NOT_PERFORMED
canonical_promotion: false
```

## 1. 쉬운 요약

이번 변경은 여러 훈련 방법을 선택하고 조정하는 승인 계획의 첫 구현 묶음이다.
전체 계획을 완료한 보고가 아니다. 현재 쓸 수 있는 기능과 다음 연결 작업을
아래에서 구분한다. 새 훈련을 한 개씩 준비할지 반복 승인받는 절차는 만들지 않는다.

| 구분 | 이번 결과 | 아직 하지 않은 것 |
|---|---|---|
| 상세 훈련의 적용 위치 | 같은 목적의 주요 훈련 중 날짜와 오전/오후를 선택하고, 개인 기록 확인 후 저장·재열기 | 한 계획의 여러 MAIN에 서로 다른 상세 처방을 동시에 저장 |
| 방법 추천 | 적격 방법 전체를 평가하는 공통 코어 연결. 실제 구조가 다른 최대 두 개만 대표 추천, 나머지 펼쳐보기 | 현재 조건별 활성 방법은 하나. 새 방법을 활성화한 것은 아님 |
| 반복과 다양성 | 실제 수행·선택·미기록을 분리한 이력 입력 및 명시적 선호 순위 코어 | 현재 앱 호출은 빈 이력과 NEUTRAL. 실제 일지 기반 추천 변화는 아직 없음 |
| 처방 조정 | 검토된 전체 구성 간 변경, 초안·취소·초기화·적용, 해시·정책·만료·현재 상태 검증 | 운영 정책 연결, 개별 수치 범위 및 서버/로컬 저장 통합 |
| 조정 화면 | 전체 화면 편집기와 전후 수치·구간 순서·허용 구성 +/- | 사용자가 들어가는 운영 경로에는 아직 연결하지 않음 |
| 스펙과 자료 | 새 구현 계약, 기존 스펙 7개 연결 패치, 실제 카탈로그 30행 준비표 | 원문 재조사·신규 과학 심사·신규 수치 활성화 |

## 2. 사용자에게 연결된 흐름

1. 지원 종목·경험·훈련 목적과 상세 훈련을 고른다.
2. 계획 후보에서 `상세 훈련을 적용할 날`을 펼쳐 날짜·요일·오전/오후를 고른다.
3. 기준 경기 기록을 직접 선택하고 개인 페이스 적용을 확인한다.
4. A/B 일정 중 하나를 저장한다. A/B는 쉬운 훈련의 시간 표현 차이이며 방법 두 종류가 아니다.
5. 다시 열어도 같은 날짜·시간대에 상세 처방이 남는다. 일지 링크는 실제 저장 처방 내용에 묶인다.

날짜를 고른다고 훈련을 추가하거나 시간대를 옮기는 것은 아니다. 기존 A/B 모두에
있는 같은 목적의 QUALITY 위치에 현재 허용된 상세 세션 한 개를 배치한다.
그 외 세션의 시간·RPE·노출 원장·주기 구조는 유지한다.
유효하지 않은 위치는 다른 날로 대체하지 않으며 재선택을 요청한다.
기록 또는 위치를 바꾸면 확인이 다시 필요하다. 새 계획을 시작할 때 이전 위치는 초기화한다.

## 3. 코드 연결 지도

| 책임 | 파일 |
|---|---|
| 전체 적격 방법 순위·구조 차이·기본 최대 2개 | `impl/src/prescription/method-recommendation.ts` |
| 검토된 구성 전이·초안·내용 해시·차이 영수증 | `impl/src/prescription/prescription-adjustment.ts` |
| 정확한 MAIN 위치의 단일 상세 처방 바인딩 | `impl/src/plan-generator/candidates.ts` |
| 앱 권한·개인 기록·저장 스키마 연결 | `app/src/domain/plan-candidate-prescription.ts`, `plan-beta-flow.ts` |
| A/B 공통 위치 목록 | `app/src/domain/plan-session-target.ts` |
| 실제 활성 방법을 공통 추천 코어에 전달 | `app/src/screens/plan-beta/plan-template-options.ts` |
| 대표 추천·전체 방법 목록 | `app/src/screens/plan-beta/PlanMethodPicker.tsx` |
| 날짜·시간대 선택과 확인 상태 | `PlanSessionTargetPicker.tsx`, `PlanCandidates.tsx`, `app/src/screens/PlanBeta.tsx` |
| 준비된 전체 화면 편집기 | `app/src/screens/plan-beta/PrescriptionAdjustmentEditor.tsx` 및 CSS |

공통 추천 코어는 독립적인 방법군·구성 목록을 받는다. 고정 pairId나 임의 난수를
추천 근거로 쓰지 않는다. 적격성·목적·맥락을 먼저 평가하고, 명시적 반복/다양성
선호 다음에 안정된 카탈로그 순서로 동률을 처리한다. 이름·횟수만 다른 구성은
대표 방법의 다양성으로 세지 않는다. 새 방법을 등록할 때는 실제 방법군 ID를
정해야 하며, 현재 단일 구성 템플릿의 ID 관례를 영구 분류 규칙으로 일반화하지 않는다.

조정 코어의 정책과 구성 참조는 내용 해시를 포함한다. 해시는 승인 서명이 아니다.
신뢰 레지스트리는 별도로 로드해야 하며 저장된 초안의 `reviewRef`만 보고 권한을
복원해서는 안 된다. UI의 +/-는 완성된 검토 구성의 순서를 이동할 뿐, 임의의
1초·100m·1회 증감을 만들어내지 않는다. 실제 숫자 조정 규칙은 후속 범위다.

## 4. 검증과 공격적 검수

| 검사 | 결과와 범위 |
|---|---|
| 코어 전체 | 26 파일, 816 테스트 PASS; impl TypeScript PASS |
| 앱 전체 | 최종 265 파일, 2,287 테스트 PASS, 실패 0 |
| 최종 관련 KST | 5 파일, 46 테스트 PASS |
| 최종 상태 초기화·편집기·저장 재시도 | 4 파일, 29 테스트 PASS |
| 실제 브라우저 | PC / 320px 터치 / 모션 최소화 3/3 PASS. 위치 선택→1111초 기록 확인→저장→재열기. 320px에서 200% 글자 확대와 가로 넘침도 확인 |
| 앱 빌드 | TypeScript와 프로덕션 빌드 PASS. 폰트 상대 경로 경고는 남지만 로컬 preview의 실제 font/woff2 응답 200, 2,057,688바이트 확인 |
| 문서와 권한 | 카탈로그·V2 활성화·중거리 원문수용·개인화 정책·advisory·v2 권한·경기 배치 검증기 7종 PASS |

앱 전체 테스트의 `의도적 렌더 실패`, `feedback chunk unavailable` 콘솔 메시지는
관련 오류 경계 시험이 출력한 것이다. 전체 검사 exit code와 assertion 실패 수로
판정하며, 콘솔 메시지가 전혀 없었다고 보고하지 않는다.

독립 코드 검수에서 이전 계획의 PM 선택이 다음 MORNING 계획으로 남는 P2를 발견했다.
수정 전 두 테스트가 실제로 실패했다. 계획 종료 처리에서 위치·기록 확인 상태와
대기 재시도를 초기화하고 revision을 증가시켰다. 없는 위치를 정상 선택처럼
표시하던 UI도 재선택 상태로 바꿨다. 독립 재검수는 해당 2파일 5/5 PASS다.
부모 상태 생명주기 테스트는 자식 화면·저장을 stub 처리하므로, 실제 저장 왕복
증거는 별도의 도메인 테스트와 브라우저 시나리오를 사용한다.

이전 타깃 무시, 가짜 MAIN 구조 다양성, 조정 정책·내용·만료 변조는 관련 테스트로
차단한다. 회복 합계는 기존 sequence 계산기를 읽으며 미산출 값은 null로 유지한다.
가짜 개인 기록은 합성 fixture만 사용했다. 메모·비밀 메모·외부 워치 데이터는 읽지 않았다.

## 5. 남은 구현을 진행하는 순서

| 순서 | 작업자에게 넘길 범위 | 시작 근거 / 완료 조건 |
|---|---|---|
| 1 | MAIN별 선택 초안·다중 상세 세션 저장 모델 | 현재 한 개 제약이 있는 스키마·identity·adaptation validator를 함께 확장. 기존 v1~v3 읽기와 로그 불변성 회귀 검증 |
| 2 | 전체 카탈로그의 정확한 방법·구성·조정 정책 준비 | 30행 준비표의 누락 원문·회복·개인 강도·대상 범위를 묶어서 처리. 출처 존재와 활성화는 분리 |
| 3 | 조정 편집기의 실제 저장 연결 | 원자적 현재 상태 재검증, 이중 클릭·다른 탭·계정 전환·quota 실패·만료 차단. 적용 실패 시 초안 보존 |
| 4 | 실제 수행 이력·주기 목적의 추천 맥락 연결 | 선택과 실제 수행을 별도 집계. 미기록을 0능력으로 해석하지 않음. 선호에 따른 추천 이유를 표시 |
| 5 | 실제 수치·이유·근거·일지의 버전 연결 | 변경 후 옛 회복 설명이 남지 않고 이전 계획에는 새 이유를 소급 생성하지 않음 |
| 6 | 최종 UX·코어·근거 검수 후 배포 | Fable UX 검수, 코어/과학 검수 분리. 조정 화면의 320/375px·200%·키보드·모션 최소화 실제 검증, CI→병합→공개 화면 확인 |

이 순서는 반복 승인을 요청하기 위한 목록이 아니라 이미 승인된 계획의 잔여 구현
목록이다. 새 수치 범위의 근거가 없으면 발명하지 않고 정확한 누락으로 기록한다.
특히 100~400m 전문선수 확대, 자동 증량, 무조건 다른 방법 강제, 완료된 훈련 변경은
이번 계획의 범위가 아니다. 청소년과 혼자 훈련하는 기존 사용자 범위는 유지한다.

## 6. 인수인계와 전달 범위

- [구현 계약](../../specs/reconstruct/SESSION_METHOD_SELECTION_AND_ADJUSTMENT_CONTRACT.md)
- [카탈로그 30행과 기존 런타임 4개 참조 준비표](../review/SESSION_METHOD_CATALOG_READINESS_2026-09-05.md)
- 검수 전 코드 기준점은 `ee7a91e`다. 원격 main `296a845` 이후의 기존 선행 커밋 4개도 보존되어 있다.
- 꾸미기 PR #317의 `genspark_ai_developer` 작업은 수정·병합·덮어쓰기하지 않는다.
- 이 묶음은 검수용 단계 구현이며, 운영 조정 기능 완료·전체 계획 완료·배포 완료의 증거가 아니다.

## 7. 최종 검증 기록

최종 앱 검사 원본은 로컬 생성물 `app/test-results/session-method-final-unit-results.json`이다.
실제 결과는 265파일 / 2,287 PASS / 0 FAIL / success=true이며 새 lifecycle 및 editor
파일의 passed 상태도 별도로 대조했다. 이 파일과 Playwright 스크린샷은 생성물이며
Git 커밋에 포함하지 않는다. 다음 작업자는 다음 명령으로 재현한다.

```powershell
# app 디렉터리
npm run test:unit -- --reporter=json --outputFile=test-results/session-method-final-unit-results.json
npm run typecheck:e2e
npm run build
$env:PLAYWRIGHT_PORT='4187'
.\node_modules\.bin\playwright.cmd test e2e/session-method-target.spec.ts --project=desktop-chromium --project=touch-narrow --project=reduced-motion --workers=2
# impl 디렉터리
.\node_modules\.bin\vitest.cmd run --reporter=dot
.\node_modules\.bin\tsc.cmd --noEmit --incremental false
```

최종 브라우저 시나리오는 18분 31초 기록으로 1000m 목표가 222.2초임을 검사한다.
선택 위치의 저장·재열기·페이지 오류 0건을 확인했다. 이는 현재 지원하는 한 세션
배치의 증거이며, 아직 연결하지 않은 조정 편집기의 브라우저 검증은 아니다.
화면 확인은 로컬 preview `http://127.0.0.1:4188/?app=1`에서 가능하다.
공개 Pages 배포나 원격 CI 성공으로 보고하지 않는다.

[DRAFT_COMPLETE]
