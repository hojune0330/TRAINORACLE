# TRAINORACLE Formation Follow-up Deep Research Plan

## TL;DR

Run a high-accuracy, source-audited evidence program before any Formation implementation.
The program separates seven research questions, collects supporting and opposing evidence,
grades youth and whole-architecture directness, and produces two independent owner decision
packets: `Load Components` and `Minimum Evidence`. The owner has fixed 9.5-day Formation as
the product identity and automated-prescription target. This plan does not fabricate
scientific optimality, recruit an athlete, or open runtime authority before its gates.

## Current Baseline

```yaml
base_commit: 0bc9f3e133bbb057de36b0bce5ef0794398bdc7a
source_pr: 80
existing_research_boundary: ACCEPT_RESEARCH_BOUNDARY_ONLY
load_component_plan: READY_FOR_OWNER_APPROVAL_REQUIRES_HIGH_ACCURACY_RESEARCH
minimum_evidence_plan: READY_FOR_OWNER_APPROVAL_REQUIRES_HIGH_ACCURACY_RESEARCH
strict_acceptance: 0/6
approved_p1_decisions: 0/10
runtime_authority: false
planning_scope: RESEARCH_ONLY
owner_product_identity: 9_5_DAY_FORMATION
owner_target_authority: DEFAULT_AUTOMATED_PRESCRIPTION
```

## Objective

Operationalize the owner's fixed 9.5-day Formation identity as a transparent, testable
automated-prescription target. The canonical frame is `LOCAL_CIVIL_9_DAYS_12_HOURS` with
2-3 MAIN exposures, structured support/recovery blocks, and competition anchoring. Research
must determine inputs, ordering, load representation, explanation, exception, stop, and
human-handoff rules without claiming that 9.5 days is scientifically optimal or safe.

## Fixed Research Questions

| ID | Question | Current state |
|---|---|---|
| RQ-A | Fixed-week limitations and deterministic 9.5-day prescription mechanics | Scientific superiority `UNKNOWN`; owner target `AUTOMATED_PRESCRIPTION` |
| RQ-B | Session-specific recovery interval | Evidence `UNKNOWN`; elapsed/target description only, never clearance |
| RQ-C | Composite/concurrent component order and interference | Component evidence exists; architecture evidence absent |
| RQ-D | Descriptive load accounting without false fatigue | Descriptive boundary accepted; registry unapproved |
| RQ-E | Minimum evidence for within-athlete interpretation | Universal `n` and freshness threshold absent |
| RQ-F | Youth transfer and pilot evaluation design | Feasibility/observability only |
| RQ-G | Youth safety boundary and athlete/event stratification | Human referral boundary; no medical inference |

## Global Guardrails

- `9.5일 Formation` is the fixed owner product identity and target prescription frame.
  Indirect component studies never create scientific optimality or safety for the whole system.
- Latest explicit owner decisions govern product direction. Conflicting older drafts,
  acceptance notes, or deferred-goal documents are historical runtime-state records and must
  be patched or marked superseded; they do not create a new open product decision.
- A 5-day, 12-13-day, or other frame is not a peer option or automatic recommendation. When
  9.5-day rules cannot produce an eligible candidate, the system fails closed to a coach-authored plan.
- Research must separately verify claims that 9- or 10-day cycles are commonly used. The
  result changes explanation and confidence, not the owner's product identity.
- Research lint rejects `optimal`, `superior`, `safer`, `evidence-based`,
  `recovery-matched`, performance-benefit, health-benefit, and injury-prevention claims
  attached to 9.5 days, 2-3 MAIN, or 72 hours unless an exact narrower claim is explicitly
  reviewed. The 9.5-day default identity is fixed, while its exact versioned schema and
  runtime rule registry remain unimplemented until their named gates pass.
- Separate acute recovery, long-term adaptation, performance, health, adherence, and
  measurement outcomes. Recovery of one marker never means complete recovery.
- Separate `800m 중심`, `800/1500m 혼합`, and `1500m 중심`; record sex, maturity,
  training age, training status, and season when available. Never infer maturity from age.
- Separate internal load, external work, derived measures, and context. Never sum
  incompatible units or promote a descriptive value to fatigue, readiness, injury risk,
  recovery completion, safety, or plan authority.
- `PRIVATE_SELF_ONLY` stays zero-signal and raw training-note text stays out of statistics.
- No ACWR safe/risk zone, hidden imputation, missing-as-zero, vendor black-box readiness,
  causal injury claim, peer ranking, or automatic plan change.
- No actual athlete enrollment, shadow operation, Formation persistence, app route, backend,
  schema migration, or runtime activation in this research plan.
- AI may prepare evidence and contradictions. A named sports-science reviewer, sports
  statistician, youth/clinical safeguarding reviewer, and qualified privacy reviewer retain
  their respective acceptance authority.

## Evidence Standard

- Default label is `PRISMA-informed structured review`. Upgrade the label only if required
  database coverage, exact reproducible logs, independent dual screening, conflict
  adjudication, and complete inclusion/exclusion accounting actually exist.
- Prefer primary studies and systematic reviews/meta-analyses; use consensus statements for
  safeguards and methodology papers for inference boundaries. Label narrative reviews and
  cases separately.
- Grade each claim with risk of bias, inconsistency, imprecision, indirectness, and
  publication bias, plus two TRAINORACLE-specific axes: `youth-middle-distance directness`
  and `whole-architecture directness`.
- Extract the exact population, sex, maturity proxy, event, training status, intervention,
  comparator, component dose/order, recovery interval, outcome, time horizon, missingness,
  adverse events, effect estimate, uncertainty, and limitations.
- Retraction/correction status, DOI/PMID identity, duplicate cohorts, shared review source
  studies, funding, and conflicts must be audited before a claim enters synthesis.
- Meta-analysis is allowed only when populations, interventions, outcomes, and time horizons
  are sufficiently compatible and a statistician approves the model. Otherwise synthesize
  narratively with explicit direction and certainty.
- Every conclusion has independent `evidence_status` and `permitted_claim` fields. The fixed
  `owner_target_authority = AUTOMATED_PRESCRIPTION` does not imply current runtime authority;
  prescription remains off until the exact research, safety, privacy, and owner gates pass.
- Seed summaries and abstracts are search hypotheses only. A source cannot support a final
  conclusion until full text, effect/interval, limitations, overlapping cohorts/reviews,
  funding/conflict, and correction/retraction state are verified.

## Hard Human Gates

| Gate | Scope | Required decision |
|---|---|---|
| Youth endurance/sport-science reviewer | RQ-A-D, RQ-F/G, transfer language | `APPROVE | REQUEST_CHANGES` |
| Longitudinal/N-of-1 statistician | RQ-E, all observation/freshness/change thresholds | `APPROVE | REQUEST_CHANGES` |
| Youth sports-medicine or safeguarding reviewer | RQ-G stop/referral and health non-claims | `APPROVE | REQUEST_CHANGES` |
| Qualified privacy reviewer | any cohort, repeated-query, sharing, or low-cell output | `APPROVE | REQUEST_CHANGES` |
| Human product owner | any schema, default, runtime, user-facing claim, or pilot activation | `APPROVE | REQUEST_CHANGES` |

Unavailable expertise, disagreement, or unaddressed requested changes leaves the affected
rule unimplemented and fail-closed. It does not erase the 9.5-day product identity. AI review
cannot satisfy these gates.

## Planned Research Artifacts

```text
reports/research/FORMATION_RESEARCH_PROTOCOL_V2.md
reports/research/evidence/FORMATION_SOURCE_LEDGER.csv
reports/research/evidence/FORMATION_SEARCH_LOG.md
reports/research/evidence/FORMATION_EXCLUSION_LEDGER.csv
reports/research/evidence/FORMATION_EVIDENCE_EXTRACTION.csv
reports/research/evidence/FORMATION_CLAIM_MATRIX.csv
reports/research/FORMATION_FRAME_RECOVERY_EVIDENCE_REVIEW_V2.md
reports/research/FORMATION_COMPOSITE_AND_LOAD_EVIDENCE_REVIEW.md
reports/research/FORMATION_MINIMUM_EVIDENCE_METHODS_REVIEW.md
reports/research/FORMATION_YOUTH_TRANSFER_AND_PILOT_REVIEW.md
reports/research/FORMATION_COUNTEREVIDENCE_AND_UNCERTAINTY_REVIEW.md
reports/review/FORMATION_LOAD_COMPONENT_DECISION_PACKET_V2.md
reports/review/FORMATION_MINIMUM_EVIDENCE_DECISION_PACKET_V2.md
```

These are future execution outputs. This planning task creates none of them.

## Execution Waves

| Wave | Work | Parallelism | Gate |
|---|---|---|---|
| 0 | Freeze protocol and claim vocabulary | Sequential | Protocol hash and no open research-scope ambiguity |
| 1 | Audit existing citations and run fresh database searches | Two lanes in parallel | DOI/PMID dedupe and reproducible search log |
| 2 | Screen and retrieve full text | Two independent screening lanes | Conflict adjudication and exclusion reasons complete |
| 3 | Extract RQ-A/B/C and RQ-D/E/F/G evidence | Two domain groups in parallel | Double extraction for decision-critical facts |
| 4 | Appraise risk, certainty, directness, and counterevidence | Independent appraisal lanes | No unsupported certainty upgrade |
| 5 | Synthesize seven questions and product claim boundary | Sequential after Wave 4 | Every claim linked to evidence and contradiction |
| 6 | Produce separate Load and Minimum Evidence packets | Two packets in parallel | No threshold or registry decision leaks across packets |
| 7 | External expert review and owner briefing | Role-specific parallel review, owner last | Named acceptance or explicit unresolved state |

## TODOs

- [x] 1. Freeze the research protocol, status vocabulary, schemas, and non-claim lint before
  retrieving new conclusions.
  - Create `reports/research/FORMATION_RESEARCH_PROTOCOL_V2.md` with RQ-A through RQ-G,
    target population, event strata, dates, languages, study designs, PICO/PECO per RQ,
    primary/secondary outcomes, inclusion/exclusion rules, duplicate handling, database
    list, exact search strings, citation-chasing rule, search update date, and stopping rule.
  - Target population is adolescent middle-distance runners; retain explicit strata for
    `800m 중심 | 800/1500m 혼합 | 1500m 중심`, sex, maturity assessment, training age,
    competitive level, season, school/sleep context, and recent competition.
  - Freeze the two-axis conclusion contract and the four-level N-of-1 claim ladder from
    `.omo/drafts/formation-followup-source-map.md`.
  - Define CSV headers and allowed enums for source, exclusion, extraction, and claim
    ledgers. Load Components owns component identity/unit/provenance/decomposition; Minimum
    Evidence owns claim tier/coverage/measurement/confound/interpretation and may only
    reference frozen component IDs.
  - Add `specs/test-packages/validate-formation-research-v2.mjs` first. RED proof: it fails
    against missing protocol/ledgers and reports missing RQ-G, status axes, expert gates,
    and blacklist. GREEN is not expected until the corresponding research artifacts exist.
  - Acceptance: protocol content hash is recorded; every RQ has exact search, output,
    appraisal, and stop criteria; no threshold, safety decision, or product default is
    invented; owner and expert gates remain unresolved.

- [x] 2. Audit every existing Formation citation and seed source before using it in the new
  synthesis.
  - Inventory all citations in `reports/research/FORMATION_SPORTS_SCIENCE_EVIDENCE_REVIEW.md`,
    `specs/reconstruct/FORMATION_LOAD_AND_STATISTICAL_RULES_CONTRACT.md`, and the two planning
    drafts. Assign stable source IDs without changing canonical source files.
  - Verify title, authors, year, journal, DOI, PMID/PMCID, publication type, full-text access,
    correction/retraction status, study population, protocol, outcome, time horizon,
    effect/interval, funding/conflict, and whether another review includes the same cohort.
  - Mark `FULL_TEXT_VERIFIED | ABSTRACT_ONLY | METADATA_ONLY | RETRACTED_OR_CORRECTED |
    UNRESOLVED`. `ABSTRACT_ONLY` and `METADATA_ONLY` can seed searches but cannot support
    effect magnitude, detailed protocol, safety, or final certainty.
  - Re-run fresh searches for RQ-A-G in parallel with the audit. Log database, date, exact
    query, result count, export/dedup method, and access failure. Use PubMed/MEDLINE,
    SPORTDiscus, Scopus, Web of Science, and Cochrane when available; do not conceal an
    unavailable database.
  - Acceptance: 100% of pre-existing citations are in `FORMATION_SOURCE_LEDGER.csv`; every
    unresolved identity is excluded from conclusions; shared primary studies are mapped so
    multiple reviews do not become fake independent support.

- [ ] 3. Perform independent screening, full-text retrieval, exclusion accounting, and
  search saturation.
  - Preparation status (2026-07-17): two independent AI lanes cover 167/167 sources;
    prepared adjudication is 163 include, 2 exclude, and 2 defer. Final acceptance remains
    blocked on human-trained confirmation for all rows and resolution of the two deferred
    records. This item intentionally remains unchecked.
  - Run title/abstract and full-text screening with two independent lanes using the frozen
    protocol. AI may triage but a human-trained reviewer confirms final inclusion/exclusion
    for decision-critical evidence.
  - Record one primary RQ tag and optional secondary tags per source. Adult runners,
    endurance athletes, team sports, and other modalities may remain as indirect evidence,
    but never share the direct-youth label.
  - Capture every full-text exclusion with a single controlled reason; produce a PRISMA
    flow with counts that reconcile exactly to source and exclusion ledgers.
  - Run backward and forward citation chasing for every direct youth/middle-distance source
    and decision-critical review. Stop only after two documented citation-chasing rounds
    add no eligible direct or contradiction-changing source, or record why saturation could
    not be reached.
  - Acceptance: duplicate IDs are zero, ledger arithmetic reconciles, full-text exclusion
    reasons are complete, youth-direct sources are visibly prioritized, and output remains
    `PRISMA-informed structured review` unless every upgrade condition is evidenced.

- [ ] 4. Double-extract decision-critical evidence and normalize outcomes without erasing
  study meaning.
  - Preparation status (2026-07-17): both AI lanes cover 167/167 canonical sources. Six
    interrupted rows are explicitly non-independent root gap fills, every evidence field in
    those six rows is suppressed, and all 2,824 field conflicts remain `NOT_VERIFIED` pending
    human-trained re-extraction/adjudication. This item intentionally remains unchecked.
  - Run four parallel tracks after screening: `RQ-A/B/C`, `RQ-D Load Components`, `RQ-E
    Minimum Evidence`, and `RQ-F/G youth transfer/safety`. RQ-A and RQ-F remain provisional
    until their dependency syntheses complete.
  - For every source extract population, sample, sex, maturity measure, event, training
    status, season, intervention and comparator, component dose/order/separation, target and
    actual interval, outcome construct, instrument/protocol, time points, missingness,
    adverse events, estimate/interval, individual-response information, and limitations.
  - Keep acute recovery, long-term adaptation, performance, health, adherence, feasibility,
    and measurement outcomes in distinct columns. Do not normalize a recovered marker to
    `fully recovered` or combine internal and external load into one scale.
  - Use dual extraction for all direct youth studies, all studies used to discuss 72 hours,
    all component registry decisions, and all sources proposed for an observation/freshness
    rule. Resolve conflicts through a third recorded adjudication.
  - Create a review-overlap map linking systematic reviews to their primary studies.
  - Acceptance: critical-field blanks are typed `NOT_REPORTED | NOT_APPLICABLE |
    NOT_VERIFIED`; no inferred maturity, hidden unit conversion, or unrecorded outcome
    collapsing exists; extraction conflicts are zero or explicitly unresolved.

- [ ] 5. Appraise risk of bias, certainty, youth directness, architecture directness, and
  counterevidence independently.
  - Preparation status (2026-07-17): two AI lanes appraised 167/167 sources; 208 controlled
    disagreements and all 167 human confirmations remain open. No source directly validates
    the complete 9.5-day architecture. Dedicated sports and methods adversarial reviews are
    complete. This item intentionally remains unchecked pending named human review.
  - Use RoB 2 for randomized trials, ROBINS-I for non-randomized intervention studies,
    AMSTAR 2 for systematic reviews, and an explicitly selected fit-for-design checklist for
    observational/case/SCED evidence. Do not average checklist items into a false quality score.
  - Apply GRADE domains only to each body of evidence/outcome after source-level appraisal.
    Maintain separate `youth-middle-distance directness` and `whole-architecture directness`.
  - Every RQ claim row must contain supporting, null/opposing, and limitation/source-gap
    entries. If one category has no eligible source, write `NOT_FOUND` and preserve the
    search that established it.
  - Run a dedicated adversarial pass for: fixed 72-hour recovery, block superiority,
    same-session interference, alternate aerobic recovery benefit, sRPE/TRIMP equivalence,
    ACWR safety, universal minimum `n`, wearable readiness, and youth/adult transfer.
  - Acceptance: no abstract-only source supports a final effect claim; no certainty is
    upgraded by review duplication; conflicting outcomes remain visible; every conclusion
    has both status axes and both directness judgments.

- [ ] 6. Synthesize in dependency order and produce the four research reviews plus a
  counterevidence report.
  - Preparation status (2026-07-17): five reviews and 22 claim rows cover RQ-A through RQ-G,
    include user-visible behavior, and pass source/runtime/non-claim validation. Acceptance
    remains blocked by Tasks 3-5 human gates, so this item remains unchecked.
  - First synthesize RQ-B recovery, RQ-C composite/concurrent training, RQ-D descriptive
    load, RQ-E minimum evidence, and RQ-G youth safety/stratification in parallel.
  - Then synthesize RQ-A using fixed-week limitation evidence, verified coaching-use
    evidence, direct frame evidence, and RQ-B/C. Keep 9.5-day scientific superiority
    `UNKNOWN` unless a genuinely direct comparison survives appraisal. Define deterministic
    9.5-day prescription inputs, collision behavior, no-candidate states, and coach handoff.
  - Finally synthesize RQ-F using RQ-A-E/G. Define the first pilot as feasibility and
    observability research; cumulative adaptation and carryover prevent a naive ABAB claim.
  - For N-of-1 data, preserve the ladder `OBSERVATION → DESCRIPTIVE_BASELINE →
    MEASUREMENT_ERROR_EXCEEDING_CHANGE → PROSPECTIVE_HYPOTHESIS_COMPARISON`. The last level
    requires preregistration, comparator, stable protocol, autocorrelation/trend/confound
    plan, and residual/carryover treatment; it still does not prove safety.
  - Produce Korean owner/coach plain-language summaries and expert appendices. Every
    product sentence must state its status axes, population/condition, uncertainty, and
    forbidden inference.
  - Acceptance: blacklist lint reports zero violations; supportive and opposing evidence
    are adjacent; 72 hours is only an elapsed/coach-target description; adult/team-sport
    evidence never creates a youth prescription; all five research reports link back to
    source and claim ledger IDs.

- [ ] 7. Build two independent, owner-readable decision packets without changing any
  canonical contract or approval state.
  - Preparation status (2026-07-17): both packets are `NOT_REVIEWED`, own disjoint field sets,
    include user impact and rollback, and pass cross-packet validation. They remain unchecked
    until sport-science/statistics and owner decisions are recorded.
  - `FORMATION_LOAD_COMPONENT_DECISION_PACKET_V2.md` owns component identifiers,
    categories, physical units, provenance, protocol compatibility, missingness,
    registered derivations, dedupe, parent/leaf decomposition, overlap quarantine, and
    whole-session facts. It contains no sample-count, baseline, freshness, or inference
    thresholds.
  - `FORMATION_MINIMUM_EVIDENCE_DECISION_PACKET_V2.md` owns the N-of-1 claim ladder,
    measurement properties, coverage/time-span, protocol continuity, device/method
    boundaries, autocorrelation/trend/confound/carryover checks, freshness semantics, and
    permitted interpretations. It may reference but never redefine frozen component IDs.
  - Each packet contains: exact owner questions, evidence and counterevidence, two-axis
    recommendation, expert gate, allowed output, prohibited output, unknowns, alternatives,
    rollback-to-suppression, and `APPROVE | REQUEST_CHANGES | REJECT | NOT_REVIEWED` form.
  - Keep cohort/low-cell/repeated-query/privacy decisions out of single-athlete descriptive
    output. If group output is proposed later, open a separate privacy packet rather than
    smuggling a universal `<5` rule into Minimum Evidence.
  - Acceptance: a cross-packet validator proves zero field ownership collisions; both
    packets remain `NOT_REVIEWED`; no runtime, schema, default, user-facing claim, or pilot
    activation is authorized.

- [ ] 8. Run hard-gate reviews, resolve every comment, brief the owner, and stop before
  implementation.
  - Preparation status (2026-07-17): Korean owner brief, technical annex, six-role reviewer
    ledger, five manual scenarios, latest-owner-decision baseline, ten-row spec conflict
    register, and fifteen user improvements are complete and validated. Human reviewers remain
    `0/6` and manual scenarios `0/5`; this task intentionally remains unchecked.
  - Obtain written `APPROVE | REQUEST_CHANGES` review from the exact hard-gate roles. Run
    sport-science, statistics, youth safeguarding/sports-medicine, and privacy reviews in
    parallel on their bounded scopes; run product-owner review only after revisions.
  - Maintain a reviewer ledger with verified identity/qualification, scope, conflict,
    reviewed source/commit hashes, decision, required changes, response, and supersession.
    An AI agent may be an adversarial reviewer but never fills a human gate.
  - Re-run full source/claim/blacklist/cross-packet validation after every required change.
    Reviewer disagreement, unavailable expertise, or unresolved correction returns the
    affected scientific claim to `UNKNOWN` and leaves the corresponding runtime rule
    unimplemented. It does not prohibit or reopen the fixed 9.5-day product identity.
  - Produce a two-layer briefing: one-page Korean decision summary and technical annex.
    Show `what research supports`, `what remains coach hypothesis`, `what product may show`,
    `what product may not do`, and the exact unresolved decision owner.
  - Manual review: execute all five scenarios in `Manual Review Scenarios`, capture the
    reviewer path and binary result, and verify an owner can distinguish evidence from
    product authority without reading the technical annex.
  - Acceptance: every reviewer comment is accepted and resolved or leaves an explicit
    block; no human gate is fabricated; two packet decisions remain separate; current
    Formation runtime gate and all unrelated P1 approvals are unchanged. The next plan may
    start only after the owner chooses which approved packet, if any, to translate into a
    canonical patch.

## Final Verification Wave

- [x] `FV-01`: every included factual claim has a source ledger ID and resolvable URL/DOI/PMID.
- [x] `FV-02`: all seven RQs include supporting, null/opposing, indirectness, youth-transfer,
  and product-authority judgments; absence is explicitly `NOT_FOUND` rather than omitted.
- [x] `FV-03`: 9.5-day Formation remains the explicit automated-prescription target while
  efficacy, scientific optimality, safety, injury prevention, and recovery-complete claims
  remain absent unless independently supported and approved.
- [x] `FV-04`: Load Components and Minimum Evidence decisions are separate, each with its
  own owner question, expert gate, allowed output, prohibited output, and rollback-to-suppression.
- [x] `FV-05`: repository diff contains research artifacts and decision packets only; no
  production app, canonical runtime contract, backend, schema, participant, or activation change.

## Manual Review Scenarios

1. **Supportive-paper challenge:** provide one positive block-periodization or non-weekly
   coaching source. Reviewer must trace its population, event, source type, and directness;
   it cannot alone prove 9.5-day scientific superiority, safety, or common use. Product
   identity remains a separately recorded owner decision.
2. **72-hour challenge:** provide one 24-hour recovery study and one 72-hour residual-effect
   study. Reviewer must see outcome-specific contradiction and no clearance conclusion.
3. **Composite-session challenge:** provide a strength+plyometric+run session. Reviewer must
   see separate components/units/order and no proportionally split whole-session RPE.
4. **Low-data challenge:** provide one valid observation, three compatible observations, and
   a device-change series. Reviewer must see fact display, visible `n`, and suppressed baseline
   inference without invented universal thresholds.
5. **Youth-safety challenge:** provide growth spurt, pain, illness, or REDs concern. Reviewer
   must see `HUMAN_REVIEW_REQUIRED`, no diagnosis, no clearance, and no hidden use of notes.

## Non-Claims

- The research cannot itself prove the complete Formation architecture effective or safe.
- An AI review cannot substitute for a qualified sports scientist, statistician, youth/clinical
  safeguarding reviewer, privacy reviewer, coach, athlete, guardian, or ethics body.
- More historical records do not automatically establish causality or a stable baseline.
- An owner-approved pilot convention is a product decision, not a scientific finding.
