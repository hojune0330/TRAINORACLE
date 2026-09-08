# OPERATING_AUTH_SYNC_COROS_READINESS_2026-09-08.md

## 인증·동기화·COROS 운영 준비 검토 패킷

> 시점 구분: 메타데이터는 후속 결과를 반영한다. §1~8의 코드 미수정·시험 미실행 표기는 최초 읽기 전용 조사 범위에 한정한다. 이후 오너가 승인한 SYNC-I02 코드/합성 시험 수정 및 현재 운영 관측 보완은 §9에 기록한다. 현재 수정·시험 결과는 §9가 우선하며, 최초 관측을 현재 결함 상태로 재사용하지 않는다.

```yaml
doc_id: trainoracle-operating-auth-sync-coros-readiness-20260908
version: "1.1"
status: READINESS_REVIEW_DRAFT
baseline_head: 7fb7dc12dfefe013ca60fb0ac98876cf390a56da
evidence_mode: LOCAL_RUNTIME_AND_PARENT_DASHBOARD_RECEIPT
owner_direction: ALL_EIGHT_RECOMMENDATIONS_APPROVED_IN_CURRENT_TASK
initial_read_only_review_runtime_tests: 0
followup_agent_runtime_unique_tests: 50
followup_agent_timezone_runs: 2
external_state_evidence: PARENT_READ_ONLY_DASHBOARD_RECEIPT
production_changes: false
canonical_promotion: false
```

## 1. 판정과 작업 경계

**오너 방향은 결정되었다. 남은 것은 구현·검증·외부 조건 확인이지 방향 승인 재요청이 아니다.** 최종 도입부 확인 시 체크포인트 v1.1은 `OWNER_APPROVED_DIRECTIONS_IMPLEMENTATION_IN_PROGRESS`, `owner_decisions_applied_by_this_document: true`이고 권장안 A 8개 승인을 기록한다. 승인 실행 등록부도 `OWNER_APPROVED_EXECUTION_REGISTER`로 존재한다. 이 문서는 해당 승인 기록을 인용하며 부모의 승인 정본 수정을 중복 수행하지 않는다.

근거: `reports/review/OWNER_DECISION_AND_OPERATION_READINESS_CHECKPOINT_2026-09-08.md:7`, `:8`, `:10`, `:19`, `:54`; `reports/review/OPERATING_APPROVAL_EXECUTION_REGISTER_2026-09-08.md:6`, `:13`, `:21`, `:25`, `:26`, `:30`. `file:line`은 위 HEAD를 기준으로 작업 중 직접 읽은 로컬 파일의 위치다. 승인 문서는 부모가 갱신한 작업 사본을 다시 읽었다. 이후 부모의 코드 수정은 수정 전 관측과 구분하며, 변경된 원본의 줄 위치와 시험 결과는 부모가 최신 인계에서 확인한다.

- 이 작업이 만든 파일은 본 문서 하나다. 코드·명세 원본·마이그레이션·승인 원장·PR·CI·훈련 채택 자료는 수정하지 않았다.
- 루트 `AGENTS.md`와 `PRODUCT_NORTH_STAR.md`, 관련 계약을 읽었다. `reports/` 하위에서 별도 `AGENTS.md`는 발견하지 않았다.
- 자격증명/환경 비밀 파일, 사용자 데이터, 공급자 계정, 운영 콘솔에 접근하지 않았다. 네트워크 요청, 로그인, DB 적용, 실제 시험, 유료 계약, 게시·배포를 하지 않았다.
- 시작 시 미추적 `.vite/`, `app/tsconfig.tsbuildinfo`, 기존 체크포인트를 보존했다. 과거 PASS 영수증은 현재 실행 결과로 복제하지 않았다.

**현재 판정:** 문서와 로컬 구현을 대조한 준비 자료는 제공 가능하다. DB V6 운영 적용, 실제 두 계정·두 기기 왕복, COROS 실제 연결 성공은 이 작업에서 입증되지 않았다. 아래 검사 관문을 열어 두며, 미검증을 실패 실측이나 기능 부재로 바꾸어 표현하지 않는다.

## 2. 승인·구현·외부 상태 분리

| 항목 | 승인된 범위 | 현재 소스에서 확인한 구현 | 미검증 또는 후속 관문 |
|---|---|---|---|
| 계정 | Google·이메일 안정화 후 카카오, 이후 Apple·AthleteTime. 문자·토스·네이버는 조건 검토 후 | 이메일 확인 링크와 Google/Kakao OAuth 래퍼, 전화 OTP 준비 코드. `app/src/domain/account/auth.ts:55`, `:83`, `:116`; Kakao/전화 별도 플래그 `app/src/domain/account/config.ts:48` | 실제 제공자 설정·메일 도착·반송/제한·현재 배포 상태. 전화 코드 존재는 SMS 운영 증거 아님 |
| 가입·나이·동의 | 14세 미만 온라인 계정 미제공은 유지. 청소년의 기존 로컬 훈련 사용 승인을 취소하지 않음 | 나이 판정·동의 재검증 `app/src/domain/account/auth-onboarding.ts:26`, `:138`; 서버 계정 소유·나이·삭제 요청·동의 경계 `supabase/migrations/0028_under_14_online_account_gate.sql:29` | 실제 OAuth 호출 전 나이 차단, 다른 기기 동의 복원, 프로필 확정 실패·탈퇴 후 접근 시험 |
| 구조화 일지 동기화 | 계정 로그인과 별개로 종류 안내·동기화 선택·미리보기·확인. 원문 메모 전송 금지 | 계정별 동의 `app/src/domain/account/sync-local.ts:31`; 세션 일치·동의·스키마 검사 `app/src/domain/account/sync-run.ts:39`; `shareTrainingNotes=false`와 `recoveryCode=null` 강제 `:50`, `:89`; tombstone 왕복 `:93`, `:183` | 실제 A/B 격리, A의 두 기기 복원·삭제·충돌·중단 복구. 메모 암호문 동기화도 첫 베타에서는 닫힘 |
| 계획 서버 저장 | 이미 승인된 구현 방향. 저장 성공과 훈련 실행 권한은 별개 | V3 백업 `app/src/domain/account/plan-cloud-backup.ts:27`; V6 불변 스냅샷 백업·계정 검증 `app/src/domain/account/multi-plan-cloud-backup-v3.ts:65`; V6 DB 준비 `supabase/migrations/0032_multi_adjusted_plan_snapshots.sql:4` | 실제 DB 0032 적용, V3/V6 공존, V6 지문·시각 왕복, 보관·삭제와 다른 기기 복원 |
| V6 복원 | 원본 조회·보관함 추가·현재 일정 복원은 서로 다른 행동 | 조회 결과 `read_only`, `executionAuthority: NONE`, `NOT_RESTORED` (`app/src/domain/account/multi-plan-cloud-backup-v3.ts:59`); 보관함 추가는 별도 확인 (`:14`); 현재 일정 복원 UI도 별도 몸 상태·명시 확인 (`app/src/screens/plan-beta/MultiPlanCloudControlsV3.tsx:60`) | 현재 검토 근거가 없거나 철회된 경우의 실행 차단 및 실제 새 기기 전체 경로. 역사 읽기를 신규 채택으로 취급 금지 |
| COROS 첫 시험 | 소수 동의 사용자, 직접 가져오기, 최소 활동 정보, 확인 후 일지 연결 | callback 인증 시도는 HTTP 409 (`supabase/functions/coros-oauth-callback/index.ts:18`); Partner push 정규화·수신 준비와 기본 OFF DB; 오프라인 정규화 계약만 있음 (`app/src/domain/import/prepared-device-activity.ts:29`) | 서버 MCP client, 실제 OAuth·암호화 토큰·공급자 계정 매핑, 확인함 API/UI, 중복·수정·철회·삭제의 통합 경로. 플러그인 개인 연결은 제품 구현을 대신하지 않음 |
| 비용·통계·공유 | 항목별 월 예상액·상한 보고 후 유료 계약. 최소 행동 통계와 선택 글 링크 공유 방향 승인 | 이 패킷은 관련 코드/배포를 검수하지 않음 | 비용 상한 없는 계약 금지. 통계로 활동 수치·메모·위치 전송 금지. 부모의 별도 작업으로 인계 |

서버 저장 단계의 근거는 `reports/implementation/ACCOUNT_TRAINING_DATA_SYNC_SCOPE_DECISION_2026-08-26.md:14`, `:20`, `:21`, `:22`, `:108`이다. 단계 2의 선수 기록·꾸미기 서버 왕복은 본 조사에서 새로 구현 완료를 입증한 범위가 아니며, 계정별 로컬 저장을 서버 동기화로 재분류하지 않는다.

계정 공개는 과거에 이미 실행된 기록이 있다. `docs/ACCOUNT_PUBLIC_RELEASE_GATE.md:34`부터의 2026-08-26 기록은 당시 Google·이메일 왕복과 계정 전용 공개를 기술한다. 이를 현재 재실행 PASS로 사용하지도, 계정 방향 미승인으로 되돌리지도 않는다.

### 2.1 이메일 공개 준비: 오너 수신 성공과 일반 사용자 수신은 다르다

부모 작업이 이번 검토 중 직접 확인해 전달한 [Supabase 공식 SMTP 안내](https://supabase.com/docs/guides/auth/auth-smtp)에 따르면 기본 SMTP는 프로젝트 팀에 속하지 않은 이메일 주소로 발송을 거부한다. **오너/프로젝트 팀 주소의 링크 수신 PASS는 일반 사용자 이메일 공개 베타 준비 완료의 증거가 아니다.** 이 sidecar는 웹을 재조회하지 않았으며, 링크는 부모가 확인한 공식 자료로 인용한다.

최초 조사에서는 `reports/operations/AUTH_PROVIDER_CONNECTION_STATUS_2026-08-25.md:25`의 당시 `custom SMTP 없음`과 `:87`의 후속 관문만 확인했으며 현재 콘솔은 미검증이었다. 이후 부모의 2026-09-08 읽기 전용 관측으로 **현재 custom SMTP 미설정은 확인되었다**. 근거는 [운영 대시보드 관측 영수증](OPERATING_DASHBOARD_OBSERVATION_2026-09-08.md)의 14행이며, 본 sidecar의 독립 콘솔 접속 결과가 아니다. 일반 비팀 수신자 도달성·SMTP 공급자 설정·발신 도메인 검증은 완료되지 않았다. §9.3에서 현재 후속 관문을 구분한다.

| 검사 | 다음 실행 | 합격 증거 |
|---|---|---|
| EMAIL-OPS-01 | 승인된 담당자가 현재 Supabase SMTP/provider 설정을 비밀값 없이 확인 | custom SMTP 사용 여부, 발신 도메인 검증 상태, 발송 제한, 정확한 확인 시각. 키·비밀번호·개인 주소를 보고서에 복사하지 않음 |
| EMAIL-OPS-02 | 프로젝트 팀에 속하지 않은 동의한 시험 수신자에게 신규 가입/재로그인 링크 발송 | 실제 도착·링크 복귀·서버 사용자/동의 완료. 오너 주소 재시험 또는 테스트 수신자를 프로젝트 팀에 추가하는 우회로 대체 금지 |
| EMAIL-OPS-03 | 발송 거부·반송·rate limit·만료/재사용 링크·재전송을 시험 | 성공 문구만으로 완료하지 않음. 오류 안내와 복구 가능, 중복 계정 방지, 민감한 메일/URL 없이 상태·건수 영수증 |
| EMAIL-OPS-04 | 유료 SMTP가 필요하면 공급자별 월 예상액·상한·남용/비용 경보·고지를 준비 | 오너의 항목별 계약 승인 후 별도 설정·실수신 시험. 승인된 Google/이메일 방향을 다시 묻지 않으며 비용 승인 전 계약/결제 금지 |

운영사업자 정보도 같은 방식으로 시점을 구분한다. 공개 게이트 `docs/ACCOUNT_PUBLIC_RELEASE_GATE.md:100`의 미확정 표기와 달리 후속 기록 `reports/operations/ACCOUNT_PUBLIC_RELEASE_CANDIDATE_2026-08-26.md:25`, `:31`에는 사업자/브랜드 대조와 문서 표기가 기술되어 있다. 따라서 현재 사업자 방향 미정으로 되돌리지 않고, 현재 공개 페이지의 표기·문의 경로·문서 버전을 운영 담당자가 별도로 확인한다.

## 3. 우선 처리할 충돌·결함 후보

우선순위는 공개 전 검토 순서다. `정적 확인`은 파일상 차이, `실행 필요`는 재현 전 위험이다. 아래 원본은 이 작업에서 수정하지 않았다.

| ID / 우선순위 | 근거와 충돌 | 정확한 후속 조치·합격 조건 |
|---|---|---|
| AUTH-OPS01 / P1 / 외부 운영 확인 필요 | 과거 운영 주소 이메일 PASS (`reports/operations/ACCOUNT_PUBLIC_RELEASE_CANDIDATE_2026-08-26.md:44`)와 당시 custom SMTP 없음 (`reports/operations/AUTH_PROVIDER_CONNECTION_STATUS_2026-08-25.md:25`)은 일반 사용자 수신 증거가 아님. 부모가 확인한 공식 기본 SMTP 제한은 §2.1 참조 | 현재 SMTP 콘솔 상태를 확인하고 프로젝트 비팀 시험 수신자 왕복을 별도 검증. 기존 계정 공개 승인을 취소하지 않되 일반 사용자 이메일 준비 완료 표시는 이 증거 전까지 금지 |
| AUTH-S01 / P1 / 정적 확인 | `docs/ACCOUNT_PUBLIC_RELEASE_GATE.md:20`, `:93`, `:94`는 암호문·훈련 메모 서버 저장을 설명한다. 반면 `specs/reconstruct/LOCAL_FIRST_SYNC_AND_PROMOTION_CONTRACT.md:168` 및 `app/src/domain/account/sync-run.ts:50`, `:89`는 첫 베타 메모 전송을 닫는다 | 공개 게이트의 현재 데이터 표를 구조화 일지 전용으로 정렬. 과거 실행 영수증은 보존. 이전 메모 동의·복구 코드가 있어도 요청 payload와 로그에 메모가 없는 회귀 시험 필요 |
| AUTH-S02 / P2 / 정적 확인 | 인증 초안의 1차 제공자 목록 `specs/reconstruct/ACCOUNT_AUTHENTICATION_AND_IDENTITY_LINKING_SPEC.md:24`, `:55`와 공개 게이트 `docs/ACCOUNT_PUBLIC_RELEASE_GATE.md:23`·현재 승인 순서가 다름. 같은 게이트의 G9 표 `:70`와 미검증 설명 `:84`도 시점 불일치 | 구현 가능한 제공자와 현재 공개 제공자를 분리. Google·이메일 -> 카카오 -> Apple·AthleteTime 순서를 연결. 과거 PASS·OPEN은 해당 시점으로 표시하고 최신 배포 실측 열을 추가 |
| COROS-S01 / P1 / 정적 확인 | `specs/reconstruct/EXTERNAL_RECORD_INTEGRATION_SPEC.md:310`은 모든 COROS 런타임에 서면 공급자 승인을 요구. `reports/research/COROS_MCP_INTEGRATION_READINESS_2026-09-04.md:24`, `:38`, `:41`은 MCP 사용자별 OAuth와 Partner 경로를 분리 | 이슈를 MCP 조건·Partner 조건으로 나누는 수정안 준비. Partner 승인을 MCP에 일괄 적용하거나, MCP 안내를 상업적 보관 허가로 간주하지 않음. 실제 조건은 아래 C-EXT에서 확인 |
| COROS-S02 / P1 / 정적 확인 | 사용자 확인을 `EXPLICIT` 승격으로 해석하면 출처 계약 위반. `specs/reconstruct/EXTERNAL_RECORD_INTEGRATION_SPEC.md:142`; 현재 enum은 `EXPLICIT/DERIVED/MISSING`뿐 (`app/src/domain/field-provenance.ts:3`) | 제품 출처 `IMPORTED`와 현재 저장 enum을 구분하고 provider-specific source identity/확인 상태를 따로 설계. `IMPORTED` 문자열을 기존 enum에 바로 쓰거나 COROS를 파일 import 토큰으로 위장하지 않음 |
| COROS-S03 / P1 / 정적 확인 | 주석은 규칙 ID 등록을 분석 개방 경로처럼 설명 (`app/src/domain/field-provenance.ts:46`). 실제 코드 `:138`~`:143`은 등록되어도 외부 토큰을 명시 제외 | 규칙 ID 추가만으로 분석이 열린다는 지시를 수정. 첫 시험은 `analysisEligible=false`. 분석 반영은 필드별 공급자 신뢰·단위·시간 의미·회귀 시험을 포함한 별도 변경으로 준비 |
| COROS-I01 / P1 / 정적 확인 | Partner 정규화는 `duration`·UTC 시작시각을 저장할 뿐 시간 의미·원래 시간대·수정 버전을 보존하지 않음 (`supabase/functions/_shared/coros.mjs:49`, `:60`). 0030 확인함도 해당 필드가 없음 (`supabase/migrations/0030_device_integration_readiness.sql:42`). 반면 준비 계약은 이를 요구 (`app/src/domain/import/prepared-device-activity.ts:12`, `:15`, `:20`) | MCP 응답을 Partner 정규화로 바로 전달하지 않음. 단위·시간 의미·시간대·수정 정보를 가진 버전 고정 adapter 계약부터 준비. 의미 미확인 시간은 추정 운동시간으로 일지에 쓰지 않음 |
| COROS-I02 / P1 / 정적 확인·경합 실행 필요 | 0030은 동일 `(connection_id, provider_record_id)`에 `DO NOTHING` (`:149`)이므로 동일 ID 수정도 단순 중복으로 버린다. 연결 ACTIVE 조회 `:114` 뒤 insert `:126` 사이 철회와의 원자적 보장도 코드상 없음 | 동일 재전송과 수정 버전을 분리; 수정은 재확인 전 일지 덮어쓰기 금지. 동시 revoke/ingest·늦은 응답의 저장 차단을 실제 DB에서 재현하고 연결 generation/잠금/쓰기 직전 재검증 설계 |
| SYNC-I01 / P1 / 정적 확인·재현 필요 | V6와 V3는 같은 `saved_training_plans` 테이블을 사용하나 V3 조회는 `schema_version=3` 조건 없이 최신 1행을 파싱 (`app/src/domain/account/plan-cloud-backup.ts:61`). 최신이 V6이면 유효 V3가 있어도 실패할 수 있음. 새 기기 진입은 이 함수를 호출 (`app/src/screens/PlanBeta.tsx:310`) | V3/V6 혼재 fixture로 재현 후 버전별 조회·새 기기 복원 진입을 정렬. V6는 독립 원본 조회/확인 경로로 도달 가능해야 하며 V3 자동 복원으로 강제 변환하지 않음 |
| SYNC-I02 / P1 / 실행 필요 | 일지 `syncNow`는 시작 시 세션·동의를 확인 (`app/src/domain/account/sync-run.ts:42`, `:46`)하지만 원격 조회 후 로컬 병합·업로드 (`:106`, `:138`, `:149`) 전 동의/세션 재확인 지점이 없음. 기존 보안 시험은 시작 시 불일치만 검증 (`app/src/domain/account/sync-session-security.contract.test.ts:61`) | 지연된 조회 중 로그아웃·A->B 전환·동의 OFF를 주입. 취소 뒤 새 전송과 잘못된 화면 성공이 없어야 함. RLS로 타 계정 접근이 막히는 것과 취소된 작업이 중단되는 것은 다른 요구. 현재 데이터 유출 실측으로 보고하지 않음 |

`supabase/functions/device-integration-status/index.ts:16`의 `APPLICATION_PENDING`, `operational: true`, `publicUserLinking: false`는 준비 endpoint의 가동 설명이지 COROS 연결 성공이 아니다. 신규 준비 상태 표시로 바꿀 때에도 실제 연결되지 않은 사용자를 연결 완료로 표시하지 않는다.

SYNC-I01 후속 담당: 부모가 V3 조회의 schema 필터 누락을 재현·수정하기로 인수했다. 위 행은 수정 전 정적 관측이다. 이 sidecar는 코드 변경이나 부모 시험 결과의 검증·PASS 선언을 하지 않는다. 필터 수정 후에도 DB-V6-08의 실제 혼재 DB·새 기기 복원 시험은 별도 관문으로 남는다.

## 4. DB V6: 정확히 무엇이 아직 필요한가

### 4.1 버전과 기존 증거를 구분

여기서 **V6는 `saved_training_plans.schema_version=6`인 계획 payload 버전**이다. `app/src/domain/account/sync-guard.ts:6`의 `REQUIRED_SYNC_SCHEMA_VERSION=17`이나 migration 번호 0032와 같은 숫자가 아니다. `get_sync_schema_version() >= 17`은 V6 제약 적용을 입증하지 않는다.

- 0029: 계정별 PK `(user_id, plan_id)`, V3 전용 제약, RLS·PLAN_BACKUP 가드 (`supabase/migrations/0029_plan_backup_public_profiles.sql:25`, `:79`, `:110`, `:183`).
- 0032: V3/V6 병행 허용; V6 top-level 필드 5개, 지문 형식, `multi-v6:<fingerprint>`, selection object/progress array 확인 (`supabase/migrations/0032_multi_adjusted_plan_snapshots.sql:9`, `:12`). DB가 전체 콘텐츠 지문을 재계산하거나 모든 중첩 훈련 근거를 검증하는 것은 아니다. 클라이언트 독립 검증은 계속 필요하다.
- V6 로컬 계약 시험은 이미 있다: `app/src/domain/rpe-adjusted-slot-v3.contract.test.ts:318`의 백업 6시나리오, `:345`의 읽기 8시나리오, `:373`의 명시 복원. fake client의 검사이며 실제 PostgreSQL/RLS 왕복이 아니다. 이 작업에서는 실행하지 않았다.
- `supabase/tests/account_identity_isolation_rehearsal.sql:158`은 rollback-only 계정/일지 시험이다. `:161`의 결과 문자열도 V6·COROS를 검증했다고 하지 않는다. 과거 0001~0028 적용 상태 (`docs/ACCOUNT_PUBLIC_RELEASE_GATE.md:68`)를 0032 적용 증거로 사용하지 않는다.

### 4.2 DB 시험 목록

아래 전부 이번 작업에서는 `NOT_EXECUTED`. 먼저 운영과 분리된 시험 DB·합성 A/B 사용자·실행 범위를 부모가 확정한다. 사용자 RLS 시험은 실제 `authenticated` 역할/서로 다른 subject로 수행하고 service-role 성공을 격리 증거로 쓰지 않는다. 변경 시험은 rollback-only, 정상 허용 대조군과 거부군을 함께 둔다.

| ID | 준비·실행 | 정확한 기대 결과 / 남길 증거 |
|---|---|---|
| DB-V6-01 | migration 이력과 `pg_constraint`·`pg_policies`·trigger·table privilege를 읽기 전용으로 조회 | 실제 대상 DB가 0032를 반영했는지, V3/V6 제약과 RLS·기능 가드가 함께 있는지 정의로 확인. 부재면 적용 계획만 준비; 이 작업에서 적용하지 않음 |
| DB-V6-02 | 유효한 V3 1개와 합성 V6 1개를 A 계정으로 insert/select | 두 버전 모두 저장·반환. V6 `plan_id`, 전체 지문, `saved_at == payload.updatedAt`, 진행·원본 구조·출처 보존을 클라이언트 재파싱으로 비교. 본문 대신 비교 결과만 영수증 |
| DB-V6-03 | V6 필수 key를 각각 제거/JSON null로 교체; 잘못된 version·지문 형식·plan_id·selection/progress 타입·추가 top-level key를 각각 주입 | 0032 envelope 제약 위반을 케이스별 SQLSTATE/실패 이름으로 기록. 유효 V6 대조군은 통과해야 함. 모든 거부는 전체 테이블 실패와 구분 |
| DB-V6-04 | 지문 형태는 유지한 중첩 변조·시간 불일치·잘못된 중첩 근거를 넣고 클라이언트로 조회 | DB envelope가 수용할 수 있음을 숨기지 않음. `loadLatestMultiPlanSnapshotV3`가 `invalid` 또는 검증 불가로 차단; 로컬 active/history 변경 없음. DB 수준의 전체 의미 검증 완료라고 주장 금지 |
| DB-V6-05 | A 유효 행에 B/anon으로 select, insert A의 user_id, update owner 변경, update/delete A의 plan_id 시도; 반대 방향도 반복 | 권한 오류 또는 영향 0행/읽기 0행, 원래 A/B 유효 데이터 보존. A 본인 대조군은 허용. V3/V6 각각 시행 |
| DB-V6-06 | ACCOUNT/PLAN_BACKUP OFF 조합, 동의 미완료, 14세 미만, 탈퇴 요청 상태를 합성 입력으로 시험 | 클라이언트 숨김뿐 아니라 서버 읽기·쓰기 권한 경계 실측. SYNC·SHARING·PUBLIC_PROFILE·DEVICE_INTEGRATION은 독립, 계획 저장 때문에 자동 ON되지 않음 |
| DB-V6-07 | 같은 V6 지문 반복 백업, 더 늦은 진행 스냅샷, 같은 saved_at의 서로 다른 두 지문, archived 행 | 동일 지문 중복 1행 유지; 진행 변경은 별도 스냅샷; 같은 시각 최신 2행은 `conflict`, 임의 선택/복원 없음; archived 행은 최신 조회에서 제외 |
| DB-V6-08 | V3 최신/V6 최신 순서를 바꾼 혼재 계정에서 각각 새 기기 진입 | SYNC-I01 재현·수정 증거. 각 버전의 유효 원본을 찾거나 정확한 버전 제한을 표시; 일반 실패로 원본이 없는 것처럼 숨기지 않음 |
| DB-V6-09 | 시험 계정 탈퇴 요청 직후 접근, 삭제 기한 경계의 cleanup, 기능 OFF 상태의 삭제 | 즉시 접근 차단과 후속 물리 삭제를 별도 증명. saved_training_plans, provider 연결·inbox의 FK cascade 및 비DB 토큰/캐시 삭제 결과까지 확인. 실패를 완료로 쓰지 않음 |

DB-V6-09는 단순 SQL cascade 선언 검사로 끝내지 않는다. 삭제 작업은 `supabase/migrations/0018_server_operations.sql:845`의 auth 사용자 정리, 계획 FK `supabase/migrations/0029_plan_backup_public_profiles.sql:26`, 외부 연결/확인함 FK `supabase/migrations/0030_device_integration_readiness.sql:25`, `:44`, `:45`를 함께 시험한다. PLAN_BACKUP OFF일 때 일반 사용자 delete는 RLS·trigger에 막히므로 (`0029:128`, `:183`) 서비스 정리 경로와 연결을 끄는 동작을 혼동하지 않는다.

## 5. 두 계정·두 기기: 기존 하네스와 누락 시험

기존 `app/e2e/account-runtime-isolation.spec.ts:9`는 임시 스테이징 계정과 명시 실행 플래그가 없으면 `:90`에서 skip한다. `:100`의 두 browser context, 로컬 소유권 연결, A->B->A 전환, `:200`의 서버 일지 빈 배열을 검사한다. 로그인은 `:66`의 테스트 계정 password 세션 주입이므로 Google/이메일 확인 링크 왕복 증거도 아니다. **기존 하네스 PASS 하나를 두 기기 동기화나 V6 검증으로 간주하지 않는다.**

시험 배치는 A 사용자/브라우저 A1, 같은 A 사용자/빈 브라우저 A2, 다른 B 사용자/브라우저 B1이다. 두 계정만 있고 A의 두 번째 기기가 없으면 복원 검증을 충족하지 못한다. 다음은 기존 하네스 확장 또는 별도 하네스가 필요한 미실행 시험이다.

| ID | 실행 경로 | 합격 조건 |
|---|---|---|
| AB-01 인증 | Google·이메일 각각 신규/재로그인, 만료·재사용 링크, 취소, 프로필 확정 실패, 법률 버전 변경, 14세 경계 | 실제 제공자 왕복과 서버 프로필·동의 일치. 14세 미만 외부 인증 미호출; 실패 때 동기화 진행 금지. 민감한 OAuth URL/코드는 영수증에서 제외 |
| AB-02 명시 일지 왕복 | A1 로그인만 -> 기기 소유권 연결 -> 동의 -> 미리보기 -> 취소 -> 재확인 실행 -> 빈 A2 내려받기 | 확인 전 서버 write 0; 실행 후 stable ID·출처·구조화 필드 일치. A1 메모 원문은 로컬 유지, A2는 빈 메모 셸. B1에는 A 기록 0 |
| AB-03 동의·계정 전환 | 미리보기/조회/쓰기 대기 중 A->B, 로그아웃, 동의 OFF, 기능 OFF; A 재로그인 | 이전 미리보기·결과가 B에 표시되지 않음, 새 전송 중단·잘못된 SAVED 없음. B의 동의/로컬 자료 불변. 시작 시 불일치뿐 아니라 진행 중 경합 검사 |
| AB-04 일지 충돌 | 같은 ID를 A1/A2에서 다른 시각과 같은 시각으로 수정, 오프라인 재시도 | 현재 계약의 `savedAt` 병합·tombstone 우선 결과 확인 (`app/src/domain/account/sync-local.ts:142`). 같은 시각 분기가 무한 교대하지 않는지 관측; 불일치면 충돌 UI/계약 보완 작업으로 인계 |
| AB-05 삭제·실패 복구 | A1 삭제 -> A2 stale 업로드; tombstone pull/upsert 실패, 본문 delete 실패, 부분 성공 후 재실행, 로컬 저장 실패 | 삭제가 복원되지 않음; 본문 없는 삭제 표식; 실패·부분 성공 표시 정확; 원본/복구 지점 보존. 무조건 성공 또는 원문 소실 금지 |
| AB-06 V6 저장/원본 복원 | A1 V6 선택·진행 -> 명시 백업 -> 빈 A2 원본 조회 -> 취소 -> 보관함 추가 | ID·지문·updatedAt·진행·근거 왕복 일치. 조회만으로 active 일정 변경 없음; 확인 후에만 history 추가. B1 직접 URL/행 ID 접근은 거부 |
| AB-07 V6 현재 일정 복원 | A2에서 현재 일정 없음/있음, 현재 검토 근거 유효/철회, 몸 상태 확인 없음/검토 필요를 각각 시험 | 명시 확인+현재 검토를 충족할 때만 기존 날짜·진행을 유지해 복원. 보관함 복원으로 안전/실행 권한 자동 부여 금지. 기존 active 일정 자동 교체 금지 |
| AB-08 V6 경합·재시도 | 백업 전후 계정 변경·세션 만료·네트워크 오류, 동일 지문 재시도, 동시에 다른 진행 저장 | V6 mock의 `wrong-session`, `account-during-auth`, `account-after-send`, `write-error`를 실제 서버로 확인. 로컬 데이터 불변, 중복 1행, 동률 conflict 표시, 타 계정 SAVED 금지 |
| AB-09 보관·탈퇴·새 로그인 | V6 archive 후 빈 기기 조회, 탈퇴 요청 직후 세션/직접 API, 승인된 시험 cleanup 후 재로그인·복원 | archived 원본 재등장 방지; 탈퇴 즉시 접근 차단과 기한 내 삭제를 각각 확인. 사용자 로컬 삭제와 서버 삭제를 별도 표시 |

## 6. COROS 첫 읽기 전용 시험 계약안

### 6.1 범위와 외부 확인

오너의 시험 진행 방향은 승인되었다. 실제 실행 시점에는 시험 대상·빌드·데이터·고지·사용자 OAuth 동의와 안전한 실행 승인을 정확히 결합한다. 이번 sidecar의 무네트워크·무데이터 제한은 그대로 유지한다.

`reports/research/COROS_MCP_INTEGRATION_READINESS_2026-09-04.md:37`~`:49`, `:75`~`:87`은 **9월 4일 조사 기록**이다. 본 작업은 해당 URL을 열지 않았으므로 현재 공급자 지원을 재검증했다고 하지 않는다. 다음 C-EXT를 허가된 별도 실행에서 확인한다.

추가 공식 근거: 부모가 이번 작업에서 확인한 [Build on COROS MCP](https://support.coros.com/hc/en-us/articles/53181619102996-Build-on-COROS-MCP)는 self-service 사용자 OAuth 경로를 안내하며 Partner 웹훅 경로와 구분된다. 이 링크는 부모 조회 자료이며 본 sidecar의 독립 웹 검증은 아니다. 따라서 COROS를 Partner 신청 대기 하나로 묶지 않지만, 실제 등록·사용자 동의·읽기 도구 지원·저장 조건·철회 성공은 여전히 각각 확인한다. 이번 소규모 수동 조회를 웹훅/자동 동기화 활성화로 확대하지 않는다.

| ID | 외부에서 확인할 사실 | 첫 시험의 중단 조건 |
|---|---|---|
| C-EXT-01 | 자체 앱의 사용자별 MCP 조회와 최소 정규화 데이터 보관 조건, 리전, 실제 client 등록·redirect 방식 | 공식 경로·이용 범위를 확인하지 못하면 실데이터 저장 금지. Partner 심사와 분리 |
| C-EXT-02 | 실제 issuer/resource/PKCE·state·token 수명·철회 endpoint, 인증 후 `tools/list`와 schema version | 광고된 metadata를 구현 성공으로 대체 금지. 임의 redirect/issuer/resource 또는 읽기 도구 식별 불가 시 차단 |
| C-EXT-03 | 활동 요약 조회의 필드·단위·TIMER/MOVING/ELAPSED 의미·timezone·pagination·수정/삭제 신호·호출 제한 | 의미 미확인 필드를 추정해 일지 확정 금지. 공식 한도 미확인 상태에서 자동 pagination/전체 과거 수집 금지 |
| C-EXT-04 | disconnect·remote revoke·정규화 보관/삭제 의무와 실제 운영 처리 기한 | 구체적 보관/삭제 기한·담당·실패 처리 미정 상태로 참가자 수집 시작 금지. 기존 계정 삭제 30일을 COROS 모든 데이터에 자동 적용하지 않음 |

### 6.2 최소 데이터와 출처

아래는 구현할 adapter/확인함 계약안이며 현재 COROS 응답 필드명이나 DB 스키마가 아니다. 공급자 스키마를 확인한 뒤 정확한 원천 필드에 매핑한다. 최초 기술 smoke는 동의한 시험 사용자 1명의 선택 활동 1건을 기준으로 준비하고, 통과 후 승인된 소수 사용자로 넓힌다. 전체 과거 기록 수집은 포함하지 않는다.

| 최소 항목 | 보존·실패 규칙 |
|---|---|
| 소유권·제공자 식별 | 인증된 TrainOracle user와 provider connection/generation을 서버에서 결합. `COROS`, transport `MCP`, 공급자 활동 ID. 클라이언트가 보낸 다른 선수 ID로 조회 금지. provider 사용자 ID는 보호된 연결 저장소에만 |
| 종목·시작 | 공급자 종목 코드와 매핑 버전, 시작 instant, 확인된 timezone/offset. 모르는 종목을 RUNNING으로 만들지 않음. 원래 timezone 없는 UTC 값에서 현지 날짜를 임의 확정하지 않음 |
| 거리 | 공급자 거리 값·원천 단위·정규화 meter. 결측과 0을 구분. 반올림 전 정밀도를 보존하고 표시값을 분석 사실로 재해석하지 않음 |
| 시간 | 공급자 시간 값·초 단위·의미 TIMER/MOVING/ELAPSED/UNKNOWN. UNKNOWN은 운동 시간으로 연결하지 않음. 의미가 확인되어도 종류를 함께 보여주며 서로 대체하지 않음 |
| 수정 정보 | source version 또는 provider 수정시각, 조회 시각, 정규화 스키마 버전/최소 필드 지문. 지문만으로 공급자 수정 버전 또는 서로 다른 활동 동일성을 주장하지 않음 |
| 확인·연결 | `PENDING_USER_CONFIRMATION/CONFIRMED/DISMISSED`, 확인한 source revision, 대상 일지 ID/expectedSavedAt, 확인 시각. 확인과 저장을 재시도해도 활동 하나가 여러 일지로 중복 배분되지 않도록 유일성/원자성 필요 |
| 필드 출처·분석 | 공급자 값은 계속 IMPORTED라는 의미를 보존. 현재 enum과 구분되는 provider-specific provenance 설계 필요. 사용자 확인은 값의 직접 입력 증명이 아님. 첫 시험은 `analysisEligible=false`; 사용자 자신의 RPE 등 독립 직접값은 기존 자격을 보존 |

첫 시험에서 GPS/위치 경로, FIT 원본·원본 파일 URL, 활동명·자유 설명, 메모, 심박·HRV·수면·생리주기·회복률·VO2max, provider AI 분석, 랩/구간, 훈련계획 쓰기, 반복 백그라운드 동기화는 제외한다. 기존 준비 타입이 `laps`를 요구하면 첫 시험에서는 빈 배열로 제한한다 (`app/src/domain/import/prepared-device-activity.ts:21`). 허용 도구가 부가 필드를 반환하면 서버의 일시 처리 경계에서 allowlist 밖 필드를 즉시 버리고 저장·일반 로그·화면·LLM으로 보내지 않는다. 불필요한 `offline_access`를 기본 요청하지 않는다.

출처 상태와 분석 자격을 별도 축으로 두는 근거는 `reports/research/COROS_MCP_INTEGRATION_READINESS_2026-09-04.md:147`, `app/src/domain/field-provenance.ts:94`, `:128`이다. 서버 저장 승인·사용자 확인·OAuth 성공 어느 것도 D9 해제, RPE 추론, PB/SB 선택, 계획 자동 재설계의 근거가 아니다.

### 6.3 사용자 확인 흐름과 합성 시험

1. 연결 안내에서 조회 목적·최소 항목·보관·해제/삭제 경로를 보여주고 동의한다. TrainOracle 로그인과 COROS 계정 선택은 별개이며, 잘못 선택한 공급자 계정은 취소·재연결할 수 있어야 한다.
2. OAuth callback은 요청별 PKCE/state/issuer/resource/redirect/만료/일회 사용을 검증한다. 연결 generation에 작업을 묶고 토큰은 서버 암호화 경계에만 둔다. 원격 본문·토큰·코드를 브라우저 저장소나 감사 로그에 남기지 않는다.
3. `새 기록 가져오기`를 사용자가 누른 경우에만 허용된 읽기 도구를 호출한다. `mcp.tools`라는 scope 이름을 읽기 전용 보장으로 취급하지 않으며 도구 이름·입력 스키마 allowlist로 쓰기 호출을 차단한다.
4. 최소 정규화 후 계정별 확인함에 둔다. 재전송은 같은 항목, 다른 revision은 재검토 상태다. 날짜·거리 유사도만으로 자동 병합하지 않는다.
5. 사용자가 별도 기록/기존 일지 연결/취소를 선택한다. 대상은 정확한 일지 ID와 revision으로 재확인한다. `app/src/domain/import/import-draft.ts:152`의 stale 확인과 `:176`의 메모 보존 원칙은 재사용하되 파일 importer를 COROS API 구현으로 간주하지 않는다. 기존 객관값·RPE·메모·계획 링크를 조용히 덮어쓰지 않는다.
6. 저장 후에도 IMPORTED 출처와 시간 의미를 유지한다. 실패 시 pending 항목을 보존하고 재시도 가능하게 하며, 부분 성공과 취소를 성공 건수에 넣지 않는다.

필수 합성 케이스: 정상 1건; 단위/시간 의미/시간대 결측; 자정 통과·AM/PM; 트레드밀·사이클링·UNKNOWN; 동일 재수신; 같은 ID 수정; provider 삭제; 파일+API 중복; 다른 계정 같은 활동 ID; 동일 confirm 두 번; confirm 중 일지 수정; 저장 실패 재시도; OAuth state replay/만료/계정 바꿔치기; 허용되지 않은 도구; 401/429/timeout/부분 페이지; 조회 중 revoke·logout·기능 OFF; revoke 뒤 늦은 응답. 각각 정상 대조군과 실패 이름·원래 자료 보존을 단언한다. 현재 `app/scripts/validate-device-integration.test.mjs:52`, `:99`, `:109`, `:128`의 정규화/SQL 문자열/준비 endpoint 시험은 이 통합 시험을 대신하지 않는다.

### 6.4 철회·삭제 요구

- 연결 해제는 먼저 서버 작업 권한과 generation을 무효화하고 새 조회·대기 작업·늦은 응답 저장을 막는다. 원격 revoke가 실패해도 로컬/서버 수집 차단은 먼저 성공해야 하며 원격 철회 상태를 별도로 남긴다.
- 암호화 토큰·갱신 자료·pending inbox·cursor/임시 응답 캐시를 승인된 기한 안에 삭제한다. 실패는 `DELETION_PENDING/FAILED` 같은 구조화 상태와 재시도로 운영자에게 보여주며 완료로 보고하지 않는다. 계정 삭제 cascade는 외부 토큰 저장소까지 자동 처리한다고 가정하지 않는다.
- 이미 확인해 일지에 연결한 공급자 필드, 사용자 RPE/메모, 서버 백업, 개인 내보내기 파일은 서로 다른 자료다. 연결 해제만으로 사용자 직접 작성 자료를 지우지 않는다. 공급자 유래 필드의 유지/삭제는 실제 공급자 조건·고지와 사용자 선택에 따라 정하고 수집 전에 명시한다. 삭제 요청 시 연결된 복제본/분석 사본까지 추적 가능해야 한다.
- 삭제된 활동의 재가져오기로 자동 복원이 일어나지 않도록 필요한 최소 억제 표식의 항목·보관 기간을 정한다. 표식도 식별 가능한 자료일 수 있으므로 영구 보관을 임의 결정하지 않는다. 재연결은 새 동의와 generation이며 이전 revoked 작업을 되살리지 않는다.
- 계정 탈퇴 시 즉시 접근 차단, 공급자 해제, 서버/로컬 데이터의 처리 구분, 보관 기한 정리 영수증을 각각 확인한다. 사용자가 별도로 내보낸 파일까지 서버가 지웠다고 주장하지 않는다.
- 사고 시 `DEVICE_INTEGRATION` 차단, 구조화 원인·요청 ID·시각·건수만 남긴다. 현재 runbook `reports/operations/DEVICE_INTEGRATION_INCIDENT_AND_REVOCATION_RUNBOOK.md:29`~`:34`와 외부 계약 `specs/reconstruct/EXTERNAL_RECORD_INTEGRATION_SPEC.md:255`를 구현/시험에 연결한다. 이 문서로 운영 스위치 변경이나 공급자 통지를 실행하지 않는다.

## 7. 바로 이어서 실행할 검사

### 7.1 로컬 회귀 명령: 기존 파일, 이번에는 미실행

다음은 부모/후속 구현 담당이 변경 범위를 확정한 후 실행할 명령이다. `app` 디렉터리에서 이미 설치된 의존성만 사용한다. 누락 시 자동 다운로드나 `npx` 대체 실행을 하지 말고 설치를 별도 처리한다. Vitest 실행은 캐시/임시 산출물을 만들 수 있으므로 본 문서 전용 sidecar에서는 실행하지 않았다.

```powershell
npm run test:unit -- src/domain/account/auth.contract.test.ts src/domain/account/auth-onboarding.contract.test.ts src/domain/account/sync-orchestration.contract.test.ts src/domain/account/sync-session-security.contract.test.ts src/domain/account/sync-recovery.contract.test.ts src/domain/account/sync-schema-recovery-orchestration.contract.test.ts src/screens/account/AccountSyncPanel.contract.test.tsx
npm run test:unit:kst -- src/domain/account/auth.contract.test.ts src/domain/account/auth-onboarding.contract.test.ts src/domain/account/sync-orchestration.contract.test.ts src/domain/account/sync-session-security.contract.test.ts src/domain/account/sync-recovery.contract.test.ts src/domain/account/sync-schema-recovery-orchestration.contract.test.ts src/screens/account/AccountSyncPanel.contract.test.tsx
npm run test:unit -- src/domain/rpe-adjusted-slot-v3.contract.test.ts src/domain/account/plan-cloud-backup.contract.test.ts src/screens/plan-beta/MultiPlanCloudControlsV3.contract.test.tsx src/domain/import/prepared-device-activity.contract.test.ts src/domain/import/import-draft.contract.test.ts
npm run test:unit:kst -- src/domain/rpe-adjusted-slot-v3.contract.test.ts src/domain/account/plan-cloud-backup.contract.test.ts src/screens/plan-beta/MultiPlanCloudControlsV3.contract.test.tsx src/domain/import/prepared-device-activity.contract.test.ts src/domain/import/import-draft.contract.test.ts
npm run test:device-integration
```

실제 DB-V6-02~09·AB-02~09·COROS 통합 하네스는 위 명령에 자동 포함되는 검사가 아니다. 후속 작업에서 해당 케이스를 작성해야 한다. 현행 테스트 이름을 새 시험이 있는 것처럼 재사용하지 않는다. 테스트 결과에는 HEAD, 명령, 환경(UTC/KST), named pass/fail/skip, 오류·출력 파일 경로를 남기고 총개수만으로 통과 판정하지 않는다.

### 7.2 읽기 전용 DB 검증안

아래 쿼리는 운영/시험 대상과 접근 권한을 확인한 담당자가 실행할 검토안이며 **미실행**이다. 연결 문자열이나 키를 문서/명령에 포함하지 않는다. 이 쿼리는 사용자 행을 읽지 않으며 migration 등록명보다 실제 정의를 우선 확인한다.

```sql
select conname, pg_get_constraintdef(oid)
from pg_constraint
where conrelid = 'public.saved_training_plans'::regclass;

select relname, relrowsecurity
from pg_class
where oid = 'public.saved_training_plans'::regclass;

select policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'saved_training_plans';

select tgname, pg_get_triggerdef(oid)
from pg_trigger
where tgrelid = 'public.saved_training_plans'::regclass and not tgisinternal;

select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'saved_training_plans';
```

이후 별도 승인된 시험 DB에서 DB-V6 표의 합성 정상/거부 쌍을 rollback-only로 실행한다. SQL 파일이 존재한다는 이유로 V6 migration 적용이나 RLS 통과로 표기하지 않는다.

### 7.3 실제 브라우저 시험 실행 전 조건

1. 시험 전용 A/B 계정과 A1/A2/B1 상태를 준비하고 앱 빌드의 비밀이 아닌 기능 설정·SHA·승인 범위를 확인한다. 실사용 계정이나 기존 browser state를 재사용하지 않는다.
2. 기존 하네스는 `TRAINORACLE_AB_RUNTIME_APPROVED`와 시험 계정 입력을 요구한다 (`app/e2e/account-runtime-isolation.spec.ts:9`). 자격증명은 담당자의 승인된 비밀 주입 경로로만 제공하고 출력/파일에 기록하지 않는다. 이 문서가 해당 값을 설정하거나 실행을 승인하지 않는다.
3. `app/playwright.config.ts:17`~`:19`는 실패 screenshot/trace/video를 보관한다. 실제 인증 시험 전에 별도 시험 설정에서 trace/video/screenshot의 민감정보 저장을 끄거나 승인된 접근 제한·삭제 경로를 마련한다. URL·토큰·세션을 포함하는 HAR/trace를 공개 증거로 첨부하지 않는다.
4. 부모가 로컬 전용 서버의 정확한 빌드·loopback 주소·빈 포트를 확인한 후 설치된 Playwright로 `account-runtime-isolation.spec.ts`의 `desktop-chromium`만 실행한다. skipped면 `NOT_EXECUTED`이며 성공이 아니다. AB-02~09는 새 하네스가 구현된 뒤 별도 실행한다.
5. Google/이메일 실제 왕복, 승인된 COROS 사용자 1건 smoke는 그 범위의 별도 운영 시험이다. 공개 외부 서비스 전체나 공급자 쓰기 도구로 범위를 넓히지 않는다.

## 8. 인계와 종료 기준

| 담당 | 바로 다음 실행 단위 | 종료 증거 |
|---|---|---|
| 부모 승인 문서 담당 | 이미 작성된 체크포인트 v1.1·승인 실행 등록부에 본 패킷의 AUTH-S01~02/COROS-S01~03 변경안을 연결 | 승인 기록 중복 생성 없음; 방향 승인과 외부 실행/계약·훈련 채택의 서로 다른 관문 명시; 과거 영수증 불변 |
| 인증·동기화 구현 담당 | SYNC-I01~02 재현, DB-V6/AB 누락 케이스 작성, 기존 로컬 회귀 실행 | named 재현/수정 회귀 결과, 실제 시험 DB 정의·RLS·V6 왕복 증거. 데이터 없음과 기능 OFF를 성공 왕복으로 보고하지 않음 |
| COROS 구현 담당 | 최소 adapter/source/확인·철회 계약부터 확정하고 합성 transport 구현 | 정상/중복/수정/계정 전환/철회·삭제·오류 케이스 통과, 원문·토큰 로그 없음 |
| 승인된 운영 시험 담당 | C-EXT 사실 확인 후 단일 동의 사용자·선택 활동 1건 조회 -> 확인 -> 연결 -> 해제/삭제 | 실제 도구/스키마 버전, 시각, 빌드, 상태/건수, PASS/FAIL/미실행만 담은 비민감 영수증 |

**완료를 주장할 수 있는 범위는 준비 문서 작성과 소스 대조뿐이다.** 최초 읽기 시험의 성공도 분석 활용·자동 동기화·훈련계획 쓰기 완료를 뜻하지 않는다. 부모가 다루는 PR/CI·훈련 패킷·승인 정본에는 이 보고서가 제공하는 구체적 누락 시험과 충돌 목록만 인계한다.

## 9. 후속 승인 범위: SYNC-I02 수정과 검증 영수증

### 9.1 변경과 보장 경계

- 일자: 2026-09-08. 수정 시작 HEAD: `abb1e15a6951d6e18e975a6a2c3a159374bb09d3`. 이 절은 최초 문서 전용 조사 이후 부모가 명시적으로 승인한 코드 수리다.
- 소유 변경은 `app/src/domain/account/sync-run.ts`, 신규 `app/src/domain/account/sync-async-cancellation.contract.test.ts`, 본 보고서 세 파일뿐이다. 기존 세션 보안 계약 파일과 SYNC-I01 코드, 승인 원장, 훈련 패킷은 수정하지 않았다. DB·외부 네트워크·비밀·운영 변경·commit/push는 실행하지 않았다. 기존 미추적 파일은 보존했다.
- `sync-run.ts:40`에서 시작 로컬 계정 범위를 캡처한다. `:50`의 취소 검사기는 **await한 세션 확인 이후** 로컬 계정 변경과 대상 계정의 최신 동의를 읽는다. 기존 세션 오류 코드와 결과 형식을 재사용한다. 기존 직접 도메인 호출의 null 로컬 범위는 유지하되 실행 중 범위 변화를 감지한다.
- 조회 후 병합 직전(`:123`), 로컬 병합 후 업로드 직전(`:166`), 업로드 응답 뒤(`:182`), tombstone 처리 뒤(`:237`), 마지막 삭제 응답 뒤 최종 성공 전(`:262`)에 재검증한다. 취소를 확인하면 후속 단계는 시작하지 않고 `ok:false`로 반환한다.
- 로컬 병합 완료 수, 응답으로 확인한 업로드/삭제 수와 현재 병합 총수를 취소 결과에 보존한다. 늦은 취소를 0건 또는 '로컬 무변경'으로 설명하지 않는다. 취소 경로는 저장소/계정 데이터/복구 체크포인트를 지우거나 이전 상태로 되돌리지 않는다. 복구 체크포인트는 다음 명시적 재시도를 위해 남긴다.
- 이미 전송된 요청의 서버 적용 취소·rollback·원자적 전체 중단은 보장하지 않는다. 계정/동의를 await 경계에서 재검증하는 제한된 수리이며, 두 관측 사이 A->B->A 또는 OFF->ON 같은 일시 전환의 이력을 latch하는 새 generation 프로토콜은 추가하지 않았다. 서버의 RLS 격리 및 실제 화면의 계정별 결과 처리는 별도 검증 대상이다.

### 9.2 재현과 실제 로컬 실행

합성 자료와 mock Supabase 전송만 사용하고 실제 journal/소유권/동의/복구 저장 로직을 실행했다. 최초 fixture에서 삭제 표식 소유권이 빠져 생긴 실패는 fixture 오류로 수정했으며 제품 결함 증거에 포함하지 않았다. 수정된 fixture를 **수정 전 sync-run**에 실행한 결과는 20개 중 18 FAIL / 2 PASS였다. 지연 schema·journal-select·tombstone-select 각각에 logout/account-switch/consent-off를 주입한 9개, 지연 journal-upsert·tombstone-upsert·journal-delete 각각에 같은 전환을 주입한 9개가 실패했다. 정상 왕복과 실패 응답 대조군은 통과했다.

최종 신규 26개는 정상 왕복(`sync-async-cancellation.contract.test.ts:126`), 병합 전 취소 9개(`:136`), 부분 처리 후 취소 9개(`:157`), 지연 세션 확인 뒤 재검증 3개(`:178`), 로컬 범위/세션 독립 변경 2개(`:197`), 부분 성공 후 명시적 재시도(`:210`), 실패 업로드를 확정 성공으로 세지 않음(`:226`)이다. A/B 로컬 데이터 보존, 취소 뒤 후속 전송 없음, 정확한 결과 건수와 체크포인트 유지/정상 재시도 해제를 단언한다.

`app` 디렉터리, 이미 설치된 Node/Vitest/TypeScript로 실행한 정확한 명령:

```powershell
$env:TZ='UTC'; node node_modules/vitest/vitest.mjs run src/domain/account/sync-async-cancellation.contract.test.ts src/domain/account/sync-session-security.contract.test.ts src/domain/account/sync-orchestration.contract.test.ts src/domain/account/sync-schema-recovery-orchestration.contract.test.ts --maxWorkers=1 --reporter=dot
node node_modules/vitest/vitest.mjs run -c vitest.config.kst.ts src/domain/account/sync-async-cancellation.contract.test.ts src/domain/account/sync-session-security.contract.test.ts src/domain/account/sync-orchestration.contract.test.ts src/domain/account/sync-schema-recovery-orchestration.contract.test.ts --maxWorkers=1 --reporter=dot
node node_modules/typescript/bin/tsc --noEmit --incremental false
```

| 실행 | 실제 결과 |
|---|---|
| UTC, 2026-09-08 03:56:11 시작 | 4 files / 50 tests PASS, FAIL 0, skip 0, exit 0, Vitest 8.87초 |
| KST, 2026-09-08 12:57:04 시작 | 4 files / 50 tests PASS, FAIL 0, skip 0, exit 0, Vitest 8.52초 |
| TypeScript noEmit / incremental false | 진단 출력 없음, exit 0 |

신규 26개와 기존 세션·오케스트레이션·복구 계약 24개 결과다. 실행 출력은 이 작업의 도구 결과로 확인했으며 별도 로그 파일을 생성하지 않았다. 이것은 SYNC-I02의 로컬 합성 회귀 통과이지 실제 DB RLS, 두 기기 브라우저, 외부 메일 또는 COROS 통과가 아니다. 부모는 위 명령을 독립 재실행할 수 있다. 다음 실제 검사는 §5 AB-03/05의 승인된 시험 계정·기기 환경에서 수행하며, 원격 요청이 이미 적용된 경우 부분 성공과 이후 쓰기 중단을 따로 관측한다.

### 9.3 현재 운영 상태와 남은 최우선 관문

부모 작성 [운영 대시보드 관측 영수증](OPERATING_DASHBOARD_OBSERVATION_2026-09-08.md)의 7~9행, 13~15행을 직접 읽어 연결했다. 아래는 **부모의 외부 관측을 인용**한 것이며 이 sidecar가 대시보드에 접속한 것이 아니다. 공식 SMTP/COROS 웹 문서도 §2.1/6.1에 명시한 부모 조회 출처를 유지한다.

1. AUTH-OPS01: 현재 custom SMTP 미설정은 확인됨. 기본 SMTP의 비팀 이메일 제한 때문에 오너 이메일 PASS와 일반 사용자 이메일 공개 준비는 여전히 다르다. EMAIL-OPS-01의 미설정 여부 확인은 충족했으나 공급자·도메인·제한 설정 및 EMAIL-OPS-02/03 실수신은 미완료다. 비용 상한/계약 승인과 별도 설정 후 비팀 시험 수신자 왕복을 실행한다.
2. DB-V6-01: 실제 migrations 목록 최신 0031, 0032 이력 없음은 확인됨. 수동 DDL 부재는 입증하지 않았다. 프로젝트 이름에 staging이 있어도 main은 PRODUCTION 표시이므로 시험 DB라고 간주하지 않는다. §7.2의 실제 제약/정책/trigger 읽기 검증을 승인된 담당자가 먼저 수행한 뒤 별도 승인된 변경·DB-V6-02~09 시험으로 진행한다. 이력만 보고 0032를 즉시 적용하지 않는다.
3. SYNC-I02: 이번 범위의 재현·수정·UTC/KST 회귀 완료. 실제 RLS 격리는 미검증이며 취소 검사로 이를 대체하지 않는다. SYNC-I01과 그 독립 검증은 부모 소유다. COROS는 실제 OAuth/조회/확인/철회·삭제 통합 증거가 아직 없고 §6의 최소 읽기 시험 관문을 유지한다.

[DRAFT_COMPLETE]
