# 첫 계획 날짜별 환경 재확인 독립 검수

## 판정과 증거 경계

- 판정: `REVIEWED_WITH_LIMITS / REPRODUCED_FINDINGS_FIXED_IN_CURRENT_LOCAL_DIFF`.
- 수정 전 4개 결함을 독립 재현했다. 부모 작성자의 수정 후 같은 `R01~R04` 기대 단언은 변경하지 않고 UTC/KST에서 재실행하여 모두 통과했다.
- 현재 검토한 파일과 11개 수용 시험 범위에서는 미해결 차단 결함을 찾지 못했다. 제품 전체, 모든 UI 경로, 서버, 저장 스키마 또는 배포에 대한 전반 `APPROVE`가 아니다.
- 이것은 첫 계획 선택 UI의 임시 최신성 확인이다. 서버 인증이나 영구 날짜별 환경 증명, 실제 미래 장소·장비의 보장으로 해석하지 않는다.

## 대상과 기준

- 저장소: `D:\admin\Documents\ChatGPT\트레인 오라클\TRAINORACLE-oracle-exploration-20260921`.
- 브랜치: `codex/workout-choice-runtime-completion`.
- 기준 HEAD: `97624c9b82ac7ed6e78a616e4083594660e59ac7`와 현재 미커밋 변경.
- 선행 확인: `AGENTS.md`, `PRODUCT_NORTH_STAR.md`, `docs/UX_UI_VISUAL_STANDARD.md`, `specs/reconstruct/ALL_WORKOUT_CALCULATION_AND_BINDING_CONTRACT.md`.
- 추가 맥락 확인: `TRAINING_PLAN_CURRENT_SCOPE.md`, Plan Generator/D9/Template Library의 지위와 관련 범위, 디자인 handoff README와 위험 검토, 카탈로그 계산·바인딩·후보 정체성, 계정 scope, `PlanBeta.tsx`의 호출부.
- 구속 범위의 직접 근거: [전체 계산·연결 계약](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/specs/reconstruct/ALL_WORKOUT_CALCULATION_AND_BINDING_CONTRACT.md:68>)의 날짜·계정·정확한 구성/계산값별 임시 확인, 숫자/경험 보존, 묶음 응답, 모든 시작 차단, 슬롯별 승인 제한.

다음 다섯 파일의 현재 본문과 미커밋 변경을 검토했다. UI 관련 CSS 변경은 표현 확인 범위로만 추가 열람했다.

| 파일 | 최종 검토 SHA-256 |
| --- | --- |
| `app/src/domain/catalog-schedule-conditions.ts` | `853f47e64e7688ab660e7351362389c79dbc3767dfc5b30c7bab683cc4510324` |
| `app/src/screens/plan-beta/CatalogScheduleReview.tsx` | `86ff1a8237d59c4b01caf317d5dbd14d60669189421f5bd395f4db977790ac2d` |
| `app/src/screens/plan-beta/CatalogWorkoutPicker.tsx` | `ccc3d3584ffd9f06746a07e96d5cc481837949ed34e132a9803e6f314dd73129` |
| `app/src/screens/plan-beta/PlanCandidates.tsx` | `f8d122d76537d53c54e4fa9bd23cfce11222f8de82c3aff7f9957fbcc2cfd798` |
| `app/src/components/instant-plan/InstantPlanRecommendationView.tsx` | `fa6af506ec84142ddb1b509303dbe4ce5cce590f70d047ad4d608a8eee915377` |

최종 수용 실행은 UTC `2026-10-01T00:51:44Z`, KST `2026-10-01T00:52:31Z` 무렵 종료했다. 두 실행의 대상 파일 지문이 동일하며 실행 전후도 동일했다. 정확한 시각·전체 해시는 `snapshot-UTC-contract.json`, `snapshot-KST-contract.json`을 따른다. 최종 마감 확인에서도 위 다섯 제품 파일과 관련 CSS의 지문은 일치했다.

실행 후 부모가 계약에 날짜 왕복/제거한 구성 복원/숫자 변경/직접 체크 해제의 폐기 규칙을 세 줄 추가한 것은 다시 읽었다. 이는 이 검수의 기존 R01~R04 기대를 명시한 문서 보완이고 제품 source 변화는 아니므로 테스트를 중복 실행하지 않았다. 현재 계약 SHA-256은 `dc9d92315b9a14a25f77b1378dd74b5c7f1d32fb7d64c0aaa3fb42b0463de7a2`이다. 이후 제품 파일 변경은 이 검수 결과의 직접 대상이 아니다.

## 발견과 수정 확인

아래 위치는 과거 스냅샷이 아니라 최종 현재 파일의 관련 처리 위치다. 수정은 부모 작성자가 수행했다. 독립 검수자는 제품 코드를 수정하지 않았다.

### R01 [P2] 날짜를 왕복하면 예전 환경 답변이 부활함: 현재 수정 확인

재현: `P-ATP-A` 선택 → 구간 `7.25초` 직접 입력 → 공간 확인 → 시작일 `2026-10-02`에서 `2026-11-02`로 변경 → 다시 `2026-10-02`로 복귀.

수정 전에는 B에서만 환경 체크를 렌더링상 숨겼고, 상태에 A의 답변이 남아 A 복귀 시 체크와 적용 버튼이 살아났다. `O01`에서 새 응답 없이 적용 콜백까지 호출됨을 확인했다. 테스트의 날짜/입력 fixture 오류가 아니다.

현재 [CatalogWorkoutPicker.tsx](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/screens/plan-beta/CatalogWorkoutPicker.tsx:117>)는 정확한 확인 문맥을 만들고, [문맥 변경 처리](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/screens/plan-beta/CatalogWorkoutPicker.tsx:124>)가 환경 답변 자체를 상태에서 제거한다. `R01` UTC/KST 통과: A 복귀 뒤 숫자는 유지되지만 환경 체크는 미선택이고 적용은 차단된다.

### R02 [P2] 묶음 확인 뒤 개별 환경 답변을 해제할 수 없음: 현재 수정 확인

재현: 환경 재확인이 필요한 적용된 바인딩으로 결과 화면 진입 → 상단 묶음 확인 → 편집기 열기 → 공간 체크 해제.

수정 전에는 초기 raw requirements가 빈 배열이라 체크 해제 뒤에도 `configurationChanged=false`였다. 부모 검토 완료 바인딩의 기존 requirements가 사용자의 해제를 덮어썼다. `O02`에서 체크가 다시 켜지고 취소 버튼도 없이 시작 콜백이 호출됨을 확인했다.

현재 [변경 판정과 부모 확인 복원](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/screens/plan-beta/CatalogWorkoutPicker.tsx:129>)은 `confirmation.userEdited`를 반영하며 [직접 응답 처리](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/screens/plan-beta/CatalogWorkoutPicker.tsx:134>)가 이를 설정한다. `R02` UTC/KST 통과: 해제가 유지되고 시작은 차단되며 명시적 변경 취소가 노출된다.

### R03 [P2] 정확한 숫자를 바꿔도 이전 환경 확인을 새 계산에 재사용함: 현재 수정 확인

재현: `P-ATP-A`에 `7.25초` 입력 → 공간 확인 → `8.25초`로 변경 → 다시 공간을 확인하지 않고 적용.

수정 전 확인 문맥은 날짜/계정만 포함했다. `O03`에서 `8.25초`가 실제 새 바인딩 입력에 들어가고, 그 슬롯이 검토 완료로 기록되어 시작 버튼이 열리는 것을 확인했다. 본 테스트의 숫자는 합성 재현값이며 권장 수치나 개발 수치정책 승인이 아니다.

현재 [숫자 draft](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/screens/plan-beta/CatalogWorkoutPicker.tsx:115>)와 확인 문맥에는 choice/record/구간·회복 입력, 날짜/계정/슬롯, 바인딩 계산 지문, 종목/경험이 포함된다. 문맥 변경 때 환경값을 제거하고 숫자는 그대로 둔다. `R03` UTC/KST 통과: `8.25초` 변경 뒤 환경 미선택 및 적용 차단.

부모의 [명시적 적용 승인](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/screens/plan-beta/PlanCandidates.tsx:250>)은 여전히 `reviewedAddress`에 해당하는 한 슬롯만 승인한다. [적용 후 editor revision 초기화](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/screens/plan-beta/CatalogWorkoutPicker.tsx:81>)도 확인했다.

### R04 [P2] 사라진 구성의 승인 키가 남아 구성 복원 시 재검토를 우회함: 현재 수정 확인

재현: 같은 intake/날짜/계정에서 적용된 환경 바인딩을 묶음 확인 → 동일 component 인스턴스에 원래 미연결 후보를 전달 → 이전 환경 바인딩 후보를 다시 전달.

수정 전에는 현재 후보에서 사라진 키를 ledger에서 제거하지 않아 복원된 구성의 시작 버튼이 재확인 없이 열렸다. `R04`는 실제 생성기와 바인딩을 통과한 두 유효 후보를 사용했다. 다만 이 재현은 component prop 전환 시험이며, 동일 순서를 만드는 앱 전체의 사용자 진입 경로까지 직접 실행한 증거는 아니다. 부모 작성자는 이를 필요한 후보 문맥 수리로 수용했다.

현재 [PlanCandidates.tsx의 키 정리](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/screens/plan-beta/PlanCandidates.tsx:157>)는 현재 생성 후보의 키만 유지한다. `R04` UTC/KST 통과: 복원 구성은 미선택 환경 질문을 다시 보여주며 시작이 차단된다. 한 슬롯을 바꿨다는 이유로 다른 현재 슬롯의 확인을 모두 지우는 구현은 아니다.

## 직접 실행 결과

환경: 지정된 `C:\Program Files\nodejs\node.exe`, 로컬 설치 Vitest `4.1.10`, jsdom. 의존성 설치·네트워크 요청 없이 실제 제품 컴포넌트와 도메인 코드를 import했다. 데이터는 합성 fixture, 브라우저 저장소는 jsdom 메모리 저장소다.

| 실행 | 결과 | 의미 |
| --- | --- | --- |
| 수정 전 UTC | 8 통과 / 4 실패, 총 12 | 당시 C01~C05와 O01~O03 통과, R01~R04 실패 |
| 수정 전 KST | 10 통과 / 4 실패, 총 14 | C06/C07 추가 후 동일 R01~R04 실패 |
| 수정 후 UTC 수용 | 11 통과 / O 3개 제외 | C01~C07 + 원래 R01~R04 기대 단언 통과 |
| 수정 후 KST 수용 | 11 통과 / O 3개 제외 | UTC와 동일 source, 동일 기대 단언 통과 |

`O01~O03`은 "버그가 현재 존재한다"를 단언하는 수정 전 관찰 영수증이다. 통과가 수용을 뜻하지 않는다. 수정 후 정상 동작에서는 실패해야 하는 시험이므로 수용 실행에서는 이름 필터로 제외했다. 원본 테스트와 수정 전 JSON은 남겨 두었고, 당시 O 시험만 추출한 `observed-consequences-before-fix.json`도 별도로 보존했다.

현재 수용한 11개 시험의 범위:

- C01: 반복 날짜를 조건별 한 질문으로 묶고, 동일 A/B 슬롯을 중복 질문하지 않으며 날짜/계정별 키를 분리.
- C02: 추천 시작과 A/B 선택, 세 개 시작 동작을 모두 차단. 확인 뒤 열리고 날짜 변경 뒤 다시 차단. 재확인 자체는 후보·저장소를 변경하지 않음.
- C03: 재검토한 계정과 다른 계정의 stale click을 rerender 이전에도 거절하고, rerender 뒤 새 질문을 미선택으로 표시.
- C04: 날짜 변경 때 직접 입력한 소수점 구간 숫자는 보존하고 환경만 해제.
- C05: 한 슬롯을 적용했다고 다른 슬롯이 승인되지 않음.
- C06: 실제 복합 훈련 경험 확인과 입력 구간값은 날짜 변경만으로 지워지지 않음.
- C07: 손대지 않은 편집기가 환경 재확인을 draft pending으로 막지 않으며, 묶음 재확인 전후 연속 추가 공간 질문 shortcut을 억제.
- R01~R04: 위 네 결함의 수정 기대 단언을 원형대로 유지해 검증.

### 결함 주입의 유효성

제품 파일은 쓰지 않았다. 검수 runner의 Vite 메모리 transform에서만 단일 위치를 변조했고, 관련 양성 대조군은 정상 source에서 통과했다.

| 임시 결함 | 실제 이름으로 실패한 시험 | 증거 |
| --- | --- | --- |
| 확인 키에서 실제 날짜를 제거 | C01 | `results-UTC-date.json` |
| 선택 gate에서 미확인 환경 차단 제거 | C02 | `results-UTC-gate.json` |
| 적용 슬롯 filter를 제거하여 다른 슬롯도 승인 | C05 | `results-UTC-crossslot.json` |

각 mutation 결과는 해당 1개가 실패하고 나머지 13개를 제외했다. `snapshot-UTC-*.json`에 `mutationApplied=true`와 실행 전후 동일 source 지문을 남겼다. 중간 gate 실행 때 부모 수정이 겹친 결과는 최종 증거로 쓰지 않고 안정된 현재 source에서 다시 실행했다.

## 구현·UX 잔여 범위

- [임시 확인 키](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/domain/catalog-schedule-conditions.ts:36>)는 계정·실제 날짜·슬롯·전체 바인딩을 지문에 포함한다. 사용자 확인을 서버의 인증/환경 증명으로 승격하지 않는다.
- [묶음 질문](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/screens/plan-beta/CatalogScheduleReview.tsx:9>)은 같은 조건의 날짜/오전·오후를 함께 보여주고 미선택에서 시작한다. 전부 가능한 날을 한 번에 응답하는 흐름이다. 날짜 일부만 불가능할 때는 개별 훈련 편집 또는 일정 변경으로 돌아가야 하며, 이 UI에 부분 승인 기능은 없다.
- [수영 복합 조건](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/domain/catalog-schedule-conditions.ts:12>)은 수영 능력과 물 안전을 한 requirement로 표현한다. 날짜 재확인에서 능력 이력만 별도 필드로 분리해 표시하는 기능은 없다. 현재 확정된 schema 분리나 신규 경험 수집으로 해석하지 않는다.
- [재확인 버튼](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/screens/plan-beta/CatalogScheduleReview.tsx:23>)의 기존 `instant-plan__secondary` 재사용과 공통 CSS를 소스 확인했다. 독립 실행은 DOM 의미/상태 시험이지 실제 320/375px 터치 영역, 줄바꿈, focus 이동 또는 CSS 200% 화면 검증이 아니다.
- [추천 화면의 전달 위치](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/components/instant-plan/InstantPlanRecommendationView.tsx:115>)는 시작 동작 앞에 질문을 삽입한다. 기존 시작 disabled/handler를 유지한다.
- AM/PM 키와 그룹 표시는 읽었으나 별도 이중 세션 통합 fixture를 직접 실행하지 않았다. D9 전체, 저장 실패 복구, 서버 CAS, 배포, 모든 카탈로그의 수치정책까지 검증한 결과가 아니다.
- 부모가 제공한 UTC41/KST41, browser3/3 결과는 별도 부모 증거다. 이 보고서의 독립 직접 실행 수나 독립 브라우저 증거로 합산하지 않았다.

## 재실행과 산출물

검수 폴더에서 정상 수용 시험만 실행:

```powershell
& 'C:\Program Files\nodejs\node.exe' '.\run.mjs' UTC contract
& 'C:\Program Files\nodejs\node.exe' '.\run.mjs' KST contract
```

`contract` 필터는 C/R만 선택한다. 인자 없이 전체를 실행하면 수정 전 결함 자체를 기대하는 O 시험도 선택되므로 정상 수정 후 수용 판정에 사용하지 않는다. 결함 주입은 마지막 인자를 `date`, `gate`, `crossslot`로 지정하며 의도된 실패가 정상이다.

- 테스트: `independent.test.tsx`, 실행: `run.mjs`, 독립 설정: `vitest.review.config.mjs`, 요청 차단: `offline.setup.ts`.
- 수정 전 관찰: `results-UTC.json`, `results-KST.json`.
- 수정 전 결함만의 별도 영수증: `observed-consequences-before-fix.json` (`extract-observed.mjs`로 기존 결과에서 추출).
- 수정 후 수용: `results-UTC-contract.json`, `results-KST-contract.json`.
- 파일 문맥: `snapshot-UTC-contract.json`, `snapshot-KST-contract.json`, mutation별 snapshot.
- 초기 runner에서 경로 변환 오류로 테스트가 시작되지 않은 시도는 통과 수에 포함하지 않았다. 별도 경험 시험의 초기 X-MIX-09 fixture는 시간형이어서 숫자 입력이 없었고, 거리형 X-MIX-10으로 시험 fixture만 교정했다. 이를 제품 결함으로 보고하지 않았다.
- 초기 runner 설정 과정에 저장소 루트에 잘못 생성된 자기 결과 JSON 한 개는 제거했다. 최종 독립 산출물·캐시는 지정된 검수 폴더에만 남아 있다. 제품 코드, 부모 테스트·증거, 비밀 env, 개인정보 또는 서버/DB를 변경·조회하지 않았다. 외부 요청과 의존성 설치를 수행하지 않았고, 종료하지 않은 검수 실행 세션은 없다.

개발 수치정책 승인, 병합 및 배포는 이 검수의 범위 밖이다.
