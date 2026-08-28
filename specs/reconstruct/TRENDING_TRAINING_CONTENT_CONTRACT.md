# TRENDING_TRAINING_CONTENT_CONTRACT.md

```yaml
document_metadata:
  doc_id: trainoracle-spec-trending-training-content-v1
  spec_id: TRENDING_TRAINING_CONTENT_CONTRACT
  title: TrainOracle Trending Training Content Contract
  version: "1.0"
  round: RT1_IMPLEMENTATION_BOUNDARY
  status: DRAFT_FOR_REVIEW
  owner: COACH_HOJUNE
  open_issues_total: 4
  canonical_blocking_count: 2
  executed_tests_total: 0
  production_execution_allowed: false
  canonical_promotion_allowed: false
  final_marker_required: DRAFT_COMPLETE_AT_END
```

---

## 1. Purpose

This draft defines a read-only content surface for training methods, public athlete
examples, and current discussion topics. It helps a runner understand what a method
name means and why copying a famous programme is not a personal prescription.

The content catalog is not the Template Library, Plan Generator, research acceptance
authority, medical guidance, or training-method compatibility score.

---

## 2. Required Content Fields

Every published item must preserve:

- a stable content ID and category;
- a plain-language title and summary;
- why the method or case is discussed;
- what training purpose it is commonly associated with;
- a visible transfer and use boundary;
- source label, URL, source grade, and source review state;
- explicit plan eligibility.

V1 supports `DIRECT_SOURCE_REOPENED` and `DISCOVERY_SOURCE_ONLY`. The latter must be
visibly labelled as requiring more review. Both remain `NOT_PLAN_ELIGIBLE` in V1.

---

## 3. Runtime Boundary

Reading, opening, saving, or sharing a content item cannot:

- activate a detailed training template;
- set repetitions, distance, pace, recovery, intensity, volume, or frequency;
- create or alter a training plan;
- clear D9 or Safety Gate state;
- create a medical, readiness, strength, weakness, or compatibility judgment;
- grant friend, coach, guardian, follower, or public access;
- transmit private diary, memo, pain, sleep, location, contact, or account data.

Named-athlete examples remain attributed cases. Their weekly distance, double sessions,
pace, recovery and taper cannot be copied into another athlete's plan.

---

## 4. Local Save And Reward Boundary

V1 may store only a set of known content IDs as a device-local bookmark. Unknown IDs
fail closed. The bookmark contains no athlete data and is not synchronized or published.

The owner has approved a future first-completion reward concept but has deferred how
content points combine with existing visit and journal points. Therefore V1 awards zero
content points and does not create a completion ledger. Reaching an article, opening a
source link, scrolling, refreshing, or saving cannot award points.

---

## 5. Initial Content Scope

The initial catalog contains three bounded explanations:

1. Norwegian double-threshold as a discovery-level media topic;
2. cruise intervals as a reopened technical explanation;
3. an observed elite marathon week as a context case that must not be copied.

No item is a universal recommendation. Dedicated sprint events remain outside the
current plan-generation scope, and this content surface does not change that boundary.

---

## 6. Open Issues

| Issue ID | Canonical blocking | Status | Required evidence |
|---|---:|---|---|
| `OI-TTC-EDITORIAL-REVIEW-001` | NO | OPEN | Korean runner, coach and minor editorial review |
| `OI-TTC-COMPLETION-REWARD-001` | YES | OPEN | owner-approved point merge, anti-replay and completion-event contract |
| `OI-TTC-METHOD-ACTIVATION-001` | YES | OPEN | exact accepted template and athlete eligibility mapping per method |
| `OI-TTC-OPERATIONS-001` | NO | OPEN | content update, withdrawal, broken-source and correction procedure |

No issue is closed by this draft or by local tests.

---

## 7. Required Verification

- all catalog IDs are unique and every URL uses HTTPS;
- every launch item remains `NOT_PLAN_ELIGIBLE`;
- discovery-only sources are visibly distinguished from reopened sources;
- unknown saved IDs are ignored;
- saving creates no point, plan, safety, journal or account state;
- source links open explicitly and do not embed athlete data;
- list and article views work at 320 and 375 pixel widths, keyboard and screen reader;
- the existing five-tab navigation stays unchanged until the separate navigation gate.

[DRAFT_COMPLETE]
