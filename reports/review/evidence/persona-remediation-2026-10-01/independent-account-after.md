# F01/F03 독립 재검수와 F02 정적 검토

## 판정과 범위

**F01/F03: 이번 로컬 합성 실행 범위에서 수정 승인. 기존 결함 재현이 차단되고 새로운 차단 결함은 발견하지 못했다.** 이 판정은 F01/F03 두 건의 현재 수정본에 한정한다. W2 전체, 운영 계정 저장, 배포, F02의 DB 실행을 승인한 것이 아니다.

**F02: 추가로 허용된 정적 공격 검토만 수행. 새 차단 결함은 발견하지 못했지만 독립 SQL 실행/경쟁 검증 승인은 하지 않는다.** 부모가 보고한 PGlite 통과와 서버 23/23은 사용자 제공 정보이며 이번 독립 실행 수치에 합산하지 않는다.

- 기준 HEAD는 여전히 `41653801faeb2d069e83c2def694e3c301944cac`이다. 검수 대상은 이 HEAD 이후의 **현재 작업 폴더 수정본**이며, 원래 커밋이 수정됐거나 새 수정 커밋이 존재한다고 주장하지 않는다.
- `AGENTS.md`, `PRODUCT_NORTH_STAR.md`, 개선 작업지시서, 전체 훈련 계산·연결 계약 §8을 확인했다. 이전 독립 보고서는 과거 증거로만 사용했다.
- 제품/생성 validator/Git을 수정하지 않았다. 외부 요청, 실제 인증정보/운영 데이터 접근, SQL/PGlite 실행은 없다. 생성물은 기존 허용 폴더 안의 새 테스트·새 JSON·이 새 보고서뿐이다.
- 자동 기본 강도/시간 정책(W1)은 계속 오너 결정 대기이며 이번 승인과 무관하다.

## F01: 보관 원본 고정

**코드 근거:** [account-plan-document-schema.ts:160](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/domain/account/account-plan-document-schema.ts:160>)의 160~162줄은 다음 문서의 이전 항목을 찾고, 보관 시각을 null로 되돌린 전체 항목 지문을 이전 항목과 정확히 비교한다. 진행 결과뿐 아니라 `updatedAt`, 스냅샷 등 나머지 내용도 고정한다. 이미 보관된 이전 항목은 159줄에서 차단된다.

독립 실행은 입력 전체를 다시 해시한 유효한 collection을 사용했다. 단순히 깨진 지문이나 잘못된 날짜 형식 때문에 거절되는 테스트가 아니다.

| 검사 | 실제 관측 |
|---|---|
| `F01-CONTROL` | `archivedAt`만 다른 정상 교체를 소스와 생성 validator가 모두 허용. 원본 서버 처리기+합성 암호화 저장소에서 200/committed |
| `F01-DELETE` | 보관 항목의 진행 결과 삭제를 소스/생성 validator가 모두 거절. 서버 422/INVALID_DOCUMENT_UPDATE |
| `F01-CHANGE` | 완료 결과를 SKIPPED로 변경한 보관 항목을 같은 경로에서 거절 |
| `F01-UPDATED_AT` | 보관 항목의 updatedAt 변경을 거절. archivedAt도 뒤로 옮겨 시간 순서 자체는 유효하게 둔 표본 |
| `F01-PROGRESS-CONTROL` | 교체가 아닌 현재 계획의 정상 PROGRESS 수정은 ACCOUNT로 저장됨 |

세 거절 표본은 모두 초기 저장 1회 이후 추가 guarded commit 호출 0회, revision 1 유지였다. 원본 스냅샷/결과 보호가 실제 서버 처리기에서 저장 전에 작동했다. 합성 저장소는 SQL 엔진이 아니므로 DB 내부 거절을 직접 실행했다고 주장하지 않는다.

생성 validator도 동일한 거절/허용을 보였고, 별도로 `node app/scripts/build-account-plan-collection-validator.mjs --check`가 종료 코드 0, `check=true`, 1,301,332 bytes를 반환했다. 생성 스크립트는 check 모드로만 실행했고 제품 번들을 쓰지 않았다.

## F03: 불명 ACK와 동일 작업 재조회

**코드 근거:** [account-plan-collection-service.ts:261](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/domain/account/account-plan-collection-service.ts:261>)의 261~265줄은 `outcome_unknown`과 `INVALID`/`INVALID_RESPONSE` 조합을 일반 transport 오류 처리보다 먼저 PENDING으로 유지한다. [catalog-replacement-store.ts:75](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/domain/catalog-replacement-store.ts:75>)의 기존 PENDING→uncertain 연결과 정합하다. 교체 store 호출 자체의 브라우저 E2E를 이번에 추가 실행한 것은 아니다.

| 검사 | 실제 관측 |
|---|---|
| `F03-INVALID` | 합성 서버 커밋 후 `code=INVALID` 오류에도 PENDING 유지 |
| `F03-INVALID_RESPONSE` | 커밋 후 `code=INVALID_RESPONSE`에도 PENDING 유지 |
| `F03-API_BAD_ACK` | 실제 collection API 응답 파서에 불완전한 committed 응답을 전달. 실제 파서가 만든 INVALID 오류도 서비스가 PENDING으로 보존 |
| `F03-BAD_RECEIPT` | 전송 계층이 잘못된 영수증을 직접 받은 표본도 PENDING 유지 |
| `F03-LOST_ACK` | 일반 응답 유실 대조군도 PENDING 유지 |
| `F03-PRECOMMIT-CONTROL` | 저장 전 stage의 확정 INVALID는 INVALID 유지, commit 0회. 확정 입력 오류를 전부 PENDING으로 숨기지 않음 |
| `F03-SUCCESS-CONTROL` | 정상 ACK는 ACCOUNT/READY, commit 1회로 끝남 |

첫 다섯 표본 모두 다음 관계를 직접 단언했다.

1. 합성 서버는 revision 2, commit 1회였지만 확인 전 클라이언트에는 기존 계획이 남는다.
2. outbox에는 원래 operation ID `d4444444-4444-4444-8444-444444444444`가 그대로 남는다.
3. 확인 전 다시 SELECT를 호출하면 STALE이며 추가 커밋이 없다.
4. `hydrate()`가 동일 영수증을 회수해 READY와 새 계획을 복구하고, pending을 정리한다.
5. 최종 커밋 횟수는 계속 1회이다.

`F03-API_BAD_ACK`는 실제 API 파서→실제 서비스의 로컬 연결 검사다. SDK 호출은 합성 함수, 세션도 가짜 값이며 네트워크/실제 계정/브라우저는 사용하지 않았다.

## 독립 실행과 민감도

- Node `v24.11.1`, 설치된 esbuild의 `write:false` 메모리 번들을 사용했다. 실제 인증 모듈은 차단 대체물로 분리했다.
- 고유 검사 **12건 모두 PASS**, UTC와 Asia/Seoul에서 각각 같은 결과. 이를 24개의 고유 검사로 합산하지 않는다.
- 제품 파일을 수정하지 않고 새 두 방어문만 메모리에서 제거했다. 아래 **5개 이름**이 예상대로 실패했다. 두 시간대에서 동일했으며 이를 10개의 고유 결함 주입 검사로 합산하지 않는다.
- F01 제거: `F01-DELETE`, `F01-CHANGE`, `F01-UPDATED_AT`.
- F03 제거: `F03-INVALID`, `F03-API_BAD_ACK`.
- 실행 중 관찰한 네 제품 파일의 SHA256은 전후 동일했다. 이전 보고서, 이전 실행기, UTC/KST/SQL시도 JSON 다섯 파일도 전후 지문이 동일했다. 이번 결과는 새 JSON에 기록됐다.
- 외부 fetch 호출은 0건, 차단된 호출도 0건이다. 부모 회귀 8건과 이전 검수 13건을 이번 결과에 합산하지 않았다.

검수한 수정본 식별 지문:

| 파일 | SHA256 |
|---|---|
| account-plan-document-schema.ts | `87e2577835c61bd1855272849b510ba06afbac341be8fb4b7c71c8c503cc32db` |
| account-plan-collection-service.ts | `216b354d5ea64358cf06725b67d7e77792eb7d6f0008d3d66b52c8e115f6ef1b` |
| 생성 account-plan-collection-validator.mjs | `14a3666c4f975264869d5c0e1660f726f4f69903479c071d6aa314ebbd78aab4` |
| account-plan-collection-handler.mjs | `2d31bfd1588bbe803be47aecdf0d8fa359e283739df304f313e8c655421b9573` |

## F02: 정적 공격 검토만

새 SQL 지문: `5fd2edfa153bb650da73d01cfb9f98473fec1c2a564bef0da61f7d6b437f1730`.

| 정적 확인 대상 | 파일:줄과 판단 |
|---|---|
| 달력 값 변조/구 경로 선택 | [handler:267](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/supabase/functions/_shared/account-plan-collection-handler.mjs:267>) 267~269줄은 검증된 영수증의 today/timeZone을 사용. [repository:321](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/supabase/functions/_shared/account-plan-collection-handler.mjs:321>)은 calendarGuard 존재 시 전용 RPC를 선택하고 전체 입력을 attest에 전달 |
| 서명/소유자/입력 누락 | [0041:13](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/supabase/migrations/0041_catalog_replacement_calendar_guard.sql:13>) 13~26줄은 HMAC, owner, domain/action, calendar의 정확한 두 키와 타입/시간대를 확인. `account_plan_exact`는 NULL을 false로 바꿔 누락을 허용하지 않음 |
| 잠금 대기 후 검사 | [0041:28](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/supabase/migrations/0041_catalog_replacement_calendar_guard.sql:28>)은 기존 owner lock과 같은 키를 획득. 37~39줄은 잠금 후 `clock_timestamp()`로 달력 날짜 검사 |
| 기존 receipt 우선/다른 작업 재사용 | [0041:33](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/supabase/migrations/0041_catalog_replacement_calendar_guard.sql:33>) 33~35줄은 영수증 우선 처리. 중첩 0040→0037의 request fingerprint/document 비교는 유지되므로 영수증 존재만으로 다른 요청을 승인하는 구조는 아님 |
| nested 저장 중 날짜 전환 | [0041:40](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/supabase/migrations/0041_catalog_replacement_calendar_guard.sql:40>) 40~44줄은 기존 guarded 저장 후 다시 날짜 검사. 예외를 잡아 성공으로 바꾸는 SQL 처리문이 없으므로 호출 트랜잭션의 index/receipt 변경을 함께 취소하는 구조로 판단 |
| 에러 전달 | [repository:300](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/supabase/functions/_shared/account-plan-collection-handler.mjs:300>)에서 PT409를 보존하고 [handler:287](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/supabase/functions/_shared/account-plan-collection-handler.mjs:287>)에서 409/PLAN_DATE_CHANGED로 전달 |

**이 표는 소스의 제어 흐름 검토다. 실제 DB 서명 거절, SQL 롤백, 오래된 날짜 receipt 회수, PostgreSQL 다중 세션 대기는 이번에 실행하지 않았다.** 부모가 제공한 실제 PGlite 쿼리/결함 주입 결과는 별도의 사용자 제공 증거이며 여기서 독립 재현했다고 승격하지 않는다. F02의 최종 독립 승인 여부는 평가하지 않는다.

## 증거와 재실행

- [새 합성 실행기](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/.scratch/remediation-independent-v2/independent-f01-f03-recheck-v1.mjs>)
- [새 UTC 결과](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/.scratch/remediation-independent-v2/f01-f03-recheck-v1-utc.json>)
- [새 KST 결과](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/.scratch/remediation-independent-v2/f01-f03-recheck-v1-kst.json>)

재실행은 원본 증거를 덮어쓰지 않는 새 출력 이름을 지정한다. 생성 validator는 check 모드만 사용한다.

```powershell
Set-Location -LiteralPath 'D:\admin\Documents\ChatGPT\트레인 오라클\TRAINORACLE-oracle-exploration-20260921'
$env:RECHECK_OUTPUT_TAG='next-run-01'
$env:TZ='UTC'
node .scratch/remediation-independent-v2/independent-f01-f03-recheck-v1.mjs
$env:TZ='Asia/Seoul'
node .scratch/remediation-independent-v2/independent-f01-f03-recheck-v1.mjs
node app/scripts/build-account-plan-collection-validator.mjs --check
```

동일 출력 이름이 이미 있으면 덮어쓰지 않고 EEXIST로 멈춘다. 이 실행기는 F02와 SQL을 실행하지 않는다.

잔여 한계: 실제 브라우저 IndexedDB/Web Locks, 실제 서비스/계정/SDK 네트워크, SQL 트랜잭션과 다중 세션 경쟁, 전체 다음 주기 전이, W2 전체 검수/운영 배포는 미검증이다. 모델 ID/최고추론 설정 자체도 별도로 확인하지 않았다. 이 새 보고서는 과거 보고서의 역사적 결론을 덮어쓰지 않고 **F01/F03의 현재 좁은 판정만 갱신**한다.
