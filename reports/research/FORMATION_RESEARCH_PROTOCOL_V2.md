# Formation Research Protocol V2

```yaml
protocol_id: TO-FORMATION-RESEARCH-V2-2026-07-17
status: FROZEN_FOR_SEARCH
review_label: PRISMA-informed structured review
search_from: database inception
search_through: 2026-07-17
owner_product_identity: 9_5_DAY_FORMATION
canonical_frame: LOCAL_CIVIL_9_DAYS_12_HOURS
owner_target_authority: AUTOMATED_PRESCRIPTION
runtime_authority: false
scientific_optimality: UNKNOWN
scientific_safety: UNKNOWN
medical_authority: false
prescription_activation: false
```

## 1. Decision And Evidence Separation

The owner has fixed 9.5-day Formation as TRAINORACLE's product identity and intended
automated-prescription frame. This is a product decision, not a scientific finding.

The review does not vote on whether to retain the identity. It determines:

1. deterministic inputs and precedence for a 9.5-day candidate;
2. evidence-informed component, spacing, competition, and composite-session constraints;
3. explanation and uncertainty language;
4. conditions that suppress a candidate and require a coach-authored plan;
5. what may never be inferred from elapsed time, load, self-report, or missing data.

Every conclusion records:

```yaml
evidence_status:
  - SUPPORTED
  - CONDITIONALLY_SUPPORTED
  - UNKNOWN
  - NOT_SUPPORTED
permitted_claim:
  - DESCRIPTIVE_ONLY
  - RULE_INPUT_CANDIDATE
  - PROHIBITED
owner_decision: 9_5_DAY_AUTOMATED_PRESCRIPTION_IDENTITY
runtime_authority: false_until_all_named_gates_pass
```

`evidence_status` cannot erase the owner identity. The owner identity cannot upgrade
evidence, establish safety, or bypass a rule-specific gate.

## 2. Target Population And Strata

Primary population: adolescent and young-adult middle-distance runners, with priority on
athletes aged 12-20 and direct evidence for 800 m, 1500 m, or combined 800/1500 m training.

Required strata when reported:

- `800M_PRIORITY | 800_1500_MIXED | 1500M_PRIORITY | OTHER_ENDURANCE`;
- age range and exact study mean/dispersion;
- sex and female representation;
- maturity assessment and growth status; age never substitutes for maturity;
- training age, competitive level, event, and recent performance context;
- preparatory, pre-competition, competition, taper, or transition phase;
- school load, sleep context, recent competition, illness, pain, and health exclusions;
- device, measurement protocol, and source version.

Adult runners, adult endurance athletes, team-sport athletes, untrained participants, and
other modalities can support mechanisms or context only. Missing target-population fields
force a directness downgrade.

## 3. Fixed Research Questions

### RQ-A: 9.5-Day Prescription Mechanics

**Population:** target population plus trained adult runners and endurance athletes as
indirect evidence.

**Exposure:** fixed weekly microcycles, non-weekly microcycles, 9-10-day coaching cycles,
hard-day/easy-day organization, MAIN exposure density, and competition anchoring.

**Comparator:** seven-day organization, other periodization, or within-athlete historical
organization. A no-comparator coaching source may support use-description only.

**Outcomes:** session-spacing conflicts, adherence, plan completion, quality-session
execution, performance, acute recovery, long-term adaptation, competition preparation,
coach workload, athlete comprehension, and no-candidate frequency.

**Decision use:** define deterministic 9.5-day frame mechanics and handoff conditions.
Scientific superiority and safety are not required for identity adoption and remain
separate claims.

### RQ-B: Session-Specific Recovery And Spacing

**Population:** youth runners first; trained runners and relevant athlete studies second.

**Exposure:** running HIIT, sprint, glycolytic, threshold, hill, resistance, plyometric,
combined mechanical-impact sessions, and competition.

**Comparator/time:** pre-session baseline and 1-96-hour follow-up; alternate session types
or recovery intervals when available.

**Outcomes:** running performance, maximal force, power, jump, neuromuscular function,
autonomic markers, soreness, subjective recovery, gait, biochemical markers, and adverse
events. Each outcome remains separate.

**Decision use:** 72 hours is a coach target interval, never recovery, readiness, safety,
pain, illness, or next-MAIN clearance.

### RQ-C: Composite And Concurrent Training

**Population:** target population; youth athletes and trained runners prioritized.

**Intervention:** endurance plus resistance, plyometric, hill, sprint, alternative aerobic,
or mixed training within one session, one day, or adjacent days.

**Comparator:** single-mode training, alternate order, separated sessions, or different
frequency/dose.

**Outcomes:** strength, power, running economy, aerobic capacity, event performance,
acute residual effects, adherence, and adverse events.

**Decision use:** preserve ordered components, units, sequence, separation, and goal. Never
split whole-session RPE proportionally or collapse a composite day into a universal fatigue
number.

### RQ-D: Descriptive Load Components

**Population:** athlete-monitoring studies with runner and youth directness graded.

**Index methods:** duration, distance, elevation, speed/pace, repetitions, RPE/sRPE,
heart-rate methods, named TRIMP, power, device/vendor measures, and contextual facts.

**Reference/comparator:** validated criterion where available, repeated reliability,
within-athlete agreement, or protocol-version continuity.

**Outcomes:** validity, reliability, responsiveness, compatibility, missingness behavior,
deduplication, and interpretability.

**Decision use:** component registry, measure/unit/method provenance, compatible comparison,
parent/leaf accounting, and default denial of unregistered derivations. No readiness,
recovery, fatigue diagnosis, injury risk, or plan clearance.

### RQ-E: Minimum Evidence And Within-Athlete Claims

**Population:** individual athletes and longitudinal athlete-monitoring data; measurement
methodology and single-case designs.

**Exposure/design:** repeated observations, stable or changed protocols, multiple baseline,
prospective hypothesis comparison, interrupted time series, and N-of-1 methods.

**Comparator:** measurement error, individual variability, stable baseline, preregistered
conditions, or model-based counterfactual when justified.

**Outcomes:** reliability, coverage, trend stability, minimum detectable change,
autocorrelation, carryover, confounding, missingness, and false-positive control.

**Decision use:** no universal observation-count or freshness number. Claim ladder:
`OBSERVATION → DESCRIPTIVE_BASELINE → MEASUREMENT_ERROR_EXCEEDING_CHANGE →
PROSPECTIVE_HYPOTHESIS_COMPARISON`. None establishes safety or efficacy automatically.

### RQ-F: Youth Transfer And Pilot Evaluation

**Population:** target population and relevant youth-athlete evidence.

**Exposure:** participant-visible, non-hidden 9.5-day plan generation and explanation.

**Comparator:** current coach-authored plan, not an untreated athlete and not covert
operation.

**Outcomes:** candidate generation, no-candidate behavior, agreement/disagreement with
coach plan, explanation comprehension, input burden, completion, withdrawal, adverse-event
process, and data quality.

**Decision use:** first pilot tests feasibility and observability. It does not establish
effectiveness, safety, or injury prevention.

### RQ-G: Youth Safety Boundary And Handoff

**Population:** youth runners and youth athletes, with sex, maturity, energy availability,
growth, and training context retained.

**Exposure:** growth changes, pain, illness, suspected bone/tendon stress, low energy
availability concerns, sleep disruption, recent competition, and incompatible records.

**Comparator:** accepted consensus/guideline boundary or qualified human assessment, not an
AI-derived diagnosis.

**Outcomes:** stop/referral behavior, non-participation protection, false reassurance,
privacy, and escalation completeness.

**Decision use:** define fail-closed `HUMAN_REVIEW_REQUIRED` conditions. The product does
not diagnose, medically screen, or clear training.

## 4. Information Sources

Core databases when accessible:

- PubMed/MEDLINE;
- SPORTDiscus;
- Scopus;
- Web of Science;
- Cochrane Library.

Supplementary sources:

- backward and forward citation chasing;
- DOI/publisher and PubMed/PMC records;
- consensus statements and reporting/methodology guidance;
- verifiable coaching books, interviews, or elite case reports for the narrow claim of
  practical use, never efficacy or safety;
- trial/protocol registries when a decision-critical intervention has a registry record.

An unavailable database is logged as `ACCESS_UNAVAILABLE`; it is never silently replaced.
The output remains a `PRISMA-informed structured review` unless full database coverage,
independent dual screening, conflict adjudication, and complete accounting are achieved.

## 5. Exact Core Search Blocks

All searches run from database inception through 2026-07-17. English and Korean full texts
are eligible. Other-language records remain in the ledger and are included when a reliable
translation is available; inaccessible full text is recorded, not inferred from its title.

```text
RQ-A: (middle distance OR 800 m OR 1500 m OR distance runner*) AND
      (microcycle OR periodization OR training intensity distribution OR hard day easy day
       OR non-weekly OR 9-day OR 9.5-day OR 10-day)

RQ-B: (runner* OR sprint* OR middle distance OR endurance athlete*) AND
      (recovery time course OR residual fatigue OR neuromuscular recovery OR 24 h OR 48 h
       OR 72 h OR 96 h) AND
      (interval OR HIIT OR sprint OR plyometric OR resistance OR hill OR competition)

RQ-C: (runner* OR youth athlete* OR endurance athlete*) AND
      (concurrent training OR combined training OR complex training) AND
      (sequence OR order OR separation OR interference OR plyometric OR resistance)

RQ-D: (athlete monitoring OR training load OR session RPE OR sRPE OR TRIMP OR external load
       OR internal load) AND
      (validity OR reliability OR agreement OR responsiveness OR provenance OR missing*)

RQ-E: (single athlete OR within-athlete OR n-of-1 OR single-case OR time series OR multiple
       baseline) AND
      (training OR sport performance OR athlete monitoring) AND
      (measurement error OR reliability OR autocorrelation OR carryover OR trend)

RQ-F: (adolescent OR youth) AND (runner* OR middle distance OR endurance athlete*) AND
      (pilot OR feasibility OR acceptability OR monitoring OR decision support)

RQ-G: (youth runner* OR adolescent distance runner* OR youth athlete*) AND
      (injury OR illness OR pain OR bone stress OR tendon OR growth OR maturation OR RED-S
       OR relative energy deficiency OR energy availability OR sleep)
```

Database-specific controlled vocabulary and syntax are saved verbatim in
`FORMATION_SEARCH_LOG.md` before results are interpreted.

## 6. Eligibility

### Include

- primary intervention, prospective, longitudinal, acute recovery, measurement, and
  observational studies relevant to an RQ;
- systematic reviews/meta-analyses with searchable methods;
- consensus statements for youth, health, monitoring, or ethical boundaries;
- single-case/N-of-1 methodology and relevant applied sport studies;
- verifiable coaching-use sources for practical prevalence or rationale only.

### Exclude Or Downgrade

- no identifiable source, protocol, population, or outcome;
- raw opinion used as efficacy or safety evidence;
- one-time correlation promoted to causality, readiness, or injury prediction;
- adult/team-sport findings treated as direct youth middle-distance prescription;
- vendor black-box score without independent method detail;
- incompatible unit or method aggregation;
- abstract-only detail beyond the abstract;
- duplicate publication without unique data;
- retracted evidence. Corrected evidence is re-extracted from the corrected version.

## 7. Screening And Retrieval

1. Deduplicate by DOI, PMID, registry ID, title/year, cohort, and overlapping report.
2. Two independent lanes screen title/abstract and then full text.
3. Decision-critical inclusion/exclusion requires human-trained confirmation.
4. Disagreement uses a recorded third adjudication; consensus is never inferred.
5. Full-text exclusions use one controlled primary reason.
6. Direct youth/middle-distance and contradiction-changing sources receive backward and
   forward citation chasing.
7. Stop after two documented citation-chasing rounds add no eligible direct or
   contradiction-changing evidence, or record why saturation was not reached.

## 8. Extraction And Appraisal

Decision-critical fields are independently double-extracted. Missing values are typed
`NOT_REPORTED | NOT_APPLICABLE | NOT_VERIFIED`.

Risk-of-bias tools:

- randomized trials: RoB 2;
- non-randomized intervention studies: ROBINS-I;
- systematic reviews: AMSTAR 2;
- cross-sectional/cohort/case evidence: design-matched JBI checklist;
- single-case experimental design: RoBiNT plus SCRIBE reporting completeness;
- consensus/guidance: authority, methods transparency, stakeholder range, evidence link,
  and conflict disclosure recorded without converting them to effect estimates.

GRADE domains apply at body-of-evidence/outcome level only. The review also records:

- `youth-middle-distance directness`;
- `whole-architecture directness`;
- outcome and time-horizon compatibility;
- overlap of primary studies across reviews;
- funding, conflicts, correction, and retraction state.

## 9. Claim And Prescription Boundaries

Research lint rejects unqualified claims that 9.5 days, 2-3 MAIN, or 72 hours are:

- optimal, superior, safer, evidence-based as a complete system, or recovery-matched;
- injury-preventing, medically safe, or validated for all adolescents;
- proof of recovery, readiness, or permission for the next MAIN.

Allowed owner/product wording:

- `TRAINORACLE's fixed product design is a 9.5-day Formation frame intended to operate as
  the default automated prescription after runtime activation; runtime authority is currently disabled.`
- `This is the product's coaching framework, not a claim that 9.5 days is universally best.`
- `In a non-authoritative test context, the system generated a preview of the future default
  prescription from the displayed inputs and rules; it is not an active prescription.`
- `In a non-authoritative test context, no candidate was generated because a required fact,
  health-related exclusion or referral input, or rule is unresolved.`

### Final-claim source boundary

`ABSTRACT_ONLY` and `METADATA_ONLY` records may support retrieval, screening, gap description,
or an explicit prohibited/unknown-history note. They may not appear in `supporting_source_ids`
for a final synthesized claim. A final claim must cite at least one `FULL_TEXT_VERIFIED` source
or an explicitly typed owner decision. This is enforced by the synthesis validator.

### Privacy, disclosure, and no-dead-end boundary

- `PREFER_NOT_TO_ANSWER` and `NOT_ASKED` suppress automated candidate generation locally and
  are `SUPPRESS_ONLY_NO_OUTBOUND_DISCLOSURE`. They imply no concern and create no recipient,
  network, audit, or telemetry event.
- A non-emergency human route is a local option until the participant separately confirms the
  exact recipient, fields, purpose, duration/retention, and known withdrawal limits.
- `PRIVATE_SELF_ONLY` content and metadata, including presence, length, time, frequency,
  missingness, topic, sentiment, embedding, and index state, are zero-signal for analysis,
  planning, reward, telemetry, and safety.
- Explicit backup or recipient sharing is a `USER_DIRECTED_FILE_OPERATION`. It does not grant
  analysis consent, standing coach/guardian access, or analytics/reward/Formation events.
- If no approved reviewer or delivery route is configured, use
  `NO_CONFIGURED_REVIEWER_KEEP_CURRENT_PLAN`: keep the current coach-authored plan and local
  journal, show what happened and what remains unchanged, and provide correction, local export,
  later review, and user-controlled sharing without requiring more disclosure.

## 10. Hard Human Gates

Written `APPROVE | REQUEST_CHANGES` decisions are required from:

- youth endurance/sport-science reviewer: RQ-A-D, F/G, transfer wording;
- longitudinal/N-of-1 statistician: RQ-E and all threshold/change claims;
- youth sports-medicine or safeguarding reviewer: RQ-G stop/referral and health non-claims;
- qualified privacy reviewer: any cohort, repeated-query, sharing, or low-cell output;
- human product owner: exact prescription rules, schema/default/runtime activation, and
  user-facing claims.

The owner has already fixed product identity and target authority. Later owner review is
for the exact rule registry and activation evidence, not identity reconsideration.
When an older draft, acceptance note, or deferred-goal document conflicts with a later explicit
owner decision, the latest explicit owner decision governs product direction. The older document
remains historical evidence of its runtime state and cannot reopen the fixed identity.
Unavailable expertise or unresolved requested changes leaves the affected rule unimplemented
and fail-closed.

## 11. Planned Outputs And Change Control

- source, search, exclusion, extraction, and claim ledgers;
- frame/recovery, composite/load, minimum-evidence, youth/pilot, and counterevidence reviews;
- separate Load Components and Minimum Evidence decision packets;
- one-page Korean owner brief plus technical annex;
- executable validators and manual challenge evidence.

This frozen protocol changes only through a dated amendment that records reason, fields,
search impact, owner, and whether screening/extraction must be repeated. Product code,
canonical runtime contracts, participant enrollment, and production activation are outside
this review.

## 12. Dated Amendment 2026-07-17-01

```yaml
amendment_id: TO-FORMATION-RESEARCH-V2-AMEND-2026-07-17-01
recorded_at: 2026-07-17T20:56:07+09:00
owner: COACH_HOJUNE
recorder: CODEX_RESEARCH_PREPARATION
reason: POST_FREEZE_OWNER_PRECEDENCE_PRIVACY_AND_SOURCE_TRACE_CLARIFICATION
changed_fields:
  - latest_owner_decision_precedence
  - abstract_only_final_claim_boundary
  - private_note_analysis_vs_user_directed_transport
  - decline_no_outbound_disclosure
  - reviewer_unavailable_continuity
search_query_impact: NONE
search_date_impact: NONE
eligibility_criteria_impact: NONE
screening_repeat_required: false
extraction_repeat_required: false
synthesis_reaudit_required: true
runtime_authority: false
```

The amendment changes product-governance and claim-trace rules, not RQ-A-G, populations,
exposures, comparators, outcomes, search dates, or eligibility criteria. The 167-source corpus
therefore is not re-searched or re-screened solely for this amendment. Synthesis was re-audited:
seven abstract-only supporting references were removed, the private-note analysis boundary and
user-directed transport exception were split into separate claims, and executable validators
were added. All human screening, extraction, appraisal, expert, privacy, accessibility, and
activation gates remain open.

[PROTOCOL_FROZEN_FOR_SEARCH]
