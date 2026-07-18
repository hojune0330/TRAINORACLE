# Adversarial Sports-Science Claim Review

```yaml
review_scope: RQ-A,RQ-B,RQ-C,RQ-F,RQ-G
review_role: INDEPENDENT_ADVERSARIAL_SPORTS_SCIENCE_REVIEW
review_state: AI_COMPLETE_HUMAN_CONFIRMATION_PENDING
canonical_authority: NONE
owner_product_identity: 9_5_DAY_FORMATION
owner_target_authority: DEFAULT_AUTOMATED_PRESCRIPTION
runtime_authority: false
scientific_optimality: UNKNOWN
scientific_safety: UNKNOWN
```

## Review Boundary

The 9.5-day Formation frame is a fixed product decision. This review does not vote on its
adoption. It challenges the scientific language, mechanics, automatic-rule inputs, and
fail-closed conditions that surround that identity. Source IDs below are the canonical IDs in
`FORMATION_SOURCE_LEDGER.csv`; sources that overlap are not counted as independent votes.

An elapsed interval, training-load value, self-report, or absence of a reported concern never
establishes recovery, readiness, safety, diagnosis, or clearance. The first participant-visible
parallel comparison is feasibility-only and cannot validate these physiological claims.

## Executive Verdict

| Challenged proposition | Evidence status | Rule consequence |
|---|---|---|
| 72 hours means recovery or next-MAIN clearance | `NOT_SUPPORTED` | Retain 72 h only as a coach target interval; never as clearance. |
| Block organization is generally superior | `CONDITIONALLY_SUPPORTED` as a planning approach; superiority `NOT_SUPPORTED` | Blocks may organize named components, but no automatic superiority claim or fixed block dose. |
| One universal same-session order or interference rule exists | `UNKNOWN`; narrow protocols `CONDITIONALLY_SUPPORTED` | Preserve order and separation; apply only protocol-specific rules and otherwise require coach authorship. |
| Alternative aerobic work is a recovery intervention | `NOT_SUPPORTED` | Store it as a separately dosed training component, never a recovery label or lower-fatigue guarantee. |
| The full 9.5-day architecture is scientifically superior or proven safe | `NOT_SUPPORTED` | Describe it as TRAINORACLE's fixed prescription frame, not as a scientific optimum or safety finding. |
| Adult/team-sport effects transfer quantitatively to adolescent 800/1500 m | `NOT_SUPPORTED`; mechanism/context transfer `CONDITIONALLY_SUPPORTED` | Use only as indirect context with a directness downgrade; no youth threshold or clearance rule. |

## 1. Fixed 72-Hour Recovery

**Challenged proposition:** after 72 hours, an athlete is recovered and eligible for the next
MAIN exposure.

### Strongest support

- `FRV2-B-009`: 32 male U17/U19 elite soccer players after fixed-order strength/plyometric
  sessions; several force, power, soreness, subjective, and CK markers were reported near
  baseline by 72 h. The largest changes were generally at 24-48 h.
- `FRV2-B-004`: 14 elite youth soccer players, age 16 +/- 2, after one 90-min match without
  subsequent training; posterior-chain isometric peak force was not different from baseline at
  48 h and was above baseline at 72 h, with large individual and joint-angle variation.
- `FRV2-B-003`: 12 trained male multi-sport endurance athletes, age 14-15, after long adventure
  races; soreness was not different from baseline at 72 h and several cardiac/muscle biomarkers
  moved toward baseline by 24-48 h. Outcomes differed by marker and race format.

This is support only for *selected group-average measures under named protocols*. It is not
support for a whole-athlete state or a universal 72-hour threshold.

### Strongest null or opposing evidence

- `FRV2-B-014`: 10 recreational adult male runners after a deliberately damaging downhill run;
  gait changes persisted to 72 h and soreness remained elevated through 96 h. The repeated-bout
  response also changed the kinetics.
- `SRC-PMID-37776346`: 10 adult sprint-trained/mixed-sport athletes; CK and soreness remained
  elevated to 72 h, and 30-m performance was still slower at 72 h after the 20%-body-mass
  resisted-sprint condition while CMJ was unchanged.
- `SRC-PMID-41048235`: 73 U19/U23 soccer players; peak force was lower at both 48 and 72 h.
  Non-participants also changed after intervening training, showing that elapsed time cannot
  identify the responsible exposure.
- `SRC-PMID-20386477`: intense plyometric work produced jump-performance impairment reported as
  long as 72 h while strength was unchanged. Outcome domains did not agree.
- `FRV2-B-011`: 12 adult national-standard 1500-m runners maintained treadmill 1500-m performance
  24 h later. This opposes treating 72 h as universally *necessary*, while still not proving that
  other systems had recovered or that repeating MAIN was safe.

### Limits, permitted claim, and forbidden inference

- **Population limits:** the most direct 800/1500 evidence is adult and very small; most youth
  evidence is male soccer or mixed-modality endurance, not adolescent middle-distance running.
- **Outcome limits:** force, power, gait, soreness, biochemical, subjective, and performance
  outcomes are not interchangeable. Group non-significance is not individual recovery.
- **Time limits:** studies sampled different points between 24 and 168 h and often included an
  intervening session. No source validates 72 h as an individual decision boundary.
- **Evidence status:** fixed physiological recovery/clearance = `NOT_SUPPORTED`; 72 h as a
  transparent coach-selected target interval = `CONDITIONALLY_SUPPORTED_AS_CONVENTION`.
- **Permitted claim:** "The generator aims for about 72 hours between designated MAIN exposures
  when required inputs are complete and no handoff condition is present. This interval is a
  scheduling target, not a recovery or safety assessment."
- **Forbidden inference:** `elapsed_hours >= 72 -> RECOVERED`, `READY`, `SAFE`, or
  `NEXT_MAIN_CLEARED`; averaging discordant markers into that conclusion; moving a missed MAIN
  forward as catch-up.
- **Unresolved human gate:** a youth middle-distance sports-science reviewer and responsible coach
  must approve every session-class spacing rule and its fallback. Health concerns remain with a
  qualified youth sports-medicine reviewer under RQ-G, regardless of elapsed time.

## 2. Block-Organization Superiority

**Challenged proposition:** block periodization or block-shaped insertion of components is
generally superior to traditional organization and therefore validates TRAINORACLE's frame.

### Strongest support

- `SRC-PMID-31802956`: systematic review/meta-analysis of trained to well-trained adult endurance
  athletes across sports; 20 eligible records and six pooled studies reported small favorable
  effects for block versus traditional training on VO2max and maximal power.
- `SRC-PMID-35418513`: systematic review of highly trained/elite distance runners supports
  hard-day/easy-day organization and event/season-specific training distributions. It supports
  structured exposure organization, not a block effect or exact frame length.

### Strongest null or opposing evidence

- `SRC-PMID-31802956` is also the principal internal caution: small samples, heterogeneous
  protocols/outcomes, only six pooled studies, and mean PEDro quality 3.7/10. It did not compare
  seven days with 9, 9.5, or 10 days and did not isolate adolescent 800/1500 m athletes.
- `SRC-PMID-39888556`: 348 trained endurance athletes from 13 studies; no statistically
  significant overall polarized-versus-pyramidal difference for VO2max or time trial. This is not
  a block comparison, but it opposes declaring one broad organization label universally best.
- `FRV2-A-005`: the audited periodization meta-analyses did not test varied non-periodized
  comparators or the accuracy of predicted adaptation timing.
- `FRV2-A-007`, `FRV2-A-008`, and `FRV2-A-009`: successful adult endurance and elite-distance
  practice continued to use explicit weekly organization, with pragmatic or individual
  adjustments. These are descriptive counterexamples to a claim that high-level practice must
  abandon weekly structures.

### Limits, permitted claim, and forbidden inference

- **Population/outcome limits:** adult-dominant, mixed endurance sports, heterogeneous VO2max,
  power, and performance outcomes; no direct adolescent 800/1500 safety or scheduling study.
- **Time limits:** intervention durations and block definitions varied; no result selects 9.5 days
  or predicts the timing of adaptation.
- **Evidence status:** block organization as a possible planning method =
  `CONDITIONALLY_SUPPORTED`; general superiority and transfer to the full 9.5-day architecture =
  `NOT_SUPPORTED`.
- **Permitted claim:** "TRAINORACLE can arrange explicitly named, dosed, and ordered components in
  blocks inside its fixed 9.5-day frame, while retaining competition, school, facility, and coach
  constraints."
- **Forbidden inference:** `BLOCK -> BETTER`, `BLOCK -> SAFER`, `BLOCK -> RECOVERED`, or treating a
  pooled adult VO2max/power effect as proof of the whole product architecture.
- **Unresolved human gate:** an independent sports-science reviewer must approve each implemented
  block template by event, phase, component dose, and target outcome. The owner decision fixes the
  frame, but does not approve a scientific superiority statement.

## 3. Same-Session Order And Interference

**Challenged proposition:** a universal order (for example, strength before endurance) or a single
separation threshold prevents concurrent-training interference.

### Strongest support

- `SRC-PMID-41312139`: male adolescent distance runners, age 16.75 +/- 0.68, in an eight-week
  complex-training trial; heavy resistance preceded biomechanically matched plyometrics with
  3-4 min recovery and favored some economy/power outcomes. Running placement and reverse order
  were not tested.
- `FRV2-C-005`: 17 male junior middle-distance runners; six depth jumps followed by 10 min passive
  recovery acutely improved running economy, but not time to exhaustion. This is an acute primer,
  not a chronic calendar rule.
- `FRV2-C-016`: meta-analysis of 10 adult same-session studies; resistance before endurance
  favored dynamic strength by 6.91 percentage points, while hypertrophy, static strength, and
  aerobic capacity showed no order effect. Heterogeneity for dynamic strength was substantial.
- `FRV2-C-018`: 58 adult amateur rugby players; resistance always preceded aerobic work, and 6 h
  or 24 h separation produced better selected outcomes than 0 h. It is one indirect trial and the
  abstract did not provide complete estimates/intervals.

### Strongest null or opposing evidence

- `FRV2-C-015`: 43 adult studies/1,090 participants; concurrent training showed no clear average
  penalty for maximal strength or hypertrophy, but a small negative effect for explosive strength.
  Same-session versus at-least-3-h categories were study-defined and not randomized youth cutoffs.
- `SRC-PMID-32407361`: 29 moderately active adult men with about 3 h same-day separation; broad
  strength and aerobic gains were similar, while resistance-before-HIIT attenuated selected jump
  outcomes relative to resistance-only. This conflicts with a simple `strength first` rule.
- `SRC-PMID-33751469`: 27 adult studies/750 participants; lower-body strength interference was
  clearest in trained adults in same-session studies, but the under-20-min and over-2-h bins were
  protocol groupings, not validated thresholds.
- Direct head-to-head adolescent 800/1500 evidence for endurance-strength order, same-day hours,
  adjacent-day placement, or hill placement was not located.

### Limits, permitted claim, and forbidden inference

- **Population limits:** the one direct adolescent complex-pair result is male-only and narrow;
  order/separation syntheses are overwhelmingly adult and not middle-distance-specific.
- **Outcome limits:** dynamic strength, explosive power, hypertrophy, aerobic capacity, economy,
  and race performance respond differently.
- **Time limits:** acute priming and six-to-nine-week adaptations cannot be combined into one
  fatigue or scheduling threshold.
- **Evidence status:** heavy-resistance to matched-plyometric complex pairs =
  `CONDITIONALLY_SUPPORTED_IN_NARROW_PROTOCOLS`; universal endurance/strength order, universal
  same-day gap, and adjacent-day rule = `UNKNOWN`.
- **Permitted claim:** preserve `{component, goal, dose, order, separation, relation, provenance,
  outcome_priority}` and reproduce a supported narrow protocol only when all defining fields match.
  Otherwise the generator must expose uncertainty and use a coach-authored arrangement.
- **Forbidden inference:** universal `STRENGTH_FIRST`, universal 3/6/24-hour thresholds, splitting
  whole-session RPE into invented component-fatigue shares, or treating absence of average
  interference as safety.
- **Unresolved human gate:** the responsible coach and an independent youth middle-distance
  reviewer must adjudicate each composite rule. Any pain, illness, growth, fueling, participation,
  or record-integrity concern remains a separate fail-closed human route.

## 4. Alternative Aerobic Work As Recovery

**Challenged proposition:** cycling or another alternative aerobic modality is an equivalent,
lower-fatigue, or recovery-producing replacement for running.

### Strongest support

- `FRV2-C-012`: 14 recreational female runners, age 42 +/- 10, completed four weeks of run-HIIT or
  cycle-HIIT. The cycling arm demonstrates that alternative aerobic work can be a real training
  exposure, not rest. It does not show recovery benefit or modality equivalence.
- `FRV2-C-013`: systematic review/meta-analysis of seven heterogeneous adult randomized trials
  found no statistically clear differences for treadmill VO2max, cycle VO2max, or running
  performance. This permits equipoise about some chronic outcomes, not an equivalence claim.

### Strongest null or opposing evidence

- `FRV2-C-013`: all pooled intervals were wide, studies were old and heterogeneous, and combined
  run/cycle protocols increased performance heterogeneity. Adverse events and session placement
  were not synthesized. A null average is not proof of equivalence or recovery.
- `FRV2-C-012`: cycling RPE and post-session soreness increased, 10-km performance was unchanged,
  and habitual-training placement was not standardized. Cycling was not demonstrated to be lower
  fatigue.
- No located source directly tested alternative aerobic work as a recovery intervention between
  MAIN exposures in adolescent 800/1500 m runners.

### Limits, permitted claim, and forbidden inference

- **Population/time limits:** small middle-aged or heterogeneous adult samples, four-week or older
  chronic protocols, no direct youth middle-distance spacing test.
- **Evidence status:** alternative modality as a distinct coach-selected training component =
  `CONDITIONALLY_SUPPORTED`; recovery benefit, fatigue reduction, and interchangeability =
  `NOT_SUPPORTED`.
- **Permitted claim:** "Alternative aerobic work is a separately dosed training component with its
  own modality, goal, load measures, and athlete response. It may replace running only when the
  coach intentionally authors that substitution."
- **Forbidden inference:** `CYCLING -> RECOVERY`, `NO_IMPACT -> LOW_FATIGUE`, equalizing cycling and
  running dose without a validated conversion, or using the component to clear the next MAIN.
- **Unresolved human gate:** coach review is required for modality substitution; a direct youth
  middle-distance protocol and independent sports-science review are required before any
  automatic substitution or recovery language.

## 5. Whole 9.5-Day Architecture Superiority And Safety

**Challenged proposition:** the fixed 9.5-day architecture has been shown to outperform a weekly
frame or to be safe for the target population.

### Strongest support

- `FRV2-A-011` and `FRV2-A-012` document named adult 9-day use; `FRV2-A-013` and
  `FRV2-A-017` document named adult 10-day use. They support practical intelligibility and use,
  not efficacy, prevalence, youth transfer, or 9.5-day validation.
- `SRC-PMID-35418513` supports hard/easy organization in elite distance-running practice, while
  `SRC-PMID-31802956` gives low-quality indirect support to one form of block organization. Neither
  source tests the complete TRAINORACLE architecture.
- The owner's product decision supports the identity and intended authority. It is not a sports-
  science result and therefore does not change evidence status.

### Strongest null or opposing evidence

- No direct 7-day versus 9-, 9.5-, or 10-day efficacy or safety comparison was located. No actual
  9.5-day coaching precedent was verified, and prevalence of 9/10-day use remains unknown.
- `FRV2-A-010` is an exact-duration false positive: a 9-9.5-day overload/supplement experiment,
  not a recurring microcycle or architecture study.
- `FRV2-A-007`, `FRV2-A-008`, and `FRV2-A-009` describe successful weekly adult endurance or
  middle-distance organization, with context-specific adjustments.
- `FRV2-A-005` found no validation of predicted adaptation timing in the periodization evidence it
  audited. RQ-B and RQ-C also show that component outcomes and recovery kinetics do not collapse
  into a frame-level safety claim.
- `SRC-PMID-33122252` reports that youth-running evidence and age-distance guidance remain limited;
  `FRV2-G-011` reserves adolescent injury, illness, development, overtraining, and return-to-sport
  assessment for knowledgeable health-care professionals.

### Limits, permitted claim, and forbidden inference

- **Population/outcome limits:** practice cases are adult marathon or general-distance examples;
  component studies do not evaluate the integrated 9.5-day system, automated explanation, stop
  behavior, or adverse-event process in adolescent 800/1500 m runners.
- **Time limits:** no recurring 9.5-day comparative follow-up exists in the located evidence.
- **Evidence status:** scientific superiority = `NOT_SUPPORTED`; scientific safety =
  `NOT_SUPPORTED`; product identity = `OWNER_DECISION_FIXED`; runtime prescription authority =
  `FALSE_UNTIL_ALL_NAMED_GATES_PASS`.
- **Permitted claim:** "TRAINORACLE organizes its default candidate prescription on a fixed
  9-day-12-hour Formation frame. The frame is a product convention informed by coaching practice;
  it is not presented as scientifically optimal, universally safer, or proof of recovery."
- **Forbidden inference:** superior performance, injury prevention, completed recovery, or safety
  because the plan uses 9.5 days; citing an individual win or improvement as causal proof; silently
  shifting to a peer cycle length when no eligible 9.5-day candidate can be generated.
- **Unresolved human gate:** independent screening/extraction confirmation, rule-specific sports-
   science approval, youth sports-medicine safety approval, privacy/security review, local
  ethics/legal determination, participant-visible feasibility pilot, coach handoff verification,
  and explicit owner runtime activation. Failure to generate an eligible candidate must route to a
  coach-authored plan, not to another automatic frame.

## 6. Adult And Team-Sport Transfer To Adolescent 800/1500 m

**Challenged proposition:** adult endurance, adult concurrent-training, or youth team-sport
effects can be transferred quantitatively to adolescent middle-distance prescription rules.

### Strongest support

- `FRV2-B-011` provides the closest event-specific recovery evidence: adult national-standard
  1500-m runners maintained one treadmill performance outcome at 24 h.
- `FRV2-B-004`, `FRV2-B-007`, and `FRV2-B-009` provide age-relevant youth evidence that
  repeated-session context and marker disagreement matter, even though the sport is soccer.
- `FRV2-C-015`, `FRV2-C-016`, `SRC-PMID-32407361`, and `SRC-PMID-33751469` inform possible adult
  concurrent-training mechanisms and outcome-specific interference.
- `SRC-PMID-33122252` supplies the direct youth-running boundary: individualized human judgment and
  explicit evidence gaps, rather than a quantitative software rule.

### Strongest null or opposing evidence

- Soccer matches combine accelerations, decelerations, changes of direction, collisions, tactics,
  and intervening team training that do not match 800/1500 session exposures.
- Adult middle-distance and concurrent studies differ in maturity, school/sleep context, training
  age, sex representation, growth, event demands, and adverse-event reporting.
- `SRC-PMID-39197945` emphasizes that adolescent development is nonlinear and asynchronous.
- `FRV2-G-014` reports heterogeneous growth/maturity methods with female athletes and sport
  diversity underrepresented. `FRV2-G-016` and `FRV2-G-017` provide adolescent-runner injury
  context but low event counts/low-certainty associations, not an individual prescription model.
- No transfer function, correction factor, or validated threshold was located for converting any
  adult/team-sport effect into a youth 800/1500 rule.

### Limits, permitted claim, and forbidden inference

- **Population limits:** evidence must be downgraded whenever age, sex, maturity, event, training
  status, school load, recent competition, or protocol differs from the target athlete.
- **Outcome/time limits:** marker-specific adult or team-sport time courses can generate hypotheses
  and caution flags only; they cannot set youth dose, spacing, or clearance.
- **Evidence status:** qualitative mechanism/context transfer = `CONDITIONALLY_SUPPORTED` with an
  explicit directness downgrade; quantitative transfer or automatic rule input = `NOT_SUPPORTED`.
- **Permitted claim:** "Indirect athlete evidence shows which outcomes and contexts the product
  should preserve and where uncertainty is expected. It does not determine an adolescent
  prescription threshold."
- **Forbidden inference:** adult percentage effects, soccer recovery hours, or study-defined
  separation bins becoming youth 800/1500 thresholds; age substituting for maturity; absence of a
  concern or normal marker substituting for medical clearance.
- **Unresolved human gate:** every indirect-to-youth rule requires documented directness
  adjudication by an independent sports scientist and the responsible coach. Clinical stop and
  return-to-participation boundaries require youth sports-medicine approval; local participant
  testing must measure comprehension, burden, no-candidate behavior, and handoff, not efficacy or
  safety.

## Cross-Cutting Stop Rules Proposed For Specification Review

1. A fixed 9.5-day candidate is generated only from registered, compatible, provenance-retaining
   inputs; unknown or contradictory required facts produce `HUMAN_REVIEW_REQUIRED`.
2. A spacing target never clears a session. Reported pain, illness, growth, fueling/eating,
   persistent sleep, participation, safeguarding, clinician restriction, or incompatible-record
   concern suppresses the candidate under the RQ-G route.
3. Composite sessions preserve components, order, dose, separation, relation, and goal. Missing
   protocol-defining fields prevent a protocol-specific automatic rule.
4. Alternative aerobic work is training, not recovery. It cannot repair an otherwise ineligible
   plan or erase the load and mechanics of adjacent components.
5. Directness is a rule field, not narrative decoration. Adult/team-sport evidence cannot be the
   sole positive basis for an adolescent 800/1500 automatic prescription.
6. If the fixed frame cannot produce an eligible candidate, the product fails closed to a
   coach-authored plan. It does not silently select 7, 9, 10, or 14 days.

## Human Confirmation Still Required

This adversarial review is an AI evidence audit, not expert sign-off. A qualified independent
sports-science reviewer must verify the source interpretation, overlap, directness, and each
rule-level claim. A youth sports-medicine reviewer must approve health/referral boundaries. The
participant-visible pilot remains feasibility-only under `FRV2-F-001`, and the visible parallel
comparison method under `FRV2-F-012` does not itself establish safety or efficacy. Consent,
assent, withdrawal, and local legal/ethics authority remain unresolved under `FRV2-F-013` and the
applicable jurisdiction.
