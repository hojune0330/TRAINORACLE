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

부상 에피소드, 추세 그래프, 완치 판정, 코치/보호자 공유, 자동 처방 변경은 이번 구현에 포함하지 않는다.
계정 서버의 실제 배포와 실계정 왕복은 로컬 구현/계약 테스트와 구분해 보고한다.
