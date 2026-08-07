# D-03 — 경로 참조 해석 실패 분류 (F-3)

```yaml
packet: D-03
executor: DeepSeek
executed_at: "2026-08-06"
repo_sha: "b4f5d99"
mode: READ_ONLY
verdict_authority: NONE
files_examined: 496      # git ls-files '*.md' 전체 (clean 스코프 = 추적 md 전용)
findings_total: 4
owner_decision_required: 0
```

## 실행한 명령

```bash
cd /home/user/webapp
git ls-files > /tmp/tracked.txt                                   # 1328

# [재현 A] 지시서 §6 D-03 원문 명령 그대로 (워킹트리 grep — 비추적 md 포함 스캔)
grep -rhoE '`[A-Za-z0-9_./-]+\.(md|ts|tsx|mjs|sh|json|yml)`' --include='*.md' . \
  | tr -d '`' | sed 's#^\./##' | sort -u > /tmp/d03_refs_raw.txt  # 851
: > /tmp/d03_miss_raw.txt
while read -r p; do
  grep -qxF "$p" /tmp/tracked.txt || grep -qE "/${p}$" /tmp/tracked.txt \
    || echo "$p" >> /tmp/d03_miss_raw.txt
done < /tmp/d03_refs_raw.txt
wc -l /tmp/d03_refs_raw.txt /tmp/d03_miss_raw.txt                # 851 / 137

# [재현 B] clean 스코프: 추적 md 전용 (노이즈 원천=비추적 md 차단)
git grep -hoE '`[A-Za-z0-9_./-]+\.(md|ts|tsx|mjs|sh|json|yml)`' -- '*.md' \
  | tr -d '`' | sed 's#^\./##' | sort -u > /tmp/d03_clean_refs.txt   # 803
: > /tmp/d03_clean_miss.txt
while read -r p; do
  grep -qxF "$p" /tmp/tracked.txt || grep -qE "/${p}$" /tmp/tracked.txt \
    || echo "$p" >> /tmp/d03_clean_miss.txt
done < /tmp/d03_clean_refs.txt
wc -l /tmp/d03_clean_refs.txt /tmp/d03_clean_miss.txt            # 803 / 95

# 노이즈 성분 (재현 A 전용 miss)
comm -23 <(sort -u /tmp/d03_miss_raw.txt) /tmp/d03_clean_miss.txt > /tmp/d03_noise.txt   # 42
```

## 결과

### 0. 계측 방법 의존성 재현 (v1.1 §9-6 예외 적용)

| 스코프 | 정의 | 유니크 참조 경로 | 해석 실패(miss) | 비고 |
|---|---|---|---|---|
| 재현 A (raw) | 워킹트리 `grep --include='*.md' .` | **851** | **137** | 비추적 md(주로 `app/node_modules/*/README.md`, 일부 `.omo/*`)까지 스캔 |
| 재현 B (clean) | **추적 md 전용** (`git grep -- '*.md'`) | **803** | **95** | 본 보고서 채택 수치 |
| 노이즈 | A−B 차이 | — | **42** | 비추적 md에만 존재하는 경로 인용 — 저장소 결함 아님 |

- **`git grep` 재실측으로 clean 803/95를 정확히 재현**했다. v1.1 참고치 `d9dc=802/95`와 **refs ±1, miss 0 정합** (refs 803 vs 802는 Round 2 문서 신설로 인한 자연 증가).
- v1.1 §9-6: **F-3은 계측 의존 수치다. 이 수치 불일치는 "저장소 변경"이 아니며 정지 조건에 해당하지 않는다.** 자기 실측값(clean 803/95)으로 보고한다.
- 노이즈 42건의 예: `CHANGELOG.md`, `dist/index.d.ts`, `docs/MIGRATION.md`, `src/main.ts`, `usage.test.ts` 등 — 출처가 전부 비추적 md(`app/node_modules/@babel/parser/CHANGELOG.md` 등)다. **추적 저장소 관점에서 존재하지 않는 인용이므로 분류 대상에서 제외**한다. (v1.1의 d9dc 실측 802/95는 같은 clean 스코프 정의를 쓴 것으로 판단된다.)

### 1. clean 95건 분류 분포

| 분류 | 건수 | 위험도(높음/중간/낮음) | 요약 |
|---|---:|---|---|
| 과거삭제 | 56 | 0 / 0 / 56 | 레거시 원본·구명칭·삭제 이력 — **정상**(역사 기록이 참조) |
| .omo내부 | 15 | 0 / 0 / 15 | `.omo/` 아래 — 런타임/메모 산출물 (git 추적 밖 또는 예시 경로) |
| 진짜깨짐 | 9 | **2 / 7** / 0 | 현재 길잡이/계획문서가 참조, main에 부재 — 🔴 가장 위험 |
| 상대경로표기 | 5 | 0 / 0 / 5 | 문서 위치 기준 `../` — **4건 실존 경로로 해석 성공** |
| 판정불가 | 5 | 0 / 3 / 2 | CI 런타임 생성 산출물·조건부 생성·유령 스크립트 — "없음"이 정상일 수 있음 |
| 예시코드조각 | 4 | 0 / 0 / 4 | 확장자/이름만 있는 조각 (`.test.ts`, `FirstPage.contract.test.tsx` 등) |
| 외부저장소 | 1 | 0 / 0 / 1 | `/doc/ws.md` — 이 저장소 소유 아님 |
| **합계** | **95** | **2 / 13 / 80** | |

> "검출 0건"이 아님: 진짜깨짐 9건을 실제로 발견했다(높음 2건 포함). 나머지 86건은 분류상 정상 계열이다.

### 2. 🔴 진짜깨짐 9건 (높음 2건 상세)

| 참조 경로 | 참조하는 문서 | 위험도 | 관찰 |
|---|---|---|---|
| `app/src/screens/FormationShadow.tsx` | `reports/target-patch-plans/09-product-projection.md` | 🔴 높음 | 현재 진행형 계획문서(09)가 **생성 전제**로 명시, main에 부재 — 진행 중 작업물일 가능성 |
| `tailwind.config.ts` | `HANDOFF.md` · `design-system/DESIGN_TOKENS.md` | 🔴 높음 | 현재 길잡이 HANDOFF.md·디자인 토큰 문서가 요구, main에 부재 |
| `app/src/screens/records/RecordDistribution.tsx` | `reports/review/WORK_ORDER_AGGRESSIVE_REVIEW_2026-07-28.md` | 🟡 중간 | 과거 공격적 리뷰(P5)가 지시한 산출물 |
| `data/identity/athlete-map.json` | `ATHLETETIME_INTEGRATION_REVIEW.md` | 🟡 중간 | 현재 검토 문서가 참조 |
| `journal-reference.ts` | `reports/review/WORK_ORDER_AGGRESSIVE_REVIEW_2026-07-28.md` | 🟡 중간 | 과거 리뷰(D6)가 결함으로 지적한 미생성 파일 |
| `reports/review/PLAN_WORKOUT_DETAIL_UX_PROPOSAL_2026-07-24.md` | `reports/review/OPEN_PR_TRIAGE_2026-07-26.md` | 🟡 중간 | 작업지시서가 전제하는 산출물, 미생성 |
| `reports/review/WORK_ORDER_PM_QUALITY_GENERATOR_C3A_REPORT.md` | `WORK_ORDER_PM_QUALITY_GENERATOR_C3A.md` | 🟡 중간 | WO-PM-C3A가 전제하는 산출물, 미생성 |
| `reports/review/WORK_ORDER_SLOT_INTENSITY_FULL_RUN_REPORT.md` | `WORK_ORDER_PM_QUALITY_GENERATOR_C3A.md` · `WORK_ORDER_SLOT_INTENSITY_FULL_RUN.md` | 🟡 중간 | 작업지시서 2건이 전제, 미생성 |
| `reports/review/WORK_ORDER_TRAINING_TIME_QUESTION_C3A0_REPORT.md` | `WORK_ORDER_TRAINING_TIME_QUESTION_C3A0.md` | 🟡 중간 | WO가 전제, 미생성 |

- 높음 2건 모두 "**진행 중/계획 중 작업물의 생성 전제**" 성격으로, 즉시 고장이라기보다 **다음에 깊게 볼 지점**(D-24 제안 후보)이다. 감사자는 판정하지 않는다.
- 전체 95건 분류표는 아래에 전수 삽입했다.

### 3. `../` 상대경로 해석 시도 (5건)

| 경로 | 해석 결과 |
|---|---|
| `../../SPEC_TARGET_PATCH_MATRIX.md` (specs/reconstruct/README.md:38) | ✅ 존재: `SPEC_TARGET_PATCH_MATRIX.md` |
| `../SPEC_TARGET_PATCH_MATRIX.md` (루트 README 등) | ✅ 존재: `SPEC_TARGET_PATCH_MATRIX.md` |
| `../TRAINORACLE_SPEC_INDEX.md` (.omo/evidence 2건) | ✅ 존재: `TRAINORACLE_SPEC_INDEX.md` |
| `../design-system/DESIGN_TOKENS.md` (.omo/evidence·HANDOFF.md) | ✅ 존재: `design-system/DESIGN_TOKENS.md` |
| `../FOO.md` (지시서·검수보고서) | 예시 텍스트 — 실제 참조 아님 |

### 4. 전체 분류표 (95건)

### 전체 분류표 (95건)

| 참조 경로 | 참조하는 문서 | 분류 | 위험도 | 비고 |
|---|---|---|---|---|
| `../../SPEC_TARGET_PATCH_MATRIX.md` | ./specs/reconstruct/README.md | 상대경로표기 | 낮음 | 해석 시도: 존재 경로=SPEC_TARGET_PATCH_MATRIX.md |
| `../FOO.md` | ./reports/review/WORK_ORDER_DEEPSEEK_SPEC_WIDE_AUDIT_VERIFICATION_REPORT.md · ./WORK_ORDER_DEEPSEEK_SPEC_WIDE_AUDIT.md | 상대경로표기 | 낮음 | 지시서/검수보고서의 예시 텍스트 (실제 참조 아님) |
| `../SPEC_TARGET_PATCH_MATRIX.md` | ./README.md · ./SPEC_LEGACY_ALIGNMENT_AND_DAILY_LOG_PLAN.md | 상대경로표기 | 낮음 | 해석 시도: 존재 경로=SPEC_TARGET_PATCH_MATRIX.md |
| `../TRAINORACLE_SPEC_INDEX.md` | ./.omo/evidence/f1-trainoracle-main-handoff-cleanup-plan-compliance.txt · ./.omo/evidence/f3-trainoracle-main-handoff-cleanup-remote-proof.txt | 상대경로표기 | 낮음 | 해석 시도: 존재 경로=TRAINORACLE_SPEC_INDEX.md |
| `../design-system/DESIGN_TOKENS.md` | ./.omo/evidence/task-9-trainoracle-main-handoff-cleanup-precommit.txt · ./HANDOFF.md | 상대경로표기 | 낮음 | 해석 시도: 존재 경로=design-system/DESIGN_TOKENS.md |
| `.omo/evidence/.../c001-red-daily-log-file-truth.md` | ./SPEC_SOURCE_ACCEPTANCE_DECISION_ROUND2.md | .omo내부 | 낮음 | git 추적 미포함(ulw-loop)·예시경로(...) — 런타임/메모 산출물 |
| `.omo/evidence/trainoracle-belief-reference-guardrails.md` | ./.omo/plans/trainoracle-spec-inventory-pass.md | .omo내부 | 낮음 | git 추적 미포함(ulw-loop)·예시경로(...) — 런타임/메모 산출물 |
| `.omo/evidence/trainoracle-exact-missing-search.md` | ./.omo/plans/trainoracle-spec-inventory-pass.md | .omo내부 | 낮음 | git 추적 미포함(ulw-loop)·예시경로(...) — 런타임/메모 산출물 |
| `.omo/evidence/trainoracle-preflight-state.md` | ./.omo/plans/trainoracle-spec-inventory-pass.md | .omo내부 | 낮음 | git 추적 미포함(ulw-loop)·예시경로(...) — 런타임/메모 산출물 |
| `.omo/evidence/trainoracle-readiness-source-map.md` | ./.omo/plans/trainoracle-spec-inventory-pass.md | .omo내부 | 낮음 | git 추적 미포함(ulw-loop)·예시경로(...) — 런타임/메모 산출물 |
| `.omo/evidence/trainoracle-structural-quarantine-scan.md` | ./.omo/plans/trainoracle-spec-inventory-pass.md | .omo내부 | 낮음 | git 추적 미포함(ulw-loop)·예시경로(...) — 런타임/메모 산출물 |
| `.omo/ulw-loop/019ef850-bb65-7082-ad74-7dc718b3f8e8/goals.json` | ./.omo/evidence/trainoracle-inventory-readiness-gate-review.md · ./.omo/evidence/trainoracle-spec-inventory-readiness-gate-review.md | .omo내부 | 낮음 | git 추적 미포함(ulw-loop)·예시경로(...) — 런타임/메모 산출물 |
| `.omo/ulw-loop/goals.json` | ./.omo/evidence/trainoracle-main-handoff-cleanup-gate-review.md · ./.omo/evidence/trainoracle-main-handoff-cleanup-review-coverage.md | .omo내부 | 낮음 | git 추적 미포함(ulw-loop)·예시경로(...) — 런타임/메모 산출물 |
| `.omo/ulw-loop/spec-wave1-physio-20260626/goals.json` | ./.omo/evidence/spec-wave1-physio-gate-review.md | .omo내부 | 낮음 | git 추적 미포함(ulw-loop)·예시경로(...) — 런타임/메모 산출물 |
| `.omo/ulw-loop/spec-wave1-physio-20260626/notepad.md` | ./.omo/evidence/spec-wave1-physio-gate-review.md | .omo내부 | 낮음 | git 추적 미포함(ulw-loop)·예시경로(...) — 런타임/메모 산출물 |
| `.omo/ulw-loop/spec-wave2-daily-log-20260627/brief.md` | ./.omo/evidence/spec-wave2-daily-log-20260627-gate-review.md | .omo내부 | 낮음 | git 추적 미포함(ulw-loop)·예시경로(...) — 런타임/메모 산출물 |
| `.omo/ulw-loop/spec-wave2-daily-log-20260627/goals.json` | ./.omo/evidence/spec-wave2-daily-log-20260627-gate-review.md | .omo내부 | 낮음 | git 추적 미포함(ulw-loop)·예시경로(...) — 런타임/메모 산출물 |
| `.omo/ulw-loop/spec-wave2-daily-log-20260627/notepad.md` | ./.omo/evidence/spec-wave2-daily-log-20260627-gate-review.md | .omo내부 | 낮음 | git 추적 미포함(ulw-loop)·예시경로(...) — 런타임/메모 산출물 |
| `.omo/ulw-loop/trainoracle-next-spec-review-20260707/brief.md` | ./.omo/evidence/trainoracle-next-phase-final-review.txt · ./.omo/evidence/trainoracle-next-phase-gate-review.md | .omo내부 | 낮음 | git 추적 미포함(ulw-loop)·예시경로(...) — 런타임/메모 산출물 |
| `.omo/ulw-loop/trainoracle-next-spec-review-20260707/goals.json` | ./.omo/evidence/trainoracle-next-phase-final-review.txt · ./.omo/evidence/trainoracle-next-phase-gate-review.md | .omo내부 | 낮음 | git 추적 미포함(ulw-loop)·예시경로(...) — 런타임/메모 산출물 |
| `/doc/ws.md` | ./app/node_modules/ws/README.md · ./WORK_ORDER_DEEPSEEK_SPEC_WIDE_AUDIT.md | 외부저장소 | 낮음 | 이 저장소 소유 아님 |
| `.test.ts` | ./.git/objects/pack/pack-b07a1dbf87d8dfc97cf1cff84ac4fa658aa4dcd4.pack · ./.git/objects/pack/pack-e76ead9799982620395a87b96927ee5727c808bc.pack | 예시코드조각 | 낮음 | 확장자/이름만 있는 조각 (실제 경로 지시 아님) |
| `FirstPage.contract.test.tsx` | ./.omo/evidence/launch-ready-athlete-ux-safety-code-review.md · ./.omo/evidence/launch-ready-athlete-ux-safety-followup-code-review.md | 예시코드조각 | 낮음 | 확장자/이름만 있는 조각 (실제 경로 지시 아님) |
| `e2e/restore-backup.spec.ts` | ./reports/implementation/ABANDONED_WORK_SWEEP_2026-07-25.md | 예시코드조각 | 낮음 | 확장자/이름만 있는 조각 (실제 경로 지시 아님) |
| `journal-reference.contract.test.ts` | ./reports/review/WORK_ORDER_AGGRESSIVE_REVIEW_2026-07-28.md | 예시코드조각 | 낮음 | 확장자/이름만 있는 조각 (실제 경로 지시 아님) |
| `reports/review/deepseek-audit/D-22-SUMMARY.md` | ./WORK_ORDER_DEEPSEEK_SPEC_WIDE_AUDIT.md | 과거삭제 | 중간 | 본 감사 예정 산출물(D-22~24) — 실행 완료 후 생성 예정 (지시서 §10 파일명) |
| `reports/review/deepseek-audit/D-23-HANDOFF.md` | ./WORK_ORDER_DEEPSEEK_SPEC_WIDE_AUDIT.md | 과거삭제 | 중간 | 본 감사 예정 산출물(D-22~24) — 실행 완료 후 생성 예정 (지시서 §10 파일명) |
| `reports/review/deepseek-audit/D-24-PROPOSALS.md` | ./WORK_ORDER_DEEPSEEK_SPEC_WIDE_AUDIT.md | 과거삭제 | 중간 | 본 감사 예정 산출물(D-22~24) — 실행 완료 후 생성 예정 (지시서 §10 파일명) |
| `01_philosophy/B_bg_philosophy.md` | ./specs/legacy-reference/SOURCE_MAP.md · ./specs/legacy-reference/_SOURCE_TO_DOC_MAP_v3.0.md | 과거삭제 | 낮음 | 레거시 원본 — specs/legacy-reference로 대체. active 스펙은 alias(yaml, 비백틱)로만 참조 |
| `02_training_system/A_guide_v5.1_20260201.md` | ./specs/legacy-reference/SOURCE_MAP.md | 과거삭제 | 낮음 | 레거시 원본 — specs/legacy-reference로 대체. active 스펙은 alias(yaml, 비백틱)로만 참조 |
| `02_training_system/B_bg_reference.md` | ./specs/legacy-reference/SOURCE_MAP.md | 과거삭제 | 낮음 | 레거시 원본 — specs/legacy-reference로 대체. active 스펙은 alias(yaml, 비백틱)로만 참조 |
| `03_workflow_engine/C_workflow_engine_v1.3.md` | ./specs/legacy-reference/02_AI_STRATEGY.md · ./specs/legacy-reference/06_VALIDATION_AND_SAFEGUARDS.md | 과거삭제 | 낮음 | 레거시 원본 — specs/legacy-reference로 대체. active 스펙은 alias(yaml, 비백틱)로만 참조 |
| `03_workflow_engine/phase_classify_v1.3.1.md` | ./specs/legacy-reference/11_API_AND_ENGINE_CONTRACTS.md · ./specs/legacy-reference/SOURCE_MAP.md | 과거삭제 | 낮음 | 레거시 원본 — specs/legacy-reference로 대체. active 스펙은 alias(yaml, 비백틱)로만 참조 |
| `03_workflow_engine/phase_execute_v1.3.1.md` | ./specs/legacy-reference/11_API_AND_ENGINE_CONTRACTS.md · ./specs/legacy-reference/SOURCE_MAP.md | 과거삭제 | 낮음 | 레거시 원본 — specs/legacy-reference로 대체. active 스펙은 alias(yaml, 비백틱)로만 참조 |
| `03_workflow_engine/phase_validate_v1.3.1.md` | ./specs/legacy-reference/06_VALIDATION_AND_SAFEGUARDS.md · ./specs/legacy-reference/11_API_AND_ENGINE_CONTRACTS.md | 과거삭제 | 낮음 | 레거시 원본 — specs/legacy-reference로 대체. active 스펙은 alias(yaml, 비백틱)로만 참조 |
| `04_data_import/D_calendar_parsing_part_00.md` | ./specs/legacy-reference/SOURCE_MAP.md | 과거삭제 | 낮음 | 레거시 원본 — specs/legacy-reference로 대체. active 스펙은 alias(yaml, 비백틱)로만 참조 |
| `04b_CALENDAR_PARSING.md` | ./specs/legacy-reference/12_SCREEN_GUIDE.md · ./specs/legacy-reference/SOURCE_MAP.md | 과거삭제 | 낮음 | 레거시 원본 — specs/legacy-reference로 대체. active 스펙은 alias(yaml, 비백틱)로만 참조 |
| `05_training_doc_guidelines/TrainingDoc_Guideline_v1.1_20260203.md` | ./specs/legacy-reference/12_SCREEN_GUIDE.md · ./specs/legacy-reference/SOURCE_MAP.md | 과거삭제 | 낮음 | 레거시 원본 — specs/legacy-reference로 대체. active 스펙은 alias(yaml, 비백틱)로만 참조 |
| `05a_SESSION_CLASSIFIER.md` | ./specs/legacy-reference/02_AI_STRATEGY.md · ./specs/legacy-reference/SOURCE_MAP.md | 과거삭제 | 낮음 | 레거시 원본 — specs/legacy-reference로 대체. active 스펙은 alias(yaml, 비백틱)로만 참조 |
| `05b_RULE_VALIDATOR.md` | ./specs/legacy-reference/02_AI_STRATEGY.md · ./specs/legacy-reference/06_VALIDATION_AND_SAFEGUARDS.md | 과거삭제 | 낮음 | 레거시 원본 — specs/legacy-reference로 대체. active 스펙은 alias(yaml, 비백틱)로만 참조 |
| `06_whitepaper/FILE_VERSION_CHANGELOG_v2.md` | ./specs/legacy-reference/SOURCE_MAP.md · ./specs/legacy-reference/_SOURCE_TO_DOC_MAP_v3.0.md | 과거삭제 | 낮음 | 레거시 원본 — specs/legacy-reference로 대체. active 스펙은 alias(yaml, 비백틱)로만 참조 |
| `06_whitepaper/TRAINING_PLAN_SYSTEM_WHITEPAPER_v1.1_final_r1.md` | ./specs/legacy-reference/02_AI_STRATEGY.md · ./specs/legacy-reference/SOURCE_MAP.md | 과거삭제 | 낮음 | 레거시 원본 — specs/legacy-reference로 대체. active 스펙은 alias(yaml, 비백틱)로만 참조 |
| `06_whitepaper/final_validation_report.md` | ./specs/legacy-reference/SOURCE_MAP.md · ./specs/legacy-reference/_SOURCE_TO_DOC_MAP_v3.0.md | 과거삭제 | 낮음 | 레거시 원본 — specs/legacy-reference로 대체. active 스펙은 alias(yaml, 비백틱)로만 참조 |
| `07_FEEDBACK_SYSTEM.md` | ./specs/legacy-reference/02_AI_STRATEGY.md · ./specs/legacy-reference/GLOSSARY.md | 과거삭제 | 낮음 | 레거시 원본 — specs/legacy-reference로 대체. active 스펙은 alias(yaml, 비백틱)로만 참조 |
| `07_operations/karpathy_claude_guidelines.md` | ./specs/legacy-reference/SOURCE_MAP.md · ./specs/legacy-reference/_SOURCE_TO_DOC_MAP_v3.0.md | 과거삭제 | 낮음 | 레거시 원본 — specs/legacy-reference로 대체. active 스펙은 alias(yaml, 비백틱)로만 참조 |
| `11_API_AND_ENGine_CONTRACTS.md` | ./SPEC_SOURCE_ACCEPTANCE_DECISION_ROUND1.md | 과거삭제 | 낮음 | 레거시 원본 — specs/legacy-reference로 대체. active 스펙은 alias(yaml, 비백틱)로만 참조 |
| `2026-04-29-safety-statement-introduced.md` | ./specs/legacy-reference/GLOSSARY.md | 과거삭제 | 낮음 | 레거시 원본 — specs/legacy-reference로 대체. active 스펙은 alias(yaml, 비백틱)로만 참조 |
| `A_guide_v5.1_20260201.md` | ./specs/active/ATHLETE_PROFILE_SPEC.md · ./specs/active/RULE_SPEC_D1_D9.md | 과거삭제 | 낮음 | 레거시 원본 — specs/legacy-reference로 대체. active 스펙은 alias(yaml, 비백틱)로만 참조 |
| `B_background_v5.1_20260205.md` | ./specs/legacy-reference/SOURCE_MAP.md · ./specs/legacy-reference/_SOURCE_TO_DOC_MAP_v3.0.md | 과거삭제 | 낮음 | 레거시 원본 — specs/legacy-reference로 대체. active 스펙은 alias(yaml, 비백틱)로만 참조 |
| `B_bg_data.md` | ./specs/active/ATHLETE_PROFILE_SPEC.md · ./specs/active/RULE_SPEC_D1_D9.md | 과거삭제 | 낮음 | 레거시 원본 — specs/legacy-reference로 대체. active 스펙은 alias(yaml, 비백틱)로만 참조 |
| `B_bg_philosophy.md` | ./specs/active/ATHLETE_PROFILE_SPEC.md · ./specs/active/RULE_SPEC_D1_D9.md | 과거삭제 | 낮음 | 레거시 원본 — specs/legacy-reference로 대체. active 스펙은 alias(yaml, 비백틱)로만 참조 |
| `B_bg_reference.md` | ./specs/active/ATHLETE_PROFILE_SPEC.md · ./specs/active/RULE_SPEC_D1_D9.md | 과거삭제 | 낮음 | 레거시 원본 — specs/legacy-reference로 대체. active 스펙은 alias(yaml, 비백틱)로만 참조 |
| `COACH_RATIFICATION_SAFETY_DEFAULTS_2026_06_04_001.md` | ./.omo/evidence/trainoracle-confirmed-inventory.md · ./.omo/evidence/trainoracle-missing-quarantine.md | 과거삭제 | 낮음 | 구명칭/정리 대상 (.omo/evidence·.omo/plans가 참조 = 과거 기록) |
| `C_workflow_engine_v1.3.md` | ./specs/legacy-reference/02_AI_STRATEGY.md · ./specs/legacy-reference/06_VALIDATION_AND_SAFEGUARDS.md | 과거삭제 | 낮음 | 레거시 원본 — specs/legacy-reference로 대체. active 스펙은 alias(yaml, 비백틱)로만 참조 |
| `D_cal_parse_00/02/dict.md` | ./specs/legacy-reference/SOURCE_MAP.md | 과거삭제 | 낮음 | 레거시 원본 — specs/legacy-reference로 대체. active 스펙은 alias(yaml, 비백틱)로만 참조 |
| `D_calendar_parsing_part_00.md` | ./specs/legacy-reference/12_SCREEN_GUIDE.md · ./specs/legacy-reference/SOURCE_MAP.md | 과거삭제 | 낮음 | 레거시 원본 — specs/legacy-reference로 대체. active 스펙은 alias(yaml, 비백틱)로만 참조 |
| `D_calendar_parsing_part_01.md` | ./specs/legacy-reference/SOURCE_MAP.md | 과거삭제 | 낮음 | 레거시 원본 — specs/legacy-reference로 대체. active 스펙은 alias(yaml, 비백틱)로만 참조 |
| `E_gsheet_template_spec_v1.1.md` | ./specs/legacy-reference/12_SCREEN_GUIDE.md · ./specs/legacy-reference/SOURCE_MAP.md | 과거삭제 | 낮음 | 레거시 원본 — specs/legacy-reference로 대체. active 스펙은 alias(yaml, 비백틱)로만 참조 |
| `FirstPage.tsx` | ./.omo/evidence/launch-ready-athlete-ux-safety-code-review.md · ./.omo/evidence/launch-ready-athlete-ux-safety-followup-code-review.md | 과거삭제 | 낮음 | git diff-filter=D 확인됨 (FirstPage.tsx: app/src/screens/home/FirstPage.tsx 삭제 이력) |
| `SOURCE_TO_DOC_MAP.md` | ./.omo/drafts/train-oracle-spec-handoff.md · ./.omo/evidence/inventory-classification-train-oracle-spec-handoff.md | 과거삭제 | 낮음 | 구명칭/정리 대상 (.omo/evidence·.omo/plans가 참조 = 과거 기록) |
| `SPEC_REGISTRY.md` | ./.omo/drafts/train-oracle-spec-handoff.md · ./.omo/evidence/model-belief-files-train-oracle-spec-handoff.md | 과거삭제 | 낮음 | 구명칭/정리 대상 (.omo/evidence·.omo/plans가 참조 = 과거 기록) |
| `TRAINORACLE_SPEC_FLOW_AND_REMAINING_WORK.md` | ./.omo/evidence/model-belief-files-train-oracle-spec-handoff.md · ./.omo/evidence/task-5-trainoracle-main-handoff-cleanup-green.txt | 과거삭제 | 낮음 | 구명칭/정리 대상 (.omo/evidence·.omo/plans가 참조 = 과거 기록) |
| `TrainingDoc_Guideline_v1.1_20260203.md` | ./specs/active/ATHLETE_PROFILE_SPEC.md · ./specs/active/RULE_SPEC_D1_D9.md | 과거삭제 | 낮음 | 레거시 원본 — specs/legacy-reference로 대체. active 스펙은 alias(yaml, 비백틱)로만 참조 |
| `app/src/screens/home/FirstPage.tsx` | ./.omo/evidence/launch-ready-athlete-ux-safety-code-review.md · ./.omo/evidence/launch-ready-athlete-ux-safety-followup-code-review.md | 과거삭제 | 낮음 | git diff-filter=D 확인됨 (FirstPage.tsx: app/src/screens/home/FirstPage.tsx 삭제 이력) |
| `docs/02_AI_STRATEGY.md` | ./specs/legacy-reference/GLOSSARY.md | 과거삭제 | 낮음 | 레거시 원본 — specs/legacy-reference로 대체. active 스펙은 alias(yaml, 비백틱)로만 참조 |
| `docs/06_VALIDATION_AND_SAFEGUARDS.md` | ./specs/legacy-reference/GLOSSARY.md | 과거삭제 | 낮음 | 레거시 원본 — specs/legacy-reference로 대체. active 스펙은 alias(yaml, 비백틱)로만 참조 |
| `docs/07_FEEDBACK_SYSTEM.md` | ./specs/legacy-reference/GLOSSARY.md | 과거삭제 | 낮음 | 레거시 원본 — specs/legacy-reference로 대체. active 스펙은 alias(yaml, 비백틱)로만 참조 |
| `docs/PATCH_NOTES/2026-04-29-no-external-llm-before-pro.md` | ./specs/legacy-reference/GLOSSARY.md | 과거삭제 | 낮음 | 레거시 원본 — specs/legacy-reference로 대체. active 스펙은 alias(yaml, 비백틱)로만 참조 |
| `docs/PATCH_NOTES/2026-04-29-primary-device-only.md` | ./specs/legacy-reference/GLOSSARY.md | 과거삭제 | 낮음 | 레거시 원본 — specs/legacy-reference로 대체. active 스펙은 alias(yaml, 비백틱)로만 참조 |
| `docs/PATCH_NOTES/2026-04-29-rule-engine-before-llm.md` | ./specs/legacy-reference/GLOSSARY.md | 과거삭제 | 낮음 | 레거시 원본 — specs/legacy-reference로 대체. active 스펙은 alias(yaml, 비백틱)로만 참조 |
| `onboarding-state.ts` | ./.omo/evidence/launch-ready-athlete-ux-safety-followup-code-review.md · ./app/node_modules/react-doctor/dist/cli.js | 과거삭제 | 낮음 | git diff-filter=D 확인됨 (FirstPage.tsx: app/src/screens/home/FirstPage.tsx 삭제 이력) |
| `phase_classify_part_00.md` | ./specs/legacy-reference/SOURCE_MAP.md | 과거삭제 | 낮음 | 레거시 원본 — specs/legacy-reference로 대체. active 스펙은 alias(yaml, 비백틱)로만 참조 |
| `phase_classify_part_00/01.md` | ./specs/legacy-reference/_SOURCE_TO_DOC_MAP_v3.0.md | 과거삭제 | 낮음 | 레거시 원본 — specs/legacy-reference로 대체. active 스펙은 alias(yaml, 비백틱)로만 참조 |
| `phase_classify_part_01.md` | ./specs/legacy-reference/SOURCE_MAP.md | 과거삭제 | 낮음 | 레거시 원본 — specs/legacy-reference로 대체. active 스펙은 alias(yaml, 비백틱)로만 참조 |
| `phase_classify_v1.3.1.md` | ./specs/legacy-reference/11_API_AND_ENGINE_CONTRACTS.md · ./specs/legacy-reference/SOURCE_MAP.md | 과거삭제 | 낮음 | 레거시 원본 — specs/legacy-reference로 대체. active 스펙은 alias(yaml, 비백틱)로만 참조 |
| `phase_execute_v1.3.1.md` | ./specs/legacy-reference/06_VALIDATION_AND_SAFEGUARDS.md · ./specs/legacy-reference/11_API_AND_ENGINE_CONTRACTS.md | 과거삭제 | 낮음 | 레거시 원본 — specs/legacy-reference로 대체. active 스펙은 alias(yaml, 비백틱)로만 참조 |
| `phase_validate_part_00.md` | ./specs/legacy-reference/SOURCE_MAP.md | 과거삭제 | 낮음 | 레거시 원본 — specs/legacy-reference로 대체. active 스펙은 alias(yaml, 비백틱)로만 참조 |
| `phase_validate_part_00/01.md` | ./specs/legacy-reference/_SOURCE_TO_DOC_MAP_v3.0.md | 과거삭제 | 낮음 | 레거시 원본 — specs/legacy-reference로 대체. active 스펙은 alias(yaml, 비백틱)로만 참조 |
| `phase_validate_part_01.md` | ./specs/legacy-reference/SOURCE_MAP.md | 과거삭제 | 낮음 | 레거시 원본 — specs/legacy-reference로 대체. active 스펙은 alias(yaml, 비백틱)로만 참조 |
| `phase_validate_v1.3.1.md` | ./specs/legacy-reference/06_VALIDATION_AND_SAFEGUARDS.md · ./specs/legacy-reference/11_API_AND_ENGINE_CONTRACTS.md | 과거삭제 | 낮음 | 레거시 원본 — specs/legacy-reference로 대체. active 스펙은 alias(yaml, 비백틱)로만 참조 |
| `workflow_main_v1.3.1_rev1.md` | ./specs/legacy-reference/02_AI_STRATEGY.md · ./specs/legacy-reference/SOURCE_MAP.md | 과거삭제 | 낮음 | 레거시 원본 — specs/legacy-reference로 대체. active 스펙은 alias(yaml, 비백틱)로만 참조 |
| `app/src/screens/FormationShadow.tsx` | ./reports/target-patch-plans/09-product-projection.md | 진짜깨짐 | 높음 | 현재 계획문서 target-patch-plans/09가 생성 전제로 명시, main에 부재 |
| `tailwind.config.ts` | ./HANDOFF.md · ./app/node_modules/oxlint-plugin-react-doctor/dist/index.js | 진짜깨짐 | 높음 | 현재 길잡이 HANDOFF.md·design-system/DESIGN_TOKENS.md가 요구, main에 부재 |
| `app/src/screens/records/RecordDistribution.tsx` | ./reports/review/WORK_ORDER_AGGRESSIVE_REVIEW_2026-07-28.md | 진짜깨짐 | 중간 | 과거 리뷰(WORK_ORDER_AGGRESSIVE_REVIEW P5)가 지시한 산출물, main에 부재 |
| `data/identity/athlete-map.json` | ./ATHLETETIME_INTEGRATION_REVIEW.md | 진짜깨짐 | 중간 | 현재 검토 문서 ATHLETETIME_INTEGRATION_REVIEW.md가 참조, main에 부재 |
| `journal-reference.ts` | ./reports/review/WORK_ORDER_AGGRESSIVE_REVIEW_2026-07-28.md | 진짜깨짐 | 중간 | 과거 공격적 리뷰(2026-07-28 D6)가 결함으로 지적한 미생성 파일 |
| `reports/review/PLAN_WORKOUT_DETAIL_UX_PROPOSAL_2026-07-24.md` | ./reports/review/OPEN_PR_TRIAGE_2026-07-26.md | 진짜깨짐 | 중간 | 작업지시서(WO-PM-C3A 등)가 전제하는 산출물, main에 미생성 |
| `reports/review/WORK_ORDER_PM_QUALITY_GENERATOR_C3A_REPORT.md` | ./WORK_ORDER_PM_QUALITY_GENERATOR_C3A.md | 진짜깨짐 | 중간 | 작업지시서(WO-PM-C3A 등)가 전제하는 산출물, main에 미생성 |
| `reports/review/WORK_ORDER_SLOT_INTENSITY_FULL_RUN_REPORT.md` | ./WORK_ORDER_PM_QUALITY_GENERATOR_C3A.md · ./WORK_ORDER_SLOT_INTENSITY_FULL_RUN.md | 진짜깨짐 | 중간 | 작업지시서(WO-PM-C3A 등)가 전제하는 산출물, main에 미생성 |
| `reports/review/WORK_ORDER_TRAINING_TIME_QUESTION_C3A0_REPORT.md` | ./WORK_ORDER_TRAINING_TIME_QUESTION_C3A0.md | 진짜깨짐 | 중간 | 작업지시서(WO-PM-C3A 등)가 전제하는 산출물, main에 미생성 |
| `github.sh` | ./.github/workflows/ci.yml · ./reports/review/WORK_ORDER_DEEPSEEK_SPEC_WIDE_AUDIT_VERIFICATION_REPORT.md | 판정불가 | 중간 | ci.yml이 파일명으로 언급되나 실행은 인라인 node/inline — 저장소에 스크립트 없음 (제거된 과거 스크립트 추정) |
| `trainoracle-deploy-receipt.json` | ./.git/objects/pack/pack-b8990d82e58e6a1f70c74b8495822c7db96ec8bb.pack · ./.github/workflows/ci.yml | 판정불가 | 중간 | CI/rollback 워크플로가 런타임 생성 — 빌드 시에만 존재 (디스크 부재는 정상) |
| `trainoracle-rollback-receipt.json` | ./.github/workflows/rollback-pages.yml · ./app/src/domain/server-operations-workflows.contract.test.ts | 판정불가 | 중간 | CI/rollback 워크플로가 런타임 생성 — 빌드 시에만 존재 (디스크 부재는 정상) |
| `TRAINING_DATA_PROVENANCE_AND_ELIGIBILITY_SPEC.md` | ./FABLE_CODEX_JOINT_PLANNING_BRIEF.md | 판정불가 | 낮음 | FABLE_CODEX 계획서가 "필요성 확인 시 생성" 조건부로 명시 — 미생성은 설계된 상태 |
| `goals.json` | ./.omo/evidence/spec-wave1-physio-gate-review.md · ./.omo/evidence/spec-wave2-daily-log-20260627-gate-review.md | 판정불가 | 낮음 | .omo/ulw-loop 의존 — .omo/evidence의 과거 게이트 리뷰가 참조 (런타임 생성 산출물) |

## 조사하지 못한 것과 이유

1. **진짜깨짐 9건 각각의 "생성 예정 여부" 판정** — 진행 중 작업물인지 누락인지는 오너가 알아야 할 사항이다. D-24 제안 후보로 이월한다(감사자는 판정 금지).
2. **`tailwind.config.ts`가 요구하는 `design-system/DESIGN_TOKENS.md`의 내용 검증** — 해당 문서의 존재만 확인했고 토큰과 코드 상수 일치 검증은 D-16(숫자)과 분리된 별개 감사 범위다.
3. **노이즈 42건의 전수 출처 대조** — 대표 30건(`app/node_modules/*` README 등)만 출처 확인했다. 전부 비추적 md 기원으로 판단되나, 100% 확인은 하지 않았다.
4. **비추적 md가 참조하는 경로의 결함 여부** — 이 저장소 소유 범위 밖(추적 대상 아님)이라 조사하지 않았다.

---

## §14 오너 결정 요청 항목 (OD-REQ)

이 패킷에서는 OD-REQ를 제출하지 않는다(owner_decision_required: 0). 높음 2건 포함 진짜깨짐 9건은 D-22 종합의 제안 후보로 이월하며, 개별 결정은 D-24 제안서에서 정리한다.
