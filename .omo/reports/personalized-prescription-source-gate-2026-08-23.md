# Personalized Prescription Source Gate - 2026-08-23

## Status

```yaml
purpose: PRE_IMPLEMENTATION_SOURCE_REVIEW
owner_delegation: DUAL_REVIEW_AUTHORITY_APPROVED
runtime_authority_granted_by_this_report: false
direct_template_activation: forbidden
race_placement_authority_granted_by_this_report: false
numeric_taper_authority_granted_by_this_report: false
numeric_taper_decision: OPEN
supported_events: [800, 1500, 3000, 5000]
deferred: [100, 200, 400, ATP_PC_DETAILED]
```

## Research question

Which primary papers and official/technical coaching sources are strong enough to
seed exact 800 m, 1500 m, 3000 m, and 5000 m session-template review without
turning a study protocol, elite case, or generic taper result into a universal
personal prescription?

## Re-opened sources and decision use

| Source | Population and scope | What it can support | What it cannot support |
|---|---|---|---|
| [World Athletics: speed training for endurance runners](https://worldathletics.org/personal-best/performance/speed-training-endurance-runners-benefits-limits) | Technical article; examples include 1500 m sessions and explicit warning that they are not introductory | Candidate extraction for exact 1500 m session structure; recovery-day UX | Universal dose, youth transfer, or direct runtime activation |
| [Casado et al., 2021: world-class 800/1500 training review](https://pmc.ncbi.nlm.nih.gov/articles/PMC8363530/) | Review integrating science and best practice; predominantly elite and male evidence | Event-specific taxonomy; threshold, VO2, lactate-tolerance session families; 800/1500 differences | Claim that one template is best for every athlete; silent youth/female transfer |
| [Zhao & Sim, 2023: adolescent 800 m interval training](https://pubmed.ncbi.nlm.nih.gov/37435592/) | Twenty male high-school middle-distance runners; 10-week program using HRR bands | Evidence that structured interval work is not categorically prohibited for adolescents; youth review input | Exact repeat-distance/recovery template authority; female/general population transfer |
| [Bliss et al., 2021: junior event-performance determinants](https://pubmed.ncbi.nlm.nih.gov/33460365/) | 28 trained juniors, male and female, covering 800 m, 1500 m, and XC | Exact-event separation; physiological determinants differ by event | Cross-event pace conversion or a session dose |
| [Boullosa et al., 2021: 800 m race-pace workout response](https://pubmed.ncbi.nlm.nih.gov/34181564/) | Nineteen highly trained male 800 m runners; 600 m continuous versus 2 x 4 x 200 m | Candidate extraction for an 800 m-specific, race-pace interval structure; recovery-cost review | Efficacy superiority, beginner use, or unrestricted youth/female transfer |
| [World Athletics: typical 1500 m session examples](https://worldathletics.org/personal-best/performance/speed-training-endurance-runners-benefits-limits) | Technical coaching examples: 3-4 x 500 m and a mixed 800/200/200 set | A second independent technical input for 1500 m exact extraction | Automatic copying without exact source/coach/population review |
| [Bakken/case review of lactate-guided threshold training](https://pmc.ncbi.nlm.nih.gov/articles/PMC10000870/) | Historical/practice review with elite 5000 m case material | Threshold-session candidate taxonomy and provenance requirements | Copying elite 2000 m volume to another athlete or youth |
| [Fentaw et al., 2026: 5000 m HIIT randomized trial](https://pmc.ncbi.nlm.nih.gov/articles/PMC12950428/) | 42 male/female moderate-altitude runners; 4 x 4 min at vVO2max, 3 min active recovery | A time-based 5000 m VO2 candidate and sex-inclusive evidence input | Sea-level generalization, race-pace conversion, or universal frequency |
| [Active versus passive recovery in trained runners](https://pmc.ncbi.nlm.nih.gov/articles/PMC9012711/) | Well-trained endurance runners; 4 x 2 min at MAS, 1:1 work/recovery | Recovery-mode review for aerobic intervals | Exact 800/1500/3000/5000 event assignment by itself |
| [VDOT threshold guidance](https://support.vdoto2.com/2017/12/whats-threshold-pace/) | Technical pace framework; threshold runs and 5-15 min cruise intervals with short recovery | LT terminology, purpose, and a candidate structure when same-event anchor compatibility is separately accepted | Medical threshold determination, universal pace, or direct youth activation |
| [Spilsbury et al., 2014: elite British taper practices](https://pubmed.ncbi.nlm.nih.gov/25189116/) | Survey of elite 800/1500, 3000-10000, and marathon runners | Event-group differences and the need for separate race-placement review | One universal taper row or percentages for a local 9.5-day frame |
| [Wang et al., 2023: endurance taper meta-analysis](https://pmc.ncbi.nlm.nih.gov/articles/PMC10171681/) | Fourteen endurance studies with heterogeneous events and taper lengths | Evidence that taper variables interact and must be separately governed | Runtime taper percentages in this wave; individual dose without baseline authority |
| [Repeated-sprint residual-fatigue study](https://pubmed.ncbi.nlm.nih.gov/41994354/) | Middle-distance runners; short/long HIIT versus repeated sprint | Reason to keep repeated-sprint/ATP-PC work outside the current activation batch and to review spacing | A universal 48-hour rule for every interval session |

## Findings

1. Exact-event separation is supported. The junior-performance study reports that
   relevant determinants differ among 800 m, 1500 m, and longer cross-country
   performance, so cross-event conversion remains forbidden.
2. Adolescent evidence supports reviewable high-intensity training, not a blanket
   youth ban. The available adolescent 800 m study is small, male-only, and
   program-level, so it cannot independently authorize an exact template.
3. The 800/1500 review contains useful session families and concrete examples, but
   it also emphasizes heterogeneous athlete profiles and a male/elite evidence bias.
4. The 5000 m sources support both time-based VO2 and threshold families. Named
   elite practice remains case evidence, not a personal-dose rule.
5. Taper research changes volume, intensity, frequency, and duration together.
   Because TrainOracle lacks an accepted baseline/load ceiling, this evidence cannot
   safely become percentage-based taper code in the current wave.
6. No source reviewed here justifies increasing intensity, volume, and frequency
   simultaneously from journal completion, RPE, attendance, streaks, or rewards.

## Delegated dual-review gate

The owner authorizes exact template and race-placement decisions without another
owner prompt only when both independent lanes return unconditional approval for
the same artifact digest.

### Lane A - coaching applicability

Must verify exact event, session purpose, athlete experience, phase, same-event pace
anchor, repeat/set notation, total quality distance/time, repetition recovery, set
recovery, warm-up/cool-down boundary, practical track execution, and youth usability.

### Lane B - sports-science and transfer

Must verify source identity, study/sample/event/sex/age scope, protocol versus
recommendation status, transfer limits, recovery arithmetic, contraindicated claims,
and whether evidence supports only a candidate, a population scope, or exact runtime
authority.

### Joint acceptance

- Both lanes read and approve the exact same template or placement-row digest.
- Every active template has one exact target event and one compatible intent.
- Same-event current evidence is required for numeric pace; otherwise RPE-only.
- Youth activation requires explicit youth transfer approval; age alone never changes
  the numeric dose.
- A named athlete's volume or pace is never copied as another athlete's default.
- A failed, mixed, stale, or missing review leaves the entry inactive.
- Race placement may reorder approved sessions only. It cannot introduce taper
  percentages or mutate prescription numbers in this wave.

## Recommended implementation use

- Use the current four active templates as anchors.
- Seek one additional passing template per event first; add a second only when the
  evidence and both reviews are equally complete. This reaches two or three total
  entries per event without filling quotas with weak evidence.
- Prioritize 800 m race-pace/lactate-tolerance, 1500 m race-pace or mixed intervals,
  3000 m VO2/long-interval work, and 5000 m VO2 or threshold work.
- Keep ATP-PC, repeated sprint, percentage tapering, current-load arithmetic, and
  cross-event conversion inactive.

## Taper deep review

### Why taper and race placement are separate

A race date can anchor a calendar without changing any session dose. A taper changes
one or more of volume, frequency, intensity, session content, or timing relative to
the athlete's usual training. Therefore an accepted race-placement row is not taper
authority, and preserving a session multiset does not by itself prove that a new order
is appropriate. Quality-session spacing and projection-boundary movement remain
prescription decisions.

TrainOracle currently has no accepted athlete-specific pre-taper baseline/load packet
from which a percentage reduction can be calculated. A percentage without a defined
baseline unit, reference period, compatible session classification, and missingness
policy is not a personal prescription. The local competition-anchor packet also keeps
race priority, multi-race handling, exact taper content, and post-race transformation
open.

### Direct running evidence and counterevidence

| Source | Direct observation | Authority consequence |
|---|---|---|
| [Mujika et al., 2000](https://pubmed.ncbi.nlm.nih.gov/10694140/) | Eight trained male middle-distance runners completed two six-day volume reductions; neither produced a significant 800 m improvement | A protocol percentage cannot be promoted from a null, very small comparison |
| [Mujika et al., 2002](https://pubmed.ncbi.nlm.nih.gov/12165889/) | Nine male middle-distance runners; daily training during a six-day taper improved 800 m performance while resting every third day did not | Frequency may matter in that protocol, but n=9 cannot establish a universal six-day or daily-training rule |
| [Shepley et al., 1992](https://pubmed.ncbi.nlm.nih.gov/1559951/) | Nine male middle-distance runners compared high-intensity low-volume, low-intensity, and rest-only seven-day conditions using 1500 m-pace time to exhaustion | Supports retaining specificity as a candidate principle; the outcome was not an actual 1500 m race and does not set a runtime dose |
| [Spilsbury et al., 2019](https://pubmed.ncbi.nlm.nih.gov/30608885/) | Ten trained runners; the 115% race-pace final session had highly variable results and was less clearly beneficial than race pace | Harder is not automatically better; final-session intensity needs exact review |
| [Spilsbury et al., 2021](https://doi.org/10.1139/apnm-2021-0103) | Eight highly trained 1500 m runners; a lower-volume condition with a 110% race-pace final session improved more than the comparison | The result conflicts with a simple reading of the 2019 trial and changed volume and final-session intensity together; it is a candidate package, not a separable universal rule |
| [Houmard et al., 1994](https://pubmed.ncbi.nlm.nih.gov/8007812/) | Three groups of eight runners; a seven-day running taper with high-intensity intervals improved 5 km performance while cycling taper and control did not | Direct 5 km support exists, but the exact historical protocol is not a universal 5000 m template |
| [Obata et al., 2023](https://www.jstage.jst.go.jp/article/rjsp/15/0/15_2243/_article/-char/en) | Seven male junior-high runners; a 1000 m stimulus on taper day 4 versus day 6 produced no significant 3000 m difference and fatigue fell in both | Direct youth evidence removes a blanket youth prohibition but does not authorize one final-session offset |
| [Obata and Hayashi, 2023/2024](https://www.jstage.jst.go.jp/article/jspehssconf/73/0/73_162/_article/-char/ja) | Twelve male junior-high runners; 21% versus 41% mileage reduction produced no significant 3000 m performance difference, while reported fatigue was lower in the larger-reduction condition | Youth access can remain open; percentage superiority and female transfer remain unproven |
| [Japanese practice survey](https://cir.nii.ac.jp/crid/1390296343172624640) | 228 runners across junior-high, high-school, university, and company teams reported heterogeneous taper practices; junior-high practice sometimes increased mileage/frequency | Practice prevalence is not efficacy or safety authority and warns against silently copying adult norms |

The direct studies do not converge on one exact final-session intensity, duration,
frequency, or reduction percentage. Null performance results are as important to the
gate as positive results. TrainOracle must not fill the disagreement with a generated
average.

### Event-by-event taper authority audit

| Event | Additional direct evidence and counterevidence | Current conclusion |
|---|---|---|
| 800 m | The two six-day Mujika trials include one null percentage comparison and one small frequency comparison with five versus four runners | Direct evidence exists, but no exact duration, reduction percentage, or frequency row is authorized |
| 1500 m | [Shepley et al., 1992](https://pubmed.ncbi.nlm.nih.gov/1559951/) measured time to exhaustion rather than a race; [Spilsbury et al., 2019](https://pubmed.ncbi.nlm.nih.gov/30608885/) favored the clearer race-pace final session, while [Spilsbury et al., 2021](https://pubmed.ncbi.nlm.nih.gov/34062089/) favored a lower-volume/faster package but changed two variables together. A [small youth study](https://www.analefefs.ro/anale-fefs/2014/i1/pe-autori/9.pdf) reported no significant difference between two 14-day patterns and has unclear sex/protocol reporting | This is the richest event-specific set, but the studies conflict and remain too small or confounded for a runtime rule |
| 3000 m | The two junior-high studies are direct and useful for access/transfer review, but neither established performance superiority. No controlled adult flat-3000 m taper trial was found in the reviewed set | Youth must not be blocked, but exact youth, adult, or female taper placement remains unauthorized |
| 5000 m | [Houmard et al., 1994](https://pubmed.ncbi.nlm.nih.gov/8007812/) found an improvement in only eight run-taper athletes. [Houmard et al., 1990](https://pubmed.ncbi.nlm.nih.gov/2318562/) found that three weeks with a 70% volume reduction and retained intensity maintained rather than improved 5 km performance. [McConell et al., 1993](https://pubmed.ncbi.nlm.nih.gov/8440543/) reduced volume, frequency, and intensity for four weeks; nine of ten men slowed despite maintained aerobic capacity | Maintaining familiar intensity is a candidate constraint, not permission to increase it; no exact percentage or duration is authorized |

The 1500 m evidence also shows why a session multiset alone is insufficient. Moving
the final quality exposure changes its distance from race day, while changing both the
volume reduction and final-session intensity prevents attribution to either component.
Every placement row therefore needs exact event, projection, spacing, population, and
source authority; otherwise it remains generic placement.

### Alternative and adverse-response perspectives

- [Aubry et al., 2014](https://pubmed.ncbi.nlm.nih.gov/25134000/) found that trained
  male triathletes who became functionally overreached during overload showed less
  favorable peak response and more infection than acutely fatigued or control groups.
  This is cross-sport evidence, but it directly blocks a generated pre-race overload
  phase from being inferred from a date alone.
- [Tonnessen et al., 2014](https://pubmed.ncbi.nlm.nih.gov/25019608/) described the
  final preparation of eleven Olympic or world-champion cross-country skiers and
  biathletes, including seven women. It adds elite female endurance context and shows
  that peaking practice is embedded in a long individual training history, but its
  retrospective, cross-sport design cannot supply a running-event taper percentage or
  last-quality-session offset.
- The endurance meta-analysis reports a favorable pooled pattern, yet combines events,
  sports, outcome types, and protocols. Its own subgroup results do not support every
  reduction in intensity or frequency. A group average cannot resolve the direct null
  800 m and youth 3000 m results.
- Practice surveys describe what coaches and athletes do, not what caused better
  performance. Reported prevalence can seed a review question but cannot activate a
  percentage, last-quality-day offset, or frequency rule.
- Physiological maintenance is not interchangeable with race performance. The 1993
  5 km study preserved aerobic capacity while race time worsened, so VO2 or laboratory
  maintenance cannot serve as a silent success surrogate.

### Meta-analysis and baseline limits

[Bosquet et al., 2007](https://pubmed.ncbi.nlm.nih.gov/17762369/) and
[Wang et al., 2023](https://pubmed.ncbi.nlm.nih.gov/37163550/) report useful group-level
patterns across heterogeneous endurance sports, events, durations, and populations.
Those pooled ranges are research summaries, not exact-event runtime constants. The
newer review included only fourteen studies and mixed time-trial and time-to-exhaustion
outcomes; it did not establish a TrainOracle-specific youth, female, event, or 9.5-day
rule.

The elite British survey found that regular-training volume and frequency predicted
the corresponding taper reduction. That finding makes a baseline a prerequisite; it
does not supply a missing baseline for a user with sparse or incompatible history.
Pre-taper overload research also shows that fatigue state changes the response and
that functional overreaching can produce worse adaptation and more illness. TrainOracle
must not add an overload block merely because a target race date was entered.

### Sex, menstrual-cycle, and psychological transfer

The taper evidence remains male-skewed. A female or youth athlete must not be excluded
from plan access, but a male group mean must not become her numeric default or a hidden
sex multiplier.

- [McNulty et al., 2020](https://pubmed.ncbi.nlm.nih.gov/32661839/) found at most a
  trivial average menstrual-cycle performance effect with low-quality, heterogeneous
  evidence and recommended individual consideration rather than universal phase rules.
- [De Martin Topranin et al., 2023](https://pubmed.ncbi.nlm.nih.gov/37726100/) observed
  small phase-related differences in some recovery-status measures among female
  endurance athletes, but concluded that cycle phase was only one of many possible
  stressors.
- [Stone et al., 2023](https://pubmed.ncbi.nlm.nih.gov/36696042/) found that taper
  psychology evidence is mostly adult, male, and drawn from swimming, cycling,
  triathlon, or mixed sports. Taper may reduce fatigue while also being a stressor.
- [O'Connor et al., 1989](https://pubmed.ncbi.nlm.nih.gov/2813655/) followed fourteen
  female collegiate swimmers through progressive overload and taper. Group mood and
  salivary cortisol recovered after overload, while the athletes classified as stale
  had worse overload responses. This supports monitoring individual response, not a
  mood-triggered automatic taper rule.
- [Taylor et al., 1997](https://pubmed.ncbi.nlm.nih.gov/9140908/) is useful
  counterevidence: mood deteriorated after reduced training in female swimmers.

The two female-swimming observations point in opposite psychological directions.
Together they strengthen the case for displaying structured self-report context while
rejecting a universal mood, sex, or taper-dose rule. Neither study is running-specific.

Therefore structured mood, sleep, symptoms, or menstrual context may be displayed for
athlete-controlled reflection or a human review. They cannot independently choose a
taper percentage, increase intensity, infer cycle phase, diagnose readiness, or clear a
safety state. Raw narratives remain outside the plan generator.

### Runtime boundary for this implementation wave

The local competition-anchor packet still reports
`retention_class: NOT_DEFINED_RUNTIME_BLOCKED`. Product approval for an optional race
date is not privacy approval for persistence. This wave may implement only the
following honest states:

1. `NO_TARGET_RACE`: generate the generic approved frame.
2. `TARGET_RACE_PREVIEW_ONLY_RETENTION_BLOCKED`: use the date in request memory only;
   persist neither the date nor derived placement state/data.
3. `TARGET_RACE_STORED_FOR_LATER`: only after a named privacy/governance receipt,
   retain a valid future date outside the visible projection without changing the frame.
4. `RACE_PLACEMENT_ONLY`: only after that receipt, apply an exact-event,
   exact-projection, same-digest approved
   permutation that preserves session content and all numeric prescription values.
5. `GENERIC_PLACEMENT_NO_AUTHORITY`: keep the generic frame when a placement row,
   population transfer, projection, spacing rule, or anchor decision is missing.

All five states have `numericTaperAuthority: NOT_GRANTED`. The athlete-facing product
must not call placement-only behavior a personalized taper. It should say that the race
date was considered for placement and that training quantity/intensity was not changed.

Numeric taper rows may be researched and recorded as inactive candidates, but they
cannot be activated in this wave. Future activation requires all of the following on
one digest: an accepted exact-event and population scope; a compatible athlete baseline
contract; exact component, frequency, volume, intensity, and relative-day semantics;
race priority and multi-race behavior; coaching-applicability approval;
sports-science/transfer approval; owner authority beyond the current placement-only
delegation; and mutation tests for every numeric and authority field.

### Required plan corrections

- Give taper evidence/authority its own task before race-placement implementation.
- Treat the two initial candidates as support-work choices, not baseline-personalized
  load or taper choices.
- Require projection-specific placement authority for 7, 9, and 10-day views; never
  move a session across a projection boundary without an exact approved row.
- Record youth and sex transfer separately for every template and placement row.
- Keep explicit request and same-event PB/SB as proposal triggers only. They do not
  authorize an invented numeric delta; active successor edges must remain within an
  already approved candidate/template envelope until baseline authority exists.
- Add null/adverse-response sources to the review packet so an approval cannot cite
  only positive studies.
- Keep race dates transient until purpose, retention event/duration, deletion/erase-all,
  export, youth age-out, and withdrawal behavior have a named governance receipt.

[DRAFT_COMPLETE]
