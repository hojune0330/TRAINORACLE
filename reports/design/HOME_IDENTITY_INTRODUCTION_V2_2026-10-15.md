# 홈 정체성·소개 v2 로컬 구현 인계

작성일: 2026-10-15

## 완료 경계

- 사용자 승인: “그래 깔금하게 홈화면 개선해.”
- 완료: 홈의 상시 작은 정체성, 기존 사용자도 볼 수 있는 짧은 소개 v2, 더보기의 앱 소개 다시 보기, 변경 경계의 로컬 검사와 실제 렌더 검수.
- **미커밋·미푸시·미배포**다. 이전 수동 배포는 별도 완료 요청이며 이번 소스를 공개하지 않았다.
- 착수 시 `fetch origin` 후 작업실 HEAD와 `origin/main`은 모두 `2b42210eec82f5d1ddc6e1acfb5e7db7c04f998e`, 좌우 차이 0/0, dirty 없음이었다.
- 작업실: `D:/admin/Documents/ChatGPT/트레인 오라클/.scratch/manual-design-release-20261015-source`.
- 이번 요청 전 공개 확인값은 source `2b42210e...`, Pages `39e12ac1...`이다. 이 보고서는 그 공개 앱에 새 v2가 반영됐다는 증거가 아니다.

## 바뀐 화면과 상태

1. 홈 헤더의 기존 생성 심볼을 48px로 항상 표시한다. 빈 홈은 대표 H1 `운동 분석과 훈련 계획`에서 목적을 한 번 말하고 헤더에는 중복 목적 문장을 쌓지 않는다. 기록·계획 홈은 짧은 목적 문구와 기존 `훈련과 기록`/`내 기록` 제목을 유지한다.
2. 큰 112px 첫 방문 아트와 별도 확대 제목 상태를 제거했다. 첫 방문·재방문의 핵심 행동 위치는 같은 구조다.
3. 소개 v2는 다음 훈련과 오늘 기록·컨디션 행동 **뒤**의 짧고 닫을 수 있는 인라인이다. 기록·계획 보유자도 대상이며 기존 사용자에게 새 계획을 주 CTA로 추가하지 않는다.
4. v1 열람은 v2를 막지 않는다. `trainoracle.home-introduction.v2`는 **소개 닫기라는 사용자 행동에만** 기록한다. 아래에 렌더한 것만으로 열람 처리하지 않는다. 닫지 않고 이동한 경우에는 다음 진입에도 안내가 남는다.
5. 닫은 뒤에는 작은 심볼과 현재 작업만 남는다. 닫기 포커스는 화면 밖 상단 제목 대신 바로 앞 오늘 영역의 마지막 기존 행동으로 돌아가며 `preventScroll`을 사용한다.
6. `더보기 → 관리 → 앱 소개`는 기존 MoreView/changeView 및 AppShell history 패턴을 재사용한다. 화면의 짧은 앱 정의와 실제 훈련 계획·운동 분석 목적지 두 개만 제공한다. 별도 전역 모달·노출 추적 엔진은 만들지 않았다.
7. 직접 링크·로그인/중단 화면 복귀의 기존 `isPlainHomeEntry`/진입 가드와 다른 오버레이 앞의 억제 조건을 유지했다. 일지·경기 기록·계획이 읽기 완료되지 않거나 현재 경고가 있으면 자동 소개를 표시하지 않는다. 작은 심볼은 읽기 상태·저장 성공 표식이 아니다.
8. 그림 실패는 이미지 노드만 제거한다. 제목·행동·닫기는 계속 작동한다. UI 설정 쓰기는 localStorage → sessionStorage 순서로 실패를 흡수하며 둘 다 거부돼도 현재 화면에서 닫기와 이동이 가능하다. 새 모션은 없다.

## 파일 소유와 변경 경계

이번 변경의 구현·테스트·문서 소유자는 `sol_design_delivery` 한 명이다. 조율·독립 검수자는 직접 편집하지 않았다.

| 파일 | 변경 |
| --- | --- |
| `app/src/screens/home/HomeIntroduction.tsx` | v2 전용 UI 설정, 명시적 닫기, 상시 그림, 짧은 인라인 소개 |
| `app/src/screens/home/TrainingHome.tsx` | 모든 홈의 정체성, 한 H1, 기존 행동 뒤 소개, 근접 포커스 복귀 |
| `app/src/screens/Home.tsx` | 보유 자료도 허용하되 실제 읽기 준비·경고 경계를 유지하는 표시 조건 |
| `app/src/screens/More.tsx` | 앱 소개 행과 introduction 하위 보기, 기존 뒤로/포커스/스크롤 패턴 재사용 |
| `app/src/AppShell.tsx` | More history 허용 목록과 실제 계획·오라클 탭 이동 연결만 |
| `app/src/styles/home-hub.css` | 작은 헤더 정체성·간결한 소개·기존 토큰 |
| `app/src/styles/home-menu.css` | 앱 소개 하위 보기의 간격 |
| `app/src/screens/home/HomeIntroduction.contract.test.tsx` | v1→v2, 기존 기록/계획, 미열람, 닫기/재방문, 준비·실패·직접 진입 |
| `app/src/screens/home/HomeJournalReadiness.contract.test.tsx` | 읽기 미완료에서도 중립 심볼만 남고 소개/seen은 없다는 계약 |
| `app/src/screens/home/TrainingHome.modes.contract.test.tsx` | 승인된 간결한 빈 홈 H1 기대값 |
| `app/src/screens/More.discovery.contract.test.tsx` | 소개 재열기와 목적지·원점 포커스/스크롤 복귀 |
| `docs/UX_UI_VISUAL_STANDARD.md` §8.9 | 이번 사용자 정정만 반영하여 이전 빈 홈 전용·112px 기준 갱신 |
| 이 보고서 | 구현·검증·미배포 경계 |

일지·훈련 계획·페이스·안전 계산, 구매·보상·계정·DB·인증·공지 dismiss 데이터는 수정하지 않았다. 새 에셋·설치·공유 의존성 갱신도 없다. 이전 원본/캡처/수동 배포 bundle과 다른 작업실은 보존했다.

## 실제 검사와 실패 수정

검사는 고정 Node 24.19.0과 기존 의존성을 사용했으며, 전체 단위/브라우저 suite를 실행한 것이 아니다.

| 검사 | 실제 결과와 경계 |
| --- | --- |
| 타입 검사 1회 | 설치된 TypeScript의 `--noEmit --pretty false`가 exit 0. 마지막 제목 단어 공백·근접 포커스 변경 전 결과이며 타입 검사를 두 번 돌리지 않았다. |
| 첫 관련 5파일 검사 | **81개 실제 실행, 79개 통과·2개 실패**. worker startup 오류는 재발하지 않았다. |
| 두 실패 파일 표적 재검사 | 31개 중 30개 통과·1개 실패. 승인된 H1의 오래된 기대값을 수정한 TrainingHome.modes 21개는 통과했다. |
| 최종 관련 검사 | More.discovery + HomeIntroduction **27개 통과**, 실패 0. 마지막 공백·포커스 수정이 반영된 소스다. 위 실행 수를 더해 새 통과 수처럼 보고하지 않는다. |
| 로컬 빌드 | 첫 준비 빌드 exit 0(37.56초). 마지막 공백·포커스 수정 뒤 **최종 후보를 다시 빌드하여 exit 0(15.96초)**. 기존 폰트 경로/동적·정적 import/큰 chunk 경고는 남아 있다. |
| 실제 앱 브라우저 | **최종 빌드**를 루프백에서만 제공한 새 합성 비회원 Chrome 검사 1회가 exit 0. 10개 변경 경계 확인·8개 캡처, 상세는 아래. 외부 요청은 차단했다. |
| 결함 주입 대조 | v2 UI 키를 일시적으로 v1로 돌렸을 때 기존 TRAINING/JOURNAL 사용자의 `despite v1 seen` 두 테스트가 **이름으로 실패**했다. 즉시 원래 v2 키를 복원했다. 의도된 실패이며 제품 실패/통과 수에 합산하지 않는다. |
| 최종 소스 확인 | `git diff --check` 통과. 새 hex·이미지·모션·전역 숨김·저장 호출 확장 없음. |

처음 실패한 정확한 이름과 수정은 다음과 같다.

- `keeps welcome focused on recording and planning with a named learning and decoration entry`: 이전 2줄 큰 H1을 기대하던 테스트만 승인된 `운동 분석과 훈련 계획`로 갱신했다. 실제 행동 검사와 버튼·예시 순서는 유지했다.
- `replays the app introduction and returns to its exact opener and reader scroll`: More 소개 제목의 `<br>` 앞 단어 공백 누락으로 접근 가능한 이름이 붙었다. 기대값을 완화하지 않고 **소스 단어 공백**을 수정해 통과했다.

## 브라우저 증거

산출 위치: `D:/admin/Documents/ChatGPT/트레인 오라클/.scratch/home-introduction-v2-20261015/`

빌드·브라우저는 실제 앱 코드와 자산을 사용했다. 기록·계획은 현재 저장 스키마로 검증한 **합성 fixture**이며 실사용자·실계정 자료가 아니다. 이 절은 변경 범위의 로컬 검수이지 공개 배포 검증이 아니다.

- `browser-results.json`: 상태 PASSED. 각 경계·기하 좌표·캡처 경로.
- `final-related-results.json`: 최종 관련 27개 통과.
- `targeted-results.json`: 앞선 표적 재검사 30/31 및 정확한 실패 이름.
- `negative-control-results.json`: v1 키 회귀의 의도된 이름별 실패 2건.
- `build-review.mjs`, `review.mjs`: 재현 가능한 별도 로컬 검수 실행. 설치·게시·실계정 통신 없음.

| 화면/동작 | 확인 |
| --- | --- |
| 375×812 기존 계획+일지, v1 seen | 다음 훈련 y162.39–293.25, 오늘 기록 y317.25–373.25. 소개 닫기 전후 두 좌표가 동일했다. 상시 그림 정상 로드, v2는 닫기 전 미기록. |
| 320×700 기존 사용자 | 다음 훈련 y162.39–317.17, 오늘 기록 y341.17–397.17. 가로 넘침·44px 미만 클릭 영역 없음. |
| 1280×900 기존 사용자 | 실제 앱의 넓은 창 안에서 기존 홈 폭·중앙 정렬·행동 순서와 작은 정체성을 확인. 가로 넘침 없음. |
| 320px, 글씨 200% | 각 HTML 요소의 계산된 글자 크기를 2배로 확대해 줄바꿈/스크롤/44px 검사. 키보드로 소개 닫기 후 가까운 컨디션·메모가 y136.70–218.55에 보이고 scrollTop 668→668 유지. OS 실제 확대나 실물 iPhone 검사는 아니다. |
| More 소개 재열기 | 헤더 뒤로, 브라우저 Back/Forward, 앱 소개 opener의 포커스와 scrollTop 736 복귀 통과. 실제 화면 제목·계획/분석 목적지 두 개 확인. |
| 빈 홈 | 하나의 앱 목적 H1, `훈련 계획 받기` → `운동 분석 예시 보기` → 기록·컨디션 순서 유지. |
| 그림 실패+UI 설정 저장 거부 | 작은 그림의 빈 슬롯 제거, 소개 닫기·더보기 이동 가능. 기존 데이터 쓰기에는 거부 처리를 걸지 않았다. |
| 잘못된 계획/직접 계정 URL | 소개 자동 표시 없음, v2 열람 쓰기 없음, 중립 그림 유지. |
| 움직임 줄이기 | OS reduced-motion 환경에서 동일 경로 검사. 새 그림/소개 자체에는 애니메이션·강제 대기가 없다. |

캡처 파일:

- `existing-athlete-first-375.png`
- `existing-athlete-return-375.png` — 재로드가 보존한 스크롤 위치의 캡처. 자동으로 상단에 올리지 않았다. 작은 심볼의 DOM 유지도 별도 단언했다.
- `more-introduction-375.png`
- `existing-athlete-first-320.png`
- `existing-athlete-320-text-200.png`
- `existing-athlete-320-text-200-dismiss-focus.png`
- `existing-athlete-first-1280.png`
- `empty-home-375.png`

구현자가 캡처를 직접 읽고 확인했으며, 조율자도 기존 사용자 375px·빈 홈·320px·200% 포커스와 More를 직접 확인했다. 독립 소스 검토에서 지정 범위의 확정 P1/P2는 없었다. 이는 코드·합성 화면 검수이며 실제 아동 사용자 검증은 아니다.

## 미실행·보존·종료 상태

- 전체 unit suite, 전체 브라우저 suite, hosted CI, 실제 계정 저장·복원·DB 왕복은 실행하지 않았다.
- 마지막 단어 공백·포커스 수정 뒤 TypeScript 전체 재검사는 하지 않았다. 최종 로컬 bundle과 해당 동작 검사는 통과했다.
- 기존 서버/저장/공개 설정을 변경하지 않았고, 인증·일지·계획·안전·구매·공지 dismiss 데이터도 변경하지 않았다.
- 모든 로컬 빌드·테스트 명령은 종료됐다. 브라우저 검수의 finally에서 Chrome context/browser와 루프백 서버를 닫았으며 실행은 exit 0으로 끝났다. 별도 개발 서버나 배포 작업을 남기지 않았다.
- 원본·검수 산출물과 미커밋 소스는 보존한다. 커밋·푸시·공개 반영은 다음 별도 승인 경계다.
