# RQ-F raw evidence: participant-visible feasibility pilot

## Scope lock

- Search executed: 2026-07-17. New searching stopped at the bounded-recovery instruction.
- Product identity is fixed: a default automated 9.5-day prescription. This pilot does not decide adoption or identity.
- Pilot workflow: compare a generated candidate and explanation with a timestamped coach-authored plan in a participant-visible, non-hidden parallel comparison. The coach plan remains authoritative.
- Allowed outcomes: candidate/no-candidate, coach agreement/disagreement, explanation comprehension, input burden, completion/withdrawal, record completeness, process exceptions, and stop/coach handoff.
- Prohibited claims: efficacy, safety, injury prevention, physiological validity, causal benefit, or recruitment authority.

## Exact queries

PubMed/MEDLINE queries were run as written; counts are the returned counts observed on 2026-07-17.

| Query ID | Exact query | Count |
|---|---|---:|
| F0 | `(adolescent OR youth) AND (runner* OR "middle distance" OR "endurance athlete*") AND (pilot OR feasibility OR acceptability OR monitoring OR "decision support")` | 197 |
| F1 | `((adolescent[Title/Abstract] OR youth[Title/Abstract]) AND (athlete*[Title/Abstract] OR runner*[Title/Abstract]) AND (monitoring[Title/Abstract] OR wearable*[Title/Abstract] OR "self-report"[Title/Abstract]) AND (acceptability[Title/Abstract] OR feasibility[Title/Abstract] OR burden[Title/Abstract] OR adherence[Title/Abstract]))` | 32 |
| F2 | `((runner*[Title/Abstract] OR "middle-distance"[Title/Abstract] OR "long-distance"[Title/Abstract]) AND (mHealth[Title/Abstract] OR monitoring[Title/Abstract] OR "self-report"[Title/Abstract]) AND (accept*[Title/Abstract] OR usability[Title/Abstract] OR adherence[Title/Abstract] OR feedback[Title/Abstract]))` | 108 |
| F3 | `((child*[Title/Abstract] OR adolescen*[Title/Abstract]) AND wearable*[Title/Abstract] AND (acceptability[Title/Abstract] OR usability[Title/Abstract] OR feasibility[Title/Abstract] OR burden[Title/Abstract]))` | 415 |
| F4 | `((feasibility stud*[Title] OR pilot stud*[Title]) AND (acceptability[Title/Abstract] OR implementation[Title/Abstract] OR progression[Title/Abstract] OR design[Title/Abstract]))` | 21625 |
| F5 | `(("decision support system*"[Title/Abstract] OR "clinical decision support"[Title/Abstract]) AND (explainab*[Title/Abstract] OR explanation[Title/Abstract] OR comprehension[Title/Abstract] OR "human factors"[Title/Abstract]) AND (pilot[Title/Abstract] OR evaluation[Title/Abstract] OR guideline[Title/Abstract]))` | 311 |
| F6 | `(("silent trial"[Title/Abstract] OR "shadow evaluation"[Title/Abstract] OR "shadow mode"[Title/Abstract]) AND (prospective[Title/Abstract] OR noninterventional[Title/Abstract] OR decision-support[Title/Abstract] OR algorithm*[Title/Abstract]))` | 13 |
| F7 | `((child*[Title/Abstract] OR adolescen*[Title/Abstract]) AND (research[Title/Abstract] OR pilot[Title/Abstract]) AND (assent[Title/Abstract] OR "parental permission"[Title/Abstract] OR withdrawal[Title/Abstract] OR dissent[Title/Abstract]))` | 2108 |
| F8 | `(("single-case experimental"[Title/Abstract] OR "single case experimental"[Title/Abstract] OR SCED[Title/Abstract]) AND (feasibility[Title/Abstract] OR carryover[Title/Abstract] OR withdrawal[Title/Abstract] OR "multiple baseline"[Title/Abstract] OR reporting[Title/Abstract]))` | 374 |

Supplemental exact web-title queries used to resolve included records:

```text
"Monitoring health and wellbeing in adolescent track and field" DOI
"Feasibility of Data Collection Via Consumer-Grade Wearable Devices" DOI
"Wearable Activity Tracker Use Among Australian Adolescents" DOI
"Translatability of a Wearable Technology Intervention" DOI
"Monitoring health and well-being in elite athletes" DOI
"Acceptability and perceptions of end-users towards an online sports-health surveillance system" DOI
PubMed "How We Design Feasibility Studies"
PubMed "Defining Feasibility and Pilot Studies in Preparation for Randomised Controlled Trials"
site:pubmed.ncbi.nlm.nih.gov DECIDE-AI reporting guideline early-stage evaluation
site:pubmed.ncbi.nlm.nih.gov "Explainability for artificial intelligence in healthcare"
"silent trial" clinical algorithm shadow mode healthcare AI prospective
site:cioms.ch ethical guidelines children adolescents assent dissent withdrawal PDF
site:hra.nhs.uk research involving children consent assent withdrawal
PubMed "Single-case experimental designs to assess intervention effectiveness in rehabilitation"
PubMed SCRIBE 2016 single-case reporting guideline
```

Search coverage is targeted, not systematic. SPORTDiscus, Scopus, Web of Science, and Cochrane were `ACCESS_UNAVAILABLE_IN_EXECUTION_LANE`; no exhaustive-coverage claim is made.

## Source extraction

Directness labels: `TARGET_DIRECT` = adolescent athletics; `YOUTH_DIRECT` = adolescents but broader setting; `ATHLETE_INDIRECT` = adult/young-adult athletes; `METHOD_ONLY` = transferable design/ethics guidance.

### FRV2-F-001 - Bunce et al. (2026)

- Source/type: *Monitoring health and wellbeing in adolescent track and field (athletics) athletes: A co-creation study*; mixed-method co-creation study.
- DOI/PMID/URL/full text: `10.1371/journal.pone.0341972`; PMID `41758806`; PMCID `PMC12948129`; https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0341972; `FULL_TEXT_VERIFIED`.
- Population/design/directness: 53 England Athletics Youth Talent Programme athletes age 16-18, including 29 endurance athletes; survey plus athlete/staff focus groups/interview; `TARGET_DIRECT`.
- Result: 62% did not keep a training diary and 45% did not monitor health/wellbeing. Among diary users, half reported 0-5 minutes. Preferred cadence and burden varied; mobile access, reminders, adaptive input, education, clarity, and useful feedback mattered. Ninety survey records were incomplete at different consent/start/completion stages.
- Limit: purposive single programme, cross-sectional preferences rather than observed long-term adherence; 16-18 only; no automated plan comparison; gatekeeper access is not recruitment authority.
- Product implication: measure time-on-task, step-level abandonment, reminder exposure, comprehension and feedback usefulness. Treat the reported 5-10 minute preference as context, never a universal pass threshold.

### FRV2-F-002 - Ransom et al. (2025)

- Source/type: *Feasibility of Data Collection Via Consumer-Grade Wearable Devices in Adolescent Student Athletes*; prospective observational cohort.
- DOI/PMID/URL/full text: `10.2196/54630`; PMID `40513029`; PMCID `PMC12180680`; https://formative.jmir.org/2025/1/e54630/; `FULL_TEXT_VERIFIED`.
- Population/design/directness: 34 injured high-school athletes age 14-18 followed about two months; `YOUTH_DIRECT`.
- Result: median daily wearable adherence was 93% and 95% in two cohorts, with ranges and time variation; exclusions and missing wear were distinct; tutorials, sync checks, text troubleshooting, GPS disabling and deidentified transfer were reported.
- Limit: small injured sample, only three track athletes, compensated/vendor-mediated monitoring, no plan/explanation test.
- Product implication: define field/day completeness mechanically; separate withdrawal, protocol exit, technical missingness and no-candidate; log support and privacy settings. Do not infer physiological validity or safety.

### FRV2-F-003 - Ridgers et al. (2018)

- Source/type: *Wearable Activity Tracker Use Among Australian Adolescents: Usability and Acceptability Study*; six-week qualitative usability study.
- DOI/PMID/URL/full text: `10.2196/mhealth.9199`; PMID `29643054`; PMCID `PMC5917084`; https://mhealth.jmir.org/2018/4/e86/; `FULL_TEXT_VERIFIED`.
- Population/design/directness: 60 adolescents age 13-14 from three schools; tracker plus focus groups; `YOUTH_DIRECT`.
- Result: devices were generally easy/useful, but comfort, design, missing sport-specific feedback, water-sport removal and sleep use caused friction.
- Limit: non-athlete school sample; qualitative acceptability without automated prescription or objective completion endpoint.
- Product implication: record technical/task friction and ask whether explanation feedback is specific enough to interpret; do not equate stated ease with completion.

### FRV2-F-004 - Creaser et al. (2021)

- Source/type: *The Acceptability, Feasibility, and Effectiveness of Wearable Activity Trackers for Increasing Physical Activity in Children and Adolescents: A Systematic Review*.
- DOI/PMID/URL/full text: `10.3390/ijerph18126211`; PMID `34201248`; PMCID `PMC8228417`; https://www.mdpi.com/1660-4601/18/12/6211; `FULL_TEXT_VERIFIED`.
- Population/design/directness: 33 studies, 1,843 participants age 5-19; `YOUTH_DIRECT`.
- Result: acceptability encompassed attitude, burden, intervention coherence/understanding and perceived usefulness. Technical, charging, syncing and design barriers occurred; some studies showed adherence declining after novelty.
- Limit: heterogeneous mostly non-athlete device interventions, search through 2019, variable risk of bias; no coach-plan comparison.
- Product implication: measure burden, comprehension, affect, usefulness and actual completion separately; never use acceptability as efficacy evidence.

### FRV2-F-005 - Koorts et al. (2020)

- Source/type: *Translatability of a Wearable Technology Intervention to Increase Adolescent Physical Activity*; mixed-method implementation evaluation alongside cluster RCT.
- DOI/PMID/URL/full text: `10.2196/13573`; PMID `32763872`; PMCID `PMC7442941`; https://www.jmir.org/2020/8/e13573; `FULL_TEXT_VERIFIED`.
- Population/design/directness: 144 intervention adolescents, mean age 13.7, from nine schools; 12 weeks; `YOUTH_DIRECT`.
- Result: 83.3% found content easy to understand and 93.3% found the tracker easy, yet only 18.6% reported daily wear post-intervention and 36.1% completed weekly challenges; engagement declined and notifications could be unwelcome.
- Limit: inactive non-athletes, multicomponent intervention, self-reported adherence, no prescription comparison.
- Product implication: directly test comprehension and actual completion instead of inferring either from ease; log notification burden and component-specific dropout.

### FRV2-F-006 - Ronnby et al. (2018)

- Source/type: *Monitoring health and well-being in elite athletes: a qualitative study of competitive runners' experiences*; six-week prototype interview study.
- DOI/PMID/URL/full text: `10.2196/10270`; PMID `30104183`; PMCID `PMC6111145`; https://mhealth.jmir.org/2018/8/e10270/; `FULL_TEXT_VERIFIED`.
- Population/design/directness: 20 adult competitive middle/long-distance runners; `ATHLETE_INDIRECT`.
- Result: 19/20 completed weekly monitoring; participants wanted clear item definitions, routine fit, useful output and clarity about data access/control.
- Limit: small adult purposive sample; no youth, coach comparison or automated prescription.
- Product implication: use plain input definitions, test terminology through teach-back, disclose access/control, and preserve useful visible feedback.

### FRV2-F-007 - Barboza et al. (2017)

- Source/type: *Acceptability and perceptions of end-users towards an online sports-health surveillance system*; mixed-method pilot.
- DOI/PMID/URL/full text: `10.1136/bmjsem-2017-000275`; PMID `29071115`; PMCID `PMC5640126`; https://pubmed.ncbi.nlm.nih.gov/29071115/; `FULL_TEXT_VERIFIED`.
- Population/design/directness: 74 elite judo, swimming and volleyball athletes, mean age 21; 15-42 weeks; `ATHLETE_INDIRECT`.
- Result: response rates were 50-61%; users expected feedback and considered the online system complementary to face-to-face communication.
- Limit: adult/young-adult, no runners, early subjective perceptions; comments cannot prove prevention.
- Product implication: keep coach communication authoritative, return visible feedback, and report response/completeness. Never position the system as replacing the coach.

### FRV2-F-008 - Bowen et al. (2009)

- Source/type: *How We Design Feasibility Studies*; methodological framework.
- DOI/PMID/URL/full text: `10.1016/j.amepre.2009.02.002`; PMID `19362699`; PMCID `PMC2859314`; https://pmc.ncbi.nlm.nih.gov/articles/PMC2859314/; `FULL_TEXT_VERIFIED`.
- Population/design/directness: no athlete population; conceptual domains and examples; `METHOD_ONLY`.
- Result: distinguishes acceptability, demand, implementation, practicality, adaptation, integration, expansion and limited-efficacy testing.
- Limit: conceptual, not a validated checklist or source of universal progression thresholds.
- Product implication: this first pilot should examine acceptability, implementation, practicality and coach-workflow integration; exclude limited efficacy from its decision.

### FRV2-F-009 - Eldridge et al. (2016)

- Source/type: *Defining Feasibility and Pilot Studies in Preparation for Randomised Controlled Trials*; international consensus/Delphi.
- DOI/PMID/URL/full text: `10.1371/journal.pone.0150205`; PMID `26978655`; PMCID `PMC4792418`; https://pubmed.ncbi.nlm.nih.gov/26978655/; `FULL_TEXT_VERIFIED`.
- Population/design/directness: methods research, no athlete population; `METHOD_ONLY`.
- Result: feasibility asks whether and how a future study can be done; a pilot runs all or part of the intended future process on a smaller scale.
- Limit: oriented to RCT preparation, not product adoption or automated training.
- Product implication: call RQ-F a feasibility pilot only because it rehearses the intended visible workflow; progression concerns observability/process, not efficacy, safety or product identity.

### FRV2-F-010 - Amann et al. (2020)

- Source/type: *Explainability for artificial intelligence in healthcare: a multidisciplinary perspective*; conceptual analysis.
- DOI/PMID/URL/full text: `10.1186/s12911-020-01332-6`; PMID `33256715`; PMCID `PMC7706019`; https://link.springer.com/article/10.1186/s12911-020-01332-6; `FULL_TEXT_VERIFIED`.
- Population/design/directness: multidisciplinary healthcare perspectives; `METHOD_ONLY`.
- Result: explanation needs depend on user, role and risk; explanations can support evaluation and resolution of disagreement.
- Limit: conceptual healthcare paper; provides no validated comprehension score and does not prove explanation improves decisions.
- Product implication: show inputs, rules/reasons, missingness/uncertainty and coach authority; test athlete/coach teach-back and disagreement. Exposure to an explanation is not comprehension.

### FRV2-F-011 - Vasey et al. (2022), DECIDE-AI

- Source/type: *Reporting guideline for the early stage clinical evaluation of decision support systems driven by artificial intelligence: DECIDE-AI*; Delphi/consensus reporting guideline.
- DOI/PMID/URL/full text: `10.1136/bmj-2022-070904`; PMID `35584845`; PMCID `PMC9116198`; https://www.bmj.com/content/377/bmj-2022-070904; `FULL_TEXT_VERIFIED`.
- Population/design/directness: healthcare decision-support methods, no youth sport; `METHOD_ONLY`.
- Result: 17 AI-specific and 10 generic reporting items emphasize actual workflow, users, human-system interaction, versions/modifications and errors.
- Limit: reporting guideline, not conduct or proof of benefit; clinical setting differs from a noninterventional sport pilot.
- Product implication: freeze/version the candidate generator, identify each human/system role, log failures and deviations, and retain coach authority.

### FRV2-F-012 - Tikhomirov et al. (2026)

- Source/type: *A scoping review of silent trials for medical artificial intelligence*; scoping review.
- DOI/PMID/URL/full text: `10.1038/s44360-025-00048-z`; PMID `UNRESOLVED`; https://www.nature.com/articles/s44360-025-00048-z; `FULL_TEXT_VERIFIED`.
- Population/design/directness: 75 prospective noninterventional evaluations in intended healthcare settings; `METHOD_ONLY`.
- Result: silent trials generate outputs without influencing care, but nomenclature and reporting vary; human factors and patient/consumer engagement were sparse. Visibility to treating users is inconsistent with the conventional silent label.
- Limit: healthcare, English 2015-2025, heterogeneous reporting; the retrieved page had inconsistent screened-total wording, so only the 75 included count is retained.
- Product implication: borrow prospective parallel output logging and comparison, but reject concealment. Label the design `participant-visible parallel comparison`, not a silent trial.

### FRV2-F-013 - CIOMS (2016)

- Source/type: *International Ethical Guidelines for Health-related Research Involving Humans*, Guideline 17; official ethics guidance.
- DOI/PMID/URL/full text: DOI `NOT_APPLICABLE`; PMID `NOT_APPLICABLE`; https://cioms.ch/wp-content/uploads/2017/01/WEB-CIOMS-EthicalGuidelines.pdf; `OFFICIAL_PUBLIC_GUIDANCE_FULL_TEXT`.
- Population/design/directness: children/adolescents in health-related research; `METHOD_ONLY`.
- Result: age/maturity-tailored assent is an ongoing process; parental/legal permission may be required; refusal to participate or continue should be respected; re-consent at majority can apply.
- Limit: global guidance, not local law or ethics approval; sport/product implementation may fall under jurisdiction-specific rules.
- Product implication: obtain prior local ethics/legal determination, affirmative age-appropriate assent and required permission; make withdrawal clear and penalty-free. This evidence grants no recruitment authority.

### FRV2-F-014 - UK Health Research Authority (2024)

- Source/type: *Research involving children*; official public guidance.
- DOI/PMID/URL/full text: DOI `NOT_APPLICABLE`; PMID `NOT_APPLICABLE`; https://www.hra.nhs.uk/planning-and-improving-research/policies-standards-legislation/research-involving-children/; `OFFICIAL_PUBLIC_GUIDANCE_FULL_TEXT`.
- Population/design/directness: children in research; `METHOD_ONLY`.
- Result: understanding should be maximized through appropriate language/presentation; a child's refusal or withdrawal and assent should be respected where applicable.
- Limit: UK-specific and not approval for this project or a universal legal rule.
- Product implication: test comprehension rather than infer it from age; respect athlete withdrawal and privacy; obtain the applicable local review.

### FRV2-F-015 - Krasny-Pacini and Evans (2018)

- Source/type: *Single-case experimental designs to assess intervention effectiveness in rehabilitation: A practical guide*; methods guide.
- DOI/PMID/URL/full text: `10.1016/j.rehab.2017.12.002`; PMID `29253607`; https://pubmed.ncbi.nlm.nih.gov/29253607/; `FREE_FULL_TEXT_REPORTED_BY_INDEX`.
- Population/design/directness: rehabilitation methods, no youth athlete; `METHOD_ONLY`.
- Result: repeated measures, phase sequencing/randomization, procedural fidelity and replication are central; reversal designs require reversible effects, while carryover can favor multiple-baseline structures.
- Limit: not sport-specific and not an empirical feasibility threshold; publisher full text was not re-opened in bounded recovery.
- Product implication: RQ-F is `NOT_A_SCED`. It may only test whether stable repeated measurement is feasible. Cumulative training makes ABAB reversal especially unsuitable for a later effectiveness claim.

### FRV2-F-016 - Tate et al. (2016), SCRIBE

- Source/type: *The Single-Case Reporting Guideline In BEhavioural Interventions (SCRIBE) 2016 Statement*; Delphi/consensus reporting guideline.
- DOI/PMID/URL/full text: `10.1080/17489539.2016.1190525`; PMID `27499802`; PMCID `PMC4960517`; https://pmc.ncbi.nlm.nih.gov/articles/PMC4960517/; `FULL_TEXT_VERIFIED`.
- Population/design/directness: single-case methods, no youth athlete; `METHOD_ONLY`.
- Result: 26 items cover design/phase decision rules, randomization, consent, measurement, procedural fidelity, analysis, stop reasons, raw data, adverse events and limitations.
- Limit: reporting guidance is not causal validation or a conduct standard; multiple journal versions exist, so identifiers above refer to the linked PMC version.
- Product implication: borrow completion, stop-reason, process-event and fidelity fields now. Any later SCED would need prespecified phases, stable version, repeated observations, carryover/trend/autocorrelation analysis and replication.

## Executable pilot specification

1. Before candidate display, timestamp/freeze the coach-authored 9.5-day plan independently. Then generate and display the automated candidate and explanation to athlete and coach. Nothing is covert, and the generated candidate does not alter the executed plan.
2. Version the generator, input schema, explanation template and comparison rubric. Log generated candidate, justified no-candidate, technical failure and human-review handoff as distinct states.
3. Compare structured plan fields, not outcomes: session/date/type, intensity/duration representation, recovery spacing, competition/context, omissions and unsupported inputs. Capture coach labels such as `AGREE`, `DISAGREE_EDIT`, `NO_CANDIDATE_CORRECT`, `INSUFFICIENT_INFORMATION`, and free-text rationale.
4. Test explanation comprehension by teach-back: what data were used/not used, why a candidate or no-candidate appeared, what uncertainty/missingness remains, and who holds final authority. Record item-level correctness and unresolved questions.
5. Record burden and completion: time per step, reminders, abandoned step, resumption, input missingness, comparison completion, explanation completion, withdrawal, optional reason, technical support and record completeness.
6. Record process events and handoff: stop trigger, display suppression, coach notification, acknowledgement, time to human handoff and resolution state. These are process measures, not safety outcomes.
7. Obtain prior ethics/local-law determination. Use age-appropriate information, required guardian permission, affirmative ongoing assent, privacy disclosure and penalty-free withdrawal. Recruitment remains with an approved study team/gatekeeper, not the product owner by inference.
8. Pre-register context-specific progression thresholds with the responsible ethics/study team. No percentage in the sources is a universal go/no-go threshold. Progression can concern observable completeness, comprehension, tolerable burden and reliable handoff only.

## Evidence-bounded conclusions and gaps

- Direct youth evidence supports measuring burden, actual completion, comprehension, feedback usefulness, privacy and technical friction separately. It does not validate a 9.5-day prescription.
- Method evidence supports a visible prospective parallel comparison with versioning and explicit human roles. `Participant-visible parallel comparison` is the accurate label; conventional `silent trial` wording would imply concealment.
- The first pilot is `FEASIBILITY_ONLY` and `NOT_A_SCED`. Agreement with a coach is descriptive and cannot establish efficacy, safety or correctness.
- No located study directly tested a participant-visible automated 9.5-day middle-distance plan against a coach-authored plan in athletes age 12-20.
- Under-16 and South Korea-specific consent, data governance and recruitment requirements remain `LOCAL_REVIEW_REQUIRED`.

Source count: **16** (1 target-direct, 4 broader youth-direct, 2 athlete-indirect, 9 method/ethics). Remaining work after bounded recovery: local ethics/legal determination, protocol-specific progression thresholds, and direct user testing; no further source search was performed.
