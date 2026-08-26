# ACCOUNT_AB_ISOLATION_RUNTIME_RECEIPT_2026-08-26.md

```yaml
doc_id: TRAINORACLE-ACCOUNT-AB-ISOLATION-RUNTIME-RECEIPT-2026-08-26
status: PARTIAL_RUNTIME_PASS_TWO_BROWSER_OPEN
owner: Codex
environment: trainoracle-beta-staging
project_ref: texspxlpjungyarkvtkc
region: ap-northeast-2
account_public_release_approved: false
```

## 1. 검증 범위

소유자 승인 아래 스테이징 프로젝트에 임시 이메일 계정 A/B 두 개를 만들고,
`ACCOUNT`와 `SYNC` 서버 스위치를 시험 동안만 켰다. 실제 계정 생성과 로그인 성공,
서로 다른 사용자 식별자 발급을 확인한 뒤 데이터베이스에서 `authenticated` 역할과
각 계정의 `auth.uid()`를 사용해 일지 RLS를 교차 시험했다.

비밀번호, 액세스 토큰, API 키, 사용자 UUID, 이메일 주소 및 선수 원문은 이 보고서와
저장소에 기록하지 않았다. 시험 일지는 식별 불가능한 합성 구조 데이터만 사용했다.

## 2. 실행 결과

| 항목 | 결과 |
|---|---|
| 임시 계정 생성 | A/B 2개 생성 확인 |
| 이메일·비밀번호 로그인 | 두 계정 모두 HTTP 200, 서로 다른 사용자 식별자 확인 |
| A의 자기 기록 생성·조회 | PASS, 조회 1행 |
| B의 자기 기록 생성·조회 | PASS, 조회 1행 |
| B가 A 기록 조회 | PASS, 0행 |
| A가 B 기록 조회 | PASS, 0행 |
| B가 A 소유자로 기록 생성 | PASS, RLS 차단 |
| B가 A 기록 삭제 | PASS, 삭제 0행 |
| A/B 자기 기록 삭제 | PASS, 각 1행 |
| 시험 거래 정리 | ROLLBACK, 잔여 시험 일지 0행 |

RLS 교차 시험은 SQL Editor에서 테스트 거래를 열고 임시 테이블만 사용한 뒤
`ROLLBACK`했다. 실제 테이블의 정책과 `ACCOUNT`/`SYNC` 제한 정책을 통과한 상태에서만
자기 기록 작업이 성공했다.

## 3. 원상복구

```yaml
temporary_users: 0
temporary_journal_entries: 0
ACCOUNT_enabled: false
SYNC_enabled: false
feature_control_audit_event_recorded: true
credentials_or_tokens_committed: false
```

임시 계정 2개는 Auth 관리 화면에서 삭제했다. 최종 SQL 재확인 결과 임시 계정 0명,
임시 일지 0행, `ACCOUNT=false`, `SYNC=false`였다.

## 4. 화면 격리 재검증 준비와 원상복구

같은 날 별도의 합성 A/B 계정으로 앱 화면 격리 재검증을 준비했다. 시험 중에는
`ACCOUNT=true`, `SYNC=false`만 사용했고, 실제 일지를 서버로 자동 업로드하지 않는
조건을 유지했다. 그러나 브라우저 제어가 중단되어 A/B 화면 단언을 끝까지 실행하지
못했으므로 이 시도를 PASS 증거로 사용하지 않는다.

반복 가능한 검증 하네스는 `app/e2e/account-runtime-isolation.spec.ts`에 추가했다.
이 테스트는 소유자가 승인한 임시 스테이징 계정 환경 변수가 모두 주어지고 별도의
`TRAINORACLE_AB_RUNTIME_APPROVED=I_ACKNOWLEDGE_STAGING_ACCOUNT_MUTATION`이 설정된
경우에만 데스크톱 프로필에서 한 번 실행된다. 오래된 `true` 값, 승인값 누락 또는
필수 값 누락은 모두 명시적으로 SKIP한다. 비밀값은 저장소에 기록하지 않는다.

중단 뒤 소유자 재승인을 받아 두 번째 시험 계정 2개만 삭제하고 `ACCOUNT`를 다시
껐다. 최종 SQL 결과는 `ACCOUNT=false`, `SYNC=false`, 대상 임시 사용자 `0명`,
원상복구 감사 이벤트 `1건`이었다.

## 5. 아직 닫지 않는 범위

- 서로 다른 브라우저 프로필 두 개를 사용한 A/B 화면 격리는 아직 실측하지 않았다.
- 실제 앱 화면에서 기기 계획·선수 기록·꾸미기를 계정에 연결하는 2단계 확인 흐름은
  아직 실측하지 않았다.
- 로그아웃·재로그인 뒤 이전 계정 메모리와 완료 영수증이 재사용되지 않는지는 아직
  실측하지 않았다.
- 두 기기 동기화, 삭제·복구 왕복은 아직 실측하지 않았다.

따라서 G8 전체는 닫지 않는다. 이번 영수증은 실제 계정 A/B 생성·로그인과 서버 RLS
교차 격리까지만 증명한다.

[DRAFT_COMPLETE]
