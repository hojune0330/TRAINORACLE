# DEVELOPMENT_STATUS_AND_NEXT_GATE_2026-07-26.md

```yaml
document_metadata:
  doc_id: trainoracle-development-status-next-gate-2026-07-26
  status: CURRENT_MAIN_AND_OPEN_PR_SNAPSHOT
  owner: COACH_HOJUNE
  prepared_by: CODEX
  observed_at: "2026-07-26"
  main_commit: 0d5dc6548f920ca882f2d555b92b37f3c91ab6c7
  live_url: https://hojune0330.github.io/TRAINORACLE/
  canonical_promotion: false
  final_marker_required: "[DRAFT_COMPLETE]"
```

## 1. 대표님용 한 줄 설명

TrainOracle은 지금 **일지 앱과 기본 훈련계획 베타는 실제 공개되어 작동**하지만,
가장 중요한 종목별 숫자 처방과 일지 기반 적응은 아직 계약·연구 시드 단계다.

## 2. 실제 공개된 사용자 흐름

공개 URL은 HTTP 200이며 GitHub Pages 상태는 `built`다.

사용자는 현재 회원가입 없이 다음을 할 수 있다.

1. 첫 방문 목적 선택
2. 훈련 후·하루 마무리·경기 일지 저장
3. 최근 일지·주간/추이 확인
4. 지난 일지 조회·삭제·휴지통 복원
5. JSON 백업 복원과 활동 파일 가져오기
6. 5개 질문을 눌러 7일·9일·10일 훈련계획 후보 2개 생성
7. 후보 선택
8. 완료·휴식·건너뜀·통증 상태 기록
9. 이전 주기 진행 집계를 다음 후보 생성에 전달
10. 방문과 일지 날짜로 로컬 포인트 적립

통증이나 현재 상태가 불명확하면 계획 후보를 만들지 않는다.

## 3. 숫자로 보는 현재 상태

| 항목 | 현재 수치 | 의미 |
|---|---:|---|
| 공개 Plan Beta 질문 | 5단계 | 종목군, 경험, 훈련 가능일, 7/9/10일, 안전 확인 |
| 생성 후보 | 2개 | 균형형, 보수형 |
| 지원 프레임 | 3개 | 7일, 9일, 10일 |
| 표시 종목군 | 4개 | 중거리, 5K, 10K, 일반 지구력 |
| 현재 세션 역할 | 3개 | EASY, QUALITY, REST |
| 현재 숫자 처방 | 1종 | 시간 범위 + RPE 범위 |
| 상세 처방 연구 시드 | 30개 | 5개 의도 계열 각 5개 + 회복 지원 5개 |
| 실제 활성 상세 템플릿 | 0개 | 사람 검토 전 선수에게 배정 금지 |
| 상세 표기 parser/calculator | 0개 | 다음 작업 대상 |
| 앱 단위 테스트 | 292 PASS | 현재 PR #123 head와 동일 앱 코드 기준 |
| Plan/D9 안전체인 테스트 | 36 PASS | 후보·선택·진행·D9 차단 |
| D9 평가기 테스트 | 11 PASS | ACTIVE/UNKNOWN/CLEARED와 RVE 매핑 |

## 4. 기능별 현실 상태

| 기능 | 상태 | 쉬운 설명 |
|---|---|---|
| 웹/PWA 배포 | `LIVE` | 주소를 열어 바로 사용할 수 있음 |
| 로컬 일지 | `LIVE_BETA` | 저장·조회·삭제·복원 가능; 기존 항목 편집은 아직 미병합 |
| 추이와 기본 집계 | `LIVE_BETA` | 실제 입력한 값만 집계 |
| 데이터 가져오기·백업 | `LIVE_BETA` | 파일 검증, 중복 확인, 복원 가능 |
| D9 안전 차단 | `RUNTIME_TESTED_BETA` | 위험 또는 불명확하면 계획을 생성하지 않음 |
| 기본 훈련계획 | `LIVE_BETA` | 시간·RPE 중심의 후보 2개 |
| 상세 종목별 처방 | `DOCUMENT_AND_DRAFT_CATALOG` | 내용은 준비됐지만 아직 실행되지 않음 |
| 일지 기반 계획 적응 | `CONTEXT_ONLY` | 일지 존재와 진행 집계만 전달, 수치로 처방 변경 안 함 |
| 계정·동기화 | `CODE_MERGED_PUBLIC_GATE_OFF` | 코드와 테스트는 있으나 출시 승인값이 없으면 화면에서 꺼짐 |
| 코치 연결·원격 승인 | `NOT_PUBLIC` | 실제 코치 워크플로 미개통 |
| 구독·결제 | `NOT_IMPLEMENTED` | 유료 기능 경계만 기획됨 |

## 5. 훈련계획 핵심 기능의 성숙도

훈련계획을 다섯 단계로 나누면 현재는 **2단계 초입**이다.

| 단계 | 목표 | 상태 |
|---|---|---|
| 1 | 안전 확인 후 후보 생성·선택·진행 | 완료된 공개 베타 |
| 2 | 세트·반복·거리·페이스·회복을 구조화 | 계약과 30개 시드 완성 중, 실행 코드는 없음 |
| 3 | 사람 검토를 통과한 종목별 템플릿 활성화 | 활성 0개 |
| 4 | 일지·기록·목표를 근거로 후보를 다르게 구성 | 아직 진행 집계만 사용 |
| 5 | 코치 연결·설명·수정·유료 서비스 | 미구현 |

현재 공개 계획은 종목군 이름을 보존하지만, 실제 처방은 종목별로 크게 달라지지 않는다.
중거리·5K·10K 모두 경험대별 EASY/QUALITY 시간과 RPE 범위를 공유한다.
따라서 “계획이 생성된다”는 기능은 진짜지만, “근거 있는 종목별 상세 설계”는 아직
서비스의 다음 핵심 개발 대상이다.

## 6. PR #123 검수 상태

```yaml
pr: 123
initial_independent_verdict: REQUEST_CHANGES
blocking_finding:
  - intent_family_5_each_not_locked
  - owner_fixture_totals_not_locked
  - final_marker_position_not_locked
fix_commit: 9ae4cb9e8437840f8a443e0733d1d70a89b933a6
local_reverification:
  hostile_validator_tests: 18_PASS
  app_tests: 292_PASS
  impl_tests: 36_PASS
  d9_tests: 11_PASS
github_ci:
  contract_tests: PASS
  app_quality: PASS
  app_browser: PASS
remaining_gate: INDEPENDENT_RE_REVIEW_APPROVE
```

기술적 차단은 고쳤지만 같은 구현자가 독립 승인까지 대신할 수는 없다.
PR #123은 재검수 전까지 Draft와 병합 금지를 유지한다.

## 7. 다음 순서

1. PR #120 검수·병합: 현재 화면의 쉬운 설명과 `미지정` 경계를 main에 고정
2. PR #123 재검수 `APPROVE` 후 병합: 상세 처방 계약과 30개 연구 시드를 main에 고정
3. WO019 Terra xhigh: parser, formatter, 같은 종목 RP 계산, 합계, DRAFT 거부 구현
4. Sol high: 코드·안전 경계 검수
5. 사람 검토: 작은 활성화 후보군의 종목·경험·청소년 전이 범위 결정
6. Fable: 선수에게 보일 쉬운 설명·숫자 상세·물음표 도움말 검토
7. Terra: 승인된 템플릿만 Plan Beta에 연결
8. 실제 사용자 소규모 검증 후 공개 범위 확대

## 8. 지금 결정하지 않는 것

- 30개를 한꺼번에 활성화하지 않는다.
- 교차 종목 VDOT 환산을 인터넷 공식 하나로 바로 구현하지 않는다.
- 30m 스프린트에 장거리 레이스 페이스를 적용하지 않는다.
- 목표 기록을 현재 능력으로 보지 않는다.
- 원문 메모로 훈련량을 자동 변경하지 않는다.
- 9.5일이 과학적으로 최적·안전하다고 주장하지 않는다.
- 사람 검토 없이 미성년자 숫자 처방을 공개하지 않는다.

## 9. 다음 사람 결정 게이트

WO019 실행 자체에는 새 제품 결정이 필요하지 않다. parser와 calculator는 비활성 도메인
코드로 만들 수 있다.

그다음 실제 활성화 전에 대표님과 지정 리뷰어가 결정할 내용은 다음이다.

1. 첫 공개 상세 템플릿을 어떤 종목·경험대부터 시작할지
2. 목표 기록 페이스를 어떤 상황에서 후보로 보여줄지
3. 청소년에게 사용할 수 있는 템플릿과 반드시 코치 확인이 필요한 템플릿
4. 코치 범위 비교의 단위·등록 권한·그림자 기간
5. 상세 계획 기능을 무료 맛보기와 유료 기능으로 어떻게 나눌지

[DRAFT_COMPLETE]
