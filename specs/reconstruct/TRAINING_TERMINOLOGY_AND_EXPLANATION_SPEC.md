# TRAINING_TERMINOLOGY_AND_EXPLANATION_SPEC.md

```yaml
document_metadata:
  doc_id: trainoracle-spec-training-terminology-and-explanation
  spec_id: TRAINING_TERMINOLOGY_AND_EXPLANATION_SPEC
  title: Training Terminology And Explanation Spec
  version: "1.1"
  round: RT1
  status: DRAFT_FOR_REVIEW
  owner: COACH_HOJUNE
  open_issues_total: 3
  canonical_blocking_count: 1
  canonical_promotion_allowed: false
  runtime_authority: false
  executed_tests_total: 0
  final_marker_required: "[DRAFT_COMPLETE]"
```

## 1. Purpose

This draft defines how TrainOracle names, explains, searches, and displays training terminology. It prevents a schedule label, a planned training intent, a metabolic pathway, a fuel source, and an observed physiological response from being presented as if they were the same fact.

This document does not redefine rule semantics, authorize a training prescription, measure an athlete's physiology, clear a safety state, or promote any existing draft to canonical status.

---

## 2. Terminology Layers

```yaml
terminology_layers:
  schedule_role:
    examples: [MAIN, BASE, REC, OFF]
    meaning: "the role shown in the calendar"
  planned_training_intent:
    examples: [BASE_INTENT, LT_INTENT, VO2_INTENT, GLY_INTENT, ATP_PC_INTENT, MIXED_INTENT]
    meaning: "the ability or session purpose selected for planning"
  metabolic_pathway:
    examples: [PHOSPHAGEN, GLYCOLYTIC, OXIDATIVE]
    meaning: "interacting ATP resynthesis pathways"
  substrate_context:
    examples: [CARBOHYDRATE, FAT, MIXED]
    meaning: "fuel context within metabolism, not a separate schedule role"
  response_or_metric:
    examples: [LACTATE, VO2, HEART_RATE, RPE, PACE]
    meaning: "a response, measurement, or athlete report; not a plan intent by itself"
```

No layer may silently grant the meaning or authority of another layer.

---

## 3. Scientific Naming Boundary

1. The phosphagen, glycolytic, and oxidative pathways interact from the start of exercise. TrainOracle must not describe them as isolated switches.
2. Exact pathway contribution percentages are forbidden unless a separately accepted measurement contract, source method, and athlete-specific evidence exist.
3. Lactate is not a standalone energy system and must not be described only as waste. It may be produced and used under aerobic conditions.
4. Fat metabolism is a substrate-use context inside oxidative metabolism. It is not a fourth energy system and BASE must not be described as fat-only training.
5. `무산소 젖산` may appear only as a searchable legacy alias for glycolytic terminology. It must not imply that oxygen is absent or lactate is waste.
6. `무산소 비젖산` may appear only as a searchable legacy alias for phosphagen terminology. It must not imply that lactate is literally absent.
7. `유산소 젖산` must not appear as a separate system. The explanation must describe lactate production and use during aerobic metabolism.
8. `고산소 시스템` must not be used as a canonical system name. The preferred terms are `산화 대사`, `유산소 대사`, and, when the context is VO2, `높은 산소 이용이 필요한 강도`.

---

## 4. Athlete-Facing Labels

```yaml
primary_labels:
  RECOVERY_INTENT: "회복 운동 · REC"
  BASE_INTENT: "기초 지구력 · BASE"
  LT_INTENT: "지속 페이스 · LT"
  VO2_INTENT: "강한 유산소 반복 · VO₂"
  GLY_INTENT: "짧은 고강도 반복 · GLY"
  ATP_PC_INTENT: "스피드·가속 · ATP-PC"
  MIXED_INTENT: "여러 강도 조합 · MIX"
```

The Korean name is primary. The code is secondary. Internal storage enums remain unchanged.

`스피드` as a primary public label is reserved for the ATP-PC intent. GLY may mention fast running in an execution example, but its public name must not redefine GLY as speed itself.

---

## 5. Progressive Explanation Contract

Every supported technical term must resolve to one runtime lexicon identifier and support three levels:

1. inline: Korean-first name plus optional secondary code;
2. short help: no more than two or three concise lines, with no full lecture;
3. full term view: naming origin, technical definition, pathway/lactate/substrate context where relevant, non-meaning, TrainOracle usage, examples, related terms, sources, and review date.

The easy and professional layers may differ in depth but must not contradict each other.

---

## 6. Search And Navigation

The lexicon must support Korean names, English names, codes, and declared legacy aliases. It must provide direct links in the form `?terms=1&term=<term_id>` without exposing raw athlete data.

The guide order is:

1. term search;
2. frequently used terms;
3. energy metabolism overview;
4. training notation and structure;
5. behavior FAQ;
6. example journal;
7. feedback.

FAQ answers how to use the app. The lexicon answers what a term means and why it has that name. Future quizzes must consume the same lexicon source and cannot unlock a plan or safety clearance.

---

## 7. Accessibility And Mobile Rules

```yaml
accessibility:
  minimum_touch_target_px: 44
  keyboard_operation_required: true
  color_only_meaning_forbidden: true
  text_zoom_200_percent_required: true
  minimum_supported_width_px: 320
  reduced_motion_respected: true
  focus_and_scroll_restoration_required: true
```

Dense schedules may use short Korean labels such as `주요`, `기초`, `회복`, and `휴식`. A nearby tappable legend must expose the full Korean name and secondary code.

---

## 8. Data And Safety Boundaries

```yaml
boundaries:
  lexicon_changes_storage_enum: forbidden
  lexicon_changes_rule_semantics: forbidden
  planned_intent_claimed_as_measured_physiology: forbidden
  exact_energy_contribution_without_measurement: forbidden
  glossary_interaction_changes_plan_or_safety_state: forbidden
  raw_memo_or_symptom_text_in_search_or_analytics: forbidden
  glossary_quiz_unlocks_plan_or_safety: forbidden
```

The legacy `GLOSSARY.md` remains reference-only. The runtime single source is the typed application lexicon after this draft is accepted and its target binding is reviewed.

---

## 9. Verification Requirements

1. Every user-facing energy code has a Korean-first label.
2. Every tappable help target is at least 44px and works with keyboard, Escape, and outside click.
3. The short help does not render the full professional explanation.
4. Search resolves Korean, English, code, and legacy alias examples.
5. The full view distinguishes pathway, lactate, and substrate context.
6. Mobile checks cover 320px and 375px widths, 200% text, long Korean labels, and no horizontal overflow.
7. Existing stored plan and journal enum values remain unchanged.

Self-checks and markdown assertions are not runtime evidence.

---

## 10. Open Issues

| Issue ID | Description | Canonical blocker | Status |
|---|---|---:|---|
| OI-TTE-SCIENCE-REVIEW-001 | A qualified sports-science reviewer has not accepted the complete athlete-facing terminology set. | YES | OPEN |
| OI-TTE-LEGACY-ALIAS-001 | The complete set of Korean coaching legacy aliases and collision rules still requires owner review. | NO | OPEN |
| OI-TTE-QUIZ-CONTENT-001 | Future quiz and learning-content governance is not yet specified beyond the non-authority boundary. | NO | OPEN |

---

## 11. Source Notes

- Gastin-style energy-system interaction review: https://pubmed.ncbi.nlm.nih.gov/21188163/
- Systematic review of dynamic energy contribution: https://pubmed.ncbi.nlm.nih.gov/41965479/
- Lactate shuttle and aerobic-use context: https://pubmed.ncbi.nlm.nih.gov/32444344/
- Carbohydrate and fat oxidation context: https://pubmed.ncbi.nlm.nih.gov/32747792/
- Traditional anaerobic terminology and interaction: https://pubmed.ncbi.nlm.nih.gov/11547894/

## 12. Owner-Approved Integrated Explanation Direction (2026-09-02)

Every offered session, including BASE, LT, VO2, GLY, ATP-PC, MIX, REC, OFF,
warmup and cooldown, must expose its purpose and an explanation appropriate to its
actual prescription. This approval is product implementation authority, not a
scientific reviewer signature, template-dose adoption, or canonical promotion.

The explanation has three separate owners: this lexicon defines terms; a reviewed
training profile defines the intended stimulus and applicability; the actual plan
defines numbers, selected inputs and placement. Do not infer individual physiology
from a planned intent or substitute a technique benefit for a metabolic purpose.

Required sections are purpose, energy-supply context, work-structure rationale,
recovery rationale, cycle role, expected adaptation/limitations and evidence.
Non-applicable sections state why. REC/OFF and technical or strength activities
must not be forced into a metabolic-pathway label. GLY does not universally imply
complete recovery; the actual recovery duration and mode must be displayed.

Use compact inline purpose, existing short term help and a full session view with
Method / Reason-and-evidence / Cycle-and-records tabs. Easy and professional modes
share the same prescription; professional mode adds detail rather than removing
essential instructions from easy mode. Return navigation restores focus and scroll.

The runtime must distinguish general mechanism, template design intention, and
actually used athlete inputs. No real-time LLM invents efficacy, doses, or reasons.
Raw private notes are not explanation inputs. Scientific sources carry study type,
population, scope limitations and review status; a URL alone is not an approval.

Change ledger: ADD mandatory session explanations and three-layer ownership;
MODIFY generic GLY recovery wording; KEEP existing term IDs, privacy and safety;
DEFER unsupported individual physiological predictions and unreviewed doses.
Open-issue counts above remain unchanged; this section closes no issue.

[DRAFT_COMPLETE]
