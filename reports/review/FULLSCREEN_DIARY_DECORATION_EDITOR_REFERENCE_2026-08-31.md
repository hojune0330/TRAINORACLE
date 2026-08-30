# TrainOracle 풀화면 일지 꾸미기 편집기 레퍼런스 및 구현 기록

## 1. 문제

기존 꾸미기 화면은 일지를 상단의 작은 미리보기로 줄이고, 도구 목록을 화면 대부분에 배치했다. 스티커는 세 개의 고정 슬롯에만 들어가 사용자가 직접 위치와 크기를 조절할 수 없었다. 이 구조는 일지를 꾸미는 편집기가 아니라 꾸미기 항목을 고르는 상점에 가까웠다.

## 2. 확인한 공식 레퍼런스

### Canva

- [Group, layer, and align elements](https://www.canva.com/help/layer-group-align/)
- [Flip and rotate elements](https://www.canva.com/help/flip-and-rotate/)

선택한 요소를 드래그해 이동하고, 모서리 손잡이로 크기를 바꾸며, 별도 회전 손잡이로 각도를 바꾸는 직접 조작 방식을 확인했다.

### LINE 및 일본 사진 꾸미기 흐름

- [LINE 스티커 배치 기능 도움말](https://help.line.me/line/?contentId=20000182)
- [LINE 일본어 사진 편집 도움말](https://help.line.me/line/ios/?contentId=20008461&lang=ja)
- [LINE Camera 일본 Google Play 소개](https://play.google.com/store/apps/details?hl=ja&id=jp.naver.linecamera.android)

스티커를 캔버스로 끌어오거나 탭해 추가하고, 캔버스에서 크기·각도·위치를 조절하는 흐름을 확인했다. 도구는 스탬프·텍스트·펜처럼 기능별 아이콘으로 분리한다.

### Google Photos

- [Google Photos Android 편집 도움말](https://support.google.com/photos/answer/6128850/edit-your-photos-android?co=GENIE.Platform%3DAndroid&hl=en-GB)

편집 기능을 하단에서 카테고리별로 열고, 작업을 끝내면 원본 화면으로 돌아가는 도구 분류 방식을 확인했다.

### Apple Human Interface Guidelines

- [Modality](https://developer.apple.com/design/human-interface-guidelines/modality)
- [Going full screen](https://developer.apple.com/design/human-interface-guidelines/going-full-screen)
- [Toolbars](https://developer.apple.com/design/human-interface-guidelines/toolbars)

사진·문서처럼 집중이 필요한 편집 작업에는 전체화면 모달이 적합하고, 도구는 콘텐츠를 가리지 않도록 최소화하거나 숨길 수 있어야 한다는 원칙을 확인했다.

## 3. TrainOracle 적용 결정

1. 일지를 항상 편집 화면의 가장 큰 영역으로 유지한다.
2. 도구는 하단의 작은 아이콘 독으로 시작하며, 선택할 때만 바텀시트로 연다.
3. 장식을 적용하면 도구 시트가 자동으로 내려가고 캔버스와 장식만 남는다.
4. 스티커·테이프·도장은 일지 위에서 직접 드래그한다.
5. 선택 테두리의 손잡이로 크기와 각도를 조절한다.
6. 키보드 화살표와 `+/-`도 같은 좌표·크기 계약을 사용한다.
7. 위치는 기기 픽셀이 아니라 페이지 비율로 저장해 화면 크기가 달라도 같은 자리에 보이게 한다.
8. 기존 좌표 없는 저장 자료는 기존 슬롯으로 그대로 보존한다. 사용자가 처음 옮긴 장식만 자유 배치로 전환한다.
9. 자유 좌표가 손상되면 장식을 삭제하지 않고 기존 슬롯 위치로 되돌린다.
10. 페이지당 이모지 세 개 상한과 원문 일지 비변경 원칙은 유지한다.

## 4. 검증 관문

- 도구가 닫힌 첫 화면에서 일지가 휴대폰 편집 영역 대부분을 차지할 것
- 도구 아이콘의 터치 영역이 44px 이상일 것
- 장식 적용 뒤 도구 시트가 자동으로 닫힐 것
- 위치·크기·회전 값이 저장 후 재진입해도 유지될 것
- 320×568, 375×667, 데스크톱에서 가로 넘침이 없을 것
- 모션 감소 설정에서 도구 시트 전환을 제거할 것
- 기존 좌표 없는 v2 꾸미기 저장 자료를 그대로 읽을 것

## 5. 범위 경계

이번 구현은 장식의 이동·크기·회전과 편집기 레이아웃을 다룬다. 일지 원문, 비밀 메모, 분석 입력, D9 안전 상태는 꾸미기 데이터와 연결하거나 변경하지 않는다.

## 6. 실행 및 화면 검증

- TypeScript 앱·E2E 타입 검사 통과
- 전체 Vitest `1,815/1,815` 통과
- 꾸미기 계약 집중 테스트 `32/32` 통과
- 터치·데스크톱 Playwright `8/8` 통과
- 프로덕션 빌드 통과
- 모바일 `390×844` 실화면에서 숨김 도구 서랍, 적용 후 캔버스 복귀, 실제 일지 전체화면 편집, 선택 손잡이를 확인
- 도구 목록을 내린 뒤 서랍을 닫아도 상단 종료 버튼이 복원되는 회귀 경로 확인
- 새 그림자 5곳을 디자인 계약 검사에서 발견해 제거하고 선·색 대비만 유지
