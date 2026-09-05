# SESSION_METHOD_SELECTION_IMPLEMENTATION_2026-09-05.md

```yaml
doc_id: trainoracle-session-method-selection-implementation-2026-09-05
status: IMPLEMENTED_FOUNDATION_WITH_EVIDENCE_GATED_ACTIVATION
inspected_on: 2026-09-05
base_sha: ee7a91e3edbb2da38782717ecc46ce9c18b29a69
reconciled_on: 2026-09-06
historical_approved_engineering_foundation_complete: true
approved_workflow_complete: false
full_catalog_activation_complete: false
live_multi_method_selection: false
live_history_aware_ranking: true
new_exact_template_activations: 0
historical_pre_merge_production_deployment: NOT_PERFORMED
verified_merge_sha: 985669328dbcc7738afc9f390c9c325769b8251c
verified_ci_run: 33954914850
verified_ci_conclusion: success
historical_deploy_pages_job: success
current_public_ui_verified_in_this_pass: false
canonical_promotion: false
```

## 1. 쉬운 요약

PR #318에는 여러 훈련 방법을 선택·추천·조정하기 위한 엔지니어링 기반이 병합됐다.
전체 승인 워크플로의 완료 보고는 아니다. 사용자용 다중 MAIN 선택과 조정 저장,
전체 카탈로그 근거 준비 및 설명·일지 버전 연결이 남아 있다. 근거가 생기더라도
운영 연결과 통합 검증이 별도로 필요하다. 누락 목록 작성만으로 준비 완료라고 하지 않는다.
아래 구현 표의 기준점과 기존 시험 결과는 2026-09-05 기록이다. 후속 항목은
2026-09-06 요구사항으로 표시하고 정합성 확인·새 수용 결정은 §9~10에 구분한다.
새 훈련을 한 개씩 준비할지 반복 승인받는 절차는 만들지 않는다.

| 구분 | 이번 결과 | 아직 하지 않은 것 |
|---|---|---|
| 상세 훈련의 적용 위치 | 같은 목적의 주요 훈련 중 날짜와 오전/오후를 선택하고, 개인 기록 확인 후 저장·재열기 | 한 계획의 여러 MAIN에 서로 다른 상세 처방을 동시에 저장 |
| 방법 추천 | 적격 방법 전체를 평가하는 공통 코어 연결. 실제 구조가 다른 최대 두 개만 대표 추천, 나머지 펼쳐보기 | 현재 조건별 활성 방법은 하나. 새 방법을 활성화한 것은 아님 |
| 반복과 다양성 | 종료 계획의 상세 세션별 선택·자기보고 완료·미수행 상태·미기록을 v4 이력으로 저장하고 추천 순위에 연결 | 측정된 처방 준수가 아님. 현재 같은 조건에서 활성 방법은 하나. 중립 기본값과 선택적 선호는 §10 후속 범위 |
| 다중 MAIN 기반 | PR #318의 서로 다른 상세 방법 원자 배치와 aggregate identity 기반. 당시 같은 방법/구조는 거부 | §10의 공유 배치 정책 게이트로 분리하는 후속 기반 작업. 검토된 프레임 조합 근거 없이 런타임 다중 배치 레지스트리는 비어 있고 사용자 다중 선택은 열지 않음 |
| 처방 조정 | 검토된 전체 구성 간 변경, 초안·취소·초기화·적용, 해시·정책·만료·현재 상태 검증 | 운영 정책 연결, 개별 수치 범위 및 서버/로컬 저장 통합. 근거 없는 +/-는 계속 차단 |
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

2026-09-06 기준점 확인: `plan-template-options.ts`는 `loadPlanMethodHistory`로
종목별 이력을 읽고 `PREFER_VARIETY`를 기본 전달한다. 적격성 필터 후 세 우선순위는
모두 0이다. 따라서 앞뒤 부하·주기 목적·회복을 모델링한 추천이라고 할 수 없다.
수용된 다음 계약은 `NEUTRAL` 기본값과 선택적 `PREFER_VARIETY`/`PREFER_REPEAT`다.
중립은 이력을 비우는 것이 아니라 반복/다양성 동률 규칙을 쓰지 않는 것이다.
표시 후보의 구조 다양성이 서로 다른 날짜의 동일 방법 선택까지 금지하지 않도록
배치 정책과 분리한다. 이번 문서 수정은 해당 코드 변경 완료 증거가 아니다.

방법군과 구성은 독립된 ID·버전·관계를 갖는다. PR #318은 둘 다 `templateId`로
연결하는 호환 어댑터를 쓰므로 확장 시 명시적 구형 참조 매핑이 필요하다. 구성 ID
변경을 새 방법 경험 0으로 해석하거나 기존 계획·아카이브의 참조를 소급 교체하지 않는다.

조정 코어의 정책과 구성 참조는 내용 해시를 포함한다. 해시는 승인 서명이 아니다.
신뢰 레지스트리는 별도로 로드해야 하며 저장된 초안의 `reviewRef`만 보고 권한을
복원해서는 안 된다. UI의 +/-는 완성된 검토 구성의 순서를 이동할 뿐, 임의의
1초·100m·1회 증감을 만들어내지 않는다. 실제 숫자 조정 규칙은 후속 범위다.

## 4. 검증과 공격적 검수 (2026-09-05 과거 기록)

아래 수치·실패 주입·브라우저 결과는 원래 구현 작업의 기록을 보존한 것이다.
이번 문서 전용 작업에서 재실행하지 않았으며 §10 후속 코드의 검증으로 쓰지 않는다.

| 검사 | 결과와 범위 |
|---|---|
| 코어 전체 | 26 파일, 818 테스트 PASS; impl TypeScript PASS |
| 앱 전체 | 최종 266 파일, 2,298 테스트 PASS, 실패 0 |
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

## 5. 남은 활성화 작업을 진행하는 순서

| 순서 | 작업자에게 넘길 범위 | 시작 근거 / 완료 조건 |
|---|---|---|
| 1 | MAIN별 선택 초안·다중 상세 세션 저장 모델 | 기존 원자 트랜잭션·aggregate identity 기반에 binder/schema/adaptation 공통 정책 게이트 연결. 같은 방법 반복도 정확한 프레임 조합 수용 필요. 운영 레지스트리와 사용자 화면은 근거·통합 검증 전 활성화 금지 |
| 2 | 전체 카탈로그의 정확한 방법·구성·조정 정책 준비 | 30행 준비표의 누락 원문·회복·개인 강도·대상 범위를 묶어서 처리. 출처 존재와 활성화는 분리 |
| 3 | 조정 편집기의 실제 저장 연결 | 원자적 현재 상태 재검증, 이중 클릭·다른 탭·계정 전환·quota 실패·만료 차단. 적용 실패 시 초안 보존 |
| 4 | 자기보고 이력과 추천 맥락 연결 | v4 이력 입력은 연결됨. 중립 기본/선택 선호 및 실제 사용 맥락 표시를 검증해야 함. 주기 목적·회복 모델 또는 측정 준수 분석 완료는 아님 |
| 5 | 실제 수치·이유·근거·일지의 버전 연결 | 변경 후 옛 회복 설명이 남지 않고 이전 계획에는 새 이유를 소급 생성하지 않음 |
| 6 | 최종 UX·코어·근거 검수 후 배포 | Fable UX 검수, 코어/과학 검수 분리. 조정 화면의 320/375px·200%·키보드·모션 최소화 실제 검증, CI→병합→공개 화면 확인 |

이 순서는 반복 승인을 요청하기 위한 목록이 아니라 이미 승인된 계획의 잔여 구현
목록이다. 새 수치 범위의 근거가 없으면 발명하지 않고 정확한 누락으로 기록한다.
특히 100~400m 전문선수 확대, 자동 증량, 무조건 다른 방법 강제, 완료된 훈련 변경은
이번 계획의 범위가 아니다. 청소년과 혼자 훈련하는 기존 사용자 범위는 유지한다.

## 6. 인수인계와 전달 범위

- [구현 계약](../../specs/reconstruct/SESSION_METHOD_SELECTION_AND_ADJUSTMENT_CONTRACT.md)
- [카탈로그 30행과 기존 런타임 4개 참조 준비표](../review/SESSION_METHOD_CATALOG_READINESS_2026-09-05.md)
- 과거 검수 전 코드 기준점은 `ee7a91e`다. 당시 기록의 원격 main `296a845` 이후 기존 선행 커밋 4개 보존 설명은 역사적 맥락이며 최신 main 주장이 아니다.
- 당시 꾸미기 PR #317의 `genspark_ai_developer` 작업은 이 작업에서도 수정·병합·덮어쓰기하지 않는다. 해당 PR의 현재 상태는 조회하지 않았다.
- 이 묶음은 기반 구현과 잔여 워크플로를 분리한 보고다. 신규 방법·수치 조정 운영 활성화나 과학 검수 완료의 증거가 아니다. 이후 확인된 PR #318 병합·원격 CI·배포 job 이력은 §9로 추적한다.

## 7. 최종 검증 기록 (2026-09-05 과거 기록)

이전 최종 앱 검사 원본은 로컬 생성물
`app/test-results/session-method-final-unit-results.json`이다. 당시 완료 패스는
같은 전체 명령을 다시 실행해 266파일 / 2,298 PASS / 0 FAIL을 콘솔에서 확인했다.
생성물과 Playwright 스크린샷은 Git 커밋에 포함하지 않는다. 다음 작업자는 다음
명령으로 재현한다.

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
당시 로컬 preview 주소는 `http://127.0.0.1:4188/?app=1`이었다. 현재 서버가
실행 중이라고 확인한 주소가 아니다. 이 로컬 결과 자체는 공개 Pages 배포나
원격 CI 성공의 근거가 아니며, 후속 전달 이력은 §9를 따른다.

## 8. 구역별 기반 리뷰 (2026-09-05 과거 기록)

| 구역 | 구현 결과 | 공격적 리뷰 결과 |
|---|---|---|
| 1. 수행 이력 | 계획 종료 시 상세 세션별 v4 이력 저장; 선택·자기보고 완료·미수행 상태·미기록 분리 | 구형 v3 선택은 수행으로 추정하지 않으며 RPE-only 세션은 방법 이력을 만들지 않음. COMPLETED/PERFORMED는 측정 준수 아님 |
| 2. 추천 연결 | 앱 기본 경로가 실제 저장 이력을 읽고 다양성 우선순위를 계산; 추천 이유 표시 | 추천은 순위만 바꾸며 자동 선택·강도·양·빈도 변경 없음. 한 방법뿐이면 그 사실을 그대로 표시 |
| 3. 다중 MAIN 코어 | 1~3개 정확한 슬롯의 원자 배치, aggregate fingerprint, 후보/쌍 identity 재생성 | 중복 슬롯·중복 방법·ID만 다른 같은 구조·한 후보만 실패하는 경우 모두 전체 거부 |
| 4. 저장·실행 경계 | 후보·활성 상태가 대표 참조, 개별 승인, 같은 종목, 구조 차이를 다시 검증 | 두 번째 승인 방법이 없으므로 라이브 다중 선택은 열지 않음. 기반 구현과 실제 활성화를 분리 |
| 5. 조정 | 기존 조정 코어와 전체 화면 편집기 18개 테스트 유지 | 실행 가능한 정책이 없을 때 빈 +/- UI를 노출하지 않고 수치 발명도 하지 않음 |
| 6. 회귀·브라우저 | 앱 2,298, 코어 818, 문서 변조 43, 브라우저 4 통과; 타입·빌드 통과 | `launch-ready`의 모호한 분석 heading locator를 발견·수정해 실제 CI 실패 원인 제거 |

### 남은 증거 관문

1. 같은 종목·목적에서 실제 구조가 다른 두 번째 방법의 원문·대상·구성·회복·권한 승인.
2. 한 주기 안에서 두 상세 MAIN을 함께 제공할 때의 배치·상호작용·노출 정책.
3. 각 `+/-`가 이동할 수 있는 유한 구성 또는 수치 범위와 결합 회복 규칙.
4. 위 항목이 생긴 뒤 사용자용 다중 선택·조정 화면을 연결한 독립 UX/과학 검수와 배포 증거.

이 네 관문은 승인된 전체 방향을 다시 묻기 위한 목록이 아니다. 근거가 확보되는
범위별로 구현과 통합 검증을 진행하기 위한 입력 목록이다. 현재 코드가 임의의
두 번째 방법이나 조정값을 만들지 않는 것은 지켜야 할 경계이지 잔여 작업 완료가 아니다.

## 9. 병합·배포 후속 이력과 문서 정합성 (2026-09-06)

2026-09-06 다음 읽기 전용 명령으로 정확한 전달 이력을 재확인했다. 현재 원격 main
최신 SHA나 현재 공개 화면은 확인하지 않았고, 이번 작업에서 배포를 실행하지 않았다.

```powershell
gh pr view 318 --json number,state,mergedAt,mergeCommit,baseRefName,headRefName,url
gh run view 33954914850 --json databaseId,name,status,conclusion,headSha,headBranch,event,createdAt,updatedAt,url,jobs
```

| 전달 항목 | 확인 결과 |
|---|---|
| [PR #318](https://github.com/hojune0330/TRAINORACLE/pull/318) | MERGED, base `main`, mergedAt `2026-09-05T08:18:44Z` |
| 병합 main SHA | `985669328dbcc7738afc9f390c9c325769b8251c` |
| [CI 33954914850](https://github.com/hojune0330/TRAINORACLE/actions/runs/33954914850) | `TrainOracle CI`, push/main, 위 SHA, completed/success; created `2026-09-05T08:18:46Z`, updated `2026-09-05T08:43:23Z` |
| 성공 job | `app-quality`, `contract-tests`, `app-browser`, `deploy-pages` 모두 completed/success |
| [deploy-pages job](https://github.com/hojune0330/TRAINORACLE/actions/runs/33954914850/job/101279388220) | `2026-09-05T08:43:22Z` 완료. `Publish verified build to gh-pages` step success |
| 현재 운영 확인 | 공개 화면·모바일·현재 서빙 SHA 재확인 안 함. 배포 job 성공과 신규 다중 MAIN/조정 활성화는 별개 |

기존 `production_deployment: NOT_PERFORMED`는 병합 전 스냅샷이므로 metadata에서
`historical_pre_merge_production_deployment`로 보존했다. 기존 로컬 시험 수치도
그대로 역사적 기록이며 이번 문서 작업의 재실행 결과로 바꾸지 않았다.

문서 정합성 작업은 지정된 계약·현재 범위·카탈로그 준비표·이 보고서만 수정한다.
문서 마커·로컬 링크·diff 검사는 수행하되 앱/코어/브라우저 런타임 검사와 구분한다.
외부 원문 재검토·신규 과학 승인·OPEN 이슈 종료·커밋·푸시는 수행하지 않는다.

### 이번 문서 검사 결과

| 2026-09-06 직접 실행 검사 | 결과와 범위 |
|---|---|
| 지정 문서 마커·구조 | 4개 모두 최종 마커 정확히 1개/파일 끝, 코드 fence 짝 및 충돌 마커 검사 PASS |
| 로컬 Markdown 링크 | 32개 대상, 그중 앵커 3개 모두 존재; 외부 URL은 이 로컬 검사와 별개 |
| 원문·이슈 보존 비교 | HEAD 대비 카탈로그 30행 matrix 동일; 계약 이슈 ID/상태/정본 차단 열 동일, OPEN 4/정본 차단 0 |
| 문서·정책 변조 테스트 | 아래 명령 43/43 PASS, 실패 0, exit 0. 새 배치 게이트나 UI 워크플로 런타임 시험은 아님 |
| 지정 문서 `git diff --check` | PASS. LF/CRLF 알림만 있으며 공백 오류 없음 |

```powershell
node --test specs/test-packages/validate-detailed-prescription-catalog.test.mjs specs/test-packages/validate-personalized-prescription-policy.test.mjs
```

부모 작성자의 병행 코드·테스트·신규 파일과 기존 미추적 검토 보고서는 수정하지 않았다.
위 검사는 이 문서 변경의 검증이며 부모의 후속 코드 완료·운영 활성화 증거가 아니다.

## 10. 수용된 다음 엔지니어링 결정 (2026-09-06)

사용자의 승인 작업 및 부모 작성자의 후속 지시를
`TO-SMSA-ENGINEERING-2026-09-06-001`로 기록한다. 상세 규범은
[구현 계약](../../specs/reconstruct/SESSION_METHOD_SELECTION_AND_ADJUSTMENT_CONTRACT.md)
§17과 §3~5, §10~11이다. 이는 기반 구현 방향의 수용이며 런타임 완료 증거가 아니다.

1. 기본값은 `NEUTRAL`; 다양성/반복은 선택 사항이다. 구조화 이력은 중립에서도
   유지하고 실제 사용한 맥락과 이유만 표시한다. 추천은 선택·증량·배치 권한이 아니다.
2. 대표 후보의 구조 다양성과 같은 방법의 일정 반복을 분리한다. binder/schema/
   adaptation이 공유하는 중앙 상세 MAIN 배치 정책 게이트를 부모 작성자가 구현한다.
   같은 정확한 구성의 다른 슬롯 반복도 명시적 검토 정책과 사용자 선택이 필요하고
   중복 슬롯은 항상 거부한다. 프레임 조합·노출·상호작용 근거가 수용되기 전에는
   런타임 검토 다중 배치 레지스트리를 비워 둔다. 기존 승인 단일 방법은 계속 지원한다.
3. 반복 배치를 허용하는 범용 코어 테스트 정책은 합성 fixture이며 운영 승인이 아니다.
   공유 게이트와 aggregate identity가 있어도 라이브 다중 MAIN 선택이나 조정 저장
   완료라고 보고하지 않는다. 정책 수용 후에도 UI·저장·재열기·실행·일지 왕복 검증이 필요하다.
4. 방법군/구성 ID는 독립적이고 구형 템플릿 참조는 명시적 버전 매핑으로 연결한다.
   기존 계획·원본 처방·백업·정체성의 호환성을 보존하고 새 근거를 소급 생성하지 않는다.
5. `COMPLETED`→`PERFORMED`는 자기보고 완료이지 측정된 처방 준수가 아니다.
   `RESTED`·`SKIPPED`·`PAIN_CHECKIN`은 `NOT_PERFORMED`, 무응답은 `MISSING`으로
   남기며 실제 거리·반복·회복을 계획값으로 채우지 않는다. 최근 18개 종료 계획/프레임
   요약의 기존 보존 순서·한도를 유지한다. 종목 필터 이전의 18개이며 고정 24주나
   영구 원본 계획 원장이 아니다. 장기 원장/새 처방 snapshot 저장은 별도 미완 범위다.

유지: 기존 네 상세 참조, 원본 계획 호환성, 청소년·자율 사용, 안전·개인정보,
자동 증량 금지, 신규 과학 승인 0 및 계약의 OPEN 4건/정본 차단 0건.
미완: 실제 프레임 조합 검토·신규 구성/조정 근거, 운영 정책 등록, 사용자 다중
선택·조정 저장·설명/일지 버전 연결 및 해당 범위의 종단간 검증.

[DRAFT_COMPLETE]
