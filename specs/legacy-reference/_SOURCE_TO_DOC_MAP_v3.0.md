---
doc: SOURCE_TO_DOC_MAP
version: 3.1
build_timestamp: 2026-05-06
last_editor: 진도군청 육상팀 운영 매니저
phase: Phase 1-F (정본 기반 docs/ 재작성)
---


# 정본 → docs/ 매핑표 v3.1

> **원칙**: docs/ 각 문서는 **반드시 1개 이상의 정본 파일**을 출처로 한다.  
> 추측·합성·환각 금지. 정본에 없는 내용은 docs/에 쓰지 않는다.

---

## 1. 매핑 원칙

1. **정본 우선**: knowledge_base/ 정본을 1차 소스로 한다.
2. **루트명 유지**: docs/01~12 이름은 유지하되, 분량이 많으면 `_a`, `_b`, `_c`로 분할한다.
3. **단일 책임**: 한 docs는 한 가지 주제만 다룬다 (분할 기준).
4. **인용 명시**: 각 docs 본문에 "Source: knowledge_base/path/file.md §섹션"을 인용한다.

---

## 2. 매핑표

| docs (재작성) | 1차 정본 (필수) | 2차 정본 (보조) | 비고 |
|---|---|---|---|
| **01_PRODUCT_PHILOSOPHY.md** | `01_philosophy/진도군청_육상팀_에이전트_절대_금지_사항.md` | `07_operations/karpathy_claude_guidelines.md` | 운영 매니저 행동 원칙 |
| **02_AI_STRATEGY.md** | `03_workflow_engine/C_workflow_engine_v1.3.md` | `workflow_main_v1.3.1_rev1.md`, `WHITEPAPER_v1.1` | Phase A~F 워크플로우, 5개 명령어 |
| **03a_TRAINING_PHILOSOPHY.md** | `01_philosophy/B_bg_philosophy.md` §0 | `A_guide_v5.1_20260201.md` §0 | Statistical Freedom, Method over Color, 90-Day Re-balance |
| **03b_CYCLE_AND_ENERGY.md** | `A_guide_v5.1_20260201.md` §0,§7,§8 | `B_background_v5.1_20260205.md` | 9.5일 마이크로사이클, 에너지 시스템 5종, 주간 분 목표 |
| **03c_PHYSIOLOGY_AND_ZONES.md** | `B_bg_philosophy.md` §1 | `A_guide_v5.1_20260201.md` §2 | HR-Zone Z1~Z6, EPOC, CK, TSB, %CV |
| **04a_GARMIN_AND_SHEET.md** | `가민데이터_선수데이터화_지침서_v5.1.2.md` | `E_gsheet_template_spec_v1.1.md` | Garmin → JSONL, 구글시트 템플릿 |
| **04b_CALENDAR_PARSING.md** | `D_calendar_parsing_part_00.md` | `D_cal_parse_*` | HWP/PDF 달력 파싱 |
| **05a_SESSION_CLASSIFIER.md** | `phase_classify_v1.3.1.md` | `phase_classify_part_00/01.md` | Phase C: 분류 |
| **05b_RULE_VALIDATOR.md** | `phase_validate_v1.3.1.md` | `phase_validate_part_00/01.md` | `LEGACY_PHASE_D.D-*` 훈련검증 항목. 현재 SPEC 레이어의 `RULE_SPEC_D1_D9.D-*`와 직접 동일시하지 않음 |
| **06_VALIDATION_AND_SAFEGUARDS.md** | `진도군청_육상팀_에이전트_절대_금지_사항.md` | `phase_validate §5,§6` | 데이터 정확성·세이프가드·종합 판정 |
| **07_FEEDBACK_SYSTEM.md** | `phase_execute_v1.3.1.md` | `A_guide §11, §21` | Phase E·F |
| **08_VISUALIZATION_SYSTEM.md** | `B_bg_reference.md` | `TrainingDoc_Guideline_v1.1` | figure 경로, 시각화 코드 |
| **09_DESIGN_SYSTEM.md** | `WHITEPAPER_v1.1` | `C_workflow_engine` | 시스템 설계 정책 |
| **10_DATA_MODEL.md** | `A_guide_v5.1_20260201.md` §1 | `E_gsheet_template_spec_v1.1.md` | JSONL 16+4 필드 |
| **11_API_AND_ENGINE_CONTRACTS.md** | `C_workflow_engine_v1.3.md` §0.2 | `phase_*` 출력 템플릿 | 명령어, Phase 출력 계약 |
| **12_SCREEN_GUIDE.md** | `TrainingDoc_Guideline_v1.1_20260203.md` | `E_gsheet_template_spec_v1.1.md` | 사용자 화면 가이드 |

---

## 3. 정본 → 미사용/별도 처리

| 정본 | 처리 |
|---|---|
| `06_whitepaper/final_validation_report.md` | docs/CHANGELOG에 검증 이력으로 인용 |
| `06_whitepaper/FILE_VERSION_CHANGELOG_v2.md` | docs/CHANGELOG에 통합 |
| `07_operations/진도군청_육상팀_2024-2025_종합보고서.md` | 운영 보고서 (별도) |
| `07_operations/2026_진도군청_육상팀_선수단_명단.md` | 선수단 명단 (별도) |
| `08_athletes_reports/*` (7명) | 선수 데이터 (별도) |
| `09_competition_results/*` (30건) | 대회 결과 (별도) |
| `10_admin/*` (6건) | 행정 문서 (별도) |

---

## 4. 분할 결과 (요약)

- 12개 → 16개 docs (`03` → 03a/03b/03c, `04` → 04a/04b, `05` → 05a/05b)
- 각 docs는 5~10 KB 목표 (평균 6.4 KB)
- 모든 docs 상단에 출처 frontmatter 포함

| **v3.1** | **2026-05-06** | **L0 current SPEC baselines 추가, D-rule namespace 분리, RULE_SPEC_D1_D9 / LEGACY_PHASE_D / CYCLE_DAY 충돌 방지 정책 반영** |
---

**작성**: 진도군청 육상팀 운영 매니저  
**작성일**: 2026-05-06  
**버전**: 3.1
