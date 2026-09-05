# TRAINING_PLAN_SCOPE_RECONCILIATION_2026-09-05.md

```yaml
doc_id: training-plan-scope-reconciliation-2026-09-05
status: IMPLEMENTED_LOCAL_VERIFICATION
base_sha: f39bf23
branch: codex/analysis-integrity-coros-readiness
canonical_promotion: false
prescription_authority_added: false
published: false
```

## 1. 이번에 완료한 범위

이전 [정합성 검토](TRAINING_PLAN_SPEC_CONSISTENCY_REVIEW_2026-09-04.md)의 권장 순서 중
첫 단계인 문서 정리와 실제 지원 범위 표시를 구현했다. 다음 처방 확대까지 완료했다는 보고가 아니다.

| 구분 | 변경 |
|---|---|
| 추가 | [현재 계획 범위](../../TRAINING_PLAN_CURRENT_SCOPE.md): A/B 계획 수, 상세 템플릿 수, 같은 조건 MAIN 방법 수를 분리 |
| 수정 | AGENTS의 과거 페이스 지시서 우선 참조를 현재 제한 채택 근거로 교정 |
| 수정 | PLAN_GENERATOR §12의 과거 자체점검과 현재 런타임 수용 기준을 구분. 원본 PASS 행은 보존 |
| 추가 | PLAN_GENERATOR §27에 지원 범위 표시 계약, 스펙 색인에 현재 범위 문서 연결 |
| 추가 | 훈련 상세 방식 선택 화면에 접힌 `종목별 상세 훈련 지원` 안내 |
| 유지 | 용량·페이스·회복·안전·기록 확인·저장 형식·기존 계획·청소년/자율 선택 경계 |
| 보류 | 미채택 두 번째 MAIN, 적응 입력 확대, D1~D8 전체 연결 및 단계별 장기 용량 |

## 2. 구현 구조와 화면 의미

`plan-support-coverage.ts`는 현재 선택기가 사용하는 `resolveDetailedPlanTemplateOptions`를
종목·목적별로 조회하는 읽기 전용 투영이다. 별도 활성 목록이나 새 처방 규칙을 만들지 않았다.
선택한 경험과 평가 시각을 그대로 전달하고, 경험이 없으면 임의 기본값을 쓰지 않는다.

`PlanSupportCoverage.tsx`는 기본 접힘 상태이며 의미 있는 표·키보드 조작·44px 진입점을 제공한다.
현재 종목과 다른 목적의 방법을 적용 가능하다고 오해하지 않도록 목적을 함께 표시한다.
지원 표를 열어도 훈련 방법이 자동 선택되거나 개인 페이스 확인이 생략되지 않는다.

현재 관측값은 7종목 계획 범위, 기록 기반 상세 정체성 4개, 해당 조건의 MAIN당 방법 1개다.
상세 방법이 없는 조합의 시간·RPE 경로는 유지했다. 이를 사용자의 능력 부족으로 설명하지 않는다.
A/B는 주요 훈련을 유지한 다른 날의 시간 범위 선택이며, 서로 다른 주요 훈련법 두 개가 아니다.

## 3. 실행 검증

| 실행 | 결과 |
|---|---|
| `npm run test:unit -- --reporter=dot` | 260 files / 2242 tests PASS |
| `npm run test:unit:kst` | 같은 260 files / 2242 tests PASS, 별도 기능 수로 합산하지 않음 |
| 신규 지원 범위 계약 테스트 | 6/6 PASS, 전체 단위 테스트에 포함 |
| `npm run build` | tsc + Vite PASS |
| `npm run typecheck:e2e` | PASS |
| `plan-method-switch.spec.ts` | desktop, 375px, 320px, reduced-motion 4경로 PASS |

브라우저 시험은 지원 안내 열기/닫기, 지원 표의 현재 값, 키보드 Enter/Space,
본문 글자 토큰 2배 확대, 가로 넘침, 방법 변경, 기록 재확인, 저장 및 새로고침을 통과한다.
오전/오후 선호와 하루 두 번 설정, 사용자가 고른 시작 날짜도 보존한다.
비정수 원본 기록 1111.25초에 대한 목표 반복 시간 222.25초가 저장 후에도 유지된다.
이 시험의 200% 검사는 글자 토큰 확대이며 실제 iOS Dynamic Type 전 기종 검증은 아니다.

미리보기 대상은 로컬 빌드 `http://127.0.0.1:4194/?app=1`이다.
공개 사이트나 GitHub CI에서 실행한 결과로 표현하지 않는다.
합성 기록만 사용했으며 워치 계정, 개인 메모, 실사용 건강 데이터는 조회하지 않았다.

## 4. 결함 주입과 복원

지원 투영에서 경험을 강제로 `EXPERIENCED`로 바꾸면 다음 두 시험이 이름으로 실패했다.

- `does not broaden NEW_TO_RUNNING into the experienced scope`
- `does not broaden DEVELOPING into the experienced scope`

변조 상태 4 PASS / 2 FAIL, exit 1. 복원 후 전체 단위 시험 PASS.
대상 `plan-support-coverage.ts`의 변조 전후 SHA-256은 동일했다.

```text
D9F0D9BEA47E6CCD5CAFDFC5939CE5546068265E1A36491855F12558B5D4FCBA
```

이는 경험 범위를 무단 확대하는 결함을 잡는 증거이며, 모든 처방·생리학적 타당성을 증명하지 않는다.

## 5. 공격적 재검토와 한계

| 확인한 위험 | 처리 / 남은 한계 |
|---|---|
| 설명 표가 실제 허용 목록과 따로 바뀜 | 선택기와 동일한 조회 경로 사용. 미래 목록 변경 시 계약 기대값도 독립 검토 필요 |
| A/B 두 개를 MAIN 두 방법으로 오인 | 문서와 화면 양쪽에서 명시적으로 분리 |
| 초보 경험을 숙련으로 바꿔 지원 표시 | 결함 주입 시험으로 차단 |
| 만료/잘못된 평가 시각에 지원 표시 | 기존 권한 조회의 유효성 검사를 재사용하고 빈 결과 시험 |
| 표만 보고 나의 종목·목적·상태 확인 생략 | 읽기 전용 안내, 기존 선택 및 저장 검증 유지 |
| 상세 지원이 적다는 본래 문제 | 이번 수정으로 해결되지 않음. 미완 범위를 숨기지 않는 개선 |
| 긴 설명이 선택을 밀어냄 | 선택지 뒤의 기본 접힘 영역. 200%에서는 세로 스크롤 허용 |
| 시험 통과를 배포·과학 검수로 과장 | 로컬 구현 검증으로 한정. 공개 반영 및 새 용량 승인 없음 |

## 6. 다음 작업자가 이어갈 순서

1. 두 번째 MAIN의 [원자료 검토 패킷](SECOND_MAIN_METHOD_SOURCE_REVIEW_PACKET_2026-09-02.md)을 연다.
   5000m `12×400m + 각 반복 뒤 100m roll-on`은 검토 후보이지 현재 승인 템플릿이 아니다.
   대상·목적·정확한 강도·회복 방식·기존 방법과의 부담 차이를 확정한 뒤 매니페스트와 설명을 연결한다.
2. 기존 MAIN을 대체하는 두 방법으로 검증한다. MAIN을 추가하거나 횟수만 바꿔 다양성으로 세지 않는다.
3. 실제 수행 연결은 계획값·직접 기록·장치 관측을 구분한 뒤 확대한다. 완료 체크로 자동 증량하지 않는다.
4. 현재 범위 문서 §5의 규칙별 입력/미정 정책 표를 따라 분류기·규칙 연결을 준비한다.
   D9 통과를 전체 규칙 통과로 읽지 않고, 미정 임계값을 코드 작성자가 채우지 않는다.

이 문서는 신규 용량 수용, 미해결 이슈 종결, 정본 승격, 외부 서비스 연결을 승인하는 자료가 아니다.

[DRAFT_COMPLETE]
