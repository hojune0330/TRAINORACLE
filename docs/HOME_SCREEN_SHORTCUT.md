# HOME_SCREEN_SHORTCUT.md

```yaml
doc_id: trainoracle-home-screen-shortcut
version: "1.0"
status: OWNER_REQUESTED_IMPLEMENTATION
scope: 웹앱 홈 화면 및 PC 앱 바로가기 안내
canonical_promotion_allowed: false
```

## 목적

로그인 또는 일지·계획 이용 후 앱을 다시 찾기 쉽게 한다. 모바일 홈 화면과 PC 앱 바로가기를 지원하며, 설치 여부를 로그인·계정 보관·훈련 이용 조건으로 만들지 않는다.

## 진입과 우선순위

- 홈: 실제 기록 또는 저장한 계획이 있거나 계정 상태가 확인된 사용자에게 작은 선택형 안내를 제공한다. 오늘의 훈련·기록 행동보다 먼저 강제하지 않는다.
- 계정: 로그인과 가입 확인을 마친 뒤 안내한다. 로그인 입력·가입 확인을 가로막지 않는다.
- 더보기: 언제든 설치 안내를 다시 열 수 있다. 일시적으로 닫았어도 수동 진입은 유지한다.
- 자동 설치창·자동 모달은 없다. 사용자 클릭으로만 안내/브라우저 설치창을 연다.
- 안내를 닫으면 7일 동안 제안을 숨긴다. 이 기간은 UX 빈도 제한이지 훈련 규칙이 아니다. 저장소가 막혀도 앱 사용은 계속 가능하다.

## 브라우저별 처리

| 환경 | 동작 |
|---|---|
| 설치 이벤트를 제공하는 브라우저 | 보관한 `beforeinstallprompt` 이벤트를 명시적 클릭 시 한 번 사용 |
| iPhone/iPad | Safari 공유 메뉴의 홈 화면 추가 절차 안내 |
| Android | 브라우저의 설치 또는 홈 화면 추가 메뉴 안내 |
| PC Chrome/Edge | 주소창 설치 아이콘 또는 앱 설치 메뉴 안내 |
| Mac Safari | 지원 버전에서 Dock에 추가 안내 |
| 인앱/기타 브라우저 | 기본 브라우저에서 열기 또는 지원되는 북마크/바로가기 절차 안내 |

브라우저·OS에 따라 이름과 제공 기능이 다르다. 설치 이벤트가 없다는 이유만으로 설치 불가 또는 설치 완료라고 판단하지 않는다. `accepted`는 브라우저 선택 결과이며 설치 완료와 구분한다. `appinstalled` 또는 standalone 실행 상태를 확인했을 때 설치된 상태로 표시한다. 일반 탭에서는 기존 설치 여부를 완벽하게 알 수 없다.

## 데이터와 경계

- 기존 manifest·브랜드 아이콘·service worker를 재사용한다. 아이콘 추가 자체로 기기 기록을 옮기거나 계정 저장을 완료하지 않는다.
- 설치 선호에는 닫은 시각만 보관한다. 사용자 ID·연락처·일지·통증·훈련 내용은 읽거나 전송하지 않는다.
- 브라우저와 설치된 웹앱 사이 저장 공간이 다를 수 있으므로 동일 데이터를 자동 보장하지 않는다. 계정 저장 상태는 기존 저장 안내를 따른다.
- 앱스토어 배포, 네이티브 앱 설치, 알림 권한 요청, 바탕화면 파일 자동 생성은 이번 범위가 아니다.
- PC의 설치 위치는 OS·브라우저가 결정하므로 바탕화면 아이콘이 반드시 생성된다고 약속하지 않는다.

## 검수

처음 방문 시 비강제, 기록 후 제안, 더보기 수동 진입, 닫기/재방문 억제, 설치 이벤트 단회 사용, 실패·거절·설치 완료, standalone, 저장소 오류, 320px·200% 글자·키보드·줄인 모션을 검사한다. 가짜 설치 이벤트 시험은 브라우저 OS 설치 성공 증거가 아니다. 실제 기기의 설치 완료 검증과 구분한다.

## 구현 검수 기록 (2026-09-12)

- 집중 컴포넌트·manifest 계약 16/16 통과 (기본 및 KST).
- 기존 앱·빠른 기록·시각 계약 집중 검사 34/34 통과.
- Playwright 4개 환경에서 16/16 통과: 실제 빠른 기록 후 제안, 재방문 억제, 명시적 설치 클릭, 320px 확대 글자, 제안 소멸 후 초점 복귀.
- 앱 빌드, E2E TypeScript 검사 통과. 독립 소스 리뷰의 초점 복귀 지적을 수정하고 재승인받음.
- 실제 iOS/Android/PC 운영체제 설치 완료는 시험하지 않았다. 설치 이벤트 시뮬레이션과 안내 화면 검증이며 실제 설치 성공 증거로 사용하지 않는다.
- 이 기록 시점에는 로컬 구현이며 공개 배포 완료를 의미하지 않는다.

## 공식 근거

- [MDN beforeinstallprompt](https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeinstallprompt_event)
- [MDN 설치 프롬프트](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/How_to/Trigger_install_prompt)
- [Apple iPhone 홈 화면 웹앱](https://support.apple.com/guide/iphone/iphea86e5236/ios)
- [Chrome 웹앱 사용](https://support.google.com/chrome/answer/9658361)
- [Apple Mac 웹앱](https://support.apple.com/en-gb/104996)
- [Microsoft Edge 앱 설치](https://support.microsoft.com/en-us/edge/install-manage-or-uninstall-apps-in-microsoft-edge)

[DRAFT_COMPLETE]
