# 월간 목표 계획 계정 저장: 운영 공개 준비 상태

작성일: 2026-10-11. 작업 기준: `09c917f5`.
담당 범위는 신규 native 경합 검사와 이 인계서 두 파일이다.
계정·운영 DB·Edge·인증 공급자·공개 설정은 변경하지 않았다.

## 이번에 완료한 경계

월간 저장의 실제 PostgreSQL 경합 검증을 추가했다.
기존 [로컬 구현 인계](../implementation/GOAL_PROGRAM_ACCOUNT_STORAGE_2026-10-11.md)의
PGlite 단일 세션 검사를 보완하며, 실계정이나 서버 배포를 대신하지 않는다.

설치된 PostgreSQL 17.6과 Node 24.19.0을 사용한다. 기존
`supabase/tests/concurrency/local-postgres.mjs`의 제한을 재사용하여 새 임시 cluster,
`127.0.0.1`의 무작위 높은 포트, 생성한 DB 이름만 허용한다. 기존 DB·외부 URL·
비밀 환경·인증 파일을 사용하지 않는다. observer와 writer 둘의 backend PID가 서로
다름을 확인하고 `pg_blocking_pids`와 실제 advisory lock 대기를 관측했다.

| 검사 | 확인한 서버 경계 |
| --- | --- |
| support | 0001–0062 전체 원문과 월간 SQL 제안 적용, 기존 DRAFT 저장·동일 영수증 재사용, 추가 SQL의 기능 스위치 불변 |
| cas | 새 INDEX와 기존 INDEX에 대한 두 연결 경합의 단일 CAS 승자, 정확한 저장/충돌 영수증, 패자 측 immutable part 보존 |
| idempotency | 동일 operation 동시 재시도는 한 영수증·한 revision, 같은 operation의 expected revision 변경 거절 |
| isolation | A의 잠금 중 B의 정상 저장, RLS의 타인 암호문/영수증 제외, 타인 참조 및 다른 owner의 attestation 거절 |
| withdrawal | 철회 중 대기한 INDEX가 재동의 뒤에도 거절됨, 소거된 참조와 옛 동의 pin으로 쓸 수 없음, 현재 pin의 새 요청은 정상 저장 |

신규 5개와 기존 연결 제한 검사 3개가 통과했다. disposable cluster 안의 함수에서
참조 검증 호출만 제거하면 `isolation: B progresses while A holds its lock and cannot
borrow A references or owner attestation` 검사가
`Attested metadata cannot borrow another owner part` 단언에서 실패한다.
이때 원래 `22023/GOAL_PROGRAM_REFERENCE_UNAVAILABLE` 거절 대신 `saved`가 반환됐다.
결함 없는 새 cluster에서 정상 검사를 재확인했다. 실제 소스나 migration에 결함을
남기지 않았다.

첫 sandbox 실행의 PG 경로 `realpath` EPERM은 cluster 시작 전 환경 실패였다.
첫 native 실행은 4 통과·1 실패였으며 새 검사에 잘못 적은 예상 오류명 한 곳을
실제 `ACCOUNT_JOURNAL_OPERATION_REUSED`에 맞췄다. 최초 결함 주입 시도의 SQL 문장
종결 누락도 하네스 준비 오류로 구분하고 교정했다. 둘을 제품 결함 또는 결함 검출
증거로 계산하지 않는다.

원문 해시(SHA-256)는 결함 주입 전후 동일하다.

| 파일 | SHA-256 |
| --- | --- |
| `supabase/operations/goal-program-account-storage.sql` | `185C64328204571B572DC45D4526B6D2EB2C01BC4AB1946B85EFE1F05C1E668D` |
| `supabase/functions/_shared/account-journal-handler.mjs` | `ECB0545C4D3657F466EEC040D87ADBDD55E7F20A49E69042321E45EC6C2D9BF7` |
| `supabase/functions/_shared/account-state-validator.mjs` | `72B11551CB5A9ACE1EF8453ED0D4A546DD5362914D51166FA611B22A1FB142D2` |

합성 cluster는 각 실행의 종료 기록에서 STOPPED를 확인했다. 데이터 디렉터리는
공유 하네스 정책대로 임시 폴더에 보존하며 삭제하지 않았다. 이는 개인 자료가
없는 합성 fixture이고 운영 백업 또는 복원 증거가 아니다.

## 원격에 실제로 남은 차이

아래는 통합 담당자가 2026-10-11 공식 Supabase MCP의 읽기 전용 metadata로 확인하여
전달한 목록이다. 이 담당자는 원격 개인정보 행·비밀값·함수 원문을 조회하지 않았다.
프로젝트 이름 `trainoracle-beta-staging`을 안전한 폐기용 시험 환경이라고 해석하지 않는다.

| 대상 | 전달받은 현재 metadata | 이 결과의 의미 |
| --- | --- | --- |
| DB | `0001..0038`, `0040`, `0045..0050`, `20261008004304(0041_lounge_admission)`, `20261008014327(0042_lounge_scoped_grants)`, `20261008062348(0063_lounge_identity_deletion_outbox)` | 로컬 `0051..0062`가 원격 적용 목록에 없음. 숫자/이름 목록은 SQL 내용이나 같은 이름의 동등성을 증명하지 않음 |
| Edge | `account-journal` version 13, `account-plan-collection` version 12 | 배포 버전 metadata이며 최신 월간 handler/validator와 같다는 증거가 아님 |

로컬에는 `0039`, `0043`, `0044`도 있으며 원격 목록과 다르다. timestamp로 등록된
`0041`·`0042` 및 원격 `0063`은 정확한 정의와 후속 의존 관계를 대조해야 한다.
목록에 없는 숫자를 일괄 push하거나 이미 적용된 동등 SQL을 재적용하면 안 된다.
현재 연결 가능한 서버가 있다는 것과 새 기능을 배포할 준비가 됐다는 것은 별개다.

월간 SQL은 여전히 [operations 제안](../../supabase/operations/goal-program-account-storage.sql)이다.
정식 migration은 생성·적용하지 않았다. PATH, app 의존성 shim 및 확인한 표준 설치
후보에서 Supabase CLI를 찾지 못했고, 외부 CLI 설치도 수행하지 않았다.
PostgreSQL 설치는 발견했지만 Docker와 Supabase CLI의 존재를 대신하지 않는다.

## 월간 지원 준비 배포와 계정 전체 공개의 실행 순서

월간 서버 지원을 추가한 채 계정 공개 보류를 유지하는 단계는 전체 계정 공개와
별도다. 현재는 두 단계 모두 원격 chain/관련 코드 대조가 먼저 필요하다.

1. 원격의 migration 정의와 로컬 대응을 정리하고 적용 대상·의존 순서·기존 상태
   보존 및 되돌리기 방법을 검토한다. 이는 migration history 수정이나 운영 SQL
   실행을 자동 승인하지 않는다.
2. 검증된 공식 CLI를 확보해 실제 `--help`를 읽고
   `supabase migration new goal_program_account_storage`로 파일을 생성한다.
   이름이나 timestamp를 임의로 만들지 않는다. 공식 문서도 직접 SQL을 작성하는
   프로젝트에서 이 경로와 전체 local chain 검증을 지원한다.
   [Supabase local development workflow](https://supabase.com/docs/guides/local-development/cli-workflows)
3. 생성된 파일에 검토한 SQL을 넣고 실제 적용 대상 chain과 함께 검사한다.
   이 인계서의 0001–0062 합성 전체 chain은 현재 원격과 동일한 복제본이 아니므로
   원격 환경의 정합성 검사로 재사용하지 않는다.
4. 별도 승인된 DB/Edge 실행에서 같은 gateway·generated validator·SQL을 배포하고,
   기능 스위치는 현재 검토된 보류 상태를 보존한다. 합성 인증·origin·지원 probe,
   구형 클라이언트 거절과 정상 대조군을 검증한다. 운영 연결·실계정 시험·허용
   설정 변경은 이 로컬 검사의 권한에 포함되지 않는다.
5. 이후 계정 전체 공개는 [계정 공개 게이트](../../docs/ACCOUNT_PUBLIC_RELEASE_GATE.md)의
   현재 조건을 각각 충족하고 실제 공개 SHA·회원 왕복을 확인한다.

전체 공개에서 남은 주요 조건은 전용 origin(G12), Hosted Auth 남용 방지와 제공자
제한(G13/G14), 최신 admission/consent/erasure DB·Edge 왕복(G7/G15), 실제 처리업체·
국외 처리·로그·백업 및 최소 원장의 보유/소거 조건과 검토 증거(G1/G2/G5/G6/G16),
가입·두 계정/브라우저·권리열람/삭제/재로그인 실측(G4/G8/G9)이다.
이 작업은 법률·운영 사실을 만들어 승인하거나 9월 실계정 영수증으로 10월 재개
조건을 닫지 않았다.

## 재실행 명령과 인계

```powershell
& 'C:\Users\admin\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' 'supabase\tests\concurrency\goal-program-account-concurrency.test.mjs' --run --pg-bin 'C:\Program Files\PostgreSQL\17\bin'
& 'C:\Users\admin\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --test 'supabase\tests\concurrency\local-postgres-guard.test.mjs'
```

참조 검사 결함 대조는 첫 명령에 `--case isolation --mutation reference-check`를
추가한다. 정상 결과는 exit 0, 의도적 참조 결함 결과는 지정 단언에서 exit 1이다.
`--run`이 없으면 DB를 시작하지 않고 다섯 검사를 opt-in skip 처리한다.

Lean CI 분류는 인증·소유자·DB 경계의 critical 영향 검사다. 새 테스트와 기존
연결 제한만 실행했다. 제품 파일·타입 계약·번들·workflow를 변경하지 않아 전체
앱 시험과 build를 반복하지 않았다. 통합 담당자의 별도 제품 변경·필수 CI·공개
배포 검증은 이 결과에 합산하지 않는다. 커밋·push·원격 쓰기·계정 공개는 이
담당 범위에서 실행하지 않았다.
