---
doc: 02_AI_STRATEGY
version: 2.1
build_timestamp: 2026-05-06
phase: 1-F (정본 기반 재작성)
sources:
  - knowledge_base/03_workflow_engine/C_workflow_engine_v1.3.md (1차 정본)
  - knowledge_base/03_workflow_engine/workflow_main_v1.3.1_rev1.md
  - knowledge_base/03_workflow_engine/workflow_main_part_00_r1.md
  - knowledge_base/03_workflow_engine/workflow_main_part_01.md
  - knowledge_base/06_whitepaper/TRAINING_PLAN_SYSTEM_WHITEPAPER_v1.1_final_r1.md
authoritative_authors: JANG HOJUNE (장호준 코치)
---

# 02. AI 전략 — Coach Jang Workflow Engine

> 본 문서는 AI가 코치의 의도를 어떻게 받아 어떤 순서로 수행하는지 정의한다.  
> 출처: `C_workflow_engine_v1.3.md` v1.3.1 (2026-03-16) 정본.
> 본 문서는 GLOSSARY.md §0.5 Canonical Safety Statements (S-01 ~ S-04)를 따릅니다. 충돌 시 §0.5가 우선합니다.
---

## 0. 핵심 원칙 (정본 §0.1)

| # | 규칙 | 내용 |
|---|---|---|
| 규칙 1 | **질문 우선** | 추측하지 않는다. 모르면 질문한다. |
| 규칙 2 | **순차 수행** | Phase A→B→C→D→E→F 순서 엄수. 건너뛰기 금지. |
| 규칙 3 | **규칙/해석 분리** | 규칙 판정은 임계값 기준 정확히, AI 해석은 근거 인용과 함께. |
| 규칙 4 | **불확실성 표시** | 추정값 `[추정]` 태그, 확신 낮은 판정 `[?]` 태그. |
| 규칙 5 | **코치 고유 개념 보호** | 9.5일 주기화, Statistical Freedom 등은 `B_bg_philosophy.md` 원문 기준. |
| 규칙 6 | **데이터 흐름** | Phase C 출력 → Phase D 입력 → Phase E 입력. 이전 Phase 결과를 그대로 이어받는다. |

---

## 1. 명령어 — 5개 정규 명령 + 2개 모드 수식어 (정본 §0.2)

### 1.1 정규 명령

| 명령어 | 의미 | 자연어 트리거 |
|---|---|---|
| **CMD-ANALYZE** | 분석 | "분석해줘" |
| **CMD-DESIGN** | 설계 | "훈련 짜줘" |
| **CMD-DIAGNOSE** | 진단 | "왜 못 뛰는지" |
| **CMD-DOCUMENT** | 문서화 | "엑셀" |
| **CMD-REGISTER** | 선수 등록 | "선수 등록" |

### 1.2 모드 수식어

| 모드 | 효과 |
|---|---|
| **[빠른]** | Phase C 메인만, Phase D 경고만(OK 생략), Phase E 핵심 3개 이하 |
| **[상세]** | Phase C 보조 전수, Phase D 계산 과정 공개, Phase E 지식파일 인용 |

### 1.3 기타 동작 규칙
- **연속 명령**: 이전 Phase 결과 재활용 가능.
- **다수 선수**: 선수별 A–F 순차 실행.

---

## 2. 핵심 용어 정의 (정본 §0.3)

### 2.1 [블록 1] "주간"과 "마이크로사이클" 구분

- 설계 기조는 항상 **마이크로사이클(9–10일)**. 7일(월~일)은 **문화적 관습에 근거한 출력 형식**.
- 통계 비교(`LEGACY_PHASE_D.D-1`, `LEGACY_PHASE_D.D-3`, `LEGACY_PHASE_D.D-5`, `LEGACY_PHASE_D.D-7`): **7일 슬라이딩 윈도** = 비교 단위.
- 설계/배치(LEGACY_PHASE_D.D-2, E-D3): **마이크로사이클 기준** = 배치 단위.
- 출력: 코치가 "주간 프로그램"을 요청하면 7일 캘린더로 출력하되 **내부 설계는 마이크로사이클**.
- 7일 안에 마이크로사이클이 깔끔히 맞지 않을 수 있고, 그것이 정상이다.

### 2.2 [블록 2] 9.5일 마이크로사이클

- 9.5일 = 1 마이크로사이클 평균 (범위 8–11일).
- "9.5일마다 MAIN 1회"가 **아니다**. 마이크로사이클 안에 MAIN 2–3회.
- MAIN 간격 기준: 정상 3일 / 허용 2–4일 / WARN 1일 또는 5일 초과 / ERROR 0일·7일 초과.
- "화-목-토" 패턴(2일 간격) 자체는 과훈련이 **아니다**. 회복 지표와 종합 판정.
- **에이전트는 MAIN 간격만으로 과훈련을 판정하지 않는다.**

### 2.3 [블록 3] MAIN 훈련 정의

- **MAIN** = `intensity_final HIGH 또는 RACE_MAX`. MOD 이하는 MAIN 아님.
- MOD-HIGH 경계: `[?]` 태그. 코치 확인 후 재분류.
- **MAIN_CANDIDATE**: Phase C에서 부여. Phase D의 LEGACY_PHASE_D.D-2에서 MAIN으로 취급. 코치가 NORMAL로 변경 가능.
- MAIN_CANDIDATE 기준: HIGH 이상, 또는 MOD이면서 `duration ≥ 60분 AND energy_system에 LT 포함`.
- **Statistical Freedom**: "고정된 주기는 없다. 통계적 평균만 있을 뿐이다." 롤링 9–10일 주기. MAIN이 항상 같은 요일에 오지 않는다.

### 2.4 [블록 4] Z1 (회복) 세션 정의

- **Z1 조건**: (1) `intensity_final REST/LOW`이고 Jog/Walk/Stretch, (2) "회복"/"리커버리" 명시, (3) 프리조그 페이스가 느린 경우.
- **페이스 계산법**: 총시간(분)/총거리(km)=km당 페이스 → ×0.4 = 400m당 페이스 → 초 환산.  
  예: "6km 35분" → 140″/400m → Z1.
- 400m **100″ 이상**: Z1. **90–100″**: 경계 `[?]`, 맥락 판단, 불가 시 Z1(보수적). **90″ 미만**: BASE.
- 페이스 없으면 `[추정]` 태그.
- 제외: 보강 → SUPPORT, 12km+ 지속주 → BASE (120″ 이상이면 코치 확인 후 Z1 가능).
- 출력: `energy_system "Z1"`, `intensity_final "REST"/"LOW"`, `tags ["recovery","z1"]`.

---

## 3. Phase 순서 및 파일 안내 (정본 §0.4)

| Phase | 내용 | 본 docs 참조 |
|---|---|---|
| **A** | 선수 확인 | 본 문서 §4 |
| **B** | 데이터 수집 | 본 문서 §5 |
| **C** | 세션 분류 | `05a_SESSION_CLASSIFIER.md` |
| **D** | 규칙 검증 | `05b_RULE_VALIDATOR.md` |
| **E** | 분석/설계/진단 | `07_FEEDBACK_SYSTEM.md` |
| **F** | 출력 | `07_FEEDBACK_SYSTEM.md` §F |

### 명령별 Phase 맵

| 명령 | 흐름 |
|---|---|
| ANALYZE | A→B→C→D→E→F |
| DESIGN | A→B→C→D→E→F |
| DIAGNOSE | A→B→C→D→E→F |
| DOCUMENT | A→B→**SKIP** C,D,E→F |
| REGISTER | A→B→C→D→E→F |

> Naming notice: 본 문서의 Phase D 항목은 `LEGACY_PHASE_D.D-*` 훈련검증 항목을 의미한다.  
> 현재 SPEC 레이어의 `RULE_SPEC_D1_D9.D-*`와 구분한다.

---

## 4. Phase A — 선수 확인 (정본 §1)

### 4.1 단계
- **A-1** 선수 이름 확인. 없으면 질문.
- **A-2** 프로파일 존재 확인 (`A_guide` §11 또는 이전 대화).
- **A-3** 종목 카테고리: MD (800m/1500m) / MLD (3000m/5000m) / LD (10km/하프/풀).
- **A-4** 현재 훈련 기간(PERIOD).

### 4.2 PERIOD 판정 규칙

| 조건 | PERIOD |
|---|---|
| 코치 명시 | 그대로 |
| 미명시 | 자동 추정 + `[추정]` + 코치 확인 질문 |
| 대회 8주+ 또는 미정 | BASE `[추정]` |
| 4–8주 | BUILD `[추정]` |
| 4주 이내 | COMP `[추정]` |
| 부상 복귀 | BASE 자동 |
| 미확정 | BUILD + `[추정]` |
| 4주+ 분석 시 패턴 급변(볼륨 ±20 %) | 코치 질문 |

### 4.3 종목별 주간 목표 (BUILD 기본)

| 종목 | 분/주 |
|---|---|
| MD | 400 |
| MLD | 500 |
| LD | 600 |

PERIOD 보정: BASE × 0.75–0.85, BUILD × 1.0–1.25, COMP × 0.85–1.0, 대회 주간 × 0.5–0.7.

### 4.4 기간별 에너지 비중 조정 (정본)

**2024 파일럿 기본값**: BASE 45.2 %, LT 19.8 %, GLY-SHORT 8.3 %, VO2-LONG 18.6 %, ATP-PC 4.1 %, Z1 12.5 %.

| PERIOD | 변경 |
|---|---|
| BASE | BASE +10 %, Z1 +3 %, GLY-SHORT −5 %, ATP-PC −5 % |
| BUILD | 기본값 유지 (코치 "BUILD 강화" 명시 시: LT +5 %, VO2 +5 %, BASE −10 %) |
| COMP | GLY-SHORT +5 %, ATP-PC +3 %, BASE −8 % |

### 4.5 Phase A 출력 템플릿

```
[Phase A 완료]
선수: {이름}
종목: {카테고리} ({세부})
훈련 기간: {PERIOD} {[추정]}
주간 목표: 총 {N-N}분/주
에너지 비중: BASE {N}% / LT {N}% / GLY {N}% / VO2 {N}% / ATP-PC {N}% / Z1 {N}%
프로파일: {완전/부분/신규}
부족 정보: {목록 또는 "없음"}
```

---

## 5. Phase B — 데이터 수집 (정본 §2)

### 5.1 수집 항목 (B-1 ~ B-6)
- 기간 / 출처 / 메인세션 / 팀프로그램 / 코멘트 / HR·가민

### 5.2 데이터 레벨

| 레벨 | 조건 |
|---|---|
| Level 1 (최소) | 메인 2주+, 보조 없음 → Z1/총시간 `[추정]` |
| Level 2 (표준) | + 팀프로그램 + 코멘트 + 4주+ |
| Level 3 (고급) | + HR/가민 + 12주+ + 대회기록 |

부족 시: 명시, 안내, 가용 범위 진행, `[추정]` 태그.

### 5.3 Phase B 출력 템플릿

```
[Phase B 완료]
기간: {시작} ~ {종료} ({N}일)
훈련 기간: {PERIOD} {[추정]}
데이터 레벨: {1/2/3}
메인 세션: {N}개
보조: {포함/미포함}
팀 프로그램: {있음/없음}
코멘트: {있음/없음}
HR/가민: {있음/없음}
부족: {목록 또는 "없음"}
```

---

## 6. 지식파일 참조 맵 (정본 §6)

| Phase | 참조 파일 | 섹션 |
|---|---|---|
| Phase A | `B_bg_data.md` | §9.1–9.4, §7 |
| Phase A | `A_guide` | §11 |
| Phase C (part_00) | `B_bg_data.md` | §8.1, §3.3–3.5 |
| Phase C (part_01) | `B_bg_philosophy.md` | §0.2 |
| Phase C (part_01) | `A_guide` | §5.1–5.10 |
| Phase D (part_00) | `B_bg_philosophy.md` | §0.1, §1.1, §1.2, §1.5, §1.7, §1.8 |
| Phase D (part_01) | `B_bg_data.md` | §2.3, §9.1–9.4 |
| Phase D | `C_workflow_engine` | §0.3 |
| Phase E | `B_bg_philosophy.md` | 전체 |
| Phase E | `B_bg_data.md` | §2.2–2.5, §4, §5, §9.4 |
| Phase E | `B_bg_reference.md` | §11.2 |
| Phase F | `TrainingDoc_Guideline` | v1.1 |

---

## 7. 주의사항 (정본 §8)

- 본 문서(02_AI_STRATEGY)는 가장 먼저 읽는 길라잡이.
- 용어 정의(§2)는 이 문서가 정본. 다른 docs에서 "0.3 기준"이면 본 문서 §2를 참조.
- **9.5일 주기를 자의적 해석 금지**.
- **MAIN 간격만으로 과훈련 판정 금지**.
- PERIOD 반드시 확인.
- 4개 정본 파일(workflow_engine, phase_classify, phase_validate, phase_execute) 버전 일치 필수 (v1.3.1).

---

## 8. 버전 이력 (정본 §7)

| 버전 | 날짜 | 변경 |
|---|---|---|
| v1.0 | 2026-03-10 | 초안 (Phase A~F, 명령 5개, 검증 7개) |
| v1.1 | 2026-03-11 | Phase D 검증 9개 확장 (`LEGACY_PHASE_D.D-8`, `LEGACY_PHASE_D.D-9` 추가) |
| v1.2 | 2026-03-12 | MOD-FAST/DETAILED, 연속 명령, Statistical Freedom |
| v1.3 | 2026-03-12 | 16건 개선 + hotfix 9건 |
| v1.3.1 | 2026-03-16 | **4파일 분할** (본체 + classify + validate + execute) |

---

**Source Lineage**: `C_workflow_engine_v1.3.md` v1.3.1 (44.7 KB, 정본) → 본 docs (Phase A·B·핵심 원칙 부분).  
세부 Phase C/D/E는 분리된 docs(`05a`, `05b`, `07`) 참조.
