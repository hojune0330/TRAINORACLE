---
doc: SOURCE_MAP
version: 3.1
build_timestamp: 2026-05-06
phase: Phase 1-F (정본 기반 docs/ 재작성 완료)
last_editor: 진도군청 육상팀 운영 매니저
---

# SOURCE_MAP v3.1

> **Phase 1-F 핵심 변화**: docs/01~12를 정본 기반으로 처음부터 재작성.  
> docs는 **반드시 1개 이상의 정본 파일**을 출처로 한다 (추측·합성·환각 금지).

---

## 0. 자산 계층 구조

### 0.0 L0. Current SPEC Baselines

```yaml
L0_current_spec_baselines:
  description: "새 SPEC 작성 시 최상위 기준"
  files:
    - RULE_SPEC_D1_D9.md v1.4
    - SESSION_CLASSIFIER_SPEC.md v1.2
    - ATHLETE_PROFILE_SPEC.md v1.0
  conflict_resolution: "new SPEC authoring에서는 L0가 legacy docs보다 우선"
```

### 0.1 4계층 (L1 / L1.5 / L2 / L3)

| 계층 | 위치 | 우선순위 | 편집 권한 |
|---|---|---|---|
| **L1. agent context** | Genspark agent 등록 (file wrapper URL) — 81개 | **상위 정본** | 코치만 |
| **L1.5. knowledge_base/** | `/TRAINORACLE_Project/knowledge_base/` (76 / 81 동기화) | L1 미러 | 운영 매니저 (읽기만) |
| **L2. AI Drive native** | `/2024_훈련계획_분석_결과/`, `/육상대회결과/` 등 | 원시·작업 산출물 | 코치 + 운영 매니저 |
| **L3. docs/ 운영 정본** | `/TRAINORACLE_Project/docs/` (16개 v2.0~) | **L1·L2를 운영용 정리** | 운영 매니저 (코치 검토) |

**새 SPEC 작성 시 충돌 우선순위**: L0 current SPEC baselines > L1 > L3 > L2 > L1.5.  
**legacy docs 운영 정리 시 충돌 우선순위**: L1 > L3 > L2 > L1.5.
---

## 1. 매핑표 — 정본 → docs (Phase 1-F)

### 1.1 운영·철학 계층 (01·02)

| docs (v2.0) | 1차 정본 | 2차 정본 | 분량 | 상태 |
|---|---|---|---|---|
| **01_PRODUCT_PHILOSOPHY.md** | `01_philosophy/진도군청_육상팀_에이전트_절대_금지_사항.md` | `07_operations/karpathy_claude_guidelines.md` | 7.7 KB | ✅ 정본 기반 재작성 |
| **02_AI_STRATEGY.md** | `03_workflow_engine/C_workflow_engine_v1.3.md` | `workflow_main_v1.3.1_rev1.md`, `WHITEPAPER_v1.1` | 9.6 KB | ✅ 정본 기반 재작성 |

### 1.2 훈련 시스템 계층 (03 분할: 03a/03b/03c)

| docs (v1.0) | 1차 정본 | 2차 정본 | 분량 | 상태 |
|---|---|---|---|---|
| **03a_TRAINING_PHILOSOPHY.md** | `01_philosophy/B_bg_philosophy.md` §0 | `A_guide_v5.1_20260201.md` §0 | 5.4 KB | ✅ 신규 (분할) |
| **03b_CYCLE_AND_ENERGY.md** | `02_training_system/A_guide_v5.1_20260201.md` §0,7,8,10,12,13,14 | `B_background_v5.1_20260205.md`, `B_bg_data.md` §9, `C_workflow_engine §0.3` | 7.4 KB | ✅ 신규 (분할) |
| **03c_PHYSIOLOGY_AND_ZONES.md** | `01_philosophy/B_bg_philosophy.md` §1 | `A_guide_v5.1_20260201.md` §2,§3,§9,§19 | 6.6 KB | ✅ 신규 (분할) |

### 1.3 데이터 임포트 계층 (04 분할: 04a/04b)

| docs (v1.0) | 1차 정본 | 2차 정본 | 분량 | 상태 |
|---|---|---|---|---|
| **04a_GARMIN_AND_SHEET.md** | `04_data_import/가민데이터_선수데이터화_지침서_v5.1.2.md` | `E_gsheet_template_spec_v1.1.md` | 6.6 KB | ✅ 신규 (분할) |
| **04b_CALENDAR_PARSING.md** | `04_data_import/D_calendar_parsing_part_00.md` | `D_calendar_parsing_part_01.md`, `D_cal_parse_00/02/dict.md` | 5.5 KB | ✅ 신규 (분할) |

### 1.4 룰 엔진 계층 (05 분할: 05a/05b)

| docs (v1.0) | 1차 정본 | 2차 정본 | 분량 | 상태 |
|---|---|---|---|---|
| **05a_SESSION_CLASSIFIER.md** | `03_workflow_engine/phase_classify_v1.3.1.md` | `phase_classify_part_00.md`, `phase_classify_part_01.md`, `C_workflow_engine §0.3` | 7.5 KB | ✅ 신규 (분할) |
| **05b_RULE_VALIDATOR.md** | `03_workflow_engine/phase_validate_v1.3.1.md` | `phase_validate_part_00.md`, `phase_validate_part_01.md` | 7.9 KB | ✅ 신규 (분할) |

### 1.5 검증·피드백·시각화 (06·07·08)

| docs (v2.0) | 1차 정본 | 2차 정본 | 분량 | 상태 |
|---|---|---|---|---|
| **06_VALIDATION_AND_SAFEGUARDS.md** | `01_philosophy/진도군청_육상팀_에이전트_절대_금지_사항.md` | `phase_validate_v1.3.1.md` §5,§6, `phase_execute §3` | 8.5 KB | ✅ 정본 기반 재작성 |
| **07_FEEDBACK_SYSTEM.md** | `03_workflow_engine/phase_execute_v1.3.1.md` | `A_guide_v5.1_20260201.md` §11, §21 | 7.5 KB | ✅ 정본 기반 재작성 |
| **08_VISUALIZATION_SYSTEM.md** | `02_training_system/B_bg_reference.md` §10 | `TrainingDoc_Guideline_v1.1_20260203.md` | 3.7 KB | ✅ 정본 기반 재작성 |

### 1.6 디자인·데이터·API·화면 (09·10·11·12)

| docs (v2.0) | 1차 정본 | 2차 정본 | 분량 | 상태 |
|---|---|---|---|---|
| **09_DESIGN_SYSTEM.md** | `06_whitepaper/TRAINING_PLAN_SYSTEM_WHITEPAPER_v1.1_final_r1.md` | `TrainingDoc_Guideline_v1.1`, `C_workflow_engine` | 4.4 KB | ✅ 정본 기반 재작성 (디자인 톤 제거) |
| **10_DATA_MODEL.md** | `02_training_system/A_guide_v5.1_20260201.md` §1, §15, §16 | `가민데이터_지침서_v5.1.2.md` §4 | 5.7 KB | ✅ 정본 기반 재작성 |
| **11_API_AND_ENGINE_CONTRACTS.md** | `03_workflow_engine/C_workflow_engine_v1.3.md` §0.2 | `phase_classify §11`, `phase_validate §7`, `phase_execute §5,§6` | 6.6 KB | ✅ 정본 기반 재작성 |
| **12_SCREEN_GUIDE.md** | `05_training_doc_guidelines/TrainingDoc_Guideline_v1.1_20260203.md` | `E_gsheet_template_spec_v1.1.md` | 5.1 KB | ✅ 정본 기반 재작성 (가공 Hi-Fi 제거) |

---

## 2. 변경 요약

### 2.1 docs 변경 통계

| 항목 | v1.0 (Phase 1-B) | v2.0 (Phase 1-F) |
|---|---|---|
| 문서 수 | 12 | **16** (분할 +4: 03a/b/c, 04a/b, 05a/b) |
| 정본 인용 | 0건 (가공) | **모든 docs frontmatter에 명시** |
| 평균 분량 | 8.0 KB | 6.4 KB (분할로 감소) |
| 작성 기준 | 정본 미확인 합성 | **정본 raw 콘텐츠 100% 기반** |

### 2.2 5가지 드리프트 제거

| 드리프트 타입 | v1.0 사례 | v2.0 처리 |
|---|---|---|
| **T1 Underspecified** | docs/03 "9.5 Cycle"만 표기 | 03a §0.1: 평균 9.5일, σ 1.2, CV 0.13, n=368 명시 |
| **T2 Namespaced** | docs/05 "9 Rules R-1~R-9"와 Phase D D-1~D-9 혼재 | 05b는 `LEGACY_PHASE_D.D-*`로 명명. 현재 SPEC 레이어는 `RULE_SPEC_D1_D9.D-*`로 구분 |
| **T3 Missing** | "Statistical Freedom" 누락 | 03a §0.1, 02 §2.3 [블록 3] 추가 |
| **T4 Hallucinated** | "P-04 Serif/Mono" 디자인 톤 | 01에서 제거, 09 §7로 RFC 분리 |
| **T5 Mismapped** | docs/01 ↔ B_bg_philosophy 오매핑 | 01 ↔ 절대_금지_사항.md / 03a ↔ B_bg_philosophy로 정정 |

---

## 3. 정본 → docs 미사용 (별도 처리)

| 정본 | 처리 |
|---|---|
| `06_whitepaper/final_validation_report.md` | CHANGELOG에 검증 이력으로 인용 |
| `06_whitepaper/FILE_VERSION_CHANGELOG_v2.md` | CHANGELOG에 통합 |
| `07_operations/진도군청_육상팀_2024-2025_종합보고서.md` | 운영 보고서 (별도) |
| `07_operations/2026_진도군청_육상팀_선수단_명단.md` | 선수단 명단 (별도) |
| `08_athletes_reports/*` (7명) | 선수 데이터 (별도) |
| `09_competition_results/*` (30건) | 대회 결과 (별도) |
| `10_admin/*` (6건) | 행정 문서 (별도) |

---

## 4. v3.0 변경 이력

| 버전 | 날짜 | 변경 |
|---|---|---|
| v1.0 | 2026-04-29 | 초안 (Phase 1-B docs/ 12개 — 정본 미참조) |
| v2.0 | 2026-04-29 | legacy/raw → agent_context 분류 정정, 3계층 구조 |
| v2.1 | 2026-05-05 | Phase 1-E.1 ghost rescue (9/14 정본 동기화) |
| v2.2 | 2026-05-06 | Phase 1-E.2 전체 동기화 (76/81 = 93.8 %) |
| **v3.0** | **2026-05-06** | **Phase 1-F docs/ 정본 기반 재작성. 12 → 16개 분할. 매핑 100 % 명시** |

---

## 5. 검증 체크리스트

- [x] 모든 docs frontmatter에 `sources` 명시
- [x] 모든 docs 마지막에 `Source Lineage` 명시
- [x] 분할된 docs는 루트명 유지 (03a/03b/03c, 04a/04b, 05a/05b)
- [x] 한 문서 분량 5~10 KB (분할로 평균 6.4 KB)
- [x] 정본의 임의 해석·확장 없음 (T1~T5 드리프트 0)
- [x] v1.0의 가공 디자인 톤 제거
- [x] L1↔L3 매핑 1:1 또는 1:N 명시

---

**작성**: 진도군청 육상팀 운영 매니저  
**작성일**: 2026-05-06  
**버전**: 3.0
