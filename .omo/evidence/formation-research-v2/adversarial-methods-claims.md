# Independent Adversarial Methods And Load-Claim Review

```yaml
artifact_id: TO-FRV2-ADVERSARIAL-METHODS-CLAIMS-2026-07-17
review_lane: INDEPENDENT_AI_ADVERSARIAL_METHODS
scope: RQ-D | RQ-E | RQ-F
canonical_edits: false
human_confirmation: PENDING
owner_product_identity: 9_5_DAY_FORMATION
owner_target_authority: DEFAULT_AUTOMATED_PRESCRIPTION
runtime_authority: false_until_all_named_gates_pass
scientific_optimality: UNKNOWN
scientific_safety: UNKNOWN
private_self_only_signal: ZERO
```

## 1. Bottom Line

The fixed 9.5-day Formation identity is not under review here. The evidence below governs
what data and claims may enter its candidate-generation, explanation, and pilot-evaluation
lanes. It does not vote on the identity and does not activate runtime prescription.

The adversarial result is:

1. sRPE, named TRIMP methods, external work, and biomechanical load are not one currency.
2. A whole-session sRPE cannot be apportioned to composite-session components by convenience.
3. ACWR has no supported green, amber, red, safe, risk, readiness, or plan-action zone.
4. There is no universal minimum observation count, baseline length, or freshness interval.
5. A wearable observation or vendor score is not athlete readiness or training clearance.
6. An observational within-athlete series does not establish that a plan caused an outcome.
7. A first Formation pilot can test feasibility and observability, not efficacy or safety.

These are output boundaries, not reasons to replace 9.5 days with another cycle. If required
registered inputs are missing, incompatible, unverified, or excluded by a human-review state,
the eligible output is `NO_AUTOMATED_PLAN -> KEEP_CURRENT_COACH_AUTHORED_PLAN`, not a newly
invented exception plan or a different automatic frame.

## 2. Claim-By-Claim Adversarial Review

### M-01: sRPE And TRIMP Are Equivalent Load Units

**Strongest apparent support**

- `FRV2-D-003` (Foster et al., PMID `11708692`) found consistent relationships between
  whole-session sRPE and an HR-based method across selected exercise types.
- `FRV2-D-008` (Manzi et al., PMID `19812506`) found individualized TRIMP associated with
  performance-related changes in eight adult distance runners.
- `FRV2-D-010` (Dai et al., PMID `40646576`) reported a strong sRPE-TRIMP relationship in a
  specific rowing ergometer protocol.

**Strongest opposition or disconfirmation**

- `FRV2-D-003` also reported different absolute values; relationship is not agreement.
- `FRV2-D-004` / canonical `SRC-PMID-30160557` found adolescent-runner sRPE changed materially
  with collection timing, so timing is part of the method identity.
- `FRV2-D-009` (PMID `41758294`) found only modest or weak relationships among sRPE, HR-TRIMP,
  and biomechanical cumulative load in 12 adult runners and different session discrimination.
- `FRV2-D-010` found the sRPE-TRIMP relationship changed sharply by rowing modality.

**Method limits**

- Correlation does not show numerical agreement, interchangeability, conversion, or common
  physiological meaning.
- Each method responds to a different construct and depends on prompt, scale, timing, duration,
  HR weighting, individual thresholds, modality, and protocol.
- The most direct youth-running evidence is small, short, maturity-unresolved, and validates a
  named sRPE protocol only. It does not validate a universal load unit.

```yaml
evidence_status: NOT_SUPPORTED
permitted_claim: DESCRIPTIVE_ONLY
youth_middle_distance_directness: LIMITED_FOR_SRPE_PROTOCOL; ABSENT_FOR_EQUIVALENCE
whole_architecture_directness: ABSENT
```

**Permitted output**

- Store and display each registered measure separately with family, units, method/version,
  timing, source inputs, and device/protocol lineage.
- User-facing example: "This is how hard the whole session felt on the selected scale."
- Comparable historical display is allowed only within the same compatible protocol.

**Forbidden output**

- Cross-method conversion tables, a summed arbitrary-unit total, or a universal fatigue score.
- Any statement that a value proves readiness, recovery, adaptation, safety, injury risk, or
  permission for the next MAIN session.

**Required gates:** youth endurance/sport-science reviewer for registry meaning and transfer;
statistician for any agreement or calibration study; privacy reviewer for device/linkage scope;
product owner for schema, default display, and wording.

### M-02: A Whole-Session sRPE Can Be Split Proportionally Across Components

**Strongest apparent support**

- `NOT_FOUND`. The bounded composite-load search found methods for whole-session sRPE and
  separately observed differential/component perceptions, but no validated rule that divides
  one global session value across running, resistance, plyometric, hill, or recovery leaves.
- Proportional splitting is computationally convenient. Convenience is not supporting evidence.

**Strongest opposition**

- `FRV2-D-003`, `FRV2-D-004` / `SRC-PMID-30160557`, and `FRV2-D-007` define or evaluate sRPE as
  a whole-session construct under a named prompt/timing protocol.
- `FRV2-D-009` and `FRV2-D-010` show that perceptual, HR-derived, biomechanical, and
  modality-specific responses do not scale together predictably.
- `FRV2-D-017` (W3C PROV-O) supports explicit derivation lineage; it does not supply a
  physiological allocation rule.

**Method limits**

- Time share, distance share, or arbitrary coach weighting does not establish each component's
  internal response.
- A separately prompted component RPE is a new observation with its own timestamp and protocol,
  not a fraction of the global observation.
- Parent/leaf deduplication is an accounting invariant, not a physiological truth.

```yaml
evidence_status: NOT_SUPPORTED
permitted_claim: PROHIBITED_FOR_DERIVATION
youth_middle_distance_directness: ABSENT_FOR_SPLIT
whole_architecture_directness: ABSENT_FOR_SPLIT
```

**Permitted output**

- Keep global sRPE on the parent session. Preserve leaf order, mode, duration, distance,
  repetitions, weight, separation, and goal as independently observed facts.
- Use a separately collected leaf value only when a frozen component protocol produced it.
- Enforce `parent_or_leaves_never_both_for_the_same_observation` to prevent double counting.

**Forbidden output**

- `global_sRPE * component_duration_share`, or any equivalent silent allocation.
- Recombining leaf estimates and the parent global value in one total.
- Calling a composite-day sum "total fatigue" or using it to clear/reject a MAIN session.

**Required gates:** youth endurance/sport-science reviewer, load-method statistician, and product
owner. Privacy review is required if component inference uses linked personal/device streams.

### M-03: ACWR Provides Safe, Risk, Or Plan-Action Zones

**Strongest affirmative source**

- `FRV2-D-021` (Gabbett 2016, PMID `26758673`) provides the main narrative rationale and an
  approximate "sweet spot" from mostly indirect team-sport evidence. It is a narrative/model
  paper, not a causal intervention validation of the proposed bands.

**Strongest opposition and null evidence**

- `FRV2-D-018` / canonical `SRC-PMID-32502973` identifies ratio, ambiguity, direction, and
  causal-interpretation problems and rejects injury-reduction recommendations from ACWR evidence.
- `FRV2-D-019` shows coupling can create artifacts in simulated data; `FRV2-D-020` finds the
  coupled/uncoupled difference can be small in two elite datasets. Together they show that the
  calculation choice must remain visible, not that one hidden method is universally correct.
- `FRV2-D-022` / canonical `SRC-PMID-34052983` found an inverse association in adult runners.
- `FRV2-D-023` found no benefit from one ACWR load-management intervention in 482 U19 football
  players.
- `FRV2-D-024` found materially different classifications across running-load calculations.

**Method limits**

- Window length, weighting, coupling, missing-day handling, zero denominator, units, exposure
  definition, and threshold change the output.
- Observational injury associations do not show that changing the ratio changes injury risk.
- Runner, youth football, and team-sport evidence cannot be fused into a youth middle-distance
  action band.

```yaml
evidence_status: NOT_SUPPORTED_FOR_ZONE_OR_ACTION
permitted_claim: DESCRIPTIVE_ONLY_IF_EXPLICITLY_REQUESTED; DEFAULT_OFF
youth_middle_distance_directness: ABSENT
whole_architecture_directness: ABSENT
```

**Permitted output**

- At most, an expert-requested named numeric ratio beside its compatible raw numerator and
  denominator, with complete method/version fields and no color semantics.
- User-facing wording must say it is a calculation of two recorded periods, not a body state.

**Forbidden output**

- Green/amber/red, sweet spot, danger, safe, optimal, injury-risk, readiness, or clearance labels.
- Any automatic plan increase, reduction, suppression, or 9.5-day candidate decision from ACWR.

**Required gates:** longitudinal/statistical reviewer for any ratio implementation; youth
endurance/sport-science reviewer for meaning; privacy reviewer for repeated linked records;
product owner for even a descriptive opt-in display. No current gate is satisfied by this memo.

### M-04: One Universal Minimum n Or Freshness Window Can Govern All Metrics

**Strongest apparent support**

- `FRV2-E-015` cites design-specific WWC single-case standards using three or five phase points.
- `FRV2-E-024` / canonical `SRC-PMID-38662890` uses five biweekly sessions in a four-athlete CMJ
  example.
- These counts are requirements or design details inside narrow methods, not transferable
  athlete-baseline or freshness laws.

**Strongest opposition**

- `FRV2-E-001`, `FRV2-E-003`, and canonical `SRC-PMID-28054257` require metric-, protocol-,
  population-, and intended-use-specific validity, reliability, error, and responsiveness.
- `FRV2-E-016` finds baseline-length rules depend on the design, trend, variability, analysis,
  and target error behavior.
- `FRV2-E-017` shows serial correlation changes uncertainty and invalidates ordinary independent
  tests as a default.
- `FRV2-E-018` concludes SCED adequacy cannot be reduced to an observation count.

**Method limits**

- Observation cadence, time scale, expected variability, measurement error, missingness,
  protocol drift, seasonality, and the claim tier differ by metric.
- "Recent" is not one physiological construct. A current pain response, a device-derived pace,
  a race result, and a test-retest error estimate age differently.

```yaml
evidence_status: NOT_SUPPORTED
permitted_claim: RULE_INPUT_CANDIDATE_ONLY_AFTER_METRIC_SPECIFIC_VALIDATION
youth_middle_distance_directness: LIMITED_TO_CONTEXTUAL_MONITORING
whole_architecture_directness: ABSENT
```

**Permitted output**

- `OBSERVATION`: one valid timestamped observation with protocol and quality state.
- `DESCRIPTIVE_BASELINE`: a plainly stated distribution/trend over the represented compatible
  period with count, span, cadence, coverage, missingness, and protocol continuity visible.
- Metric-specific freshness may later be registered with justification and versioning.

**Forbidden output**

- Hard-coding "3 records," "5 records," "7 days," or any universal age limit as proof that an
  athlete baseline, change, or prescription input is valid.
- Treating stale, missing, incompatible, or imputed data as zero or current.

**Required gates:** longitudinal/N-of-1 statistician for every count/freshness/change threshold;
sports-science reviewer for metric relevance; privacy reviewer for longitudinal linkage and
low-cell output; product owner for default and user wording.

### M-05: A Wearable Or Multi-Marker Score Establishes Readiness

**Strongest apparent support**

- `FRV2-D-011` to `FRV2-D-014` show that some devices can measure some outcomes with useful
  validity under specific models, activities, environments, and protocols.
- `FRV2-E-022` finds subjective measures can be sensitive to training response. Sensitivity or
  association is not readiness validation.

**Strongest opposition**

- `FRV2-D-011` to `FRV2-D-014` also show outcome-, model-, activity-, environment-, and
  algorithm-dependent error; a device can perform differently for HR, distance, and energy.
- `FRV2-E-021` reports that no single definitive fatigue marker exists and that evidence for
  many markers is limited.
- `FRV2-E-022` shows subjective and objective streams often disagree. Discordance is information,
  not a defect to hide inside a score.

**Method limits**

- A valid HR observation does not validate vendor energy expenditure, sleep, recovery, or a
  proprietary readiness score from the same device.
- Firmware and algorithms change. Black-box weights, missingness, population transfer, and
  threshold derivation cannot be independently audited.
- No source directly validates a wearable readiness score for automated 9.5-day prescription in
  adolescent 800/1500 m athletes.

```yaml
evidence_status: NOT_SUPPORTED_FOR_READINESS
permitted_claim: DESCRIPTIVE_ONLY_FOR_REGISTERED_MEASURES
youth_middle_distance_directness: ABSENT_FOR_READINESS
whole_architecture_directness: ABSENT
```

**Permitted output**

- "The registered device recorded this value under this protocol," with model, outcome,
  firmware/algorithm when available, activity context, timestamp, quality, and missingness.
- Keep subjective and objective measures side by side. Show disagreement and uncertainty.

**Forbidden output**

- Vendor or product-generated readiness, recovered, fatigued, safe, injury-risk, or train-now
  score; hidden fusion weights; substituting one device outcome for another.
- Using an attractive color, ring, or percentage that users could reasonably read as clearance.

**Required gates:** device/outcome-specific sports-science review; statistician for calibration;
qualified privacy review for imports, linkage, retention, and sharing; safeguarding review for
health-adjacent wording; product owner for display and plan use.

### M-06: Observational N-of-1 Data Establish That The Plan Caused The Outcome

**Strongest support for a narrower causal lane**

- `FRV2-E-012` / canonical `SRC-PMID-25976398`, `FRV2-E-013`, `FRV2-E-017`, and
  `FRV2-E-019` show that a prospectively specified, randomized/counterbalanced, repeatedly
  measured N-of-1 design can support a bounded within-person condition comparison when trend,
  serial correlation, onset, carryover, missingness, and analysis are handled.
- `FRV2-E-023` and `FRV2-E-025` / canonical `SRC-PMID-40566441` show sport-specific interest or
  application. They do not validate Formation or a universal design.

**Strongest opposition to observational causality**

- `FRV2-E-007`, `FRV2-E-008`, and `FRV2-E-009` separate measurement error, biological
  variability, ordinary within-person variation, and repeatability from intervention response.
- `FRV2-E-013` emphasizes onset and carryover; cumulative training adaptation may be the desired
  effect and may not be washable without changing the question.
- `FRV2-E-016` to `FRV2-E-019` show that baseline trend, autocorrelation, randomization,
  repeated demonstrations, and design fit matter. More diary points alone do not create a trial.

**Method limits**

- Historical logs confound training with maturation, school load, sleep, illness, pain,
  competition, environment, concurrent sessions, equipment, motivation, and regression to the
  mean.
- One pre/post episode cannot establish a stable responder phenotype. A change above measurement
  error still does not identify its cause or prove practical importance.
- A level-4 result is specific to the athlete, version, contrast, outcome, and observation period.
  It does not generalize automatically or establish medical safety.

```yaml
evidence_status: NOT_SUPPORTED_FOR_OBSERVATIONAL_CAUSALITY
permitted_claim: DESCRIPTIVE_ONLY_UNLESS_PROSPECTIVE_LEVEL_4_GATES_PASS
youth_middle_distance_directness: ABSENT_FOR_FORMATION_CAUSALITY
whole_architecture_directness: ABSENT
```

**Permitted output**

- Preserve the claim ladder exactly: `OBSERVATION -> DESCRIPTIVE_BASELINE ->
  MEASUREMENT_ERROR_EXCEEDING_CHANGE -> PROSPECTIVE_HYPOTHESIS_COMPARISON`.
- Observational history may generate a prospective hypothesis and show transparent patterns.
- Even level 4 wording must name the planned contrast, athlete, outcome, period, uncertainty,
  deviations, and unresolved carryover/confounding.

**Forbidden output**

- "9.5 days caused the improvement," "this athlete is a responder," or an automatic plan rule
  learned from an uncontrolled historical association.
- Causal, efficacy, adaptation, injury, safety, diagnosis, or clearance language at levels 1-3.

**Required gates:** longitudinal/N-of-1 statistician for design and analysis; youth
endurance/sport-science reviewer for outcome and transfer; privacy reviewer for repeated personal
records; safeguarding reviewer for health-adjacent fields; product owner for experimentation and
user-facing interpretation.

### M-07: A First Formation Pilot Establishes Efficacy Or Safety

**Strongest support for a narrower feasibility claim**

- `FRV2-F-001` is direct adolescent athletics co-creation evidence for measuring burden,
  comprehension, usefulness, and record completion.
- `FRV2-F-002`, `FRV2-F-004`, and `FRV2-F-005` show that wearable/app feasibility, ease,
  adherence, technical friction, and sustained engagement are separate outcomes.
- `FRV2-F-008` and `FRV2-F-009` define feasibility and pilot questions around whether and how a
  future process can be performed. They do not provide universal progression thresholds.

**Strongest opposition to efficacy or safety interpretation**

- No located source directly tested participant-visible automated 9.5-day middle-distance
  prescription against a coach-authored plan in athletes aged 12-20.
- `FRV2-F-004` and `FRV2-F-005` show that reported ease or initial acceptance can diverge from
  actual sustained use.
- `FRV2-F-015` and `FRV2-F-016` require phase logic, repeated measures, fidelity, analysis,
  stop reasons, and carryover treatment for a future single-case effect claim; the first pilot is
  explicitly `NOT_A_SCED`.
- Coach agreement is descriptive. Neither agreement, completion, nor absence of an observed
  adverse event proves correctness, benefit, injury prevention, or safety.

**Method limits**

- The direct youth sources concern monitoring or activity-tracker use, not Formation efficacy.
- Small visible parallel comparison cannot separate training effects from the executed
  coach-authored plan, maturation, season, competition, and other concurrent exposure.
- Under-16 and South Korea-specific assent, guardian permission, withdrawal, data governance,
  and recruitment requirements remain local expert questions.

```yaml
evidence_status: CONDITIONALLY_SUPPORTED_FOR_FEASIBILITY_ONLY
permitted_claim: DESCRIPTIVE_PROCESS_OUTCOMES_ONLY
youth_middle_distance_directness: LIMITED_FOR_USER_BURDEN; ABSENT_FOR_EFFECT_OR_SAFETY
whole_architecture_directness: ABSENT
```

**Permitted output**

- Participant-visible parallel comparison: freeze the coach plan first, then show the candidate
  and explanation without changing the executed plan.
- Report candidate/no-candidate/technical-failure/handoff states, field-level agreement and
  disagreement, teach-back comprehension, time and abandonment, completion, missingness,
  withdrawal, process events, notification and acknowledgement, and version fidelity.
- Tell the athlete plainly what was used, what was not used, why the result appeared, what is
  uncertain, and that the coach remains authoritative.

**Forbidden output**

- Performance, adaptation, efficacy, safety, injury-prevention, health-benefit, or scientific
  validation claims from this pilot.
- Calling coach agreement "accuracy," non-withdrawal "acceptance," or no observed event "safe."
- Covert operation, penalty for withdrawal, or recruitment without the applicable local review.

**Required gates:** local ethics/legal determination; youth safeguarding reviewer; youth
endurance/sport-science reviewer; statistician for any future effect design; privacy reviewer for
consent, linkage, export/share, retention, and withdrawal; product owner last.

## 3. Private-Note Zero-Signal Boundary

`PRIVATE_SELF_ONLY` is outside every method above. Zero-signal means the system does not use raw
text **or metadata-derived proxies** for prescription, research, safety, engagement, rewards, or
analytics. Prohibited derivatives include presence/absence, character or token count, entry time,
frequency, sentiment, topic, embedding, keyword, streak, missingness, and cross-record linkage.

An athlete's explicit choice to export or share a private note is a user-controlled transport
action. It does not reclassify the note as a training-analysis input. A note selected as an
analysis-eligible training note must follow the separate consent/purpose contract; private-note
content cannot be silently copied, summarized, or inferred into that lane.

This boundary is especially important in the user experience: the private-note screen must not
display "used for personalization," readiness, progress, or contribution language. Export/share
choice and analysis permission are separate controls and must not be visually conflated.

## 4. Cross-Claim Leakage Tests

| Observed result | Tempting but invalid inference | Required user-facing boundary |
|---|---|---|
| sRPE correlated with TRIMP | The two values are interchangeable | "Separate measures; no conversion" |
| Change exceeded MDC/error | The plan caused a meaningful benefit | "Change exceeded this error model; cause and importance unresolved" |
| Wearable HR was accurate in one protocol | The wearable knows readiness | "This device measured this outcome; no readiness or clearance" |
| Several compatible observations exist | The baseline is automatically sufficient | Show count, span, coverage, protocol, and unresolved sufficiency |
| ACWR is inside a proposed band | Training is safe | No band, color, risk word, or action |
| Coach and candidate agree | Candidate is correct or effective | "Agreement on listed plan fields only" |
| Athlete completed the pilot | Product is acceptable or effective | Show completion separately from burden, comprehension, and usefulness |
| No event was observed | The system is safe | "No event recorded in this pilot; safety not established" |
| A 9.5-day candidate is produced | 9.5 days is scientifically optimal | "TRAINORACLE's fixed frame; evidence and uncertainty remain separate" |

## 5. Gate And Implementation Disposition

| Area | Current disposition | Human gate that cannot be replaced by AI |
|---|---|---|
| Typed load registry and same-method display | `CANDIDATE_FOR_REVIEW` | Youth endurance/sport-science reviewer + owner |
| Cross-method conversion or global load score | `PROHIBITED` | New direct validation, statistician, sport-science reviewer, owner |
| Parent sRPE plus ordered leaf facts | `CANDIDATE_FOR_REVIEW` | Sport-science reviewer + owner |
| Proportional component sRPE split | `PROHIBITED` | Separately validated component protocol and all relevant gates |
| ACWR zones or plan action | `PROHIBITED` | Current evidence cannot be cured by owner preference alone |
| Metric-specific baseline/freshness rule | `UNIMPLEMENTED` | Statistician + sport-science reviewer + privacy reviewer + owner |
| Wearable registered raw outcome | `CANDIDATE_FOR_REVIEW` | Device/outcome evidence + privacy + sport-science + owner |
| Wearable readiness/clearance | `PROHIBITED` | No direct eligible validation located |
| Observational N-of-1 description | `CANDIDATE_FOR_REVIEW` | Privacy + statistics wording + owner |
| Prospective level-4 comparison | `UNIMPLEMENTED` | Frozen protocol + statistician + ethics/privacy/safeguarding + owner |
| Participant-visible feasibility pilot | `UNIMPLEMENTED` | Local ethics/legal + safeguarding + privacy + sport science + owner |
| Pilot efficacy or safety claim | `PROHIBITED` | Requires a later fit-for-purpose effect/safety design, not this pilot |

## 6. Independent Reviewer Decision

```yaml
decision: REQUEST_CHANGES_BEFORE_ANY_RUNTIME_RULE
reason:
  - source screening and extraction still require human confirmation
  - no universal equivalence, split, zone, minimum-n, freshness, or readiness rule survives
  - causal and safety language must remain outside observational and first-pilot outputs
  - every user-visible metric needs construct-specific plain-language non-claim wording
identity_effect: NONE
runtime_effect: KEEP_FALSE
```

The 9.5-day automated-prescription target remains the fixed TRAINORACLE identity. This review
requires the product to explain its evidence honestly, preserve user control, and fail closed
when the inputs do not support an eligible candidate. It does not authorize any canonical,
schema, app, pilot, or runtime change.
