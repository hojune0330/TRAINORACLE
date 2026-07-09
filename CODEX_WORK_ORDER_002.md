# CODEX_WORK_ORDER_002.md

```yaml
doc_id: TRAINORACLE_CODEX_WORK_ORDER_002
title: "Codex 작업지시서 002 — 스펙 검증 · 화면-스펙 플로우 정합성 · 문서 개선"
issued_by: PROJECT_LEAD_AI (총책임/작업지시 권한, 사용자 위임)
issued_date: "2026-07-09"
assignee: CODEX
status: ISSUED
supersedes: null
relation_to_001: CODEX_WORK_ORDER_001 전 Task 완료 확인됨 (impl 7/7 PASS 검증 완료)
role_split:
  design_and_screen_implementation: PROJECT_LEAD_AI   # 디자인·화면·UX는 총책임 AI 전담
  spec_verification_flow_audit_doc_improvement: CODEX  # 이 지시서의 범위
```

---

## 0. 절대 준수 규칙 (001과 동일 + 추가)

1. **로컬 파일이 진실이다.** 기억으로 카운트/내용을 주장하지 마라.
2. **런타임 증거 없이 이슈를 닫지 마라.** 마크다운 자체점검 ≠ 런타임 증거.
3. **`RULE_SPEC_D1_D9.D-9` 재정의 금지.** 매핑만: ACTIVE→BLOCK, UNKNOWN→BLOCK_OR_HUMAN_REVIEW, advisory는 CLEARED 하위.
4. **평가기 실패(타임아웃/예외/stale) → 전부 UNKNOWN fail-safe.**
5. **원문 자유 텍스트/메모/증상 문구의 서버·감사 저장 금지.**
6. **삭제 금지.** 기존 파일 삭제/이동 금지. `.omo/evidence/` 불변.
7. **커밋마다 PR.** main 직접 푸시 금지.
8. **[신규] 디자인 파일 수정 금지.** `ui_kits/` `preview/` `design-v3/` `designs/` `colors_and_type*.css` `index.html`(루트)은 총책임 AI 전담이다. 이 파일들에서 문제를 발견하면 **수정하지 말고 Findings 문서에 기록**하라.
9. **[신규] 수용 결정 월권 금지.** Round 3 심사 패킷은 준비하되, `ACCEPTED_AS_WORKING_SOURCE` 결정 자체는 총책임 AI의 권한이다. 패킷 상태는 `PENDING_REVIEW`로 두라.

---

## Task 1 — Round 3 수용 심사 패킷 준비

잔여 미수용 소스 4종에 대해 Round 1/2와 동일한 8-질문 프레임으로 심사 패킷을 작성하라.

| 대상 | 현재 상태 |
|---|---|
| `specs/reconstruct/ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT.md` | DRAFT_FOR_REVIEW |
| `specs/reconstruct/DAILY_BRIEF_AND_INBOX_SIGNAL_SPEC.md` | DRAFT_FOR_REVIEW |
| `specs/reconstruct/MICROCYCLE_AND_CALENDAR_MAPPING_SPEC.md` | DRAFT_FOR_REVIEW |
| `specs/reconstruct/PLAN_OUTPUT_RATIONALE_PRIVACY_SPEC.md` | DRAFT_FOR_REVIEW |

산출물: `SPEC_SOURCE_ACCEPTANCE_REVIEW_ROUND3.md`
- 문서별 8-질문 사전 검증 결과 + **라인 번호 근거** 필수
- 발견된 위반/모호점은 은폐 없이 기록 (PASS 조작 금지)
- 선언 이슈 수 vs 표 행 수 재계수 결과 포함
- 결정 상태: `PENDING_REVIEW` (결정은 총책임 AI가 Round 3 결정문서로 수행)

## Task 2 — 화면↔스펙 플로우 추적성 매트릭스 (이번 지시의 핵심)

서비스 개발 착수 전, **이식된 실제 서비스 화면이 스펙과 어디서 일치하고 어디서 어긋나는지** 전수 감사하라.

산출물: `SPEC_SCREEN_TRACEABILITY_MATRIX.md`

### 2.1 감사 대상 화면 (읽기 전용 — 수정 금지)
- `ui_kits/trainoracle-app-v3/` — Home, LogEntry(choose/post-session/evening/race), LogDetail, Trends
- `ui_kits/trainoracle-app/` — Dashboard, Calendar, SessionDetail, AIChat, Inbox
- `design-v3/screens/` — 정적 4화면

### 2.2 매트릭스 형식 (화면 요소 단위)
| 화면 | UI 요소/동작 | 관련 SPEC 조항 (문서+섹션/라인) | 정합성 | 비고 |
정합성 값: `ALIGNED` / `GAP_UI_MISSING`(스펙은 요구하나 UI 없음) / `GAP_SPEC_MISSING`(UI는 있으나 스펙 계약 없음) / `CONFLICT`(상호 모순) / `OUT_OF_SCOPE`

### 2.3 반드시 감사할 핵심 플로우 5개
1. **일지 작성 → 저장 플로우**: LogEntry의 각 입력 필드가 DAILY_LOG_AND_CHECKIN_SPEC의 DailyCheckInRecord 구조화 필드와 1:1 대응하는가? 스펙에 없는 필드(음성 메모, 사진 첨부 등)는 GAP_SPEC_MISSING으로 기록.
2. **안전 신호 표시 플로우**: 통증 입력(pain 4~5)·증상성 텍스트가 RVE/Safety Gate로 어떻게 흘러야 하는지 스펙 경로를 적고, 현재 UI에 그 상태 표시(Review 대기/차단 안내)가 존재하는지 대조.
3. **AI 출력 표시 플로우**: Home/Trends의 AI 1줄이 PLAN_OUTPUT_RATIONALE_PRIVACY_SPEC + ANALYSIS 계약의 신뢰도/출처/비민감 사유코드 요구를 충족하는 형태인지.
4. **9.5일 사이클 표시 플로우**: v2 Calendar의 사이클 레일이 MICROCYCLE_AND_CALENDAR_MAPPING_SPEC의 CYCLE_DAY 네임스페이스와 충돌 없는지.
5. **프라이버시 플로우**: 모든 자유 입력 지점에 §8 memo_policy 고지가 있는지 전수 확인 (v3 LogEntry는 방금 보강됨 — v2 앱과 design-v3 정적 화면도 대조).

### 2.4 요약 통계
- 화면 요소 총수 / ALIGNED / GAP_UI_MISSING / GAP_SPEC_MISSING / CONFLICT 카운트
- **CONFLICT 항목은 최상단에 별도 표**로 승격 (서비스 개발 차단 요인이므로)

## Task 3 — 문서 계층 정비 (디테일 개선)

1. **`TRAINORACLE_SPEC_INDEX.md` 갱신**: 이식된 디자인 자산(ui_kits/preview/루트 index.html), impl/, dashboard/, 작업지시서 2종, 결정문서 2종을 인덱스에 반영. 상태 컬럼(수용/미수용/증거 유무) 추가.
2. **`SPEC_WORK_STATUS.md` 갱신**: Wave A~E 완료 상태, Round 1/2 결정, impl 7/7 PASS를 반영. 절대 카운트는 전부 파일에서 재계수.
3. **상호참조 무결성 검사**: `specs/` + 루트 SPEC_*.md 전체에서 마크다운 링크·문서명 참조를 스캔, 깨진 참조 목록화. (`.omo/evidence/` 내부는 제외 — 불변 증거물)
4. **용어 일관성 검사**: `disposition` / `verdict` / `status` / `state` 혼용, `D9` vs `D-9` 표기, 한/영 혼용 용어를 스캔해 표준화 제안표 작성 (직접 일괄 치환은 하지 말 것 — 제안까지만).
5. 산출물: `SPEC_DOC_QUALITY_REPORT.md` (3·4번 결과) + INDEX/STATUS 갱신 커밋

## Task 4 — 대시보드 데이터 동기화

`dashboard/index.html`의 수치(수용 문서 수, 이슈 수, 런타임 증거)를 현 시점 파일 기준으로 재계수해 갱신하라. Task 2의 정합성 통계(ALIGNED/GAP/CONFLICT)를 신규 섹션으로 추가하라. 단, 시각 스타일 변경은 금지(데이터만 갱신) — 스타일은 총책임 AI 소관.

## 완료 보고 형식

- Task별 개별 PR (또는 1·3·4 묶음 + 2 단독)
- 각 PR에: 변경 파일 목록, 삭제 0 확인, 재계수 결과, **디자인 파일 무수정 확인 문구**
- Task 2의 CONFLICT 항목은 PR 본문 최상단에 요약
- GitHub Issue #5 스레드가 아닌 **새 이슈**에 진행 코멘트 (001과 구분)

작업 순서: Task 2 → 1 → 3 → 4 (Task 2 결과가 서비스 개발 계획의 입력이므로 최우선)

[ISSUED]
