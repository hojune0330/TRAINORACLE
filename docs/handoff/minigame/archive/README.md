# 대화에서 만든 결과물 보존

현재 실행 코드는 앱의 `TreadmillGame`과 `domain/minigame/treadmill.ts`다. 아래 결과물은 **그대로 보존한 과거 시안**이며 앱에서 불러오지 않는다.

| 시안 | 소스 | 단독 실행본 | 당시 화면 | 당시 확인 기록 | 지위 |
|---|---|---|---|---|---|
| 6턴 페이스 러너 | [fragment](pace-runner.fragment.html) | [HTML](pace-runner.html) | [데스크톱](pace-runner.desktop.png) / [모바일](pace-runner.mobile.png) | [JSON](pace-runner.checks.json) | 초기 방향. 영구 강화와 턴제 흐름은 현재 기준에서 수정됨 |
| 30초 트레드밀 | [fragment](treadmill-runner.fragment.html) | [HTML](treadmill-runner.html) | [데스크톱](treadmill-runner.desktop.png) / [모바일](treadmill-runner.mobile.png) / [높이 조정 확인](treadmill-runner.mobile-wrapper.png) | [JSON](treadmill-runner.checks.json) | 이번 앱 구현의 출발점 |

HTML 단독 실행본은 내려받아 브라우저에서 연다. 인라인 소스는 원본 바이트를 보존했다. 단독 실행본은 채팅 전용 호스트 도구가 없어도 볼 수 있도록 로컬 스타일을 갖춘 얇은 문서로 다시 감쌌다. 실제 훈련 수치가 아니며 과거 저장 상태는 가져오지 않는다.

기존 스크린샷·JSON은 **이전 시안의 확인 결과**다. 현재 앱의 검증은 [VALIDATION.md](../VALIDATION.md)와 `screenshots/`를 따른다. 이전 트레드밀 모바일 캡처 하나는 QA용 iframe 높이가 고정된 상태에서 하단 선택 문구가 일부 잘렸고, 별도의 wrapper 캡처에서는 전체 내용이 들어맞는 것을 확인했다. 원본을 수정해 덮어쓰지 않았다.

이전 자동 확인 스크립트는 절대 로컬 경로·채팅 호스트에 묶인 개발 보조물이어서 실행 가능한 인수 코드로 포함하지 않았다. 그 확인 결과와 실제 시안 소스는 보존했고, 현재 앱에는 재현 가능한 단위 테스트와 Playwright 테스트를 새로 작성했다. 탐색 단계의 네 다른 게임 아이디어는 텍스트 제안만 확인되었으며 실행 결과물이 만들어졌다고 표시하지 않는다.
