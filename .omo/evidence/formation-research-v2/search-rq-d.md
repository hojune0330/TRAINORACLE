# RQ-D Descriptive Load Components: Search And Raw Evidence

```yaml
protocol_id: TO-FORMATION-RESEARCH-V2-2026-07-17
research_question: RQ-D
executed_at: 2026-07-17
search_from: database_inception
search_through: 2026-07-17
review_label: PRISMA-informed structured review
scope: DESCRIPTIVE_LOAD_ACCOUNTING_ONLY
sources_extracted: 24
canonical_edits: false
runtime_authority: false
owner_identity_changed: false
```

## 1. Scope Boundary

This memo concerns technical accounting of observed external work, internal response,
method-specific derived values, device measurement, missingness, provenance, and composite
sessions. It does **not** establish readiness, fatigue, recovery, injury risk, medical safety,
training clearance, or a prescription. It does not test or alter the fixed 9.5-day product
identity.

The following operations remain prohibited:

- summing measures with incompatible physical dimensions;
- summing arbitrary units from different methods as though they were interchangeable;
- treating missing as zero;
- treating correlation as agreement or equivalence;
- proportionally splitting a whole-session sRPE or named TRIMP across components without a
  separately validated component protocol;
- using ACWR bands as readiness, injury, safety, or plan-adjustment rules.

ACWR evidence is included only to determine whether a fully specified ratio can be displayed
descriptively and which method fields must accompany it. Injury and health outcomes in those
sources are boundary evidence against product promotion, not accepted product outputs.

## 2. Access And Search Accounting

| Source | State | Execution/accounting |
|---|---|---|
| PubMed/MEDLINE | `AVAILABLE` | Seven database-specific ESearch queries run through official NCBI E-utilities on 2026-07-17; raw counts below. |
| PubMed Central | `AVAILABLE` | PMCID/DOI identity checked with the official PMC ID Converter; open full texts used where noted. |
| DOI/publisher and institutional repositories | `AVAILABLE_PARTIAL` | Used for identity/full-text checks and citation chasing. |
| W3C technical recommendations | `AVAILABLE` | Official PROV-O recommendation inspected. |
| SPORTDiscus | `ACCESS_UNAVAILABLE` | No authenticated database access in the execution environment. |
| Scopus | `ACCESS_UNAVAILABLE` | No authenticated database access in the execution environment. |
| Web of Science | `ACCESS_UNAVAILABLE` | No authenticated database access in the execution environment. |
| Cochrane Library | `ACCESS_UNAVAILABLE` | No authenticated database access in the execution environment; no substitution claimed. |

Counts are retrieval counts before deduplication or screening, not eligible-study counts. This
is a single-lane executable search and extraction, not independent dual screening. Saturation
was not claimed.

## 3. Exact Queries Executed

All PubMed queries were run from database inception through 2026-07-17. The syntax below is
the exact V2 syntax used for the reported raw counts.

### `RQD-PUBMED-CORE-V2` - 519 results

```text
(("athlete monitoring"[Title/Abstract] OR "training load"[Title/Abstract] OR
"session RPE"[Title/Abstract] OR sRPE[Title/Abstract] OR TRIMP[Title/Abstract] OR
"external load"[Title/Abstract] OR "internal load"[Title/Abstract]) AND
(validity[Title/Abstract] OR reliability[Title/Abstract] OR agreement[Title/Abstract] OR
responsiveness[Title/Abstract] OR provenance[Title/Abstract] OR missing[Title/Abstract] OR
missingness[Title/Abstract])) AND
("1900/01/01"[Date - Publication] : "2026/07/17"[Date - Publication])
```

### `RQD-PUBMED-SRPE-V2` - 90 results

```text
(("session rating of perceived exertion"[Title/Abstract] OR
"session-RPE"[Title/Abstract] OR sRPE[Title/Abstract]) AND
(timing[Title/Abstract] OR scale[Title/Abstract] OR validity[Title/Abstract] OR
reliability[Title/Abstract]) AND
(athlete[Title/Abstract] OR athletes[Title/Abstract] OR runner[Title/Abstract] OR
runners[Title/Abstract])) AND
("1900/01/01"[Date - Publication] : "2026/07/17"[Date - Publication])
```

### `RQD-PUBMED-TRIMP-V2` - 59 results

```text
((TRIMP[Title/Abstract] OR "training impulse"[Title/Abstract]) AND
(Banister[Title/Abstract] OR Edwards[Title/Abstract] OR Lucia[Title/Abstract] OR
individual[Title/Abstract] OR individualized[Title/Abstract] OR
individualised[Title/Abstract] OR method[Title/Abstract] OR methods[Title/Abstract]) AND
(agreement[Title/Abstract] OR comparison[Title/Abstract] OR validity[Title/Abstract] OR
validation[Title/Abstract])) AND
("1900/01/01"[Date - Publication] : "2026/07/17"[Date - Publication])
```

### `RQD-PUBMED-DEVICE-V2` - 438 results

```text
((runner[Title/Abstract] OR runners[Title/Abstract] OR athlete[Title/Abstract] OR
athletes[Title/Abstract]) AND
(wearable[Title/Abstract] OR wearables[Title/Abstract] OR smartwatch[Title/Abstract] OR
smartwatches[Title/Abstract] OR "sport watch"[Title/Abstract] OR
"sport watches"[Title/Abstract] OR GPS[Title/Abstract] OR GNSS[Title/Abstract] OR
"heart rate monitor"[Title/Abstract]) AND
(validity[Title/Abstract] OR reliability[Title/Abstract] OR accuracy[Title/Abstract] OR
agreement[Title/Abstract])) AND
("1900/01/01"[Date - Publication] : "2026/07/17"[Date - Publication])
```

### `RQD-PUBMED-MISSING-V2` - 48 results

```text
((athlete[Title/Abstract] OR athletes[Title/Abstract] OR sport[Title/Abstract] OR
sports[Title/Abstract]) AND
(workload[Title/Abstract] OR wearable[Title/Abstract] OR wearables[Title/Abstract] OR
monitoring[Title/Abstract]) AND
(missing[Title/Abstract] OR missingness[Title/Abstract] OR imputation[Title/Abstract] OR
provenance[Title/Abstract])) AND
("1900/01/01"[Date - Publication] : "2026/07/17"[Date - Publication])
```

### `RQD-PUBMED-COMPOSITE-V2` - 47 results

```text
(("session RPE"[Title/Abstract] OR sRPE[Title/Abstract] OR TRIMP[Title/Abstract] OR
"training load"[Title/Abstract]) AND
(composite[Title/Abstract] OR combined[Title/Abstract] OR component[Title/Abstract] OR
components[Title/Abstract] OR "session type"[Title/Abstract] OR modality[Title/Abstract]) AND
(validity[Title/Abstract] OR validation[Title/Abstract] OR reliability[Title/Abstract] OR
agreement[Title/Abstract] OR comparison[Title/Abstract])) AND
("1900/01/01"[Date - Publication] : "2026/07/17"[Date - Publication])
```

### `RQD-PUBMED-ACWR-V2` - 80 results

```text
(("acute:chronic workload ratio"[Title/Abstract] OR ACWR[Title/Abstract]) AND
(runner[Title/Abstract] OR runners[Title/Abstract] OR athlete[Title/Abstract] OR
athletes[Title/Abstract] OR sport[Title/Abstract] OR sports[Title/Abstract]) AND
(validity[Title/Abstract] OR validation[Title/Abstract] OR method[Title/Abstract] OR
methods[Title/Abstract] OR pitfall[Title/Abstract] OR pitfalls[Title/Abstract] OR
coupling[Title/Abstract] OR trial[Title/Abstract] OR prospective[Title/Abstract])) AND
("1900/01/01"[Date - Publication] : "2026/07/17"[Date - Publication])
```

Supplementary identifier and standard searches executed verbatim included:

```text
site:w3.org/TR prov-o W3C Recommendation provenance entities activities agents
site:pubmed.ncbi.nlm.nih.gov session RPE timing adolescent distance runners ijspp.2018-0120
site:pubmed.ncbi.nlm.nih.gov "Internal and external training load: 15 years on"
site:pubmed.ncbi.nlm.nih.gov TRIMP Banister Edwards Lucia individualized training impulse comparison validity
site:pubmed.ncbi.nlm.nih.gov wearable heart rate accuracy ECG running Apple Watch Garmin validation
site:pubmed.ncbi.nlm.nih.gov GPS smartwatch distance accuracy running track Garmin Polar systematic review validation
site:pubmed.ncbi.nlm.nih.gov athlete workload missing data imputation longitudinal monitoring 33948096
site:pubmed.ncbi.nlm.nih.gov acute chronic workload ratio conceptual issues fundamental pitfalls PMID 32502973
Mathematical coupling causes spurious correlation DOI 10.1136
PMID 41758294 DOI "Do Training Load Metrics Agree"
```

## 4. Decision-Oriented Evidence Synthesis

| Claim | Status | Supporting / counterevidence | Bounded product implication |
|---|---|---|---|
| `D-01` External work and internal response are distinct measurable components, not interchangeable totals. | `SUPPORTED` for taxonomy; youth-runner directness limited | D01-D03, D09-D10 | Registry family must be explicit. Comparisons require same family/method; cross-family display may be adjacent but not added. |
| `D-02` sRPE is a whole-session internal-response method whose value depends on prompt, named scale, collection timing, and duration convention. | `SUPPORTED`, including direct adolescent-runner timing evidence | D03-D07 | Persist scale, prompt, timing, reporter, duration source/unit, and formula version. Missing inputs produce `not_computed`, never zero. |
| `D-03` sRPE, Banister/Edwards/Lucia/individualized TRIMP, and biomechanical load are not numerically equivalent merely because they correlate. | `SUPPORTED`; counterevidence shows some high correlations under specific modes | D03, D08-D10 | Each derived AU requires a method ID/version and input lineage. No cross-method AU sum or conversion table without separate validation. |
| `D-04` Wearable validity and reliability are device-, outcome-, activity-, environment-, and protocol-specific. | `SUPPORTED`; no direct adolescent middle-distance device registry located | D11-D14 | Persist model and collection protocol; show method/device continuity boundaries. Do not substitute vendor energy expenditure for distance, HR, or another construct. |
| `D-05` Missing workload data can bias accumulated summaries; defensible imputation is context-specific rather than universal. | `SUPPORTED`; evidence also opposes a categorical ban on all analytic imputation | D11, D15-D16 | Canonical observed totals exclude missing/imputed values. Expose coverage and reason. Any later imputation is a separate versioned derivative with model, inputs, and uncertainty. |
| `D-06` Derived values need entity/activity/agent lineage and revision identity. | `SUPPORTED` as a general provenance standard, not a sport-effect finding | D17 | Record source entity, generating activity/formula, responsible agent/software, timestamps, version, and `wasDerivedFrom` links. |
| `D-07` A global sRPE describes the entire session; no retrieved evidence validates proportional allocation of that global value to composite-session leaves. | `CONDITIONALLY_SUPPORTED` for whole-session construct; component split remains `NOT_SUPPORTED` | D03, D07, D09-D10, D17 | Preserve ordered leaf facts and a whole-session sRPE on the parent. `leaves_or_parent_never_both` is a conservative idempotent accounting rule, not a physiological finding. |
| `D-08` ACWR output changes with window, coupling, weighting, and threshold definition; proposed risk bands are contested and non-causal. | `SUPPORTED` for method sensitivity and non-equivalence; counterevidence exists on size of coupling effect | D18-D24 | Default off. If explicitly requested, display only a named ratio with numerator/denominator windows, coupling, weighting, missing-day and zero-denominator behavior. No zones or action recommendation. |

### Consensus And Counterevidence That Must Travel Together

- Broad reviews and primary studies support sRPE as a practical internal-load description
  (D03-D07), but the adolescent runner study observed 30-minute sRPE values 26.5% lower than
  immediate values (D04). Timing protocols are not silently pooled.
- CR10 and Borg 6-20 session ratings were strongly correlated (`r=.90`) yet produced different
  absolute numbers (D06). Correlation supports convergent interpretation, not raw-value
  interchangeability.
- Individualized TRIMP related to fitness/performance in eight adult distance runners when
  average group weighting did not (D08); runner and rower studies found relationships between
  sRPE, TRIMP, and biomechanical/external measures varied by session type (D09-D10). A strong
  relationship in one modality does not validate a universal conversion.
- Device studies show useful validity for some outcomes and conditions (D11-D14) while also
  showing outcome- and environment-dependent errors. Device provenance cannot be discarded
  after import.
- Context-aware imputation can outperform simpler approaches in youth basketball (D15), while
  real-world missingness can violate missing-completely-at-random assumptions (D16). This
  supports a labelled analytic derivative, not silent filling of canonical observations.
- Lolli et al. demonstrated mathematical coupling in simulated data (D19); Coyne et al. found
  coupled-versus-uncoupled differences mostly trivial in two elite-sport datasets (D20).
  Disagreement strengthens the requirement to store the coupling method rather than selecting
  an unlabeled universal ACWR.
- Gabbett's narrative model proposed an ACWR "sweet spot" (D21), but a runner cohort found an
  inverse association (D22), a youth cluster RCT found no benefit of the tested ACWR management
  intervention (D23), and direct runner data showed large classification differences across
  calculation methods (D24). Therefore no band becomes a product rule.

## 5. Source-Level Extraction

Full-text state labels are literal. `PMC_AVAILABLE; ABSTRACT_VERIFIED` means an open PMC copy
exists, but the extraction below was checked against the PubMed abstract unless a full-text
statement is explicitly identified. No detail beyond an abstract is inferred for
`ABSTRACT_ONLY_VERIFIED` records.

### D01. Bourdon et al. (2017), *Monitoring Athlete Training Loads: Consensus Statement*

- **IDs / URL / type:** DOI `10.1123/IJSPP.2017-0208`; PMID `28463642`;
  [PubMed](https://pubmed.ncbi.nlm.nih.gov/28463642/); expert consensus statement.
- **Full-text state:** `ABSTRACT_ONLY_VERIFIED`; PubMed lists a free publisher link.
- **Population / method:** Athlete monitoring generally; synthesis from the 2016 Doha expert
  conference into a shared conceptual framework.
- **Result:** Establishes a multidisciplinary internal/external load-monitoring framework and
  documents heterogeneous applied methods.
- **Limitations:** Consensus, not a systematic effect estimate; no youth middle-distance
  validation; conference authorship can reflect prevailing practice.
- **Product implication:** Supports a typed load-family registry and method transparency only.
  It does not validate a universal total or downstream state score.

### D02. Impellizzeri, Marcora, and Coutts (2019), *Internal and External Training Load: 15 Years On*

- **IDs / URL / type:** DOI `10.1123/ijspp.2018-0935`; PMID `30614348`;
  [PubMed](https://pubmed.ncbi.nlm.nih.gov/30614348/); conceptual commentary.
- **Full-text state:** `ABSTRACT_ONLY_VERIFIED`.
- **Population / method:** General exercise-training framework; authors refine the two-component
  internal/external construct introduced in 2003.
- **Result:** Confirms that training load has two measurable components and that definitions
  need clarification to avoid misinterpretation.
- **Limitations:** Commentary, not validation; exact operational definitions were not extracted
  beyond the abstract; not youth-runner specific.
- **Product implication:** Require `family=external|internal` before a value can enter comparison
  logic. Do not infer biological response from external work or vice versa.

### D03. Foster et al. (2001), *A New Approach to Monitoring Exercise Training*

- **IDs / URL / type:** DOI `10.1519/00124278-200102000-00019`; PMID `11708692`;
  [PubMed](https://pubmed.ncbi.nlm.nih.gov/11708692/); two-part comparative validation study.
- **Full-text state:** `ABSTRACT_ONLY_VERIFIED`; DOI identity additionally verified from PMC
  reference metadata.
- **Population / method:** Participants performed steady-state/interval cycling or basketball;
  exact sample composition is `NOT_VERIFIED` from the abstract. Session-RPE scores were compared
  with an HR-based method.
- **Result:** Relationships were consistent across exercise types, but absolute session-RPE
  scores were significantly greater than HR-method scores.
- **Limitations:** HR was a comparator, not a complete criterion for every training stress;
  participant detail is absent from the abstract; not youth runners.
- **Product implication:** sRPE is a named whole-session derived measure, not an interchangeable
  HR-TRIMP value. Preserve its prompt, scale, duration, and formula.

### D04. Mann et al. (2019), *Validation of Session RPE in Adolescent Distance Runners*

- **IDs / URL / type:** DOI `10.1123/ijspp.2018-0120`; PMID `30160557`;
  [PubMed](https://pubmed.ncbi.nlm.nih.gov/30160557/); observational validation study.
- **Full-text state:** `ABSTRACT_ONLY_VERIFIED`; PubMed lists a free article.
- **Population / method:** 15 adolescent distance runners, age `15.2 +/- 1.6 y`; treadmill
  familiarization plus a regular 2-week mesocycle; CR10 sRPE/differential RPE at 0, 15, and
  30 minutes, compared with HR criteria.
- **Result:** At 30 versus 0 minutes, sRPE was `-26.5% +/- 5.5%` (90% limits), leg RPE
  `-20.5% +/- 5.6%`, and breathlessness `-38.9% +/- 7.4%`; correlations with HR criteria were
  largest at session completion (`r=.74-.89`). All three timings were judged valid.
- **Limitations:** Small, short study; sex-specific results and maturity are not reported in the
  abstract; distance runners are more direct than team sports but 800/1500 composition is
  `NOT_REPORTED`.
- **Product implication:** Timing is part of the value's identity. Store end/response timestamps
  and do not merge immediate and 30-minute observations as one protocol.

### D05. Haddad et al. (2017), *Session-RPE Method for Training Load Monitoring*

- **IDs / URL / type:** DOI `10.3389/fnins.2017.00612`; PMID `29163016`; PMCID `PMC5673663`;
  [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC5673663/); review.
- **Full-text state:** `PMC_AVAILABLE; ABSTRACT_VERIFIED`.
- **Population / method:** Athletes of any sex, age, competition level, and sport; English
  searches through 2016; 36 studies evaluated Foster-method validity/reliability using modified
  CR10.
- **Result:** The review reported broad validity, reliability, and internal consistency across
  sports and ages, while cataloguing factors that alter RPE.
- **Limitations:** Broad heterogeneity; English-language restriction; youth middle-distance
  directness is low; a review of correlations does not make methods numerically equivalent.
- **Product implication:** A registered CR10 sRPE calculation is supportable as a descriptive
  internal-response measure when its protocol is complete.

### D06. Arney et al. (2019), *Comparison of RPE Scales for Session RPE*

- **IDs / URL / type:** DOI `10.1123/ijspp.2018-0637`; PMID `30569764`;
  [PubMed](https://pubmed.ncbi.nlm.nih.gov/30569764/); randomized matched-session comparison.
- **Full-text state:** `ABSTRACT_ONLY_VERIFIED`.
- **Population / method:** Recreational, systematically training athletes across sports; exact
  sample size `NOT_REPORTED_IN_ABSTRACT`; six randomized 30-minute interval sessions at 50%,
  75%, or 85% peak power; Borg CR10 and Borg 6-20 collected 30 minutes postexercise.
- **Result:** Both scales correlated with HR reserve (`r=.76`, `.69`) and with each other
  (`r=.90`), but produced different absolute values.
- **Limitations:** Recreational adult/mixed-sport indirectness; controlled 30-minute intervals;
  high correlation is not absolute agreement.
- **Product implication:** Persist scale ID and anchors. Cross-scale comparison requires an
  explicitly validated transformation; raw scores and duration products are not pooled.

### D07. Foster et al. (2021), *25 Years of Session Rating of Perceived Exertion*

- **IDs / URL / type:** DOI `10.1123/ijspp.2020-0599`; PMID `33508782`;
  [PubMed](https://pubmed.ncbi.nlm.nih.gov/33508782/); historical/narrative review.
- **Full-text state:** `ABSTRACT_ONLY_VERIFIED`.
- **Population / method:** Historical synthesis across aerobic, resistance, games, patients,
  and athletes; several authors developed the method.
- **Result:** Defines sRPE as the intensity/average RPE of an **entire session**; original timing
  was about 30 minutes post-bout, with literature reporting temporal robustness over wider
  intervals; not intended for precise external-load detail.
- **Limitations:** Narrative and developer-authored; temporal-robustness summary does not erase
  D04's direct timing differences; no validation of component allocation.
- **Product implication:** Parent session owns the global sRPE. Leaf components retain their own
  observed facts; global sRPE is not fractionally allocated.

### D08. Manzi et al. (2009), *Relation Between Individualized TRIMP and Performance in Distance Runners*

- **IDs / URL / type:** DOI `10.1249/MSS.0b013e3181a6a959`; PMID `19812506`;
  [PubMed](https://pubmed.ncbi.nlm.nih.gov/19812506/); longitudinal method study.
- **Full-text state:** `ABSTRACT_ONLY_VERIFIED`.
- **Population / method:** Eight recreational long-distance runners, age `39.9 +/- 6.5 y`, over
  eight weeks; TRIMPi used individual HR/lactate profiles from treadmill testing and was compared
  with average group weighting.
- **Result:** Weekly TRIMPi related to changes in speed at 2 mmol/L (`r=.87`) and 4 mmol/L
  (`r=.74`) and to 5 km/10 km performance; group-average methods showed no significant
  relationships.
- **Limitations:** Very small adult recreational sample; outcome association is not method
  agreement or youth validation; TRIMPi requires individual testing.
- **Product implication:** `TRIMPi` must remain a separate method with individual threshold
  provenance. It cannot be labeled simply `TRIMP` or converted to Banister/Edwards/sRPE AU.

### D09. Scheltinga et al. (2026), *Do Training Load Metrics Agree? Outdoor Running*

- **IDs / URL / type:** DOI `10.1186/s40798-025-00969-9`; PMID `41758294`; PMCID `PMC12949214`;
  [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC12949214/); primary comparative study.
- **Full-text state:** `PMC_AVAILABLE; ABSTRACT_VERIFIED`.
- **Population / method:** 12 experienced runners; endurance, submaximal, and interval outdoor
  sessions; sRPE, HR-based TRIMP, and IMU/peak-ground-reaction-force-derived cumulative load.
- **Result:** sRPE distinguished session types while TRIMP and cumulative biomechanical load did
  not; correlations were `r=.49` sRPE/TRIMP, `.25` sRPE/biomechanical, and `.35`
  biomechanical/TRIMP.
- **Limitations:** Small adult sample; criterion adequacy itself is uncertain; no youth/maturity
  evidence; only three session types.
- **Product implication:** Store physiological, perceptual, and biomechanical values side by side
  with separate identities. Their AU are not one additive currency.

### D10. Dai, Yan, and Bi (2025), *Concurrent Validity and Reliability of sRPE in Professional Rowers*

- **IDs / URL / type:** DOI `10.1186/s13102-025-01247-7`; PMID `40646576`; PMCID `PMC12247353`;
  [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC12247353/); longitudinal validation study.
- **Full-text state:** `PMC_AVAILABLE; ABSTRACT_VERIFIED`.
- **Population / method:** 30 professional rowers, 12 months, 194 effective sessions across
  explosive power, endurance strength, ergometer, and functional training; sRPE compared with
  Banister TRIMP or total weight lifted by modality.
- **Result:** Ergometer test-retest correlation/ICC were about `.758/.755`; sRPE-TRIMP correlation
  was `.811` in 6 km x 3 ergometer work but `.258` (95% CI `-.111,.565`) in functional training.
- **Limitations:** 2025 study, rowing rather than running; criterion changed by modality; abstract
  reports five typical sessions while listing four broad modalities; no youth directness.
- **Product implication:** Validation is modality-specific. Composite strength/endurance sessions
  cannot inherit an ergometer conversion or be reduced to one component's HR behavior.

### D11. Bent et al. (2020), *Sources of Inaccuracy in Wearable Optical HR Sensors*

- **IDs / URL / type:** DOI `10.1038/s41746-020-0226-6`; PMID `32047863`; PMCID `PMC7010823`;
  [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC7010823/); device validation study.
- **Full-text state:** `PMC_AVAILABLE; ABSTRACT_VERIFIED`.
- **Population / method:** Participants spanning Fitzpatrick skin tones 1-6; exact `n` is not in
  the abstract; six consumer/research wearables compared with ECG across rest and activities.
- **Result:** No significant accuracy difference by skin tone in this study, but significant
  device/activity differences; mean absolute error during activity was about 30% higher than at
  rest. Full-text figures also explicitly analyze device missing values.
- **Limitations:** Not runner- or youth-specific; devices/algorithms age quickly; PPG behavior is
  not transferable to distance, elevation, or energy expenditure.
- **Product implication:** Persist device model, activity context, and missingness. A model or
  algorithm change is a visible continuity boundary.

### D12. Shcherbina et al. (2017), *Accuracy of Wrist-Worn HR and Energy Expenditure*

- **IDs / URL / type:** DOI `10.3390/jpm7020003`; PMID `28538708`; PMCID `PMC5491979`;
  [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC5491979/); multi-device validation study.
- **Full-text state:** `PMC_AVAILABLE; ABSTRACT_VERIFIED`.
- **Population / method:** 60 adults (29 men, 31 women), age `38 +/- 11 y`, diverse body and skin
  characteristics; seven watches during sitting, walking, running, and cycling; telemetry and
  indirect calorimetry criteria.
- **Result:** Six devices had median HR error below 5% during cycling; no device had energy
  expenditure error below 20%; error differed by activity/device and participant factors.
- **Limitations:** Adult laboratory sample and now-old models; cycling HR result cannot be assumed
  for running; vendor energy expenditure is algorithm-derived.
- **Product implication:** Register outcome-specific validation. Never treat vendor kcal/energy,
  HR, distance, and pace as interchangeable measures from the same watch.

### D13. Gilgen-Ammann, Schweizer, and Wyss (2020), *Accuracy of Distance in Eight Sport Watches*

- **IDs / URL / type:** DOI `10.2196/17118`; PMID `32396865`; PMCID `PMC7381051`;
  [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC7381051/); instrument validation study.
- **Full-text state:** `PMC_AVAILABLE; ABSTRACT_VERIFIED`.
- **Population / method:** Eight Apple/Coros/Garmin/Polar/Suunto watches; 3 x 12 measurements in
  urban, forest, and track areas while walking, running, and cycling; reference distances
  `404.0-4296.9 m`.
- **Result:** MAPE ranged `3.2%-6.1%`; distances could be underestimated up to 9%; urban/forest
  and running were generally less accurate than open/other conditions.
- **Limitations:** Instrument rather than athlete-population validation; small repeated routes;
  results are model/firmware/environment specific.
- **Product implication:** Distance provenance includes device and environment/protocol where
  available. Do not imply identical precision or silently merge post-algorithm-change series.

### D14. Evenson and Spade (2020), *Validity and Reliability of Garmin Activity Trackers*

- **IDs / URL / type:** DOI `10.1123/jmpb.2019-0035`; PMID `32601613`; PMCID `PMC7323940`;
  [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC7323940/); systematic review.
- **Full-text state:** `PMC_AVAILABLE; ABSTRACT_VERIFIED`.
- **Population / method:** 32 adult validation studies; only four assessed reliability; multiple
  Garmin models and outcomes through 2018.
- **Result:** Steps generally performed best; distance was poor in three studies, energy
  expenditure widely variable, HR low-to-excellent with MAPE beyond the review's acceptable
  threshold; speed/elevation evidence was sparse.
- **Limitations:** Heterogeneous and now-old devices; adult samples; few reliability studies;
  review thresholds are authors' operational criteria, not universal product cutoffs.
- **Product implication:** A brand-level "Garmin valid" flag is invalid. Registry keys must reach
  model/outcome/protocol/version granularity.

### D15. Benson et al. (2021), *Imputing Missing Athlete Workload Data*

- **IDs / URL / type:** DOI `10.52082/jssm.2021.188`; PMID `33948096`; PMCID `PMC8057705`;
  [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC8057705/); youth longitudinal simulation and
  imputation study.
- **Full-text state:** `PMC_AVAILABLE; ABSTRACT_VERIFIED`.
- **Population / method:** 93 high-school basketball players (45 female, 48 male), one season;
  jumps/hour and RPE; observed values were masked and reconstructed with ten single/ML methods,
  then multiple imputation was applied to actual missingness.
- **Result:** Team-session mean was outperformed only by methods combining session and individual
  context; authors emphasize that amount and nature of missingness determine method choice.
- **Limitations:** Basketball and jump counts, not running; simulated missingness may differ from
  real mechanisms; success for season-level analysis does not make an imputed observation real.
- **Product implication:** Missing remains typed. Any analytic imputation is separate from the
  observed total and carries method/version/predictor/uncertainty provenance.

### D16. Tenan (2023), *Missing Data in Sport Science: Wearables in American Football*

- **IDs / URL / type:** DOI `10.1007/s40279-023-01829-w`; PMID `37027076`;
  [PubMed](https://pubmed.ncbi.nlm.nih.gov/37027076/); methodological leading article/example.
- **Full-text state:** `ABSTRACT_ONLY_VERIFIED`.
- **Population / method:** Illustrative American-football wearable monitoring; exact cohort
  detail is `NOT_VERIFIED` from the abstract; examines violations of missing completely at random
  and potential imputation solutions.
- **Result:** Equipment failure and noncompliance can create informative missingness; even simple
  dashboard averages can be biased when missingness assumptions fail.
- **Limitations:** Didactic example, not youth runners; recommendations concern analysis, not
  canonical record truth.
- **Product implication:** Show eligible count, observed count, coverage, and missing reasons.
  Never zero-fill or silently drop missing sessions from denominators.

### D17. W3C (2013), *PROV-O: The PROV Ontology*

- **IDs / URL / type:** DOI `NOT_APPLICABLE`; PMID `NOT_APPLICABLE`;
  [W3C Recommendation](https://www.w3.org/TR/prov-o/); normative technical standard.
- **Full-text state:** `FULL_TEXT_VERIFIED`, official W3C recommendation.
- **Population / method:** Not a human study; reviewed W3C standard for interoperable provenance.
- **Result:** Models entities, activities, and agents plus generation, usage, derivation,
  attribution, revision, and time; supports provenance chains across heterogeneous systems.
- **Limitations:** General data standard, not a sport-science validation; does not prescribe the
  TRAINORACLE session graph or physiological meaning.
- **Product implication:** Every derived load is an entity generated by a versioned activity from
  identified source entities and attributed to a software/user agent. Revisions produce new
  lineage, not silent overwrites.

### D18. Impellizzeri et al. (2020), *ACWR: Conceptual Issues and Fundamental Pitfalls*

- **IDs / URL / type:** DOI `10.1123/ijspp.2019-0864`; PMID `32502973`;
  [PubMed](https://pubmed.ncbi.nlm.nih.gov/32502973/); critical methodological commentary.
- **Full-text state:** `ABSTRACT_ONLY_VERIFIED`.
- **Population / method:** Conceptual/statistical analysis of the ACWR literature; no athlete
  cohort analyzed in the abstract.
- **Result:** Identifies ratio artifacts, ambiguity, lack of causal estimation, and inconsistent
  direction; rejects training recommendations derived from ACWR injury associations.
- **Limitations:** Commentary; does not show that every descriptive ratio is arithmetically
  useless; injury focus is outside RQ-D's output scope.
- **Product implication:** No risk zone or action. A descriptive ratio, if requested, must name
  every calculation choice and display its raw compatible numerator/denominator.

### D19. Lolli et al. (2017), *Mathematical Coupling Causes Spurious Correlation in ACWR*

- **IDs / URL / type:** DOI `10.1136/bjsports-2017-098110`; PMID `NOT_VERIFIED/NOT_INDEXED`;
  [institutional manuscript](https://research.tees.ac.uk/ws/files/4186784/621518.pdf);
  peer-reviewed methodological simulation/editorial.
- **Full-text state:** `FULL_TEXT_VERIFIED` (accepted manuscript plus publication identity).
- **Population / method:** Four independent simulated 7-day high-speed-distance periods for a
  hypothetical 1,000-player squad based on elite Australian-football distributions.
- **Result:** Coupled acute/chronic correlation was `r=.52` (95% CI `.47,.56`) despite independent
  weeks; excluding acute from chronic reduced it to `r=.01` (`-.05,.07`). Example ACWR changed
  from `1.45` coupled to `1.71` uncoupled.
- **Limitations:** Simulation, no athlete outcome; later counterevidence D20 found mostly trivial
  practical coupled/uncoupled differences in two observed datasets.
- **Product implication:** Coupling is mandatory provenance. Coupled and uncoupled ACWR are
  different methods and cannot share one unlabeled series.

### D20. Coyne et al. (2019), *Does Mathematical Coupling Matter to ACWR?*

- **IDs / URL / type:** DOI `10.1123/ijspp.2018-0874`; PMID `31672929`;
  [PubMed](https://pubmed.ncbi.nlm.nih.gov/31672929/); commentary with observed-data case study.
- **Full-text state:** `ABSTRACT_ONLY_VERIFIED`.
- **Population / method:** International-level basketball and weightlifting athletes before 2016
  Olympic qualifying; coupled/uncoupled rolling-average and EWMA variants compared.
- **Result:** Coupled-versus-uncoupled effect sizes were mostly trivial (`g=.04-.21`); ACWR variant
  correlations were `.88-.99`; authors judged practical coupling risk potentially low.
- **Limitations:** Small elite case context and no direct runner/youth population; absence of a
  material difference in these series does not establish formula identity.
- **Product implication:** This counterevidence prevents claiming uncoupled is universally
  superior. It still supports storing and displaying the chosen coupling/weighting method.

### D21. Gabbett (2016), *The Training-Injury Prevention Paradox*

- **IDs / URL / type:** DOI `10.1136/bjsports-2015-095788`; PMID `26758673`; PMCID `PMC4789704`;
  [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC4789704/); narrative/model paper.
- **Full-text state:** `PMC_AVAILABLE; ABSTRACT_VERIFIED`.
- **Population / method:** Narrative synthesis across mostly team-sport evidence; proposes ACWR as
  a predictor and depicts an approximate `.8-1.3` "sweet spot."
- **Result:** Provides the principal affirmative rationale for monitoring recent relative to
  chronic workload and avoiding rapid changes.
- **Limitations:** Narrative, not an ACWR intervention trial; team-sport indirectness; figure 5
  includes unpublished rugby-league data; proposed bands are contradicted/unsupported by D22-D24.
- **Product implication:** Retain as counterevidence/history only. Do not implement its zones or
  language as descriptive-accounting semantics.

### D22. Nakaoka et al. (2021), *ACWR and Running-Related Injuries in Dutch Runners*

- **IDs / URL / type:** DOI `10.1007/s40279-021-01483-0`; PMID `34052983`;
  [PubMed](https://pubmed.ncbi.nlm.nih.gov/34052983/); prospective-cohort secondary analysis.
- **Full-text state:** `ABSTRACT_ONLY_VERIFIED`.
- **Population / method:** 435 runners followed 18-65 weeks; biweekly exposure; 2-week acute over
  4/6/8/10/12-week chronic hours or kilometres; coupled, uncoupled, and EWMA methods; Bayesian
  logistic mixed models.
- **Result:** Higher ACWR was associated with lower, not higher, observed injury probability;
  coupled/uncoupled results were similar and EWMA sparse/non-significant.
- **Limitations:** Secondary observational analysis, biweekly rather than weekly, adult runner
  context; association is not a causal or product risk rule.
- **Product implication:** Demonstrates direction instability and method dependence. No universal
  threshold, risk meaning, or plan action is permitted.

### D23. Dalen-Lorentsen et al. (2021), *ACWR Load Management Cluster RCT*

- **IDs / URL / type:** DOI `10.1136/bjsports-2020-103003`; PMID `33036995`;
  [publisher full text](https://bjsm.bmj.com/content/55/2/108); cluster randomized trial.
- **Full-text state:** `FULL_TEXT_VERIFIED`.
- **Population / method:** 34 elite Norwegian youth football teams, 482 U19 players of both
  sexes; 10-month intervention using coupled 7:28 rolling ACWR and a `.8-1.5` target versus usual
  planning.
- **Result:** Health-problem prevalence difference was `1.8` percentage points (`-4.1,7.7`,
  `p=.55`); RR `1.01` (`.91,1.12`), with no intervention benefit.
- **Limitations:** Football, one specific implementation, incomplete response/adherence, health
  endpoint outside RQ-D. It does not test descriptive display utility.
- **Product implication:** Confirms ACWR zones cannot acquire plan authority from descriptive
  accounting. This source is used only to enforce that boundary.

### D24. Cloosterman et al. (2024), *Weekly Load Versus ACWR Methods in Running*

- **IDs / URL / type:** DOI `10.4085/1062-6050-0430.23`; PMID `38291782`; PMCID `PMC11537214`;
  [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC11537214/); descriptive epidemiology study.
- **Full-text state:** `PMC_AVAILABLE; ABSTRACT_VERIFIED`.
- **Population / method:** 430 recreational runners (73.3% men; age `44.3 +/- 12.2 y`), 22,839
  GPS sessions; weekly >=30% and ACWR >=1.5 flags using coupled rolling, uncoupled rolling, and
  EWMA calculations.
- **Result:** Flagged-session proportions were 33.4% weekly, 16.2% coupled, 25.8% uncoupled, and
  18.9% EWMA; 43.0% of weekly flags differed from coupled/EWMA classifications.
- **Limitations:** Thresholds were predefined rather than validated; adult recreational runners;
  distance only; descriptive differences do not determine which method is correct.
- **Product implication:** Window, weighting, coupling, and threshold must be part of the method
  identity. Default product behavior is no ACWR classification; an explicitly requested ratio is
  numeric and descriptive only.

## 6. Product-Facing Raw Conclusion

The evidence supports a component registry with at least:

```yaml
measure_identity:
  family: external | internal | derived | contextual
  quantity: duration | distance | elevation | speed | pace | repetitions | power | heart_rate | rpe | method_specific_load
  unit: required
  method_id: required_for_derived
  method_version: required_for_derived
  scale_id_and_anchors: required_for_rpe
  device_model: required_for_device_value
  firmware_or_algorithm_version: required_when_available
  source_entity_ids: required
  observed_at: required
  recorded_at: required
  generated_at: required_for_derived
  quality_state: required
  missing_reason: required_when_missing
```

For composite sessions, additive physical quantities may be aggregated only when units,
measurement semantics, time/space scope, and source-record identity are compatible. Parent and
leaf records must not both contribute the same observation. Whole-session sRPE and named HR
loads remain on the parent unless a distinct component protocol produced distinct component
observations. This accounting invariant is `DESCRIPTIVE_ONLY` and remains subject to owner and
qualified sports-science review.

No retrieved source establishes a universal youth middle-distance device error registry, a
validated proportional composite-sRPE split, equivalence among TRIMP families, or a valid ACWR
action band. Those items remain `UNKNOWN` or `NOT_SUPPORTED`, not defaults.

[RQ_D_RAW_SEARCH_COMPLETE]
