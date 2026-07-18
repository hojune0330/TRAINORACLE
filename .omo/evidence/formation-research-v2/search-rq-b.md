# RQ-B Raw Search Evidence: Session-Specific Recovery and Spacing

Search date: 2026-07-17 (Asia/Seoul)
Protocol: `FORMATION_RESEARCH_PROTOCOL_V2.md`, RQ-B
Status: executable raw search/extraction; not a final synthesis or clearance rule

## Non-Negotiable Interpretation Boundary

- `72 h` is a coach-selected target interval to describe elapsed time only. It is never a
  recovery, readiness, safety, pain/illness, or next-MAIN clearance threshold.
- A marker returning near baseline does not establish complete recovery. A non-significant
  difference is not equivalence unless the study actually used an equivalence design.
- Performance, force, power, gait, neuromuscular, autonomic, soreness, subjective, and
  biochemical outcomes remain distinct. No row below collapses them into `recovered`.
- Direct youth middle-distance evidence was not found. Two eligible direct adolescent-runner
  papers concern an all-out 21-km run and biochemical outcomes only; their session is not a
  middle-distance MAIN analogue.
- Adult runners, soccer players, other athletes, cycling, resistance, and plyometric studies
  are indirect. None authorizes a youth prescription or a whole-Formation safety claim.

## Executed Search

PubMed was searched from database inception through 2026-07-17 with NCBI E-utilities
`esearch.fcgi`, `db=pubmed`, `retmode=json`. Counts below are the API counts observed on
2026-07-17. Title/abstract fielding was used to keep the runs reproducible.

| Query ID | Exact query | Hits |
|---|---|---:|
| RQ-B-P1 | `(adolescent[Title/Abstract] OR youth[Title/Abstract] OR pediatric[Title/Abstract]) AND (runner*[Title/Abstract] OR "middle distance"[Title/Abstract] OR endurance[Title/Abstract]) AND (recovery[Title/Abstract] OR "residual fatigue"[Title/Abstract]) AND ("24 h"[Title/Abstract] OR "24 hour"[Title/Abstract] OR "48 h"[Title/Abstract] OR "72 h"[Title/Abstract] OR "96 h"[Title/Abstract])` | 3 |
| RQ-B-P2 | `(adolescent[Title/Abstract] OR youth[Title/Abstract]) AND (athlete*[Title/Abstract] OR soccer[Title/Abstract]) AND ("recovery time course"[Title/Abstract] OR "post-match"[Title/Abstract] OR "exercise-induced muscle damage"[Title/Abstract]) AND ("24 h"[Title/Abstract] OR "48 h"[Title/Abstract] OR "72 h"[Title/Abstract] OR "96 h"[Title/Abstract])` | 12 |
| RQ-B-P3 | `(runner*[Title/Abstract] OR "middle distance"[Title/Abstract] OR "distance running"[Title/Abstract]) AND ("recovery time course"[Title/Abstract] OR "residual fatigue"[Title/Abstract] OR recovery[Title/Abstract]) AND ("24 h"[Title/Abstract] OR "48 h"[Title/Abstract] OR "72 h"[Title/Abstract] OR "96 h"[Title/Abstract]) AND (interval[Title/Abstract] OR HIIT[Title/Abstract] OR sprint[Title/Abstract] OR hill[Title/Abstract] OR downhill[Title/Abstract] OR competition[Title/Abstract])` | 23 |
| RQ-B-P4 | `(runner*[Title/Abstract] OR sprint*[Title/Abstract] OR athlete*[Title/Abstract]) AND (plyometric[Title/Abstract] OR resistance[Title/Abstract] OR "combined training"[Title/Abstract]) AND (recovery[Title/Abstract] OR "exercise-induced muscle damage"[Title/Abstract]) AND ("24 h"[Title/Abstract] OR "48 h"[Title/Abstract] OR "72 h"[Title/Abstract] OR "96 h"[Title/Abstract])` | 90 |
| RQ-B-P5 | `(runner*[Title/Abstract] OR athlete*[Title/Abstract]) AND (recovery[Title/Abstract] OR fatigue[Title/Abstract] OR soreness[Title/Abstract]) AND ("96 h"[Title/Abstract] OR "120 h"[Title/Abstract] OR "168 h"[Title/Abstract] OR "7 days"[Title/Abstract]) AND (running[Title/Abstract] OR sprint[Title/Abstract] OR plyometric[Title/Abstract] OR resistance[Title/Abstract] OR competition[Title/Abstract])` | 80 |
| RQ-B-P6 | `(recovery[Title] OR "residual fatigue"[Title]) AND (systematic review[Publication Type] OR meta-analysis[Publication Type]) AND (runner*[Title/Abstract] OR sprint*[Title/Abstract] OR soccer[Title/Abstract] OR athlete*[Title/Abstract]) AND (neuromuscular[Title/Abstract] OR performance[Title/Abstract] OR soreness[Title/Abstract] OR "creatine kinase"[Title/Abstract])` | 61 |

Targeted web discovery/identity checks were also executed with these exact strings:

```text
site:pubmed.ncbi.nlm.nih.gov (adolescent OR youth) runner recovery 24 h 48 h 72 h interval competition neuromuscular
site:pubmed.ncbi.nlm.nih.gov youth runners recovery kinetics competition creatine kinase soreness 24 hours
site:pubmed.ncbi.nlm.nih.gov trained runners recovery time course interval running 24 h 48 h neuromuscular gait
site:pubmed.ncbi.nlm.nih.gov runner recovery 72 hours sprint plyometric resisted sprint
site:pubmed.ncbi.nlm.nih.gov youth soccer 72 h post-match recovery sprint jump soreness creatine kinase
"10.1080/02640414.2023.2263522" resisted sprint recovery
```

The P1 search returned three records: two eligible adolescent-runner 21-km studies and one
swimming false positive. SPORTDiscus, Scopus, Web of Science, and Cochrane were not available
in this execution environment and were not searched. Therefore this is a PubMed-led deep
search slice, not a comprehensive or PRISMA-complete review. Forward/backward citation
chasing and independent dual screening remain pending.

## Prioritized Source Extraction (22 Sources)

Access labels mean: `FULL_TEXT_VERIFIED` = the accessible article body, methods/results, and
limitations were inspected; `ABSTRACT_ONLY` = only metadata and abstract-level claims are
extracted, even if a full-text link may exist. Abstract-only rows cannot support detailed
protocol, effect-magnitude, safety, or final-certainty claims.

### Youth runners and youth athletes first

#### B01 - Direct adolescent runners; 24-h biochemical residual

- **Identity/access:** Tian et al. (2010), [PubMed 20668873](https://pubmed.ncbi.nlm.nih.gov/20668873/), DOI [10.1007/s00421-010-1583-7](https://doi.org/10.1007/s00421-010-1583-7), `ABSTRACT_ONLY`.
- **Participants/session/protocol:** 12 male trained adolescent runners, 16.2 +/- 0.6 y; all-out
  21-km run; blood pre, 2, 4, and 24 h.
- **Outcomes/result:** **biochemical** only (TBARS, uric acid, glutathione, XO, SOD, CAT).
  At 24 h the abstract reports elevated CAT and TBARS versus pre-run; other domains were not
  measured.
- **Uncertainty/limits:** small male-only sample, extreme endurance bout, no performance or
  neuromuscular outcome, no comparator, maturity not reported. This is counterevidence to
  treating 24 h as universal normalization, not evidence of harm or a spacing prescription.

#### B02 - Direct adolescent runners; 24-h renal/muscle-marker residual

- **Identity/access:** Tian et al. (2011), [PubMed 21466418](https://pubmed.ncbi.nlm.nih.gov/21466418/), DOI [10.1515/CCLM.2011.172](https://doi.org/10.1515/CCLM.2011.172), `ABSTRACT_ONLY`.
- **Participants/session/protocol:** 10 male trained adolescent runners, 16.2 +/- 0.6 y;
  all-out 21-km run; blood pre, 2, 4, and 24 h.
- **Outcomes/result:** **biochemical** (urea, creatinine, CK, LDH, Hb/Hct, calculated eGFR and
  plasma-volume change). The abstract reports that early changes were sustained at 24 h.
- **Uncertainty/limits:** small male-only cohort, calculation and hydration sensitivity,
  extreme event, no performance/force/gait measure. Do not convert biomarkers into a diagnosis,
  safety judgment, or clearance decision.

#### B03 - Trained adolescent multi-sport endurance athletes; 24-72 h mixed markers

- **Identity/access:** Birat et al. (2020), [PubMed 32116738](https://pubmed.ncbi.nlm.nih.gov/32116738/), [PMC7012902](https://pmc.ncbi.nlm.nih.gov/articles/PMC7012902/), DOI [10.3389/fphys.2020.00010](https://doi.org/10.3389/fphys.2020.00010), `FULL_TEXT_VERIFIED`.
- **Participants/session/protocol:** 12 trained males, 14-15 y; both a 1-day 48.2-km and a
  2-day 66.0-km adventure race (trail running, cycling, kayaking, skating), 10 weeks apart;
  pre/post and 24-72 h depending on marker.
- **Outcomes/result:** **power** drop-jump height fell 5.9% after racing; squat jump was
  unchanged. **Force** MVIC was unchanged. **Soreness** rose at 24 h and was not different
  from baseline at 72 h. **Biochemical** cTnI/CK-MB generally returned toward baseline at
  24-48 h, except CK-MB after the 2-day race.
- **Uncertainty/limits:** mixed modalities and durations, n=12 males, no female athletes, no
  cardiac-function measure, and no blood draw after day 1 of the 2-day race. Marker-specific
  observations cannot establish whole-athlete recovery or safety.

#### B04 - Elite youth soccer match; force differs at 24, 48, and 72 h

- **Identity/access:** Oliver et al. (2019), [PubMed 31581584](https://pubmed.ncbi.nlm.nih.gov/31581584/), [PMC6835616](https://pmc.ncbi.nlm.nih.gov/articles/PMC6835616/), DOI [10.3390/sports7100218](https://doi.org/10.3390/sports7100218), `FULL_TEXT_VERIFIED`.
- **Participants/session/protocol:** 14 elite youth soccer players, 16 +/- 2 y; 90-min match;
  posterior-chain isometric peak force pre, post, 24, 48, and 72 h; no subsequent training.
- **Outcomes/result:** **force** was -18% post, -8% at 24 h, not different from pre at 48 h,
  and +12% at 72 h. Large individual and joint-angle variation was present.
- **Uncertainty/limits:** one team/one match, no cohort-specific day-to-day reliability, and
  repeated familiarization may explain the above-baseline 72-h value. A single force test is
  not a clearance assessment.

#### B05 - Elite youth soccer match; 48-h power/soreness/CK residual under two interventions

- **Identity/access:** Pooley et al. (2017), [PubMed 28761702](https://pubmed.ncbi.nlm.nih.gov/28761702/), [PMC5530097](https://pmc.ncbi.nlm.nih.gov/articles/PMC5530097/), DOI [10.1136/bmjsem-2016-000202](https://doi.org/10.1136/bmjsem-2016-000202), `FULL_TEXT_VERIFIED`.
- **Participants/session/protocol:** 10 male elite academy players, 16 +/- 1 y; competitive
  match, then static stretching or passive recovery in a crossover; pre, post, and 48 h.
- **Outcomes/result:** **power** CMJ remained lower and **soreness/biochemical** CK remained
  elevated at 48 h in both conditions; static stretching differed from passive recovery only
  for CK at 48 h.
- **Uncertainty/limits:** n=10, intervention confounds natural kinetics, no 24- or 72-h measure,
  and the source itself is soccer-specific. It cannot set a runner interval.

#### B06 - Elite youth soccer match; objective and subjective markers disagree

- **Identity/access:** Tito et al. (2025), [PubMed 39472024](https://pubmed.ncbi.nlm.nih.gov/39472024/), DOI [10.1055/a-2456-2151](https://doi.org/10.1055/a-2456-2151), `ABSTRACT_ONLY`.
- **Participants/session/protocol:** 42 male elite youth players, 17.13 +/- 0.70 y; official
  match; -2 h, +30 min, +24 h, +48 h.
- **Outcomes/result:** **neuromuscular** low-frequency fatigue was reduced post-match but not
  different from baseline at 24 h; **power** CMJ did not differ at any time; **subjective and
  soreness** measures remained impaired through 48 h.
- **Uncertainty/limits:** abstract-only, male soccer, no 72 h, and no biochemical/gait outcome.
  The discordance is evidence to retain separate marker domains.

#### B07 - Elite youth soccer match plus a 48-h training manipulation

- **Identity/access:** Franceschi et al. (2025), [PubMed 40254901](https://pubmed.ncbi.nlm.nih.gov/40254901/), [PMC12010046](https://pmc.ncbi.nlm.nih.gov/articles/PMC12010046/), DOI [10.1002/ejsc.12297](https://doi.org/10.1002/ejsc.12297), `FULL_TEXT_VERIFIED`.
- **Participants/session/protocol:** 48 Italian Serie A youth players; match; pre, +0.5, +48,
  +72 h; randomized at 48 h to complete training (n=26) or reduced training (n=22).
- **Outcomes/result:** at 48 h, **force** posterior-chain and **soreness** were still altered,
  while **power** CMJ and **subjective** fatigue were not different from baseline. Complete
  training caused reductions in CMJ/force from 48 to 72 h versus reduced training.
- **Uncertainty/limits:** no 24-h point, friendly-match stimulus, no biochemical outcomes, and
  the 72-h value includes an intervening session. This is strong evidence that elapsed time
  alone does not identify the causal session or current state.

#### B08 - U19/U23 soccer; force still lower at 72 h with intervening load

- **Identity/access:** Pimenta et al. (2025), [PubMed 41048235](https://pubmed.ncbi.nlm.nih.gov/41048235/), [PMC12490303](https://pmc.ncbi.nlm.nih.gov/articles/PMC12490303/), DOI [10.5114/biolsport.2025.150044](https://doi.org/10.5114/biolsport.2025.150044), `FULL_TEXT_VERIFIED`.
- **Participants/session/protocol:** 73 U19/U23 players; match participation >60 min versus
  non-participation observations; IMTP peak force at baseline, 48 h, and 72 h; match and
  training loads recorded.
- **Outcomes/result:** **force** was -8.1% at 48 h and -6.2% at 72 h in match participants.
  Non-participants also showed -8.2% at 72 h, attributed by the authors to MD+2 training.
  Load metrics did not correlate with force change.
- **Uncertainty/limits:** mixed U19/U23 population, no 24/96 h, one force test, unbalanced
  observations, and superimposed training. The result is counterevidence to 72-h clearance,
  but it cannot isolate the match as the sole cause.

#### B09 - Elite youth soccer strength/plyometric sessions; selected markers near baseline by 72 h

- **Identity/access:** Kadlubowski et al. (2026), [PubMed 41858994](https://pubmed.ncbi.nlm.nih.gov/41858994/), [PMC12996250](https://pmc.ncbi.nlm.nih.gov/articles/PMC12996250/), DOI [10.3389/fspor.2026.1742295](https://doi.org/10.3389/fspor.2026.1742295), `FULL_TEXT_VERIFIED`.
- **Participants/session/protocol:** 32 male U17/U19 elite academy players, 16.5 +/- 0.7 y,
  limited structured-strength experience; crossover with fixed order and 8-day washout:
  back squats plus calf raises versus back squats plus hurdle/drop jumps; pre, 24, 48, 72 h.
- **Outcomes/result:** no modality-by-time interaction. **Power/force** CMJ, drop jump, IMTP
  and adductor strength, **subjective/soreness**, and **biochemical** CK changed with time;
  largest fatigue was reported at 24-48 h, CK peaked at 48 h, and selected markers were
  reported near baseline by 72 h.
- **Uncertainty/limits:** non-random order, shared squat stimulus, unfamiliar strength work,
  no sleep/nutrition control, no sprint or central-fatigue test, and no chronic or adverse-event
  endpoint. The article's safety wording is not adopted: selected 72-h marker behavior is not
  a safety or clearance finding.

#### B10 - Youth versus adult EIMD review; age modifies magnitude but not a universal interval

- **Identity/access:** Fernandes et al. (2024), [PubMed 38065086](https://pubmed.ncbi.nlm.nih.gov/38065086/), DOI [10.1123/pes.2023-0108](https://doi.org/10.1123/pes.2023-0108), `ABSTRACT_ONLY`.
- **Participants/session/protocol:** systematic review/meta-analysis of youth-adult comparisons
  reporting strength, soreness, or CK at >=24 h without a recovery treatment.
- **Outcomes/result:** peak **force, soreness, biochemical** effects were larger in adults in
  pooled comparisons; meta-regression found the limb effect for soreness but not strength/CK.
- **Uncertainty/limits:** abstract does not give session-specific kinetics or runner strata;
  peak effects are not time-to-normalization, and pooled youth evidence cannot clear an
  individual adolescent.

### Trained runners and sprint-trained athletes second

#### B11 - National-standard middle-distance runners; 1500 m performance maintained at 24 h

- **Identity/access:** Birdsey et al. (2026), [PubMed 41667403](https://pubmed.ncbi.nlm.nih.gov/41667403/), [PMC12890468](https://pmc.ncbi.nlm.nih.gov/articles/PMC12890468/), DOI [10.1002/ejsc.70142](https://doi.org/10.1002/ejsc.70142), `FULL_TEXT_VERIFIED`.
- **Participants/session/protocol:** 12 national-standard 1500-m specialists (10 M, 2 F),
  27 +/- 7 y; two self-paced treadmill 1500-m time trials 24 h apart.
- **Outcomes/result:** **performance** time/speed, **gait/force-platform** step variables, and
  most physiological measures differed no more than prior measurement error; athletes were
  about 2.5 times more likely to report higher exertion on trial 2, with considerable uncertainty.
- **Uncertainty/limits:** n=12 adults, treadmill individual trial, early season, carbon shoes,
  and no tactical race. Maintaining this one performance outcome at 24 h is not evidence that
  other outcomes normalized or that repeating MAIN is safe.

#### B12 - Club runners; 6 x 800 m gives mixed 24-h gait/neuromuscular result

- **Identity/access:** Riazati et al. (2022), [PubMed 35721873](https://pubmed.ncbi.nlm.nih.gov/35721873/), [PMC9201250](https://pmc.ncbi.nlm.nih.gov/articles/PMC9201250/), DOI [10.3389/fspor.2022.830278](https://doi.org/10.3389/fspor.2022.830278), `FULL_TEXT_VERIFIED`.
- **Participants/session/protocol:** 20 recreational masters club runners (10 F, 10 M); six
  800-m HIIT repetitions; pre, immediately post, 24 h; 6-min medium run for gait testing.
- **Outcomes/result:** **gait** hip/knee kinematics and coordination, **force** maximal isometric
  force, and **neuromuscular** voluntary activation/twitch changed post. NHST suggested several
  group deficits at 24 h, while minimum-detectable-change analysis classified most, but not all,
  individuals as within measurement variability.
- **Uncertainty/limits:** masters rather than youth, no 48/72 h, n=20, and inference depends on
  statistical method. The paper's injury-risk language is not used as a causal or safety claim.

#### B13 - Recreational runners; downhill-run gait and biochemical residual at 48 h

- **Identity/access:** Markus et al. (2025), [PubMed 39863478](https://pubmed.ncbi.nlm.nih.gov/39863478/), DOI [10.1016/j.jsams.2025.01.002](https://doi.org/10.1016/j.jsams.2025.01.002), `ABSTRACT_ONLY`.
- **Participants/session/protocol:** 26 adult recreational male runners; 60-min downhill run
  at -10% and 65% maximal HR; baseline, post, 24, 48 h.
- **Outcomes/result:** selected **gait/force** vertical ground-reaction-force peaks remained
  reduced through 24-48 h; **biochemical** CK was elevated at 24 and 48 h; MRI T2 in anterior
  thigh remained elevated to 48 h; pain was assessed but its exact abstract result is not reported.
- **Uncertainty/limits:** abstract-only, male recreational runners, contrived eccentric-damage
  session, asymmetric findings, and no 72-h point.

#### B14 - Recreational runners; downhill-run soreness beyond 72 h

- **Identity/access:** Khassetarash et al. (2022), [PubMed 34098176](https://pubmed.ncbi.nlm.nih.gov/34098176/), [PMC9189713](https://pmc.ncbi.nlm.nih.gov/articles/PMC9189713/), DOI [10.1016/j.jshs.2021.06.001](https://doi.org/10.1016/j.jshs.2021.06.001), `FULL_TEXT_VERIFIED`.
- **Participants/session/protocol:** 10 recreational male runners; two 30-min downhill bouts
  (-20%, 2.8 m/s) three weeks apart; pre/post, 24, 48, 72, 96, 168 h.
- **Outcomes/result:** after bout 1, **force** MVC remained lower through 48 h, peripheral
  neuromuscular indices returned toward baseline by 48 h, **gait** remained altered up to 72 h,
  and **soreness** remained elevated through 96 h before not differing at 168 h. Bout 2 produced
  smaller/shorter responses. The results text reports CK elevation at 96 h, but the methods text
  describes blood at post/48/72 h; treat this CK time point as internally inconsistent.
- **Uncertainty/limits:** n=10 men, CK subset n=6, fixed absolute speed, treadmill surface, and
  strong repeated-bout effect. The 96-h soreness residual is explicit >72-h counterevidence;
  it does not define a new universal interval.

#### B15 - Sprint-trained athletes; load-specific residual at 72 h

- **Identity/access:** Liakou et al. (2024), [PubMed 37776346](https://pubmed.ncbi.nlm.nih.gov/37776346/), [PMC10879260](https://pmc.ncbi.nlm.nih.gov/articles/PMC10879260/), DOI [10.1007/s00421-023-05317-x](https://doi.org/10.1007/s00421-023-05317-x), `FULL_TEXT_VERIFIED`.
- **Participants/session/protocol:** 10 competitive sprinters, long jumpers, and soccer players,
  18-26 y; randomized crossover: unresisted, 10%-body-mass resisted, 20%-body-mass resisted,
  and control; 2 x (3 x 20 m) plus 1 x (3 x 30 m); pre, 24, 48, 72 h.
- **Outcomes/result:** **biochemical/soreness** CK and DOMS remained elevated to 72 h across
  sprint trials; **force** selected eccentric torque was lower at 24 h; **performance** 30-m
  sprint time was slower at 24, 48, and 72 h only after 20% resistance; **power** CMJ was unchanged.
- **Uncertainty/limits:** n=10 mixed-sport adults, crossover/repeated-bout concerns, high CK
  variability, and no youth runner. The finding is protocol/load-specific.

### Indirect athletes and reviews third

#### B16 - Intense plyometrics; jump performance through 72 h, strength unchanged

- **Identity/access:** Chatzinikolaou et al. (2010), [PubMed 20386477](https://pubmed.ncbi.nlm.nih.gov/20386477/), DOI [10.1519/JSC.0b013e3181d1d318](https://doi.org/10.1519/JSC.0b013e3181d1d318), `ABSTRACT_ONLY`.
- **Participants/session/protocol:** 12 exercise and 12 resting controls; intense plyometric
  bout; pre, post, 24, 48, 72, 96, 120 h. Participant training status and full exercise dose
  are not verified from the abstract.
- **Outcomes/result:** **power** CMJ/SJ fell 8-20% and were reported impaired as long as 72 h;
  **force** remained unchanged; **soreness/biochemical** DOMS, CK, LDH peaked 24-48 h;
  inflammatory markers were mainly altered in the first 24 h.
- **Uncertainty/limits:** abstract-only, non-runner, participant details incomplete, and many
  biomarkers/multiple tests. A 72-h jump result is not whole-session clearance evidence.

#### B17 - Combined plyometric/resistance session; residual performance and markers at 48 h

- **Identity/access:** Doma et al. (2021), [PubMed 34296839](https://pubmed.ncbi.nlm.nih.gov/34296839/), DOI [10.23736/S0022-4707.20.11603-7](https://doi.org/10.23736/S0022-4707.20.11603-7), `ABSTRACT_ONLY`.
- **Participants/session/protocol:** 9 competitive Ultimate Frisbee players; multi-modal
  plyometric plus resistance session; pre, 24, 48 h.
- **Outcomes/result:** **power** vertical/broad jump and **performance** linear sprint were
  impaired at 24 and 48 h; repeated agility was impaired at 24 h; **soreness/biochemical**
  DOMS and CK were elevated at 24 and 48 h.
- **Uncertainty/limits:** n=9, abstract-only, combined components cannot be causally separated,
  and no 72-h point. The authors' suggested interval is not adopted as a universal rule.

#### B18 - Cycling SIT; selected 24-h force/power/neuromuscular/autonomic markers unchanged

- **Identity/access:** Lloria-Varella et al. (2023), [PubMed 37285051](https://pubmed.ncbi.nlm.nih.gov/37285051/), DOI [10.1007/s00421-023-05249-6](https://doi.org/10.1007/s00421-023-05249-6), `ABSTRACT_ONLY`.
- **Participants/session/protocol:** 25 healthy adults; cycle ergometer 8 x 15-s all-out with
  2-min rests; pre, 24, 48 h; nocturnal HRV for three subsequent nights.
- **Outcomes/result:** no significant 24/48-h difference in selected **force/power** iMVC,
  evoked force, F0/V0/Pmax, **neuromuscular** voluntary activation, or **autonomic** HRV.
- **Uncertainty/limits:** cycling rather than running, healthy adults, abstract-only, no
  soreness/biochemical/gait endpoint, and non-significance is not proof of complete recovery.

#### B19 - Cycling repeated sprints; performance and neuromuscular markers disagree at 24 h

- **Identity/access:** Milioni et al. (2021), [PubMed 33300757](https://pubmed.ncbi.nlm.nih.gov/33300757/), DOI [10.1249/MSS.0000000000002482](https://doi.org/10.1249/MSS.0000000000002482), `ABSTRACT_ONLY`.
- **Participants/session/protocol:** 10 adults; recumbent-cycle 10 x 10-s sprints/30-s rest;
  repeated sessions separated by randomized 24 h or 48 h, with within-session testing.
- **Outcomes/result:** **performance** sprint output did not differ between sessions, but at
  24 h **force/neuromuscular** chair MVC was 6.5% lower and Db100 10.4% lower; these deficits
  were not reported for 48 h. Separation did not change the within-session fatigue pattern.
- **Uncertainty/limits:** n=10, cycling, abstract-only, repeated-session design, no youth or
  running outcome. Preserved output does not erase a simultaneous neuromuscular difference.

#### B20 - Resistance/plyometric EIMD systematic review; pooled effects to 72 h

- **Identity/access:** Harrison et al. (2024), [PubMed 38952917](https://pubmed.ncbi.nlm.nih.gov/38952917/), [PMC11167466](https://pmc.ncbi.nlm.nih.gov/articles/PMC11167466/), DOI [10.5114/biolsport.2024.131823](https://doi.org/10.5114/biolsport.2024.131823), `FULL_TEXT_VERIFIED`.
- **Participants/session/protocol:** 20 studies of healthy adults/adolescents after resistance
  or plyometric muscle-damaging protocols, requiring sprint/COD follow-up >=24 h.
- **Outcomes/result:** pooled **performance** sprint/COD and **power** CMJ impairments, plus
  **soreness/biochemical** DOMS/CK elevations, were reported up to 72 h.
- **Uncertainty/limits:** CK/DOMS heterogeneity I2 65-81%, varied training histories and
  protocols, English-only, limited diet/familiarization controls, and youth not isolated as
  middle-distance runners. Review overlap must be mapped before synthesis.

#### B21 - Soccer residual-fatigue review; external load predicts only some 24-h markers

- **Identity/access:** Hader et al. (2019), [PubMed 31820260](https://pubmed.ncbi.nlm.nih.gov/31820260/), [PMC6901634](https://pmc.ncbi.nlm.nih.gov/articles/PMC6901634/), DOI [10.1186/s40798-019-0219-7](https://doi.org/10.1186/s40798-019-0219-7), `FULL_TEXT_VERIFIED`.
- **Participants/session/protocol:** systematic review/meta-analysis, 11 soccer studies,
  n=165; external match load versus acute and residual outcomes up to 72 h.
- **Outcomes/result:** distance above 5.5 m/s correlated with **biochemical** CK and
  **power/neuromuscular** CMJ peak-power change immediately/24 h, but not at 48/72 h; total
  distance showed no clear relation to any marker.
- **Uncertainty/limits:** different tracking devices/thresholds, few studies, soccer-specific,
  and correlation does not create a readiness predictor or spacing rule.

#### B22 - Team-sport post-match systematic review; performance may precede CK normalization

- **Identity/access:** Doeven et al. (2018), [PubMed 29527320](https://pubmed.ncbi.nlm.nih.gov/29527320/), [PMC5841509](https://pmc.ncbi.nlm.nih.gov/articles/PMC5841509/), DOI [10.1136/bmjsem-2017-000264](https://doi.org/10.1136/bmjsem-2017-000264), `ABSTRACT_ONLY` for this extraction.
- **Participants/session/protocol:** systematic review of 28 team-ball-sport studies with at
  least two post-match measures; time courses extended to 144 h.
- **Outcomes/result:** the abstract reports that **performance** can return before underlying
  **biochemical** markers, with CK time courses to >=72 h; soccer/rugby tended to show longer
  sprint/CK/cortisol courses than other sports.
- **Uncertainty/limits:** abstract-level extraction, heterogeneous sports/protocols, no direct
  youth-runner stratum, and primary-study overlap with B20/B21 is not yet mapped.

## Counterevidence Map Required by the 72-h Challenge

### Explicit 24-h evidence in both directions

- **Selected performance preserved at 24 h:** B11 repeated 1500-m time, B18 selected cycle-SIT
  force/power/HRV, and B19 repeated-sprint output. Each is narrow and indirect for youth.
- **Selected outcomes still altered at 24 h:** B01/B02 adolescent-runner biochemical markers;
  B04 youth-soccer posterior-chain force; B12 some runners' gait/neuromuscular outcomes;
  B13 downhill-run gait/CK; B15 sprint-trained eccentric force; B19 cycle MVC/Db100.
- **Within-study disagreement:** B06 objective low-frequency fatigue was not different from
  baseline at 24 h while subjective fatigue/soreness/recovery remained altered through 48 h;
  B19 output was maintained while neuromuscular measures differed at 24 h.

### Residual at 72 h and beyond

- B08 reports lower IMTP force at 72 h after match exposure, but also shows that intervening
  MD+2 load changes the result and prevents a match-only causal interpretation.
- B15 reports CK/DOMS through 72 h and 30-m sprint impairment through 72 h only after the
  heaviest resisted-sprint condition.
- B16 and B20 report power/performance or muscle-damage outcomes through 72 h after intense
  plyometric/resistance protocols.
- B14 reports soreness through 96 h after the first unfamiliar downhill bout, with no
  difference at 168 h; this is explicit >72-h residual counterevidence.
- Conversely, B09 reports selected youth strength-session markers near baseline by 72 h,
  B04 force not lower at 48 h and higher at 72 h, and B03 soreness not different at 72 h.
  These do not cancel the residual studies because sessions, populations, and outcomes differ.

## Raw RQ-B Finding and Permitted Claim

`evidence_status = HETEROGENEOUS_OUTCOME_AND_SESSION_SPECIFIC`

`permitted_claim = "72 h is a coach-selected target interval displayed as elapsed time. Studies
show different 24-96 h trajectories by session, population, training familiarity, intervening
load, and outcome; the interval does not establish recovery, readiness, safety, or permission
for the next MAIN."`

`prohibited_claims = recovery_complete | ready | safe | injury_preventing | next_MAIN_cleared |
universal_minimum_interval`

The strongest direct youth-runner evidence is limited to biochemical changes after an all-out
21-km event. No study located here directly compares 72 h with another interval for adolescent
800/1500-m MAIN scheduling, and no study evaluates the full 9.5-day Formation architecture.
Therefore no canonical rule, default, or runtime authority follows from this file.

## Identity and Verification Notes

- The pre-existing seed DOI `10.1080/02640414.2023.2263522` returned HTTP 404 during DOI
  resolution on 2026-07-17. The verifiable resisted-versus-unresisted sprint paper is B15:
  PMID 37776346, DOI `10.1007/s00421-023-05317-x`. The unresolved DOI must not enter a source
  ledger as a verified identity.
- PubMed/Europe PMC supplied DOI/PMID/PMCID metadata. Retraction/correction, funding/conflict,
  duplicate cohort, and review-overlap audits are not complete. No absence of a visible flag is
  treated as proof that a source is uncorrected or independent.
- No canonical source, contract, schema, runtime, or product file was edited by this task.
