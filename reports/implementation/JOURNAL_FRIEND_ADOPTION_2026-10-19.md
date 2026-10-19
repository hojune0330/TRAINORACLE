# 일지로 만나는 친구와 48명 확장

기준 소스: `e37ca49e`, 작업 장소: `.scratch/simplified-ui-release-20261018-source`.
범위: 로컬 친구 방의 일지 만남·입양·목록·저장 보존. 커밋·푸시·CI·배포·DB·인증 변경은 포함하지 않는다.

## 동작

- 기존 12명에 새 36명을 더해 총 48명이다. 기존 그림 경로와 이름·반응·이야기는 유지하고,
  새 친구는 개별 한국어 이름·인사·선호 행동·두 가지 돌봄 대사·잠자리/아침/입양 대사와 4장 이야기를 가진다.
- 이 기능 적용 후 당일 일지를 확인하여 저장한 날을 하루 한 번 센다. 누적 7일마다 선택형 만남 1번이다.
  연속일·길이·횟수·거리·페이스·운동량·메모·건강 값은 받지 않는다. 훈련·휴식·컨디션·경기는 같은 한 날이다.
- 방에서 `친구 만나기`를 누른 뒤 직접 고르기 또는 랜덤 제안을 선택한다. 랜덤 제안은 먼저 저장하고 표시한다.
  취소·닫기·다시 열기·직접 선택으로 변경할 때는 기회를 쓰지 않는다. 입양 버튼으로 확인하여 저장한 때만 한 번 쓴다.
- 중복 친구와 전원 보유는 기회를 쓰지 않는다. 모두 보유한 뒤의 기회는 남는다. 돌봄으로 먼저 입양한 제안은
  제안만 비우고 일지 기회는 남긴다. 못 쓴 날·일지 삭제로 기존 친구나 누적 날짜를 회수하지 않는다.
- 기존 30일 돌보기 또는 3개 미션 입양과 일지 없이 사용할 수 있는 일일 방문·돌봄은 유지한다.
  일지 진행은 친구 방 안에 작게 표시한다. 2026-10-20 후속 연결로 확인된 저장 완료에도 보조 안내를 두되,
  게임 자동 이동·강제 팝업·입양 강요 없이 사용자가 누를 때만 방을 연다.

## 소유권·저장

`AppShell.confirmSavedJournalEffects`의 확인된 저장 continuation에서 `{date, kind}`만 전달한다.
저장 화면이 가진 계정·generation ticket을 사용하며, 잠금 대기 전후에 현재 소유자를 확인한다.
잠금이 자정을 넘어 도착해도 저장 확인 순간의 날짜를 유지한다. 실패한 전날 요청을 나중에 소급 적립하지 않는다.

`trainoracle.engagement.v2`, 계정 포인트 집계, 저장 전 초안, 달력 열기, 수면 게임의 수면 값은 근거로 사용하지 않는다.
이전 일지의 소급 읽기나 원문 재조회는 추가하지 않았다. 계정 사용 시에도 이 보상은 해당 브라우저의 로컬 게임 기록이다.

| 저장 경계 | 처리 |
| --- | --- |
| 기존 v1 | `trainoracle:pet-home:v1:<scope>` 원본 바이트를 유지한다. 기존 12명만 허용하는 엄격한 파서로 읽는다. |
| 새 v2 | `trainoracle:pet-home:v2:<scope>`에 소유 scope·돌봄·입양·일지 날짜·사용 횟수·랜덤 제안을 함께 보관한다. |
| 이전 | v2가 없을 때만 v1을 변환하고 저장 후 같은 바이트를 다시 읽어 확인한다. 유효한 v2는 이후 v1 쓰기를 합치지 않는다. |
| 손상·다른 소유자·날짜 역행 | 초기화나 덮어쓰기 없이 새 저장·입양을 막고 방에서 다시 불러오도록 안내한다. |
| 경쟁 쓰기 | scope별 Web Lock을 방 수명 동안 보유한다. 같은 앱의 확인된 일지 저장은 그 잠금을 재사용하며, 다른 경우 짧은 쓰기 잠금을 얻는다. |
| StrictMode·빠른 닫기 | effect 취소 신호를 grant 전후에 확인하고, 취소/해제 중인 실제 LockManager 요청이 끝난 뒤 대체 화면을 연다. |
| 저장 확인 | 기대 원문 비교와 엄격한 파싱, 저장 후 재읽기에 성공한 다음에만 완료를 표시한다. 입양과 만남 차감은 한 v2 문서에 함께 쓴다. |

잠금이 다른 창에 있거나 브라우저가 지원하지 않으면 친구 기록 쓰기를 막고 이유와 재시도를 표시한다.
일지 자체의 성공을 취소하지 않는다. 예전 여관 퍼즐은 별도 진입할 수 있다.

친구 날짜 반영 실패의 최소 receipt는 현재 앱 메모리에만 남아 명시적으로 다시 시도할 수 있다.
저장 공간이 실패한 상태에서 그 receipt까지 영구 보관했다고 주장하지 않는다. 앱을 새로 열었다면 오늘 같은
일지를 다시 저장해 복구하며 이 한계를 방의 도움말에도 표시한다. 다음 날 또는 다른 scope generation으로는 재사용하지 않는다.

## 화면·성능

- 방·잠자리의 대표는 최대 3명이다. 잠자리 저장 배열은 48명을 지원하며 전체 이름은 별도로 확인한다.
- 컬렉션·입양 선택은 12명씩 넘긴다. 페이지를 넘기면 이전 페이지의 선택을 해제한다. 그림은
  IntersectionObserver로 화면 가까이에 올 때 불러온다. 서비스 워커에 새 그림의 사전 저장을 추가하지 않는다.
- 직접 선택 시 목록만 내부 스크롤하고 단일 입양 확인은 하단 footer에 남는다. 내용과 footer를 분리하고 안전 영역을 확보한다.
  선택 때문에 화면을 강제로 스크롤하지 않는다.
- 시트는 키보드·Escape·배경 inert·진입점 포커스 복귀를 제공하며 OS와 앱의 모션 줄이기를 따른다.
  저장 실패는 현재 시트에서 표시한다. 최종 입양 확인 뒤에는 새 친구가 선택된 우리 방으로 이동한다.

## 변경 위치

- `app/src/screens/pet-room/`: 48명 카탈로그·새 친구 대사/이야기·자세 그림·일지 만남 시트·목록·기존 돌봄과 수면 연결.
- `app/src/domain/pet-home-lock.ts`, `pet-journal-progress.ts`: 창 사이 직렬화, 확인된 날짜 적립과 실패 재시도.
- `app/src/AppShell.tsx`: 확인된 일지 저장 후 최소 메타데이터 전달.
- `app/src/screens/sleep-inn/SleepInnEntry.tsx`, `screens/treadmill/GameLounge.tsx`: 48명 입구와 게임 결과의 범위 문구.
- `docs/UX_UI_VISUAL_STANDARD.md` §8.21: 이번 선택형 만남의 표현·저장·접근성 기준.

## 검수 상태

고정 Node 24.19.0(`C:/Users/admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe`)을 사용했다.

| 검사 | 결과 | 범위 |
| --- | --- | --- |
| 최종 집중 UTC, 단일 실행 | 13개 파일 · 94개 통과 | 아래 파일 목록. 하단 CTA·StrictMode 취소·자정 지연 저장과 직접 선택 저장 회귀를 포함한 같은 소스 후보. |
| KST 날짜 경계 | 2개 파일 · 19개 통과 | `pet-journal-friends.test.ts`, `pet-journal-progress.test.ts`. UTC 결과에 중복 합산하지 않는다. |
| TypeScript | `tsc --noEmit` 통과 | 최종 소스와 테스트 타입 검사. |
| 브라우저 320px·375px | 최종 36개 그림 decode 뒤 통합 담당자 합성 검사 통과 보고 | 저장된 랜덤 제안→취소→reload→동일 제안, 다른 친구 직접 선택·페이지 변경·명시 입양·44px·넘침·footer CTA 뷰포트 노출. |
| 실제 브라우저 두 탭 | 통합 담당자 합성 검사 통과 보고 | 다른 탭의 방 사용 중 차단, 원래 탭 닫기 후 재시도, 기록 보존. |
| 새 그림 36개·216자세 | 통합 담당자 최종 manifest/육안 검수 통과 보고 | 총 4,559,106 bytes, 파일 최대 149,680 bytes. SHA256·셀 경계·포즈와 접촉 시트를 별도 검수했다. |
| 최종 로컬 production 빌드 | 1회 통과 | runtime guard→`tsc --noEmit`→Vite 6.4.3 `build --emptyOutDir=false`, 2,839 모듈, Vite 28.94초, exit 0. 기존 산출물을 지우지 않았다. |
| 빌드 자산 보존 | 48개 원본→dist SHA256 일치 | 기존 12개와 새 36개 atlas가 모두 빌드에 같은 바이트로 포함되었다. |

최종 집중 실행은 설치된 `node_modules/vitest/vitest.mjs run --maxWorkers=1 --no-file-parallelism`에 다음 13개 파일만 지정했다.

- `src/domain/pet-home-lock.test.ts`
- `src/domain/pet-journal-progress.test.ts`
- `src/screens/pet-room/pet-engine.test.ts`
- `src/screens/pet-room/pet-journal-friends.test.ts`
- `src/screens/pet-room/PetRoom.test.tsx`
- `src/screens/pet-room/PetRoom.lease.test.tsx`
- `src/screens/pet-room/PetJournalFriends.test.tsx`
- `src/screens/pet-room/PetCareScene.test.tsx`
- `src/styles/visual-system.contract.test.ts`
- `src/screens/sleep-inn/SleepInnEntry.test.tsx`
- `src/screens/sleep-inn/SleepInnEntry.exit.test.tsx`
- `src/AppShell.guest-rewards.test.tsx`
- `src/AppShell.save-result.contract.test.tsx`

부정 입력·실패 대조군에는 6일 미지급, 같은 날 재저장, 미래/소급 날짜, 계정 A→B→A,
잠금 대기 중 계정 변경과 자정, 실제 잠금 경합, StrictMode 취소된 grant, 손상된 v1/v2,
소유자 불일치, stale expected 원문, quota와 무시된 쓰기/readback 실패를 포함한다.
정상 저장만 통과시키는 문구 검사로 저장 경계를 대신하지 않는다.

브라우저 증거: `.scratch/pet-friends-20261019-visual/results.json` 및 같은 폴더의 320/375px 캡처.
브라우저 검수는 통합 담당자가 합성 기기 기록과 격리된 로컬 브라우저로 수행한다.
실계정 기록·운영 서버·실물 휴대폰·공개 배포 검증으로 확대하지 않는다. 전체 CI는 실행하지 않았다.

빌드 로그에는 정적/동적 import 중복과 500kB 초과 chunk 경고, 런타임에 해석할 폰트 URL 경고가 있었다.
이번 변경은 해당 모듈 구성·폰트 경로를 수정하지 않았다. 빌드의 `fonts/PretendardVariable.woff2` 존재도 확인했다.
이 경고를 없애기 위한 범위 외 chunk/폰트 변경은 하지 않았다.

빌드 후 라쿤의 공개 이름을 제품과 일치시킨 메타데이터 `manifest.json`과 `gallery.html` 두 파일만
`app/public/games/pet-friends-v2/`에서 기존 `app/dist/games/pet-friends-v2/`의 동명 파일로 동기화했다.
원본과 산출물의 SHA256은 각각 `a7ced4f78985ab34a12f9d85541b163e5d3cc0b117b10282fd45865330eb1c80`,
`13d09daa4e5af3fe4ff31e43cc247ee7019a05cbcb32ee7e189deeaac3c548df`로 일치한다.
제품 코드·36개 그림의 해시/바이트·생성 원본과 프롬프트는 변경하지 않았다. 이 라벨 정합 작업에는
새 빌드·테스트·공개 배포를 실행하지 않았다.

## 2026-10-20 저장 완료–친구 방 연결

기존 48명·7일 정책·v1/v2·Web Lock·명시 입양·실패 보존은 바꾸지 않았다. 위 94개 검사는
2026-10-19 후보의 증거이며, 아래 후속 변경의 최종 영향 검사를 별도로 기록한다. 중복 합산하지 않는다.

- 공통 `JournalSaveResult`의 확인된 저장에만 작은 텍스트/행동 한 줄을 둔다. 새 보상 카드나 자동 모달은 없다.
  `{id, date, kind}`는 확인된 `savedEntry`에서만 전달한다. 검토 안내가 있으면 검토를 먼저 보여 준다.
- 저장된 v2 home를 읽기 전용으로 파싱해 누적 진행 `x/7일` 또는 남은 만남을 표시한다. 열람으로는
  home 생성·v1 이전·적립·제안·차감·재시도를 하지 않는다. 부재·손상·다른 owner·읽기 실패는 성공한 0일로 채우지 않는다.
- 오늘이 아닌 일지는 오늘 진행에 더해지지 않는다고 명시하며 기존 친구 방은 열 수 있다.
  전원 보유·잠자리 중에는 만남을 바로 시작하지 않고 방으로 연결해 남은 기회를 보존한다.
- `친구 만나기`를 직접 눌렀을 때만 기존 만남 메뉴를 목적지로 연다. 일반 `우리 집 친구들`은 방으로 연다.
  별도 모달 엔진 없이 기존 `SleepInnEntry`의 dialog·계정 경계·Back 계약을 재사용한다.
- 완료에서 연 방은 `저장한 일지 보기`로 정확한 ID의 기존 read-only 일지를 열고, `친구 방으로 돌아가기`로
  살아 있는 같은 방의 상태·포커스·스크롤을 복원한다. 지정 ID가 없어진 경우 다른 같은 날 기록으로 대체하지 않는다.
  방을 닫으면 원래 저장 완료/작성 DOM과 위치로 돌아간다.
- 새로고침 뒤의 기존 일지 보조 진입은 `우리 집 친구들`로 이름을 맞췄다. 이미 선택한 ID가 있으면 그대로 연결하고,
  날짜만 있는 경우 `이날 일지 보기`로 날짜 reader를 유지한다. 기존 수면 초안/편집과 미저장 이탈 보호는 유지한다.
- 읽기 진입 순간에만 dialog를 맨 위로 두고, 이 내부 reader에서는 기존 지연 entry 정렬을 끈다.
  읽거나 스크롤하는 중 재정렬하지 않으며, 원래 방으로 복귀할 때는 저장해 둔 위치를 복원한다.
- 일지 성공과 친구 반영 실패는 별도로 표시한다. 명시적인 친구 진행 재시도는 이미 확인된 당일 receipt만 사용하며
  일지를 재작성하거나 새 ID로 저장하지 않는다. reload 뒤 같은 당일 일지를 다시 저장해야 하는 기존 한계도 유지한다.

변경 위치: `components/JournalSaveResult.tsx`, `AppShellFrame.tsx`, 새 `PetJournalSaveLink.tsx`,
`AppShell.tsx`, `log-entry/QuickSessionForm.tsx`, `domain/pet-journal-progress.ts`의 읽기 전용 projection,
`sleep-inn/SleepInnEntry.tsx`/`types.ts`, `pet-room/PetRoom.tsx`, `LogDetail.tsx`, `styles/task-flow.css`와 영향 테스트.

통합 담당자의 최종 합성 브라우저 검수 보고: 320·375px 정상 경로와 320px 친구 저장 quota 실패/재시도 3시나리오 통과.
저장→만남 메뉴→방→정확한 일지→명시 Back/browser Back→원래 완료 포커스,
기존 LogDetail→방→날짜 reader→원래 일지 포커스 복귀를 확인했다. 탐색만으로 `days=7`, `claimed=0`은 변하지 않았다.
친구 저장 실패에서도 일지 confirmed와 원본 ID가 유지되고 친구 진행만 재시도되었다.
reader 복귀 버튼은 두 폭에서 top 24/bottom 68, dialog scrollTop 0으로 보였고,
가로 넘침 0·44px 이상 행동·page error 0을 확인했다.
증거: `.scratch/journal-friend-bridge-20261020-visual/results.json`과 같은 폴더의 캡처.
이는 격리된 로컬 합성 검수이며 실계정·운영 서버·실물 휴대폰·배포 증거가 아니다.

최종 소스 확정 뒤 Node 24.19.0으로 실행한 영향 검사는 **10개 파일·102개 테스트 통과**다.
`vitest run --maxWorkers=1 --no-file-parallelism`, 66.98초, exit 0이며 앞선 69개 초기 실행이나 기존 94개와 합산하지 않는다.
같은 소스에서 `tsc --noEmit`도 exit 0으로 통과했다. 실행 파일은 다음과 같다.

- `src/domain/pet-journal-progress.test.ts`
- `src/components/PetJournalSaveLink.test.tsx`
- `src/components/JournalSaveResult.test.tsx`
- `src/screens/sleep-inn/SleepInnEntry.test.tsx`
- `src/screens/sleep-inn/SleepInnEntry.exit.test.tsx`
- `src/screens/pet-room/PetRoom.test.tsx`
- `src/screens/log-entry/QuickSessionForm.contract.test.tsx`
- `src/AppShell.guest-rewards.test.tsx`
- `src/AppShell.save-result.contract.test.tsx`
- `src/screens/LogDetail.reader-chrome.contract.test.tsx`

새 테스트는 읽기 projection의 부재/손상/다른 소유자/미래 시계/미지원 읽기 비초기화, 확인 전 일지 저장 상태,
친구 quota 실패 재시도, owner generation 교체, 모든 친구 보유, 오늘이 아닌 날짜,
정확한 ID의 read-only reader와 삭제된 ID의 대체 금지, 날짜-only reader,
명시 Back·Escape·browser Back의 게임/완료 위치·포커스·기존 입력 보존을 포함한다.
기존 Quick·계정 저장·미저장 이탈 계약도 위 영향 실행에 포함했다.
이번 구현 담당자는 새 빌드·커밋·푸시·배포를 하지 않았다. 수동 릴리스는 별도 담당자의 단계다.

## 한계

이 기록은 브라우저 로컬이다. 시계/시간대 조작의 완전한 방지, 다른 기기 동기화나 서버 권한 검증을 제공하지 않는다.
이미지 생성·자산 검수의 원본과 결과는 `character-art/pet-friends-v2/`의 별도 인계와 대조한다.
