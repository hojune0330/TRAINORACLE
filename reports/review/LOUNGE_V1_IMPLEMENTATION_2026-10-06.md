# 라운지 v1 — 최신 소스 구현·검증 인계

2026-10-06 KST. **로컬 구현과 유지되는 검사는 완료했지만, 배포·운영 활성화·실계정 증명은 완료하지 않았습니다.**

## 소스와 변경 범위

- 현재 체크아웃: `output/animal-app-release/trainoracle-current-v1`.
- 현재 공식 `main`: `99f2291150dd191f738e796c4dd93220b8c75999`.
- 최초 이식 기반은 `4ce25ed4f1e454513173e4d7cd93c0691892d003`입니다. 이후 원격 1커밋/35파일 추가를 root가 읽기 전용 비교하여 우리 15파일 중첩 0·`0063` 충돌 0을 확인하고, 미커밋 이식본을 보존한 `--ff-only`로 갱신했습니다. 앱 구현 해시는 그대로입니다.
- 이전 `trainoracle` 체크아웃은 그대로 보존했습니다. `6e76f55`의 57개 마이그레이션·121개 검사 결과는 과거 증거이며 최신 main 결과로 사용하지 않습니다.
- 이전 체크아웃은 로컬 1개 / 원격 713개 커밋으로 분기돼 fast-forward가 불가능했습니다. reset, stash, 기존 파일 강제 덮어쓰기·merge는 수행하지 않았습니다.
- 선정된 구현 파일만 수동 이식했습니다. 최신 main의 숨겨진 훈련 계획 보존 API 및 저장 동의·계정 권리 정책은 유지했습니다.
- commit, push, workflow 수정, 환경·비밀 파일 읽기, 운영 SQL·계정 삭제, 외부 worker 송신·자동 실행 활성화는 수행하지 않았습니다.
- 같은 package-lock 해시를 확인한 뒤 무시되는 로컬 의존성 junction만 재사용했습니다. 패키지·lockfile 변경이나 다운로드는 없습니다.

## 구현 결과

1. 기존 navigation의 두 번째 `preserveMountedDrafts` boolean과 `canPreserveMountedDraft` 계약을 보존했습니다. 세 번째 현재 수명 검사만 추가했습니다. 각 callback 전후에 권한을 다시 확인하고, 해제된 guard는 검사하지 않습니다. 강한 차단 우선순위 및 모든 소유자 확인 뒤 폐기 순서를 유지하며 지연 continuation은 한 번만 실행됩니다. 재진입·중복 resume를 막고 정상 동기 resume는 지원합니다. 이동 함수가 예외를 던지면 성공했다고 보고하지 않습니다.
2. LoungeEntry의 대기 continuation을 화면·소유 계정·인증/세션 세대·abort·최신 시도에 묶었습니다. unmount/remount, 계정 변경, 같은 계정의 재요청, 상태 재확인과 새로운 입장 시도는 이전 continuation을 초안 부작용 전에 무효화합니다. 합성 guard 검사만으로 실제 AppShell에서 모든 독립 초안 작성기가 함께 마운트된다고 주장하지 않습니다.
3. 실제 서버 만료 시각과 추가 capability를 사용합니다. TTL을 추측하거나 토큰을 저장하지 않습니다. 구형 서버에서 만료가 불명확한데 초안이 있으면 안전하게 차단합니다. 대기·확인이 오래 걸려 만료되면 초안을 보존하고 명시적 재시도만 허용합니다. 자동 ticket POST는 없습니다.
4. 실제 `0001–0062` 다음에 `0063` 삭제 송신함을 추가했습니다. 최신 계정 삭제 요청의 세션 확인, **즉시 삭제 대상화 및 원자적 목적별 저장 철회**를 보존했습니다. 이전 소스의 30일 지연 정책은 재도입하지 않았습니다.
5. 대기열은 subject/request UUID, 상태와 처리·재시도/lease 시각·UUID만 보관합니다. 계정 FK가 없으므로 원격 확인 전 최소 참조는 로컬 계정 정리 뒤에도 유지됩니다. 이메일·일지·건강·대화·인증 정보는 넣지 않습니다. 서비스 전용 claim/complete/retry RPC만 허용하며 테이블 직접 접근은 철회합니다.
6. 별도 invoke·receiver 전용 키, 엄격한 HTTPS endpoint, 시간 제한·backoff·동일 요청 재시도와 정확한 COMMIT ACK를 사용합니다. 출력은 집계 수치뿐이며 식별값·키·원시 오류를 반환하지 않습니다. 운영 증명이 없으므로 공개 활성화는 닫힌 상태입니다.
7. 무료 실행시간 예산을 위해 순차 worker는 **배치 3개**만 요청하고 초과 응답은 송신 전에 거부합니다. `8 + 3 * (8 + 8 + 8) = 80`초의 보수적 I/O 예산은 SQL lease 120초 및 공식 무료 wall-clock 150초 아래입니다. SQL 범용 RPC의 최대 10개는 유지하며 이 worker는 3개만 요청합니다. 이는 통신 timeout 예산이지 실측 운영 지연·CPU 증명이 아닙니다. [Supabase 공식 제한 문서](https://supabase.com/docs/guides/functions/limits)를 agent-reach 웹 경로로 2026-10-06 확인했습니다.

## 정확한 변경 파일

수정:

- `app/src/domain/lounge/adapter.ts`
- `app/src/domain/lounge/adapter.contract.test.ts`
- `app/src/domain/unsaved-draft-navigation.ts`
- `app/src/domain/unsaved-draft-navigation.test.ts`
- `app/src/screens/account/LoungeEntry.tsx`
- `app/src/screens/account/LoungeEntry.contract.test.tsx`
- `supabase/config.toml` — 새 function만 추가, 최신 기존 function 목록 보존.
- `supabase/tests/local-postgres/package.json` — 유지되는 검사 명령만 추가.

신규:

- `supabase/functions/_shared/lounge-identity-deletion-worker.mjs`
- `supabase/functions/lounge-identity-deletion/index.ts`
- `supabase/migrations/0063_lounge_identity_deletion_outbox.sql`
- `supabase/tests/local-postgres/lounge-identity-deletion-outbox.test.mjs`
- `supabase/tests/lounge-identity-deletion-worker.test.mjs`
- `docs/handoff/lounge-identity-deletion.md`
- 이 보고서.

### 최종 복원 소스 SHA256

최종 복원·무료 배치 제한 검사 이후의 로컬 소스입니다. 배포 SHA 증거가 아니며 보고서 자신은 제외합니다.

```text
app/src/domain/lounge/adapter.ts F96BF8657686AE11AC4D0481CB8CB42C3FAA869EC02EC36B7A0EAD38F8B1E0A2
app/src/domain/lounge/adapter.contract.test.ts 686417944BB662AB0DBD428B98B828E33408575ECA3A0DB6A1DA3520E6D96277
app/src/domain/unsaved-draft-navigation.ts A7B7FDD94DD88E359B850EE554296E924F6BF4B11120F91F4A30356C12575266
app/src/domain/unsaved-draft-navigation.test.ts CD30348BABAA546E5C2DE1DF3A624CA6050ECAFCA5A3AB534417DF82F1E67A98
app/src/screens/account/LoungeEntry.tsx 6DCD55E01DA88283BD00D0197EC719C7867ED98FFD58AAA4A1C92042D6915726
app/src/screens/account/LoungeEntry.contract.test.tsx 349F9E62614EE3BACE9A45A0883296821FB24D217A2766EE3DAE8DCFDC12FEE7
supabase/config.toml 2366E939563DFF6390C9DC63C82B82F25D28FE803332F15D9CF13C9AD4E59754
supabase/tests/local-postgres/package.json 6F638F12A65F4523D1E4207F7639035AB3C6BD449BA04CBE6D5DD3C3CC29319D
supabase/functions/_shared/lounge-identity-deletion-worker.mjs 1261C366C18CCD50D4F0D088A13B22BC58E3DCA47DA1881E14679E8D86EE5B69
supabase/functions/lounge-identity-deletion/index.ts 02104FDAE251CEB11EB29BB225012C588432D8911CADB67D47AC8097D6799CA2
supabase/migrations/0063_lounge_identity_deletion_outbox.sql 96B26477A31492300F5D13CD7CEA074A3372BB3E87F82660D41965E84CDA30B1
supabase/tests/local-postgres/lounge-identity-deletion-outbox.test.mjs 3D4227A5AD4C035D34F9044917F82AA61A78F4176100101DF020909F921BFF22
supabase/tests/lounge-identity-deletion-worker.test.mjs 277968BB997FE2F201241B0C3B6307804532580F72D9E601420EE4EF74FCED19
docs/handoff/lounge-identity-deletion.md 0D106FEF71B0CEED77B3EF172E596DF15584345E3E0CD3F21AF5E416E41BE72C
```

## 실행한 최신 소스 검사

| 검사 | 결과와 증거 범위 |
| --- | --- |
| 설치된 Vitest4.1.10 helper + adapter + LoungeEntry | **125 / 125 PASS**, 3개 파일, 종료 코드 0 |
| 최신 main 정합화 후 설치된 TypeScript `tsc --noEmit` | **종료 코드 0** |
| `99f2291` 이후 라운지 동일 3파일, UTC 재검사 | **125 / 125 PASS**, 종료 코드 0, 09:56:49 UTC, 10.74초 |
| `99f2291` 이후 라운지 동일 3파일, `vitest.config.kst.ts` 재검사 | **125 / 125 PASS**, 종료 코드 0, 18:57:43 KST, 11.50초 |
| `99f2291` 이후 기존 AppShell.navigation + StorageConsentPanel + BetaAccountSettings | **24 / 24 PASS**, 종료 코드 0, 09:58:01 UTC, 43.09초; 이전 대비 AppShell 검사 2건 추가 |
| `99f2291` 이후 설치된 TypeScript `tsc --noEmit` 재검사 | **종료 코드 0** |
| 실제 SQL `0001–0063`의 격리 PGlite + worker 모의 송신, 무료 제한 최종 복원 후 | **23 / 23 PASS**, 종료 코드 0; 즉시 삭제 대상 계정의 실제 purge 및 현재 저장 철회 포함 |
| 수명 확인을 잠시 우회한 고장 주입 | **17개 지정 실패 / 39 통과**, 종료 코드 1; callback 취소, owner/session/remount/new attempt/status retry/expiry를 검출 |
| account FK + 부정확한 ACK 허용 주입 | **3개 지정 실패 / 18 통과**, 종료 코드 1; 즉시 purge 생존·wrong-ID ACK·extra-field ACK |
| 배치 상수를 잠시 10으로 되돌린 고장 주입 | **3개 지정 실패 / 13 통과**, 종료 코드 1; 초과 응답·무료/lease 상한·실제 RPC `limit_input:3` assertion |
| 고장 주입 복원 | 최종 125개 UI 및 23개 SQL/worker 검사 통과. 임시 mutation·baseline 파일 없음 |
| 명령 범위 safe.directory를 사용한 tracked-file `git diff --check` | **종료 코드 0** |

root가 독립 실행한 KST 범위 검사도 `vitest.config.kst.ts`의 동일 frontend
3개 파일 **125 / 125 PASS**, 종료 코드 0으로 확인했습니다(18:53:34,
7.26초). 최초 sandbox 실행은 `setup.ts` realpath EPERM으로 검사 0개였고,
좁은 승인 재실행에서 성공했습니다. 이를 제품 실패나 최초 실행 PASS로
숨기지 않습니다. root 실행을 위해 앱 소스를 변경하지 않았습니다.

`99f2291`로 갱신한 뒤에도 SQL/worker 구현 및 실제 적용할 마이그레이션 소스는
변하지 않았습니다. root가 동일 실제 SQL/무료 제한 worker의 **23 / 23 PASS**,
종료 코드 0을 독립 보고했습니다. 이는 로컬 실제 SQL 증거이며 운영 DB 적용이나
스케줄 실행 증거는 아닙니다. 최종 보고서·handoff의 최신 기반 표기만 갱신했고,
앱·SQL·worker 파일은 이번 재검사 과정에서 수정하지 않았습니다.

SQL 검사는 실제 마이그레이션을 합성 계정/세션 데이터에 적용하여 rollback·기존 삭제 요청 backfill·잘못된 owner/취소 session·권한·lease/backoff·stale ACK를 검사합니다. worker 원격 응답은 모의 데이터입니다. 이 결과를 native PostgreSQL 동시성·TLS·배포된 Supabase·실제 두 앱 송신 성공으로 해석하면 안 됩니다.

무료 제한 고장 주입에서 실패한 실제 유지 검사 이름:

- `oversized queue batch fails closed before remote send or local completion`
- `sequential worst-case batch stays within the free worker and SQL lease bounds`
- `repository uses only three scoped RPCs and abort signals, never account/journal table APIs`

## 현재 확대 검사는 통과 — 이전 실패는 이력으로 보존

공식 `99f2291`에는 기존 AppShell 진입 검사가 보완되어 있습니다. 구현 코드를
추가 수정하지 않고 재실행한 현재 확대 검사 3개 파일은 **24 / 24 PASS**,
종료 코드 0입니다. 아래 과거 실패였던 mounted-training 검사는 현재
**PASS(809ms)** 입니다. 기존 22개가 아닌 24개인 이유는 최신 AppShell 검사
2건 추가이며, AppShell 10 + BetaAccountSettings 10 + StorageConsentPanel 4입니다.

이는 선정된 확대 검사의 현재 통과이지 전체 CI/배포/운영 증명은 아닙니다.
아래 내용은 `4ce25ed` 때의 실패 비교 이력으로 남기며 현재 실패 상태로
보고하지 않습니다.

기존 AppShell + StorageConsentPanel + BetaAccountSettings 검사는 **21 PASS / 1 FAIL**, 종료 코드 1입니다.

실패: `AppShell origin-preserving navigation > keeps the selected training step mounted while recording and returns without a reset`.

AppShell navigation 검사 줄 33에서 첫 훈련 화면의 `어떤 종목을 준비하세요?` heading을 찾지 못하며, 이후 mounted-plan 비교 assertion 이전에 실패합니다. 최신 main의 **원래 navigation helper만** 시험 alias로 적용한 동일 단독 검사도 **1 FAIL / 7 SKIP**, 종료 코드 1, 같은 위치에서 재현됐습니다. helper 변경의 비교이지 모든 파일이 pristine이었다는 주장은 아닙니다. 임시 파일 2개는 제거했습니다. 첫 alias 정규식 오류로 발생한 import/setup 실패(검사 0개)는 제품 증거에서 제외합니다. 느린 lazy load 가능성은 가설이며 원인으로 확정하지 않았습니다.

이전 실패를 전체 gate 성공으로 바꾸어 기록하지 않습니다. 현재 선정 검사는
통과했지만 전체 출시 gate/CI 및 운영 검증은 별개로 남아 있습니다.

## 별도 AthleteTime frontend 작업

이전 AT 체크아웃의 승인 범위만 수정했습니다.

- `frontend/src/App.tsx`: 기존 경로·인증·Layout·Routes를 유지하고 data-router 경계만 추가.
- 신규 `features/lounge/DraftLeaveGuard.tsx`, `draftLeaveDecision.ts`, `DraftLeaveGuard.test.ts`.
- 설치된 실제 memory-router 검사 **12 / 12 PASS**: imperative/back/forward, 취소/승인, 중복/reentrant/stale/unmounted, clean positive, query/hash.
- 변경 파일 ESLint 종료 코드 0.
- AT 전체 타입 검사는 별도 avatar의 Object3D/AnimationObjectGroup/Group 오류로 종료 코드 1. App/guard 진단은 없고 담당자에게 전달했습니다. 소유 범위 밖 avatar는 수정하지 않았습니다.
- root 담당: guard 삽입, 기존 anchor 중복 confirm 제거, 외부 연결 명시 확인, 실제 브라우저 QA. memory-router 검사를 렌더된 hook·실기기 증거로 주장하지 않습니다.
- 최신 AT 보안 소스 정합화는 별도 담당자의 작업입니다. 이전 체크아웃 검사를 최신 AT-main 증거로 주장하지 않습니다.

## 운영 활성화 전 남은 사항 — 비밀 이름만 기록

현재 `99f2291`의 공식 CI도 아직 통과 상태가 아닙니다. root가 조회해 전달한
실행 `37444183110`은 `app-quality / Run app unit tests` **FAIL**,
`contract-tests` **PASS**, `app-browser`·`deploy-pages` **SKIPPED**입니다.
로컬 선정 125개·24개 통과를 전체 CI green이나 공개 활성화 허가로 해석하지
않습니다. 이 필수 gate를 우회하여 공개 활성화하지 않으며, 소스 checkpoint
commit/push와 운영 배포·실계정 검증은 구분합니다.

순서는 `docs/handoff/lounge-identity-deletion.md`에 있습니다.

필요한 설정 이름: `TRAINORACLE_LOUNGE_DELETION_INVOKE_KEY`, `LOUNGE_TRAINORACLE_DELETION_KEY`, `TRAINORACLE_LOUNGE_DELETION_ENDPOINT`, 플랫폼 서버용 `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`. 값은 채팅·스크린샷·Git·브라우저 빌드·VITE 변수에 넣지 않습니다.

- 실제 migration ledger·권한·backup/restore 확인 및 적용.
- Edge/receiver 배포, 별개의 전용 비밀 주입.
- 승인된 실제 무료 scheduler와 실패·지속 대기 경보.
- native 동시성 및 실계정 두 앱 삭제·장애·ACK 손실·재진입·다른 issuer 보존 검증.
- 현재 소스 전체 출시 검사/CI와 독립 최종 리뷰.

이 증거가 없으면 보호 기능 기본 off와 준비 UI를 유지합니다. 코드가 있다는 사실은 운영 자동 실행이나 공개 활성화의 증명이 아닙니다.
