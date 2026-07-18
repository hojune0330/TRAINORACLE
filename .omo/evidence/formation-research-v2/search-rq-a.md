# RQ-A Source Search And Metadata Audit

```yaml
research_question: RQ-A_FRAME_AND_EXPOSURE_DENSITY
search_date: 2026-07-17
owner_target_authority: 9_5_DAY_AUTOMATED_PRESCRIPTION
adoption_vote: OUT_OF_SCOPE
runtime_authority: false
review_type: PRISMA_INFORMED_SOURCE_SEARCH_NOT_SYSTEMATIC_REVIEW
direct_7_vs_9_9_5_10_day_efficacy_evidence: NOT_FOUND
actual_9_day_coaching_use: FOUND_NAMED_CASES
actual_9_5_day_coaching_use: NOT_FOUND
actual_10_day_coaching_use: FOUND_NAMED_CASES_AND_REPORTED_PROGRAMS
prevalence_evidence_for_common_use: NOT_FOUND
scientific_superiority_or_safety_claim: PROHIBITED
```

## 1. Scope And Decision Boundary

This lane asks what evidence exists for limitations of a fixed seven-day training week,
direct comparisons with nonweekly frames, and documented use of 9-, 9.5-, or 10-day
cycles. It does **not** vote on TRAINORACLE's already fixed 9.5-day automated-prescription
identity. Peer-reviewed efficacy/methodology evidence is separated from coaching books,
interviews, articles, presentations, and plan pages.

Classification used below:

- `FIXED_WEEK_LIMITATION`: evidence or practice report relevant to constraints or assumptions
  of fixed-time/fixed-week planning.
- `ACTUAL_9_DAY_USE` / `ACTUAL_10_DAY_USE`: named athlete/coach self-report or a directly
  described case. A third-party report is marked `REPORTED_USE`, not promoted to a verified
  participant self-report.
- `PLAN_ONLY_9_DAY` / `PLAN_ONLY_10_DAY`: a verifiable offered template, not evidence that it
  was used or effective.
- `NEITHER`: relevant adjacent evidence that does not establish a frame claim.

No source in this file establishes that 9, 9.5, or 10 days is optimal, safer, injury
preventing, or a recovery-complete interval.

## 2. Exact Search Log

### 2.1 PubMed/MEDLINE via NCBI ESearch

All four searches were run on 2026-07-17 with `retmax=200`, relevance sorting, and no date
or language filter. Counts are the NCBI counts observed that day. Every title/metadata record
was reviewed; abstracts/full text were opened for potentially eligible or contradiction-changing
records.

| ID | Exact query | Results | Reviewed | Result set |
|---|---|---:|---:|---|
| P1 | `(("middle distance"[Title/Abstract] OR "middle-distance"[Title/Abstract] OR "distance runner"[Title/Abstract] OR "distance runners"[Title/Abstract] OR "long-distance runner"[Title/Abstract] OR "long-distance runners"[Title/Abstract]) AND (microcycle*[Title/Abstract] OR periodization[Title/Abstract] OR periodisation[Title/Abstract] OR "training week"[Title/Abstract] OR "training cycle"[Title/Abstract]))` | 27 | 27 | [PubMed](https://pubmed.ncbi.nlm.nih.gov/?term=((%22middle%20distance%22%5BTitle%2FAbstract%5D%20OR%20%22middle-distance%22%5BTitle%2FAbstract%5D%20OR%20%22distance%20runner%22%5BTitle%2FAbstract%5D%20OR%20%22distance%20runners%22%5BTitle%2FAbstract%5D%20OR%20%22long-distance%20runner%22%5BTitle%2FAbstract%5D%20OR%20%22long-distance%20runners%22%5BTitle%2FAbstract%5D)%20AND%20(microcycle*%5BTitle%2FAbstract%5D%20OR%20periodization%5BTitle%2FAbstract%5D%20OR%20periodisation%5BTitle%2FAbstract%5D%20OR%20%22training%20week%22%5BTitle%2FAbstract%5D%20OR%20%22training%20cycle%22%5BTitle%2FAbstract%5D)) |
| P2 | `((runner*[Title/Abstract] OR running[Title/Abstract]) AND ("9-day"[Title/Abstract] OR "9 day"[Title/Abstract] OR "9.5-day"[Title/Abstract] OR "9.5 day"[Title/Abstract] OR "10-day"[Title/Abstract] OR "10 day"[Title/Abstract] OR nonweekly[Title/Abstract] OR "non-weekly"[Title/Abstract]) AND (training[Title/Abstract] OR microcycle*[Title/Abstract]))` | 40 | 40 | [PubMed](https://pubmed.ncbi.nlm.nih.gov/?term=((runner*%5BTitle%2FAbstract%5D%20OR%20running%5BTitle%2FAbstract%5D)%20AND%20(%229-day%22%5BTitle%2FAbstract%5D%20OR%20%229%20day%22%5BTitle%2FAbstract%5D%20OR%20%229.5-day%22%5BTitle%2FAbstract%5D%20OR%20%229.5%20day%22%5BTitle%2FAbstract%5D%20OR%20%2210-day%22%5BTitle%2FAbstract%5D%20OR%20%2210%20day%22%5BTitle%2FAbstract%5D%20OR%20nonweekly%5BTitle%2FAbstract%5D%20OR%20%22non-weekly%22%5BTitle%2FAbstract%5D)%20AND%20(training%5BTitle%2FAbstract%5D%20OR%20microcycle*%5BTitle%2FAbstract%5D)) |
| P3 | `((runner*[Title/Abstract] OR running[Title/Abstract]) AND ("7-day"[Title/Abstract] OR "seven-day"[Title/Abstract] OR weekly[Title/Abstract]) AND (microcycle*[Title/Abstract] OR periodization[Title/Abstract] OR periodisation[Title/Abstract] OR "training cycle"[Title/Abstract]))` | 61 | 61 | [PubMed](https://pubmed.ncbi.nlm.nih.gov/?term=((runner*%5BTitle%2FAbstract%5D%20OR%20running%5BTitle%2FAbstract%5D)%20AND%20(%227-day%22%5BTitle%2FAbstract%5D%20OR%20%22seven-day%22%5BTitle%2FAbstract%5D%20OR%20weekly%5BTitle%2FAbstract%5D)%20AND%20(microcycle*%5BTitle%2FAbstract%5D%20OR%20periodization%5BTitle%2FAbstract%5D%20OR%20periodisation%5BTitle%2FAbstract%5D%20OR%20%22training%20cycle%22%5BTitle%2FAbstract%5D)) |
| P4 | `((middle-distance[Title/Abstract] OR "middle distance"[Title/Abstract] OR long-distance[Title/Abstract] OR "long distance"[Title/Abstract]) AND runner*[Title/Abstract] AND ("training intensity distribution"[Title/Abstract] OR periodization[Title/Abstract] OR periodisation[Title/Abstract]))` | 14 | 14 | [PubMed](https://pubmed.ncbi.nlm.nih.gov/?term=((middle-distance%5BTitle%2FAbstract%5D%20OR%20%22middle%20distance%22%5BTitle%2FAbstract%5D%20OR%20long-distance%5BTitle%2FAbstract%5D%20OR%20%22long%20distance%22%5BTitle%2FAbstract%5D)%20AND%20runner*%5BTitle%2FAbstract%5D%20AND%20(%22training%20intensity%20distribution%22%5BTitle%2FAbstract%5D%20OR%20periodization%5BTitle%2FAbstract%5D%20OR%20periodisation%5BTitle%2FAbstract%5D)) |

Screening result: P2 returned overload studies, training camps, tapers, animal work, and
non-running records whose intervention happened to last 9 or 10 days. It returned no eligible
recurring 9-, 9.5-, or 10-day running microcycle comparison. The exact 9/9.5-day overload
false positive is retained as source A10 so it cannot later be misrepresented.

### 2.2 Ranked Web Search For Coaching Use

Search-engine totals are unstable and were not reported by the tool. The audit therefore records
the exact strings and the ranked cards actually reviewed, rather than claiming a database count.

| Batch | Exact queries | Results reviewed | Retained use |
|---|---|---|---|
| W1 | `"9-day training cycle" runner coach`; `"10-day training cycle" runner coach`; `"9 day cycle" marathon training coach`; `"10 day cycle" marathon training coach` | 30 returned cards inspected; official/full pages opened for candidates | Meb, Michael Ko, Lovett/Hunt, Gaudette, Burdick |
| W2 | `"9.5-day" training cycle running`; `"9.5 day" training cycle runner`; `"9.5-day cycle" coach`; `"9.5 day cycle" athletics` | 20 returned cards inspected | No coaching use; one irrelevant 9-9.5-day overload experiment retained as A10 |
| W3 | `Emma Bates 9 day training cycle interview coach Joe Bosshard 2023`; `Meb Keflezighi 9 day training cycle 2014 coach Bob Larsen interview`; `Paula Radcliffe 8 day training cycle source interview`; `Sebastian Sawe 10-day training cycle coach Claudio Berardelli interview` | Top returned page for each query inspected; named claims followed to available interview/article pages | Meb direct interview retained; Emma's direct interview verifies 10 days and contradicts a linked 9-day overview; 8-day use is out of target |
| W4 | `site:outsideonline.com "10-day cycle" running coach`; `site:trainingpeaks.com "10-day cycle" running`; `site:run.outsideonline.com "10-day cycle" marathon`; `site:ustfccca.org "10-day cycle" distance running` | All returned cards inspected | Outside, TrainingPeaks, and USTFCCCA sources retained |
| W5 | `Bowerman and the Men of Oregon 9-day cycle Kenny Moore Google Books`; `"Bowerman and the Men of Oregon" "9-day"`; `"9-day cycle" "Kenny Moore"`; `site:books.google.com running "9-day cycle"` | All returned cards inspected | Official book metadata found, but the preview did not expose the alleged 9-day passage; not used as cycle evidence |

Access limitation: this lane had no authenticated SPORTDiscus, Scopus, Web of Science, or
Cochrane search interface. Their unavailability is not concealed. Reviews that searched some of
those databases are evidence sources, not substitutes for a fresh database search.

## 3. Highest-Value Peer-Reviewed Evidence

### A1. [Training Periodization, Methods, Intensity Distribution, and Volume in Highly Trained and Elite Distance Runners: A Systematic Review](https://pubmed.ncbi.nlm.nih.gov/35418513/)

- **Year/type/IDs:** 2022; systematic review; DOI `10.1123/ijspp.2021-0435`; PMID `35418513`.
- **Full-text state:** `ABSTRACT_ONLY`.
- **Population/event:** highly trained and elite middle- and long-distance runners; event-specific
  synthesis including 1500 m through marathon.
- **Protocol/outcome:** 10 included articles; synthesized training intensity distribution (TID),
  volume, methods, and periodization. The abstract describes traditional periodization on a
  hard-day/easy-day basis and different TID emphases by event/season.
- **Limitations:** only 10 articles, no direct seven-day versus nonweekly comparison, no exact
  9/9.5/10-day frame, no adolescent-specific conclusion, and abstract-only details cannot support
  effect magnitude or a detailed prescription.
- **RQ-A classification:** `FIXED_WEEK_LIMITATION=INDIRECT`; `9/9.5/10_USE=NEITHER`.
- **Product implication:** hard/easy ordering is a defensible candidate-generation constraint;
  it does not determine a 9.5-day duration, exact MAIN count, safety, or clearance.

### A2. [Training-intensity Distribution on Middle- and Long-distance Runners: A Systematic Review](https://pubmed.ncbi.nlm.nih.gov/34749417/)

- **Year/type/IDs:** 2022; systematic review; DOI `10.1055/a-1559-3623`; PMID `34749417`.
- **Full-text state:** `ABSTRACT_ONLY`.
- **Population/event:** middle- and long-distance runners across observational, case, and
  intervention literature.
- **Protocol/outcome:** 20 articles; compared TID patterns and quantification methods. The abstract
  reports materially different classifications across sRPE, heart rate, lactate, race pace, and
  running speed.
- **Limitations:** no microcycle-length comparison, heterogeneous measurement methods, no exact
  youth 800/1500 stratum, and no evidence for 9.5 days or 2-3 MAIN sessions.
- **RQ-A classification:** `FIXED_WEEK_LIMITATION=NEITHER`; `9/9.5/10_USE=NEITHER`.
- **Product implication:** keep component/intensity provenance visible; do not use a TID result to
  justify a cycle length or collapse unlike measures into a readiness decision.

### A3. [Which Training Intensity Distribution Intervention Will Produce the Greatest Improvements...](https://pubmed.ncbi.nlm.nih.gov/39888556/)

- **Year/type/IDs:** 2025; systematic review and individual-participant network meta-analysis;
  DOI `10.1007/s40279-024-02149-3`; PMID `39888556`.
- **Full-text state:** `ABSTRACT_ONLY`.
- **Population/event:** 348 trained endurance athletes in 13 studies (296 male, 52 female;
  recreational and competitive; mean ages across studies 17.6-41.5 years); mixed endurance sports.
- **Protocol/outcome:** compared TID interventions for VO2max and time-trial performance. The
  abstract reports no statistically significant POL-versus-PYR difference for VO2max or time trial
  and no significant overall difference between POL and other TID interventions.
- **Limitations:** indirect mixed-sport population, few females, not a cycle-length comparison,
  performance-level subgroup result, and no 9/9.5/10-day protocol.
- **RQ-A classification:** `FIXED_WEEK_LIMITATION=NEITHER`; `9/9.5/10_USE=NEITHER`;
  `NULL_OPPOSING=YES` against a universal best TID.
- **Product implication:** RQ-A cannot turn a favored TID label into a deterministic frame rule;
  preserve training-status and measurement-method uncertainty.

### A4. [Block Periodization of Endurance Training: A Systematic Review and Meta-analysis](https://pmc.ncbi.nlm.nih.gov/articles/PMC6802561/)

- **Year/type/IDs:** 2019; systematic review/meta-analysis; DOI `10.2147/OAJSM.S180408`;
  PMID `31802956`; PMCID `PMC6802561`.
- **Full-text state:** `FULL_TEXT_VERIFIED`.
- **Population/event:** trained to well-trained endurance athletes across sports; not specific to
  adolescent middle-distance runners.
- **Protocol/outcome:** 20 eligible records from 2,905 screened; six studies pooled. Small favorable
  pooled effects for block versus traditional training on VO2max and maximal power were reported.
- **Limitations:** small studies, mean PEDro score 3.7/10, heterogeneous measures/designs, limited
  pooled set, and no seven-day versus 9/9.5/10-day comparison.
- **RQ-A classification:** `FIXED_WEEK_LIMITATION=INDIRECT`; `9/9.5/10_USE=NEITHER`.
- **Product implication:** block-periodization findings cannot be relabeled as support for the
  9.5-day whole architecture or for scientific superiority.

### A5. [A Systematic Review of Meta-Analyses Comparing Periodized and Non-periodized Exercise Programs](https://pmc.ncbi.nlm.nih.gov/articles/PMC6692867/)

- **Year/type/IDs:** 2019; systematic review of meta-analyses; DOI
  `10.3389/fphys.2019.01023`; PMID `31440169`; PMCID `PMC6692867`.
- **Full-text state:** `FULL_TEXT_VERIFIED`.
- **Population/event:** humans in periodization meta-analyses; underlying studies were strength
  training, not distance running.
- **Protocol/outcome:** audited 21 studies in two meta-analyses. None compared periodized programs
  with varied non-periodized programs, and none tested the accuracy of predicted adaptation timing.
- **Limitations:** strength-only evidence and methodological scope; it does not demonstrate that
  any nonweekly running frame is effective.
- **RQ-A classification:** `FIXED_WEEK_LIMITATION=INDIRECT_METHODOLOGICAL`;
  `9/9.5/10_USE=NEITHER`; `NULL_OPPOSING=YES` against claiming validated timing predictions.
- **Product implication:** 9.5 days must be labeled a product convention; the system must not say
  the duration predicts when adaptation or recovery will be complete.

### A6. [Coaches' Perceptions of Common Planning Concepts Within Training Theory: An International Survey](https://pmc.ncbi.nlm.nih.gov/articles/PMC10663426/)

- **Year/type/IDs:** 2023; cross-sectional international coach survey; DOI
  `10.1186/s40798-023-00657-6`; PMID `37989900`; PMCID `PMC10663426`.
- **Full-text state:** `FULL_TEXT_VERIFIED`.
- **Population/event:** 106 coaches; 58% individual-sport coaches, 32% coaching international-level
  athletes; sports were not reported separately for the RQ-A outcome.
- **Protocol/outcome:** convenience online survey. Only 33% agreed that physical adaptations are
  achievable within specific fixed timeframes; 76% disagreed that targets should remain fixed over
  a training period (the abstract rounds fixed-target support to 10%; full text reports 11%).
- **Limitations:** perceptions, self-selection, 92% male sample, no running-specific subgroup, no
  behavior verification, no cycle-prevalence question, and no outcome efficacy.
- **RQ-A classification:** `FIXED_WEEK_LIMITATION=SUPPORTS_FLEXIBLE_REVISION_INDIRECTLY`;
  `9/9.5/10_USE=NEITHER`.
- **Product implication:** keep the frame fixed while allowing versioned prescription inputs and
  coach revision; a fixed frame must not imply fixed adaptation timing or immutable session targets.

### A7. [Best-Practice Training Characteristics Within Olympic Endurance Sports as Described by Norwegian World-Class Coaches](https://pmc.ncbi.nlm.nih.gov/articles/PMC12031707/)

- **Year/type/IDs:** 2025; descriptive multiple-case study using questionnaires, log
  cross-reference, and interviews; DOI `10.1186/s40798-025-00848-3`; PMID `40278987`;
  PMCID `PMC12031707`.
- **Full-text state:** `FULL_TEXT_VERIFIED`; [Crossmark reports the document current](https://crossmark.crossref.org/dialog/?doi=10.1186%2Fs40798-025-00848-3).
- **Population/event:** 12 successful male Norwegian coaches across eight Olympic endurance sports;
  long-distance running was included, middle-distance disciplines under six minutes were excluded.
- **Protocol/outcome:** coaches described traditional but pragmatic periodization, 2-3 key workout
  days and 3-5 intensive sessions per week across sports, and relatively even week-to-week load for
  long-distance running with adjustments for travel, camps, and competition.
- **Limitations:** national/system context, all-male coach sample, descriptive and partly
  retrospective, no athlete-level causal outcome, no exact nonweekly-cycle question, and no youth
  middle-distance directness.
- **RQ-A classification:** `FIXED_WEEK_LIMITATION=MIXED_PRACTICAL_ADJUSTMENT`;
  `9/9.5/10_USE=NEITHER`; `OPPOSING_EVIDENCE=YES` because weekly organization remained explicit.
- **Product implication:** support constraint-aware adjustment inside the owner-selected frame, but
  do not describe 9-10-day cycles as standard world-class practice.

### A8. [The Training Characteristics of World-Class Distance Runners](https://pmc.ncbi.nlm.nih.gov/articles/PMC8975965/)

- **Year/type/IDs:** 2022; narrative integration of scientific literature and results-proven
  practice; DOI `10.1186/s40798-022-00438-7`; PMID `35362850`; PMCID `PMC8975965`.
- **Full-text state:** `FULL_TEXT_VERIFIED`.
- **Population/event:** world-class adult 5000 m, 10,000 m, and marathon runners.
- **Protocol/outcome:** synthesized literature and training-log/practice sources; reports 11-14
  sessions per week and presents typical training weeks across annual phases.
- **Limitations:** narrative review, long-distance rather than 800/1500 youth, selected
  results-proven practice, no cycle-length comparison, and weekly reporting may partly reflect
  source conventions.
- **RQ-A classification:** `FIXED_WEEK_LIMITATION=NEITHER`; `9/9.5/10_USE=NEITHER`;
  `OPPOSING_EVIDENCE=YES` because successful practice is described in weekly units.
- **Product implication:** weekly views must remain interoperable with the 9.5-day rail; the source
  cannot justify replacing or scientifically validating the owner-selected frame.

### A9. [Training Quantification and Periodization During Live High Train High at 2100 m in Elite Runners](https://pmc.ncbi.nlm.nih.gov/articles/PMC6243625/)

- **Year/type/IDs:** 2018; observational cohort case study; DOI `NOT_ASSIGNED`; PMID `30479529`;
  PMCID `PMC6243625`.
- **Full-text state:** `FULL_TEXT_VERIFIED`.
- **Population/event:** eight elite adult middle-distance runners (six male, two female; mean age
  25 years), several international representatives.
- **Protocol/outcome:** observed 4 weeks of coach-prescribed near-sea-level training and 3-4 weeks
  at altitude; the paper reports a typical training week while noting athlete-specific changes by
  event, physiology, and altitude experience.
- **Limitations:** n=8, altitude-camp context, observational, no comparator, no adolescent sample,
  and no nonweekly frame.
- **RQ-A classification:** `FIXED_WEEK_LIMITATION=MIXED_INDIVIDUALIZATION`;
  `9/9.5/10_USE=NEITHER`; `OPPOSING_EVIDENCE=YES` for the claim that elite middle-distance
  practice generally abandons weeks.
- **Product implication:** session candidates need event/context inputs and explicit overrides;
  this does not authorize a 9.5-day efficacy or safety claim.

### A10. [Chronic Glutamine Supplementation Increases Nasal but not Salivary IgA During 9 Days of Interval Training](https://journals.physiology.org/doi/full/10.1152/japplphysiol.00971.2003)

- **Year/type/IDs:** 2004; randomized supplement/placebo overload experiment; DOI
  `10.1152/japplphysiol.00971.2003`; PMID `15107413`.
- **Full-text state:** `FULL_TEXT_VERIFIED` on the official American Physiological Society page.
- **Population/event:** 13 healthy adult runners (four women, nine men), not elite youth
  middle-distance athletes.
- **Protocol/outcome:** approximately 9-9.5 consecutive days of supervised twice-daily intervals,
  followed by five recovery days; primary outcomes were glutamine and mucosal IgA, not microcycle
  efficacy. One participant withdrew and compliance was 96%.
- **Limitations:** short overload intervention, supplement question, very small sample, not a
  recurring cycle, no seven-day comparator, no performance or coaching-use outcome.
- **RQ-A classification:** `FIXED_WEEK_LIMITATION=NEITHER`; `9/9.5/10_USE=NEITHER`;
  `FALSE_POSITIVE_EXACT_DURATION=YES`.
- **Product implication:** prohibit citing this paper as evidence for TRAINORACLE's 9.5-day frame.

## 4. Verifiable Coaching, Interview, And Case-Use Evidence

These sources establish only that a named practice, template, or report exists. They are not
peer-reviewed efficacy or safety evidence.

### C1. [How Meb Keflezighi Trained to Win the Boston Marathon](https://www.runnersworld.com/races-places/a20852813/how-meb-keflezighi-trained-to-win-the-boston-marathon/)

- **Year/type/IDs:** 2014; in-person athlete interview/report; DOI/PMID `NOT_APPLICABLE`.
- **Full-text state:** `OFFICIAL_WEBPAGE_VERIFIED`.
- **Population/event:** Meb Keflezighi, elite adult male marathoner, preparing for the 2014 Boston
  Marathon.
- **Protocol/outcome:** Keflezighi reported one tempo run, one interval session, and one long run in
  each 9-day cycle, with other running adjusted by feel. The article documents the cycle after his
  Boston win and 2:08:37 personal best.
- **Limitations:** single retrospective self-report, late-career and injury-history context, no
  comparator, no causal attribution, no youth/middle-distance transfer, and no 9.5-day use.
- **RQ-A classification:** `ACTUAL_9_DAY_USE=VERIFIED_SELF_REPORT`;
  `FIXED_WEEK_LIMITATION=SELF_REPORTED_RECOVERY_RATIONALE`.
- **Product implication:** allowed wording is "a named elite marathoner used a 9-day cycle"; the win
  cannot be attributed to the cycle and does not validate 9.5 days.

### C2. [Can a 9-Day Training Cycle Work? YouTuber Michael Ko Thinks So](https://www.runnersworld.com/news/a43877401/9-day-training-cycle-michael-ko/)

- **Year/type/IDs:** 2023; journalistic report embedding athlete video/self-report; DOI/PMID
  `NOT_APPLICABLE`.
- **Full-text state:** `OFFICIAL_WEBPAGE_VERIFIED`.
- **Population/event:** adult recreational marathoner Michael Ko; Tokyo Marathon build.
- **Protocol/outcome:** threshold/easy/easy repeated, with the third quality exposure a long run;
  Ko reported a 2:56 personal best and better subjective recovery/enjoyment.
- **Limitations:** self-programmed single case, self-reported outcomes, no controlled comparator,
  concurrent training changes, and weekday feasibility concerns.
- **RQ-A classification:** `ACTUAL_9_DAY_USE=VERIFIED_SELF_REPORT`;
  `FIXED_WEEK_LIMITATION=SELF_REPORTED`.
- **Product implication:** useful as a transparent example of three quality exposures with two easy
  days between, not as proof of performance benefit, recovery completion, or youth suitability.

### C3. [Can't Fit Everything into a Week? Try a 14-Day Training Cycle](https://www.outsideonline.com/running/training/running-101/cant-fit-everything-into-a-week-try-a-14-day-training-cycle/)

- **Year/type/IDs:** 2020; coach/athlete interviews plus coach-authored practice article;
  DOI/PMID `NOT_APPLICABLE`.
- **Full-text state:** `OFFICIAL_WEBPAGE_VERIFIED`.
- **Population/event:** adult distance runners, including Lindsey Scherf and former elite runner/
  coach Thom Hunt; marathon/half/cross-country examples.
- **Protocol/outcome:** supplies 9- and 10-day templates; Hunt directly reports having used a
  10-day cycle. The author reports abandoning a nonweekly cycle for an Olympic Trials marathoner
  because it disrupted training-partner and social schedules; Hunt reports a 10-day routine was
  hard to maintain and prefers a two-week approach.
- **Limitations:** no systematic sample, no outcome testing, multiple anecdotes/templates, and a
  quoted 72-hour preference is not a physiological clearance rule.
- **RQ-A classification:** `ACTUAL_10_DAY_USE=VERIFIED_SELF_REPORT`;
  `PLAN_ONLY_9_DAY=YES`; `FIXED_WEEK_LIMITATION=SUPPORT_AND_COUNTEREVIDENCE`.
- **Product implication:** weekday/social/facility collisions are first-class prescription inputs;
  collision-free physiology alone is insufficient, and 72 hours remains only a stated preference.

### C4. [Train Smarter by Dumping the 7-Day Cycle](https://www.outsideonline.com/running/training/running-101/revisiting-the-7-day-training-week/)

- **Year/type/IDs:** 2019 page, originally published 2014; coaching article; DOI/PMID
  `NOT_APPLICABLE`.
- **Full-text state:** `OFFICIAL_WEBPAGE_VERIFIED`.
- **Population/event:** distance runners broadly; named Hansons Olympic Development Program and
  coach Ray Treacy's athletes.
- **Protocol/outcome:** reports that Hansons uses a 10-day cycle and Treacy uses 10 days to two
  weeks; describes perceived scheduling/recovery benefits and practical planning needs.
- **Limitations:** third-party report rather than opened participant/coach protocol, no denominator,
  no cohort outcomes, no exact athlete/event details, and includes unsupported injury/benefit
  language that must not be imported.
- **RQ-A classification:** `ACTUAL_10_DAY_USE=REPORTED_USE_NOT_PRIMARY_VERIFIED`;
  `FIXED_WEEK_LIMITATION=COACHING_RATIONALE`.
- **Product implication:** use only as a lead and corroborating practice report, not as prevalence,
  efficacy, injury-prevention, or safety evidence.

### C5. [Why Runners Should Extend Their Training Cycle](https://www.trainingpeaks.com/blog/why-runners-should-extend-their-training-cycle/)

- **Year/type/IDs:** 2015; coach-authored advice and sample plan; DOI/PMID `NOT_APPLICABLE`.
- **Full-text state:** `OFFICIAL_WEBPAGE_VERIFIED`.
- **Population/event:** runners broadly, with a marathon sample schedule.
- **Protocol/outcome:** proposes a 9-day schedule with long run, two quality sessions, easy/rest,
  strength/cross-training, and recovery; also discusses 10-day extension.
- **Limitations:** template/advice only, no named implemented cohort, no measured outcome, and no
  evidence that the suggested schedule is optimal.
- **RQ-A classification:** `PLAN_ONLY_9_DAY=VERIFIED`; `PLAN_ONLY_10_DAY=MENTIONED`;
  `ACTUAL_USE=NOT_FOUND_IN_SOURCE`.
- **Product implication:** shows the plan is intelligible to coaches/users; it cannot substantiate
  "commonly used" or determine TRAINORACLE's numerical policy.

### C6. [A Year Long Approach to Coaching: Short Sprints and Short Hurdles](https://www.ustfccca.org/assets/symposiums/2019/A_Year_Long_Approach_to_Coaching_Short_Sprints_%26_Short_Hurdles_MarkquisFrazier.pdf)

- **Year/type/IDs:** 2019; official USTFCCCA coaching-symposium PDF; DOI/PMID `NOT_APPLICABLE`.
- **Full-text state:** `OFFICIAL_PDF_VERIFIED`.
- **Population/event:** sprint/hurdle athletes at high-school, college, and professional levels;
  not middle-distance runners.
- **Protocol/outcome:** presents a 10-day in-season setup with speed, tempo, regeneration,
  strength, off, and flex days and states it may align with meet schedules.
- **Limitations:** coach presentation, no athlete sample or outcome, wrong event directness, and no
  evidence of safety, superiority, or 9.5-day use.
- **RQ-A classification:** `PLAN_ONLY_10_DAY=VERIFIED`; `ACTUAL_USE=NOT_VERIFIED`;
  `FIXED_WEEK_LIMITATION=EVENT_SCHEDULE_RATIONALE`.
- **Product implication:** competition anchors can justify moving sessions across weekday borders,
  but sprint programming cannot determine youth middle-distance dose or interval.

### C7. [Emma Bates, Top American Woman at the Boston Marathon, Shares Her Training and Recovery Tips](https://www.runnersworld.com/training/a43613388/emma-bates-training-and-recovery-tips/)

- **Year/type/IDs:** 2023; athlete interview/report; DOI/PMID `NOT_APPLICABLE`.
- **Full-text state:** `OFFICIAL_WEBPAGE_VERIFIED`.
- **Population/event:** Emma Bates, elite adult female marathoner, 2023 Boston Marathon build.
- **Protocol/outcome:** the interview explicitly describes a 10-day cycle containing two workouts
  and a long run, followed by three recovery days after the long run; Bates finished fifth in
  2:22:10.
- **Limitations:** single athlete self-report, no comparator or causal attribution, adult marathon
  rather than youth middle-distance, and no evidence for 9 or 9.5 days.
- **RQ-A classification:** `ACTUAL_10_DAY_USE=VERIFIED_ATHLETE_INTERVIEW`;
  `FIXED_WEEK_LIMITATION=SELF_REPORTED_RECOVERY_RATIONALE`.
- **Product implication:** this is valid named 10-day use evidence only; the performance cannot be
  attributed to the frame and cannot validate TRAINORACLE's exact duration.

## 4.1 Source Contradictions And Rejected Snippet Claims

1. `SOURCE_CONTRADICTION/OVERSTATED`: Runner's World's [Everything You Need to Know About the
   9-Day Training Cycle](https://www.runnersworld.com/training/a44556541/9-day-training-cycle/)
   says Emma Bates used nine days for Boston, but its own linked Bates interview (C7) explicitly
   reports a **10-day** build with two workouts, a long run, and three recovery days. Emma Bates is
   excluded from 9-day counts and retained only as 10-day use.
2. `SNIPPET_REFERENCE_LEAK/EXCLUDED`: DOI
   [`10.2147/OAJSM.S41655`](https://doi.org/10.2147/OAJSM.S41655) resolves to a cryotherapy review,
   not a 7-versus-10-day or nonweekly running-frame comparison. A search snippet's `n=9` and
   `10-day` wording came from referenced material, not the indexed paper's frame protocol. It is
   excluded from the evidence set and must not be cited for RQ-A.

## 5. Claim Adjudication

| Claim | Finding | Status | Reason |
|---|---|---|---|
| Fixed seven-day planning can create practical session/recovery/schedule collisions | Coach/interview evidence supports this concern; coach surveys support revisability of plans | `CONDITIONALLY_SUPPORTED_INDIRECT` | No direct runner trial isolates the calendar frame |
| Seven-day organization is absent from elite practice | Rejected | `NOT_SUPPORTED` | A7-A9 explicitly describe weekly organization in successful endurance and middle-distance practice |
| 9-day cycles have actually been used | Named cases found | `SUPPORTED_AS_USE_ONLY` | Meb Keflezighi and Michael Ko self-reports; no efficacy inference |
| 9.5-day cycles have actually been used in coaching | No eligible source found | `NOT_FOUND` | Exact web/PubMed search found only an overload-duration false positive |
| 10-day cycles have actually been used | Two direct athlete/runner interviews plus third-party named-program reports | `SUPPORTED_AS_USE_ONLY` | Emma Bates and Thom Hunt verify use; Hansons/Treacy report still needs primary protocol confirmation |
| 9-10-day cycles are commonly used | Reject the wording | `REJECT_AS_UNVERIFIED`; prevalence `NOT_FOUND` | No representative prevalence survey or denominator; named examples do not establish common use |
| 9.5 days is scientifically superior, optimal, safer, or injury preventing | No direct evidence | `NOT_FOUND`; claim `PROHIBITED` | No direct comparison; component and adjacent evidence cannot prove the whole architecture |
| 9.5 days or a fixed elapsed interval means recovery is complete | No direct evidence | `NOT_FOUND`; claim `PROHIBITED` | RQ-A sources do not validate outcome-specific recovery clearance |

## 6. Exact TRAINORACLE Implication

The owner-selected identity remains `LOCAL_CIVIL_9_DAYS_12_HOURS` with target authority
`9_5_DAY_AUTOMATED_PRESCRIPTION`. RQ-A changes the explanation and guardrails, not adoption.

Allowed owner/coach wording:

> TRAINORACLE uses an owner-selected 9.5-day frame to organize 2-3 MAIN candidates without
> binding every cycle to weekdays. Named runners and coaches have used 9- or 10-day cycles,
> but this search found no direct evidence for the exact 9.5-day frame and no evidence that
> 9-10-day cycles are common, scientifically superior, or safe by virtue of their duration.

Prescription-rule implication for downstream synthesis:

1. Treat `9.5 days` and `2-3 MAIN` as versioned owner policy values, never evidence-derived
   optimums.
2. Candidate generation may use the hard-day/easy-day pattern as an indirect organizing
   principle, but exact recovery buffers must wait for RQ-B/C and cannot imply clearance.
3. Inputs must include event/season/training status, race anchors, school/work/sleep constraints,
   facilities/training partners, recent actual sessions, and coach locks. Weekly calendar views
   remain interoperable rather than being declared physiologically invalid.
4. Record planned versus actual dates and intervals. Do not silently force a delayed/advanced
   session back onto a weekday template.
5. If 2-3 eligible MAIN exposures cannot be placed inside the 9.5-day frame after constraints and
   required execution gates, return
   `NO_AUTOMATED_PLAN -> KEEP_CURRENT_COACH_AUTHORED_PLAN`. Do not invent a new exception plan,
   present 5, 10, or 12-13 days as peer product choices, or infer recovery completion.

## 7. Metadata And Integrity Notes

- `ABSTRACT_ONLY` sources A1-A3 can seed synthesis but must not support detailed protocol,
  effect-size, safety, or final-certainty claims.
- No correction or retraction notice was visible on the official pages checked on 2026-07-17.
  Crossmark was explicitly checked only for A7; abstract-only sources remain
  `CORRECTION_STATUS_NOT_FULLY_VERIFIED` beyond their official PubMed records.
- All factual source descriptions above link to PubMed/PMC, an official journal/publisher,
  TrainingPeaks, Outside/Runner's World interview pages, or the official USTFCCCA PDF. Search-result
  snippets, Reddit, Wikipedia, and unexposed Google Books passages are not used as evidence.
- This raw audit does not edit or supersede any canonical ledger, specification, approval,
  runtime contract, or safety gate.
