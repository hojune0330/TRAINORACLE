# RQ-E Search Evidence: Minimum Evidence for Within-Athlete Interpretation

Search executed: 2026-07-17 (Asia/Seoul)
Protocol: `FORMATION_RESEARCH_PROTOCOL_V2.md`, RQ-E
Artifact status: raw research evidence, not a canonical decision or runtime contract
Source count: 25

## 1. Decision Boundary

This search does **not** support a universal observation count, baseline duration, or
freshness threshold. The required evidence depends on the construct, measurement
protocol, expected time scale, measurement error, biological variability, missingness,
serial dependence, trend, intervention onset and carryover, and the claim being made.

The four-level claim ladder is preserved exactly:

| Level | What may be said | Minimum evidence class | What may not be said |
|---|---|---|---|
| `OBSERVATION` | A timestamped value was recorded under a named protocol. | One valid, unit-resolved observation with source, device/method, protocol version, and quality state. | No baseline, abnormality, change, cause, efficacy, safety, readiness, or plan clearance. |
| `DESCRIPTIVE_BASELINE` | The athlete's observed distribution, range, or trend over the represented period can be described. | Repeated comparable observations with coverage and missingness shown; stable protocol or explicit stratification by protocol; enough span to represent the intended context. The number and duration remain metric-specific. | No claim that a difference is real, caused by training, safe, or predictive. |
| `MEASUREMENT_ERROR_EXCEEDING_CHANGE` | A change exceeds a pre-specified error/uncertainty bound for that metric and protocol. | Metric-specific test-retest error estimated in a relevant population/context; compatible units and protocol; uncertainty interval; checks for heteroscedasticity, trend, and protocol drift. | Exceeding error is not causality, efficacy, adaptation, diagnosis, injury risk, or safety. |
| `PROSPECTIVE_HYPOTHESIS_COMPARISON` | A pre-specified condition comparison for this athlete may be interpreted within the design's limits. | Prospective protocol; planned outcome and contrast; randomized/counterbalanced or defensible staggered design; repeated measurements; autocorrelation, trend, carryover, confounding, missingness, and multiplicity addressed. | No automatic generalization to other athletes, future cycles, clinical safety, or automated prescription authority. |

### Minimum-evidence rules supported by the search

1. **No universal `n`.** Values such as three or five phase points arise in particular
   reliability-study or WWC single-case standards. They are not transferable as a
   universal athlete-baseline rule.
2. **No universal baseline duration.** Baseline must span the time scale and contexts
   that the intended claim represents. A daily wellness score, a competition result,
   and a force-platform test have different sampling and error structures.
3. **No universal freshness threshold.** Freshness is a construct and provenance
   property. The evidence found no defensible single age limit for all athlete data.
   Until a metric-specific limit is justified, freshness sufficiency remains `UNKNOWN`.
4. **Protocol compatibility precedes comparison.** Device, firmware/software,
   calibration, units, test procedure, athlete state, and aggregation rule must match or
   be explicitly modeled/stratified.
5. **Error and importance are separate.** `CV`, typical error, `SEM`, limits of
   agreement, and `MDC` characterize measurement precision. `SWC`/minimal important
   change is a decision threshold. A change may be statistically resolvable but not
   worthwhile, or worthwhile in principle but unresolvable by the test.
6. **Serial dependence is expected, not exceptional.** Ordinary independent-observation
   tests can misstate uncertainty when repeated observations are autocorrelated.
7. **Prospective comparison is a design claim.** Repeated observations alone do not
   remove time trend, seasonality, maturation, concurrent training, competition,
   illness, sleep, environment, learning, or regression-to-the-mean confounding.
8. **Observational monitoring is noncausal and nonsafety.** Athlete-monitoring data can
   describe load and response patterns. It cannot by itself show that a plan caused a
   result or that continued training is safe.

## 2. Measurement and Design Toolkit

| Method | Appropriate use | Requirements and cautions |
|---|---|---|
| `CV` / typical error | Ratio-scale error when variability is proportional to the mean. | Inspect heteroscedasticity; log-scale estimation is often appropriate. A group CV is not automatically an individual's error model. |
| `SEM` | Absolute test-retest error in measurement units. | State ICC/model and calculation. A common convention is `SEM = SD * sqrt(1 - ICC)`, but results depend on design and variance components. |
| `MDC95` / smallest real difference | Threshold beyond which a two-measure difference is unlikely to be measurement error under stated assumptions. | A common convention is `1.96 * sqrt(2) * SEM`; verify assumptions and whether one- or two-sided decisions are intended. It is not an importance threshold. |
| `SWC` / minimal important change | Smallest effect worth acting on for the named outcome and decision context. | Pre-specify and justify by athlete/coach anchor, competition context, or defensible distributional method. Do not import MBI error-rate claims or use `0.2 SD` as an automatic truth. |
| Limits of agreement / uncertainty interval | Show the range of expected differences and avoid correlation-only reliability claims. | Use compatible repeated trials and check bias and scale dependence. |
| Descriptive baseline | Describe level, spread, trend, and context for one athlete. | Show observation count, date span, cadence, context coverage, missingness, and protocol/version continuity. Do not force a fixed minimum. |
| Randomized/counterbalanced N-of-1 | Compare reversible conditions in one person. | Pre-specify condition order, outcomes, period length, onset and washout logic, repeated assessment, serial analysis, and stopping rules. |
| Multiple baseline | Demonstrate replicated change when withdrawal is infeasible. | Stagger intervention starts across outcomes/behaviors/participants; require repeated demonstrations and assess concurrence, trend, and phase data adequacy. Nonconcurrent designs are weaker against history. |
| Interrupted time series / level-slope model | Evaluate a planned change in a longitudinal series. | Model pre-existing trend, autocorrelation, seasonality, abrupt versus gradual onset, and other coincident changes. |

### Required threat checks before level 4

| Threat | Required handling | Fail-closed implication |
|---|---|---|
| Autocorrelation | Plot and model/test serial dependence; use serially valid or randomization-based inference. | Keep at level 1-2 if effective uncertainty cannot be estimated. |
| Trend / seasonality | Pre-specify level and/or slope effect; inspect baseline trend; include time/context terms where justified. | Do not label a continuation of pre-existing trend an intervention effect. |
| Carryover / delayed onset | Choose periods from the intervention's time course; use washout, transition exclusion/down-weighting, or explicit carryover model. | When training adaptations overlap and cannot be separated, do not claim an isolated session/component effect. |
| Confounding | Record concurrent training, competition, illness/pain, sleep, environment, maturation, equipment/protocol changes, and other interventions. | Unresolved coincident changes block causal wording. |
| Missingness | Show expected versus observed cadence and reasons; do not silently interpolate or treat missing as normal. | Coverage insufficiency blocks baseline or comparison promotion. |
| Multiplicity / analyst flexibility | Pre-specify primary outcome, contrast, direction, window, and analysis; label exploratory results. | Post hoc best-window findings remain descriptive. |

## 3. Search Execution

### Access and scope

- PubMed/MEDLINE was queried through the official NCBI E-utilities endpoint with
  `retmax=0` for counts and PubMed/PMC records for verification.
- Official publisher, PMC, AHRQ, and US Institute of Education Sciences/What Works
  Clearinghouse pages were used for full-text or standards verification.
- SPORTDiscus, Scopus, Web of Science, and Cochrane Library were not available through
  authenticated database access in this execution and are logged as
  `ACCESS_UNAVAILABLE`, not silently replaced.
- This is a rapid structured methods search and targeted source chase, not a complete
  systematic review. The large discovery result sets were not all full-text screened.
- Counts are the executed results on 2026-07-17 and can drift as PubMed indexing changes.

### Exact PubMed queries and returned counts

#### PE-RQE-CORE: 663

```text
(("single athlete"[Title/Abstract] OR "within-athlete"[Title/Abstract] OR "N-of-1"[Title/Abstract] OR "single-case"[Title/Abstract] OR "single subject"[Title/Abstract] OR "time series"[Title/Abstract] OR "multiple baseline"[Title/Abstract]) AND (training[Title/Abstract] OR sport*[Title/Abstract] OR "athlete monitoring"[Title/Abstract]) AND ("measurement error"[Title/Abstract] OR reliab*[Title/Abstract] OR autocorrelation[Title/Abstract] OR carryover[Title/Abstract] OR trend[Title/Abstract])) AND ("1900/01/01"[Date - Publication] : "2026/07/17"[Date - Publication])
```

#### PE-MEASUREMENT: 5,105

```text
(("Athletic Performance"[MeSH Terms] OR athlete*[Title/Abstract] OR "sport science"[Title/Abstract] OR "sports medicine"[Title/Abstract]) AND ("measurement error"[Title/Abstract] OR reliability[Title/Abstract] OR responsiveness[Title/Abstract] OR "coefficient of variation"[Title/Abstract] OR "standard error of measurement"[Title/Abstract] OR "minimum detectable change"[Title/Abstract] OR "smallest worthwhile change"[Title/Abstract] OR "typical error"[Title/Abstract])) AND ("1900/01/01"[Date - Publication] : "2026/07/17"[Date - Publication])
```

#### PE-INDIVIDUAL-RESPONSE: 60

```text
(("individual response"[Title/Abstract] OR "interindividual response"[Title/Abstract] OR responder*[Title/Abstract] OR "meaningful change"[Title/Abstract]) AND (exercise[Title/Abstract] OR training[Title/Abstract]) AND ("measurement error"[Title/Abstract] OR "biological variability"[Title/Abstract] OR "smallest worthwhile change"[Title/Abstract] OR "minimum clinically important difference"[Title/Abstract])) AND ("1900/01/01"[Date - Publication] : "2026/07/17"[Date - Publication])
```

#### PE-SCED-THREATS: 3,231

```text
(("Single-Case Studies as Topic"[MeSH Terms] OR "single-case design"[Title/Abstract] OR "single-case experimental design"[Title/Abstract] OR "multiple baseline"[Title/Abstract] OR "N-of-1 trial"[Title/Abstract]) AND (autocorrelation[Title/Abstract] OR trend[Title/Abstract] OR carryover[Title/Abstract] OR confound*[Title/Abstract] OR randomization[Title/Abstract] OR baseline[Title/Abstract])) AND ("1900/01/01"[Date - Publication] : "2026/07/17"[Date - Publication])
```

#### PE-ATHLETE-MONITORING: 260

```text
(("athlete monitoring"[Title/Abstract] OR "training load monitoring"[Title/Abstract] OR "training response"[Title/Abstract]) AND (validity[Title/Abstract] OR reliability[Title/Abstract] OR responsiveness[Title/Abstract] OR sensitivity[Title/Abstract] OR variability[Title/Abstract] OR "decision making"[Title/Abstract])) AND ("1900/01/01"[Date - Publication] : "2026/07/17"[Date - Publication])
```

#### PE-SPORT-SINGLE-CASE: 3,617

```text
(("single-case"[Title/Abstract] OR "single subject"[Title/Abstract] OR "multiple baseline"[Title/Abstract] OR "replicated single-subject"[Title/Abstract]) AND (sport*[Title/Abstract] OR athlete*[Title/Abstract] OR training[Title/Abstract] OR performance[Title/Abstract])) AND ("1900/01/01"[Date - Publication] : "2026/07/17"[Date - Publication])
```

The last query was intentionally broad and noisy. It was used for source discovery, not
as a count of eligible sport SCEDs.

### Exact supplementary discovery queries

```text
site:ies.ed.gov What Works Clearinghouse single-case design standards 5 data points phase technical documentation
site:ahrq.gov "Design and Implementation of N-of-1 Trials" carryover washout
site:pubmed.ncbi.nlm.nih.gov "Single-subject research designs and data analyses for assessing elite athletes' conditioning"
site:pubmed.ncbi.nlm.nih.gov "Statistical Tests for Sports Science Practitioners: Identifying Performance Gains in Individual Athletes"
site:pubmed.ncbi.nlm.nih.gov "Determining the Effects of a 6-Week Training Intervention on Reactive Strength"
site:pubmed.ncbi.nlm.nih.gov "The Problem with Magnitude-Based Inference"
site:pubmed.ncbi.nlm.nih.gov "Consensus on Measurement Properties and Feasibility of Performance Tests"
site:pubmed.ncbi.nlm.nih.gov N-of-1 single-case design autocorrelation trend carryover multiple baseline methodology CENT SCRIBE
```

Candidate metadata were then verified by exact PMID through PubMed ESummary and, when
available, PMCID through PMC. DOI resolution was checked against the PubMed article ID.

## 4. Source Extraction

Full-text labels mean:

- `FULL_TEXT_VERIFIED`: relevant full-text methods/results or official standards text
  was accessible and checked.
- `ABSTRACT_ONLY`: extraction was limited to PubMed abstract and metadata; no inference
  was made from an unseen full text.
- `OFFICIAL_FULL_TEXT_AVAILABLE, ABSTRACT_USED`: an official full-text URL exists, but
  automated access was blocked or the extraction remained abstract-based.

### Measurement error, reliability, responsiveness, CV/SEM/MDC/SWC

#### E01. Atkinson and Nevill (1998)

- **Source:** *Statistical methods for assessing measurement error (reliability) in variables relevant to sports medicine*.
- **Type:** Methodological review.
- **DOI / PMID:** `10.2165/00007256-199826040-00002` / `9820922`.
- **URL:** https://pubmed.ncbi.nlm.nih.gov/9820922/
- **Full-text state:** `ABSTRACT_ONLY`.
- **Method:** Separates systematic bias and random error; distinguishes relative
  reliability from absolute error; discusses SEM, CV, and limits of agreement.
- **Requirements:** Multiple retests; inspect bias and whether error is additive or
  proportional; do not rely on correlation alone.
- **Limitations:** Formula choice and heteroscedasticity matter. Reliability from one
  sample/protocol does not automatically transfer to another athlete, device, or test.
- **Product implication:** Store metric/protocol-specific error, scale assumption, and
  uncertainty. A change can reach level 3 only against a compatible error estimate.

#### E02. Hopkins (2000)

- **Source:** *Measures of reliability in sports medicine and science*.
- **Type:** Methodological review.
- **DOI / PMID:** `10.2165/00007256-200030010-00001` / `10907753`.
- **URL:** https://pubmed.ncbi.nlm.nih.gov/10907753/
- **Full-text state:** `ABSTRACT_ONLY`.
- **Method:** Promotes typical error as a practical measure of within-subject test-retest
  variability and discusses precision of reliability estimates.
- **Requirements:** Repeated trials under the same protocol; reliability estimates need
  their own adequate study design and uncertainty.
- **Limitations:** The paper's approximate participant/trial guidance concerns estimating
  reliability at study level. It is not a universal minimum baseline for one athlete.
- **Product implication:** Do not convert the cited trial guidance into a product `n`
  gate. Import only validated metric-specific error estimates with provenance.

#### E03. Weir (2005)

- **Source:** *Quantifying test-retest reliability using the intraclass correlation coefficient and the SEM*.
- **Type:** Methods/tutorial paper.
- **DOI / PMID:** `10.1519/15184.1` / `15705040`.
- **URL:** https://pubmed.ncbi.nlm.nih.gov/15705040/
- **Full-text state:** `ABSTRACT_ONLY`.
- **Method:** Explains ICC selection, SEM, and interpretation of individual change from
  test-retest data.
- **Requirements:** State the ICC model, variance components, SEM calculation, and the
  confidence level used for any MDC/individual change bound.
- **Limitations:** ICC is sample-heterogeneity dependent; different ICC and SEM formulas
  can yield different values.
- **Product implication:** Schema must store method/version, not only a naked `SEM` or
  `MDC` number. Level 3 requires calculation provenance.

#### E04. Currell and Jeukendrup (2008)

- **Source:** *Validity, reliability and sensitivity of measures of sporting performance*.
- **Type:** Sports-performance measurement review.
- **DOI / PMID:** `10.2165/00007256-200838040-00003` / `18348590`.
- **URL:** https://pubmed.ncbi.nlm.nih.gov/18348590/
- **Full-text state:** `ABSTRACT_ONLY`.
- **Method:** Integrates validity, reliability, and sensitivity when judging whether a
  performance test can detect practically relevant change.
- **Requirements:** The test must represent the target performance construct and have
  error small enough relative to the intended worthwhile change.
- **Limitations:** Evidence is test-, sport-, and population-specific; laboratory
  sensitivity does not guarantee competition validity.
- **Product implication:** A reliable but invalid proxy cannot promote a claim. Keep
  validity, reliability, and responsiveness as separate registry properties.

#### E05. Robertson et al. (2017)

- **Source:** *Consensus on measurement properties and feasibility of performance tests for the exercise and sport sciences: a Delphi study*.
- **Type:** Two-round Delphi consensus, 33 experts.
- **DOI / PMID:** `10.1186/s40798-016-0071-y` / `28054257`.
- **URL:** https://pmc.ncbi.nlm.nih.gov/articles/PMC5215201/
- **Full-text state:** `FULL_TEXT_VERIFIED`.
- **Method:** Builds a taxonomy/checklist covering validity, reliability,
  responsiveness/sensitivity, interpretability, and feasibility.
- **Requirements:** Select and evaluate a test for its intended population, purpose, and
  practical setting rather than treating measurement properties as universal labels.
- **Limitations:** Expert consensus and definitions do not validate a particular metric
  or provide an athlete-specific observation threshold.
- **Product implication:** Registry approval needs an intended-use statement and
  population/protocol evidence. `VALID` or `RELIABLE` alone is insufficient.

#### E06. Swinton et al. (2018)

- **Source:** *A Statistical Framework to Interpret Individual Response to Intervention: Paving the Way for Personalized Nutrition and Exercise Prescription*.
- **Type:** Applied statistical framework/review.
- **DOI / PMID:** `10.3389/fnut.2018.00041` / `29892599`.
- **URL:** https://pmc.ncbi.nlm.nih.gov/articles/PMC5985399/
- **Full-text state:** `FULL_TEXT_VERIFIED`.
- **Method:** Combines typical error and confidence intervals with SWC to distinguish
  uncertainty, meaningful change, biological variability, and apparent response.
- **Requirements:** Quantify baseline uncertainty; justify SWC; report confidence
  intervals; distinguish measurement error from biological response variability.
- **Limitations:** SWC remains decision/context dependent. A thresholded individual
  classification does not prove a stable person-by-intervention response.
- **Product implication:** Show both error-exceedance and worthwhile-change status with
  uncertainty. Neither status creates a causal or safety claim.

#### E07. Hecksteden et al. (2015)

- **Source:** *Individual response to exercise training - a statistical perspective*.
- **Type:** Methodological review.
- **DOI / PMID:** `10.1152/japplphysiol.00714.2014` / `25663672`.
- **URL:** https://pubmed.ncbi.nlm.nih.gov/25663672/
- **Full-text state:** `ABSTRACT_ONLY` (PubMed marks a free article, but this extraction
  used the abstract).
- **Method:** Decomposes apparent individual response into measurement error,
  subject-by-training interaction, and within-subject variation in training efficacy.
- **Requirements:** Relevant controls and, for stable individual-response claims,
  repeated interventions/replicated contrasts; measurement error must be modeled.
- **Limitations:** A control group alone may not reveal within-person variation in
  efficacy. Low signal-to-noise cannot be rescued for one athlete by a larger group.
- **Product implication:** One pre/post episode cannot establish that an athlete is a
  responder. Level 4 should say what happened under the planned comparison, not assign a
  permanent responder label.

#### E08. Bonafiglia et al. (2021)

- **Source:** *A Systematic Review Examining the Approaches Used to Estimate Interindividual Differences in Trainability and Classify Individual Responses to Exercise Training*.
- **Type:** Systematic review.
- **DOI / PMID:** `10.3389/fphys.2021.665044` / `34819869`.
- **URL:** https://pmc.ncbi.nlm.nih.gov/articles/PMC8606564/
- **Full-text state:** `FULL_TEXT_VERIFIED`.
- **Method:** Reviews statistical estimation of interindividual trainability and
  response-classification approaches; compares thresholds that do and do not account for
  error and SWC/MCID.
- **Requirements:** Estimate interindividual response variation statistically and include
  both error and a justified importance threshold when classifying responses.
- **Limitations:** Included studies and outcomes are heterogeneous; response categories
  remain sensitive to threshold method and do not establish within-athlete causality.
- **Product implication:** Do not use simple pre/post sign or group SD bands as a
  responder classifier. Record threshold method and classification uncertainty.

#### E09. Senn (2016)

- **Source:** *Mastering variation: variance components and personalised medicine*.
- **Type:** Statistical methods/critical essay.
- **DOI / PMID:** `10.1002/sim.6739` / `26415869`.
- **URL:** https://pmc.ncbi.nlm.nih.gov/articles/PMC5054923/
- **Full-text state:** `FULL_TEXT_VERIFIED`.
- **Method:** Uses variance components and replicated crossover logic to distinguish
  treatment-effect heterogeneity from ordinary within-person and measurement variation.
- **Requirements:** Evidence of a personal response requires repeatability of the
  individual contrast, not merely observed between-person spread.
- **Limitations:** Clinical examples are not sport-specific; the paper is deliberately
  skeptical and does not deny all heterogeneity, only unsupported attribution.
- **Product implication:** This is methodological opposition to naive personalization.
  Keep permanent response phenotype claims out of the ladder.

#### E10. Welsh and Knight (2015)

- **Source:** *"Magnitude-based inference": a statistical review*.
- **Type:** Statistical critique and re-expression of MBI.
- **DOI / PMID:** `10.1249/MSS.0000000000000451` / `25051387`.
- **URL:** https://pmc.ncbi.nlm.nih.gov/articles/PMC5642352/
- **Full-text state:** `FULL_TEXT_VERIFIED`.
- **Method:** Reconstructs MBI as nonstandard tests/approximate Bayesian calculations and
  evaluates its claimed sample-size advantages.
- **Requirements:** Use transparent confidence intervals or a fully specified Bayesian
  model; justify smallest important effects independently.
- **Limitations:** The critique targets MBI's inferential procedure, not the general idea
  of defining an important effect.
- **Product implication:** SWC may be displayed as a decision threshold, but MBI labels
  and reduced-sample claims must not power level 3 or 4.

#### E11. Sainani (2018)

- **Source:** *The Problem with "Magnitude-based Inference"*.
- **Type:** Simulation and mathematical statistical critique.
- **DOI / PMID:** `10.1249/MSS.0000000000001645` / `29683920`.
- **URL:** https://pubmed.ncbi.nlm.nih.gov/29683920/
- **Full-text state:** `ABSTRACT_ONLY`.
- **Method:** Reanalyzes MBI error rates across effect sizes, sample sizes, and smallest
  important effects.
- **Requirements:** Control and disclose Type I/II error behavior; use inferential methods
  whose operating characteristics match the claim.
- **Limitations:** Focused on MBI, not direct athlete-monitoring thresholds.
- **Product implication:** A "likely worthwhile" label cannot substitute for a valid
  uncertainty model. Small samples do not receive a special causal exemption.

### N-of-1, single-case, multiple-baseline, and serial-dependence methods

#### E12. Vohra et al. (2015), CENT

- **Source:** *CONSORT extension for reporting N-of-1 trials (CENT) 2015 Statement*.
- **Type:** Reporting guideline/consensus statement.
- **DOI / PMID:** `10.1136/bmj.h1738` / `25976398`.
- **URL:** https://www.bmj.com/content/350/bmj.h1738
- **Full-text state:** `OFFICIAL_FULL_TEXT_AVAILABLE, ABSTRACT_USED` (official BMJ page
  returned 403 to automated retrieval; PubMed abstract/metadata were verified).
- **Method:** Extends CONSORT for prospectively planned, multiple-crossover N-of-1 trials
  and series, including participant flow and period-level reporting.
- **Requirements:** Pre-specified interventions, outcomes, sequence, periods, stopping,
  analysis, harms, and protocol deviations; report the participant's complete trial flow.
- **Limitations:** A reporting guideline is not proof that a design is valid, adequately
  powered, clinically safe, or transferable to sport training.
- **Product implication:** Level 4 experiments need a frozen per-athlete protocol and
  period ledger. CENT compliance would not grant automated safety or efficacy authority.

#### E13. Kravitz and Duan, eds. (AHRQ, 2014)

- **Source:** *Design and Implementation of N-of-1 Trials: A User's Guide*, especially
  Chapter 4, Statistical Design and Analytic Considerations.
- **Type:** US Agency for Healthcare Research and Quality methods guide.
- **DOI / PMID:** No DOI / no PMID for the report.
- **URL:** https://effectivehealthcare.ahrq.gov/products/n-1-trials/research-2014-1
- **Full-text state:** `FULL_TEXT_VERIFIED` (official AHRQ chapter/PDF).
- **Method:** Covers balanced/randomized treatment periods, repeated assessment,
  autocorrelation, onset, carryover, washout, transition handling, and model checking.
- **Requirements:** Periods must be long enough for effect onset and carryover handling;
  use washout or analytic transition methods when justified; assessment burden and ethics
  constrain frequency and design.
- **Limitations:** Developed for clinical treatment comparisons. Training carryover may
  be the intended adaptation and cannot always be washed out without changing the question.
- **Product implication:** If overlapping adaptations cannot be separated, the product
  must not attribute an effect to one session/component. Period length remains hypothesis-
  specific, not a freshness or baseline constant.

#### E14. Tate et al. (2016), SCRIBE

- **Source:** *The Single-Case Reporting Guideline In Behavioural Interventions (SCRIBE) 2016 Statement*.
- **Type:** Delphi/consensus reporting guideline, 26 items.
- **DOI / PMID:** `10.1080/09602011.2016.1190533` / `27499422`.
- **URL:** https://pmc.ncbi.nlm.nih.gov/articles/PMC5214372/
- **Full-text state:** `FULL_TEXT_VERIFIED`.
- **Method:** Specifies transparent reporting of single-case design, participant,
  measures, phases, procedural fidelity, analysis, adverse events, and raw data/graphs.
- **Requirements:** Define phase sequence and replication, operationalize outcomes,
  report measurement reliability, intervention fidelity, analysis, and deviations.
- **Limitations:** Completeness of reporting does not ensure causal validity or adequate
  evidence. The guideline is behavioral, not athlete-monitoring validation.
- **Product implication:** Use the checklist as a level 4 experiment metadata contract,
  not as a pass/fail claim engine.

#### E15. Kratochwill et al. (WWC, 2010)

- **Source:** *Single-Case Design Technical Documentation*, Version 1.0 (Pilot).
- **Type:** US What Works Clearinghouse design and evidence standards.
- **DOI / PMID:** No DOI / no PMID.
- **URL:** https://ies.ed.gov/ncee/wwc/Document/229
- **Full-text state:** `FULL_TEXT_VERIFIED` (official IES page and PDF).
- **Method:** Separates design standards from visual evidence standards; requires
  repeated demonstrations and evaluates level, trend, variability, immediacy, overlap,
  and consistency. The 2010 pilot uses five phase points for standards without
  reservations and three for standards with reservations in applicable designs.
- **Requirements:** Systematic manipulation, interobserver agreement where relevant,
  enough repeated demonstrations, and design-specific phase adequacy.
- **Limitations:** These are education evidence-review standards, not a universal law of
  time series or athlete baselines. Point counts work only with the rest of the design.
- **Product implication:** Treat WWC counts as a reference for formal causal SCED review,
  never as the product's universal minimum `n` or freshness threshold.

#### E16. Lanovaz et al. (2023)

- **Source:** *Waiting for baseline stability in single-case designs: Is it worth the time and effort?*
- **Type:** Monte Carlo simulation/method comparison.
- **DOI / PMID:** `10.3758/s13428-022-01858-9` / `35469087`.
- **URL:** https://pmc.ncbi.nlm.nih.gov/articles/PMC10027773/
- **Full-text state:** `FULL_TEXT_VERIFIED`.
- **Method:** Compares fixed, response-guided, and random baseline lengths while varying
  trend/variability and evaluating conservative dual-criteria and machine-learning
  analysis error/power.
- **Requirements:** Baseline decisions and analysis must be considered jointly; simulation
  conditions and target error rates should match the intended design.
- **Limitations:** Results are method- and simulation-specific; authors call for
  replication with other designs and time-varying graph parameters.
- **Product implication:** This is opposition to rigid "wait until stable" dogma, not
  permission to ignore trend or use one point. Baseline sufficiency remains design-specific.

#### E17. Tang and Landes (2020)

- **Source:** *Some t-tests for N-of-1 trials with serial correlation*.
- **Type:** Statistical method development and Monte Carlo evaluation.
- **DOI / PMID:** `10.1371/journal.pone.0228077` / `32017772`.
- **URL:** https://pmc.ncbi.nlm.nih.gov/articles/PMC6999905/
- **Full-text state:** `FULL_TEXT_VERIFIED`.
- **Method:** Develops paired and two-sample serial t-tests for level/rate change and
  compares their error, power, and interval width with ordinary t-tests.
- **Requirements:** Specify serial correlation structure and the intended level or rate
  contrast; use repeated observations/crossovers sufficient for the chosen model.
- **Limitations:** Model assumptions still require checking; the authors warn against
  analysis with very few observations.
- **Product implication:** Ordinary independent t-tests are invalid defaults for level 4.
  If serial structure cannot be supported, retain descriptive output.

#### E18. Smith (2012)

- **Source:** *Single-case experimental designs: a systematic review of published research and current standards*.
- **Type:** Systematic methodological review of 409 studies.
- **DOI / PMID:** `10.1037/a0029312` / `22845874`.
- **URL:** https://pmc.ncbi.nlm.nih.gov/articles/PMC3652808/
- **Full-text state:** `FULL_TEXT_VERIFIED`.
- **Method:** Reviews SCED design, measurement, baseline sampling, and analysis against
  contemporary standards.
- **Requirements:** Repeated measurement, operationalized outcomes, experimental
  manipulation/replication, and transparent visual/statistical analysis.
- **Limitations:** Behavioral-health literature; analytic method remains an area of
  disagreement, and visual analysis alone has limited reproducibility.
- **Product implication:** Do not reduce SCED quality to a sample count. Represent design,
  measurement quality, replication, trend, and analysis as separate gates.

#### E19. Tanious and Onghena (2019)

- **Source:** *Randomized Single-Case Experimental Designs in Healthcare Research: What, Why, and How?*
- **Type:** Methods/tutorial review with applied examples.
- **DOI / PMID:** `10.3390/healthcare7040143` / `31766188`.
- **URL:** https://pmc.ncbi.nlm.nih.gov/articles/PMC6955662/
- **Full-text state:** `FULL_TEXT_VERIFIED`.
- **Method:** Shows randomization options for ABAB, alternating-treatment, multiple-
  baseline, and changing-criterion designs with visual, effect-size, and randomization
  inference.
- **Requirements:** Randomize intervention start/order where feasible and analyze using
  the actual randomization scheme; select a design matching reversibility and question.
- **Limitations:** Healthcare examples; randomization does not fix poor measurement,
  carryover, missingness, or an intervention that cannot be withdrawn.
- **Product implication:** Prefer prospective randomization/counterbalancing for level 4.
  A nonrandom historical split receives weaker wording and explicit confounding flags.

### Athlete monitoring and sport applications

#### E20. Bourdon et al. (2017)

- **Source:** *Monitoring Athlete Training Loads: Consensus Statement*.
- **Type:** International sport-science consensus statement.
- **DOI / PMID:** `10.1123/IJSPP.2017-0208` / `28463642`.
- **URL:** https://pubmed.ncbi.nlm.nih.gov/28463642/
- **Full-text state:** `ABSTRACT_ONLY`.
- **Method:** Frames internal/external load selection, measurement, interpretation, and
  practical integration in athlete monitoring.
- **Requirements:** Use valid/reliable tools, consistent methods, contextual interpretation,
  and individual longitudinal data rather than isolated numbers.
- **Limitations:** Consensus does not validate every load metric or provide a universal
  minimum history. Monitoring associations do not prove injury causation or safety.
- **Product implication:** Monitoring can support levels 1-2 and contextualize level 3.
  It cannot clear training or create a causal load-response rule.

#### E21. Halson (2014)

- **Source:** *Monitoring training load to understand fatigue in athletes*.
- **Type:** Narrative review.
- **DOI / PMID:** `10.1007/s40279-014-0253-z` / `25200666`.
- **URL:** https://pmc.ncbi.nlm.nih.gov/articles/PMC4213373/
- **Full-text state:** `FULL_TEXT_VERIFIED`.
- **Method:** Reviews external and internal load, perception, heart-rate, biochemical,
  neuromuscular, questionnaire, diary, psychomotor, and sleep markers.
- **Requirements:** Individualize marker selection and interpret internal/external load
  together and longitudinally.
- **Limitations:** The review states that few markers have strong supporting evidence and
  no single definitive marker exists. Fatigue monitoring is not medical diagnosis.
- **Product implication:** No single metric should dominate the ladder. Discordant markers
  stay visible and unresolved rather than being collapsed into a readiness score.

#### E22. Saw, Main, and Gastin (2016)

- **Source:** *Monitoring the athlete training response: subjective self-reported measures trump commonly used objective measures: a systematic review*.
- **Type:** Systematic review of 56 original studies.
- **DOI / PMID:** `10.1136/bjsports-2015-094758` / `26423706`.
- **URL:** https://pmc.ncbi.nlm.nih.gov/articles/PMC4789708/
- **Full-text state:** `FULL_TEXT_VERIFIED`.
- **Method:** Compares concurrent subjective and objective wellbeing measures and their
  response to acute/chronic training load.
- **Requirements:** Standardize timing and instrument; retain subjective context rather
  than expecting agreement with objective markers.
- **Limitations:** Measures often did not correlate; review heterogeneity prevents a
  universal threshold. Sensitivity to load is observational, not causal or safety proof.
- **Product implication:** Preserve subjective and objective streams separately, with
  provenance and disagreement state. No automatic fusion or safety inference.

#### E23. Kinugasa, Cerin, and Hooper (2004)

- **Source:** *Single-subject research designs and data analyses for assessing elite athletes' conditioning*.
- **Type:** Sport-specific methodological review.
- **DOI / PMID:** `10.2165/00007256-200434150-00003` / `15575794`.
- **URL:** https://pubmed.ncbi.nlm.nih.gov/15575794/
- **Full-text state:** `ABSTRACT_ONLY`.
- **Method:** Reviews AB, reversal, multiple-baseline, alternating-treatment, visual, and
  statistical approaches for individual elite-athlete conditioning.
- **Requirements:** Repeated athlete-specific observations and a design matching the
  intervention; address serial dependency and multivariate context.
- **Limitations:** Methodological advocacy rather than a validated universal procedure;
  applied sport constraints can weaken manipulation and replication.
- **Product implication:** Supports an athlete-specific level 4 lane while explicitly
  preserving serial-dependence and design-quality gates.

#### E24. Harry et al. (2024)

- **Source:** *Statistical Tests for Sports Science Practitioners: Identifying Performance Gains in Individual Athletes*.
- **Type:** Practitioner methods report with a four-athlete CMJ example.
- **DOI / PMID:** `10.1519/JSC.0000000000004727` / `38662890`.
- **URL:** https://pubmed.ncbi.nlm.nih.gov/38662890/
- **Full-text state:** `ABSTRACT_ONLY`.
- **Method:** Compares a model statistic, SWC, CV, and SEM in five biweekly CMJ test
  sessions from four NCAA Division I basketball athletes; recommends model statistic plus
  CV for that use.
- **Requirements:** Replicated individual tests, consistent protocol, and joint attention
  to randomness and worthwhile magnitude.
- **Limitations:** Very small, narrow applied example. Five sessions and its method choice
  are not a universal athlete-monitoring minimum or validation across metrics.
- **Product implication:** Useful prototype for an error-aware individual report, but the
  product must not hard-code five sessions, biweekly cadence, or CV as universally best.

#### E25. Southey et al. (2025)

- **Source:** *Determining the Effects of a 6-Week Training Intervention on Reactive Strength: A Single-Case Experimental Design Approach*.
- **Type:** Primary sport SCED application.
- **DOI / PMID:** `10.3390/jfmk10020191` / `40566441`.
- **URL:** https://pmc.ncbi.nlm.nih.gov/articles/PMC12194246/
- **Full-text state:** `FULL_TEXT_VERIFIED`.
- **Method:** Nonconcurrent multiple-baseline SCED; four participants completed weekly
  reactive-strength testing over 5-7 baseline weeks and a 6-week resistance/plyometric
  intervention.
- **Requirements:** Repeated baseline and intervention measures, participant-level plots/
  estimates, and explicit combined versus individual interpretation.
- **Limitations:** Four cases, nonconcurrent baselines, one outcome family and intervention;
  history, concurrent training, serial dependence, and generalization remain concerns.
- **Product implication:** Demonstrates feasibility of sport multiple-baseline work and why
  cohort averages can obscure individual paths. Its 5-7-week baseline and 6-week exposure
  are application details, not product defaults or safety evidence.

## 5. Methodological Opposition and Reconciliation

| Disputed proposition | Supporting side | Opposing/corrective side | RQ-E resolution |
|---|---|---|---|
| Fixed phase-point standards define "enough data." | WWC uses design-specific phase counts within a formal evidence standard. | Lanovaz et al. question unsupported baseline-stability waiting rules under specific simulations; Smith shows analytic disagreement. | Do not invent universal `n`. Apply point-count standards only to the design and review regime they were created for. |
| A pre/post difference identifies a personal responder. | Applied personalization frameworks can classify changes after accounting for error/SWC. | Hecksteden, Senn, and Bonafiglia show measurement error, within-person variability, and threshold method can create apparent response. | Level 3 may state error-exceeding change; stable responder identity requires replicated prospective contrasts and remains outside the current ladder. |
| SWC plus MBI makes small-sample inference trustworthy. | SWC helps define practical importance. | Welsh/Knight and Sainani show MBI error-rate/sample-size claims are not justified. | Keep SWC, discard MBI labels. Report uncertainty and false-positive control. |
| More monitoring metrics increase certainty. | Consensus/reviews support mixed internal/external and subjective/objective monitoring. | Halson finds no definitive marker; Saw finds frequent subjective-objective disagreement. | Preserve streams and disagreement. Do not synthesize an opaque readiness/safety score. |
| Ordinary tests are adequate for repeated athlete data. | Simple pre/post and independent tests are common and easy. | Tang/Landes and AHRQ show serial correlation and carryover change uncertainty and sometimes inference. | Require serially valid/randomization analysis for level 4 or remain descriptive. |

## 6. Product Decision Implications

### Evidence object required for every metric

```text
metric_id
construct_and_intended_use
unit
device_method_firmware_protocol_version
observation_timestamp_and_timezone
quality_and_missingness_state
comparison_compatibility_state
reliability_source_and_population
error_model_and_scale
error_estimate_with_interval
important_change_definition_and_owner
coverage_count_span_cadence_contexts
trend_autocorrelation_carryover_confound_checks
claim_level
claim_text_and_prohibited_inferences
```

### Fail-closed promotion logic

- Missing provenance or incompatible protocol: remain `OBSERVATION` or `UNKNOWN`.
- Inadequate/unknown context coverage: do not create `DESCRIPTIVE_BASELINE`.
- No compatible error study or unjustified error formula: do not create
  `MEASUREMENT_ERROR_EXCEEDING_CHANGE`.
- Retrospective window selection, unresolved trend/autocorrelation/carryover/confounding,
  or no prospective protocol: do not create `PROSPECTIVE_HYPOTHESIS_COMPARISON`.
- At every level, causality, efficacy, safety, injury prediction, diagnosis, readiness,
  medical clearance, and automatic plan change remain prohibited unless separately
  established by an appropriate authority and evidence lane.

## 7. Remaining Evidence Gaps

1. No source located a universal minimum observation count or data-age threshold across
   athlete-monitoring constructs. This absence is a finding, not permission to invent one.
2. Metric-specific reliability and MDC/SWC evidence still must be assembled for every
   Formation measure actually proposed for use.
3. Freshness must be specified from each construct's time scale, source latency, and
   decision use, then reviewed. It is currently `UNKNOWN` rather than a fixed duration.
4. Direct youth middle-distance N-of-1/multiple-baseline applications were not established
   by this methods set. Transfer from adult/other-sport methods requires separate review.
5. Database-complete screening, independent dual screening, and conflict adjudication have
   not been performed, so this artifact must not be called a systematic review.

## 8. Bottom Line

The defensible minimum is not a number. It is a claim-matched evidence package. One valid
record permits an observation; comparable repeated records permit a bounded description;
a compatible error model permits a noncausal error-exceeding change statement; and only a
prospective, design-valid, serially aware comparison permits a narrow within-athlete
hypothesis comparison. None of these levels, by itself, establishes safety or efficacy.
