# 병렬 작업 통합과 보존형 수동 게시

```yaml
document_id: PARALLEL_RELEASE_GUARDS_2026_10_07
status: IMPLEMENTATION_CHECKPOINT
scope: completed_plan_changes_and_manual_release_tools
minigame_pr_349: DEFERRED_BY_OWNER
automatic_workflow_changed: false
account_public_gate_changed: false
```

## 이번 범위

오너가 미니게임을 뒤로 미루고 나머지 권장안의 진행 조정을 승인했다.
미니게임 PR #349의 코드, 자산, 공통 스타일 변경은 통합하지 않는다.

- 기존 완료 묶음 `0268ec74`는 Pages `e664844b`에 게시되었다.
- 개인 계획 후속 완료 커밋 `92cb6f08`, `93fcd638`만 별도 작업실로 가져왔다.
- 앱 화면을 다시 병렬 편집하지 않고 `.tools/`의 빌드·게시 보호만 추가한다.
- 다른 채팅에 후속 지시를 보내는 도구 호출은 권한 검토에서 거절되었다.
  지시가 전달되었다고 주장하지 않는다. 이후 확인한 두 작업은 이미 종료 상태였고,
  커밋된 결과만 읽어 통합했다. 다른 작업실의 수정·미추적 파일을 이동하지 않았다.

## 도구의 보장

`build-oracle-pages-release.mjs`는 정식 게시 묶음을 만들 때 다음을 검사한다.

1. 추적 파일과 실제 빌드 입력 위치의 미추적 코드가 없는 확정된 소스인지 확인한다.
2. 원격 main과 빌드 원본 SHA를 직접 비교한다. 오래된 remote-tracking ref만 믿지 않는다.
3. 공개 설정을 가져온 Pages SHA가 현재 원격과 같은지 확인한다.
4. 기존 내용이 있는 출력 폴더는 지우거나 재사용하지 않고 거절한다.
5. 빌드 후에도 소스·원격 상태를 다시 확인한다.
6. 계정 공개 보류를 필수로 유지하고 파일별 SHA-256 목록을 매니페스트에 남긴다.

`publish-oracle-pages-release.mjs`는 기본값이 읽기 전용 사전 점검이다.
실제 게시는 명시적인 `--publish`가 있어야 실행한다.

- 깨끗하고 독립된 최신 gh-pages 작업실만 받는다.
- 빌드 이후 추가·수정된 파일, 미리보기 전용 묶음, 계정 공개 묶음은 거절한다.
- `.git`, 환경 파일, `previews/`, 기존 배포 영수증을 새 빌드에 섞을 수 없다.
- 복사 전에 링크와 기존 assets 이름 충돌을 확인한다.
- 기존 미리보기·이전 해시 자산·CNAME 등은 삭제하지 않는다.
- 게시 직전 main과 Pages를 다시 확인한다. 정상 fast-forward push만 사용한다.
  다른 게시자가 먼저 올렸으면 자동 재시도·rebase·force push하지 않는다.
- 출력의 `PUSH_ACCEPTED_LIVE_NOT_VERIFIED`는 Pages built나 공개 동작 확인이 아니다.

### 2026-10-08: 같은 저장소의 수동 릴리스 중복 실행 방지

실제 빌드와 `--publish`는 Git 공통 디렉터리의
`trainoracle-manual-release.lock`을 배타적으로 만든 뒤 작업한다. 같은 저장소의
연결된 worktree에서도 하나만 실행한다. 출력 폴더·Pages 작업실을 동시에 쓰거나
무거운 빌드를 중복 실행하지 않도록, 대기열 대신 `MANUAL_RELEASE_BUSY`로 중단한다.
읽기 전용 `--inspect-only`와 게시 사전 점검에는 잠금을 만들지 않는다.

- 담당자를 하나 정하고 소스 통합을 마친 뒤 릴리스 빌드를 한 번 수행한다.
  독립 검토·파일 소유권이 나뉜 구현은 병렬로, 빌드·게시와 무거운 검사는 직렬로 한다.
- 매 시도에 새 빌드 출력과 깨끗한 Pages 작업실을 쓴다. 기존 결과를 삭제하거나
  실패한 게시 커밋을 다시 밀어 넣지 않는다.
- 빌드 출력은 소스 폴더의 바깥이어야 한다. `app/dist`처럼 ignored인 하위 폴더도
  거절하여, 일반 작업용 Vite 빌드와 정식 게시 묶음이 같은 위치를 쓰지 않게 한다.
- 정상 완료와 예외 종료는 `finally`에서 자기 소유 잠금만 해제한다. 프로세스 강제
  종료로 남은 잠금은 자동 탈취하지 않는다. 오류에 나온 정확한 잠금 경로의
  작업 종류·시작 시각·호스트·PID를 확인하고, 그 작업이 끝났다는 증거를 확보한 후
  담당자가 그 파일 하나의 정리를 별도로 판단한다. PID만으로 종료를 단정하지 않는다.
- 이 잠금은 이 도구를 쓰는 **같은 로컬 Git 저장소** 안에서만 유효하다.
  별도 clone, 다른 컴퓨터, 예전 명령과 자동 workflow는 직렬화하지 않는다.
  따라서 원격 SHA 재확인·파일 해시·정상 push 거절 보호와 단일 게시 담당 원칙을 유지한다.
- 실행 중인 다른 작업자의 프로세스·작업실을 중단하거나 초기화하지 않는다.

## 사용 순서

아래 명령은 운영 게시 승인을 이미 받은 릴리스에서만 사용한다.
`<...>`는 실제 선택한 절대 경로다. 기존 작업실을 초기화해서 준비하지 않는다.

```text
git fetch origin refs/heads/main:refs/remotes/origin/main refs/heads/gh-pages:refs/remotes/origin/gh-pages
node .tools/build-oracle-pages-release.mjs --account-held --out=<new-empty-dist>
git worktree add --detach <new-pages-worktree> origin/gh-pages
node .tools/publish-oracle-pages-release.mjs --bundle=<new-empty-dist> --pages-worktree=<new-pages-worktree>
node .tools/publish-oracle-pages-release.mjs --bundle=<new-empty-dist> --pages-worktree=<new-pages-worktree> --publish
```

파일 해시가 없는 과거 묶음을 이 도구로 그대로 게시하지 않는다. 최신 확정 소스에서
다시 빌드한다. 실패한 작업실·빌드 폴더는 남겨 원인을 확인하고, 자동 삭제하지 않는다.

## 아직 해결하지 않은 경계

`AGENTS.md` §6의 workflow 변경 제한을 유지하여 `.github/workflows/`는 수정하지 않았다.
따라서 **자동·수동 배포가 완전히 통합되었거나 공통 잠금이 생긴 상태가 아니다.**

- 자동 CI의 root 전체 교체는 남아 있다. 운영 게시자는 보존형 수동 경로를 사용한다.
- 이 도구를 거치지 않는 기존 수동 명령과 자동·롤백 workflow를 강제로 잠그지 않는다.
- main 확인과 원격 push 사이의 마지막 짧은 경쟁 구간을 분산 잠금으로 제거하지 않았다.
  원격 Pages의 정상 push 경합은 Git이 거절하지만 main·Pages의 원자적 묶음 변경은 아니다.
- 자동 경로 변경은 별도 권한 범위 확인 후 같은 패키지 검증·보존 도구를 연결하고,
  현재 공개 설정을 유지하는지 확인해야 한다. 검사 관문을 삭제하는 방법으로 해결하지 않는다.
- 계정 보류, DB·Edge·공급자 공개와 실계정 저장 왕복은 이번 변경 대상이 아니다.

## 검사 범위

로컬 임시 Git 저장소로 오래된 소스 거절, 다른 게시 후 재사용 거절, 추가·변조 파일,
기존 자료 보존, 게시 기본값이 읽기 전용인 점, Windows 줄바꿈을 검사한다.
운영 저장소가 아닌 테스트용 bare remote만 실제 push한다.

기존 공개 설정 테스트와 기존 자동 source guard 계약을 함께 실행한다.
로컬 수동 잠금의 worktree 공유·소유자 확인·해제·실패 보존을 검사하고,
잠금 중 실제 게시가 복사 전에 거절되는 반면 사전 점검은 읽기 전용인지 확인한다.
전체 앱·서버 회귀 검사를 반복하지 않으며, 앱 실행 코드 통합에는 별도로 필요한
개인 계획 계약·타입 검사와 실제 배포 빌드만 확인한다.

### 이번 실행 결과

- 배포 보호·공개 설정·기존 source guard: 18개 통과.
- source 비교를 잠시 제거하자 `stale main and stale Pages configuration are distinct
  rebuild failures`가 `Missing expected exception`으로 실패했다. 원복 후 정상 통과했다.
- 개인 계획 통합 계약 4파일: 18개 최종 통과. 최초 실행에서 저장 화면의 콜드 로딩이
  기본 대기시간을 초과한 1건은 inbox 격리 검사의 사전 로딩 범위를 맞춘 뒤 5/5로
  재확인했다. 저장 화면 자체의 지연·실패·초점·원본 보존 검사는 별도 파일에서 유지한다.
- 앱 전체 TypeScript 검사 통과. 샌드박스 EPERM으로 실행되지 않은 초기 검사는 통과
  수에 포함하지 않았다.
- 운영 게시·공개 화면 결과는 커밋 후 생성되는 배포 영수증과 별도로 확인한다.

### 2026-10-08 후속 검사

- 배포 보호·수동 잠금·공개 설정·기존 source guard: 4개 파일, **27/27 통과**,
  실패·skip 없음. 합성 임시 저장소만 사용했으며 운영 push 검증으로 세지 않는다.
- 대상 파일만 명시적으로 stage하고 Windows 명령 길이 제한을 피하도록 NUL 구분
  경로 입력을 사용한다. 게시 작업실에 뒤늦게 생긴 무관한 파일을 일괄 stage하지 않는다.
- 앞서 완료한 화면 관련 집중 검사와 타입 검사는 반복하지 않았다. 앱·계정·서버
  전체 CI 또는 실계정 저장 왕복을 확인했다는 뜻은 아니다.
- 공개 빌드·Pages built·정식 주소의 매니페스트와 영수증은 이 소스 확정 뒤에 확인한다.

### 병합 후보 #353과 홈 읽기 회귀

2026-10-08 확인한 PR #353 head `b1ed3ed6`의 CI run `37644955741`은 main
`41e5137a`와 합친 `acac89e7`에서 `AppShell.multi-plan.contract.test.tsx`의
3개 기대가 실패했다. 홈 요약이 공급된 다중 계획 근거 읽기를 즉시 호출하던 것이
원인이었다. 홈의 일반 계획 요약에서는 이 서비스를 호출하지 않고, 실제 훈련
화면을 열었을 때 기존처럼 호출하도록 수정했다. 오류를 던지는 reader를 제공해도
일반 계획 요약이 유지되는 회귀 기대를 추가했다.

- 홈·다중 계획 전달·오라클 계획 복귀: 3개 파일 **17/17 통과**.
- 위 런타임 수정 후 TypeScript 검사도 통과했다.
- 이 결과를 #353 전체 CI 통과로 바꾸어 적지 않는다. PR에는 테스트뿐 아니라
  계정 변경 시 저장 거절 처리와 생성된 서버 validator가 포함된다.
- #353은 이번 공개 묶음에 섞지 않는다. 후속 담당자는 최신 main 기준으로
  계정/저장 변경을 다시 대조하고 해당 validator 일치·계정 경계 및 PR 검사를
  확인한 후 병합한다. 실패한 검사 강제 우회나 서버 동반 배포를 하지 않는다.
- 미니게임 #349는 계속 제외한다. 다른 작업자의 branch·worktree는 보존한다.
