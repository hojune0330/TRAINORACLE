# Existing Formation Citation Audit

```yaml
audit_id: TO-FORMATION-EXISTING-CITATIONS-2026-07-17
audit_date: 2026-07-17
scope_files: 4
markdown_citation_occurrences: 75
unique_cited_urls: 57
unique_source_identities: 53
url_coverage: 57/57
occurrence_coverage: 75/75
unresolved_identity_count: 0
broken_or_wrong_identifier_count: 2
linked_corrections_count: 2
retractions_found: 0
authority: raw_research_evidence_only
canonical_files_edited: false
```

## Audit Rules

- Identity was normalized DOI -> PMID/PMCID where possible. A PMID is the proposed stable `source_id`; official guidance pages use a stable organization/document slug.
- `FT` means full-text state in this audit: `PMC` = PubMed Central full text; `WEB` = official full web page; `PUB` = publisher full text was available/open; `ABS` = abstract/bibliographic record only. `ABS` claims must not be upgraded to methods-, effect-, safety-, or risk-of-bias conclusions.
- `C/R` means linked correction/retraction state as of the audit: `none-linked` means no correction/retraction link was found in PubMed/Crossref/publisher metadata, not a perpetual guarantee.
- `F/COI` reports what was visible in PubMed/front matter. `NR` means not reported in the checked record, not “none.”
- Population cells use `event; age; sex; maturity; training status`. `NR` is retained rather than inferred.
- The 9.5-day Formation frame is the owner-fixed default automated-prescription identity;
  current runtime authority is `false`. None of these sources establishes scientific
  superiority, recovery guarantees, injury prevention, or medical safety. Product authority
  comes from the owner decision and named activation gates, not from overstating the literature.
- Canonical URLs are deterministic from the recorded identifiers: PMID `N` -> `https://pubmed.ncbi.nlm.nih.gov/N/`; PMCID `X` -> `https://pmc.ncbi.nlm.nih.gov/articles/X/`; DOI `D` -> `https://doi.org/D`. Non-identifier URLs are the cited HHS URL, `https://www.prisma-statement.org/prisma-2020-statement`, and `https://www.cochrane.org/authors/handbooks-and-manuals/handbook/current/chapter-14`.

## Defects Requiring Canonical Repair

1. `https://doi.org/10.1080/02640414.2023.2263522` does not resolve and is not registered in Crossref/PubMed. The label and summary identify Papanikolaou et al., *Recovery kinetics following sprint training: resisted versus unresisted sprints* (2024), PMID `37776346`, PMCID `PMC10879260`, DOI `10.1007/s00421-023-05317-x`. The current summary is substantively compatible with that intended paper, but the citation is invalid.
2. `https://doi.org/10.1111/sms.14231` resolves to Washino et al., *Projected frontal area and its components during front crawl depend on lung volume* (2022), PMID `36086887`, a swimming-biomechanics paper. The intended source is Hov et al., *Aerobic high-intensity intervals are superior to improve VO2max compared with sprint intervals in well-trained men* (2023), PMID `36314990`, PMCID `PMC10099854`, DOI `10.1111/sms.14251`. The current DOI has a one-digit error and provides zero support for the Formation summary.
3. CENT 2015 Statement, DOI `10.1136/bmj.h1738`, PMID `25976398`, has a production erratum: DOI `10.1136/bmj.i5381`. Use the corrected checklist.
4. The 2023 IOC REDs consensus, DOI `10.1136/bjsports-2023-106994`, PMID `37752011`, has a published correction: PMID `38325885`, DOI `10.1136/bjsports-2023-106994corr1`. Cite/read the corrected version.

## Source Extraction And Claim Audit

Verdicts: `CORRECT` = current summary matches the checked record with its stated limits; `QUALIFY` = direction is defensible but wording/directness needs tightening; `OVERSTATED` = summary exceeds the source; `INCORRECT_ID` = link resolves to the wrong paper; `GUIDANCE_OK` = appropriate non-empirical use.

| Proposed source_id | Citation, identifiers, type, FT, C/R | Population / event / directness | RQ | F/COI; overlap | Current summary audit and allowed claim |
|---|---|---|---|---|---|
| `SRC-PMID-37776346` | Papanikolaou et al. (2024), *Recovery kinetics following sprint training: resisted versus unresisted sprints*; DOI `10.1007/s00421-023-05317-x`; PMCID `PMC10879260`; acute primary; `PMC`; none-linked | acceleration sprint; adults; sex/age NR here; well-trained/familiarized; no maturity | B | NR/NR; recovery-primary cluster | `CORRECT_BUT_BAD_LINK`: 20% body-mass resisted sprints impaired selected sprint/EIMD measures through 72 h; not a universal interval or runner-youth rule. |
| `SRC-PMID-20386477` | Chatzinikolaou et al. (2010), *Time course of changes in performance and inflammatory responses after acute plyometric exercise*; DOI `10.1519/JSC.0b013e3181d1d318`; RCT; `ABS`; none-linked | intense plyometric bout; adults NR; sex NR; training NR | B,C | NR/NR; recovery-primary cluster | `CORRECT`: jump performance fell up to 72 h while strength did not; outcome-specific, unfamiliar-protocol transfer only. |
| `SRC-PMID-34296839` | Hoffman et al. (2021), *The acute effect of a multi-modal plyometric training session on field-specific performance measures*; DOI `10.23736/S0022-4707.20.11603-7`; acute primary; `ABS`; none-linked | combined plyometric/resistance; adult competitive Ultimate players; n=9; sex/maturity NR | B,C | NR/NR | `CORRECT`: selected jumps/sprint remained impaired at 48 h; small other-sport sample and unfamiliarity matter. |
| `SRC-PMID-35721873` | Laking et al. (2022), *Gait and Neuromuscular Changes Are Evident in Some Masters Club Level Runners 24-h After Interval Training Run*; DOI `10.3389/fspor.2022.830278`; PMCID `PMC9201250`; acute primary; `PMC`; none-linked | 6x800 m interval run; masters club runners; mixed sex; trained; no maturity | B | NR/NR; cited twice by DOI and PMID | `CORRECT`: most selected measures were near baseline at 24 h but some changes remained; never a complete-recovery guarantee. |
| `SRC-PMID-41048235` | Deprez et al. (2025), *Impact of post-match fatigue on peak force in elite youth soccer players...*; DOI `10.5114/biolsport.2025.150044`; PMCID `PMC12490303`; primary; `PMC`; none-linked | soccer match/MD+2; U19/U23; sex NR; elite youth; maturity unmeasured | B,F,G | no funding stated/no COI | `CORRECT`: IMTP peak force remained lower at 72 h, including a control-condition training effect; indirect to middle-distance running. |
| `SRC-PMID-23134196` | Ronnestad et al. (2014), *Effects of 12 weeks of block periodization...well-trained cyclists*; DOI `10.1111/sms.12016`; comparative primary; `ABS`; none-linked | cycling; adults; sex NR; well-trained | A | NR/NR; included in periodization reviews | `CORRECT`: small n=15 study favored BP on some indices; not 9.5-day running evidence. |
| `SRC-PMID-31802956` | Molmen et al. (2019), *Block periodization of endurance training - a systematic review and meta-analysis*; DOI `10.2147/OAJSM.S180408`; PMCID `PMC6802561`; SR/MA; `PMC`; none-linked | trained/well-trained endurance athletes; adult-dominant; mixed sports/sex; maturity NR | A | no funding/no COI; `OV-PERIODIZATION` | `CORRECT`: small favorable VO2max/Wmax effects with low-quality small studies; no 9/9.5/10-day superiority. |
| `SRC-PMID-35299664` | Almquist et al. (2022), *No Differences Between 12 Weeks of Block- vs. Traditional-Periodized Training...*; DOI `10.3389/fphys.2022.837634`; PMCID `PMC8921659`; primary; `PMC`; none-linked | cyclists; adults; sex NR; trained | A | NR/no COI; `OV-PERIODIZATION` | `CORRECT`: both improved and no time-trial/performance difference; counters universal BP superiority. |
| `SRC-PMID-27300278` | Sylta et al. (2016), *The Effect of Different High-Intensity Periodization Models on Endurance Adaptations*; DOI `10.1249/MSS.0000000000001007`; RCT; `ABS`; none-linked | 12-week cycling HIT; adults; sex NR; trained | A | non-US research support/NR; `OV-PERIODIZATION` | `CORRECT`: load-matched increasing/decreasing/mixed order showed no between-group adaptation difference. |
| `SRC-PMID-31024338` | Solli et al. (2019), *Block vs. Traditional Periodization of HIT...World's Best Cross-Country Skier*; DOI `10.3389/fphys.2019.00375`; PMCID `PMC6460991`; case; `PMC`; none-linked | cross-country skiing; one elite adult woman; world class | A | NR/NR; `OV-PERIODIZATION` | `CORRECT`: successful 7-11-day HIT blocks are descriptive n=1 history, not causal or youth-running evidence. |
| `SRC-PMID-23838975` | Ramirez-Campillo et al. (2014), *Effects of plyometric training...competitive middle- and long-distance runners*; DOI `10.1519/JSC.0b013e3182a1f44c`; RCT; `ABS`; none-linked | 6-week plyometric+endurance; competitive runners; mixed sex; age/maturity NR | C | NR/NR; likely included in runner-strength reviews | `CORRECT`: 2.4 km, sprint and jump outcomes improved; supports component inclusion, not Formation timing. |
| `SRC-PMID-17149987` | Saunders et al. (2006), *Short-term plyometric training improves running economy...*; DOI `10.1519/R-18235.1`; RCT; `ABS`; none-linked | 9-week plyometric; highly trained distance runners; sex NR; adult/maturity NR | C | non-US support/NR; `OV-RUNNER-STRENGTH` | `CORRECT`: economy improved only at 18 km/h; no VO2max change; not microcycle evidence. |
| `SRC-PMID-34767655` | Trowell et al. (2022), *Effect of concurrent strength and endurance training on run performance and biomechanics*; DOI `10.1111/sms.14092`; RCT; `ABS`; none-linked | 10-week CSE; adults mean 33-34; mixed sex NR; moderately trained runners, strength-naive | C | Deakin/AIS/NR | `CORRECT`: 2 km performance improved; biomechanics mostly unchanged; not youth or same-day ordering evidence. |
| `SRC-PMID-41312139` | Wang et al. (2025), *Effect of complex training...adolescent distance runners*; DOI `10.3389/fphys.2025.1718150`; PMCID `PMC12646903`; primary; `PMC`; none-linked | 8-week complex vs resistance; male; 16.75+/-0.68 y; adolescent runners; maturity unmeasured | C,F,G | no stated funding/no COI | `CORRECT`: running economy/power outcomes favored complex training; male-only, no safety or 9.5-day inference. |
| `SRC-PMID-38627351` | Llanos-Lagos et al. (2024), *Effect of Strength Training Methods...Runners: SR/MA*; DOI `10.1007/s40279-024-02018-z`; PMCID `PMC11258194`; `PMC`; none-linked | middle/long-distance runners; mixed sex/ages/status; 6-40 weeks; maturity mostly NR | C | no funding/no COI; `OV-RUNNER-STRENGTH` | `CORRECT`: high-load/combined methods improved performance with very-low-to-moderate certainty; no Formation placement rule. |
| `SRC-PMID-37435592` | Kim et al. (2023), *Effects of...interval training on the 800-m records of adolescent...runners*; DOI `10.12965/jer.2346212.106`; PMCID `PMC10331139`; primary; `PMC`; none-linked | 10-week HIIT vs MIIT plus weights; 20 high-school males; adolescent; maturity NR | C,F,G | no funding/no COI | `QUALIFY`: HIIT group improved 800 m/selected markers more; small male sample and biomarker changes do not establish recovery or safety. |
| `SRC-PMID-36086887` | Washino et al. (2022), *Projected frontal area...front crawl...lung volume*; DOI `10.1111/sms.14231`; primary; `ABS`; none-linked | 15 m front crawl; 12 highly trained adult male swimmers | none | Japan research support noted on publisher/NR | `INCORRECT_ID`: irrelevant to running HIIT. Intended source is PMID `36314990`, DOI `10.1111/sms.14251`. |
| `SRC-PMID-40596578` | Yang et al. (2025), *Effects of uphill training on maximal velocity and performance of middle-distance runners*; DOI `10.1038/s41598-025-08275-w`; PMCID `PMC12214983`; RCT; `PMC`; none-linked | uphill running, 8 weeks; middle-distance runners; age/sex/status as full text; maturity NR | C | full-text disclosure required; no overlap assigned | `QUALIFY`: supports uphill-training performance adaptations in its sample; does not isolate neural-fatigue resistance or a Formation slot. |
| `SRC-PMID-40016936` | Trowell et al. (2025), *Strength Training Improves Running Economy Durability and Fatigued High-Intensity Performance...*; DOI `10.1249/MSS.0000000000003685`; RCT; `ABS`; none-linked | strength+running; well-trained adult male runners | C | NR/NR; `OV-RUNNER-STRENGTH` | `CORRECT`: supports selected fatigued-state/economy outcomes, not a validated “neural fatigue” measure. |
| `SRC-PMID-12741870` | White et al. (2003), *Effectiveness of cycle cross-training between competitive seasons in female distance runners*; DOI `10.1519/1533-4287(2003)017<0319:EOCCBC>2.0.CO;2`; primary; `ABS`; none-linked | 5-week 50% cycling substitution; 11 collegiate women; competitive runners | C | NR/NR; cross-training cluster | `CORRECT`: estimated VO2max maintained but 3000 m slowed more in cross-training group; small off-season sample. |
| `SRC-PMID-7649149` | Tanaka et al. (1995), *Effects of specific versus cross-training on running performance*; DOI `10.1007/BF00865035`; RCT; `ABS`; none-linked | running/cycling/swimming specificity; adults; sex/training NR here | C | non-US support/NR; cross-training cluster | `CORRECT`: aerobic transfer exists but mode-specific adaptation is greater; no recovery-equivalence claim. |
| `SRC-PMID-34062089` | Luden et al. (2021), *Lower volume throughout the taper and higher intensity...1500 m*; DOI `10.1139/apnm-2021-0103`; crossover; `ABS`; none-linked | two 7-day tapers; 8 highly trained 1500 m runners; sex/age NR | A,C | NR/NR | `CORRECT`: supports lower volume plus retained/increased intensity in this tiny crossover; not a 9.5-day taper rule. |
| `SRC-PMID-29163016` | Haddad et al. (2017), *Session-RPE Method for Training Load Monitoring...*; DOI `10.3389/fnins.2017.00612`; PMCID `PMC5673663`; review; `PMC`; none-linked | athletes across sports/ages/sex/status | D | NR/NR; cited by PMID and DOI under two labels | `CORRECT`: supports named sRPE protocol/limitations; it does not make arbitrary load methods interchangeable or a fatigue score. |
| `SRC-PMID-30160557` | Mann et al. (2019), *Validation of sRPE...Adolescent Distance Runners*; DOI `10.1123/ijspp.2018-0120`; observational validation; `ABS`; none-linked | 2-week mesocycle; 15 adolescents 15.2+/-1.6 y; mixed sex; distance runners; maturity unmeasured | D,F | NR/NR | `CORRECT`: timing materially changed values; protocol/timestamp must remain visible. |
| `SRC-PMID-28463642` | Bourdon et al. (2017), *Monitoring Athlete Training Loads: Consensus Statement*; DOI `10.1123/IJSPP.2017-0208`; consensus; `ABS`; none-linked | athlete monitoring, multi-sport; not a participant study | D | author disclosures require full text; cited by DOI and PMID | `CORRECT`: internal/external load separation and multifactorial monitoring are supported; no readiness/safety authority. |
| `SRC-PMID-10907753` | Hopkins (2000), *Measures of reliability in sports medicine and science*; DOI `10.2165/00007256-200030010-00001`; methods; `ABS`; comment linked PMID `11103850`, no correction/retraction | general measurement; no intervention population | D,E | NR/NR; `OV-MEASUREMENT` | `CORRECT`: supports typical error/within-subject reliability and cautions against treating correlation as agreement. |
| `SRC-WEB-HHS-HIPAA-DEID` | HHS OCR, *Guidance Regarding Methods for De-identification...HIPAA Privacy Rule*; official guidance; `WEB`; current page; C/R N/A | US HIPAA covered-entity context; not sport science | D,G | US government/N/A | `GUIDANCE_OK`: supports Expert Determination/Safe Harbor and residual re-identification risk; it is not a universal global privacy rule. |
| `SRC-PMID-32502973` | Impellizzeri et al. (2020), *Acute:Chronic Workload Ratio: Conceptual Issues and Fundamental Pitfalls*; DOI `10.1123/ijspp.2019-0864`; methodological critique; `ABS`; none-linked | conceptual/methods; no intervention population | D | NR/NR; ACWR pair | `CORRECT`: supports prohibition on causal injury-prevention/readiness use of ACWR. |
| `SRC-PMID-34052983` | Dijkhuis et al. (2021), *Association Between ACWR and Running-Related Injuries in Dutch Runners*; DOI `10.1007/s40279-021-01483-0`; prospective cohort; `ABS`; none-linked | Dutch recreational runners; adults; mixed sex; maturity N/A | D,G | NR/NR; ACWR pair | `CORRECT`: an observational association study cannot validate a universal safe zone or causal threshold. |
| `SRC-PMID-35418513` | Casado et al. (2022), *Training Periodization, Methods, Intensity Distribution, and Volume...Distance Runners: SR*; DOI `10.1123/ijspp.2021-0435`; SR; `ABS`; none-linked | highly trained/elite distance runners; adult-dominant; mixed events/sex | A | NR/NR; `OV-TID` | `CORRECT`: describes elite practice and hard/easy structures; does not compare adolescent 7 vs 9.5 vs 10 days. |
| `SRC-PMID-34749417` | Campos et al. (2022), *Training-intensity Distribution on Middle- and Long-distance Runners: SR*; DOI `10.1055/a-1559-3623`; SR; `ABS`; none-linked | middle/long-distance runners; varied levels/sex/ages; maturity NR | A | NR/NR; `OV-TID` | `CORRECT`: classification method changes apparent TID; no exact session-spacing conclusion. |
| `SRC-PMID-39888556` | Rosenblat et al. (2025), *Which Training Intensity Distribution Intervention...IPD network MA*; DOI `10.1007/s40279-024-02149-3`; SR/NMA; `ABS`; none-linked | endurance athletes; adults; mixed sports/sex/status | A | full-text disclosures required; `OV-TID` | `CORRECT`: comparative average TID effects do not select a 9.5-day calendar or recovery interval. |
| `SRC-PMID-37285051` | Lloria-Varella et al. (2023), *Neuromuscular and autonomic function is fully recovered within 24 h following SIT*; DOI `10.1007/s00421-023-05249-6`; acute primary; `ABS`; none-linked | cycle SIT; healthy adults; sex/training details require full text; not runners | B | NR/NR; recovery-primary cluster | `QUALIFY`: selected measured functions recovered by 24 h; title/result cannot be generalized to whole-person recovery. |
| `SRC-PMID-31820260` | Hader et al. (2019), *Monitoring the Athlete Match Response...soccer: SR/MA*; DOI `10.1186/s40798-019-0219-7`; PMCID `PMC6901634`; review/MA; `PMC`; none-linked | soccer matches; 165 athletes in 11 studies; adult/youth mix; mostly male | B,D | full-text funding/COI; recovery-review cluster | `CORRECT`: external load alone poorly predicts all residual-fatigue outcomes; indirect to running and not a universal 72 h rule. |
| `SRC-PMID-30131714` | Gabler et al. (2018), *Concurrent Strength and Endurance Training...Youth: SR/MA*; DOI `10.3389/fphys.2018.01057`; PMCID `PMC6090054`; `PMC`; none-linked | healthy youth 6-18; mixed sex/sports/status; maturity variably reported | C,F,G | full-text disclosures; `OV-CONCURRENT` | `CORRECT`: concurrent training was not universally harmful; heterogeneity blocks exact Formation sequencing. |
| `SRC-PMID-33751469` | Petre et al. (2021), *Development of Maximal Dynamic Strength During Concurrent...Training: SR/MA*; DOI `10.1007/s40279-021-01426-9`; PMCID `PMC8053170`; `PMC`; none-linked | adults; untrained/moderately trained/trained; mixed sex; maturity N/A | C | full-text disclosures; `OV-CONCURRENT` | `CORRECT`: same-session interference for some lower-body strength contexts is conditional on training status and design. |
| `SRC-PMID-32407361` | Eddens et al. (2020), *Order of same-day concurrent training influences some indices of power...*; DOI `10.1371/journal.pone.0233134`; PMCID `PMC7224562`; clinical trial; `PMC`; none-linked | 9 weeks; healthy moderately active adult men; ~3 h separation | C | non-US support/disclosures in full text; `OV-CONCURRENT` | `CORRECT`: order affected some power indices, not strength/lean mass/aerobic fitness; no universal ordering rule. |
| `SRC-PMID-36370207` | Hung et al. (2022), *Heavy Resistance vs Plyometric Training for Running Economy...SR/MA*; DOI `10.1186/s40798-022-00511-1`; PMCID `PMC9653533`; `PMC`; none-linked | runners; adults; mixed sex/status; maturity NR | C | full-text disclosures; `OV-RUNNER-STRENGTH` | `CORRECT`: compares component methods; no Formation interval evidence. |
| `SRC-PMID-32991706` | Saw et al. (2020), *Single-Item Self-Report Measures of Team-Sport Athlete Wellbeing...SR*; DOI `10.4085/1062-6050-0528.19`; PMCID `PMC7534939`; `PMC`; none-linked | team-sport athletes; mainly adult/elite; mixed sex; not distance runners | D | full-text disclosures; wellbeing-measure cluster | `CORRECT`: inconsistent load relationships and weak measurement-property evidence prohibit a single fatigue score. |
| `SRC-PMID-38662890` | Weakley et al. (2024), *Statistical Tests...Identifying Performance Gains in Individual Athletes*; DOI `10.1519/JSC.0000000000004727`; methods; `ABS`; none-linked | practitioner methods; no intervention population | E | NR/NR; `OV-MEASUREMENT` | `CORRECT`: distinguishes CV/SEM/SWC and individual change; supplies no universal minimum n. |
| `SRC-PMID-28054257` | Robertson et al. (2017), *Consensus on measurement properties...performance tests: Delphi*; DOI `10.1186/s40798-016-0071-y`; PMCID `PMC5215201`; Delphi consensus; `PMC`; none-linked | expert panel; no athlete intervention population | E | full-text disclosures; `OV-MEASUREMENT` | `CORRECT`: reliability, validity, responsiveness and feasibility are separate; not a readiness threshold. |
| `SRC-PMID-29712629` | Welk et al. (2018), *Recommendations for Assessment...Wearable Sensors...*; DOI `10.2196/mhealth.9341`; PMCID `PMC5952119`; methods guidance; `PMC`; none-linked | device validation; general physical activity populations | D,E | full-text funding/COI required; `OV-MEASUREMENT` | `CORRECT`: device error/validity must precede change interpretation; device-specific transfer required. |
| `SRC-PMID-25976398` | Vohra et al. (2015), *CENT 2015 Statement*; DOI `10.1136/bmj.h1738`; reporting guideline; `PUB`; **erratum DOI `10.1136/bmj.i5381`** | N-of-1 clinical trial reporting; no athlete population | E,F | guideline funding/disclosures; companion to h1793 | `GUIDANCE_OK_WITH_CORRECTION`: useful reporting structure; not proof that ABAB/crossover is valid for cumulative training adaptations. |
| `SRC-DOI-10.1136-BMJ.H1793` | Shamseer et al. (2015), *CENT 2015: Explanation and elaboration*; DOI `10.1136/bmj.h1793`; reporting guidance; `PUB`; none-linked | N-of-1 clinical methods; no athlete population | E,F | guideline disclosures; companion, not independent evidence | `GUIDANCE_OK`: supports preregistered periods/order/change/attrition reporting; carryover and irreversibility remain design constraints. |
| `SRC-PMID-26084524` | Bergeron et al. (2015), *IOC consensus statement on youth athletic development*; DOI `10.1136/bjsports-2015-094962`; consensus; `ABS`; none-linked | youth athletes broadly; both sexes; growth/maturation central; multi-sport | C,F,G | IOC/author disclosures require full text; `OV-YOUTH-CONSENSUS` | `CORRECT`: supports nonlinear development, health and sustainable participation boundaries; no Formation efficacy. |
| `SRC-PMID-39197945` | Mountjoy et al. (2024), *IOC consensus statement on elite youth athletes...*; DOI `10.1136/bjsports-2024-108186`; consensus; `ABS`; none-linked | elite youth/Olympic pathway; both sexes; maturation and development; multi-sport | F,G | IOC/author disclosures; cited by PMID and BJSM URL | `CORRECT`: supports athlete-centred safeguards and asynchronous development; no automatic prescription authority. |
| `SRC-WEB-PRISMA-2020` | PRISMA Executive (2020/2021), *PRISMA 2020 statement* official page; underlying BMJ DOI `10.1136/bmj.n71`; reporting guideline; `WEB`; current | systematic-review reporting; no athlete population | F | guideline/N/A | `GUIDANCE_OK`: appropriate for transparent search/exclusion reporting; does not itself appraise sports evidence. |
| `SRC-PMID-37752011` | Mountjoy et al. (2023), *IOC consensus statement on Relative Energy Deficiency in Sport (REDs)*; DOI `10.1136/bjsports-2023-106994`; consensus; `PUB`; **correction PMID `38325885`** | athletes across sports, sexes and ages; clinical/multidisciplinary; maturity relevant | G | IOC/author disclosures; `OV-YOUTH-CONSENSUS` | `CORRECT_WITH_CORRECTION`: supports separate clinical expert boundary for energy availability/health; product must not diagnose REDs. |
| `SRC-PMID-33122252` | Krabak et al. (2021), *Youth running consensus statement...*; DOI `10.1136/bjsports-2020-102518`; consensus; `PUB`; none-linked | youth runners; children/adolescents; both sexes; growth/maturation; varied status | F,G | author disclosures/full text; `OV-YOUTH-CONSENSUS` | `CORRECT`: explicitly notes evidence gaps and opinion-based distance guidance; supports protection, not causal thresholds. |
| `SRC-PMID-34250468` | Tenforde et al. (2021), *Injuries and Training Practices in Competitive Adolescent Distance Runners*; DOI `10.3389/fspor.2021.664632`; PMCID `PMC8264289`; retrospective cross-sectional; `PMC`; none-linked | adolescent competitive distance runners; mixed sex; maturity NR | F,G | full-text funding/COI; youth-running cluster | `CORRECT`: injury frequency/practice description only; cannot generate safe-load or causal injury thresholds. |
| `SRC-PMID-34021488` | Sandford et al. (2021), *Crossing the Golden Training Divide...800- and 1500-m Runners*; DOI `10.1007/s40279-021-01481-2`; PMCID `PMC8363530`; narrative review/position; `PMC`; none-linked | world-class 800/1500 m; adult elite; both sexes; maturity N/A | A,F,G | full-text disclosures; event-specific narrative | `CORRECT`: supports separating 800 and 1500 demands; not direct evidence for adolescent 9.5-day safety/efficacy. |
| `SRC-PMID-40566441` | MacKenzie et al. (2025), *6-Week Training Intervention on Reactive Strength: SCED*; DOI `10.3390/jfmk10020191`; PMCID `PMC12194246`; single-case experimental application; `PMC`; none-linked | reactive-strength intervention; small multiple-baseline athlete cases; ages/sex/status per full text | E,F | full-text disclosures; single-case-method cluster | `CORRECT`: demonstrates a sport SCED application and its generalization limits; not evidence for Formation efficacy. |
| `SRC-WEB-COCHRANE-HB-CH14` | Cochrane Handbook, ch. 14, *Summary of findings and grading certainty*; methods guidance; `WEB`; current | systematic-review methods; no athlete population | all | Cochrane/N/A | `GUIDANCE_OK`: GRADE domains are appropriate scaffolding; population/intervention directness for adolescent middle-distance runners must be added explicitly. |

## Duplicate Identity And Review Overlap

- Exact identity duplicates: PMID `35721873` is cited once by DOI and elsewhere by PMID; PMID `28463642` is cited by DOI and PMID; PMID `39197945` is cited by PMID and BJSM URL. These are one source each.
- Companion rather than independent evidence: CENT Statement (`h1738`) and Explanation (`h1793`). Do not count them as two empirical validations.
- `OV-PERIODIZATION`: Molmen 2019 synthesizes small endurance BP studies and overlaps the Ronnestad 2014 primary evidence; Solli 2019 is an n=1 case, while Almquist 2022 is later counterevidence. Do not sum them as independent confirmation of BP superiority.
- `OV-TID`: Casado 2022 and Campos 2022 overlap elite/middle-distance observational literature and classification questions. Rosenblat 2025 synthesizes intervention IPD and is a different question, but it still cannot identify a 9.5-day frame.
- `OV-RUNNER-STRENGTH`: Llanos-Lagos 2024 and Hung 2022 overlap runner strength/plyometric trials and likely include older primaries such as Saunders 2006 and Ramirez-Campillo 2014. Do not count review results plus included trials as independent bodies.
- `OV-CONCURRENT`: Gabler 2018 (youth) and Petre 2021 (adult/training-status) overlap the concurrent-training construct but differ in population. Eddens 2020 is a primary ordering study.
- `OV-MEASUREMENT`: Hopkins 2000, Robertson 2017, Welk 2018 and Weakley 2024 overlap reliability/change-detection concepts; they address different levels (general reliability, test properties, wearables, practitioner decisions).
- Youth consensus overlap: IOC youth development 2015, IOC elite youth 2024, youth running 2021 and REDs 2023 share safeguarding themes but are not independent efficacy studies.
- Recovery evidence is outcome-specific. Papanikolaou, Chatzinikolaou, Hoffman, Laking and Lloria-Varella use different exercise modes and endpoints; the soccer review/primary studies are indirect. No pooled “72 h recovered” conclusion is valid.

## 75/75 Occurrence Coverage Ledger

The table groups identical URLs; `n` sums to 75. `R` = sports-science review, `C` = load/statistics contract, `D` = deep-research draft, `M` = source-map draft.

| URL key | n | Occurrences |
|---|---:|---|
| DOI `10.1080/02640414.2023.2263522` | 1 | R:53 |
| PMID `20386477` | 2 | R:54; M:75 |
| PMID `34296839` | 2 | R:55; M:76 |
| DOI `10.3389/fspor.2022.830278` | 1 | R:56 |
| PMID `41048235` | 1 | R:57 |
| DOI `10.1111/sms.12016` | 1 | R:66 |
| PMID `31802956` | 3 | R:67; D:52; M:56 |
| DOI `10.3389/fphys.2022.837634` | 1 | R:68 |
| DOI `10.1249/MSS.0000000000001007` | 1 | R:69 |
| PMID `31024338` | 1 | R:70 |
| PMID `23838975` | 1 | R:79 |
| PMID `17149987` | 1 | R:81 |
| PMID `34767655` | 1 | R:83 |
| PMID `41312139` | 1 | R:85 |
| PMID `38627351` | 1 | R:87 |
| PMID `37435592` | 1 | R:96 |
| DOI `10.1111/sms.14231` | 1 | R:98 |
| PMCID `PMC12214983` | 1 | R:106 |
| DOI `10.1249/MSS.0000000000003685` | 1 | R:112 |
| DOI `10.1519/1533-4287(2003)017<0319:EOCCBC>2.0.CO;2` | 1 | R:119 |
| DOI `10.1007/BF00865035` | 1 | R:121 |
| PMID `34062089` | 1 | R:129 |
| PMID `29163016` | 2 | C:137; M:109 |
| DOI `10.1123/ijspp.2018-0120` | 1 | C:138 |
| DOI `10.1123/IJSPP.2017-0208` | 1 | C:150 |
| DOI `10.3389/fnins.2017.00612` | 1 | C:151 |
| DOI `10.2165/00007256-200030010-00001` | 1 | C:238 |
| HHS de-identification URL | 1 | C:264 |
| PMID `32502973` | 2 | C:281; M:110 |
| PMID `34052983` | 1 | C:283 |
| PMID `35418513` | 2 | D:50; M:53 |
| PMID `34749417` | 2 | D:50; M:54 |
| PMID `37285051` | 2 | D:51; M:73 |
| PMID `35721873` | 2 | D:51; M:74 |
| PMID `33751469` | 2 | D:53; M:93 |
| PMID `30131714` | 2 | D:53; M:92 |
| PMID `28463642` | 2 | D:54; M:108 |
| BMJ `h1738` | 2 | D:55; M:131 |
| PMID `38662890` | 2 | D:55; M:128 |
| PMID `26084524` | 3 | D:56; M:96; M:150 |
| PMID `39197945` | 2 | D:56; M:151 |
| PMID `39888556` | 1 | M:55 |
| PMID `31820260` | 1 | M:77 |
| PMID `32407361` | 1 | M:94 |
| PMID `36370207` | 1 | M:95 |
| PMID `32991706` | 1 | M:111 |
| PMCID `PMC5215201` | 1 | M:129 |
| PMCID `PMC5952119` | 1 | M:130 |
| BMJ `h1793` | 1 | M:152 |
| PRISMA 2020 official page | 1 | M:153 |
| BJSM `58/17/946` | 1 | M:172 |
| BJSM `57/17/1073` | 1 | M:173 |
| BJSM `55/6/305` | 1 | M:174 |
| PMID `34250468` | 1 | M:175 |
| PMID `34021488` | 1 | M:176 |
| PMID `40566441` | 1 | M:177 |
| Cochrane Handbook ch. 14 | 1 | M:206 |
| **Total** | **75** | **75/75 covered** |

## Transfer-Safe Bottom Line

- No existing citation directly compares a 9.5-day Formation microcycle with 7-, 9-, 10-, or 14-day alternatives in adolescent 800/1500 m runners.
- No existing citation validates a fixed 72 h recovery guarantee. The directly checked studies show endpoint-, exercise-, familiarity-, age-, and athlete-specific time courses.
- Component evidence supports considering strength, plyometric, HIIT, taper, and cross-training elements, but it does not validate their exact Formation order, frequency, dose, or safety.
- Load and statistical sources support transparent descriptive measures, provenance, measurement error, missingness and within-athlete context. They do not authorize `total_fatigue`, `recovery_complete`, `safe_load`, injury prediction, peer ranking, or automatic plan changes.
- Youth sources justify stronger human-review, growth/maturity, sex, REDs, injury/illness and safeguarding boundaries. They do not make adult/elite evidence directly transferable.
- The owner has fixed 9.5-day Formation as TRAINORACLE's default automated-prescription
  identity. Current runtime authority remains `false` until the named research, safety,
  privacy, and owner gates pass. Scientific superiority, complete recovery, and medical
  safety remain `UNKNOWN` or prohibited claims; those scientific limits do not reopen the
  product-identity decision.
