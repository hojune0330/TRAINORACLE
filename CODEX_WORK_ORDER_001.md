# CODEX_WORK_ORDER_001.md

```yaml
doc_id: TRAINORACLE_CODEX_WORK_ORDER_001
title: "Codex 작업지시서 001 — Wave D 바인딩 + 구현 스켈레톤 + CI + 시각화 산출물"
issued_by: PROJECT_LEAD_AI (총책임/작업지시 권한, 사용자 위임)
issued_date: "2026-07-09"
assignee: CODEX
status: ISSUED
prerequisites_confirmed:
  - SPEC_SOURCE_ACCEPTANCE_DECISION_ROUND1.md (Safety Gate + RVE 수용)
  - SPEC_SOURCE_ACCEPTANCE_DECISION_ROUND2.md (Physio + Daily Log 수용)
  - runtime-evidence/d9-evaluator/ (11/11 PASS)
```

---

## 0. 절대 준수 규칙 (위반 시 작업 무효)

1. **로컬 파일이 진실이다.** 기억으로 카운트/내용을 주장하지 마라.
2. **런타임 증거 없이 이슈를 닫지 마라.** 마크다운 자체점검은 런타임 증거가 아니다.
3. **`RULE_SPEC_D1_D9.D-9`를 재정의하지 마라.** 매핑만 허용:
   ACTIVE→BLOCK, UNKNOWN→BLOCK_OR_HUMAN_REVIEW, advisory는 CLEARED 하위.
4. **평가기 실패(타임아웃/예외/stale)는 전부 UNKNOWN fail-safe.**
5. **선수 원문 자유 텍스트/메모/증상 문구를 서버·감사 기록에 저장하지 마라.**
   구조화 필드 + nonSensitiveReasonCodes만 허용.
6. **삭제 금지.** 기존 SPEC 계층 파일을 삭제하거나 이동하지 마라.
7. **커밋마다 PR.** main 직접 푸시 금지. PR 설명에 대상 이슈 재계수 결과 포함.
8. **`.omo/evidence/` 하위 파일은 불변 증거물이다. 수정 금지.**

---

## Task 1 — Wave D: 다운스트림 바인딩 패치

수용된 4개 소스(Round 1+2)를 근거로 다운스트림 대상 문서에 바인딩 패치를 넣어라.

| 순서 | 대상 문서 | 소스 | 대상 이슈 (패치 시점에 반드시 재계수) |
|---|---|---|---|
| 1 | `specs/active/PLAN_GENERATOR_SPEC.md` | PHYSIO_SOURCE_TRUST_SPEC | `OI-PG-PHYSIO-SOURCE-CONSUMPTION-001` |
| 2 | `specs/active/APP_IMPLEMENTATION_BRIDGE.md` | DAILY_LOG_AND_CHECKIN_SPEC | `OI-DLC-APP-BRIDGE-BINDING-001` 대응 (Bridge 측 이슈 존재 여부 먼저 확인) |
| 3 | `specs/active/RVE_RULE_EVALUATOR_BINDING_SPEC.md` | RULE_VALIDATION_ENGINE_CONTRACT + DAILY_LOG | `OI-DLC-RVE-SAFETY-BINDING-001` 대응 |

각 패치의 형식은 Wave B(54bae11 `PLAN_GENERATOR_SPEC.md` Safety Gate 바인딩 패치)와 동일하게:
- 패치 블록에 source doc/decision doc 참조 명시
- 이슈 상태는 `patched-but-not-closed`로만 변경 (닫지 마라 — 런타임 증거 없음)
- 패치 후 해당 문서의 open issue 표를 재계수하고 선언 수와 대조한 결과를 PR에 기록

## Task 2 — 구현 스켈레톤: Safety Gate → Plan Generator 수직 슬라이스

`impl/` 디렉토리에 TypeScript로 최소 수직 슬라이스를 구현하라.

```
impl/
  src/
    d9/            # runtime-evidence의 검증된 평가기 코드를 모듈화 (verbatim 유지, SHA 기록)
    rve/           # disposition 매핑: RULE_VALIDATION_ENGINE_CONTRACT L193-200 표와 1:1
    safety-gate/   # ACTIVE→BLOCK / UNKNOWN→BLOCK_OR_HUMAN_REVIEW / CLEARED→PASS
    plan-generator/# 스텁: gate가 PASS일 때만 호출 가능함을 타입으로 강제
  test/            # 계약 기반 테스트 (표의 각 행 = 최소 1 테스트)
  package.json
```

요구사항:
- 평가기 실패 시나리오(timeout/exception/stale) 3종 모두 UNKNOWN 반환 테스트 필수
- 원문 텍스트가 gate 출력/감사 객체에 절대 포함되지 않음을 타입+테스트로 증명
  (출력 타입에 free-text 필드 자체가 없어야 함)
- `npx vitest run` 전체 PASS 로그를 `runtime-evidence/impl-skeleton/`에 저장 (로그는 `git add -f`)

## Task 3 — CI 통합

- GitHub Actions 워크플로 `.github/workflows/ci.yml` 작성:
  - `runtime-evidence/d9-evaluator/` vitest 실행
  - `impl/` vitest 실행
  - PR마다 자동 실행, 실패 시 머지 차단
- 첫 CI 실행 링크를 PR에 첨부

## Task 4 — 시각화 산출물 (사용자 열람용, 필수)

**사용자(코치)가 눈으로 직접 확인할 수 있는 정적 HTML 대시보드를 만들어라.**

경로: `dashboard/index.html` (외부 의존성 없이 단일 파일 또는 상대 참조만, GitHub Pages로 바로 열람 가능해야 함)

포함할 내용:
1. **안전 체인 다이어그램** — 데이터 → 분류기 → 프로필/동의 → D9 → RVE → Safety Gate → Plan Generator 흐름을 SVG로. ACTIVE/UNKNOWN/CLEARED 경로를 색으로 구분
2. **SPEC 수용 현황 보드** — 각 SPEC 문서의 상태(status), 수용 라운드, open issue 수를 카드로 표시 (수치는 실제 파일에서 grep한 값, 기억 금지)
3. **런타임 증거 현황** — 실행된 테스트 패키지, PASS/FAIL 수, 실행 일자, 로그 링크
4. **open issue 총괄표** — 모든 OI-* 이슈를 문서별로 나열, canonical_blocking 여부 표시
5. 디자인은 `design-v3/tokens/tokens.css` 토큰 사용 (radius ≤4px, 그라디언트 금지, UI 이모지 금지, tabular-nums)

GitHub Pages 설정이 가능하면 활성화하고 URL을 PR에 기재하라.
불가하면 로컬 열람 방법을 README에 명시하라.

## 완료 보고 형식

각 Task 완료 시 PR 설명에 다음을 포함하라:
- 변경 파일 목록 + 삭제 0 확인
- 재계수 결과 (선언 수 vs 표 행 수)
- 런타임 로그 경로 (Task 2, 3)
- 대시보드 열람 URL 또는 경로 (Task 4)
- 명시적 비주장 목록 (닫지 않은 이슈, 승격하지 않은 문서)

작업 순서는 Task 1 → 2 → 3 → 4를 권장하되, Task 4는 1~3의 실제 데이터가
파일로 존재해야 하므로 반드시 마지막에 수행하라.

[ISSUED]
