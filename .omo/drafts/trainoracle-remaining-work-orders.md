# Draft: TRAINORACLE Remaining Work Orders

## Requirements (confirmed)
- 사용자는 추론 수준을 높인 상태에서 모든 잔여 작업을 정식 작업지시서로 작성하라고 지시했다.
- 기존 OPEN/DEFERRED/BLOCKED 항목을 누락하거나 중복하지 않는다.
- 높은 정확도의 연구, 전문 검토, 소유자 결정이 필요한 항목은 구현을 선행하지 않고 명시적 게이트로 남긴다.
- 각 지시서는 실행 순서, 범위, 금지사항, 검증 증거, 완료 기준을 포함한다.

## Technical Decisions
- 전체 작업을 하나의 구현 지시서로 합치지 않고 의존성 기반 Wave로 분리한다.
- 안전/프라이버시/청소년/Formation 권한은 해당 게이트 승인 전 런타임 구현 금지로 유지한다.
- 기존 Task-R, Formation deferred register, ORDER_008/009 및 SPEC open-issue를 하나의 중복 제거 원장으로 대조한다.
- 계획 산출물은 `.omo/plans/`에 작성하고 실행 가능한 정식 작업지시서 묶음을 그 안에 포함한다.
- 1차 소유 지시서는 7개로 분리한다: 연구 기반(010), 안전·프라이버시 거버넌스(011), 코치 규칙·노출 분류(012), 달력·버전·동기화(013), 사람 검토·shadow protocol(014), 제품 투영·접근성(015), 게이트 후 런타임 통합(016).
- 같은 항목은 한 지시서의 `primary_items`에만 들어가고 다른 지시서는 `depends_on`으로만 참조한다.

## Research Findings
- GitHub open PR/issues는 PR #75 병합 뒤 0건이다.
- Task-R는 DONE 28 / OPEN 1 / DEFERRED 5이며, OPEN은 R-safety-001이다.
- Formation deferred register는 연구/소유자결정/전문검토가 필요한 8개 목표를 보유한다.
- ORDER_008 Task C 프리셋 연구는 1차 자료 기반 고정밀 연구 전까지 DEFERRED다.

## Open Questions
- 없음. 사용자는 모든 잔여 작업의 정식 지시서화를 명시했고, 승인 전 구현 금지 경계도 기존 문서에서 발견 가능하다.

## Scope Boundaries
- INCLUDE: 잔여 항목 전량 재계수, 중복 제거, 작업지시서 분할, 의존순서, 결정/연구/전문검토 게이트, TDD 및 실제 QA 증거 계약.
- EXCLUDE: 앱/백엔드/SSO/Formation 런타임 구현, 과학적 사실 확정, 법률·의학적 승인 대행, 소유자 결정을 임의로 대신하는 행위.

## Applicable Skills
- `omo:ulw-plan`: 다중 모듈·다중 게이트 작업을 decision-complete 계획으로 구조화한다.
- `ultra-research`: 스포츠과학·통계·경기분석 지시서의 1차 자료 조사 프로토콜을 설계한다.
- `omo:review-work`: 작업지시서 묶음의 안전·보안·품질·맥락 누락을 다각도로 검증한다.
- `emil-design-eng`: 선수 설명 수준, shadow-mode 가시성, 접근성/동기부여 UI 작업의 디자인 검토 기준으로 사용한다.
- `omo:programming`: 후속 TypeScript 구현 지시서에 TDD·엄격 타입·검증 경계를 명시하는 데 사용한다.

## Evidence Contract
- 계획 산출물 구조 검증은 실패하는 재계수/참조 검사(RED)를 먼저 만들고, 완성 후 동일 검사를 GREEN으로 만든다.
- 사용자 노출 런타임은 이번 계획 단계에서 변경하지 않는다. 수동 QA는 계획 문서의 항목-원장 추적성과 금지 게이트를 실제 CLI/data surface로 검증한다.
