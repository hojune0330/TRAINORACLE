# PERSONAL_ORACLE_EXPLANATION_CONTRACT.md

```yaml
document_metadata:
  doc_id: trainoracle-spec-personal-oracle-explanation-v1
  spec_id: PERSONAL_ORACLE_EXPLANATION_CONTRACT
  title: TrainOracle Personal Oracle Explanation Contract
  version: "1.0"
  round: RT1_IMPLEMENTATION_BOUNDARY
  status: DRAFT_FOR_REVIEW
  owner: COACH_HOJUNE
  open_issues_total: 4
  canonical_blocking_count: 3
  executed_tests_total: 0
  production_execution_allowed: false
  canonical_promotion_allowed: false
  final_marker_required: DRAFT_COMPLETE_AT_END
```

---

## 1. Purpose

This draft defines the first deterministic personal Oracle explanation shown inside
Analysis. It summarizes eligible structured facts already available in cumulative
distance, energy-system, and active-plan progress contracts. It does not create a
performance score, training-method compatibility score, medical statement, training
prescription, friend comparison, or automatic adaptation authority.

---

## 2. Eligible Inputs

The V1 explanation may consume only:

1. accepted structured session observations projected through the journal observation
   boundary;
2. explicit eligible distance values within named local-date windows;
3. explicit athlete-selected energy-system classifications within named windows;
4. validated active-plan sessions and separate progress marks;
5. non-sensitive reason codes and source counts produced by those contracts.

Imported values without accepted provenance, malformed or conflicting sources, missing
values, and duplicate conflicts remain excluded according to their source contracts.

---

## 3. Zero-Signal Privacy Boundary

Raw diary text, private memo text, symptom clauses, evidence clauses, profile biography,
email, phone number, name, provider token, and external LLM payloads are forbidden.

The existence, length, edit time, count, category, sentiment, or deletion state of a
`PRIVATE_SELF_ONLY` memo is also forbidden as an Oracle signal. Adding, removing, or
changing a private memo must not change the Oracle output when all eligible structured
facts remain the same.

---

## 4. Deterministic Output

For identical eligible inputs, local date, and formula version, the same output must be
produced. V1 contains three descriptive sections:

| Section | Allowed description | Forbidden interpretation |
|---|---|---|
| Distance flow | eligible recent-four-week distance and prior-four-week comparison | load target, fitness gain, readiness, future mileage |
| Energy coverage | directly selected system counts and most frequent recorded labels | strength, weakness, deficiency, physiological measurement |
| Plan follow-through | planned session count and separate completed progress marks | actual training completion, adherence score, training effect |

The explanation must state its evidence counts, exclusions, and unknowns. Missing input
must stay missing and must not become zero training, a low score, or a negative judgment.

---

## 5. Authority Boundary

The personal Oracle cannot:

- clear or lower `D9_ACTIVE` or `D9_UNKNOWN`;
- bypass RVE or Plan Safety Gate;
- activate a draft training template;
- increase or decrease training intensity, volume, or frequency;
- claim medical clearance, injury probability, fitness gain, or performance prediction;
- publish a profile, diary, plan, or comparison;
- grant coach, guardian, friend, or follower access;
- award points based on distance, speed, intensity, pain concealment, or plan compliance.

---

## 6. Friend And Method Compatibility Separation

Friend comparison, together-running Oracle, and training-method compatibility are not
part of V1. They require separate consent, selected-field, expiry, withdrawal, minor,
blocking, deletion, evidence, and score-meaning contracts. A public profile or share link
is not consent to Oracle comparison.

---

## 7. Open Issues

| Issue ID | Canonical blocking | Status | Required evidence |
|---|---:|---|---|
| `OI-POE-LANGUAGE-REVIEW-001` | NO | OPEN | athlete, coach, minor and accessibility review of Korean explanation copy |
| `OI-POE-PRODUCTION-BROWSER-001` | YES | OPEN | deployed mobile and desktop evidence with missing, partial and established data |
| `OI-POE-FRIEND-CONSENT-001` | YES | OPEN | separate accepted friend comparison consent and data-scope contract |
| `OI-POE-METHOD-COMPATIBILITY-001` | YES | OPEN | accepted method evidence, scoring meaning and activation boundary contract |

No issue is closed by this draft or by local tests.

---

## 8. Required Verification

- no-data, partial-data and descriptive-data outputs remain deterministic;
- imported or unverified values cannot become accepted evidence;
- private memo-shaped properties cannot change or appear in output;
- planned values, progress marks and journal observations remain separate;
- color is not the only meaning carrier;
- the evidence boundary is keyboard and screen-reader reachable;
- narrow mobile widths do not overflow;
- D9, plan generation, template activation, account sharing and reward code remain
  untouched.

[DRAFT_COMPLETE]
