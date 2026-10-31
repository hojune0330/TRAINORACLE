# 최종 수치 정렬 통합 확인 — 2026-10-31

제품 커밋 **`d4bcbf9178aa4d8b98b50bafb69e3b1da5ce947a`**, 브랜치 `ux/flow-20261031`.
기준 HEAD는 `2cba2ab54f0abeac43f43ebc5c7c7ff91ce3a5ca`다. 공통 담당의 `77a6fdb1f3ebaea52dcdc70e95891975ba26a570` / `record-metric-alignment.patch`를 적용했다. 제품 변경은 `app/src/components/record-ui.css`의 **10줄 추가, 1파일**이다. 공통 담당 최신 CSS와 줄바꿈을 제외한 텍스트가 정확히 같다.

선택적 `종류 미확인` 설명이 있는 지표를 subgrid의 label/value/detail 세 행으로 묶는다. 거리와 시간 숫자의 위치가 같아지고 설명은 그 아래에 남는다. 수치·단위·출처를 삭제하거나 고정 높이를 넣지 않는다. subgrid 미지원 환경에는 기존 배치가 남으며 그 환경의 정렬을 해결했다고 주장하지 않는다.

## 실제 제품 화면 검증

전용 컴포넌트 예제가 아닌 **최종 TrainOracle의 실제 가져오기 화면**을 실행했다. 계정 공개 OFF, 외부 요청 차단, Chrome **155.0.8059.85**, 812px 높이, Asia/Seoul, Pretendard, reduced motion 환경이다. 합성 TCX의 2–7km 운동 **6건 전체**를 각 조건에서 측정했다. 큰 글씨 조건에서는 첫 기록을 `1,256.78분`으로 바꾼 합성 TCX를 사용했다.

| 조건 | 6개 행의 시간 숫자 top − 거리 숫자 top | 출처/미확인 설명 | 선택 해제 / 재선택 다음 행 이동 |
|---|---|---|---|
| 320px / 보통 글씨 | 모두 **0px** | 6건 모두 보존 | **0 / 0px** |
| 375px / 보통 글씨 | 모두 **0px** | 6건 모두 보존 | **0 / 0px** |
| 430px / 보통 글씨 | 모두 **0px** | 6건 모두 보존 | **0 / 0px** |
| 320px / DOM 글씨 200% | 자연스러운 세로 배치, 같은 top을 강제하지 않음 | 6건 모두 보존 | **0 / 0px** |

모든 행의 `파일에서 가져옴 · TCX`, `날짜 기준 · Asia/Seoul`, `종류 미확인`과 source가 수치 아래에 놓이는 순서를 확인했다. 선택 label과 저장 select의 조작 면은 각각 최소 44px 이상이었다. 큰 글씨의 `1,256.78` 숫자 부분은 한 줄이고 단위 `분`은 다음 줄로 흘러도 보존된다. 네 조건 모두 수평 넘침·브라우저 오류 0건, 저장 0건, POST 0건이다.

원본 수치와 6행별 좌표는 [evidence/results.json](evidence/results.json), 실행은 [verify.mjs](verify.mjs), 로그는 [browser.log](browser.log)다. 각 조건의 첫 행과 마지막 행 캡처를 보존하고 320px 보통/큰 글씨를 직접 열어 정렬·출처·줄바꿈을 확인했다.

| 조건 | 첫 부분 | 마지막 행 |
|---|---|---|
| 320 / 보통 | [화면](evidence/actual-six-320-100-top.png) | [화면](evidence/actual-six-320-100-last.png) |
| 375 / 보통 | [화면](evidence/actual-six-375-100-top.png) | [화면](evidence/actual-six-375-100-last.png) |
| 430 / 보통 | [화면](evidence/actual-six-430-100-top.png) | [화면](evidence/actual-six-430-100-last.png) |
| 320 / 200% | [화면](evidence/actual-six-320-200-top.png) | [화면](evidence/actual-six-320-200-last.png) |

재현: 저장소 루트에서 `node reports/ux-flow-20261031/metric-alignment/verify.mjs`. 이 CSS 변경의 정렬·출처·선택 안정만 표적으로 실행했다. 전체 CI·계정 검사·새 독립 검수를 반복하지 않았다. OS Dynamic Type, native 선택창, subgrid 미지원 브라우저는 이번 검사 범위에 넣지 않았다.

## 근거 문구와 범위 정리

A-WORK **2:11**은 **‘운동 시작/종류 목록으로 복귀’**다. 완료 운동의 기록 보관 목록이 아니다. [후속 대응표](../followup/README.md)의 관찰·도출 규칙·구현 설명을 함께 정정했다. 정확한 일지 ID·완료 결과 복귀·미저장 초안 보존은 **OUR 독립 검수/TOSS 요구**이며 해당 영상 구간에서 직접 본 동작으로 주장하지 않는다. A-FIT의 반복 요약행 근거와도 구별했다.

1번 `C:/Users/admin/Documents/Codex/2026-10-31/task/REVIEW-SCOPE-20261031.md`와 적용 범위를 맞췄다. 기존 대상의 새 필수 동작 누락은 확인되지 않았다. 홈의 자체 상태 안내, 종이 일지 전용 수치/출처, 분석의 자체 주 행동/미리보기 표현은 남아 있다. 읽기 전용 목록과 저장 전 선택행도 목적에 맞는 서로 다른 밀도를 쓴다. 공통 RecordUI를 쓰지 않은 사실 자체를 미해결 동작 결함이나 새 필수 교체 조건으로 보지 않는다. 해당 화면들의 모든 폭·큰 글씨 시각 비교 근거가 완비됐다고 확대하지 않는다.

이전 [followup/manifest.json](../followup/manifest.json)은 제품 `1f29f76541b611fcb415838e6b20bb6b39c397b0`의 역사적 제품 해시를 유지한다. 이번 문서 정정에 해당하는 README 항목만 갱신했다. **최신 CSS를 포함한 제품 18파일과 이번 화면 증거는 이 폴더의 [manifest.json](manifest.json)**에 별도로 묶었다. 이전 제품 커밋의 CSS 해시를 최신 커밋의 CSS 해시로 바꿔 적지 않았다.

Apple/Garmin NATIVE 직접 검증은 각각 0건이다. 공개 병합·배포·계정 활성화·로그인·권한 변경·설치·개인 건강정보 전송은 수행하지 않았다. 이 후속 작업의 로컬 구현·표적 확인에는 남은 차단이 없다.
