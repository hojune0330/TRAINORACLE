# 디자인 시스템 재사용 검토 증거

- 날짜: 2026-09-12
- 기준: main `00ca7c5e2e7f70d7c0f18e3e351c2392c51af23f`
- 검토 HEAD: `dcdeef8ed85226ebe2695acce32e57884fd93f98`, 기준 main과 파일 트리 동일
- 앱 변경 없음. 이 폴더는 로컬 디자인 검토 산출물이다.

## 파일

- `observations.json`: 40개 앱 화면 상태의 텍스트·글자 크기·geometry·폰트 로딩·문서 가로 넘침 기록.
- 해당 이름의 PNG 40개: viewport 캡처. 전체 페이지를 한 장으로 축소한 이미지가 아니다.
- `proposal-17.png`~`proposal-20.png`: 기존 handoff HTML 4개 렌더. 20번은 검토 문서 시안이지 제품 화면이 아니다.
- `proposal-assets.png`: 해당 handoff 그림 16개를 모은 시트.
- `proposal-observations.json`: 시안의 이미지 로딩 상태와 에셋 파일명.
- `capture.mjs`, `proposal.mjs`: 실제 실행한 로컬 경로 기준 스크립트. 다른 환경에서 실행하려면 경로를 바꾼 별도 사본을 만들고 출력은 새 디렉터리로 지정한다.

## 시험 범위

Chrome headless, ko-KR, Asia/Seoul, 375×667 / 320×568 / 1440×900. 외부 네트워크는 차단하고 앱을 로컬 preview에서 실행했다. 실제 사용자 계정·이메일·건강 데이터는 사용하지 않았다. 시험 기록은 빠른 기록에서 만든 운동 완료 1건에 거리 5km를 더한 합성 기록이다.

화면 캡처는 기능 테스트 40개 통과라는 뜻이 아니다. document overflow=false는 각 요소의 겹침이 없다는 보장도 아니다. 저장 안내와 재료 서랍의 겹침은 실제로 별도 발견했다.

`fontReady=true`만 믿지 않고 `loadedFonts`의 Pretendard 상태도 확인했다. 시안 외부 웹폰트는 차단되어 시안의 typography 렌더 검수는 제한된다.

## 실행한 기존 검사

`npm exec -- vitest run src/styles/visual-system.contract.test.ts src/styles/compact-tabs.contract.test.ts`

- 2 test files passed
- 8 tests passed
- 27.38초

이 검사는 일부 시각 계약을 확인하며, 보고서에서 발견한 화면 구성 결함을 모두 검출하지는 않는다. 전체 앱 테스트·전체 e2e·실기기 검수의 대체물이 아니다.

캡처 제작 중 접근 가능한 버튼 이름을 맞추기 전 탐색 스크립트가 중단된 시도가 있었다. 최종 `capture.mjs`는 마지막 상태까지 정상 종료했다. 중간 실패를 앱 기능 실패나 통과 증거로 계산하지 않았다.

[DRAFT_COMPLETE]
