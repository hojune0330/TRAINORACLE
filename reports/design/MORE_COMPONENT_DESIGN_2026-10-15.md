# 더보기와 공통 목적 행 디자인

2026-10-15 사용자가 승인한 목적별 디자인 확장에 따른 로컬 구현 기록이다. 기준 작업실은 `.scratch/release-body-20261014-source`, 기준 HEAD는 `c08fcdf7c2a76f988c200debdd041c2cfdda2d16`이다. 기존 홈 첫인상 커밋과 미커밋 팝업 코드·두 WebP를 보존했다. 이 보고서는 커밋·원격 반영·공개 배포·실계정 또는 어린 사용자 이해도 검증을 뜻하지 않는다.

## 목적과 적용 범위

더보기에서 이름과 그림을 보고 실제 목적지를 찾게 한다. 새로운 기능이나 학습 관문을 추가하지 않고 현재 연결된 목적지를 직접 노출한다. 조사 담당 Luna의 소스 조사, 구현 담당 Sol의 제작·검수, root의 범위 조율·시각 감독으로 진행했다. 저장·인증·훈련 계산의 소유권을 이번 작업으로 확대하지 않았다.

설계 기준은 `PRODUCT_NORTH_STAR.md`, `AGENTS.md`, `docs/UX_UI_VISUAL_STANDARD.md`의 최신 승인과 `lean-delivery`, `design-toss-card-ui` 및 cross-media·visual-references·trainoracle·qa 네 참조다. `ui-ux-pro-max`는 보조로만 읽고 기존 Pretendard·루트 토큰·Lucide를 우선했다. 디자인 handoff README와 Risk Review는 역사적 레퍼런스로 확인했으며 세 신규 훈련 화면을 이번 구현에 포함하지 않았다.

## 더보기의 읽기 순서

| 묶음 | 직접 여는 항목 | 표현 |
|---|---|---|
| 훈련 도구 | 페이스 계산, 경기 기록 추가·수정, 워치 파일 가져오기 | 페이스는 기존 생성 그림 64px, 나머지는 정렬된 행 |
| 오라클 | 러닝 취향, 최고기록으로 풀이하기, 오라클 읽을거리 | 같은 보라 계열, 서로 다른 Lucide로 용도 구별 |
| 배우기 | 일지 예시 보기, 훈련 용어집·도움말, 훈련법 읽기 | 예시 이름은 홈과 통일. 새 학습 단계 없음 |
| 꾸미기·게임 | 일지 꾸미기, 미니게임 | 배우기와 분리. 게임 그림은 64px로 핵심 도구 뒤에 배치 |
| 관리 | 계정·기록 보관, 백업·복원·휴지통, 앱 정보·개인정보·문의 | 하위 화면의 실제 제목을 직접 표시 |

모든 callback이 제공되면 14개 목적지다. 제공되지 않은 선택 기능은 기존처럼 노출하지 않는다. 지원하지 않는 도구나 빈 묶음을 새로 만들지 않는다. 기존 `learning` 복귀 상태는 유지하며 해당 화면도 배우기와 꾸미기·게임을 구분한다.

## 공통 MenuAction

`MenuAction.tsx`는 필요한 More 사용처에만 적용한 공통 목적 행이다. 전역 자동 치환이나 범용 흐름 엔진을 만들지 않았다.

- 네이티브 `button`은 기존 callback을 한 번 실행하고, 네이티브 `a`는 기존 주소·새 창·`noreferrer`를 유지한다. 새 창 링크에는 읽을 수 있는 새 창 이름과 바깥 화살표를 제공한다.
- 기존 `CategoryIcon`의 compact 면과 루트 카테고리 색을 재사용한다. 훈련 파랑, 일지 앰버, 오라클 보라, 기록 틸이며 일반 관리·게임은 중립이다. 안전/성공/달력 역할색을 재정의하지 않는다.
- 동일한 `Calculator`·`BookOpen`·`UserRound`가 다른 목적지를 가리키던 구간을 기록 풀이·읽을거리·예시·계정용 Lucide로 구별했다. 새 아이콘 세트와 이모지를 추가하지 않았다.
- 일반 행은 같은 기준선의 아이콘·16.5px 이름·필요한 14.5px 보조 문구·화살표로 구성한다. 별도 카드가 필요한 두 그림 항목만 기존 16px 반경을 사용한다.
- 기존 `.more-screen__row` 및 `app-choice-control`을 사용하지 않아 `selection-system.css`가 More 행마다 추가하던 카드 테두리와 바깥 여백의 반복을 피한다. 해당 전역 CSS 자체는 변경하지 않았다.
- 이름은 줄바꿈하며 고정 높이·줄 수 제한·말줄임을 사용하지 않는다. 최소 64px 행과 44px 뒤로가기, 키보드 초점, 정밀 포인터에서만 hover, 모션 감소를 제공한다.
- 그림은 빈 alt의 장식이다. 실패하면 `ContextualIllustration`이 이미지를 제거하고 CSS의 네 번째 열도 없어져 빈 그림 슬롯을 남기지 않는다. 글과 callback은 그대로 남는다.

## 하위 화면과 처음 진입 안내

More의 제목은 기존 `AppHeading` 24px 역할과 눌리는 뒤로가기 면으로 정리했다. 계정·백업의 상태·내보내기 문구·긴 안전 내용은 그대로 두고, 앱 정보의 문의/기기·개인정보/이용·출처/라이선스를 짧은 묶음으로 구분했다. 계정 저장 성공을 암시하는 그림은 More에 넣지 않았다.

도움말은 `Guide`가 `TrainingLexicon`의 기존 제목에만 `training-map` 64px를 전달한다. 일반 제목·본문을 추가하지 않았으며, 첫 용어 목록에서만 그림이 보인다. 검색·분류·전체 목록·용어 상세에는 반복하지 않는다. 직접 용어 route의 기존 표시와 데이터·검색·상세·뒤로가기 로직은 바꾸지 않았다.

복원은 `RestoreBackup`의 기존 파일 고르기 제목 옆에 `backup-journal-file` 64px를 넣었다. `pick && !busy && failure === null`에서만 표시하며 읽는 중·파일 오류·검토·저장·결과에는 표시하지 않는다. 기존 파일 입력·크기 제한·기존 일지 보존·명시적 확인·계정 소유 검사·미전송/충돌·실패 안내는 같은 코드를 사용한다.

새 복원 그림은 폴더와 앰버 일지의 장식으로 문자·체크·자물쇠·완료 표현이 없다. 최종 WebP는 384×384 alpha, 13,640 bytes, SHA-256 `e5d934ee44715d8c9cae645b546a2d63b4109f02676f71af4c3061fdf1c03915`이다. 원본과 제작 근거는 [BACKUP_JOURNAL_ASSET_2026-10-15.md](BACKUP_JOURNAL_ASSET_2026-10-15.md)를 따른다. 서비스 워커 사전 저장 목록은 변경하지 않았다.

## 불변 경계

훈련량·페이스·종목·RP/RPE·반복·회복·시간·통증 판정, 저장·인증·동의·구매·계정 공개·복원 기본값과 실제 확인 절차는 이번 변경의 대상이 아니다. 화면 열기·접기·그림 표시를 저장·훈련 완료·포인트·건강 판단으로 기록하지 않는다. 기존 복귀 label·scroll·focus·history 처리와 없는 callback의 미노출을 유지한다.

## 실제 검수 상태

| 구분 | 상태와 한계 |
|---|---|
| 독립 소스 검수 | Luna가 지정 소스 경계의 callback·복귀·외부 링크·첫 진입 조건·44px/줄바꿈을 확인. 확정 P1/P2 없음. 런타임·아동 이해도 검증은 아님 |
| 타입 검사 | pinned Node 24.19.0으로 `tsc --noEmit` 1회 시작. 수분간 출력 없이 실행되어 본 작업의 세션만 종료(exit 1). 형 오류 확정이나 통과로 분류하지 않으며 검사 미완료. 반복 실행하지 않음 |
| 단위/계약 검사 | 새 MenuAction의 키보드 callback·이미지 실패·외부 링크 검사와 More 묶음 인수를 작성. 앞선 Vitest threads/forks의 worker startup 60초 timeout 및 0 tests 환경 문제를 반복하지 않았으며 이번 통과 기록 없음 |
| 앱 통합 브라우저 | 127.0.0.1:51842, 외부 origin 요청 차단, 격리 Chrome context. 첫 sandbox 실행은 loopback connect EACCES로 실패. 허용된 재실행은 서버 HTTP 200·Chrome 기동 뒤 첫 `/?app=1` 탐색의 `domcontentloaded` 60,000ms timeout으로 종료(exit 1). 앱 DOM assertion·캡처에 도달하지 않음 |
| More 단독 브라우저 | root 승인으로 실제 More/MenuAction/CategoryIcon/ContextualIllustration·기존 CSS를 쓰는 fixture를 딱 한 번 실행. 저장·설치·문의 설정·복귀 서비스만 fixture adapter로 격리했으며 앱 소스를 이를 위해 바꾸지 않음. 서버·Chrome 기동 뒤 첫 `/isolated-more` 탐색의 `domcontentloaded` 30,000ms timeout으로 종료(exit 1). DOM assertion·320px/375px·200%·이미지 실패·callback 결함 주입 대조에 도달하지 않음 |
| 자산 64px 비교 | 별도 자산 담당자가 흰색/아이보리 바탕의 64px 비교 이미지를 직접 검수했고 root와 구현 담당자도 확인. 이는 그림 가독성 검수이며 앱 화면 또는 버튼 동작 검증이 아님 |
| 공개/실사용 | 커밋·push·PR·배포·실계정 왕복·실물 모바일·어린 사용자 이해도 검증은 실행하지 않음 |

현재 실행으로 새 앱 캡처와 통과 JSON을 확보하지 못했다. timeout이 신규 코드 문제인지 실행 환경 문제인지 확정하지 않는다. 동일 환경의 추가 재시도·Chrome 설정 변경·새 우회는 하지 않았다. 두 브라우저 실행은 `finally`에서 browser/server를 닫고 종료했으며 이후 백그라운드 검수는 계속하지 않는다.

유효한 시각 자료는 `.scratch/more-design/assets/backup-journal-file-v1-64px-review.png`뿐이다. 검수 하네스는 `.scratch/more-design/review.mjs`와 `.scratch/more-design/isolated-review.mjs`에 보존하지만 실행 실패를 통과 증거로 취급하지 않는다. 실제 AppShell 복귀·역사·스크롤·초점, 링크 이동, 큰 글씨·이미지 실패와 결함 검출 대조는 미완료다. 작성된 단위 검사 역시 실행 통과를 주장하지 않는다.

## 변경 파일과 인계

- 표시 소스: `More.tsx`, `MenuAction.tsx`, `menu-action.css`, `home-menu.css`, `Guide.tsx`, `TrainingLexicon.tsx`, `training-lexicon.css`, `RestoreBackup.tsx`, `ContextualIllustration.tsx`.
- 검사 소스: `MenuAction.test.tsx`, `More.discovery.contract.test.tsx`. 기존 callback·복귀·법률 링크·복원 계약은 삭제하거나 완화하지 않았다.
- 에셋: 새 `backup-journal-file-v1.webp`와 별도 제작 기록. 기존 pace/game 안내 WebP는 파일 자체를 바꾸지 않고 재사용했다.
- 문서·임시 검수: 이 보고서 및 `.scratch/more-design/`. 임시 폴더와 원본은 검토 자료로 보존하며 최종 제품 자산과 구분한다.

완료된 범위는 로컬 코드 제작·자산 연결·독립 소스 검수다. 타입·단위/계약·실제 브라우저 인수는 위 사유로 미완료이며 공개 반영은 수행하지 않았다. 다음 인수는 정상적으로 앱 본문을 불러올 수 있는 환경에서 이 변경 범위의 화면과 복귀 동선을 확인하는 것이다.
