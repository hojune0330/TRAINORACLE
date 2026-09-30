# 활성 훈련 계획 수정: 구현 체크포인트

## 현재 경계

- 오너 요청: 2026-10-01 `구현해. 병렬 가능한건 병렬로 하고.`
- 선행 준비: `ACTIVE_PLAN_EDIT_AND_REBUILD_READINESS_2026-10-01.md`의 훈련 하나 수정부터 저장·재로드까지 연결하는 1차 범위.
- 작업 위치: `TRAINORACLE-plan-edit-20261001`, 기반 `ad79c4d676def0c27a76d0728eb21dcc56eb7b75`, detached HEAD. 새 브랜치 없음.
- 기존 `TRAINORACLE-oracle-exploration-20260921`의 수정·미추적 파일은 수정하거나 포함하지 않았다.
- 로컬 구현과 생성된 서버 검증 코드까지 포함한다. 운영 계정 저장, 원격 CI, 배포 완료를 뜻하지 않는다.
- 메인 푸시는 CI 뒤 Pages 자동 배포를 시작하므로 이번 구현 요청에서 실행하지 않는다.

## 사용 가능한 경로

| 진입 | 구현 범위 |
|---|---|
| 계획 수정 | 작은 버튼 하나로 지원되는 변경 경로만 선택 |
| 이 훈련 수정 / 오전·오후 훈련 수정 | 아직 시작하지 않은 V3 날짜형 SELF 계획의 RPE 훈련 |
| 훈련 내용 바꾸기 | 검토된 같은 목적의 카탈로그 구성·계산 입력 변경. 비카탈로그는 기존 최소 시간을 유지하며 최대 시간만 줄임 |
| 훈련 날짜 바꾸기 | 같은 오전/오후의 기존 저강도·휴식 칸과 전체 구성 교환. 기존 주요 훈련 간격·하루 슬롯 조건 유지 |
| 새 계획 만들기 | 기존 조건을 초안으로 가져와 필요한 항목 수정. 선택한 시작일로 새 계획 생성·비교 후 명시적 시작 |

## 저장과 보호

- 탐색·초안·미리보기는 계획을 쓰지 않는다. 시작하지 않았다는 확인은 기록 부재와 별개다.
- 과거 날짜, 진행 상태, 실제 날짜/슬롯의 기록, 다른 날짜에 작성한 계획 연결 기록은 보호한다. 불특정 슬롯 기록은 해당 날짜 전체를 보호한다.
- 적용 직전에 계획 지문·기록 근거·계정 범위·현지 날짜·몸 상태·기준 경기 기록·상세 처방 권한을 재확인한다.
- 카탈로그 계산 결과는 정확하게 다시 바인딩한다. 더 강하거나 현재/원래 안내보다 긴 구성은 명시적 확인에 묶는다.
- 카탈로그 입력/동의 변경은 이전 선택안과 미리보기를 무효화한다.
- 게스트는 이전 계획의 원본을 먼저 보관하고 읽기 확인한 후 활성 계획을 교체한다. 보관 뒤 상태가 바뀌면 활성 계획을 쓰지 않는다. 보관함을 자동 정리하지 않는다.
- 계정은 기존 SELECT collection CAS로 원본·진행 기록을 보존한다. 서버는 owner 범위의 journal을 읽어 원문 대신 허용된 근거 지문과 기록된 슬롯만 검사하고, 기존 journal revision-set 원자적 가드를 유지한다.
- 응답이 불확실하면 성공으로 표시하거나 자동 재시도하지 않는다. 화면은 현재 계획을 다시 읽도록 안내한다.
- 저장 후 기존 일지 연결을 재작성하지 않는다. 이전 계획 원본으로 확인할 수 있다. 이후 현재 계획에서 새로 남긴 기록의 기존 RT6 조정 경로와도 호환된다.

## 주요 파일

- `app/src/domain/active-plan-edit{,-policy,-store}.ts`
- `app/src/domain/account/active-plan-edit-journal-guard.ts`
- `app/src/domain/account/account-plan-document-schema.ts`, `account-plan-collection-schema.ts`
- `app/src/screens/plan-beta/ActivePlanEditHub.tsx`, `ActivePlanSessionEditor.tsx`, `ActivePlanRebuildEditor.tsx`
- `ActivePlan.tsx`, `PlanActiveState.tsx`, 재사용 `CatalogWorkoutPicker.tsx`
- `supabase/functions/_shared/account-plan-collection-handler.mjs` 및 재생성 validator 두 개

## 검증 범위

- 변경된 편집·저장·계정 전환·근거 보호·UI와 기존 카탈로그/기준 기록/RT6 인접 회귀만 실행했다.
- 날짜·계정 전환 관련 지정 파일은 UTC와 KST 양쪽에서 확인했다.
- 서버 handler 합성 암호화 fixture: 정상 guarded CAS, 기록된 슬롯 거부, 오래된 revision 거부.
- 저장 보관 readback 검사에 결함을 주입하자 `does not replace the active plan when archive readback fails`가 이름으로 실패했다. 결함은 복원했다.
- 앱 타입 검사와 Vite 빌드, 생성된 서버 validator 일치 검사 통과. 최종 지정 UI 테스트 18/18, 서버 handler 테스트 3/3 통과.
- 최종 빌드의 합성 게스트 브라우저 테스트 3/3 통과: 390px/1280px 진입, 시간 축소 미리보기·적용·재로드, 새 계획 초안 취소 시 원본 보존, 가로 넘침. 390px 카탈로그 교체도 선택·미리보기·적용·재로드까지 확인했다.
- 전체 앱 테스트, 전체 브라우저 suite, 운영 계정/DB, 원격 CI 및 배포 검사는 실행하지 않았다.
- 별도 `typecheck:e2e`는 변경하지 않은 `app/e2e/planned-repetition.spec.ts:41`의 기존 배열 요소 undefined 가능성 오류로 실패했다. HEAD 내용과 일치하며 이 작업에서 고치지 않았다.

## 미완료 및 다음 작업

- 여러 훈련을 한 번에 자동 재배치하는 남은 일정 재설계는 아직 구현하지 않았다. 미지원 메뉴는 숨긴다.
- 오전↔오후 이동, 새 슬롯 삽입, 임의 숫자/페이스 처방, V4–V6 직접 편집, 저장 후 복원 기능은 열지 않는다.
- 경기 날짜 포함 계획의 저장은 기존 미승인 경계를 유지한다. 상세 기준 기록을 새로 선택·관리하는 통합 편집 경로도 별도 확장이다.
- 다음 실행 작업: 이 커밋을 최신 main과 조율한 뒤 사용자가 요청하는 방식으로 프런트와 `account-plan-collection` 서버 코드를 함께 배포한다. 프런트만 배포하면 운영 계정 수정 성공을 보장할 수 없다.
