# TRAINING_METHOD_COMPATIBILITY_CONTRACT.md

```yaml
document_metadata:
  doc_id: trainoracle-spec-training-method-compatibility-v1
  spec_id: TRAINING_METHOD_COMPATIBILITY_CONTRACT
  title: TrainOracle Training Method Compatibility Contract
  version: "1.0"
  round: RT1_OWNER_DIRECTION_IMPLEMENTATION
  status: DRAFT_FOR_REVIEW
  owner: COACH_HOJUNE
  open_issues_total: 3
  canonical_blocking_count: 2
  executed_tests_total: 0
  production_execution_allowed: false
  canonical_promotion_allowed: false
  final_marker_required: DRAFT_COMPLETE_AT_END
```

---

## 1. Purpose

This draft defines a deterministic comparison between one versioned training-method
article and the athlete's eligible structured context. It explains matching conditions,
conflicting conditions, missing data, and the exact facts used. V1 does not produce a
numeric compatibility score because the owner deferred that score in the product master
plan.

---

## 2. Eligible Inputs

V1 may consume only the active plan's exact event, experience band, available-day count,
second-session setting, and accepted explicit energy-system observations from the recent
eight-week ledger. Every method supplies versioned target systems, event scope, experience
scope, minimum schedule scope, and same-day double-quality requirements.

Raw diary text, private memo text or existence, symptoms, pain, sleep, location, contact
data, profile biography, account tokens, and external LLM output are forbidden inputs.

---

## 3. Output And Meaning

The only V1 statuses are `CONTEXT_MATCH`, `PARTIAL_MATCH`, `CONTEXT_MISMATCH`, and
`NOT_ENOUGH_DATA`. Each output contains support statements, conflict statements, unknowns,
and visible evidence labels. Missing data never becomes a negative score.

The output is descriptive context, not evidence that the method caused an adaptation,
will improve performance, is safe for the athlete, or is the best available method.

---

## 4. Authority Boundary

Every launch article remains `NOT_PLAN_ELIGIBLE`. Reading, saving, or comparing a method
cannot activate a template, create a plan, change intensity, volume or frequency, clear
D9 or another safety state, award training-volume points, or publish athlete data.

Repeated recent use of a target system may be shown as a repetition fact. It cannot be
renamed physiological deficiency, overtraining, injury risk, or proof that the method is
ineffective.

---

## 5. Open Issues

| Issue ID | Canonical blocking | Status | Required evidence |
|---|---:|---|---|
| `OI-TMC-EDITORIAL-001` | NO | OPEN | athlete, coach, minor and accessibility copy review |
| `OI-TMC-METHOD-ACTIVATION-001` | YES | OPEN | separate accepted template and exact athlete eligibility authority |
| `OI-TMC-PRODUCTION-001` | YES | OPEN | deployed mobile and desktop evidence for missing, partial, matching and conflicting contexts |

No issue is closed by this draft or by local tests.

---

## 6. Required Verification

- identical eligible inputs produce identical output;
- private memo changes produce zero output change;
- no-data remains missing and contains no score;
- a same-day double-quality method exposes the current runtime limitation;
- repeated target-system history is visible without automatic prescription;
- the explanation is keyboard and screen-reader reachable and fits 320 px width;
- plan generation, D9, account sharing, and point code remain untouched.

[DRAFT_COMPLETE]
