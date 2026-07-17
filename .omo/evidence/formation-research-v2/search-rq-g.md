# RQ-G Search Evidence: Youth Safety Boundary And Human Handoff

```yaml
protocol: TO-FORMATION-RESEARCH-V2-2026-07-17
rq: RQ-G
search_run_date: 2026-07-17
search_through: 2026-07-17
packet_type: executable_raw_search_evidence
owner_product_identity: 9_5_DAY_FORMATION
owner_target_authority: DEFAULT_AUTOMATED_PRESCRIPTION
runtime_authority: false
medical_authority: false
prescription_activation: false
source_count: 22
private_note_signal: ZERO
```

## 1. Scope And Non-Claims

This packet searches the youth-safety boundary around TRAINORACLE's fixed 9.5-day
Formation identity. It does not test or change that owner decision. It defines inputs that
may only suppress candidate generation and hand the case to an appropriately qualified
human. It does not diagnose injury, illness, RED-S, a Female or Male Athlete Triad, bone
stress injury, tendon injury, apophysitis, sleep disorder, abuse, or maturity status. It
does not medically screen, estimate injury probability, declare recovery/readiness, or
clear participation.

The safe output vocabulary is deliberately asymmetric:

- `HUMAN_REVIEW_REQUIRED`: a candidate is suppressed until the named human process is
  complete.
- `NO_CONCERN_REPORTED`: only the participant's answer to the displayed structured
  question; it is never rendered or stored as `SAFE`, `CLEARED`, or `LOW_RISK`.
- `REQUEST_HUMAN_SUPPORT`: a participant-controlled route that does not require a narrative.
- There is no automated `CLEARED`, `RECOVERED`, `READY`, or `MEDICALLY_SAFE` state.

Private notes have zero signal. They are outside search, extraction, classification,
embedding, summarisation, routing, prescription, and explanation. A separate visible and
structured safety/support surface is required so that zero-signal notes do not become a
hidden safeguarding mechanism.

## 2. Exact Search Execution

PubMed/MEDLINE was queried through the NCBI E-utilities interface. Counts are the live
counts returned on 2026-07-17 and may change with indexing. These are discovery counts,
not screened inclusion counts.

### `RQG-PM-01` - Core youth runner safety search - 2,839 results

```text
(("Adolescent"[Mesh] OR "Child"[Mesh] OR youth[Title/Abstract] OR adolescent*[Title/Abstract]) AND ("Running"[Mesh] OR runner*[Title/Abstract] OR running[Title/Abstract] OR "Track and Field"[Title/Abstract] OR "cross-country"[Title/Abstract]) AND ("Athletic Injuries"[Mesh] OR injury[Title/Abstract] OR illness[Title/Abstract] OR pain[Title/Abstract] OR "stress fracture"[Title/Abstract] OR "bone stress"[Title/Abstract] OR tendon*[Title/Abstract] OR growth[Title/Abstract] OR matur*[Title/Abstract] OR "relative energy deficiency"[Title/Abstract] OR "energy availability"[Title/Abstract] OR sleep[Title/Abstract]))
```

### `RQG-PM-02` - Growth and maturity - 813 results

```text
(("Adolescent"[Mesh] OR youth[Title/Abstract]) AND (athlete*[Title/Abstract] OR sport*[Title/Abstract]) AND (growth[Title/Abstract] OR maturation[Title/Abstract] OR maturity[Title/Abstract] OR "peak height velocity"[Title/Abstract]) AND (injury[Title/Abstract] OR injuries[Title/Abstract] OR pain[Title/Abstract] OR apophys*[Title/Abstract] OR "growth plate"[Title/Abstract]))
```

### `RQG-PM-03` - Energy availability, RED-S, and sex-specific Triad evidence - 185 results

```text
(("Adolescent"[Mesh] OR youth[Title/Abstract] OR adolescent*[Title/Abstract]) AND (athlete*[Title/Abstract] OR runner*[Title/Abstract]) AND ("relative energy deficiency in sport"[Title/Abstract] OR RED-S[Title/Abstract] OR REDs[Title/Abstract] OR "low energy availability"[Title/Abstract] OR "female athlete triad"[Title/Abstract] OR "male athlete triad"[Title/Abstract]) AND (bone[Title/Abstract] OR injury[Title/Abstract] OR illness[Title/Abstract] OR menstrual[Title/Abstract] OR endocrine[Title/Abstract]))
```

### `RQG-PM-04` - Bone stress, tendon, and apophyseal injury - 681 results

```text
(("Adolescent"[Mesh] OR youth[Title/Abstract] OR adolescent*[Title/Abstract]) AND (runner*[Title/Abstract] OR running[Title/Abstract] OR athlete*[Title/Abstract]) AND ("bone stress injury"[Title/Abstract] OR "stress fracture"[Title/Abstract] OR tendon*[Title/Abstract] OR apophys*[Title/Abstract]) AND (risk[Title/Abstract] OR diagnosis[Title/Abstract] OR management[Title/Abstract] OR referral[Title/Abstract] OR "return to sport"[Title/Abstract]))
```

### `RQG-PM-05` - Sleep and injury/participation - 373 results

```text
(("Adolescent"[Mesh] OR youth[Title/Abstract] OR adolescent*[Title/Abstract]) AND (athlete*[Title/Abstract] OR sport*[Title/Abstract]) AND (sleep[Title/Abstract] OR "sleep deprivation"[Title/Abstract] OR "sleep duration"[Title/Abstract]) AND (injury[Title/Abstract] OR illness[Title/Abstract] OR pain[Title/Abstract] OR participation[Title/Abstract]))
```

### `RQG-PM-06` - Illness and return to sport - 220 results

```text
((athlete*[Title/Abstract] OR sport*[Title/Abstract]) AND ("Acute Disease"[Mesh] OR illness[Title/Abstract] OR infection[Title/Abstract] OR fever[Title/Abstract] OR "respiratory infection"[Title/Abstract]) AND (adolescent*[Title/Abstract] OR youth[Title/Abstract] OR consensus[Title/Abstract] OR guideline[Title/Abstract]) AND (participation[Title/Abstract] OR referral[Title/Abstract] OR "return to sport"[Title/Abstract] OR exercise[Title/Abstract]))
```

### `RQG-PM-07` - Safeguarding - 139 results

```text
(("Adolescent"[Mesh] OR "Child"[Mesh] OR youth[Title/Abstract]) AND (athlete*[Title/Abstract] OR sport*[Title/Abstract]) AND (safeguard*[Title/Abstract] OR abuse[Title/Abstract] OR harassment[Title/Abstract] OR "interpersonal violence"[Title/Abstract] OR maltreatment[Title/Abstract]) AND (consensus[Title/Abstract] OR guideline[Title/Abstract] OR policy[Title/Abstract] OR prevention[Title/Abstract]))
```

### Supplementary authoritative-site queries

The web search interface did not expose stable result counts. Exact strings were:

```text
site:bjsm.bmj.com "Youth running consensus statement" injury illness
site:publications.aap.org pediatrics "Overuse Injuries, Overtraining, and Burnout in Young Athletes"
site:bjsm.bmj.com "IOC consensus statement" "acute respiratory" athlete return to sport
site:bjsm.bmj.com "IOC consensus statement" "interpersonal violence" safeguarding sport
site:aasm.org "Recommended Amount of Sleep for Pediatric Populations"
site:pubmed.ncbi.nlm.nih.gov adolescent runners bone stress injury energy availability
site:pubmed.ncbi.nlm.nih.gov youth athlete growth maturation injury consensus
"International Safeguards for Children in Sport" official
```

Retrieval and identity were cross-checked against PubMed and Europe PMC. PubMed identifiers,
DOIs, PMC identifiers, and open-access state were checked on 2026-07-17. No included PubMed
record carried a retraction flag in Europe PMC. `S05` has a published correction; its
extraction is explicitly correction-aware. This packet is a targeted authority/directness
search, not completed two-reviewer PRISMA screening. Citation-chasing saturation has not
been claimed.

## 3. Consensus, Guideline, And Organisational Boundary Sources

### S01 - Youth running consensus statement

- **Identity:** Krabak et al., 2021. DOI
  [10.1136/bjsports-2020-102518](https://doi.org/10.1136/bjsports-2020-102518),
  PMID [33122252](https://pubmed.ncbi.nlm.nih.gov/33122252/).
- **Type / authority / directness:** international consensus statement; highest runner and
  youth directness in this packet.
- **Full-text state:** official publisher HTML located; abstract and accessible publisher
  sections reviewed; Europe PMC does not mark the article open access.
- **Population:** children and adolescent runners; the authors distinguish adolescent
  evidence from the much thinner preadolescent/puberty evidence.
- **Recommendation / result:** training, nutrition, health, and participation decisions
  should be individual and clinically judged. The review explicitly reports that suitable
  running-distance recommendations by age are opinion-based and that the youth-running
  evidence base is incomplete.
- **Limitations:** consensus informed by limited, mostly adolescent evidence; no validated
  age-to-distance, injury-prediction, or clearance rule.
- **Product implication:** do not generate age-based mileage ceilings, distance permission,
  or safety claims. An explicit pain, illness, nutrition/energy, or participation concern
  suppresses the Formation candidate and routes to a human; age alone never clears it.

### S02 - AAP overuse, overtraining, and burnout report

- **Identity:** Brenner and Watson/AAP Council on Sports Medicine and Fitness, 2024. DOI
  [10.1542/peds.2023-065129](https://doi.org/10.1542/peds.2023-065129), PMID
  [38247370](https://pubmed.ncbi.nlm.nih.gov/38247370/),
  [official full text](https://publications.aap.org/pediatrics/article/153/2/e2023065129/196435/Overuse-Injuries-Overtraining-and-Burnout-in-Young).
- **Type / authority / directness:** American Academy of Pediatrics clinical report; direct
  to young athletes, not runner-only.
- **Full-text state:** official HTML full text reviewed.
- **Population:** children and adolescent athletes.
- **Recommendation / result:** repetitive stress without sufficient recovery can produce
  bone, muscle, or tendon overuse injury; pain may progress from after activity to during
  activity with limitation and eventually rest. The report places clinical evaluation,
  counselling, and individual circumstances with clinicians.
- **Limitations:** clinical guidance, not a validated prediction model; recommendations are
  not an exclusive standard of care and the AAP notes individual variation.
- **Product implication:** any current pain, functional limitation, poor-sleep/fatigue/mood
  concern, or suspected overuse concern is a human-review input. The product may not decide
  whether pain is benign, diagnose overtraining, or prescribe rest/treatment.

### S03 - IOC youth athletic development consensus

- **Identity:** Bergeron et al., 2015. DOI
  [10.1136/bjsports-2015-094962](https://doi.org/10.1136/bjsports-2015-094962),
  PMID [26084524](https://pubmed.ncbi.nlm.nih.gov/26084524/),
  [official article](https://bjsm.bmj.com/content/49/13/843).
- **Type / authority / directness:** IOC consensus; broad youth-athlete authority, indirect
  to middle-distance prescription.
- **Full-text state:** official publisher HTML available and reviewed.
- **Population:** youth athletes across participation and performance levels.
- **Recommendation / result:** development should be healthy, inclusive, sustainable, and
  enjoyable, with athlete safeguarding policies and respect for individual development.
- **Limitations:** broad principles rather than runner-specific dose or referral thresholds.
- **Product implication:** participation benefit and autonomy matter alongside protection.
  A safety gate cannot be converted into blanket exclusion by age, sex, body size, or
  performance. Athlete non-participation or uncertainty must be respected without penalty.

### S04 - IOC elite youth competition consensus

- **Identity:** Bergeron et al., 2024. DOI
  [10.1136/bjsports-2024-108186](https://doi.org/10.1136/bjsports-2024-108186),
  PMID [39197945](https://pubmed.ncbi.nlm.nih.gov/39197945/),
  [official article](https://bjsm.bmj.com/content/58/17/946).
- **Type / authority / directness:** IOC consensus; direct to elite youth participation and
  competition, indirect to ordinary youth runners.
- **Full-text state:** official publisher HTML available and reviewed.
- **Population:** elite youth athletes approaching international competition.
- **Recommendation / result:** adolescence is non-linear and asynchronous; the model is
  child-centred and calls for safe, supportive settings, individual pathways, and protection
  from injury, illness, harassment, and abuse.
- **Limitations:** elite/Olympic context and expert synthesis; no Formation-specific test.
- **Product implication:** a recent competition is a factual schedule input, never proof of
  readiness or recovery. Missing/incompatible competition facts require coach review; a
  health concern requires qualified clinical review. Neither route permits automated
  post-competition clearance.

### S05 - 2023 IOC RED-S consensus, correction-aware

- **Identity:** Mountjoy et al., 2023. DOI
  [10.1136/bjsports-2023-106994](https://doi.org/10.1136/bjsports-2023-106994),
  PMID [37752011](https://pubmed.ncbi.nlm.nih.gov/37752011/),
  [official article](https://bjsm.bmj.com/content/57/17/1073). Correction: DOI
  [10.1136/bjsports-2023-106994corr1](https://doi.org/10.1136/bjsports-2023-106994corr1),
  PMID [38325885](https://pubmed.ncbi.nlm.nih.gov/38325885/).
- **Type / authority / directness:** IOC clinical consensus; includes female and male
  athletes and adolescent considerations, not youth-runner-specific.
- **Full-text state:** official publisher article/PDF available; correction identified and
  controlling for extraction.
- **Population:** female and male athletes exposed to low energy availability; broad ages
  and sports.
- **Recommendation / result:** RED-S is a clinical syndrome with health and performance
  consequences. Its clinical assessment and sport-participation framework are designed for
  trained clinicians and a multidisciplinary team.
- **Limitations:** heterogeneous evidence, evolving construct, no single universally valid
  diagnostic threshold; the CAT2 is not an automated product score.
- **Product implication:** never compute RED-S CAT2, infer low energy availability from
  training load/body size, or display a RED-S label. An athlete-reported fueling, eating,
  menstrual/hormonal, recurrent bone-stress, or clinician concern only triggers qualified
  human review.

### S06 - 2025 Female Athlete Triad update, Part 1

- **Identity:** De Souza et al., published 2026 (2025 update). DOI
  [10.1007/s40279-025-02333-z](https://doi.org/10.1007/s40279-025-02333-z),
  PMID [41474493](https://pubmed.ncbi.nlm.nih.gov/41474493/), PMCID
  [PMC12982264](https://pmc.ncbi.nlm.nih.gov/articles/PMC12982264/).
- **Type / authority / directness:** coalition consensus/state-of-science review; explicit
  adolescent female model.
- **Full-text state:** PMC open full text.
- **Population:** adolescent and adult female athletes.
- **Recommendation / result:** the updated model connects energy deficiency, reproductive
  function, and bone health and explicitly adds bone stress injury; it notes uncertainty
  about complete bone-health recovery.
- **Limitations:** female-specific construct; model components still require clinical
  measurement and interpretation.
- **Product implication:** sex-specific evidence must be retained in research, but sex alone
  is not a product decision rule. Offer an optional, privacy-reviewed structured way for an
  athlete to report a relevant health concern; never infer it from sex, weight, pace, or
  note text.

### S07 - 2025 Female Athlete Triad update, Part 2

- **Identity:** De Souza et al., published 2026 (2025 update). DOI
  [10.1007/s40279-025-02332-0](https://doi.org/10.1007/s40279-025-02332-0),
  PMID [41474492](https://pubmed.ncbi.nlm.nih.gov/41474492/), PMCID
  [PMC12982345](https://pmc.ncbi.nlm.nih.gov/articles/PMC12982345/).
- **Type / authority / directness:** clinical consensus guidelines for adolescents and
  adults.
- **Full-text state:** PMC open full text.
- **Population:** adolescent and adult female athletes.
- **Recommendation / result:** screening, diagnosis, treatment, and return-to-play are
  clinical functions; the update moves away from treating energy availability as one
  universal threshold and recommends multidisciplinary management.
- **Limitations:** clinical risk stratification is not a consumer software validation;
  female-specific and dependent on medical data the product should not collect casually.
- **Product implication:** no threshold, point system, menstrual-cycle rule, body-mass rule,
  or return-to-play category may be automated. Explicit concern -> human; no answer -> no
  adverse inference, but no candidate if the safety question is required and unresolved.

### S08 - Male Athlete Triad consensus, Part II

- **Identity:** Fredericson et al., 2021. DOI
  [10.1097/JSM.0000000000000948](https://doi.org/10.1097/JSM.0000000000000948),
  PMID [34091538](https://pubmed.ncbi.nlm.nih.gov/34091538/).
- **Type / authority / directness:** coalition consensus; direct to adolescent/young adult
  male endurance and lean-physique athletes.
- **Full-text state:** abstract verified; full text not retrieved in this search lane.
- **Population:** adolescent and young adult male athletes, especially endurance and
  weight-class sports.
- **Recommendation / result:** energy deficiency, reproductive-axis suppression, and
  impaired bone health can occur in males; screening/diagnosis/return-to-play belong to a
  multidisciplinary medical team.
- **Limitations:** smaller male evidence base and consensus extrapolation; not a validated
  youth-running software classifier.
- **Product implication:** do not treat RED-S/Triad as female-only and do not treat male sex
  as protective. Use the same non-diagnostic concern-and-referral path for every athlete.

### S09 - AASM pediatric sleep-duration consensus

- **Identity:** Paruthi et al., 2016. DOI
  [10.5664/jcsm.5866](https://doi.org/10.5664/jcsm.5866), PMID
  [27250809](https://pubmed.ncbi.nlm.nih.gov/27250809/), PMCID
  [PMC4877308](https://pmc.ncbi.nlm.nih.gov/articles/PMC4877308/).
- **Type / authority / directness:** American Academy of Sleep Medicine consensus;
  paediatric but not athlete-specific.
- **Full-text state:** PMC open full text.
- **Population:** healthy children and adolescents.
- **Recommendation / result:** regular sleep recommendations are 9-12 hours for ages 6-12
  and 8-10 hours for ages 13-18, using a modified RAND consensus process.
- **Limitations:** duration ranges promote general health; they are not athlete injury,
  recovery, or session-clearance thresholds.
- **Product implication:** a regular/persistent sleep concern may route to a human, but one
  night's hours may not clear or block a session as a medical judgment. Do not generate a
  readiness score from sleep duration.

### S10 - IOC acute respiratory infection consensus

- **Identity:** Schwellnus et al., 2022. DOI
  [10.1136/bjsports-2022-105759](https://doi.org/10.1136/bjsports-2022-105759),
  PMID [35863871](https://pubmed.ncbi.nlm.nih.gov/35863871/).
- **Type / authority / directness:** IOC clinical consensus; athlete-specific, youth
  directness low.
- **Full-text state:** official publisher record and accessible sections reviewed; Europe
  PMC does not mark it open access.
- **Population:** athletes with acute respiratory infection; not restricted to youth.
- **Recommendation / result:** return-to-sport consideration includes infection severity,
  athlete health risk, activity risk, and ongoing symptom monitoring and is framed for sport
  and exercise medicine clinicians.
- **Limitations:** respiratory focus, broad athlete population, limited direct youth runner
  evidence; it does not validate a consumer symptom checker.
- **Product implication:** any current illness concern or reported fever/chills, chest pain,
  breathing difficulty, fainting, or severe/unusual fatigue suppresses a candidate and
  routes to qualified human care. The system must not diagnose the infection or run a
  return-to-sport algorithm.

### S11 - Adolescent athlete and team physician consensus

- **Identity:** Putukian et al., published 2026 (2025 update). DOI
  [10.1249/MSS.0000000000003863](https://doi.org/10.1249/MSS.0000000000003863),
  PMID [41529152](https://pubmed.ncbi.nlm.nih.gov/41529152/).
- **Type / authority / directness:** multidisciplinary team-physician consensus; direct to
  adolescent athletes.
- **Full-text state:** abstract verified; full text not retrieved in this search lane.
- **Population:** adolescent athletes ages 12-18; children under 12 are explicitly outside
  its scope.
- **Recommendation / result:** growth/development, medical and musculoskeletal issues,
  psychological factors, overtraining, and return to sport require knowledgeable health-care
  assessment without discrimination.
- **Limitations:** consensus, not a prediction model; does not cover under-12 athletes.
- **Product implication:** age and developmental context are retained, but the product
  cannot estimate maturity or substitute for a team physician. Outside-population or
  unknown age/developmental context is a transfer limitation and human-review reason.

### S12 - 2024 IOC interpersonal violence and safeguarding consensus

- **Identity:** Tuakli-Wosornu et al., 2024. DOI
  [10.1136/bjsports-2024-108766](https://doi.org/10.1136/bjsports-2024-108766),
  PMID [39586634](https://pubmed.ncbi.nlm.nih.gov/39586634/),
  [official article](https://bjsm.bmj.com/content/58/22/1322).
- **Type / authority / directness:** IOC scoping-review plus Delphi consensus; direct to
  sport safeguarding, inclusive of children/youth.
- **Full-text state:** official publisher full text available and reviewed.
- **Population:** athletes across ages and levels, with child maltreatment/abuse explicitly
  distinguished.
- **Recommendation / result:** 43 statements reached consensus. The framework calls for an
  athlete-centred, whole-system, trauma- and violence-informed approach and accessible
  response mechanisms.
- **Limitations:** complex and partly subjective domain; several statements did not reach
  consensus; local legal and reporting duties vary.
- **Product implication:** provide a visible `REQUEST_HUMAN_SUPPORT`/safeguarding route to a
  trained safeguarding lead. Do not ask the model to decide whether a narrative is abuse,
  expose a disclosure to a coach by default, or let a disclosure feed plan generation.

### S13 - International Safeguards for Children in Sport

- **Identity:** International Safeguarding Children in Sport initiative, 2014 framework.
  DOI `NOT_ASSIGNED`; PMID `NOT_ASSIGNED`;
  [official standard](https://www.safesportinternational.com/standards/international-safeguards-for-children-in-sport/).
- **Type / authority / directness:** international organisational safeguarding standard;
  child-sport directness high, empirical authority lower than a systematic review.
- **Full-text state:** official HTML open.
- **Population:** children participating in sport, grassroots through elite.
- **Recommendation / result:** eight safeguards cover policy, concern-response procedures,
  advice/support, risk management, behaviour, recruitment/training, partnerships, and
  monitoring.
- **Limitations:** organisational standard rather than an outcome study; implementation and
  mandatory-reporting routes are jurisdiction-specific.
- **Product implication:** a real named safeguarding owner and tested response procedure
  must exist before collecting concerns. Software cannot be the safeguarding officer.

## 4. Direct Youth/Runner Evidence And Evidence Reviews

### S14 - Growth, maturation, and injury scoping review

- **Identity:** Parry et al., 2024. DOI
  [10.1136/bjsports-2024-108233](https://doi.org/10.1136/bjsports-2024-108233),
  PMID [39209526](https://pubmed.ncbi.nlm.nih.gov/39209526/), PMCID
  [PMC11420720](https://pmc.ncbi.nlm.nih.gov/articles/PMC11420720/).
- **Type / authority / directness:** scoping review of 30 eligible studies; direct to elite
  youth pathways, mixed-sport transfer to runners.
- **Full-text state:** PMC open full text.
- **Population:** elite youth athletes.
- **Recommendation / result:** injury incidence/burden generally increased with maturity
  status; growth-related injuries peaked around the growth spurt; faster stature/lower-limb
  growth was associated with greater incidence/burden. Maturity timing was not clear or
  consistent.
- **Limitations:** heterogeneous samples and definitions; female athletes and sport diversity
  underrepresented; association is not individual prediction.
- **Product implication:** permit an athlete/guardian to report a growth-change concern, but
  never estimate peak-height velocity, skeletal age, or maturity status from age/height or
  turn a cohort association into a clearance rule.

### S15 - Prospective adolescent athletics growth study

- **Identity:** Wik et al., 2020. DOI
  [10.1111/sms.13635](https://doi.org/10.1111/sms.13635), PMID
  [32034797](https://pubmed.ncbi.nlm.nih.gov/32034797/).
- **Type / authority / directness:** prospective cohort; direct to male elite adolescent
  athletics, 117 athlete-seasons.
- **Full-text state:** abstract verified; full text not retrieved in this search lane.
- **Population:** male adolescent athletics academy athletes.
- **Recommendation / result:** per 1 SD higher stature growth rate, bone-injury IRR was 1.5
  (95% CI 1.1-1.9) and growth-plate injury IRR 2.1 (1.5-3.1); leg-length growth rate was also
  associated with bone/growth-plate injury. Greater skeletal maturity was associated with
  fewer growth-plate injuries.
- **Limitations:** small, male, elite single-academy sample; observational; multiple growth
  measures and injury types; not a self-service maturity algorithm.
- **Product implication:** a reported rapid-growth or growth-related-pain concern is enough
  for human review. The numeric IRRs must never be converted to an individual injury score.

### S16 - Prospective stress fractures in adolescent runners

- **Identity:** Tenforde et al., 2013. DOI
  [10.1249/MSS.0b013e3182963d75](https://doi.org/10.1249/MSS.0b013e3182963d75),
  PMID [23584402](https://pubmed.ncbi.nlm.nih.gov/23584402/).
- **Type / authority / directness:** prospective cohort; direct youth runner and sex-stratified
  evidence.
- **Full-text state:** abstract verified; full text not retrieved in this search lane.
- **Population:** 748 competitive high-school runners (442 girls, 306 boys); follow-up data
  for 428 girls and 273 boys over mean 2.3 seasons.
- **Recommendation / result:** prospective stress fractures occurred in 5.4% of girls and
  4.0% of boys. Prior fracture was the most robust predictor in both sexes. Female-specific
  associations included BMI below 19, menarche at 15 or later, and prior gymnastics/dance;
  male findings differed.
- **Limitations:** low event counts (23 girls, 11 boys), self-reported baseline factors,
  older cohort, and multivariable associations that do not establish causal thresholds.
- **Product implication:** record only an explicit prior clinician-diagnosed fracture/BSI or
  current concern and route it. Do not use BMI, sex, menarche age, or sport history as an
  automated risk score or restriction.

### S17 - High-school/collegiate cross-country injury-risk systematic review

- **Identity:** Hartwell et al., 2024. DOI
  [10.2519/jospt.2023.11550](https://doi.org/10.2519/jospt.2023.11550),
  PMID [37970801](https://pubmed.ncbi.nlm.nih.gov/37970801/).
- **Type / authority / directness:** systematic review of prospective runner cohorts; direct
  to high-school runners but mixed with collegiate populations.
- **Full-text state:** abstract verified; full text not retrieved in this search lane.
- **Population:** high-school and collegiate cross-country runners.
- **Recommendation / result:** sex and prior running-related injury were the strongest
  predictors; certainty was moderate that greater RED-S-related risk was associated with
  injury, especially BSI. Certainty for training, sleep, and specialisation was low.
- **Limitations:** mixed adolescent/adult transition population, heterogeneous risk-factor
  definitions, and limited evidence for modifiable factors.
- **Product implication:** history and concern justify review but do not diagnose recurrence.
  Low-certainty training/sleep findings cannot justify automated readiness or injury-risk
  prediction.

### S18 - Bone stress injuries in adolescent athletes narrative review

- **Identity:** Beck and Drysdale, 2021. DOI
  [10.3390/sports9040052](https://doi.org/10.3390/sports9040052), PMID
  [33923520](https://pubmed.ncbi.nlm.nih.gov/33923520/), PMCID
  [PMC8073721](https://pmc.ncbi.nlm.nih.gov/articles/PMC8073721/).
- **Type / authority / directness:** narrative review; direct adolescent BSI scope, not
  runner-only.
- **Full-text state:** PMC open full text.
- **Population:** adolescent athletes.
- **Recommendation / result:** the review reports BSI incidence ranges of 3.9%-19% and
  recurrence as high as 21% across cited adolescent populations, and supports multidisciplinary
  management of load, energy balance, bone health, biomechanics, and psychological context.
- **Limitations:** narrative, heterogeneous denominator/diagnosis methods, minimal paediatric
  empirical evidence, and ranges unsuitable for individual prediction.
- **Product implication:** suspected/localised bone pain, a prior BSI, or a clinician's current
  restriction -> qualified human review. Do not infer BSI from load or provide management.

### S19 - Periphyseal stress injury systematic review

- **Identity:** Caine et al., 2022. DOI
  [10.1007/s40279-021-01511-z](https://doi.org/10.1007/s40279-021-01511-z),
  PMID [34370212](https://pubmed.ncbi.nlm.nih.gov/34370212/).
- **Type / authority / directness:** systematic review; skeletally immature youth directness,
  limited running-specific evidence.
- **Full-text state:** abstract verified; full text not retrieved in this search lane.
- **Population:** children/adolescents in repetitive youth sports.
- **Recommendation / result:** 101 of 128 reports were case reports/series. Among 448 reported
  patients, 57 (12.7%) had growth disturbance and 28 (6.2%) underwent surgery; delayed
  presentation/treatment appeared in harmful cases. Some imaging changes were asymptomatic.
- **Limitations:** case-report dominance, selection/publication bias, sparse prospective
  incidence data, mixed sports, and no symptom-screen validation.
- **Product implication:** pain during growth cannot be classified from a questionnaire;
  explicit localised bone/tendon-attachment pain, limp, functional limitation, or uncertainty
  is a human-review reason. Imaging or diagnosis is outside the product.

### S20 - Adolescent sleep and sports-injury meta-analysis

- **Identity:** Gao et al., 2019. DOI
  [10.1097/BPO.0000000000001306](https://doi.org/10.1097/BPO.0000000000001306),
  PMID [30888337](https://pubmed.ncbi.nlm.nih.gov/30888337/).
- **Type / authority / directness:** systematic review/meta-analysis; adolescent-athlete
  directness, low-level included evidence.
- **Full-text state:** abstract verified; full text not retrieved in this search lane.
- **Population:** athletes age 19 or younger; 7 studies.
- **Recommendation / result:** chronic poor sleep was associated with injury (random-effects
  OR 1.58, 95% CI 1.05-2.37). The two acute-sleep studies conflicted, and the authors conclude
  that acute sleep evidence is not definitive.
- **Limitations:** only 7 studies, observational/self-report exposure, inconsistent sleep and
  injury definitions, and Level IV synthesis.
- **Product implication:** a regular/persistent sleep concern can be shown to a coach/qualified
  human, but a single poor night cannot be treated as an injury prediction or medical stop.

### S21 - Growing-bone pain clinical review

- **Identity:** Achar and Yamanaka, 2019. DOI `NOT_ASSIGNED`; PMID
  [31083875](https://pubmed.ncbi.nlm.nih.gov/31083875/),
  [official full text](https://www.aafp.org/afp/2019/0515/p610).
- **Type / authority / directness:** peer-reviewed clinical review; direct to growing
  children/adolescents, running transfer explicit but not a primary cohort.
- **Full-text state:** official AAFP HTML/PDF open and reviewed.
- **Population:** growing children/adolescents with apophyseal or osteochondral pain.
- **Recommendation / result:** running sports can affect hip, knee, and ankle growth-related
  sites. Diagnosis depends on history/examination and sometimes imaging; persistent pain or
  suspected serious pathology warrants clinical evaluation.
- **Limitations:** much guidance is expert opinion/consensus in the absence of trials;
  diagnosis-specific management is not product-transferable.
- **Product implication:** ask only whether pain/localised tenderness, limp, or activity
  limitation is present. Do not display an apophysitis/tendon diagnosis or treatment advice.

## 5. Counterevidence And Conceptual Disagreement

### S22 - RED-S versus Female Athlete Triad critique

- **Identity:** De Souza et al., 2014. DOI
  [10.1136/bjsports-2014-093958](https://doi.org/10.1136/bjsports-2014-093958),
  PMID [25037200](https://pubmed.ncbi.nlm.nih.gov/25037200/),
  [official free article](https://bjsm.bmj.com/content/48/20/1461).
- **Type / authority / directness:** peer-reviewed editorial/commentary; explicit opposing
  interpretation, not primary outcome evidence.
- **Full-text state:** official publisher full text open and reviewed.
- **Population:** conceptual discussion focused on female athletes, with male/diverse-athlete
  evidence gaps noted.
- **Recommendation / result:** the authors argued that the original 2014 RED-S construct
  overreached the then-available evidence and risked obscuring the better-established Female
  Athlete Triad.
- **Limitations:** polemical editorial responding to the 2014, not 2023, IOC statement;
  conflicts are conceptual rather than a comparative validation study.
- **Product implication:** terminology and models have evolved and remain clinician-facing.
  The robust product conclusion is referral on explicit concern, not automated labelling or
  allegiance to one scoring model.

## 6. Evidence-Constrained Product Boundary

### 6.1 Input state contract

Every required safety item uses exactly these participant-visible states:

```text
NO_CONCERN_REPORTED | CONCERN_REPORTED | PREFER_NOT_TO_ANSWER | NOT_ASKED
```

Imported factual records may additionally be `INCOMPATIBLE_RECORD`. Only
`NO_CONCERN_REPORTED` satisfies completion of that question, and it means only what it says.
`CONCERN_REPORTED`, `PREFER_NOT_TO_ANSWER`, `NOT_ASKED`, and `INCOMPATIBLE_RECORD` are
fail-closed for candidate generation. `PREFER_NOT_TO_ANSWER` and `NOT_ASKED` are specifically
`SUPPRESS_ONLY_NO_OUTBOUND_DISCLOSURE`: they imply no concern and create no recipient-visible,
network, audit, or telemetry event. A participant may always use `REQUEST_HUMAN_SUPPORT`
without entering detail.

### 6.2 Deterministic handoff inputs

Every "Human route" below is an eligible local support destination, not an automatic message.
Except for a separately approved jurisdiction-specific mandatory-reporting rule disclosed before
collection, non-emergency delivery requires a second explicit action after showing the exact
recipient, fields, purpose, retention, acknowledgement behavior, and withdrawal limits.

| Domain | Allowed explicit input | Fail-closed condition | Human route | Forbidden inference |
|---|---|---|---|---|
| Age/development | verified age band; participant/guardian growth-change concern | age missing/incompatible/outside reviewed scope; concern or prefer-not-answer | youth-qualified coach plus sports-medicine reviewer when health-related | skeletal age, peak-height velocity, maturity status, adult-height prediction |
| Sex-related health | optional relevant health-concern field, not a sex-based score | any reported menstrual/hormonal/fueling concern; unresolved required field | youth sports medicine plus qualified dietitian/mental-health support as selected by clinician | risk from sex alone; RED-S/Triad label; BMI or menarche threshold scoring |
| Pain/function | current pain; localised bone/tendon-area pain; pain at rest; limp/altered movement; activity limitation | any item reported, unknown, or incompatible with a restriction record | youth sports-medicine clinician | injury type, severity, causation, treatment, permission to run |
| Bone/tendon stress | prior clinician-diagnosed fracture/BSI; current suspected concern; existing clinician restriction | any yes/unknown/incompatible state | youth sports-medicine clinician | stress fracture, tendon injury, apophysitis, imaging need, recurrence probability |
| Illness | current illness affecting participation; explicit fever/chills, chest pain, breathing difficulty, fainting, severe/unusual fatigue | any item reported or unresolved | qualified health professional; explicit immediate-danger report also shows local emergency/support route | infection diagnosis, severity grade, "neck check", myocarditis inference, return-to-sport clearance |
| Energy availability/eating | participant-selected fueling/eating/weight-change concern; prior clinician concern | concern, prefer-not-answer on a required gate, or conflicting record | youth sports medicine with appropriately qualified dietitian and mental-health pathway | energy availability calculation, RED-S CAT2, eating-disorder diagnosis, body-composition target |
| Sleep | regular/persistent sleep concern or sleep problem affecting daily function/training | persistent concern or unresolved required question | guardian/coach and health professional as appropriate | injury probability, recovery/readiness, medical stop from one poor night |
| Recent competition | exact event/time and participant report; no recovery field derived from elapsed time | timing/result incompatible or participant reports health concern | coach for schedule facts; clinician for health concern | recovered because N hours elapsed; next-MAIN clearance |
| Participation | participant wants to participate; age/jurisdiction-appropriate assent/consent state | `NO`, `UNSURE`, withdrawn assent/consent, or coercion concern | participant/guardian and safeguarding lead when coercion is possible | motivation diagnosis; penalty for withdrawal; coach override |
| Safeguarding | visible `REQUEST_HUMAN_SUPPORT` or structured concern flag; narrative optional and routed outside planner | any concern, immediate-danger indication, or failed safeguarding route | named trained safeguarding lead under local procedure; emergency route when explicitly requested/indicated by the participant | abuse classification, credibility scoring, coach disclosure by default, plan adaptation from disclosure |
| Record integrity | clinician restriction, guardian/participant answer, coach schedule fact, and provenance | missing provenance, contradiction, stale required fact, or attempted override of restriction | owner appropriate to fact; clinician controls health restriction | resolve conflict by majority, recency guess, or model confidence |

Role separation is mandatory. A coach may resolve schedule facts but cannot clear a medical
concern. A clinician may assess health but does not replace participant assent. A safeguarding
lead handles safeguarding; the plan generator never receives disclosure content.

### 6.3 Immediate-support display is not medical automation

When a participant explicitly reports immediate danger or an emergency symptom on the
structured surface, the product may suppress the candidate and display jurisdiction-approved
instructions to contact local emergency services, a trusted adult, or the named safeguarding
route. It must not first classify or score the report, and it must not claim a diagnosis. Exact
copy, jurisdiction, age handling, and reporting obligations require safeguarding, clinical,
legal, and privacy approval before implementation.

### 6.4 Private-note zero-signal contract

```text
private_note -> no read
private_note -> no tokenisation
private_note -> no embedding or search index
private_note -> no summarisation or classification
private_note -> no safety/referral signal
private_note -> no coach/clinician/safeguarding notification
private_note -> no plan or explanation input
```

The absence of a structured concern may not be inferred from a private note, and the absence
of a note may not be inferred as absence of concern. The visible safety/support control is a
separate data surface with purpose limitation, minimum necessary collection, named access,
retention rules, and privacy review. Only route/status metadata may enter an audit trail after
privacy approval; narrative content remains outside Formation generation.

Explicit local backup or recipient sharing is a `USER_DIRECTED_FILE_OPERATION`. It does not
reclassify the private note, grant analysis consent, create standing coach access, or emit
analytics, reward, safety, or Formation events. If no approved recipient route is configured,
the product keeps the current coach-authored plan and local journal and shows correction, local
export, later review, and user-controlled sharing actions without requesting more disclosure.

## 7. Opposing Evidence And Guardrails

| Tension | Evidence | Boundary consequence |
|---|---|---|
| Youth running is beneficial, but distance-by-age safety limits are not evidence-based. | S01, S03 | no automated age-mileage ceiling or permission |
| Growth rate is associated with injury in some elite cohorts, but maturity timing findings are inconsistent and methods heterogeneous. | S14, S15 | accept an explicit growth concern; never estimate maturity or injury probability |
| Sex and prior injury predict runner injury at group level, but small event counts and sex-specific associations differ. | S16, S17 | retain sex-stratified evidence; do not restrict or score from sex/BMI/menarche |
| Chronic poor sleep is associated with injury, but acute sleep studies conflict. | S20; general duration context S09 | persistent concern may route; one night is not medical clearance or diagnosis |
| Some periphyseal imaging changes are asymptomatic, while delayed symptomatic cases can be harmful. | S19 | symptoms/concern route to clinician; no imaging inference from load or questionnaire |
| RED-S broadens sex/system coverage, while Triad experts challenged overreach and later updates changed concepts/threshold language. | S05-S08, S22 | no RED-S/Triad label, score, universal threshold, or automated return-to-play |
| Protection from harm and the benefits/autonomy of participation coexist. | S03, S04, S12 | no blanket exclusion; participant assent and human assessment are separate gates |
| Recent competition changes context but elapsed time is not recovery evidence. | S04 plus frozen RQ-B boundary | record exact fact; no readiness inference |

## 8. Knowledge Gaps

1. Direct prospective evidence for preadolescent and pubescent runners remains sparse; much
   youth-running evidence is adolescent.
2. No validated evidence-based age-to-distance, weekly-mileage, or 9.5-day Formation safety
   rule was found.
3. Growth/maturity injury research is dominated by male elite football/academy cohorts;
   female athletes, runners, community settings, and diverse regions are underrepresented.
4. Practical maturity measures have material method error and require expertise. No evidence
   validates product estimation of peak-height velocity or skeletal maturity.
5. Direct youth-runner tendon evidence is much thinner than bone-stress and broad overuse
   evidence. Apophyseal and tendon-region pain must remain an undifferentiated referral input.
6. Bone-stress studies use heterogeneous definitions and relatively few prospective events;
   recurrence and incidence ranges are not individual probabilities.
7. RED-S/Triad concepts, terminology, and thresholds have evolved. No source validates
   consumer software diagnosis, CAT2 automation, or a universal energy-availability cutoff.
8. Evidence in adolescent males has grown but remains smaller; sex-diverse and transgender
   youth evidence was not sufficient for a product rule in this search.
9. Chronic sleep associations do not resolve acute, within-athlete, single-night decisions.
10. Illness evidence located here is mostly broad athlete/respiratory guidance. Youth-specific,
    non-respiratory illness handoff rules require clinical review.
11. Safeguarding route, confidentiality, parental involvement, mandatory reporting, and
    emergency wording vary by jurisdiction and age. They cannot be inferred from sport
    science literature.
12. No study validates TRAINORACLE's proposed structured safety inputs, false-positive rate,
    missed-concern rate, referral completion, participant burden, or effect on participation.
13. No evidence shows that a no-concern response establishes medical safety, recovery, or
    readiness.
14. No evidence supports scanning private notes for safety. The zero-signal rule is a product
    privacy/safeguarding constraint and must be validated independently with privacy and
    safeguarding reviewers.

## 9. No-Medical-Automation Verification

The executable boundary passes only if all statements below remain true:

- [x] Safety inputs are explicit, participant-visible, structured reports or provenance-bearing
  human records, never derived from training data or private notes.
- [x] Any concern can only suppress a candidate and route to a named human process.
- [x] No diagnosis label, injury probability, illness severity, maturity estimate, RED-S/Triad
  score, or treatment advice is produced.
- [x] No sleep, pain, illness, competition, or elapsed-time input becomes readiness, recovery,
  safety, or next-MAIN clearance.
- [x] Sex is retained as an evidence modifier but is not itself a restriction or clearance
  input.
- [x] Participant non-participation, uncertainty, and withdrawal are protected.
- [x] Safeguarding content remains outside the plan generator and is routed to a trained human
  under an approved local procedure.
- [x] Private-note zero-signal is explicit and testable.
- [x] Runtime authority and prescription activation remain false.

## 10. Required Human Gates Before Any Canonical Rule

This raw search does not authorize implementation. At minimum, written approval is required
from:

- a youth endurance/sport-science reviewer for transfer and runner directness;
- a youth sports-medicine clinician for every health input, route, and non-claim;
- a qualified safeguarding reviewer for concern, emergency, assent, and confidentiality
  handling;
- a qualified privacy reviewer for fields, access, retention, audit metadata, and private-note
  zero-signal verification;
- the product owner for exact schema/defaults and any future runtime activation.

Unavailable expertise, unresolved disagreement, missing jurisdictional procedure, or a failed
handoff test leaves the affected rule unimplemented and fail-closed.

[RQ_G_SEARCH_EXECUTED]
[NO_MEDICAL_AUTOMATION]
[PRIVATE_NOTE_ZERO_SIGNAL]
