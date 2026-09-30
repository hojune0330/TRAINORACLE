# W2 계정 저장 정합성 독립 검수

## 판정

**REQUEST_CHANGES: 독립 승인하지 않음.** 실제 합성 재현 결함은 F01(P1), F03(P2)이다. F02(P2)는 서버 날짜 검사와 DB 저장 사이의 공백이 날짜 전환 모형에서 재현됐지만, 실제 PostgreSQL 다중 세션 잠금 대기는 재현하지 않았으므로 의심으로 구분한다. 수정과 수정 후 재검사는 부모 작업자가 수행한다.

- 대상 커밋: `41653801faeb2d069e83c2def694e3c301944cac`.
- 시작 시 HEAD가 대상 커밋과 일치했다. 최종 확인에서 검수 대상 W2 코드와 서버 검증 번들은 이 커밋 대비 차이가 없었다.
- 먼저 읽은 지침: `AGENTS.md`, `PRODUCT_NORTH_STAR.md`, `WORK_ORDER_PERSONA_REVIEW_REMEDIATION_2026-09-30.md`, `specs/reconstruct/ALL_WORKOUT_CALCULATION_AND_BINDING_CONTRACT.md` §8.
- 제품 파일, Git, 네트워크, 배포, 운영 데이터, 인증정보에는 쓰기/요청/접근하지 않았다. 생성물은 이 보고서와 같은 `.scratch/remediation-independent-v2/` 폴더에만 있다. 합성 키와 계정 식별자는 실제 인증정보가 아니다.
- 요청된 검수 명칭은 GPT6.1 Sol 최고추론 독립 검수이다. 이 세션의 실제 모델 ID와 추론 설정을 독립 조회하는 도구가 없어, 특정 모델 실행 설정 자체를 검증했다고 주장하지 않는다.
- 부모가 수정한 CatalogWorkoutPicker 2건과 회귀 10건은 본 검수 수치와 승인 근거에 포함하지 않았다.
- 기본 자동 처방 강도/시간 정책(W1)은 오너 결정 대기이다. 변경안이나 승인 대상으로 취급하지 않았다.

## F01 / P1 / 실제 결함

### 보관하는 이전 계획의 진행 결과를 같은 교체 요청에서 지워도 통과함

**정확한 원인 위치**

- [account-plan-document-schema.ts:165](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/domain/account/account-plan-document-schema.ts:165>): 165~166줄은 이전 현재 계획의 진행 결과와 새 현재 계획의 진행 결과만 비교한다. `next` 안에 보관되는 이전 계획 항목의 진행 결과는 비교하지 않는다.
- [account-plan-collection-schema.ts:103](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/domain/account/account-plan-collection-schema.ts:103>): 103~105줄은 스냅샷 보존과 갱신 시각을 확인하지만, 이전에 아직 보관되지 않았던 항목은 진행 결과 변경을 허용한다.
- [account-plan-collection-handler.mjs:224](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/supabase/functions/_shared/account-plan-collection-handler.mjs:224>): 위 검증을 통과한 요청이 267줄의 guarded commit까지 도달한다.
- [0037_account_plan_collection.sql:312](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/supabase/migrations/0037_account_plan_collection.sql:312>): 312~315줄도 이전부터 보관된 항목의 참조 불변성만 강제한다. 이번에 보관되는 항목의 암호화된 진행 결과 내용은 직접 비교하지 않는다. 이 부분은 정적 확인이지 SQL 실행 증거가 아니다.

**최소 재현과 관측**

1. 유효한 기준 계획에 1일차 `AM / COMPLETED` 결과 1건을 둔다.
2. 미기록 미래 4일차 AM을 정상 카탈로그 구성으로 바꾼다. 새 현재 계획에는 기존 완료 결과 1건을 그대로 둔다.
3. 같은 요청의 이전 계획 보관 항목에서만 `progress`를 빈 배열로 바꾼다. 원본 스냅샷, 변경 영수증, 전체 지문, 일지 버전은 나머지 정상 값을 사용한다.
4. 도메인 검증과 실제 서버 검증 번들 모두 `true`, 원본 서버 처리기는 메모리 저장소에서 HTTP 200 / `committed` / revision 2를 반환했다.

관측값은 `oldCompletedBefore=1`, `oldCompletedAfter=0`, `currentCompletedAfter=1`이다. 과거 처방 스냅샷과 일지 원문 삭제를 재현한 것이 아니라, **보관된 원본의 진행 결과 삭제 허용**을 재현했다. 현재 정상 SELECT 클라이언트는 이전 결과를 유지하므로 일반 UI에서 저절로 삭제된다는 증거도 아니다. 서버가 잘못 조합된 요청을 거절하지 못하는 계약 결함이다.

**최소 수정 방향**

수동 교체 전이에서 `next`의 이전 현재 계획 항목을 찾아 `previous`의 같은 항목과 진행 결과를 정확히 비교한다. 보관 시간만 새로 붙이고 원본 스냅샷과 진행 결과는 고정해야 한다. 일반적인 현재 계획 PROGRESS 수정까지 전면 금지하지 말고, 교체와 보관이 함께 일어나는 전이에 한정한다. 서버 검증 번들도 같은 소스 기준으로 갱신한다.

**재검사 기준**

`F01`은 거절되어 PASS로 바뀌고 `C01` 정상 교체는 유지되어야 한다. 삭제뿐 아니라 완료→건너뜀, 통증 결과 제거도 같은 보존 조건으로 검증해야 한다. 기존부터 보관된 원본 보호 대조군 `C02`도 유지한다.

## F02 / P2 / 의심

### DB 저장 대기 구간에서 날짜가 바뀌면 서버의 사전 날짜 검사가 무효가 될 수 있음

**정확한 원인 위치**

- [account-plan-collection-handler.mjs:266](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/supabase/functions/_shared/account-plan-collection-handler.mjs:266>): 마지막 달력 날짜 검사는 DB RPC를 호출하기 직전이다. 267줄의 `await repo.commitReplan(...)` 이후 DB 선형화 지점에 날짜 검사가 없다.
- [0040_execution_replan_journal_guard.sql:25](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/supabase/migrations/0040_execution_replan_journal_guard.sql:25>): 소유자 advisory lock에서 대기할 수 있다. 30~32줄의 기존 영수증 처리 뒤, 42~49줄은 일지 버전 검사와 기존 저장 함수 호출만 수행한다. `today`, `timeZone`, 대상 훈련 날짜가 DB 요청에 전달되거나 잠금 획득 후 대조되지 않는다.

**실행 증거와 경계**

`F02`는 실제 서버 처리기에 주입한 메모리 `commitReplan` 대기 모형이다. 사전 검사가 통과한 후, 저장소 훅에서 합성 시각을 `2026-09-29T15:00:00.000Z`로 바꿨다. `Asia/Seoul`에서는 9월 30일이 되어 `catalogReplacementClockIsCurrent=false`이지만, 요청은 `committed` / revision 2로 끝났다.

이는 **DB 대기 중 날짜 전환 모형**이며 실제 DB 잠금 대기, 실제 대기 시간, PostgreSQL 다중 세션 경쟁은 실행하지 않았다. 모형은 합성 시각을 강제로 바꾸며 DB 서명 만료까지 구현한 모형도 아니다. 이 표본의 대상 4일차는 10월 1일이므로, 실제 오늘 슬롯 변경을 관측했다고 주장하지 않는다. 선택 날짜와 서버 현재 날짜 불일치가 저장 직전에 차단되지 않는 구조를 확인했다.

SQL의 서명 유효기간 검사는 달력 날짜 검사와 별개이다. 현실의 자정 직전→직후 전환은 서명 유효기간 안에도 생길 수 있지만, 이 구체적인 다중 세션 경로는 미실행이다.

**최소 수정 방향**

검증된 교체의 달력 시간대, 선택 날짜, 대상 날짜를 서명된 DB 요청에 묶는다. 소유자 잠금을 얻고 기존 동일 작업 영수증을 먼저 처리한 뒤, 신규 적용에 대해서만 DB 현재 시각으로 선택 날짜 동일성과 대상 날짜의 미래 여부를 검사한다. 기존 영수증 재조회는 다음 날에도 막지 않아야 한다. 실제 도입 시에는 과거 적용된 마이그레이션 파일을 소급 수정하는 대신 저장소의 마이그레이션 규칙을 따른다.

**재검사 기준**

`F02` 모형은 날짜 불일치로 거절되고, `C05` 이미 커밋된 영수증 재조회와 `C06` 미커밋 자정 이후 거절은 유지되어야 한다. 별도 후속 검사로 실제 PostgreSQL 두 세션에서 같은 owner lock을 잡고, 날짜 경계를 넘긴 뒤 해제하는 테스트가 필요하다. 그 테스트 전에는 실제 DB 경쟁 검증 완료로 승격하지 않는다.

## F03 / P2 / 실제 결함

### 커밋 후 응답 형식 오류가 저장 불명 대신 INVALID/blocked로 분류됨

**정확한 원인 위치**

- [account-plan-collection-api.ts:67](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/domain/account/account-plan-collection-api.ts:67>): 67~68줄은 응답 스키마 실패를 `INVALID`로 변환한다.
- [account-plan-collection-transfer.ts:165](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/domain/account/account-plan-collection-transfer.ts:165>): 커밋 시작 후 오류는 올바르게 `outcome_unknown`으로 반환한다.
- [account-plan-collection-service.ts:266](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/domain/account/account-plan-collection-service.ts:266>): 266~267줄은 하위의 `outcome_unknown`보다 transportError의 `INVALID` 분류를 우선시해 `failure()`로 보낸다.
- [catalog-replacement-store.ts:75](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/domain/catalog-replacement-store.ts:75>): `ACCOUNT_PLAN_PENDING`만 `uncertain`이며 `ACCOUNT_PLAN_INVALID`는 `blocked`가 된다.

**최소 재현과 관측**

실제 collection 서비스와 합성 저장소를 사용했다. 저장소가 정상 커밋과 영수증 기록을 마친 뒤, API가 발생시키는 것과 같은 `code: INVALID` 오류를 반환했다. 결과는 `INVALID`, 서비스 상태도 `INVALID`였다. 그러나 합성 서버는 이미 revision 2, commit 1회였다. 이후 `hydrate()`는 동일 영수증으로 READY를 복구했고 추가 커밋은 없었다.

API 응답 파서 자체에 실제 네트워크 응답을 넣은 E2E는 실행하지 않았다. 오류 생성 경로는 정적 근거, 생성된 동일 오류에 대한 서비스 처리와 복구는 실행 근거이다. 따라서 데이터 손실이나 실제 이중 적용을 관측했다고 주장하지 않는다. **불명 응답을 잘못 분류하는 결함**이며, 재조회 복구 경로 자체는 작동했다.

**최소 수정 방향**

서비스의 `flush()`가 `result.kind === 'outcome_unknown'`을 원본 transportError 분류보다 먼저 처리하여 PENDING을 유지하도록 한다. 저장 전 확정된 입력 오류와 커밋 이후 확인 불명은 구분한다. 고정 operation ID와 outbox를 보존하고 재조회로만 정리하며, 새 작업으로 자동 재적용하거나 기기 저장으로 우회하지 않는다.

**재검사 기준**

`F03`의 최초 결과가 PENDING/uncertain으로 바뀌고 커밋 횟수는 1회를 유지해야 한다. 후속 `hydrate()`가 READY를 복구하고, 일반 응답 유실 대조군 `C10`도 유지되어야 한다. 부모 후속 검사에는 실제 API의 잘못된 응답 스키마 입력도 포함해야 한다.

## 실행 결과

- 실행기: Node `v24.11.1`, 설치된 esbuild로 메모리 번들 생성. 제품 번들을 디스크에 쓰거나 새 의존성을 설치하지 않았다.
- 고유 합성 검사 **13건: 10 PASS / 3 FAIL**, UTC와 Asia/Seoul에서 동일했다. 2회 실행을 26개의 서로 다른 검사로 합산하지 않는다.
- FAIL은 F01, F02, F03의 기대 불변식 위반이다. F02의 증거 지위는 위 설명대로 모형 수준이다.
- PASS: 정상 단일 슬롯 교체, 이전부터 보관된 원본 보호, 기록된 대상 거절, 읽기 뒤 일지 revision 변경 충돌 모형, 다음 날 동일 영수증 재조회, 미커밋 자정 이후 거절, SINGLE/미지정 및 다른 날짜 연결 보호, 연속 수동 교체, 이후 수행 기반 조정 전이, 응답 유실 뒤 재조회 복구.
- 실제 PostgreSQL 엔진(PGlite)로 추가 확인을 시도했으나 stage 준비 경로에서 HTTP 503이 나와 정상 대조군부터 성립하지 않았다. `SQL-C01`, `SQL-F01`, `SQL-C02`는 실행 준비 실패이며 제품 결함 3건 추가나 SQL 저장 재현으로 세지 않는다. 최신 사용자 지시에 따라 더 이상 원인 탐색/범위 확장을 하지 않았다.
- 초기 합성 실행기의 전역 crypto/빈 spy 보정 오류는 허용된 테스트 파일에서만 고쳤다. 최종 UTC/KST 증거에는 이 실행기 오류가 남지 않았다.
- 기존 제품 검사 통과 수치와 이전 완료 보고서의 수치는 재실행/합산/승인 근거로 사용하지 않았다.

## 재검사 명령

PowerShell에서 아래 두 실행을 사용한다. 제품 코드 수정 전에는 현재 발견 3건 때문에 각 실행이 종료 코드 1을 반환하는 것이 정상이다. 수정 후 종료 코드 0만으로 전체 제품/운영 승인을 주장하지 않는다.

```powershell
Set-Location -LiteralPath 'D:\admin\Documents\ChatGPT\트레인 오라클\TRAINORACLE-oracle-exploration-20260921'
$env:REVIEW_LOCAL_SQL='0'
$env:REVIEW_OUTPUT_TAG='parent-recheck'
$env:TZ='UTC'
node .scratch/remediation-independent-v2/independent-account-review.mjs
$env:TZ='Asia/Seoul'
node .scratch/remediation-independent-v2/independent-account-review.mjs
```

`F02`는 DB가 날짜를 검사하는 변경 후 요청 전달 계약에 맞춰 합성 저장소도 갱신해야 한다. 현재 합성 저장소는 SQL 내부의 새 검사를 자동 실행하지 않으므로, 이 명령만으로 향후 DB 수정의 효과까지 검증하지는 못한다. 위 명령은 `results-utc-parent-recheck.json`, `results-kst-parent-recheck.json`에 기록하여 이번 원본 증거를 보존한다.

## 증거와 잔여 범위

- 합성 테스트: [independent-account-review.mjs](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/.scratch/remediation-independent-v2/independent-account-review.mjs>).
- 최종 UTC: [results-utc.json](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/.scratch/remediation-independent-v2/results-utc.json>).
- 최종 KST: [results-kst.json](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/.scratch/remediation-independent-v2/results-kst.json>).
- SQL 시도 기록, 유효한 SQL 결론 아님: [results-kst-sql.json](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/.scratch/remediation-independent-v2/results-kst-sql.json>).

미실행/미승인 범위: 실제 PostgreSQL 다중 세션 경쟁, 실제 브라우저 IndexedDB/Web Locks, 실제 API의 잘못된 ACK 응답 E2E, 실제 다음 주기 전체 전이, 운영 계정/서비스/배포, 전체 페르소나 재검수. 이번 합성 범위에서 추가 결함이 없었던 보호 경로를 전체 기능 무결함으로 확대하지 않는다. 제품 수정과 수정 후 독립 승인도 아직 수행하지 않았다.
