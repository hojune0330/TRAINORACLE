# 몸 기록 구현 · 진행 및 인수

기준: 2026-10-12, 오너 승인 계획 `reports/plans/BODY_HISTORY_AND_FOCUS_INTERACTION_2026-10-12.md`.
시작 HEAD: `15d8aceb772c4c1c403768a7dc18b6dd34e36a75`. 서버 공개·배포는 이번 승인에 포함하지 않는다.

## 역할과 필수 경계

- Root: 세 작성 양식·임시 입력·일지 원문·진입/복귀 통합, 최종 확인.
- Luna focus: 승인 비트맵 확대, 기타 입력과 재사용, 키보드·뒤로가기.
- Luna history: 기존 일지에서 부위별 이력 계산, 빈 상태·같은 날 여러 기록·소유 범위.
- Sol private contract: v4 계정 일지, 비공개 companion, 숫자 안전 경로, 백업·구형 편집 보호.
- 하단 5탭 유지. `일지 → 몸 기록`, 작성 중 읽기 전용 이력 레이어.
- 이름·메모·안정 ID는 개인 저장/읽기 전용. 분석·로그·AI 입력으로 사용하지 않는다.
- 기존 고정 부위 좌우 ID 변경 없음. 1–5 안전 기준 변경 없음.
- 부위 이름만 재사용. 이전 정도·메모 자동 복사 없음. 미기록을 0/회복으로 해석하지 않는다.

## 구현 인수

- [x] 생성 bitmap 앞/뒤 확대, 명확한 부위 이름, 이미지 실패 시 선택 유지.
- [x] 기타 생성·중복 이름 재사용 제안·이름만 재사용·마지막 항목 명시 해제.
- [x] Evening/Post/Quick 작성·수정·초안·원문 연결. 기타 정도는 companion 한 곳에만 저장.
- [x] 일지/몸 기록 전환, 원문과 작성으로 이동. 하단 5탭 유지.
- [x] 소유자별 원본에서 이력 계산. 같은 날 여러 기록을 합치지 않고, 미기록을 0으로 채우지 않음.
- [x] 분석/안전 내보내기에서 이름·메모·안정 ID 제외. 기존 안전 판정에는 숫자만 전달.
- [x] 계정 JOURNAL v4 지원 확인과 구형 편집/누락 거부. 전체 백업 v6 및 비공개 이름·메모 복원 선택.
- [x] 현재 앱의 미지원/손상된 metadata 원본을 일반 저장이 덮어쓰지 않도록 차단.
- [ ] 이미 배포된 구형 기기 앱의 v1 writer 소급 보호 — 아래 배포 P1 참조.
- [ ] 오너 공동 검수, 실계정 왕복, 실제 배포 — 이번 실행과 별도.

## 실제 확인한 근거

전체 검사 반복 대신 변경 경계만 실행했다. 모든 기록은 합성 자료다.

| 묶음 | 실행 근거 |
|---|---|
| 몸 선택 UI | `BodyPartFocusView.contract` + `SafeAccessibility`: 18/18. Escape/Back/포커스, 최근 이름만 재사용, 길이 제한, 이미지 실패, empty companion |
| 입력 전환 | `BodyPartMetadataTransition.contract` 2개 실제 DOM 저장 경로 통과. Post의 불편 없음, Quick의 휴식으로 변경할 때 이전 기타 신호 제거·empty companion 유지. focus와 합친 실행은 13/13 |
| 이력 | `body-history`: 5/5, `BodyHistory.contract`: 6/6. 같은 날 별도 원본, 없는 부위 0 채움 금지, 제어 선택·scope 변경 |
| 저장/계정/복원 | body metadata, owner scope, account API, RestoreBackup 4파일 145/145. 저수준 저장·휴식·홈 근접 5파일 51/51. 실제 서버 적용과 다름 |
| 이동·초안 | browserNavigation, useTaskFlowBack, useReaderDialog, form-input-draft, app-shell-state: 5파일 55/55 |
| 실제 로컬 브라우저 | `app/e2e/body-history-flow.browser.mjs`: 13개 관측, pageerror 0. 320/375/1280px, 150% root 글씨 설정, 전·후면 이미지 decode, 44px 조작, 이미지 실패 |
| 실제 저장/복귀 | 기타-only 정도 4 저장·분석/내보내기 글 제외, 원본→Back 선택 유지, 원래 월 유지, 이력→오늘 입력에서 이름만 재사용, 작성 중 원본 중첩 창 Back, 기존 무릎 2 초안 유지 |
| 타입/번들 | pinned Node 24.19.0으로 TypeScript 및 Vite production build exit 0. 기존 폰트 경로/정적·동적 import/큰 chunk 경고는 남음 |

저장 작업자의 최종 좁은 재실행: metadata/owner scope/account API/journal-update/
private-memo-vault/home-view-model 6파일 148/148. server record validator와 5개 이름 기반
메모리 내 결함 주입 104/104. record/plan/state 생성 validator 세 종류의 `--check` 통과.
서로 겹치는 실행을 합산해 서로 다른 테스트 총수처럼 보고하지 않는다.

최종 보완: metadata/read-snapshot/account-cutover 3파일 29/29, 실제 local storage·vault
저장동시성/영속성/rotation 5파일 28/28, 전체 로컬 Supabase gateway 87/87.
schemaVersion 99 합성 원본에서 `readStatus=uncertain`, 안전용 읽기 uncertain,
훈련 판단 `RECENT_JOURNAL_REQUIRES_REVIEW` 차단을 직접 확인했다. 새 형식을
읽지 못한 것을 통증 없는 빈 기록으로 해석하지 않는다.

브라우저 캡처와 구조화 관측은 무시되는 로컬 경로
`app/.codex-calendar-visual-qa/body-history-20261012/`에 있으며 공개 자료나 CI 산출물이 아니다.

결함 주입은 안전 숫자 누락·글 유출·v4 gate 삭제·구형 수정의 companion 누락·미지원
snapshot 손실을 각각 잡았다. UI 이력의 값 손상, form draft companion 제거도 명명된
테스트가 실패했다. 동일 POP 재처리 방어를 제거하면
`does not reinterpret an inspected parent POP as closing the flow mounted by that POP`가
실패하는 것을 확인했고 즉시 복원 후 navigation 16/16을 다시 통과했다.

이번 실제 브라우저 검수에서 발견하고 고친 것:

1. 320/375px 확대창·입력칸의 padding 포함 너비 초과.
2. 6개 정도/해제 버튼 한 줄에서 해제 글자가 세로로 찌그러짐 → 해제 행 분리.
3. 원본→Back의 같은 POP을 다시 읽어 새로 열린 몸 기록 선택까지 취소 → 이벤트당 한 번만 검사.
4. 원문 이동 시 부모 Back 표식이 같이 복사되어 새 화면을 닫음 → 명시적 navigation handoff.
5. 이력 닫기의 비동기 Back이 다음 부위 창을 닫음 → 실제 닫힘 이후에 부위 선택 열기.

Luna는 신규/기존 중학생·여러 부위·긴 메모·기타만·키보드·모바일 Back·계정 전환
8개 가상 경로를 독립 코드 검토했다. 실제 학생 8명 시험이나 모든 경로의 실계정 E2E가 아니다.

## 배포 전 P1: 구형 기기 전용 앱

새 클라이언트의 보호와 계정 v4 capability는 확인했다. 그러나 **이미 캐시된 구형 앱**은
기존 `trainoracle.journal.v1` 전체 배열을 새 companion 없이 재저장할 수 있다.
옛 바이너리에 없는 검사까지 이 패치가 소급 실행한다고 주장하지 않는다.

- 권고: 새 canonical 기기 저장소로 분리. journal만이 아니라 vault/owner/trash/삭제/복원
  rollback까지 같은 이관 경계를 사용하고, 기존 원본은 보존한다.
- 옛 v1에 나중에 생긴 변경을 새 원본과 조용히 합치지 않는다. ID가 같아도 이름·정도를
  자동 재결합하지 않고 충돌로 다룬다.
- 대안 recovery shadow는 별도 민감정보 복사본의 생성·삭제·용량 실패 계약이 필요하다.
  현재 구현에 임의로 추가하지 않았다.
- 오너에게 저장소 분리 진행 여부를 확인했다. 결정 전 이 기능의 운영 배포는 보류한다.

## 릴리스 구분

- 구현 및 위 로컬 검증: 완료. 추가 좁은 회귀 결과는 아래에 기록한다.
- 원격 main 비교: 2026-10-12 확인 당시 HEAD와 origin/main 모두 `15d8aceb`.
- 커밋·푸시: 이 보고서 확정 후 변경 파일만 저장소 규칙에 따라 수행. 최종 응답 SHA를 따른다.
- CI: 전체 CI 실행하지 않음. 자동 앱 게시를 막기 위해 커밋에 `[skip ci]` 사용.
- 배포/계정 공개/DB 작업/실계정 왕복: 수행하지 않음.
- 관련 없는 PR #354/#355/#356, 기존 미추적 캡처·에셋은 병합·삭제·포함하지 않음.

## 별도 단계

### 같은 날 후속 승인·구현

위 배포 전 P1의 저장소 분리는 이후 오너가 승인했다. `to-local-journal.*` 분리,
옛 원본 보존, 명시적 충돌 처리와 삭제·복원 정리를 구현했다. 최신 진행·검증·남은
릴리스 경계는 `CANONICAL_LOCAL_JOURNAL_IMPLEMENTATION_2026-10-12.md`를 따른다.
위의 이전 SHA·검사 수치·승인 대기는 당시 기록이며, 이번 후속 작업의 현재 상태가 아니다.

부상 에피소드, 추세 그래프, 완치 판정, 코치/보호자 공유, 자동 처방 변경은 이번 구현에 포함하지 않는다.
계정 서버의 실제 배포와 실계정 왕복은 로컬 구현/계약 테스트와 구분해 보고한다.

## 2026-10-12 추가 승인: 기기 내 저장 분리·보존 보완 — 검수 중

오너는 **기기 내 저장 분리·보존 보완**을 추가 승인했다. 서버 DB는 그대로 둔다.
이는 새로운 서버 보관/공유/분석/진단 권한이 아니며 계정 v4, Edge, SQL, 공개 관문,
훈련 숫자와 승인된 몸 입력 UI를 바꾸지 않는다. 아래 구현은 아직 릴리스 완료가 아니다.

- 논리 v1 키의 기존 기록·암호화 금고·소유권·휴지통·tombstone, 존재하는 scoped sync
  recovery checkpoint만 같은 기기 adapter로 연결한다. 실제 신규 쓰기는 별도의
  `trainoracle.device-journal.v2:` namespace에 보관하고 v1 원본으로 dual-write하지 않는다.
- 최초 이관은 기존 원본을 지우지 않는다. immutable seed와 현재 commit/pointer를
  사용하며 정상 쓰기 후 과거 commit payload를 정리한다. 최초 seed/현재 상태 및 실제
  충돌 복구 외의 무제한 의료 수정 이력을 만들지 않는다. 최대 복사 구간의 quota 실패는
  성공이 아니며 원본을 보존하고 uncertain으로 닫는다.
- 새 canonical 읽기 뒤 v1 값이 달라지면 둘 다 보존한다. 같은 ID만으로 이름·정도·메모를
  재결합하지 않는다. pending/foreign generation과 미지원·손상 자료도 빈 기록으로 채우지 않는다.
- localStorage에는 native atomic CAS가 없다. immutable 후보와 부모·readback·경합 검사는
  복구 가능한 동기 경계이지, 모든 탭이 선형화된 DB 트랜잭션이라는 증명이 아니다.
- 명시적 삭제/휴지통 비우기/만료 정리는 durable owner-bound deletion intent와 함께 보관한다.
  legacy·seed·관련 owner의 checkpoint에서 제거가 확인되기 전에는 완료로 응답하지 않는다.
  앱 종료로 남은 정확한 redaction 중간값과 그 삭제의 후보만 재개할 수 있다. 별도의 옛 v1
  수정, 다른 owner의 같은 ID checkpoint, 검증 불가 복구 자료는 보존하고 닫는다.
- 전체 기기 삭제는 legacy/canonical/seed/recovery payload와 이미 복호화한 private cache를
  정리한다. 기존 기본 규칙대로 최소 삭제 표식·정확한 owner 연결만 남기며, 삭제 표식까지
  지우는 명시적 선택에서는 그것도 제거한다. 빈 fence는 옛 열린 탭의 재저장을 자동 이관하지 않는다.

### 검수와 보류 해제 조건

현재 구현/테스트 작성은 진행 중이다. 기존 몸 기록 검증 수치를 이 adapter의 검증으로
재사용하지 않는다. 신규 합성 계약에는 source 보존, late v1 write, 초기 복합 중간상태,
quota/readback, competing sibling, staged rollback, owner A/B, 삭제·새 ID 복원·완전 삭제,
bounded GC, 정확한 세 시점의 process-crash replay, scoped checkpoint 경계가 포함된다.
실제 UTC/KST 실행, 관련 저장·복원/권리·안전 회귀, 이름 기반 결함 검출, 타입 확인,
새 브라우저 프로필의 실제 두 탭 old-writer 증명 및 독립 리뷰가 끝나기 전에는 P1을
완료하거나 운영 배포 준비 완료로 표시하지 않는다. 실계정/실제 운영 기록 검증은 별도다.

### 운영 복구 경계

1. uncertain 상태에서는 v1/canonical/pointer/generation을 임의로 초기화·삭제·수정하지 않는다.
   원본을 다른 계정에 귀속하거나 단순 ID 기준으로 붙이지 않는다.
2. 이미 기록된 명시적 삭제 intent의 정확한 중간값이면 새 앱 읽기에서 같은 삭제를 재개한다.
   성공 응답·확정 readback이 없으면 삭제 완료라고 안내하지 않는다.
3. 계속 uncertain이면 두 가지 실제 원본이 충돌하거나 손상된 것이다. owner가 보존한
   원본과 선택한 복구 자료를 확인한 별도 복구가 필요하다. 에이전트가 실제 개인 행을 읽거나
   원문을 로그/보고서에 붙여 해결하지 않는다. 기본 백업을 성공한 전체 복구라고 과장하지 않는다.
4. 오너가 명시적으로 기기 전체 삭제를 택한 경우에만 전체 erase/fence 경로를 사용한다.
   이는 source 보호를 우회한 일반 migration cleanup이 아니며 삭제 실패 항목을 숨기지 않는다.

삭제 API의 `ok: false`/휴지통 helper의 `false`는 **삭제 완료를 확인하지 못함**을 뜻한다.
아무 변경이나 durable intent도 없었다는 보장이 아니다. 같은 탭의 미확정 mutation은
값 없는 invalidation event로 재조회를 요청하고 이미 복호화한 private cache를 지운다.
UI는 완료를 알리거나 원문이 반드시 그대로라고 단정하지 않는다. 기존 일반 실패 안내와
배치/동선은 유지한다. private async 저장은 owner ledger를 준비-only CAS pin으로 캡처하고
암호문 준비 뒤 owner/vault/journal을 한 canonical commit에 넣는다. 원래 owner 원시값,
active account/scope generation/recovery-code 검사를 유지하며 async 동안 전역 stage를 열지 않는다.
최종 quota 실패 뒤 별도 owner rollback이 필요한 ghost binding을 만들지 않는다.

### 추가 로컬 검증 기록 — 2026-10-12 (20계약 중간판)

기준은 통합 작업실 `40914f566241ba28be2a590bf67dce7c59fdc71c`와 본 추가 승인 변경이다.
이전 main/PR/몸 입력 검사 수치를 새 저장소 검증으로 대신하지 않는다.

- 신규 `journal-device-storage.contract.test.ts`: UTC 20개 통과. 로컬 worker 시작 문제를
  분리한 **threads 직렬 진단**이며 원래 forks의 worker START timeout(0 tests, exit 1)도
  보존한다. 원래 단언·제한시간·fixture는 바꾸지 않았다.
- 같은 신규 계약 KST: 원래 **forks 직렬**에서 20개 통과, exit 0. 세 process-crash 재개,
  다른 owner의 같은 ID checkpoint 보존, erase quota 실패 시 raw checkpoint 보존,
  두 private 저장 경로의 cipher-ready 단일 후보와 ghost owner 없음이 이름으로 확인됐다.
- 직접 영향 경계 17파일 UTC 검사는 완료하지 못했다. 원래 forks는 named 결과 없이
  시작 대기 후 중단했다. 같은 단언의 threads 진단에서는 `restore/backup-file`의
  **28개 named assertions**가 통과한 뒤 나머지 범위는 중단했다. 두 실행의 exit 1은
  중단 상태이며, 17파일 전체 통과 또는 나머지 16파일 통과를 뜻하지 않는다.
- 실제 설치된 TypeScript의 `tsc --noEmit`: 해당 20계약 단계 변경 소스에서 exit 0. 위 검사는
  확인된 Node **24.19.0**과 공식 `--preserve-symlinks --preserve-symlinks-main` 옵션을
  사용했다. 로컬 진단 옵션을 CI 설정·조건·timeout에 반영하지 않는다.

기존 private 저장/복원 단언을 느슨하게 바꾸거나 실패를 건너뛰지 않았다. 실제 개인
저장소·기록·키·세션을 조회하지 않고 합성 자료만 사용했다. 소스 고정 뒤 이름 기반 RAM
결함 검출, 독립 최종 리뷰, 새 브라우저 프로필의 실제 두 탭 검증 및 현재 exact candidate의
유지된 hosted 필수 CI를 통합 담당자가 별도 증거로 확정한다. 이 기록만으로 P1 보류를
해제하거나 커밋·main 통합·게시·실계정 왕복이 끝났다고 표시하지 않는다.

### 저장 구조 중복 통합 보류 — 2026-10-12 07:23 UTC

최종 게시 전 원격 재확인에서 main이 `6194f3f5`에서 `4266f022`로 전진했다.
별도 작업의 canonical 저장소 구현과 162파일 변경이 포함되어 있다. 그 구현은
`to-local-journal.*`, 중앙 저장 주소 계약 및 명시적 초기화/충돌 확인 UI를 사용한다.
본 작업실의 `trainoracle.device-journal.v2:` adapter를 기계적으로 함께 병합하면
서로 다른 활성 주소·초기화·삭제 경계가 겹친다. 둘을 동시에 제품 원본으로 채택하지 않는다.

본 작업 결과는 `d5245064ebf606d468b67fd3ffef048ea8cc9c0f`까지 별도로 보존했다.
핵심 23계약, 기존 vault lifecycle 7계약과 publication failure 5계약, 앞선 main 통합
6파일 66계약은 각각 UTC/KST에서 통과했다. source 보존/owner CAS/guest 자동귀속 금지
등 RAM 결함 검출 6개 및 persistence 결함 검출 2개도 이름으로 확인했다.
실제 격리 두 탭의 전체 기록 바이트 보존은 기존 fixture 7단언/30조건으로 확인했다.
이 결과는 `4266f022`의 구현·전체 회귀·CI·배포를 검증한 수치가 아니다.

PR #355는 재통합 검토 중이며 지금 병합하거나 게시하지 않는다. 최신 main의 저장
구조를 기준으로 닫힌 라운지 연결 변경과 필요한 보호를 좁게 대조한 뒤, 단일 구조의
최종 SHA에서 유지된 필수 CI를 실행해야 한다. 보존용 WIP의 `[skip ci]`는 검사
성공·P1 해제·공개 관문 승인으로 취급하지 않는다. 기존 main과 에셋, 원본 자료는 보존한다.

### 기존 private 편집의 owner CAS 보완 및 최종 소스 검증

독립 검토는 신규 private 저장과 달리 기존 private 편집이 journal/vault 및 active account/
scope/recovery-code만 검사하고 전체 owner ledger를 고정하지 않는 경로를 추가 지적했다.
`updatePrivateEntry`도 암호화 전에 prepare-only ownership pin을 캡처하고 마지막 단일
commit에서 그 원시값을 확인한다. 이미 보이는 미귀속 기록을 편집하는 것은 계정 귀속
승인이 아니므로 **nextRaw는 previousRaw 그대로** 유지한다. 다른 owner로 변경된 장부는
덮어쓰지 않는다. 전역 stage를 async await 동안 유지하지 않는다.

- 최종 신규 계약 **23개**: UTC threads 직렬 진단 23/23 통과, KST 원래 forks 직렬
  23/23 통과, 모두 exit 0. 위 20계약 수치는 이 추가 보완 전의 역사 기록이다.
- 추가 세 반례: 실제 AES-GCM 암호화 중 ledger만 다른 owner로 변경하면 편집 거부,
  같은 ledger의 정상 암호화 편집 유지, 미귀속 기록의 자동 계정 귀속 없음. 변경된 ledger,
  실패한 편집의 기존 journal/vault 및 비밀 body metadata도 확인한다.
- 최종 편집 보완 후 실제 설치 TypeScript `tsc --noEmit` exit 0. Node/공식 symlink
  보존 옵션과 원래 타입 설정을 유지하며 CI 정의나 timeout을 바꾸지 않았다.
- 이름 기반 RAM 결함 검출 **6개**: late v1 companion 보호 제거, 타 owner checkpoint
  경계 제거, 이전 민감 payload GC 제거, cipher-ready owner/vault/journal 후보에서 owner
  제거, 기존 edit의 owner CAS 전달 제거, edit에서 미귀속 기록을 자동 귀속하는 결함.
  현재 원본 양성은 통과하고 결함마다 지정한 이름의 단언이 실제로 실패했다. worker 시작
  오류나 실패 개수만으로 판정하지 않았다. 대상 원본 파일 SHA-256은 전후 동일했다.

로컬 소스 검증은 여기까지이며 전체 17파일 회귀 중단 사실은 그대로 남긴다. 실제 두 탭
브라우저 검증, 독립 최종 검수, 최신 main 정상 통합 후 원본 hash 보존, exact candidate의
유지된 hosted 필수 CI 및 운영·실계정 관문은 통합 담당자의 별도 증거를 따른다.
커밋·푸시·main 병합·게시·계정 공개 완료를 이 보고서에서 선행 선언하지 않는다.
