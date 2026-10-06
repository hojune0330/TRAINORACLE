# 개인정보 안내 배포 — 마지막 시험 오류 수정

- 기준일: 2026-10-06
- 통합 기준: `54e088c2c6c2b5a50a99cdac621dfdfcb3cc0930`
- 변경 범위: `app/src/domain/rpe-adjusted-slot-v3.contract.test.ts`의 선택자와 보존 근거 검증만 변경한다. 훈련 처방·계산, 저장 reader, 개인정보 처리, 인증, 배포 workflow와 운영 설정은 변경하지 않는다.

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
