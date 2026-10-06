# 개인정보 안내 배포 — 시험 계약 보완과 출시 관문

- 기준일: 2026-10-06
- 통합 기준: `54e088c2c6c2b5a50a99cdac621dfdfcb3cc0930`
- 첫 보완 범위: `app/src/domain/rpe-adjusted-slot-v3.contract.test.ts`의 선택자와 보존 근거 검증이다. 아래 추가 브라우저 보완은 이미 변경된 메뉴 구조를 쓰는 E2E 시험의 탐색 위치만 맞춘다. 훈련 처방·계산, 저장 reader, 개인정보 처리, 인증, 배포 workflow와 운영 설정은 변경하지 않는다.

## 실제 실패와 좁은 수정

`37400361781` attempt 2와 최신 기준 `37405241460`의 `app-quality`에서 `opens a saved multi-plan through real application navigation with independent retained evidence`가 실패했다. 실제 운동 입력의 `오전` 버튼과 다른 화면의 동명 버튼을 전역 선택자가 함께 찾았다. 일반 시험 묶음은 통과했지만 이 heavy 시험 실패로 후속 browser/deploy 검사는 시작되지 않았다. 시작되지 않은 검사는 통과가 아니다.

선택자를 `운동은 어떻게 됐나요?` region 내부로 한정한다. 실제 앱 진입 → 날짜·슬롯 → 일지 → 명시적인 완료·RPE·통증 없음 → 저장과 기존 처방 보존 검증, 15초 제한은 유지한다. 독립적으로 보존된 검토 근거가 있으면 `multi_adjusted_v3_loaded`, 근거가 없으면 `invalid`인지 함께 검증한다.

## 확인한 증거와 범위

수정된 시험의 Git blob은 `6f89e7ac847434491f14d7f2f9de83925606387e`이다. 합성 자료만 사용했다. 실행 영수증은 ignored `app/test-results/rpe-adjusted-slot-20261006/`에 남겼으며 원문 일지·회원 자료·비밀키를 포함하지 않는다.

| 증거 | 결과 | 한계 |
|---|---|---|
| `baseline-utc.json` | 73 통과 / 1 실패 | 기존 전역 버튼 중복 실패 |
| `post-fix-utc.json` | 74/74 통과 | 로컬 Node 24.19.0, 변경 시험 파일 전체 |
| `post-fix-kst-tz.json` | 74/74 통과 | `TZ=Asia/Seoul`, maintained 기본 config의 native/no-cache 실행 |
| `negative-control-reader-evidence-missing.json` | 선택한 시험의 positive assertion 실패 | 필요한 보존 근거를 빼는 입력 대조이며 reader 소스 결함 주입 증거는 아님 |
| `negative-control-v6-retained-leak.json` | 선택한 시험의 마지막 `invalid` assertion 실패 | 실제 v6 reader의 해당 합성 읽기에만 보존 근거를 잘못 빌려 쓰는 결함을 주입하여 `multi_adjusted_v3_loaded`를 확인 |
| `post-reader-fault-target-pass.json` | 대상 1/1 통과, 나머지 73 필터됨 | reader와 시험 원복 후 실제 소스 diff 0 확인 |
| `integrated-54e088c-target-utc.json` | 대상 1/1 통과, 나머지 73 필터됨, exit 0 | 최신 원격 변경을 보존한 통합 기준 |
| `integrated-54e088c-target-kst-tz.json` | 대상 1/1 통과, 나머지 73 필터됨, exit 0 | 통합 기준의 KST 시간대 동등 실행이며 wrapper 자체 통과는 아님 |

KST wrapper의 native 로딩은 extensionless config import 단계에서 실패하여 시험이 시작되지 않았다. 위 KST 시간대 실행을 wrapper 자체 통과라고 표현하지 않는다. 초기 ungated 결함 주입 시도는 원하는 assertion 이전 UI 단계에서 실패하여 유효한 음성 대조 증거에서 제외한다. 모두 보존하며 실패 기록을 성공으로 덮어쓰지 않는다.

최신 `54e088c2`의 설치 안내·계획 진입 여백 수정은 다른 작업자의 변경이다. 파일 충돌 없이 fast-forward로 보존했다. 통합 후 대상 UTC/KST와 앱의 실제 설치된 TypeScript `--noEmit --pretty false`는 exit 0이다. 정확한 최종 commit의 hosted 필수 검사와 이 로컬 증거를 구분한다.

## 공개 경계

계정·건강정보의 새 온라인 수집, Oracle V2, provider 연동, Edge/DB 배포를 활성화하지 않는다. 기존 개인정보 안내의 시행 예정일은 실제 운영 절차 확인으로 대체하지 않는다.

현재 자동 Pages 게시 workflow는 기존 root와 `previews/`를 지우는 경로가 있어 이번에 열지 않는다. workflow나 저장소 운영 변수를 임의로 고치지 않는다. 필요한 경우 exact source의 `contract-tests`, `app-quality`, `app-browser` 통과를 확인한 후 계정/V2 OFF 결과물을 최신 `gh-pages` 위에 추가형으로 정상 게시한다. 기존 미리보기·사용자 자료는 삭제하지 않는다. 배포 검사와 실제 공개 artifact/UI 확인은 별도 보고한다.

## 추가 브라우저 관문에서 발견한 메뉴 계약 차이

`5f3f1333e6201e54cd119bbb341b1ba2b67a224f`의 hosted run `37408738660`에서 `contract-tests`와 `app-quality`는 통과했다. `app-browser`의 `Verify encrypted account journal buffer and record recovery` 단계 중 `file-analysis-flow.spec.ts`는 9개 중 1개 통과, 8개 실패했다. 전부 기존 `오라클 항목` group 안의 `파일 분석` 버튼을 찾지 못한 5초 단언 실패이며 작업 exit 1이다. runner 종료나 전체 작업 시간 초과가 아니다. 이후 일반 브라우저 검사와 `deploy-pages`는 시작하지 않았다. 배포 guard를 실행하거나 통과했다고 보고하지 않는다.

현재 `Trends.tsx`의 상위 `오라클 항목`은 `내 훈련 · 러닝 취향 · 읽을거리`이며, `파일 분석` 등 다섯 세부 버튼은 `훈련 분석 자세히 보기` group에 있다. 이 구조는 기존 실행 코드다. 새 개인정보 변경을 이유로 이전 화면으로 되돌리지 않는다. 시험의 버튼 검색 범위만 현재 의미상 group으로 맞추고 실제 저장·계정 재조회·수치·제외·불변성·선택된 항목 검증은 유지한다. 같은 옛 메뉴 범위를 쓰는 일반 브라우저 시험도 동일한 계약 차이 범위에서 확인한다.

독립 검토에서 `rest-day-copy.spec.ts`의 `분석 기준`도 현재 훈련 요약 화면에만 있다는 점을 확인했다. 훈련량의 제외 수 검증 뒤 `훈련 요약`으로 명시 이동해 동일한 기준·안전 카피를 검증한다. 두 원래 거리 단언과 `계획·안전 판단은 자동으로 바꾸지 않아요` 및 과장된 건강 판단 없음 단언을 제거하지 않는다.

현재 메뉴 범위로 보완한 원래 파일 분석 시험은 로컬 실제 Chrome에서 9/9 통과, 실패·건너뜀 0, exit0이다. 320px·375px 화면 사례도 포함한다. `app/test-results/file-analysis-selector-fixed-9-20261006/.last-run.json`은 `passed`이며 SHA256은 `91d1c43004802cd49950d78eb11c8fa7d05da8ffffe219a8b13b2f561bc00903`이다. 실제 설치된 TypeScript로 E2E 형식 검사도 exit0이다. 합성 계정과 기존 envFile:false 로컬 fixture를 사용한 집중 검증이며, 보완 후 전체 hosted 브라우저 관문은 아직 별도 확인 대상이다. 새로운 온라인 계정·파일 수집·동의·실회원 자료 변경은 수행하지 않았다.

같은 선택자를 수정한 일반 브라우저8사례를 개발용 source fixture에서 집중 실행한 추가 시도는 1통과·7실패, exit1이다. `launch-ready` 등은 원래 60초 제한에서 페이지 `load`를 기다리다 실패했고, `touch-surfaces`는 수정한 메뉴 이전 상세 화면의 원래 수량 단언에서 실패했다. 이 시도는 maintained 일반 시험의 build-preview 환경이 아니므로 정식 출시 검사를 대체하지 않으며, 실패를 성공으로 덮어쓰지 않는다. 원인은 별도 확인 대상이고 timeout·retry·안전 단언이나 운영 코드를 약화하지 않는다.

로컬 원래 320px 사례에서 기존 선택자 실패를 재현했다. 보완 후 실제 `AppShell.tsx`의 가져오기 완료 콜백을 `files` 대신 `summary`로 잠시 보내는 결함을 주입했다. 같은 `report reflow, keyboard and reduced motion at 320px with 200% text` 시험은 `saveImport`의 원래 `aria-pressed=true` 단언에서 `false`를 받아 실패했다(1FAIL/0SKIP, exit1, 5초 단언 유지). 따라서 새 선택자는 버튼의 존재만 확인해 잘못된 이동을 통과시키지 않는다. 실행 종료의 `finally`에서 원래 콜백으로 복원했고 AppShell 소스 diff0/exit0를 확인했다. 실행 영수증 `app/test-results/file-analysis-selector-root-control-20261006.json`의 SHA256은 `558293c8c8dac386d2d9fe383715b9f55e68a3b19cbbe76e1e675d2dcde37101`이다. 정상 소스의 9개 재검사와 새 exact hosted 관문은 이 음성 대조와 별도로 판정한다.
