# RQ-C raw evidence: concurrent/composite training order and scheduling

Search and extraction date: 2026-07-17 (Asia/Seoul)

## Scope and interpretation guardrails

- Question: When endurance is combined with resistance, plyometric, hill, sprint/speed-endurance, or alternative-aerobic work, what evidence informs same-session order, same-day separation, or adjacent-day placement?
- Priority: adolescent middle-distance runners, then youth athletes, trained runners, and finally indirect adult concurrent-training evidence.
- This is a raw search/extraction file, not a canonical product rule or clinical/practice guideline.
- `NR` means not reported in the material reviewed. `ABSTRACT_ONLY` means estimates and design details are limited to an abstract and/or repository metadata. It is not equivalent to full-text verification.
- A completed intervention or injury-free eligibility criterion is not adverse-event surveillance. Where adverse events were not explicitly monitored and reported, the extraction says `NR`.
- No source here validates a universal fatigue score, a universal sequence, or scientific superiority/safety of a 9.5-day architecture. Unknown order or separation must remain unknown rather than being imputed.

## Search log

PubMed/MEDLINE was searched through NCBI E-utilities. Exact executed strings and result counts are below. Title/abstract restrictions were deliberate to keep the search auditable; citation chasing and publisher/full-text checks supplemented the electronic search.

| ID | Exact PubMed query | Hits |
|---|---|---:|
| C1_DIRECT | `((middle distance[Title/Abstract] OR middle-distance[Title/Abstract] OR 800 m[Title/Abstract] OR 1500 m[Title/Abstract]) AND (adolescent*[Title/Abstract] OR youth[Title/Abstract] OR junior[Title/Abstract]) AND (concurrent training[Title/Abstract] OR combined training[Title/Abstract] OR strength training[Title/Abstract] OR plyometric*[Title/Abstract]) AND (sequence[Title/Abstract] OR order[Title/Abstract] OR separation[Title/Abstract] OR interference[Title/Abstract] OR running economy[Title/Abstract]))` | 1 |
| C2_YOUTH | `((youth athlete*[Title/Abstract] OR adolescent athlete*[Title/Abstract] OR young athlete*[Title/Abstract] OR children[Title/Abstract]) AND (concurrent training[Title/Abstract] OR combined training[Title/Abstract]) AND (endurance[Title/Abstract] AND (strength[Title/Abstract] OR resistance[Title/Abstract] OR plyometric*[Title/Abstract])) AND (performance[Title/Abstract] OR adaptation*[Title/Abstract] OR interference[Title/Abstract]))` | 7 |
| C3_RUNNERS | `((runner*[Title/Abstract] OR endurance athlete*[Title/Abstract]) AND (concurrent training[Title/Abstract] OR combined training[Title/Abstract] OR strength training[Title/Abstract] OR plyometric training[Title/Abstract]) AND (running economy[Title/Abstract] OR performance[Title/Abstract] OR VO2max[Title/Abstract]) AND (resistance[Title/Abstract] OR strength[Title/Abstract] OR plyometric*[Title/Abstract] OR explosive[Title/Abstract]))` | 140 |
| C4_ORDER | `((concurrent training[Title/Abstract] OR concurrent exercise[Title/Abstract] OR combined training[Title/Abstract]) AND (sequence[Title/Abstract] OR order[Title/Abstract] OR separation[Title/Abstract] OR recovery duration[Title/Abstract] OR same day[Title/Abstract]) AND (endurance[Title/Abstract] AND (strength[Title/Abstract] OR resistance[Title/Abstract])) AND (adaptation*[Title/Abstract] OR performance[Title/Abstract] OR interference[Title/Abstract]))` | 49 |
| C5_HILL_SPRINT_ALT | `((runner*[Title/Abstract] OR endurance athlete*[Title/Abstract] OR middle distance[Title/Abstract]) AND (hill training[Title/Abstract] OR uphill running[Title/Abstract] OR sprint training[Title/Abstract] OR cross training[Title/Abstract] OR cycling[Title/Abstract] OR alternative aerobic[Title/Abstract]) AND (strength[Title/Abstract] OR plyometric*[Title/Abstract] OR concurrent[Title/Abstract] OR combined[Title/Abstract]) AND (performance[Title/Abstract] OR adaptation*[Title/Abstract] OR running economy[Title/Abstract]))` | 73 |
| C6_HILL | `((runner*[Title/Abstract] OR distance runner*[Title/Abstract] OR middle distance[Title/Abstract]) AND (uphill running[Title/Abstract] OR hill training[Title/Abstract] OR uphill interval*[Title/Abstract]) AND (performance[Title/Abstract] OR running economy[Title/Abstract] OR adaptation*[Title/Abstract]))` | 62 |
| C7_ALT_AEROBIC | `((runner*[Title/Abstract] OR distance runner*[Title/Abstract]) AND (cycling[Title/Abstract] OR cross-training[Title/Abstract] OR cross training[Title/Abstract] OR alternative aerobic[Title/Abstract]) AND (running performance[Title/Abstract] OR running economy[Title/Abstract] OR VO2max[Title/Abstract]) AND (trial[Title/Abstract] OR training[Title/Abstract]))` | 41 |
| C8_SPEED_RESISTANCE | `((runner*[Title/Abstract] OR middle distance[Title/Abstract] OR distance runner*[Title/Abstract]) AND (sprint interval[Title/Abstract] OR speed endurance[Title/Abstract] OR resisted sprint*[Title/Abstract]) AND (resistance training[Title/Abstract] OR strength training[Title/Abstract] OR concurrent training[Title/Abstract]) AND (performance[Title/Abstract] OR running economy[Title/Abstract]))` | 2 |

Protocol query reproduced for traceability: `(runner* OR youth athlete* OR endurance athlete*) AND (concurrent training OR combined training OR complex training) AND (sequence OR order OR separation OR interference OR plyometric OR resistance)`.

Backward/forward citation chasing was performed around the youth meta-analysis, the 2025 adolescent complex-training trial, runner strength-training reviews, and concurrent-training sequence/separation reviews. PubMed, PMC, DOI landing pages, and official publisher pages were used for identity/full-text checks. SPORTDiscus, Scopus, Web of Science, and the Cochrane Library were not directly searched because authenticated database access was unavailable in this environment. Consequently, this is a deep targeted search, not a PRISMA-complete systematic review.

## Source extraction

### Direct adolescent/youth runner evidence

**C01 - Yu et al. (2025), Effect of complex training on lower limb strength and running economy in adolescent distance runners**

- Population/event/status: 32 post-pubertal male provincial runners, age 16.75 +/- 0.68 years, at least 3 years systematic training, regularly competing at 800-3000 m, and at least 35 km/week. The method used to establish maturity was not reported.
- Components/order/separation/dose: complex training (CT) versus traditional resistance training, 3 x 60 min/week for 8 weeks, with at least 48 h between strength sessions, alongside approximately 44.5 +/- 6.33 km/week of road running (70-85% HRmax) and intervals (90-95% HRmax). Each CT pair placed heavy resistance before a biomechanically matched plyometric exercise with 3-4 min recovery. Progression was 60-65% 1RM in weeks 1-2, 70-75% in weeks 3-5, and 80% in weeks 6-8, generally 3-4 sets and 9-12 jumps. The table's `80% 1RM x 8-12RM` notation is internally questionable and is not normalized here. Placement of regular endurance relative to CT on shared days was NR.
- Outcomes/effect/uncertainty: group x time interactions favored CT for running economy at 12, 14, and 16 km/h (p=.001, .010, .004; partial eta-squared .395, .547, .516), countermovement-jump peak power (p=.010), drop jump (p=.017), and reactive-strength index (p<.001). No interaction was found for VO2max (p=.894), 1RM (p=.525), countermovement-jump height (p=.185), or squat-jump height (p=.173). Short duration, male-only sample, no race-performance outcome, and no direct test of endurance-strength order.
- Adverse/access/directness: all 32 completed; adverse events were not explicitly reported. `FULL_TEXT_VERIFIED`. High directness for youth middle-distance component dosing; low directness for whole-architecture scheduling.
- Identity: PMID [41312139](https://pubmed.ncbi.nlm.nih.gov/41312139/); PMCID [PMC12646903](https://pmc.ncbi.nlm.nih.gov/articles/PMC12646903/); DOI [10.3389/fphys.2025.1718150](https://doi.org/10.3389/fphys.2025.1718150).

**C02 - Blagrove et al. (2018), Effects of Strength Training on Postpubertal Adolescent Distance Runners**

- Population/event/status: 25 postpubertal adolescent distance runners were enrolled (13 female), age 17.2 +/- 1.2; 18 completed (strength n=9, control n=9). The abstract does not state the maturity-assessment method.
- Components/order/separation/dose: 10 weeks of twice-weekly plyometric, sprint, and resistance work added to normal running. A secondary review table reports 2-4 sets, 6-15 repetitions, and 90-180 s rest. Exact within-session sequence and shared-day separation from running were NR in the abstract.
- Outcomes/effect/uncertainty: running-economy changes of about 3.2-3.7% were described as small and possibly beneficial (reported effects .31-.51); sprint and maximal voluntary contraction effects were .32 and .86, while aerobic and body-composition changes were trivial/small. These are magnitude-based descriptions from a small sample. Seven of 25 did not complete, and reasons could not be verified from the abstract.
- Adverse/access/directness: adverse events NR. `ABSTRACT_ONLY` (abstract and repository metadata reviewed). High population directness; low order/separation directness.
- Identity: PMID [29315164](https://pubmed.ncbi.nlm.nih.gov/29315164/); DOI [10.1249/MSS.0000000000001543](https://doi.org/10.1249/MSS.0000000000001543).

**C03 - Mikkola et al. (2007), Concurrent endurance and explosive type strength training improves neuromuscular and anaerobic characteristics in young distance runners**

- Population/event/status: 25 trained runners age 16-18 (concurrent n=13, control n=12).
- Components/order/separation/dose: 8 weeks; 19% of endurance training was replaced, rather than supplemented, by explosive training while total training volume was held similar. A secondary review reports one explosive session/week, 2-3 sets of 6-10 low/no-load repetitions, and approximately 7.2 versus 8.5 endurance hours/week. Day, order, and separation were NR.
- Outcomes/effect/uncertainty: maximal anaerobic running speed improved 3.0 +/- 2.0% and 30 m speed 1.1 +/- 1.3%; aerobic maximal speed, VO2max, and running economy were unchanged. This is evidence about component substitution, not the superiority of a sequence.
- Adverse/access/directness: adverse events NR. `ABSTRACT_ONLY`. High youth-distance directness; low scheduling directness.
- Identity: PMID [17373596](https://pubmed.ncbi.nlm.nih.gov/17373596/); DOI [10.1055/s-2007-964849](https://doi.org/10.1055/s-2007-964849).

**C04 - Bluett et al. (2015), A preliminary investigation into concurrent aerobic and resistance training in youth runners**

- Population/event/status: 12 competitive youth runners, reported as age 10-13 in the youth review, pair-matched by maturity and initial 3 km performance; concurrent n=6 (3 male/3 female), aerobic-only n=6.
- Components/order/separation/dose: 10 weeks of continuous and interval running twice weekly plus machine resistance in the concurrent group. There is an unresolved dose conflict: the study abstract says resistance twice weekly, whereas the youth review table reports once weekly, 3-4 x 10-12 at 70-75% 1RM. Sequence and separation were NR.
- Outcomes/effect/uncertainty: no significant interactions or main effects. The post-test group difference was 38 s adverse to concurrent training; the review describes 3 km changing +6 s (0.8% slower) in concurrent versus -17 s (2.1% faster) in aerobic-only. Extremely small groups and unresolved dose reporting make this a signal of possible interference, not proof.
- Adverse/access/directness: adverse events NR. `ABSTRACT_ONLY`; full-text PDF was located but not extracted. High youth-runner directness; low scheduling directness.
- Identity: DOI [10.3233/IES-150567](https://doi.org/10.3233/IES-150567); no PMID found.

**C05 - Blagrove et al. (2019), Efficacy of depth jumps to elicit a post-activation performance enhancement in junior endurance runners**

- Population/event/status: randomized crossover in 17 national/international male junior middle-distance runners, age 17.6 +/- 1.2, VO2max 70.7 +/- 5.2 mL/kg/min.
- Components/order/separation/dose: 5 min warm-up at 60% VO2max, 5 min submaximal economy run, six depth jumps from a box matching the athlete's best countermovement jump (control: body-weight quarter squats), 10 min passive recovery, another 5 min submaximal run, then time to exhaustion at vVO2max. This directly tests an acute plyometric-before-run sequence.
- Outcomes/effect/uncertainty: running economy improved 3.7% after depth jumps (effect-size 95% CI 0.25-1.09); time to exhaustion and other physiological measures were trivial. Acute potentiation cannot establish chronic same-day or adjacent-day scheduling.
- Adverse/access/directness: adverse events NR. `ABSTRACT_ONLY`; author PDF located but not fully extracted. High directness for acute junior middle-distance sequencing; low directness for periodized architecture.
- Identity: PMID [30107984](https://pubmed.ncbi.nlm.nih.gov/30107984/); DOI [10.1016/j.jsams.2018.07.023](https://doi.org/10.1016/j.jsams.2018.07.023).

**C06 - Gaebler et al. (2018), The Effects of Concurrent Strength and Endurance Training on Physical Fitness and Athletic Performance in Youth: A Systematic Review and Meta-Analysis**

- Population/event/status: 15 studies, 518 youth (268 male/250 female), age 10.7-18.2; 11 studies involved youth endurance athletes across swimming, running, and rowing. Median PEDro score 4/10 (range 3-7).
- Components/order/separation/dose: concurrent strength plus endurance versus endurance-only or strength-only. Events ranged from 30 to 3000 m (median 275 m) across sports. The review did not meta-analyze order or separation.
- Outcomes/effect/uncertainty: concurrent versus endurance-only showed no cardiorespiratory effect (SMD .04, p=.86, I2=22%) or exercise-economy effect (SMD .16, p=.24, I2=28%), but a small athletic-performance effect (SMD .41, p=.02, I2=45%). The adolescent subgroup estimate was .52 (p=.02, I2=58%), but child/adolescent subgroup difference was not significant (p=.33). Concurrent versus strength-only improved leg power in non-athletic youth (SMD .23, p=.04, I2=0%); maximal-strength and hypertrophy evidence was absent.
- Adverse/access/directness: adverse events were not synthesized. `FULL_TEXT_VERIFIED`. Moderate youth directness because sports/events were pooled; low sequence directness.
- Identity: PMID [30131714](https://pubmed.ncbi.nlm.nih.gov/30131714/); PMCID [PMC6090054](https://pmc.ncbi.nlm.nih.gov/articles/PMC6090054/); DOI [10.3389/fphys.2018.01057](https://doi.org/10.3389/fphys.2018.01057).

### Trained-runner composite and component evidence

**C07 - Li et al. (2019), Effects of complex training versus heavy resistance training on neuromuscular adaptation, running economy and 5-km performance in well-trained distance runners**

- Population/event/status: 28 well-trained male collegiate distance runners, age 19-23, VO2max 65.78 +/- 4.99, at least 4 years of training.
- Components/order/separation/dose: 8 weeks, nine sessions/week: six endurance and three strength. Monday/Wednesday/Friday morning road runs were 15-20 km at 75-85% HRmax, followed in the afternoon by strength; AM-PM hours were NR. Tuesday/Thursday/Saturday used 5 x 1000 m at 90-95% HRmax with 1:1 work:rest; Saturday also included 10 km at 70-80% HRmax; Sunday rest. CT alternated heavy before matched plyometric work: back squat 3 x 5 at 80-85% 1RM -> 3 x 6 drop jumps (40 cm); Bulgarian squat -> single-leg hops; Romanian deadlift -> hurdle hops, with 4 min recovery. Heavy resistance used 5 x 5; control used high-repetition work at 40% 1RM.
- Outcomes/effect/uncertainty: CT and heavy resistance improved 1RM (+16.88%, +18.80%), countermovement jump (+11.28%, +8.96%), economy at 14 km/h (-7.68%, -4.89%), 50 m time (-2.26%, -2.14%), and 5 km time (-2.80%, -2.09%). Only CT showed improvements in drop jump (+12.94%), reactive-strength index (+19.99%), economy at 16 km/h (-7.38%), and blood lactate at 16 km/h (-40.80%). VO2max was unchanged. Groups were small and allocation was matched rather than clearly randomized.
- Adverse/access/directness: injury-free eligibility; adverse events NR. `FULL_TEXT_VERIFIED`. Moderate-high event/component directness, but adults/young adults and no comparison of AM-PM separation.
- Identity: PMID [31086736](https://pubmed.ncbi.nlm.nih.gov/31086736/); PMCID [PMC6487184](https://pmc.ncbi.nlm.nih.gov/articles/PMC6487184/); DOI [10.7717/peerj.6787](https://doi.org/10.7717/peerj.6787).

**C08 - Ramirez-Campillo et al. (2014), Effects of plyometric training on endurance and explosive strength performance in competitive middle- and long-distance runners**

- Population/event/status: 36 highly competitive middle/long-distance runners of both sexes, randomized to explosive/plyometric plus usual endurance (n=18) or control (n=18), for 6 weeks.
- Components/order/separation/dose: drop jumps (20 and 40 cm), countermovement jumps, and related explosive work were added to regular running. Exact shared-day placement and separation were not verified from the abstract.
- Outcomes/effect/uncertainty: intervention changes were 2.4 km time -3.9%, 20 m time -2.3%, countermovement-jump height +8.9%, 20 cm drop jump +12.7%, and 40 cm drop jump +16.7%; control did not improve. The trial supports including a plyometric component, not a particular calendar position.
- Adverse/access/directness: adverse events NR. `ABSTRACT_ONLY`. Moderate-high runner/event directness; low scheduling directness.
- Identity: PMID [23838975](https://pubmed.ncbi.nlm.nih.gov/23838975/); DOI [10.1519/JSC.0b013e3182a1f44c](https://doi.org/10.1519/JSC.0b013e3182a1f44c).

**C09 - Trowell et al. (2022), Effect of concurrent strength and endurance training on run performance and biomechanics in recreational runners**

- Population/event/status: randomized trial in 30 moderately trained distance runners, approximately age 33-34, running at least 30 km/week and inexperienced in strength training.
- Components/order/separation/dose: 10 weeks of concurrent strength/endurance versus endurance control. Strength and plyometric detail, sequence, and separation were unavailable in the abstract reviewed.
- Outcomes/effect/uncertainty: concurrent training improved 2 km time by a mean difference of -11.3 s (95% CI -19.0 to -3.7; p=.006) and time to exhaustion by +59.1 s (95% CI 8.58-109.62; p=.024), with body fat -1.05 kg; most biomechanical variables were unchanged.
- Adverse/access/directness: adverse events NR. `ABSTRACT_ONLY`. Adult recreational-runner evidence; low youth and scheduling directness.
- Identity: PMID [34767655](https://pubmed.ncbi.nlm.nih.gov/34767655/); DOI [10.1111/sms.14092](https://doi.org/10.1111/sms.14092).

**C10 - Skovgaard et al. (2014), Concurrent speed endurance and resistance training improves performance, running economy, and muscle NHE1 in moderately trained runners**

- Population/event/status: 23 moderately trained male runners, age 31.1 years, VO2max 59.4, about 7.5 years running and 29.7 km/week; intervention n=12, control n=11.
- Components/order/separation/dose: 8 weeks. Twice weekly, repeated 30 s speed-endurance runs with 3 min recovery were followed in the same session by heavy resistance at 80-90% 1RM; sets/exercises used about 3 min recovery. Additional running included Wednesday 4 x 4 min above 85% HRmax with 2 min recovery and Saturday 40-70 min at 75-85% HRmax. Running volume was reduced 42%, so the new work partly substituted for running. Concurrent-session adherence was 76 +/- 4% (12.2/16 planned).
- Outcomes/effect/uncertainty: 10 km improved from 44:11 to 42:30 by week 4 without further improvement; 1500 m improved from 5:27 to 5:10 and Yo-Yo performance improved by week 8. Running economy improved from 195 to 189 mL/kg/km, with strength and muscle NHE1 increases; VO2max, morphology, and capillarization were unchanged. There was no reverse-order comparator.
- Adverse/access/directness: consent mentioned risks/discomfort, but intervention adverse events were NR. `FULL_TEXT_VERIFIED`. Direct same-session sequence in adult runners; low youth directness and no separation comparison.
- Identity: PMID [25190744](https://pubmed.ncbi.nlm.nih.gov/25190744/); DOI [10.1152/japplphysiol.01226.2013](https://doi.org/10.1152/japplphysiol.01226.2013).

**C11 - Barnes et al. (2013), Effects of different uphill interval-training programs on running economy and performance**

- Population/event/status: 20 well-trained runners randomized among five uphill interval programs for 6 weeks (approximately four per condition).
- Components/order/separation/dose: five uphill intensities/doses; exact protocols were not extracted from the abstract. No combination with strength/plyometric work and no placement comparison were reported in the abstract.
- Outcomes/effect/uncertainty: no clearly superior program for 5 km performance; across programs, improvement was about 2.0% +/- 0.6%. The highest-intensity condition was reported as most favorable for running economy (2.4% +/- 1.4%) and neuromuscular measures, while mid-intensity conditions favored aerobic measures. Very small cells and model-based comparisons limit certainty.
- Adverse/access/directness: adverse events NR. `ABSTRACT_ONLY`. Runner-specific hill-component evidence, but essentially no composite-scheduling directness.
- Identity: PMID [23538293](https://pubmed.ncbi.nlm.nih.gov/23538293/); DOI [10.1123/ijspp.8.6.639](https://doi.org/10.1123/ijspp.8.6.639).

**C12 - Mallol et al. (2020), Physiological response differences between run and cycle high-intensity interval training in recreational middle-age female runners**

- Population/event/status: 14 recreational female runners, age 42 +/- 10, habitually running at least twice/week; randomized run HIIT n=7 or cycle HIIT n=7.
- Components/order/separation/dose: twice weekly for 4 weeks. Sessions used 10 min warm-up, 6 x 2 min at 95% HRmax with 2 min active recovery, then 4 x 1 min all-out with 90 s recovery, and 5 min cool-down. Habitual training continued, but placement relative to it was not standardized/reported.
- Outcomes/effect/uncertainty: treadmill VO2max rose from 42.1 to 45.2 mL/kg/min after run HIIT but not cycle HIIT. Ten-kilometer time was unchanged (reported p=.06-.84); cycling average pace changed (p=.02, small effect). Cycling RPE and post-session soreness increased. Creatine kinase and soreness were tracked at 24 h, but injury adverse events were NR. Tiny, older, all-female sample.
- Adverse/access/directness: `FULL_TEXT_VERIFIED`. Highly indirect for adolescent runners; useful only as alternative-aerobic evidence and not proof that cycling is a lower-fatigue substitute.
- Identity: PMID [32874103](https://pubmed.ncbi.nlm.nih.gov/32874103/); PMCID [PMC7429439](https://pmc.ncbi.nlm.nih.gov/articles/PMC7429439/).

**C13 - Menges et al. (2026), Cross-training between running and cycling: effects on VO2max and running performance**

- Population/event/status: systematic review/meta-analysis of seven older randomized trials (1974-2003), sample sizes 11-60, heterogeneous untrained through competitive adults, interventions at least 4 weeks.
- Components/order/separation/dose: running-only versus cycling-only or running/cycling combinations; protocols and exposure were heterogeneous. Order and same-/adjacent-day separation were not the analytic question.
- Outcomes/effect/uncertainty: treadmill VO2max g=-.32 (95% CI -.76 to .13; p=.16), cycle VO2max g=-.34 (-.79 to .11; p=.14), and running performance g=.02 (-.62 to .66; p=.88), all null with wide intervals. Combining running and cycling increased heterogeneity for performance; risk-of-bias concerns were substantial. Null results do not establish modality equivalence or recovery advantage.
- Adverse/access/directness: adverse events were not synthesized. `FULL_TEXT_VERIFIED`. Adult and largely old evidence; low youth and placement directness.
- Identity: PMID [42267259](https://pubmed.ncbi.nlm.nih.gov/42267259/); PMCID [PMC13243379](https://pmc.ncbi.nlm.nih.gov/articles/PMC13243379/); DOI [10.3389/fspor.2026.1843803](https://doi.org/10.3389/fspor.2026.1843803).

**C14 - Llanos-Lagos et al. (2024), The Effect of Strength Training Methods on Middle-Distance and Long-Distance Runners' Athletic Performance: A Systematic Review With Meta-analysis**

- Population/event/status: 38 studies, 894 runners age 17-40 (651 male/243 female); 324 moderately, 272 well, and 298 highly trained; 6-40 weeks and 1-4 strength sessions/week.
- Components/order/separation/dose: high-load, submaximal, plyometric, isometric, and combined strength methods alongside running. Endurance-strength sequence or separation was not meta-analyzed.
- Outcomes/effect/uncertainty: running performance favored high-load strength (effect size -.469, p=.029) and combined methods (-1.035, p=.036); plyometric-only was not statistically significant (-.210, p=.064). VO2max, vVO2max, maximal metabolic steady state, and sprint outcomes were not significant (all p>.072). Publication bias was detected for the combined-method performance outcome; certainty ranged very low to moderate.
- Adverse/access/directness: adverse events were not synthesized. `FULL_TEXT_VERIFIED`. Moderate runner/component directness; low adolescent and scheduling directness.
- Identity: PMID [38627351](https://pubmed.ncbi.nlm.nih.gov/38627351/); PMCID [PMC11258194](https://pmc.ncbi.nlm.nih.gov/articles/PMC11258194/); DOI [10.1007/s40279-024-02018-z](https://doi.org/10.1007/s40279-024-02018-z).

### Order, separation, and interference evidence (indirect adults)

**C15 - Schumann et al. (2022), Compatibility of Concurrent Aerobic and Strength Training for Skeletal Muscle Size and Function: An Updated Systematic Review and Meta-Analysis**

- Population/status: 43 adult studies, 1090 participants; concurrent aerobic/resistance compared with identical resistance-only training for at least 4 weeks. Running was used in 16 studies and cycling in 24. Mean PEDro score was 4.3/10.
- Order/separation/dose: sequence was heterogeneous. The review compared same-session separation of at most 20 min with sessions separated by at least 3 h; these are study-category definitions, not experimentally established youth thresholds.
- Outcomes/effect/uncertainty: no clear concurrent penalty for maximal strength (SMD -.06, 95% CI -.20 to .09; p=.446) or hypertrophy (-.01, -.16 to .18; p=.919), but a small negative effect for explosive strength (-.28, -.48 to -.08; p=.007). Explosive-strength interference appeared in same-session studies (-.31, -.62 to -.01; p=.043) but was not significant when separated at least 3 h. Other moderator tests were not significant. These subgroup patterns are outcome-specific and observational across studies.
- Adverse/access/directness: adverse events were not synthesized. `FULL_TEXT_VERIFIED`. Low youth/event directness; moderate conceptual relevance to same-session grouping.
- Identity: PMID [34757594](https://pubmed.ncbi.nlm.nih.gov/34757594/); DOI [10.1007/s40279-021-01587-7](https://doi.org/10.1007/s40279-021-01587-7).

**C16 - Eddens et al. (2018), The Role of Intra-session Exercise Sequence in the Interference Effect: A Systematic Review With Meta-Analysis**

- Population/status: 10 studies of healthy adults, interventions at least 5 weeks; not runner- or youth-specific.
- Order/separation/dose: same-session resistance -> endurance versus endurance -> resistance. Separation was intra-session and heterogeneous.
- Outcomes/effect/uncertainty: resistance -> endurance favored dynamic strength by weighted mean difference +6.91% (95% CI 1.96-11.87; p=.006; I2=66%). No sequence effect was found for hypertrophy (+1.15%, -1.56 to 3.87; p=.40), static strength (-.04%, -3.19 to 3.11; p=.98), or aerobic capacity (-.27%, -2.74 to 2.20; p=.83). Power had only two studies. This does not justify universal `strength first`; the detectable effect was specific to dynamic-strength priority.
- Adverse/access/directness: adverse events were not synthesized. `FULL_TEXT_VERIFIED`. Low population/event directness; moderate same-session-order relevance.
- Identity: PMID [28917030](https://pubmed.ncbi.nlm.nih.gov/28917030/); PMCID [PMC5752732](https://pmc.ncbi.nlm.nih.gov/articles/PMC5752732/); DOI [10.1007/s40279-017-0784-1](https://doi.org/10.1007/s40279-017-0784-1).

**C17 - Lee et al. (2020), Adaptations to high-intensity interval training and strength training performed in sequence: a randomized controlled trial**

- Population/status: 29 healthy, moderately active men, age 24.5; HIIT -> resistance n=10, resistance -> HIIT n=10, resistance-only n=9.
- Order/separation/dose: 9 weeks, 3 days/week. Cycling HIIT and resistance were separated within the day by 3.1 +/- 0.2-0.5 h.
- Outcomes/effect/uncertainty: all groups improved strength 24-28% and lean mass 3-4%, with no clear between-group differences; both concurrent groups improved VO2peak 8-9%, peak aerobic power 16-20%, and lactate-threshold measures 14-15%. Resistance -> HIIT attenuated countermovement-jump displacement (-5.1 +/- 4.3%), force (-8.2 +/- 7.1%), and power (-6.0 +/- 4.7%) relative to resistance-only, whereas HIIT -> resistance mainly showed a comparable velocity change. This conflicts with any simple strength-first rule and suggests outcome-specific sequence effects.
- Adverse/access/directness: one withdrawal due to an injury outside the study; no intervention adverse event reported. `FULL_TEXT_VERIFIED`. Low youth/runner directness; moderate same-day sequence relevance.
- Identity: PMID [32407361](https://pubmed.ncbi.nlm.nih.gov/32407361/); PMCID [PMC7224385](https://pmc.ncbi.nlm.nih.gov/articles/PMC7224385/); DOI [10.1371/journal.pone.0233134](https://doi.org/10.1371/journal.pone.0233134).

**C18 - Robineau et al. (2016), Specific training effects of concurrent aerobic and strength exercises depend on recovery duration**

- Population/status: 58 adult amateur rugby players randomized to concurrent 0 h, 6 h, or 24 h separation, strength-only, or control for 7 weeks.
- Order/separation/dose: two sessions of each quality/week; resistance always preceded aerobic work. Concurrent conditions differed only in 0/6/24 h recovery.
- Outcomes/effect/uncertainty: strength gains were lower at 0 h than at 6 h, 24 h, or strength-only. VO2peak improved in all concurrent groups, with changes described as larger at 24 h than 0/6 h. The abstract uses magnitude-based inference and does not provide complete estimates/CIs. A single adult team-sport trial cannot establish a universal 6 h or 24 h threshold, particularly for adolescents.
- Adverse/access/directness: adverse events NR. `ABSTRACT_ONLY`. Highly indirect population; moderate experimental separation relevance.
- Identity: PMID [25546450](https://pubmed.ncbi.nlm.nih.gov/25546450/); DOI [10.1519/JSC.0000000000000798](https://doi.org/10.1519/JSC.0000000000000798).

**C19 - MacNeil et al. (2014), The order of exercise during concurrent training for rehabilitation does not alter acute genetic expression, mitochondrial enzyme activity or improvements in muscle function**

- Population/status: 18 healthy inactive adults (10 male/8 female), age 20 +/- 2, after 2 weeks unilateral knee immobilization; rehabilitation context is strongly indirect.
- Order/separation/dose: 6 weeks, 3 sessions/week with at least one rest day. Endurance -> resistance or resistance -> endurance with immediate transfer; each session combined 22.5 min cycling at 65-75% VO2peak and 3 x 10 leg press/curl/extension at 65-80% 1RM, approximately 45 min total.
- Outcomes/effect/uncertainty: order affected mitochondrial complex II activity but not improvements in strength, muscle mass, or VO2peak; acute gene-expression interactions were null (p=.20-.87). This null rehab study should not override trained-runner evidence.
- Adverse/access/directness: immobilization pain/edema were monitored; training adverse events NR. `FULL_TEXT_VERIFIED`. Very low population/event directness; direct immediate-order manipulation.
- Identity: PMID [25289940](https://pubmed.ncbi.nlm.nih.gov/25289940/); PMCID [PMC4188604](https://pmc.ncbi.nlm.nih.gov/articles/PMC4188604/); DOI [10.1371/journal.pone.0109189](https://doi.org/10.1371/journal.pone.0109189).

**C20 - Wilson et al. (2012), Concurrent training: a meta-analysis examining interference of aerobic and resistance exercises**

- Population/status: 21 adult studies; older synthesis, with substantial overlap with later reviews.
- Order/separation/dose: examined endurance modality, frequency, and duration as moderators; it did not supply a youth-runner calendar rule.
- Outcomes/effect/uncertainty: concurrent endurance was associated with interference in strength-related adaptation, particularly power, and effects varied with endurance mode/dose. This historical signal is retained as supporting context but should be weighted below the larger updated 2022 synthesis; exact source-level scheduling is not recoverable from the abstract.
- Adverse/access/directness: adverse events were not synthesized. `ABSTRACT_ONLY`. Low youth/runner scheduling directness.
- Identity: PMID [22002517](https://pubmed.ncbi.nlm.nih.gov/22002517/); DOI [10.1519/JSC.0b013e31823a3e2d](https://doi.org/10.1519/JSC.0b013e31823a3e2d).

**C21 - Petre et al. (2021), Development of Maximal Dynamic Strength During Concurrent Resistance and Endurance Training in Untrained, Moderately Trained, and Trained Individuals: A Systematic Review and Meta-analysis**

- Population/status: 27 studies, 750 adults (523 male/227 female), age 20-38; seven untrained, 10 moderately trained, and 10 trained studies.
- Order/separation/dose: lower-body 1RM after concurrent versus identical resistance-only training. Twelve studies used same-session separation under 20 min, 13 used different sessions over 2 h, two mixed, and one did not report. These bins reflect gaps in included protocols, not validated thresholds.
- Outcomes/effect/uncertainty: no significant strength penalty in untrained (ES .03, 95% CI -.29 to .35; p=.87) or moderately trained participants (-.20, -.42 to .02; p=.08), but a small effect favoring resistance-only in trained participants (-.35, -.59 to -.11; p<.01). Within trained studies, same-session concurrent training was negative (-.66, -1.08 to -.25; p<.01; I2=17.1%), whereas different-session was null (-.10; p=.55). This between-study subgroup result concerns maximal strength, adults, and comparison with resistance-only; it does not determine endurance-first versus strength-first or an adolescent schedule.
- Adverse/access/directness: adverse events were not synthesized. `FULL_TEXT_VERIFIED`. Low youth/event directness; moderate separation/interference relevance.
- Identity: PMID [33751469](https://pubmed.ncbi.nlm.nih.gov/33751469/); PMCID [PMC8053170](https://pmc.ncbi.nlm.nih.gov/articles/PMC8053170/); DOI [10.1007/s40279-021-01426-9](https://doi.org/10.1007/s40279-021-01426-9).

## Cross-source conclusions for RQ-C

### What is supported

1. Adolescent and trained-runner studies support retaining resistance, plyometric, sprint/speed-endurance, hill, and aerobic components as distinct, dosed objects. Several interventions improved economy, power, or performance, but component efficacy is not the same as scheduling efficacy.
2. A specific within-strength-session pattern, heavy resistance -> biomechanically matched plyometric work with multi-minute recovery, has direct evidence in male adolescent runners (C01) and young adult trained runners (C07). Neither trial compared the reverse order or fully reported the placement of all running work.
3. Same-session interference is outcome- and population-specific. Adult syntheses find little/no average penalty for maximal strength or hypertrophy but a small penalty for explosive strength (C15); trained participants may be more susceptible for lower-body maximal strength when endurance and resistance occur in one session (C21).
4. Resistance -> endurance may favor dynamic-strength development in same-session adult studies, while hypertrophy, static strength, and aerobic capacity show no clear order effect (C16). A 3 h same-day RCT found broadly similar strength/aerobic adaptations but an explosive-performance signal adverse to resistance -> HIIT (C17). Therefore the evidence does not support a universal `strength first` rule.
5. Acute depth jumps -> 10 min recovery -> running improved economy but not time to exhaustion in junior middle-distance runners (C05). Speed-endurance -> heavy resistance improved adult runner outcomes when it partly replaced running volume (C10). Both are narrow protocol examples, not universal templates.

### What remains uncertain or unsupported

- Direct head-to-head adolescent middle-distance evidence for endurance-strength order, number of hours between same-day sessions, or adjacent-day placement was not found.
- No direct evidence was found for where hill repetitions should sit relative to strength/plyometrics. Hill evidence supports a component, not a composite order (C11).
- Cycling/cross-training cannot be treated as interchangeable with running, as a guaranteed recovery method, or as lower fatigue. Current pooled effects are null with wide uncertainty and substantial indirectness (C12-C13).
- The 3 h, 6 h, and 24 h findings come from heterogeneous adult studies and study-defined bins. They should be stored as source-specific evidence, never promoted to a hard youth threshold.
- Adverse-event reporting was sparse or absent throughout. The evidence cannot establish safety of a proposed composite microcycle.

### Evidence-state recommendation for downstream synthesis

- `component inclusion`: `SUPPORTED_BUT_CONTEXTUAL` for resistance/plyometric work; `LIMITED` for hill, speed-endurance, and alternative aerobic components.
- `heavy resistance -> matched plyometric within a complex pair`: `SUPPORTED_IN_NARROW_PROTOCOLS`; preserve the order and the 3-4 min recovery when citing those protocols.
- `endurance versus strength order for youth middle-distance`: `UNKNOWN`.
- `same-day separation for youth middle-distance`: `UNKNOWN`; adult evidence can inform a caution note only.
- `adjacent-day placement`: `UNKNOWN`.
- `universal fatigue number`, `universal sequence`, or `9.5-day scientific superiority/safety`: `PROHIBITED_INFERENCE`.

A minimally faithful representation is an ordered list of component records, for example `{component_type, goal, modality, dose, order_index, separation_minutes, relation: same_session|same_day|adjacent_day, provenance, outcome_priority}`. Unknown fields should remain null/unknown. Session RPE should remain session-level rather than being split into unsupported component fatigue values.

## Verification and overlap notes

- Reviews overlap primary studies. In particular, C06 includes C02-C04, runner strength reviews overlap C07-C09, and C15/C16/C20/C21 share adult concurrent-training trials. They are not independent votes and must not be tally-counted.
- All DOI/PMID/PMCID pairs above were checked against PubMed/PMC or official publisher metadata on 2026-07-17. No included record was identified as retracted or corrected in the PubMed metadata checked; this is a metadata-level screen, not a Crossmark audit.
- Numerical results were transcribed only when present in the abstract or full text reviewed. Missing estimates, maturity methods, sequence, separation, adherence, and adverse events are explicitly left NR rather than inferred.
